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
 * Root path confirmed 2026-07-18 against the official reference client
 * (github.com/diavgeia/opendata-client-samples-python, opendata.py) — its
 * `OpendataClient.__init__` defaults to
 * `https://test3.diavgeia.gov.gr/luminapi/opendata`, and every read method
 * (`/search/advanced`, `/decisions/{ada}/`, `/organizations/{uid}/`, etc.)
 * matches this client's paths. Two earlier defaults both 404'd in
 * production: `opendata.diavgeia.gov.gr/luminapi/api` (wrong subdomain) and
 * `diavgeia.gov.gr/luminapi/api` (right host, wrong root segment — `/api`
 * is a separate bulk-export surface, not the documented JSON API this
 * client's paths follow). Override with DIAVGEIA_BASE_URL, e.g. to point at
 * the test3.diavgeia.gov.gr sandbox itself.
 */
const DEFAULT_BASE_URL = "https://diavgeia.gov.gr/luminapi/opendata";

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

    if (clauses.length === 0) {
      throw new Error(
        "diavgeia_search_decisions requires at least one filter (query, organizationUid, " +
          "decisionTypeUid, signerUid, fromDate, or toDate) — Diavgeia's API rejects an " +
          "unfiltered match-all search with HTTP 400 rather than returning its entire index.",
      );
    }

    const q = clauses.join(" AND ");
    const qs = buildQuery({
      q,
      page: params.page ?? 0,
      size: params.size ?? 10,
      sort: "recent",
    });

    const raw = await fetchJson<unknown>(`${this.baseUrl}/search/advanced${qs}`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaSearchResponseSchema.parse(raw);
  }

  /** Fetch a single decision by its ADA (Αριθμός Διαδικτυακής Ανάρτησης). */
  async getDecision(ada: string): Promise<DiavgeiaDecision> {
    const raw = await fetchJson<unknown>(`${this.baseUrl}/decisions/${encodeURIComponent(ada)}/`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaDecisionSchema.parse(raw);
  }

  /** Fetch metadata for a public-sector organization by its Diavgeia UID. */
  async getOrganization(organizationUid: string): Promise<DiavgeiaOrganization> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/organizations/${encodeURIComponent(organizationUid)}/`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaOrganizationSchema.parse(raw);
  }
}
