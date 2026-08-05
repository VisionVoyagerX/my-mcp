import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GemiClient } from "./client.js";
import { toolErrorResult, type ToolTextResult } from "../tool-result.js";

const METADATA_CATEGORIES = [
  "activities",
  "prefectures",
  "municipalities",
  "companyStatuses",
  "legalTypes",
  "gemiOffices",
  "assemblySubjects",
] as const;

type MetadataCategory = (typeof METADATA_CATEGORIES)[number];

function fetchMetadata(client: GemiClient, category: MetadataCategory) {
  switch (category) {
    case "activities":
      return client.listActivities();
    case "prefectures":
      return client.listPrefectures();
    case "municipalities":
      return client.listMunicipalities();
    case "companyStatuses":
      return client.listCompanyStatuses();
    case "legalTypes":
      return client.listLegalTypes();
    case "gemiOffices":
      return client.listGemiOffices();
    case "assemblySubjects":
      return client.listAssemblySubjects();
  }
}

export interface RegisterGemiToolsOptions {
  framing?: string;
  /** Overrides the `GEMI_API_KEY` env var (e.g. a Cloudflare Worker secret binding, which isn't visible as a Node-style env var). */
  apiKey?: string;
  /** Overrides the `GEMI_BASE_URL` env var. */
  baseUrl?: string;
  /**
   * Called before each upstream ΓΕΜΗ API call to enforce a rate limit.
   * ΓΕΜΗ caps a single `api_key` at 30 requests/minute *in total*, not per
   * caller — so a multi-tenant deployment (e.g. the public Cloudflare
   * worker, where every visitor shares one server-held key) needs a
   * global limiter here, not a per-caller one. Return `{ success: false }`
   * to reject the call with an actionable tool error instead of hitting
   * the upstream API. Omit for single-tenant deployments where the caller
   * is responsible for their own pacing.
   */
  checkRateLimit?: () => Promise<{ success: boolean }>;
}

const RATE_LIMIT_MESSAGE: ToolTextResult = {
  content: [
    {
      type: "text",
      text:
        "ΓΕΜΗ's API key is shared across every user of this server and ΚΥ ΓΕΜΗ " +
        "caps it at 30 requests/minute in total. That shared limit has been " +
        "reached — please wait a minute and try again.",
    },
  ],
  isError: true,
};

export function registerGemiTools(
  server: McpServer,
  options?: RegisterGemiToolsOptions,
): void {
  const client = new GemiClient({
    apiKey: options?.apiKey,
    baseUrl: options?.baseUrl,
  });
  const framingNote = options?.framing ? ` ${options.framing}` : "";
  const checkRateLimit = options?.checkRateLimit;

  async function rateLimitError(): Promise<ToolTextResult | undefined> {
    if (!checkRateLimit) return undefined;
    const { success } = await checkRateLimit();
    return success ? undefined : RATE_LIMIT_MESSAGE;
  }

  server.registerTool(
    "gemi_search_company_by_tin",
    {
      title: "Search ΓΕΜΗ company by TIN",
      description:
        "Look up Greek businesses registered with ΓΕΜΗ (the General Commercial Registry) by " +
        "their tax identification number (ΑΦΜ). Requires a free GEMI_API_KEY to be configured " +
        "on the server (register at opendata.businessportal.gr/register); returns an " +
        "actionable error naming that requirement if it's missing." +
        framingNote,
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
      const limited = await rateLimitError();
      if (limited) return limited;
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
        "have the company's ΑΦΜ. Requires GEMI_API_KEY to be configured on the server." +
        framingNote,
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
      const limited = await rateLimitError();
      if (limited) return limited;
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

  server.registerTool(
    "gemi_get_company_documents",
    {
      title: "Get a ΓΕΜΗ company's public documents",
      description:
        "Fetch a Greek business's public ΓΕΜΗ documents by its ΓΕΜΗ registration number: " +
        "assembly/board decisions (καταστατικό, ανακοινώσεις ΓΕΜΗ) and official gazette " +
        "publications, each with a link to the source file. Use gemi_search_company_by_tin " +
        "first if you only have the company's ΑΦΜ. Requires GEMI_API_KEY to be configured " +
        "on the server." +
        framingNote,
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
      const limited = await rateLimitError();
      if (limited) return limited;
      try {
        const documents = await client.getCompanyDocuments(registrationNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(documents, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch ΓΕΜΗ documents for company "${registrationNumber}"`,
        );
      }
    },
  );

  server.registerTool(
    "gemi_list_metadata",
    {
      title: "List ΓΕΜΗ reference/metadata codes",
      description:
        "Look up ΓΕΜΗ's reference code lists (parametric files), used to interpret the id " +
        "codes returned inline in company records or to build search filters: business " +
        "activity codes (ΚΑΔ), prefectures, municipalities, business status codes, legal " +
        "form codes, local ΓΕΜΗ registry offices, and assembly/decision subject codes. " +
        "Requires GEMI_API_KEY to be configured on the server." +
        framingNote,
      inputSchema: {
        category: z
          .enum(METADATA_CATEGORIES)
          .describe(
            "Which reference list to fetch: activities (ΚΑΔ codes), prefectures (νομοί), " +
              "municipalities (δήμοι), companyStatuses, legalTypes, gemiOffices, or " +
              "assemblySubjects.",
          ),
      },
    },
    async ({ category }) => {
      const limited = await rateLimitError();
      if (limited) return limited;
      try {
        const entries = await fetchMetadata(client, category);
        return {
          content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch ΓΕΜΗ "${category}" metadata`,
        );
      }
    },
  );
}
