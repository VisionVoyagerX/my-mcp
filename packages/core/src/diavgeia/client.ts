import { buildQuery, fetchJson } from "../http.js";
import {
  DiavgeiaDecisionSchema,
  DiavgeiaDecisionTypeDetailsSchema,
  DiavgeiaDecisionTypesResponseSchema,
  DiavgeiaDecisionVersionLogSchema,
  DiavgeiaDictionaryListSchema,
  DiavgeiaDictionarySchema,
  DiavgeiaOrganizationDetailsSchema,
  DiavgeiaOrganizationSchema,
  DiavgeiaOrganizationsResponseSchema,
  DiavgeiaPositionsResponseSchema,
  DiavgeiaSearchResponseSchema,
  DiavgeiaSearchTermsResponseSchema,
  DiavgeiaUnitsResponseSchema,
  DiavgeiaUnitSchema,
  DiavgeiaSignerSchema,
  type DiavgeiaDecision,
  type DiavgeiaDecisionType,
  type DiavgeiaDecisionTypeDetails,
  type DiavgeiaDecisionVersionLog,
  type DiavgeiaDictionary,
  type DiavgeiaOrganization,
  type DiavgeiaOrganizationDetails,
  type DiavgeiaPosition,
  type DiavgeiaSearchResponse,
  type DiavgeiaSearchTerm,
  type DiavgeiaSigner,
  type DiavgeiaUnit,
} from "./types.js";

/** Diavgeia's /search/advanced hard-caps any issueDate range clause at 180 days — a wider
 * request is silently rewritten server-side (confirmed live 2026-07-23: a 2020-01-01..2020-12-31
 * request came back with the query echoed as 2020-01-01..2020-06-29, i.e. `from` kept fixed and
 * `to` pulled back to `from + 180 days` — no error, just quietly wrong results). We'd rather fail
 * loudly than return a truncated window the caller didn't ask for. */
const MAX_ISSUE_DATE_RANGE_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Formats a Date as the `DT(YYYY-MM-DDTHH:mm:ss)` literal Diavgeia's Lucene parser requires
 * for range queries on date fields (confirmed live: bare ISO dates/`*` open bounds both 400). */
function toDiavgeiaDateTime(date: Date): string {
  return `DT(${date.toISOString().slice(0, 19)})`;
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}" — expected format YYYY-MM-DD.`);
  }
  return date;
}

/**
 * Builds the `issueDate:[DT(...) TO DT(...)]` Lucene clause for /search/advanced.
 * Diavgeia's /search/advanced endpoint has no separate from_date/to_date HTTP
 * parameters (confirmed live: passing them alongside `q` is silently ignored —
 * the returned `info.query` never mentions them) — a date range can only be
 * expressed as a clause inside `q` itself.
 */
function buildIssueDateClause(
  fromDate?: string,
  toDate?: string,
): string | undefined {
  if (!fromDate && !toDate) return undefined;

  const from = fromDate ? parseDateOnly(fromDate) : undefined;
  const to = toDate
    ? new Date(parseDateOnly(toDate).getTime() + MS_PER_DAY - 1)
    : undefined;

  const resolvedFrom =
    from ?? new Date(to!.getTime() - MAX_ISSUE_DATE_RANGE_DAYS * MS_PER_DAY);
  const resolvedTo =
    to ??
    new Date(resolvedFrom.getTime() + MAX_ISSUE_DATE_RANGE_DAYS * MS_PER_DAY);

  const spanDays = (resolvedTo.getTime() - resolvedFrom.getTime()) / MS_PER_DAY;
  if (spanDays > MAX_ISSUE_DATE_RANGE_DAYS) {
    throw new Error(
      `diavgeia_search_decisions: fromDate/toDate span ${Math.ceil(spanDays)} days, but Diavgeia ` +
        `hard-caps a single /search/advanced date range at ${MAX_ISSUE_DATE_RANGE_DAYS} days and ` +
        "silently truncates wider requests instead of erroring. Narrow the range, or issue " +
        `sequential ${MAX_ISSUE_DATE_RANGE_DAYS}-day-wide calls to cover a longer period.`,
    );
  }

  return `issueDate:[${toDiavgeiaDateTime(resolvedFrom)} TO ${toDiavgeiaDateTime(resolvedTo)}]`;
}

