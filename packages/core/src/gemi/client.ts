import { z } from "zod";
import { buildQuery, fetchJson, GovApiError } from "../http.js";
import {
  GemiActivitySchema,
  GemiAssemblySubjectSchema,
  GemiCompanyDocumentSetSchema,
  GemiCompanySchema,
  GemiCompanyStatusSchema,
  GemiLegalTypeSchema,
  GemiMunicipalitySchema,
  GemiOfficeSchema,
  GemiPrefectureSchema,
  GemiSearchResponseSchema,
  type GemiActivity,
  type GemiAssemblySubject,
  type GemiCompany,
  type GemiCompanyDocumentSet,
  type GemiCompanyStatus,
  type GemiLegalType,
  type GemiMunicipality,
  type GemiOffice,
  type GemiPrefecture,
} from "./types.js";

/**
 * Base URL, endpoint paths, and `api_key` header confirmed 2026-07-25
 * against the official Swagger 2.0 spec fetched live from
 * `https://opendata-api.businessportal.gr/api-docs` (see types.ts for how
 * that URL was found).
 *
 * Endpoint-by-endpoint live re-verification, 2026-07-25 (unrestricted
 * network, unauthenticated — no real key available):
 * - This API is fronted by AWS API Gateway with a blanket api-key
 *   requirement on every route, including ones that don't exist (a
 *   deliberately bogus path returns the same `{"message":"Unauthorized"}`
 *   as a real one) and `/health`. Unlike myDATA's Azure APIM gateway, this
 *   means an unauthenticated request can *not* distinguish a correct path
 *   from a typo — the live Swagger spec (not live HTTP probing) is the only
 *   available ground truth for path/param correctness. Every path and
 *   parameter this client sends was diffed against that spec's `paths`
 *   object and matches exactly.
 * - The `api-docs-key` test key previously documented here as a "limited
 *   test key" does **not** work — it was tried against every endpoint below
 *   and returned `{"message":"Unauthorized"}` on all of them, same as an
 *   empty/garbage key. `opendata.businessportal.gr`'s own registration page
 *   confirms there's no self-service or public test key: access requires
 *   submitting the registration form and waiting for ΚΥ ΓΕΜΗ (the GEMI
 *   central service) to manually approve it before issuing a real
 *   `api_key`. Wherever this "api-docs-key" claim originated, it wasn't
 *   verified — don't rely on it.
 * - The spec also documents two endpoints this client does not implement:
 *   `GET /downloadFile?key&elementId` (fetches the underlying file for a
 *   document — the `CompanyDocumentSet` schema's `decision`/`publication`
 *   entries already carry direct `assemblyDecisionUrl`/`url` fields, so this
 *   may be a redundant or edge-case path rather than a required one — not
 *   determined) and `GET /health` (unauthenticated-looking but actually
 *   requires the same api_key as everything else here).
 *
 * End-to-end live verification, 2026-08-04, with a real approved
 * `GEMI_API_KEY`: every method below was exercised against production and
 * returns 200s that parse against the schemas in types.ts. Two of the
 * spec's declared types turned out to be wrong compared to real responses
 * — `Company.arGemi` and the standalone `id` field on `legalTypes` /
 * `companyStatuses` / `gemiOffices` metadata entries are strings, not
 * integers, in production. See the corresponding comments in types.ts.
 */
const DEFAULT_BASE_URL =
  "https://opendata-api.businessportal.gr/api/opendata/v1";

export class GemiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.GEMI_BASE_URL ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey ?? process.env.GEMI_API_KEY;
  }

  private headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new GovApiError(
        "No GEMI API key configured. Register at " +
          "opendata.businessportal.gr/register and set GEMI_API_KEY once " +
          "ΚΥ ΓΕΜΗ approves the request (this is a manual approval, not an " +
          "instant self-service key — verified 2026-07-25, see client.ts).",
        { url: this.baseUrl },
      );
    }
    return { api_key: this.apiKey, Accept: "application/json" };
  }

  private async getMetadata<T>(
    path: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const raw = await fetchJson<unknown>(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    });
    return z.array(schema).parse(raw);
  }

  /**
   * Search companies by tax identification number (ΑΦΜ). `GET /companies`
   * returns `{ searchMetadata, searchResults }`, not a bare array — this
   * unwraps `searchResults` for callers.
   */
  async searchCompanyByTin(
    tin: string,
    options: { isActive?: boolean; resultsSize?: number } = {},
  ): Promise<GemiCompany[]> {
    const qs = buildQuery({
      afm: tin,
      isActive: options.isActive,
      resultsSize: options.resultsSize ?? 10,
    });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/companies${qs}`, {
      headers: this.headers(),
    });
    return GemiSearchResponseSchema.parse(raw).searchResults;
  }

  /** Fetch a single company by its ΓΕΜΗ registration number (arGemi). */
  async getCompany(registrationNumber: string): Promise<GemiCompany> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/companies/${encodeURIComponent(registrationNumber)}`,
      { headers: this.headers() },
    );
    return GemiCompanySchema.parse(raw);
  }

  /**
   * Fetch a company's public documents: assembly/board decisions
   * (καταστατικό, ανακοινώσεις ΓΕΜΗ) and official gazette publications.
   */
  async getCompanyDocuments(
    registrationNumber: string,
  ): Promise<GemiCompanyDocumentSet> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/companies/${encodeURIComponent(registrationNumber)}/documents`,
      { headers: this.headers() },
    );
    return GemiCompanyDocumentSetSchema.parse(raw);
  }

  /** Reference list of ΚΑΔ business activity codes. */
  async listActivities(): Promise<GemiActivity[]> {
    return this.getMetadata("/metadata/activities", GemiActivitySchema);
  }

  /** Reference list of νομοί (prefectures). */
  async listPrefectures(): Promise<GemiPrefecture[]> {
    return this.getMetadata("/metadata/prefectures", GemiPrefectureSchema);
  }

  /** Reference list of δήμοι (municipalities), each linked to a prefectureId. */
  async listMunicipalities(): Promise<GemiMunicipality[]> {
    return this.getMetadata("/metadata/municipalities", GemiMunicipalitySchema);
  }

  /** Reference list of business status codes (e.g. active, dissolved). */
  async listCompanyStatuses(): Promise<GemiCompanyStatus[]> {
    return this.getMetadata(
      "/metadata/companyStatuses",
      GemiCompanyStatusSchema,
    );
  }

  /** Reference list of legal form codes (ΑΕ, ΕΠΕ, ΙΚΕ, ...). */
  async listLegalTypes(): Promise<GemiLegalType[]> {
    return this.getMetadata("/metadata/legalTypes", GemiLegalTypeSchema);
  }

  /** Reference list of local ΓΕΜΗ registry offices. */
  async listGemiOffices(): Promise<GemiOffice[]> {
    return this.getMetadata("/metadata/gemiOffices", GemiOfficeSchema);
  }

  /** Reference list of assembly/decision subject codes. */
  async listAssemblySubjects(): Promise<GemiAssemblySubject[]> {
    return this.getMetadata(
      "/metadata/assemblySubjects",
      GemiAssemblySubjectSchema,
    );
  }
}
