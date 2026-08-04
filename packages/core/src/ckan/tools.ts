import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CkanClient } from "./client.js";
import { toolErrorResult } from "../tool-result.js";

export interface RegisterCkanToolsOptions {
  framing?: string;
  /** Overrides the `DATA_GOV_GR_BASE_URL` env var. */
  baseUrl?: string;
  /** Overrides the `DATA_GOV_GR_TOKEN` env var (e.g. a Cloudflare Worker var/secret binding). */
  token?: string;
}

export function registerCkanTools(
  server: McpServer,
  options?: RegisterCkanToolsOptions,
): void {
  const client = new CkanClient({
    baseUrl: options?.baseUrl,
    token: options?.token,
  });
  const framingNote = options?.framing ? ` ${options.framing}` : "";

  server.registerTool(
    "ckan_search_datasets",
    {
      title: "Search data.gov.gr datasets",
      description:
        "Search the data.gov.gr open-data catalog (Greece's national CKAN portal, ~22k " +
        "datasets) by free-text query. Returns dataset titles, organizations, and resource " +
        "counts; use ckan_get_dataset afterwards to fetch the full record including download " +
        "links for a specific dataset. Requires a free DATA_GOV_GR_TOKEN to be configured on " +
        "the server for higher rate limits; unauthenticated requests may be rate-limited." +
        framingNote,
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
        "format and URL. Use ckan_search_datasets first if you don't already know the id." +
        framingNote,
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

  server.registerTool(
    "ckan_get_resource_data",
    {
      title: "Download and parse a data.gov.gr resource",
      description:
        "Downloads a dataset resource (CSV, XLS, or XLSX — get the URL from ckan_get_dataset's " +
        "resource list) and parses it into rows, so the file's actual data can be analyzed " +
        "directly instead of just its metadata. Returns a page of rows (default 50, max 500) " +
        "plus the total row count; call again with a higher offset to page through the rest." +
        framingNote,
      inputSchema: {
        url: z
          .string()
          .url()
          .describe("The resource's download URL, from ckan_get_dataset."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Max data rows to return (1-500). Defaults to 50."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Data row offset for pagination. Defaults to 0."),
        sheet: z
          .string()
          .optional()
          .describe(
            "Sheet name to read, for multi-sheet workbooks. Defaults to the first sheet.",
          ),
      },
    },
    async ({ url, limit, offset, sheet }) => {
      try {
        const data = await client.getResourceData(url, {
          limit,
          offset,
          sheet,
        });
        const start = offset ?? 0;
        const shown = data.rows.length;
        const header = [
          `Sheet "${data.sheet}" (${data.sheetNames.length > 1 ? `sheets: ${data.sheetNames.join(", ")}` : "1 sheet"})`,
          `Columns: ${data.columns.join(" | ")}`,
          `Rows ${start + 1}-${start + shown} of ${data.totalRows}${start + shown < data.totalRows ? ` (pass offset=${start + shown} for more)` : ""}:`,
        ];
        const rowLines = data.rows.map((row) =>
          row
            .map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
            .join(" | "),
        );
        return {
          content: [
            { type: "text", text: [...header, ...rowLines].join("\n") },
          ],
        };
      } catch (error) {
        return toolErrorResult(error, `Failed to fetch resource "${url}"`);
      }
    },
  );
}