/**
 * Root path confirmed 2026-07-18 against the official reference client
 * (github.com/diavgeia/opendata-client-samples-python, opendata.py) — its
 * `OpendataClient.__init__` defaults to
 * `https://test3.diavgeia.gov.gr/luminapi/opendata`, and every read method
 * (`/search/advanced`, `/decisions/{ada}/`, `/organizations/{uid}/`, etc.)
 * matches this client's paths. Override with DIAVGEIA_BASE_URL, e.g. to
 * point at the test3.diavgeia.gov.gr sandbox itself.
 */
const DEFAULT_BASE_URL = "https://diavgeia.gov.gr/luminapi/opendata";

export interface DiavgeiaSearchParams {
  /** Free-text search term. */
  query?: string;
  /** Filter to decisions from this organization (Diavgeia organizationUid). */
  organizationUid?: string;
  /** Filter to decisions of this type (Diavgeia decisionTypeUid — the search field name; the returned decision object calls this decisionTypeId). */
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

export interface DiavgeiaOrganizationSearchParams {
  /** Filter by organization status, e.g. "active" or "inactive". */
  status?: string;
  /** Filter by organization category (Diavgeia ORG_CATEGORY dictionary), e.g. "MINISTRY", "MUNICIPALITY", "NPDD". */
  category?: string;
  /** 0-based page number. Defaults to 0. Applied client-side — see searchOrganizations. */
  page?: number;
  /** Page size. Defaults to 10, capped at 100. Applied client-side — see searchOrganizations. */
  size?: number;
}

export interface DiavgeiaOrganizationSearchResult {
  organizations: DiavgeiaOrganization[];
  total: number;
  page: number;
  size: number;
}

export interface DiavgeiaSimpleSearchParams {
  /** Exact decision ADA. */
  ada?: string;
  /** Keyword(s) matched against the decision subject. */
  subject?: string;
  /** Protocol number. */
  protocol?: string;
  /** General free-text search term. */
  term?: string;
  /** Organization UID or latin name. */
  org?: string;
  /** Organization unit UID. */
  unit?: string;
  /** Signer UID. */
  signer?: string;
  /** Decision-type UID. */
  type?: string;
  /** Thematic-category UID. */
  tag?: string;
  /** Only decisions submitted/edited/revoked on/after this date (YYYY-MM-DD). Defaults to 6 months before now if omitted — independently of fromIssueDate. */
  fromDate?: string;
  /** Only decisions submitted/edited/revoked on/before this date (YYYY-MM-DD). */
  toDate?: string;
  /** Only decisions issued on/after this date (YYYY-MM-DD). Defaults to 6 months before now if omitted — independently of fromDate. */
  fromIssueDate?: string;
  /** Only decisions issued on/before this date (YYYY-MM-DD). */
  toIssueDate?: string;
  /** "published" | "revoked" | "pending_revocation" | "all". Defaults to "all". */
  status?: string;
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
    if (params.query) {
      // Diavgeia's /search/advanced Lucene parser rejects a bare, unfielded
      // term (confirmed live 2026-07-19: even `subject:budget` 400s, while
      // `content:"budget"` 200s with matching results) — free text must be
      // field-qualified and quoted against `content`, the full-text field.
      clauses.push(`content:"${params.query.replace(/"/g, '\\"')}"`);
    }
    if (params.organizationUid) {
      clauses.push(`organizationUid:"${params.organizationUid}"`);
    }
    if (params.decisionTypeUid) {
      clauses.push(`decisionTypeUid:"${params.decisionTypeUid}"`);
    }
    if (params.signerUid) clauses.push(`signerUid:"${params.signerUid}"`);
    // fromDate/toDate become an issueDate:[DT(...) TO DT(...)] clause inside q itself — Diavgeia's
    // /search/advanced has no separate from_date/to_date HTTP params (see buildIssueDateClause).
    const issueDateClause = buildIssueDateClause(
      params.fromDate,
      params.toDate,
    );
    if (issueDateClause) clauses.push(issueDateClause);

    if (clauses.length === 0) {
      throw new Error(
        "diavgeia_search_decisions requires at least one filter (query, organizationUid, " +
          "decisionTypeUid, signerUid, or fromDate/toDate) — Diavgeia's API rejects an " +
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

    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/search/advanced${qs}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    return DiavgeiaSearchResponseSchema.parse(raw);
  }

  /** Fetch a single decision by its ADA (Αριθμός Διαδικτυακής Ανάρτησης). */
  async getDecision(ada: string): Promise<DiavgeiaDecision> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/decisions/${encodeURIComponent(ada)}/`,
      {
        headers: { Accept: "application/json" },
      },
    );
    return DiavgeiaDecisionSchema.parse(raw);
  }

  /** Fetch metadata for a public-sector organization by its Diavgeia UID. */
  async getOrganization(
    organizationUid: string,
  ): Promise<DiavgeiaOrganization> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/organizations/${encodeURIComponent(organizationUid)}/`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaOrganizationSchema.parse(raw);
  }

