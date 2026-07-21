import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiavgeiaTools as registerDiavgeiaToolsCore } from "@my-mcp/core";

export function registerDiavgeiaTools(server: McpServer): void {
  registerDiavgeiaToolsCore(server, {
    framing:
      "Part of the my-mcp Transparency bundle, providing unified access to Greek government open data alongside CKAN and Geodata.",
  });
}
