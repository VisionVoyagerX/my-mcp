#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGemiTools } from "./tools/gemi.js";
import { registerMyDataTools } from "./tools/mydata.js";
import { registerErganiTools } from "./tools/ergani.js";

const server = new McpServer({
  name: "my-mcp-business",
  version: "0.1.0",
});

registerGemiTools(server);
registerMyDataTools(server);
registerErganiTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error starting my-mcp-business server:", error);
  process.exit(1);
});
