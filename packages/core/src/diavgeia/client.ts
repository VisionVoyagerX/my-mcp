import { buildQuery, fetchJson } from "../http.js";
import {
  DiavgeiaDecisionSchema,
  DiavgeiaOrganizationSchema,
  DiavgeiaSearchResponseSchema,
  type DiavgeiaDecision,
  type DiavgeiaOrganization,
  type DiavgeiaSearchResponse,
} from "./types.js";

/**
 * Production base confirmed via indexed live call URLs
 * (`opendata.diavgeia.gov.gr/luminapi/api/search/export?...`) and the
 * official client-sample repos (github.com/diavgeia/opendata-client-samples-*).
 * Not live-verified from this environment — see CLAUDE.md network caveat.
 * Override with DIAVGEIA_BASE_URL, e.g. to point at the
 * test3.diavgeia.gov.gr sandbox.
 */
const DEFAULT_BASE_URL = "https://opendata.diavgeia.gov.gr/luminapi/api";

export interface DiavgeiaSearchParams {
  /** Free-text search term. */
  query?: string;
  /** Filter to decisions from this organization (Diavgeia organizationUid). */
  organizationUid?: string;
  /** Filter to decisions of this type (Diavgeia decisionTypeUid). */
  decisionTypeUid?: string;
  /** Filter to decisions signed by this signer (Diavgeia signerUid). */
  signerUid?: string;
  /** Only decisions issued on/after this date, format YYYY-MM-DD. */
  fromDate?: string;
  /** Only decisions issued on/before this date, format YYYY-MM-DD. */
  toDate?: string;
  /** 0-based page number. Defaults to 0. */
  page?: number;
  /** Page size. Defaults to 10, capped at 100 by the API. */
  size?: number;
}

export class DiavgeiaClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.DIAVGEIA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  /**
   * Search public-sector decisions using Diavgeia's Solr-backed search API.
   * Structured filters are combined with the free-text query using AND.
   */
  async searchDecisions(
    params: DiavgeiaSearchParams = {},
  ): Promise<DiavgeiaSearchResponse> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.organizationUid) {
      clauses.push(`organizationUid:"${params.organizationUid}"`);
    }
    if (params.decisionTypeUid) {
      clauses.push(`decisionTypeUid:"${params.decisionTypeUid}"`);
    }
    if (params.signerUid) clauses.push(`signerUid:"${params.signerUid}"`);
    if (params.fromDate) clauses.push(`issueDate>="${params.fromDate}"`);
    if (params.toDate) clauses.push(`issueDate<="${params.toDate}"`);

    const q = clauses.length > 0 ? clauses.join(" AND ") : "*:*";
    const qs = buildQuery({
      q,
      page: params.page ?? 0,
      size: params.size ?? 10,
      sort: "recent",
    });

    const raw = await fetchJson<unknown>(`${this.baseUrl}/search/advanced${qs}`);
    return DiavgeiaSearchResponseSchema.parse(raw);
  }

  /** Fetch a single decision by its ADA (Αριθμός Διαδικτυακής Ανάρτησης). */
  async getDecision(ada: string): Promise<DiavgeiaDecision> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/decisions/${encodeURIComponent(ada)}.json`,
    );
    return DiavgeiaDecisionSchema.parse(raw);
  }

  /** Fetch metadata for a public-sector organization by its Diavgeia UID. */
  async getOrganization(organizationUid: string): Promise<DiavgeiaOrganization> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/organizations/${encodeURIComponent(organizationUid)}.json`,
    );
    return DiavgeiaOrganizationSchema.parse(raw);
  }
}
