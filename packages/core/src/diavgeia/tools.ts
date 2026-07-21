import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiavgeiaClient, toolErrorResult } from "../index.js";
import type { DiavgeiaSearchParams } from "./client.js";

function formatDate(epochMillis: number): string {
  return new Date(epochMillis).toISOString().slice(0, 10);
}

export interface RegisterDiavgeiaToolsOptions {
  framing?: string;
}

export function registerDiavgeiaTools(
  server: McpServer,
  options?: RegisterDiavgeiaToolsOptions,
): void {
  const client = new DiavgeiaClient();
  const framingNote = options?.framing ? ` ${options.framing}` : "";

  server.registerTool(
    "diavgeia_search_decisions",
    {
      title: "Search Diavgeia decisions",
      description:
        "Search Greek public-sector decisions, decrees, and budget acts published on Diavgeia " +
        "(the government transparency portal). Filter by organization, decision type, signer, " +
        "and/or a date range; results are paginated (10 per page by default). At least one " +
        "filter is required — Diavgeia's API rejects an unfiltered search with HTTP 400. Use " +
        "diavgeia_get_decision afterwards to fetch the full record for a specific ADA. " +
        "Example: find recent procurement decisions from a ministry by passing its " +
        "organizationUid and a fromDate." +
        framingNote,
      inputSchema: z.object({
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
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Αναζήτηση αποφάσεων από το Υπουργείο με UID 100037417",
          input: { organizationUid: "100037417" },
        },
        {
          description: "Αναζήτηση αποφάσεων τύπου Β.1.1 (προμήθειες) τον τελευταίο μήνα",
          input: { decisionTypeUid: "Β.1.1", fromDate: "2026-06-21", toDate: "2026-07-21" },
        },
        {
          description: "Αναζήτηση αποφάσεων για υποδομές και έργα",
          input: { query: "υποδομές" },
        },
      ],
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await client.searchDecisions(params as DiavgeiaSearchParams);
        if (result.decisions.length === 0) {
          return {
            content: [
              { type: "text", text: "No decisions matched the given filters." },
            ],
          };
        }
        const lines = result.decisions.map((d) => {
          return `- **${d.ada}** (${formatDate(d.issueDate)}, org ${d.organizationId}): ${d.subject}`;
        });
        const header = `Found ${result.total} decision(s), showing page ${result.page} (${result.decisions.length} shown):`;
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
        "have the ADA." +
        framingNote,
      inputSchema: z.object({
        ada: z.string().min(1).describe("The decision's ADA, e.g. \"6ΣΦ4ΩΞΧ-ΑΒΓ\"."),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Ανάκτηση λεπτομερειών απόφασης με κωδικό ADA",
          input: { ada: "6ΣΦ4ΩΞΧ-ΑΒΓ" },
        },
      ],
    },
    async ({ ada }: Record<string, unknown>) => {
      try {
        const d = await client.getDecision(ada as string);
        const lines = [
          `ADA: ${d.ada}`,
          `Subject: ${d.subject}`,
          `Organization: ${d.organizationId}`,
          `Issue date: ${formatDate(d.issueDate)}`,
          `Protocol number: ${d.protocolNumber}`,
          `Decision type: ${d.decisionTypeId}`,
          `Status: ${d.status}`,
          `Document: ${d.documentUrl}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(error, `Failed to fetch Diavgeia decision "${ada}"`);
      }
    },
  );

  server.registerTool(
    "diavgeia_get_organization",
    {
      title: "Get Diavgeia organization metadata",
      description:
        "Resolve a Diavgeia organization UID to human-readable organization metadata. This tool " +
        "returns the official name, category, legal status, contact information, and other " +
        "administrative details for a Greek public-sector organization. Useful for understanding " +
        "which organization issued a decision, verifying an organization's official status, or " +
        "finding its website and contact email. Example: pass an organizationUid from a " +
        "diavgeia_search_decisions or diavgeia_get_decision result to get the full organization " +
        "name and details." +
        framingNote,
      inputSchema: z.object({
        organizationUid: z
          .string()
          .min(1)
          .describe("The organization's Diavgeia UID, e.g. \"100037417\"."),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Ανάκτηση ονόματος φορέα με κωδικό UID 100037417",
          input: { organizationUid: "100037417" },
        },
      ],
    },
    async ({ organizationUid }: Record<string, unknown>) => {
      try {
        const org = await client.getOrganization(organizationUid as string);
        const lines = [
          `UID: ${org.uid}`,
          `Label (official name): ${org.label}`,
          `Latin name: ${org.latinName}`,
          org.abbreviation ? `Abbreviation: ${org.abbreviation}` : undefined,
          `Category: ${org.category}`,
          `Status: ${org.status}`,
          `VAT number: ${org.vatNumber}`,
          `FEK number: ${org.fekNumber}`,
          `FEK issue: ${org.fekIssue}`,
          `FEK year: ${org.fekYear}`,
          `Contact email (ODE manager): ${org.odeManagerEmail}`,
          `Website: ${org.website}`,
          org.supervisorLabel
            ? `Supervisor: ${org.supervisorLabel}`
            : undefined,
          org.organizationDomains && org.organizationDomains.length > 0
            ? `Domains: ${org.organizationDomains.join(", ")}`
            : undefined,
        ]
          .filter((line) => line !== undefined)
          .join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch organization metadata for UID "${organizationUid}"`,
        );
      }
    },
  );

  server.registerPrompt(
    "diavgeia-search-procurements",
    {
      description: "Search for recent procurement decisions from a Greek ministry",
      argsSchema: {
        organization_uid: z.string().describe("Ministry UID (e.g., 100037417)"),
        days_back: z.number().optional().describe("Search decisions from the last N days"),
      },
    },
    async ({ organization_uid, days_back = 30 }: Record<string, unknown>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Search Diavgeia for procurement decisions (type Β.1.1) from ministry UID ${organization_uid} issued in the last ${days_back} days.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "diavgeia-search-by-type",
    {
      description: "Search for decisions of a specific type (e.g., B.1.1 = Procurement)",
      argsSchema: {
        decision_type: z.string().describe("Decision type UID (e.g., Β.1.1 for procurement)"),
        organization_uid: z.string().optional().describe("Optional: filter to a specific ministry UID"),
        days_back: z.number().optional().describe("Search decisions from the last N days"),
      },
    },
    async ({ decision_type, organization_uid, days_back = 60 }: Record<string, unknown>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Search Diavgeia for ${organization_uid ? `decisions of type ${decision_type} from ministry ${organization_uid}` : `decisions of type ${decision_type}`} issued in the last ${days_back} days.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "diavgeia-free-text-search",
    {
      description: "Search Diavgeia decisions using free-text keywords",
      argsSchema: {
        keywords: z.string().describe("Search keywords (e.g., 'infrastructure', 'προμήθεια')"),
        organization_uid: z.string().optional().describe("Optional: limit to a specific ministry UID"),
      },
    },
    async ({ keywords, organization_uid }: Record<string, unknown>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Search Diavgeia for decisions matching "${keywords}"${organization_uid ? ` from ministry ${organization_uid}` : ""}.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "diavgeia-resolve-organization",
    {
      description: "Look up a Greek ministry or organization by its UID to get its official name",
      argsSchema: {
        organization_uid: z.string().describe("The organization's Diavgeia UID (e.g., 100037417)"),
      },
    },
    async ({ organization_uid }: Record<string, unknown>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Get the official name and administrative details for organization UID ${organization_uid}.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "diavgeia-get-decision-details",
    {
      description: "Fetch the full record for a specific Greek government decision by its ADA code",
      argsSchema: {
        ada: z.string().describe("The decision's ADA code (e.g., 6ΣΦ4ΩΞΧ-ΑΒΓ)"),
      },
    },
    async ({ ada }: Record<string, unknown>) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Get the full details for Diavgeia decision with ADA ${ada}.`,
          },
        },
      ],
    }),
  );
}
