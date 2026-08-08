import type { z } from "zod";
import { buildQuery, fetchJson } from "../http.js";
import {
  KimdisAdamChainSchema,
  KimdisAwardSchema,
  KimdisContractSchema,
  KimdisNoticeSchema,
  KimdisPageSchema,
  KimdisPaymentSchema,
  KimdisPdeResultSchema,
  KimdisRequestSchema,
  type KimdisAdamChain,
  type KimdisAward,
  type KimdisContract,
  type KimdisNotice,
  type KimdisPage,
  type KimdisPayment,
  type KimdisRequest,
} from "./types.js";

/**
 * Live-verified 2026-08-08 via direct unauthenticated HTTP requests from an
 * unrestricted network (POST /request, /notice, /auction, /contract,
 * /payment; GET /adamChain, /request/attachment — all 200 with real data;
 * see RESEARCH.md). No auth for reads; ΚΗΜΔΗΣ documents a 350 req/min rate
 * limit (429 past that) — well above citizen-mcp's existing 30 req/min
 * per-IP RATE_LIMITER, so no separate limiter binding is needed for this
 * client.
 */
const DEFAULT_BASE_URL = "https://cerpp.eprocurement.gov.gr/khmdhs-opendata";

/** The five procurement-lifecycle record types, matching both the search and attachment path segments 1:1. */
export type KimdisRecordType =
  | "request"
  | "notice"
  | "auction"
  | "contract"
  | "payment";

/**
 * Filters shared by every /request, /notice, /auction, /contract, /payment
 * search endpoint. All fields are optional — unlike Diavgeia, ΚΗΜΔΗΣ's search
 * endpoints accept an empty body and return results (most-recent-first in
 * observed responses), confirmed live 2026-08-08, so this client does not
 * reject an unfiltered call.
 */
export interface KimdisBaseSearchParams {
  /** Free-text match against the record's title. */
  title?: string;
  /** CPV (Common Procurement Vocabulary) codes to filter by. */
  cpvItems?: string[];
  /** Contracting-authority identifiers (ΚΗΜΔΗΣ organization ids) to filter by. */
  organizations?: string[];
  /** Signer identifier. */
  signer?: string;
  /** Contract-type code. */
  contractType?: string;
  /** Only records signed/submitted on/after this date (YYYY-MM-DD). */
  dateFrom?: string;
  /** Only records signed/submitted on/before this date (YYYY-MM-DD). */
  dateTo?: string;
  /** Only records cancelled on/after this date (YYYY-MM-DD). */
  cancelDateFrom?: string;
  /** Only records cancelled on/before this date (YYYY-MM-DD). */
  cancelDateTo?: string;
  /** Minimum total cost. */
  totalCostFrom?: number;
  /** Maximum total cost. */
  totalCostTo?: number;
  /** Exact ΑΔΑΜ reference number. */
  referenceNumber?: string;
  /** 0-based page number. Defaults to 0; page size is fixed server-side (50 in observed responses). */
  page?: number;
}

export interface KimdisRequestSearchParams extends KimdisBaseSearchParams {
  isInitial?: boolean;
  isApproved?: boolean;
  isApproval?: boolean;
}

export interface KimdisNoticeSearchParams extends KimdisBaseSearchParams {
  procedureType?: string;
  /** Only notices with a bid-submission deadline on/after this date (YYYY-MM-DD). */
  finalDateFrom?: string;
  /** Only notices with a bid-submission deadline on/before this date (YYYY-MM-DD). */
  finalDateTo?: string;
  aaht?: string;
  publicFundingRefNum?: string;
  isModified?: boolean;
}

export interface KimdisAwardSearchParams extends KimdisBaseSearchParams {
  procedureType?: string;
  /** Winning contractor's VAT number. */
  vatNumber?: string;
  /** Winning contractor's name. */
  contractorName?: string;
  aaht?: string;
  /** Minimum estimated (pre-award) cost. */
  estTotalCostFrom?: number;
  /** Maximum estimated (pre-award) cost. */
  estTotalCostTo?: number;
  isModified?: boolean;
}

