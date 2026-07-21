import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiavgeiaTools as registerDiavgeiaToolsCore } from "@my-mcp/core";

export function registerDiavgeiaTools(server: McpServer): void {
  registerDiavgeiaToolsCore(server, {
    framing:
      "Part of the my-mcp Business bundle, providing unified access to Greek government business data (ΓΕΜΗ, myDATA, Ergani) alongside Diavgeia procurement decisions.",
  });
}
