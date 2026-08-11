import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KimdisClient, type KimdisRecordType } from "./client.js";
import { toolErrorResult } from "../tool-result.js";
import type {
  KimdisAward,
  KimdisCode,
  KimdisContract,
  KimdisNotice,
  KimdisPage,
  KimdisPayment,
  KimdisRequest,
} from "./types.js";

function codeLabel(code: KimdisCode | null | undefined): string | undefined {
  if (!code) return undefined;
  return code.value ?? code.key ?? undefined;
}

function orgLabel(org: KimdisCode | null | undefined, vatNumber?: string | null): string {
  return codeLabel(org) ?? vatNumber ?? "unknown organization";
}

function pageHeader(page: KimdisPage<unknown>, label: string): string {
  return `Found ${page.totalElements} ${label}, showing page ${page.number} (${page.content.length} shown, ${page.totalPages} page(s) total):\n`;
}

const COMMON_SEARCH_FIELDS = {
  title: z.string().optional().describe("Free-text match against the record's title."),
  cpvItems: z
    .array(z.string())
    .optional()
    .describe("CPV (Common Procurement Vocabulary) codes to filter by."),
  organizations: z
    .array(z.string())
    .optional()
    .describe("Contracting-authority identifiers to filter by."),
  signer: z.string().optional().describe("Signer identifier."),
  contractType: z.string().optional().describe("Contract-type code."),
  dateFrom: z
    .string()
    .optional()
    .describe("Only records signed/submitted on/after this date (YYYY-MM-DD)."),
  dateTo: z
    .string()
    .optional()
    .describe("Only records signed/submitted on/before this date (YYYY-MM-DD)."),
  cancelDateFrom: z
    .string()
    .optional()
    .describe("Only records cancelled on/after this date (YYYY-MM-DD)."),
  cancelDateTo: z
    .string()
    .optional()
    .describe("Only records cancelled on/before this date (YYYY-MM-DD)."),
  totalCostFrom: z.number().optional().describe("Minimum total cost."),
  totalCostTo: z.number().optional().describe("Maximum total cost."),
  referenceNumber: z.string().optional().describe("Exact ΑΔΑΜ reference number."),
  page: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("0-based page number. Defaults to 0; page size is fixed server-side (50)."),
};

export interface RegisterKimdisToolsOptions {
  framing?: string;
  /** Overrides the `KIMDIS_BASE_URL` env var. */
  baseUrl?: string;
}