export interface KimdisContractSearchParams extends KimdisBaseSearchParams {
  procedureType?: string;
  vatNumber?: string;
  contractorName?: string;
  aaht?: string;
  publicFundingRefNum?: string;
  estTotalCostFrom?: number;
  estTotalCostTo?: number;
  isModified?: boolean;
}

export interface KimdisPaymentSearchParams extends KimdisBaseSearchParams {
  vatNumber?: string;
  contractorName?: string;
  publicFundingRefNum?: string;
}

export class KimdisClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.KIMDIS_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private async search<S extends z.ZodTypeAny, P extends KimdisBaseSearchParams>(
    recordType: KimdisRecordType,
    schema: S,
    params: P,
  ): Promise<KimdisPage<z.infer<S>>> {
    const { page, ...filters } = params;
    const body = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined),
    );
    const qs = buildQuery({ page: page ?? 0 });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/${recordType}${qs}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return KimdisPageSchema(schema).parse(raw);
  }

  /** Search Requests (Αιτήματα) — the internal pre-tender procurement-need stage. */
  async searchRequests(
    params: KimdisRequestSearchParams = {},
  ): Promise<KimdisPage<KimdisRequest>> {
    return this.search("request", KimdisRequestSchema, params);
  }

  /** Search Notices (Προσκλήσεις/Προκηρύξεις/Διακηρύξεις) — the public tender announcement stage. */
  async searchNotices(
    params: KimdisNoticeSearchParams = {},
  ): Promise<KimdisPage<KimdisNotice>> {
    return this.search("notice", KimdisNoticeSchema, params);
  }

  /** Search Awards (Αναθέσεις — the API calls this endpoint /auction) — who won a procurement. */
  async searchAwards(
    params: KimdisAwardSearchParams = {},
  ): Promise<KimdisPage<KimdisAward>> {
    return this.search("auction", KimdisAwardSchema, params);
  }

  /** Search Contracts (Συμβάσεις) — the signed contract formalizing an award. */
  async searchContracts(
    params: KimdisContractSearchParams = {},
  ): Promise<KimdisPage<KimdisContract>> {
    return this.search("contract", KimdisContractSchema, params);
  }

  /** Search Payment orders (Εντολές Πληρωμών) — disbursements against a signed contract. */
  async searchPayments(
    params: KimdisPaymentSearchParams = {},
  ): Promise<KimdisPage<KimdisPayment>> {
    return this.search("payment", KimdisPaymentSchema, params);
  }

  /**
   * Given any ΑΔΑΜ reference number, returns every other ΑΔΑΜ linked to it
   * across all five lifecycle stages — traces one procurement end-to-end.
   */
  async getAdamChain(referenceNumber: string): Promise<KimdisAdamChain> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/adamChain/${encodeURIComponent(referenceNumber)}`,
      { headers: { Accept: "application/json" } },
    );
    return KimdisAdamChainSchema.parse(raw);
  }

  /**
   * Builds the direct PDF URL for a record's attachment. Pure URL
   * construction, no network call — mirrors how the Diavgeia client returns
   * a `documentUrl` link rather than fetching the PDF's bytes through the
   * MCP server itself. Confirmed live 2026-08-08 (GET returns 200 for a
   * request attachment).
   */
  getAttachmentUrl(
    recordType: KimdisRecordType,
    referenceNumber: string,
  ): string {
    return `${this.baseUrl}/${recordType}/attachment/${encodeURIComponent(referenceNumber)}`;
  }

  /**
   * Look up the ΑΔΑΜ codes registered under a ΠΔΕ (public-investment-
   * programme) funding reference number. NOT live-verified with a real ΠΔΕ
   * number — every value tried during research returned 400 (invalid),
   * confirming only the error path. See KimdisPdeResultSchema.
   */
  async lookupPdeAdamCodes(pdeNumber: string): Promise<string[]> {
    const qs = buildQuery({ pdeNumber });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/pde${qs}`, {
      headers: { Accept: "application/json" },
    });
    const parsed = KimdisPdeResultSchema.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.content;
  }
}
