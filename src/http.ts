import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export interface HttpOptions {
  port: number;
  token: string;
  /** Interface to bind. Defaults to loopback. */
  host?: string;
}

export interface HttpHandle {
  url: string;
  close(): Promise<void>;
}

/**
 * Serve `server` on the SDK streamable HTTP transport at /mcp.
 * One transport serves one MCP session: `server` talks to one client at a time.
 */
export async function startHttp(server: McpServer, { port, token, host = "127.0.0.1" }: HttpOptions): Promise<HttpHandle> {
  if (!token) throw new Error("startHttp: token must not be empty");
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
  await server.connect(transport);

  async function handle(req: Request): Promise<Response> {
    if (req.headers.get("authorization") !== `Bearer ${token}`) return new Response("unauthorized", { status: 401 });
    if (new URL(req.url).pathname !== "/mcp") return new Response("not found", { status: 404 });
    return transport.handleRequest(req);
  }

  const http: Server = createServer((incoming, outgoing) => {
    void respond(incoming, outgoing, handle, host);
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, resolve);
  });
  const bound = (http.address() as AddressInfo).port;
  return {
    url: `http://${host}:${bound}/mcp`,
    async close() {
      await transport.close();
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

async function respond(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  handle: (req: Request) => Promise<Response>,
  host: string,
): Promise<void> {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(incoming.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const method = incoming.method ?? "GET";
    const hasBody = method !== "GET" && method !== "HEAD";
    const chunks: Buffer[] = [];
    if (hasBody) for await (const c of incoming) chunks.push(c as Buffer);
    const request = new Request(`http://${incoming.headers.host ?? host}${incoming.url ?? "/"}`, {
      method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const res = await handle(request);
    outgoing.writeHead(res.status, Object.fromEntries(res.headers));
    if (!res.body) return void outgoing.end();
    const reader = res.body.getReader();
    outgoing.on("close", () => void reader.cancel().catch(() => {}));
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      outgoing.write(value);
    }
    outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}
