import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FactoryClient } from "./client.js";
import { TOOLS } from "./tools.js";

export const SERVER_NAME = "factory-mcp";

export function buildServer(client: FactoryClient): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: "0.0.0" });
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input, annotations: tool.annotations },
      async (args: z.infer<z.ZodObject<z.ZodRawShape>>) => {
        try {
          const result = await tool.call(client, args);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
          };
        }
      },
    );
  }
  return server;
}
