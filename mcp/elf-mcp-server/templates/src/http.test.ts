import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { NextFunction, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createHttpApp, sendInternalError, type HttpDeps } from "./http.js";

const token = "e322-private-test-token";
const internalError = { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null };
const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "http-regression", version: "1.0.0" } } };
const envKeys = ["PORT", "MCP_AUTH_TOKEN", "MCP_RATE_LIMIT_MAX", "MCP_RATE_LIMIT_WINDOW_MS"] as const;
let savedEnv: Record<string, string | undefined>;
let listeners: Server[];
let servers: McpServer[];
let sessions: Array<{ client: Client; transport: StreamableHTTPClientTransport }>;

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.PORT = "0";
  process.env.MCP_AUTH_TOKEN = token;
  process.env.MCP_RATE_LIMIT_MAX = "20";
  process.env.MCP_RATE_LIMIT_WINDOW_MS = "60000";
  listeners = [];
  servers = [];
  sessions = [];
});

afterEach(async () => {
  vi.restoreAllMocks();
  try {
    for (const { client, transport } of sessions) {
      try { if (transport.sessionId) await transport.terminateSession(); }
      catch { /* Already-deleted sessions intentionally return 400. */ }
      finally { await client.close(); await transport.close(); }
    }
    for (const server of servers) await server.close();
  } finally {
    for (const listener of listeners) {
      listener.closeAllConnections();
      await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    }
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  }
});

async function start(overrides: Partial<HttpDeps> = {}, makeServer?: (scope?: string) => McpServer) {
  const scopes: Array<string | undefined> = [];
  const checked: string[] = [];
  const createServer = makeServer ?? ((scope?: string) => {
    scopes.push(scope);
    const server = new McpServer({ name: "http-fixture", version: "1.0.0" });
    server.registerTool("probe", {
      description: "Return pong for the HTTP transport regression.", inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => ({ content: [{ type: "text", text: "pong" }] }));
    servers.push(server);
    return server;
  });
  const app = createHttpApp(createServer, {
    healthInfo: () => ({ docs: 1 }),
    hasScope: (scope) => { checked.push(scope); return scope === "alpha"; },
    ...overrides,
  });
  const listener = app.listen(0, "127.0.0.1");
  listeners.push(listener);
  await once(listener, "listening");
  const base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
  return { base, scopes, checked };
}

type Observed = { method: string; status: number; contentType: string | null; sessionId: string | null };
async function connect(base: string, route = "/mcp") {
  const observed: Observed[] = [];
  let reportGet: (response: Observed) => void = () => {};
  const get = new Promise<Observed>((resolve) => { reportGet = resolve; });
  const transport = new StreamableHTTPClientTransport(new URL(route, base), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1, maxReconnectionDelay: 1, reconnectionDelayGrowFactor: 1 },
    fetch: async (url, init) => {
      const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(3000)]) : AbortSignal.timeout(3000);
      const response = await fetch(url, { ...init, signal });
      const item = { method: init?.method ?? "GET", status: response.status, contentType: response.headers.get("content-type"), sessionId: response.headers.get("mcp-session-id") };
      observed.push(item);
      if (item.method === "GET") reportGet(item);
      return response;
    },
  });
  const client = new Client({ name: "http-regression", version: "1.0.0" });
  sessions.push({ client, transport });
  await client.connect(transport, { timeout: 3000 });
  return { client, transport, observed, get };
}

async function within<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("expected SSE response within 3000ms")), 3000); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(timer!); }
}

function raw(base: string, method: string, route = "/mcp", options: { auth?: string | null; sid?: string; version?: string; body?: string; forwarded?: string } = {}) {
  const headers: Record<string, string> = { Accept: "application/json, text/event-stream" };
  if (options.auth !== null) headers.Authorization = options.auth ?? `Bearer ${token}`;
  if (options.sid) headers["MCP-Session-Id"] = options.sid;
  if (options.version) headers["MCP-Protocol-Version"] = options.version;
  if (options.forwarded) headers["X-Forwarded-For"] = options.forwarded;
  if (method === "POST") headers["Content-Type"] = "application/json";
  return fetch(new URL(route, base), { method, headers, body: method === "POST" ? options.body ?? JSON.stringify(initialize) : undefined, signal: AbortSignal.timeout(3000) });
}

