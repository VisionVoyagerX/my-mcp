#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-mcp-transparency",
  version: "0.1.0",
});

server.registerTool(
  "ping",
  {
    title: "Ping",
    description:
      "Scaffolding placeholder tool for the transparency domain bundle (Diavgeia, data.gov.gr, Geodata.gov.gr). Echoes back the given message to confirm the server is wired up end-to-end. Will be replaced by real Diavgeia tools in Phase 2.",
    inputSchema: {
      message: z.string().describe("Text to echo back."),
    },
  },
  async ({ message }) => ({
    content: [{ type: "text", text: `pong: ${message}` }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error starting my-mcp-transparency server:", error);
  process.exit(1);
});
