import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GemiClient, toolErrorResult } from "@my-mcp/core";

export function registerGemiTools(server: McpServer): void {
  const client = new GemiClient();

  server.registerTool(
    "gemi_search_company_by_tin",
    {
      title: "Search ΓΕΜΗ company by TIN",
      description:
        "Look up Greek businesses registered with ΓΕΜΗ (the General Commercial Registry) by " +
        "their tax identification number (ΑΦΜ). Requires a free GEMI_API_KEY to be configured " +
        "on the server (register at opendata.businessportal.gr/register); returns an " +
        "actionable error naming that requirement if it's missing.",
      inputSchema: {
        tin: z
          .string()
          .min(1)
          .describe("The company's ΑΦΜ (tax identification number)."),
        isActive: z
          .boolean()
          .optional()
          .describe(
            "Filter to only active (true) or only inactive (false) companies.",
          ),
      },
    },
    async ({ tin, isActive }) => {
      try {
        const results = await client.searchCompanyByTin(tin, { isActive });
        if (results.length === 0) {
          return {
            content: [
              { type: "text", text: `No companies found for ΑΦΜ ${tin}.` },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} compan${results.length === 1 ? "y" : "ies"} for ΑΦΜ ${tin}:\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(error, `Failed to search ΓΕΜΗ for ΑΦΜ "${tin}"`);
      }
    },
  );

  server.registerTool(
    "gemi_get_company",
    {
      title: "Get a ΓΕΜΗ company",
      description:
        "Fetch full ΓΕΜΗ (General Commercial Registry) details for a single Greek business " +
        "by its ΓΕΜΗ registration number. Use gemi_search_company_by_tin first if you only " +
        "have the company's ΑΦΜ. Requires GEMI_API_KEY to be configured on the server.",
      inputSchema: {
        registrationNumber: z
          .string()
          .min(1)
          .describe(
            'The company\'s ΓΕΜΗ registration number, e.g. "000237954001".',
          ),
      },
    },
    async ({ registrationNumber }) => {
      try {
        const company = await client.getCompany(registrationNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(company, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch ΓΕΜΗ company "${registrationNumber}"`,
        );
      }
    },
  );
}
