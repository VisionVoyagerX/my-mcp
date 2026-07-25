import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CkanClient, toolErrorResult } from "@my-mcp/core";

export function registerCkanTools(server: McpServer): void {
  const client = new CkanClient();

  server.registerTool(
    "ckan_search_datasets",
    {
      title: "Search data.gov.gr datasets",
      description:
        "Search the data.gov.gr open-data catalog (Greece's national CKAN portal, ~22k " +
        "datasets) by free-text query. Returns dataset titles, organizations, and resource " +
        "counts; use ckan_get_dataset afterwards to fetch the full record including download " +
        "links for a specific dataset. Requires a free DATA_GOV_GR_TOKEN to be configured on " +
        "the server for higher rate limits; unauthenticated requests may be rate-limited.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Free-text search term, e.g. "budget".'),
        rows: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Number of results to return (1-100). Defaults to 10."),
        start: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Offset for pagination. Defaults to 0."),
      },
    },
    async (params) => {
      try {
        const result = await client.searchDatasets(params);
        if (result.results.length === 0) {
          return {
            content: [{ type: "text", text: "No datasets matched the query." }],
          };
        }
        const lines = result.results.map((d) => {
          const org = d.organization?.title ?? "unknown organization";
          return `- **${d.title ?? d.name ?? "untitled"}** (id: ${d.id ?? d.name}, ${org}, ${d.resources.length} resource(s))`;
        });
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.count} dataset(s), showing ${result.results.length}:\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search data.gov.gr datasets");
      }
    },
  );

  server.registerTool(
    "ckan_get_dataset",
    {
      title: "Get a data.gov.gr dataset",
      description:
        "Fetch full metadata for a single data.gov.gr dataset by its id or URL slug " +
        '(e.g. "state-budget-2026"), including its resources (downloadable files) with ' +
        "format and URL. Use ckan_search_datasets first if you don't already know the id.",
      inputSchema: {
        id: z.string().min(1).describe("The dataset's CKAN id or name/slug."),
      },
    },
    async ({ id }) => {
      try {
        const d = await client.getDataset(id);
        const org = d.organization?.title ?? "unknown organization";
        const resourceLines = d.resources.map(
          (r) =>
            `  - ${r.name ?? r.id ?? "resource"} (${r.format ?? "unknown format"}): ${r.url ?? "no URL"}`,
        );
        const lines = [
          `Title: ${d.title ?? d.name ?? id}`,
          `Organization: ${org}`,
          d.notes ? `Description: ${d.notes}` : undefined,
          d.license_title ? `License: ${d.license_title}` : undefined,
          `Resources (${d.resources.length}):`,
          ...resourceLines,
        ].filter((line): line is string => line !== undefined);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch data.gov.gr dataset "${id}"`,
        );
      }
    },
  );
}
