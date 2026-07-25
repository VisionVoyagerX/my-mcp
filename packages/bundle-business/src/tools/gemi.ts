import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GemiClient, toolErrorResult } from "@my-mcp/core";

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

  server.registerTool(
    "gemi_get_company_documents",
    {
      title: "Get a ΓΕΜΗ company's public documents",
      description:
        "Fetch a Greek business's public ΓΕΜΗ documents by its ΓΕΜΗ registration number: " +
        "assembly/board decisions (καταστατικό, ανακοινώσεις ΓΕΜΗ) and official gazette " +
        "publications, each with a link to the source file. Use gemi_search_company_by_tin " +
        "first if you only have the company's ΑΦΜ. Requires GEMI_API_KEY to be configured " +
        "on the server.",
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
        const documents = await client.getCompanyDocuments(registrationNumber);
        return {
          content: [
            { type: "text", text: JSON.stringify(documents, null, 2) },
          ],
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
        "Requires GEMI_API_KEY to be configured on the server.",
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
