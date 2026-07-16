import { z } from "zod";
import { buildQuery, fetchJson, GovApiError } from "../http.js";
import { GemiCompanySchema, type GemiCompany } from "./types.js";

/**
 * Confirmed against github.com/firebed/vat-registry (maintained open-source
 * client): base URL, `/companies` and `/companies/{registrationNumber}`
 * paths, and the `api_key` header. Not live-verified from this environment.
 */
const DEFAULT_BASE_URL = "https://opendata-api.businessportal.gr/api/opendata/v1";

export class GemiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = options.baseUrl ?? process.env.GEMI_BASE_URL ?? DEFAULT_BASE_URL;
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

  /** Search companies by tax identification number (ΑΦΜ). */
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
    return z.array(GemiCompanySchema).parse(raw);
  }

  /** Fetch a single company by its ΓΕΜΗ registration number. */
  async getCompany(registrationNumber: string): Promise<GemiCompany> {
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/companies/${encodeURIComponent(registrationNumber)}`,
      { headers: this.headers() },
    );
    return GemiCompanySchema.parse(raw);
  }
}
