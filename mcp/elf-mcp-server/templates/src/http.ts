/**
 * http.ts — Streamable HTTP transport (generalised from elf-express/mcp-library docs-mcp-server/src/http.ts).
 *
 * Endpoints:
 *   - POST   /mcp            → unscoped server (tools take a `scope`-like parameter, e.g. corpus)
 *   - POST   /mcp/:scope     → server locked to one scope; unknown scope → 404
 *   - GET    /mcp[/:scope]   → server→client SSE for an existing session
 *   - DELETE /mcp[/:scope]   → end session
 *   - GET    /health         → NO auth, for docker healthcheck / gateway / cloud probes
 *
 * Rate limiting: /mcp* counts only failed-auth requests per source IP; over the limit → 429 until the window expires.
 * Requests with a correct token (or with auth disabled) are not counted. X-Forwarded-For is not trusted.
 * /health is never rate limited.
 *
 * If the server has no notion of scope, delete the /mcp/:scope routes and the hasScope dep — keep everything else.
 * Compatible with MCP remote connectors (Claude Desktop / claude.ai custom connectors) and MCPJungle streamable_http.
 */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response, type Express, type NextFunction } from "express";
import { rateLimit, type AugmentedRequest } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const LOG = "[<server-name>]";

export interface HttpDeps {
  /** Numbers reported by /health so a probe can see the data actually loaded. */
  healthInfo: () => Record<string, number>;
  /** Whether /mcp/:scope is a known scope (unknown → 404). */
  hasScope: (id: string) => boolean;
}

/** Read a positive-integer env var; fall back to the default when unset or invalid. */
function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Keep transport and body-parser failures in the public JSON-RPC error format. */
export function sendInternalError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  console.error(LOG + " request failed:", err);
  if (res.headersSent) {
    next(err);
    return;
  }
  const type = typeof err === "object" && err !== null && "type" in err ? err.type : undefined;
  const [status, code, message] = type === "entity.parse.failed"
    ? [400, -32700, "Parse error"] as const
    : type === "entity.too.large"
      ? [413, -32000, "Request body too large"] as const
      : [500, -32603, "Internal server error"] as const;
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

export function createHttpApp(
  createServer: (scope?: string) => McpServer,
  deps: HttpDeps
): Express {
  const authToken = process.env.MCP_AUTH_TOKEN?.trim();
  const rateLimitMax = envInt("MCP_RATE_LIMIT_MAX", 20);
  const rateLimitWindowMs = envInt("MCP_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);

  const app = express();
  // Count by connection source IP; do not trust X-Forwarded-For.
  app.set("trust proxy", false);
  // Keep in sync with nginx client_max_body_size (mcpjungle/nginx.example.conf uses 8m).
  app.use(express.json({ limit: "8mb" }));

  // One transport per session, keyed by mcp-session-id.
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", ...deps.healthInfo() });
  });

  function isAuthorized(req: Request): boolean {
    if (!authToken) return true;
    return (req.headers.authorization || "") === "Bearer " + authToken;
  }

  function checkAuth(req: Request, res: Response): boolean {
    if (isAuthorized(req)) return true;
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: missing or invalid bearer token" },
      id: null,
    });
    return false;
  }

  // Counts only failed-auth requests: authorized requests are skipped and use no quota.
  const mcpLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => isAuthorized(req),
    validate: { xForwardedForHeader: false },
    handler: (req, res, _next, options) => {
      const info = (req as AugmentedRequest).rateLimit;
      console.error(
        LOG + " failed-auth limit exceeded, returning 429: ip=" + req.ip +
        " used " + info.used + "/" + info.limit + ", window " + rateLimitWindowMs + "ms"
      );
      res.status(options.statusCode).json({
        jsonrpc: "2.0",
        error: { code: -32029, message: "Too many failed authentication attempts, retry later" },
        id: null,
      });
    },
  });

  async function handlePost(scope: string | undefined, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!checkAuth(req, res)) return;
    try {
      if (scope !== undefined && !deps.hasScope(scope)) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32004, message: `Unknown scope: ${scope}` },
          id: null,
        });
        return;
      }
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) delete transports[transport.sessionId];
        };
        const server = createServer(scope);
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: no valid session ID provided" },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      sendInternalError(err, req, res, next);
    }
  }

  const handleSessionRequest = async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  app.post("/mcp", mcpLimiter, (req, res, next) => handlePost(undefined, req, res, next));
  app.get("/mcp", mcpLimiter, handleSessionRequest);
  app.delete("/mcp", mcpLimiter, handleSessionRequest);

  app.post("/mcp/:scope", mcpLimiter, (req: Request<{ scope: string }>, res, next) => handlePost(req.params.scope, req, res, next));
  app.get("/mcp/:scope", mcpLimiter, handleSessionRequest);
  app.delete("/mcp/:scope", mcpLimiter, handleSessionRequest);

  app.use(sendInternalError);
  return app;
}

export async function runHttp(
  createServer: (scope?: string) => McpServer,
  deps: HttpDeps
): Promise<void> {
  const port = parseInt(process.env.PORT || "<PORT>", 10);
  const authToken = process.env.MCP_AUTH_TOKEN?.trim();
  const rateLimitMax = envInt("MCP_RATE_LIMIT_MAX", 20);
  const rateLimitWindowMs = envInt("MCP_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
  const app = createHttpApp(createServer, deps);

  app.listen(port, () => {
    // stderr only — see SKILL.md rule: never write logs to stdout.
    console.error(LOG + " HTTP server listening on http://0.0.0.0:" + port + " (/mcp, /mcp/<scope>)");
    console.error(LOG + " health: " + JSON.stringify(deps.healthInfo()));
    console.error(LOG + " auth: " + (authToken ? "Bearer token enabled" : "DISABLED (public access)"));
    console.error(LOG + " rate limit: " + rateLimitMax + " failed auths per " + rateLimitWindowMs + "ms, then 429");
  });
}