async function probe(client: Client) {
  expect((await client.listTools({}, { timeout: 3000 })).tools.map((tool) => tool.name)).toEqual(["probe"]);
  const result = await client.callTool({ name: "probe", arguments: {} }, undefined, { timeout: 3000 });
  expect(result.isError).not.toBe(true);
  expect(result.content).toEqual([{ type: "text", text: "pong" }]);
}

async function expectInternal(response: globalThis.Response) {
  expect(response.status).toBe(500);
  const wire = response;
  expect(wire.headers.get("content-type")).toContain("application/json");
  expect(await wire.json()).toEqual(internalError);
}

describe("HTTP transport migration", () => {
  it("keeps health public and unlimited", async () => {
    process.env.MCP_RATE_LIMIT_MAX = "2";
    const { base } = await start();
    for (let i = 0; i < 5; i++) {
      const response = await raw(base, "GET", "/health", { auth: null });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok", docs: 1 });
    }
  });

  it("serves an unscoped session lifecycle", async () => {
    const { base, scopes } = await start();
    const session = await connect(base);
    const sid = session.transport.sessionId;
    expect(sid).toEqual(expect.any(String));
    expect(session.observed[0]).toMatchObject({ method: "POST", status: 200, sessionId: sid });
    await probe(session.client);
    expect(await within(session.get)).toMatchObject({ method: "GET", status: 200, contentType: expect.stringContaining("text/event-stream") });
    expect(scopes).toEqual([undefined]);
    const version = session.transport.protocolVersion;
    await session.transport.terminateSession();
    expect(session.observed.some((item) => item.method === "DELETE" && item.status === 200)).toBe(true);
    await session.client.close();
    for (const method of ["GET", "DELETE"]) {
      const response = await raw(base, method, "/mcp", { sid, version });
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Invalid or missing session ID");
    }
  }, 15000);

  it("serves scoped routes with decoded scope", async () => {
    const { base, scopes, checked } = await start();
    const session = await connect(base, "/mcp/%61lpha");
    expect(session.transport.sessionId).toEqual(expect.any(String));
    await probe(session.client);
    expect(await within(session.get)).toMatchObject({ method: "GET", status: 200, contentType: expect.stringContaining("text/event-stream") });
    expect(scopes).toEqual(["alpha"]);
    expect(checked.length).toBeGreaterThan(0);
    expect(checked.every((scope) => scope === "alpha")).toBe(true);
    await session.transport.terminateSession();
    expect(session.observed.some((item) => item.method === "DELETE" && item.status === 200)).toBe(true);
  }, 15000);

  it("authenticates all six mcp routes", async () => {
    const { base } = await start();
    for (const route of ["/mcp", "/mcp/alpha"]) {
      for (const method of ["POST", "GET", "DELETE"]) {
        for (const auth of [null, "Bearer wrong"]) {
          const response = await raw(base, method, route, { auth });
          expect(response.status).toBe(401);
          expect(await response.json()).toMatchObject({ jsonrpc: "2.0", error: { code: -32001 }, id: null });
        }
      }
    }
  });

  it("rejects session verbs without a live session", async () => {
    const { base } = await start();
    for (const route of ["/mcp", "/mcp/alpha"]) {
      for (const method of ["GET", "DELETE"]) {
        for (const sid of [undefined, "unknown-session"]) {
          const response = await raw(base, method, route, { sid });
          expect(response.status).toBe(400);
          expect(await response.text()).toBe("Invalid or missing session ID");
        }
      }
    }
  });

  it("rejects a non-initialize post without a session", async () => {
    const { base, scopes } = await start();
    for (const route of ["/mcp", "/mcp/alpha"]) {
      const response = await raw(base, "POST", route, { body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: -32000 } });
    }
    expect(scopes).toEqual([]);
  });

  it("counts only failed auth and ignores spoofed forwarded IP", async () => {
    process.env.MCP_RATE_LIMIT_MAX = "2";
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base } = await start();
    const session = await connect(base);
    await probe(session.client);
    for (const [i, status] of [401, 401, 429].entries()) {
      const response = await raw(base, "POST", "/mcp", { auth: null, forwarded: `192.0.2.${i + 1}` });
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ error: { code: status === 429 ? -32029 : -32001 } });
      await probe(session.client);
    }
    expect((await raw(base, "GET", "/health", { auth: null })).status).toBe(200);
    const log = stderr.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(log).toMatch(/ip=.*used 3\/2, window 60000ms/);
    expect(log).not.toContain(token);
    expect(log).not.toContain("192.0.2.");
  }, 15000);

  it("rejects unknown scopes and extra path segments", async () => {
    const { base, scopes } = await start();
    const response = await raw(base, "POST", "/mcp/unknown");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: -32004, message: "Unknown scope: unknown" } });
    for (const method of ["POST", "GET", "DELETE"]) {
      const extra = await raw(base, method, "/mcp/alpha/extra");
      expect(extra.status).toBe(404);
      await extra.text();
    }
    expect(scopes).toEqual([]);
  });

  it("formats post and synchronous setup failures", async () => {
    const secret = "private-setup-failure";
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const scoped = await start({ hasScope: () => { throw new Error(secret); } });
    await expectInternal(await raw(scoped.base, "POST", "/mcp/alpha"));
    const factory = await start({}, () => { throw new Error(secret); });
    await expectInternal(await raw(factory.base, "POST"));
    const handle = await start();
    const session = await connect(handle.base);
    await within(session.get);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(new Error(secret));
    await expectInternal(await raw(handle.base, "POST", "/mcp", { sid: session.transport.sessionId, version: session.transport.protocolVersion }));
    expect(stderr.mock.calls.map((args) => args.join(" ")).join("\n")).toContain(secret);
  }, 15000);

  it("formats rejected session requests and stays alive", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => { unhandled.push(error); };
    process.on("unhandledRejection", onUnhandled);
    try {
      const { base } = await start();
      const session = await connect(base);
      await within(session.get);
      vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(new Error("private-session-failure"));
      for (const method of ["GET", "DELETE"]) {
        await expectInternal(await raw(base, method, "/mcp", { sid: session.transport.sessionId, version: session.transport.protocolVersion }));
      }
      expect((await raw(base, "GET", "/health")).status).toBe(200);
      expect(unhandled).toEqual([]);
      expect(stderr.mock.calls.map((args) => args.join(" ")).join("\n")).toContain("private-session-failure");
      const error = new Error("headers already sent");
      const status = vi.fn();
      const json = vi.fn();
      const next = vi.fn();
      sendInternalError(error, {} as Request, { headersSent: true, status, json } as unknown as Response, next as NextFunction);
      expect(next).toHaveBeenCalledExactlyOnceWith(error);
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    } finally { process.off("unhandledRejection", onUnhandled); }
  }, 15000);

  it("formats malformed JSON without changing the limit", async () => {
    const { base } = await start();
    const response = await raw(base, "POST", "/mcp", { body: "{" });
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
    expect((await raw(base, "GET", "/health")).status).toBe(200);
  });

  it("rejects bodies above eight MiB", async () => {
    const { base } = await start();
    const response = await raw(base, "POST", "/mcp", { body: JSON.stringify({ padding: "x".repeat(8 * 1024 * 1024) }) });
    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ jsonrpc: "2.0", error: { code: -32000, message: "Request body too large" }, id: null });
    const nearLimitBody = JSON.stringify({ ...initialize, params: { ...initialize.params, padding: "x".repeat(8 * 1024 * 1024 - 1024) } });
    expect(Buffer.byteLength(nearLimitBody)).toBeLessThan(8 * 1024 * 1024);
    const nearLimit = await raw(base, "POST", "/mcp", { body: nearLimitBody });
    expect(nearLimit.status).toBe(200);
    const sid = nearLimit.headers.get("mcp-session-id");
    expect(sid).toEqual(expect.any(String));
    await nearLimit.body?.cancel();
    const deleted = await raw(base, "DELETE", "/mcp", { sid: sid!, version: "2025-11-25" });
    expect(deleted.status).toBe(200);
    await deleted.text();
    const session = await connect(base);
    await probe(session.client);
  }, 15000);
});
