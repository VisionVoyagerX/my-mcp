#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDiavgeiaTools } from "./tools/diavgeia.js";
import { registerCkanTools } from "./tools/ckan.js";
import { registerGeodataTools } from "./tools/geodata.js";

const server = new McpServer({
  name: "my-mcp-transparency",
  version: "0.1.0",
});

registerDiavgeiaTools(server);
registerCkanTools(server);
registerGeodataTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Fatal error starting my-mcp-transparency server:", error);
  process.exit(1);
});