  /**
   * Browse public-sector organizations by status/category. Diavgeia's
   * /organizations endpoint has no free-text name search and ignores
   * page/size (it always returns its entire match set), so pagination here
   * is applied client-side after fetching the filtered set.
   */
  async searchOrganizations(
    params: DiavgeiaOrganizationSearchParams = {},
  ): Promise<DiavgeiaOrganizationSearchResult> {
    if (!params.status && !params.category) {
      throw new Error(
        "diavgeia_search_organizations requires at least one filter (status or category) — " +
          "Diavgeia's /organizations endpoint returns its entire ~5,400-organization index " +
          "unfiltered, and does not paginate server-side, so an unfiltered call is both slow " +
          "and wasteful.",
      );
    }
    const qs = buildQuery({ status: params.status, category: params.category });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/organizations${qs}`, {
      headers: { Accept: "application/json" },
    });
    const { organizations: all } =
      DiavgeiaOrganizationsResponseSchema.parse(raw);

    const page = params.page ?? 0;
    const size = Math.min(params.size ?? 10, 100);
    const start = page * size;
    return {
      organizations: all.slice(start, start + size),
      total: all.length,
      page,
      size,
    };
  }

  /** List all Diavgeia decision types (the valid decisionTypeUid values), including category groupings. */
  async getDecisionTypes(): Promise<DiavgeiaDecisionType[]> {
    const raw = await fetchJson<unknown>(`${this.baseUrl}/types`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaDecisionTypesResponseSchema.parse(raw).decisionTypes;
  }

  /**
   * Fetch the extra-field schema and validation rules for a decision type —
   * what diavgeia_search_decisions/publishing needs to know is required or
   * allowed on decisions of this type, plus which search terms filter each
   * extra field (verified live 2026-07-23 via GET /types/{typeUid}/details).
   */
  async getDecisionTypeDetails(
    typeUid: string,
  ): Promise<DiavgeiaDecisionTypeDetails> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/types/${encodeURIComponent(typeUid)}/details`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaDecisionTypeDetailsSchema.parse(raw);
  }

  /**
   * List the search terms valid for filtering decisions of a specific type,
   * or (with no typeUid) every search term Diavgeia recognizes across all
   * decision types. Pass `commonOnly` to get just the subset valid for
   * every decision type regardless of type — useful as a smaller starting
   * point than the full field list.
   */
  async getSearchTerms(
    options: { typeUid?: string; commonOnly?: boolean } = {},
  ): Promise<DiavgeiaSearchTerm[]> {
    const path = options.typeUid
      ? `/types/${encodeURIComponent(options.typeUid)}/terms`
      : options.commonOnly
        ? "/search/terms/common"
        : "/search/terms";
    const raw = await fetchJson<unknown>(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaSearchTermsResponseSchema.parse(raw).terms;
  }

  /**
   * Keyword-based search (Diavgeia's /search endpoint) — an alternative to
   * searchDecisions()'s Lucene /search/advanced for callers who'd rather pass
   * plain keyword params than build a query string. Unlike /search/advanced,
   * this endpoint has two independent date filters that both default to a
   * 6-month window when omitted: fromDate/toDate bound submissionTimestamp
   * (when a decision was submitted/last edited) while fromIssueDate/
   * toIssueDate bound issueDate (when it was originally issued) — they are
   * ANDed together, so finding old-issueDate decisions still requires
   * widening fromDate/toDate too, or recently-resubmitted old decisions will
   * be the only ones that match (verified live 2026-07-23).
   */
  async simpleSearchDecisions(
    params: DiavgeiaSimpleSearchParams = {},
  ): Promise<DiavgeiaSearchResponse> {
    const hasFilter =
      params.ada ||
      params.subject ||
      params.protocol ||
      params.term ||
      params.org ||
      params.unit ||
      params.signer ||
      params.type ||
      params.tag ||
      params.fromDate ||
      params.toDate ||
      params.fromIssueDate ||
      params.toIssueDate;
    if (!hasFilter) {
      throw new Error(
        "diavgeia_simple_search_decisions requires at least one filter — Diavgeia's /search " +
          "endpoint rejects an unfiltered match-all search with HTTP 400.",
      );
    }
    const qs = buildQuery({
      ada: params.ada,
      subject: params.subject,
      protocol: params.protocol,
      term: params.term,
      org: params.org,
      unit: params.unit,
      signer: params.signer,
      type: params.type,
      tag: params.tag,
      from_date: params.fromDate,
      to_date: params.toDate,
      from_issue_date: params.fromIssueDate,
      to_issue_date: params.toIssueDate,
      status: params.status,
      page: params.page ?? 0,
      size: params.size ?? 10,
    });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/search${qs}`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaSearchResponseSchema.parse(raw);
  }

  /** Fetch a specific historical version of a decision by its versionId (see getDecisionVersionLog). */
  async getDecisionVersion(versionId: string): Promise<DiavgeiaDecision> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/decisions/v/${encodeURIComponent(versionId)}/`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaDecisionSchema.parse(raw);
  }

  /** Fetch the full revision history (initial publication + any corrections) of a decision by ADA. */
  async getDecisionVersionLog(
    ada: string,
  ): Promise<DiavgeiaDecisionVersionLog> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/decisions/${encodeURIComponent(ada)}/versionlog`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaDecisionVersionLogSchema.parse(raw);
  }

  /**
   * Fetch full details for an organization: identity metadata plus its units,
   * signers, positions, and any organizations it supervises, all in one call
   * (GET /organizations/{uid}/details). Prefer this over getOrganization()
   * when you need more than identity metadata.
   */
  async getOrganizationDetails(
    organizationUid: string,
  ): Promise<DiavgeiaOrganizationDetails> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/organizations/${encodeURIComponent(organizationUid)}/details`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaOrganizationDetailsSchema.parse(raw);
  }