export function registerKimdisTools(
  server: McpServer,
  options?: RegisterKimdisToolsOptions,
): void {
  const client = new KimdisClient({ baseUrl: options?.baseUrl });
  const framingNote = options?.framing ? ` ${options.framing}` : "";
  const lifecycleNote =
    " Part of ΚΗΜΔΗΣ's five-stage procurement lifecycle (request → notice → award → contract → " +
    "payment); use kimdis_get_adam_chain to trace one procurement across all five stages from any " +
    "single ΑΔΑΜ reference number. All filters are optional — an unfiltered call returns the most " +
    "recently submitted records.";

  server.registerTool(
    "kimdis_search_requests",
    {
      title: "Search ΚΗΜΔΗΣ Requests (Αιτήματα)",
      description:
        "Search Requests — the internal pre-tender stage where a Greek contracting authority " +
        "(municipality, ministry, hospital, etc.) records an intended procurement (CPV code, " +
        "estimated cost, budget linkage) before any public tender announcement." +
        lifecycleNote +
        framingNote,
      inputSchema: {
        ...COMMON_SEARCH_FIELDS,
        isInitial: z.boolean().optional().describe("Filter to initial (non-amending) requests."),
        isApproved: z.boolean().optional().describe("Filter to approved requests."),
        isApproval: z.boolean().optional().describe("Filter to approval-type requests."),
      },
    },
    async (params) => {
      try {
        const page = await client.searchRequests(params);
        if (page.content.length === 0) {
          return { content: [{ type: "text", text: "No requests matched the given filters." }] };
        }
        const lines = page.content.map(
          (r: KimdisRequest) =>
            `- **${r.referenceNumber}** (${orgLabel(r.organization, r.organizationVatNumber)}${r.signedDate ? `, ${r.signedDate}` : ""}${r.cancelled ? ", cancelled" : ""}): ${r.title ?? "(untitled)"}`,
        );
        return {
          content: [{ type: "text", text: `${pageHeader(page, "request(s)")}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search ΚΗΜΔΗΣ requests");
      }
    },
  );

  server.registerTool(
    "kimdis_search_notices",
    {
      title: "Search ΚΗΜΔΗΣ Notices (Προσκλήσεις/Προκηρύξεις/Διακηρύξεις)",
      description:
        "Search Notices — the public tender announcement stage, i.e. the record of what's " +
        "currently open for bidding in ΕΣΗΔΗΣ (the live tendering platform). Adds procedureType " +
        "and finalDateFrom/finalDateTo (bid-submission deadline) filters on top of the common " +
        "fields." +
        lifecycleNote +
        framingNote,
      inputSchema: {
        ...COMMON_SEARCH_FIELDS,
        procedureType: z.string().optional().describe("Procurement procedure-type code."),
        finalDateFrom: z
          .string()
          .optional()
          .describe("Only notices with a bid-submission deadline on/after this date (YYYY-MM-DD)."),
        finalDateTo: z
          .string()
          .optional()
          .describe("Only notices with a bid-submission deadline on/before this date (YYYY-MM-DD)."),
        aaht: z.string().optional().describe("Budget/accounting classification code (ΑΑΗΤ)."),
        publicFundingRefNum: z
          .string()
          .optional()
          .describe("Public-investment-programme (ΠΔΕ) funding reference number."),
        isModified: z.boolean().optional().describe("Filter to notices that amend a previous one."),
      },
    },
    async (params) => {
      try {
        const page = await client.searchNotices(params);
        if (page.content.length === 0) {
          return { content: [{ type: "text", text: "No notices matched the given filters." }] };
        }
        const lines = page.content.map(
          (n: KimdisNotice) =>
            `- **${n.referenceNumber}** (${orgLabel(n.organization, n.organizationVatNumber)}${codeLabel(n.typeOfProcedure) ? `, ${codeLabel(n.typeOfProcedure)}` : ""}${n.finalSubmissionDate ? `, deadline ${n.finalSubmissionDate}` : ""}${n.cancelled ? ", cancelled" : ""}): ${n.title ?? "(untitled)"}`,
        );
        return {
          content: [{ type: "text", text: `${pageHeader(page, "notice(s)")}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search ΚΗΜΔΗΣ notices");
      }
    },
  );

  server.registerTool(
    "kimdis_search_awards",
    {
      title: "Search ΚΗΜΔΗΣ Awards (Αναθέσεις)",
      description:
        "Search Awards — who won a procurement (contractorName, vatNumber) and the final vs. " +
        "estimated cost. NOTE: the underlying ΚΗΜΔΗΣ endpoint is named /auction, a literal-" +
        "translation artifact in the official docs — this is the award/allocation decision, not " +
        "a bidding auction." +
        lifecycleNote +
        framingNote,
      inputSchema: {
        ...COMMON_SEARCH_FIELDS,
        procedureType: z.string().optional().describe("Procurement procedure-type code."),
        vatNumber: z.string().optional().describe("Winning contractor's VAT number."),
        contractorName: z.string().optional().describe("Winning contractor's name."),
        aaht: z.string().optional().describe("Budget/accounting classification code (ΑΑΗΤ)."),
        estTotalCostFrom: z.number().optional().describe("Minimum estimated (pre-award) cost."),
        estTotalCostTo: z.number().optional().describe("Maximum estimated (pre-award) cost."),
        isModified: z.boolean().optional().describe("Filter to awards that amend a previous one."),
      },
    },
    async (params) => {
      try {
        const page = await client.searchAwards(params);
        if (page.content.length === 0) {
          return { content: [{ type: "text", text: "No awards matched the given filters." }] };
        }
        const lines = page.content.map((a: KimdisAward) => {
          const cost = a.totalCostWithVAT ?? a.budget;
          return `- **${a.referenceNumber}** (${orgLabel(a.organization, a.organizationVatNumber)}${cost ? `, €${cost}` : ""}${a.cancelled ? ", cancelled" : ""}): ${a.title ?? "(untitled)"}`;
        });
        return {
          content: [{ type: "text", text: `${pageHeader(page, "award(s)")}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search ΚΗΜΔΗΣ awards");
      }
    },
  );

  server.registerTool(
    "kimdis_search_contracts",
    {
      title: "Search ΚΗΜΔΗΣ Contracts (Συμβάσεις)",
      description:
        "Search Contracts — the signed legal contract formalizing an award: contractor, total " +
        "value, start/end dates." +
        lifecycleNote +
        framingNote,
      inputSchema: {
        ...COMMON_SEARCH_FIELDS,
        procedureType: z.string().optional().describe("Procurement procedure-type code."),
        vatNumber: z.string().optional().describe("Contractor's VAT number."),
        contractorName: z.string().optional().describe("Contractor's name."),
        aaht: z.string().optional().describe("Budget/accounting classification code (ΑΑΗΤ)."),
        publicFundingRefNum: z
          .string()
          .optional()
          .describe("Public-investment-programme (ΠΔΕ) funding reference number."),
        estTotalCostFrom: z.number().optional().describe("Minimum estimated (pre-contract) cost."),
        estTotalCostTo: z.number().optional().describe("Maximum estimated (pre-contract) cost."),
        isModified: z.boolean().optional().describe("Filter to contracts that amend a previous one."),
      },
    },
    async (params) => {
      try {
        const page = await client.searchContracts(params);
        if (page.content.length === 0) {
          return { content: [{ type: "text", text: "No contracts matched the given filters." }] };
        }
        const lines = page.content.map(
          (c: KimdisContract) =>
            `- **${c.referenceNumber}** (${orgLabel(c.organization, c.organizationVatNumber)}${c.contractBudget ? `, €${c.contractBudget}` : ""}${c.startDate ? `, ${c.startDate}${c.endDate ? ` to ${c.endDate}` : ""}` : ""}${c.cancelled ? ", cancelled" : ""}): ${c.title ?? "(untitled)"}`,
        );
        return {
          content: [{ type: "text", text: `${pageHeader(page, "contract(s)")}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search ΚΗΜΔΗΣ contracts");
      }
    },
  );

  server.registerTool(
    "kimdis_search_payments",
    {
      title: "Search ΚΗΜΔΗΣ Payment Orders (Εντολές Πληρωμών)",
      description:
        "Search Payment orders — actual disbursements against a signed contract. A single " +
        "contract can have multiple payment orders over its lifetime." +
        lifecycleNote +
        framingNote,
      inputSchema: {
        ...COMMON_SEARCH_FIELDS,
        vatNumber: z.string().optional().describe("Payee contractor's VAT number."),
        contractorName: z.string().optional().describe("Payee contractor's name."),
        publicFundingRefNum: z
          .string()
          .optional()
          .describe("Public-investment-programme (ΠΔΕ) funding reference number."),
      },
    },
    async (params) => {
      try {
        const page = await client.searchPayments(params);
        if (page.content.length === 0) {
          return { content: [{ type: "text", text: "No payments matched the given filters." }] };
        }
        const lines = page.content.map(
          (p: KimdisPayment) =>
            `- **${p.referenceNumber}** (${orgLabel(p.organization, p.organizationVatNumber)}${p.totalCostWithVAT ? `, €${p.totalCostWithVAT}` : ""}${p.signedDate ? `, ${p.signedDate}` : ""}${p.credit ? ", credit" : ""}${p.cancelled ? ", cancelled" : ""}): ${p.title ?? "(untitled)"}`,
        );
        return {
          content: [{ type: "text", text: `${pageHeader(page, "payment(s)")}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to search ΚΗΜΔΗΣ payments");
      }
    },
  );

  server.registerTool(
    "kimdis_get_adam_chain",
    {
      title: "Trace a ΚΗΜΔΗΣ procurement's lifecycle (ADAM chain)",
      description:
        "Given any ΑΔΑΜ reference number from a request, notice, award, contract, or payment, " +
        "returns every other ΑΔΑΜ linked to the same procurement across all five lifecycle " +
        "stages — the single call for tracing one procurement end-to-end (e.g. from an award " +
        "back to its originating request, or forward to every payment made against it)." +
        framingNote,
      inputSchema: {
        referenceNumber: z
          .string()
          .min(1)
          .describe("Any ΑΔΑΜ reference number in the chain (e.g. from a search result)."),
      },
    },
    async ({ referenceNumber }) => {
      try {
        const chain = await client.getAdamChain(referenceNumber);
        const sections: [string, string[]][] = [
          ["Requests", chain.requests],
          ["Approved requests", chain.approvedRequests],
          ["Notices", chain.notices],
          ["Awards", chain.auctions],
          ["Contracts", chain.contracts],
          ["Payments", chain.payments],
        ];
        const nonEmpty = sections.filter(([, refs]) => refs.length > 0);
        if (nonEmpty.length === 0) {
          return {
            content: [
              { type: "text", text: `No linked ΑΔΑΜ codes found for "${referenceNumber}".` },
            ],
          };
        }
        const lines = nonEmpty.map(([label, refs]) => `**${label}:** ${refs.join(", ")}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to fetch ΚΗΜΔΗΣ ADAM chain for "${referenceNumber}"`,
        );
      }
    },
  );

  server.registerTool(
    "kimdis_get_attachment",
    {
      title: "Get a ΚΗΜΔΗΣ record's PDF attachment URL",
      description:
        "Returns the direct PDF download URL for a ΚΗΜΔΗΣ record, given its record type " +
        "(request/notice/award/contract/payment) and ΑΔΑΜ reference number. Does not download " +
        "the PDF itself — just resolves the link, same as how Diavgeia records expose a " +
        "documentUrl." +
        framingNote,
      inputSchema: {
        recordType: z
          .enum(["request", "notice", "award", "contract", "payment"])
          .describe(
            'The record type. "award" maps to the underlying /auction endpoint (see kimdis_search_awards).',
          ),
        referenceNumber: z.string().min(1).describe("The record's ΑΔΑΜ reference number."),
      },
    },
    async ({ recordType, referenceNumber }) => {
      try {
        const apiRecordType: KimdisRecordType =
          recordType === "award" ? "auction" : recordType;
        const url = client.getAttachmentUrl(apiRecordType, referenceNumber);
        return { content: [{ type: "text", text: url }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Failed to resolve attachment URL for "${referenceNumber}"`,
        );
      }
    },
  );

  server.registerTool(
    "kimdis_lookup_pde",
    {
      title: "Look up ΑΔΑΜ codes by ΠΔΕ funding reference",
      description:
        "Look up the ΑΔΑΜ reference numbers registered under a ΠΔΕ (Πρόγραμμα Δημοσίων " +
        "Επενδύσεων — public investment programme) funding reference number. CAUTION: this " +
        "endpoint's success-response shape is not live-verified (only its 400 error path was " +
        "confirmed during research) — treat results as provisional until confirmed against a " +
        "known-good ΠΔΕ number." +
        framingNote,
      inputSchema: {
        pdeNumber: z.string().min(1).describe("The ΠΔΕ funding reference number."),
      },
    },
    async ({ pdeNumber }) => {
      try {
        const codes = await client.lookupPdeAdamCodes(pdeNumber);
        if (codes.length === 0) {
          return {
            content: [{ type: "text", text: `No ΑΔΑΜ codes found for ΠΔΕ "${pdeNumber}".` }],
          };
        }
        return { content: [{ type: "text", text: codes.join(", ") }] };
      } catch (error) {
        return toolErrorResult(error, `Failed to look up ΠΔΕ "${pdeNumber}"`);
      }
    },
  );
}
