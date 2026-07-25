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
 * that URL was found). Not live-verified end-to-end from this environment
 * (see CLAUDE.md network caveat) — the spec is authoritative for shape, but
 * an actual response has not been observed.
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
        "No GEMI API key configured. Register for a free key at " +
          "opendata.businessportal.gr/register and set GEMI_API_KEY " +
          "(the Swagger docs page also lists a limited test key, api-docs-key).",
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
    return this.getMetadata(
      "/metadata/municipalities",
      GemiMunicipalitySchema,
    );
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
