#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttpClient } from "../src/http-client.js";
import { startHttp } from "../src/http.js";
import { buildServer } from "../src/server.js";

// Credentials come from the environment only, never from argv.
const url = process.env.FACTORY_URL;
const token = process.env.FACTORY_API_TOKEN;
if (!url || !token) {
  process.stderr.write("factory-mcp: set FACTORY_URL and FACTORY_API_TOKEN\n");
  process.exit(1);
}

const args = process.argv.slice(2);
const server = buildServer(createHttpClient(url, token));

if (args.includes("--http")) {
  const i = args.indexOf("--port");
  const port = i >= 0 ? Number(args[i + 1]) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write("factory-mcp: --http needs --port <n>\n");
    process.exit(1);
  }
  const handle = await startHttp(server, { port, token });
  process.stderr.write(`factory-mcp: listening on ${handle.url}\n`);
} else {
  await server.connect(new StdioServerTransport());
}
