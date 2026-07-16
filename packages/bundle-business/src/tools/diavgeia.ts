import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiavgeiaClient, toolErrorResult } from "@my-mcp/core";

/**
 * Re-exposes the same @my-mcp/core DiavgeiaClient already used by
 * bundle-transparency — not a reimplementation. Diavgeia is genuinely
 * cross-domain per CLAUDE.md: procurement/contract-award decisions matter
 * to business-bundle users (e.g. checking a counterparty's public
 * contracts) just as much as to transparency-bundle users. Framing below
 * is tailored to that business use case; the underlying API calls are
 * identical to bundle-transparency's tools.
 */

function formatDate(value: string | number | undefined): string {
  if (value === undefined) return "unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

export function registerDiavgeiaTools(server: McpServer): void {
  const client = new DiavgeiaClient();

  server.registerTool(
    "diavgeia_search_decisions",
    {
      title: "Search Diavgeia decisions",
      description:
        "Search Greek public-sector decisions published on Diavgeia (the government " +
        "transparency portal), including procurement and contract-award decisions — useful " +
        "for checking a business counterparty's public contracts, or finding tender awards " +
        "from a specific ministry. Filter by organization, decision type, signer, and/or a " +
        "date range; results are paginated (10 per page by default). Use " +
        "diavgeia_get_decision afterwards to fetch the full record for a specific ADA.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Free-text search term (matched against decision subject/text)."),
        organizationUid: z
          .string()
          .optional()
          .describe("Diavgeia organization UID to filter by, e.g. \"100037417\"."),
        decisionTypeUid: z
          .string()
          .optional()
          .describe("Diavgeia decision-type UID to filter by, e.g. \"Β.1.1\"."),
        signerUid: z.string().optional().describe("Diavgeia signer UID to filter by."),
        fromDate: z
          .string()
          .optional()
          .describe("Only decisions issued on/after this date (YYYY-MM-DD)."),
        toDate: z
          .string()
          .optional()
          .describe("Only decisions issued on/before this date (YYYY-MM-DD)."),
        page: z.number().int().min(0).optional().describe("0-based page number. Defaults to 0."),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Results per page (1-100). Defaults to 10."),
      },
    },
    async (params) => {
      try {
        const result = await client.searchDecisions(params);
        if (result.decisions.length === 0) {
          return {
            content: [
              { type: "text", text: "No decisions matched the given filters." },
            ],
          };
        }
        const lines = result.decisions.map((d) => {
          const org = d.organization?.label ?? d.organizationId ?? "unknown organization";
          return `- **${d.ada ?? "no ADA"}** (${formatDate(d.issueDate)}, ${org}): ${d.subject ?? "no subject"}`;
        });
        const header = `Found ${result.total ?? result.decisions.length} decision(s), showing page ${result.page ?? 0} (${result.decisions.length} shown):`;
        return { content: [{ type: "text", text: `${header}\n${lines.join("\n")}` }] };
      } catch (error) {
        return toolErrorResult(error, "Failed to search Diavgeia decisions");
      }
    },
  );

  server.registerTool(
    "diavgeia_get_decision",
    {
      title: "Get a Diavgeia decision",
      description:
        "Fetch the full record for a single Greek public-sector decision from Diavgeia by its " +
        "ADA (Αριθμός Διαδικτυακής Ανάρτησης — the unique code every decision is published " +
        "under, e.g. \"6ΣΦ4ΩΞΧ-ΑΒΓ\"). Use diavgeia_search_decisions first if you don't already " +
        "have the ADA.",
      inputSchema: {
        ada: z.string().min(1).describe("The decision's ADA, e.g. \"6ΣΦ4ΩΞΧ-ΑΒΓ\"."),
      },
    },
    async ({ ada }) => {
      try {
        const d = await client.getDecision(ada);
        const org = d.organization?.label ?? d.organizationId ?? "unknown organization";
        const lines = [
          `ADA: ${d.ada ?? ada}`,
          `Subject: ${d.subject ?? "unknown"}`,
          `Organization: ${org}`,
          `Issue date: ${formatDate(d.issueDate)}`,
          d.protocolNumber ? `Protocol number: ${d.protocolNumber}` : undefined,
          d.decisionTypeUid ? `Decision type: ${d.decisionTypeUid}` : undefined,
          d.status ? `Status: ${d.status}` : undefined,
          d.documentUrl ? `Document: ${d.documentUrl}` : undefined,
        ].filter((line): line is string => line !== undefined);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(error, `Failed to fetch Diavgeia decision "${ada}"`);
      }
    },
  );
}
