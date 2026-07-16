import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ErganiClient, GovApiError } from "@my-mcp/core";

function errorContent(error: unknown, context: string) {
  const message =
    error instanceof GovApiError
      ? `${context}: ${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
      : `${context}: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerErganiTools(server: McpServer): void {
  const client = new ErganiClient();

  server.registerTool(
    "ergani_list_services",
    {
      title: "List Ergani web services",
      description:
        "List the Ergani (Greek labor ministry) web services available to your employer/" +
        "software-house account, after authenticating with your own credentials. This is a " +
        "bring-your-own-credential tool: Ergani credentials belong to an individual employer, " +
        "so the server never holds a shared credential — pass your own username and password " +
        "with every call. Read-only: this MCP bundle deliberately does not expose Ergani's " +
        "write endpoints (work-card submission, overtime/schedule declarations) since those " +
        "are real filings to the labor ministry and their exact request payload shape hasn't " +
        "been confirmed against a live environment.",
      inputSchema: {
        username: z.string().min(1).describe("Your Ergani account username."),
        password: z.string().min(1).describe("Your Ergani account password."),
      },
    },
    async ({ username, password }) => {
      try {
        const services = await client.listServices({ username, password });
        return { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] };
      } catch (error) {
        return errorContent(error, "Failed to list Ergani services");
      }
    },
  );
}