  /**
   * List the organizational units belonging to an organization. Unlike the
   * `units` embedded in getOrganizationDetails() (always descendants=all),
   * this defaults to direct children only — pass descendants="all" to
   * include units of units (verified live 2026-07-23: 27 vs 46 for the same org).
   */
  async getOrganizationUnits(
    organizationUid: string,
    descendants: "children" | "all" = "children",
  ): Promise<DiavgeiaUnit[]> {
    const qs = buildQuery({ descendants });
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/organizations/${encodeURIComponent(organizationUid)}/units${qs}`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaUnitsResponseSchema.parse(raw).units;
  }

  /** Fetch a single organizational unit by its unit UID — resolves a decision's unitIds entries. */
  async getUnit(unitId: string): Promise<DiavgeiaUnit> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/units/${encodeURIComponent(unitId)}/`,
      {
        headers: { Accept: "application/json" },
      },
    );
    return DiavgeiaUnitSchema.parse(raw);
  }

  /** Fetch a single signer by their signer UID — resolves a decision's signerIds entries. */
  async getSigner(signerId: string): Promise<DiavgeiaSigner> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/signers/${encodeURIComponent(signerId)}/`,
      { headers: { Accept: "application/json" } },
    );
    return DiavgeiaSignerSchema.parse(raw);
  }

  /**
   * List every position defined across all organizations in Diavgeia (~25,000
   * entries, verified live 2026-07-23) — a flat label dictionary, not scoped
   * to one organization. The API returns its entire set unfiltered with no
   * server-side pagination, so pagination here is applied client-side, same
   * as searchOrganizations(). Prefer getOrganizationDetails() when you only
   * need the positions held within one specific organization.
   */
  async listPositions(params: { page?: number; size?: number } = {}): Promise<{
    positions: DiavgeiaPosition[];
    total: number;
    page: number;
    size: number;
  }> {
    const raw = await fetchJson<unknown>(`${this.baseUrl}/positions`, {
      headers: { Accept: "application/json" },
    });
    const { positions: all } = DiavgeiaPositionsResponseSchema.parse(raw);

    const page = params.page ?? 0;
    const size = Math.min(params.size ?? 10, 100);
    const start = page * size;
    return {
      positions: all.slice(start, start + size),
      total: all.length,
      page,
      size,
    };
  }

  /** List every available reference dictionary (e.g. ORG_CATEGORY, CPV, CURRENCY). */
  async getDictionaries(): Promise<{ uid: string; label: string }[]> {
    const raw = await fetchJson<unknown>(`${this.baseUrl}/dictionaries`, {
      headers: { Accept: "application/json" },
    });
    return DiavgeiaDictionaryListSchema.parse(raw).dictionaries;
  }

  /** Fetch the items of a specific reference dictionary by its uid (see getDictionaries). */
  async getDictionary(name: string): Promise<DiavgeiaDictionary> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/dictionaries/${encodeURIComponent(name)}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    return DiavgeiaDictionarySchema.parse(raw);
  }
}
