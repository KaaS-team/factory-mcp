#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttpClient } from "../src/http-client.js";
import { buildServer } from "../src/server.js";

const url = process.env.FACTORY_URL;
const token = process.env.FACTORY_API_TOKEN;
if (!url || !token) {
  process.stderr.write("factory-mcp: set FACTORY_URL and FACTORY_API_TOKEN\n");
  process.exit(1);
}
await buildServer(createHttpClient(url, token)).connect(new StdioServerTransport());
