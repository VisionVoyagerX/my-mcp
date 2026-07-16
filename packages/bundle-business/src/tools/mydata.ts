import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MyDataClient, toolErrorResult } from "@my-mcp/core";

export function registerMyDataTools(server: McpServer): void {
  const client = new MyDataClient();

  server.registerTool(
    "mydata_request_docs",
    {
      title: "Request AADE myDATA invoices",
      description:
        "Fetch e-invoices (myDATA electronic books) from AADE for a Greek business, filtered " +
        "by date range and/or counterparty ΑΦΜ. This is a bring-your-own-credential tool: " +
        "myDATA subscription keys belong to an individual business's own Taxisnet " +
        "registration, so the server never holds a shared credential — pass your own userId " +
        "and subscriptionKey with every call (get them from aade.gr's myDATA registration). " +
        "Returns the raw XML response, since myDATA's invoice schema is large and not parsed " +
        "into structured fields by this tool.",
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe("Your AADE-issued aade-user-id for the myDATA subscription."),
        subscriptionKey: z
          .string()
          .min(1)
          .describe("Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription."),
        mark: z
          .string()
          .optional()
          .describe(
            "Only invoices with a mark (unique id) greater than this value; use for " +
              "incremental sync. Defaults to \"0\" (fetch from the beginning).",
          ),
        dateFrom: z.string().optional().describe("Start of the issue-date range (YYYY-MM-DD)."),
        dateTo: z.string().optional().describe("End of the issue-date range (YYYY-MM-DD)."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices issued by this ΑΦΜ."),
        counterVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices involving this counterparty ΑΦΜ."),
        invType: z
          .string()
          .optional()
          .describe("AADE invoice-type code to filter by, e.g. \"1.1\" for a sales invoice."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestDocs({ userId, subscriptionKey }, params);
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(error, "Failed to fetch myDATA invoices");
      }
    },
  );
}
