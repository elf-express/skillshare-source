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
 * If the server has no notion of scope, delete the /mcp/:scope routes and the hasScope dep — keep everything else.
 * Compatible with MCP remote connectors (Claude Desktop / claude.ai custom connectors) and MCPJungle streamable_http.
 */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const LOG = "[<server-name>]";

export interface HttpDeps {
  /** Numbers reported by /health so a probe can see the data actually loaded. */
  healthInfo: () => Record<string, number>;
  /** Whether /mcp/:scope is a known scope (unknown → 404). */
  hasScope: (id: string) => boolean;
}

export async function runHttp(
  createServer: (scope?: string) => McpServer,
  deps: HttpDeps
): Promise<void> {
  const port = parseInt(process.env.PORT || "<PORT>", 10);
  const authToken = process.env.MCP_AUTH_TOKEN?.trim();

  const app = express();
  // Keep in sync with nginx client_max_body_size (mcpjungle/nginx.example.conf uses 8m).
  app.use(express.json({ limit: "8mb" }));

  // One transport per session, keyed by mcp-session-id.
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", ...deps.healthInfo() });
  });

  function checkAuth(req: Request, res: Response): boolean {
    if (!authToken) return true;
    if ((req.headers.authorization || "") === "Bearer " + authToken) return true;
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: missing or invalid bearer token" },
      id: null,
    });
    return false;
  }

  async function handlePost(scope: string | undefined, req: Request, res: Response): Promise<void> {
    if (!checkAuth(req, res)) return;
    if (scope !== undefined && !deps.hasScope(scope)) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32004, message: `Unknown scope: ${scope}` },
        id: null,
      });
      return;
    }
    try {
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
      console.error(LOG + " request failed:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
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

  app.post("/mcp", (req, res) => handlePost(undefined, req, res));
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.post("/mcp/:scope", (req, res) => handlePost(req.params.scope, req, res));
  app.get("/mcp/:scope", handleSessionRequest);
  app.delete("/mcp/:scope", handleSessionRequest);

  app.listen(port, () => {
    // stderr only — see SKILL.md rule: never write logs to stdout.
    console.error(LOG + " HTTP server listening on http://0.0.0.0:" + port + " (/mcp, /mcp/<scope>)");
    console.error(LOG + " health: " + JSON.stringify(deps.healthInfo()));
    console.error(LOG + " auth: " + (authToken ? "Bearer token enabled" : "DISABLED (public access)"));
  });
}
