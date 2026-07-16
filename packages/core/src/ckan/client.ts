import { buildQuery, fetchJson, GovApiError } from "../http.js";
import {
  CkanDatasetSchema,
  CkanEnvelopeSchema,
  CkanSearchResultSchema,
  type CkanDataset,
  type CkanSearchResult,
} from "./types.js";

/**
 * data.gov.gr's CKAN Action API base, confirmed via the official token page
 * and a Greek tutorial documenting the `Authorization: Token <id>` header
 * format (see RESEARCH.md). Not live-verified from this environment.
 */
const DEFAULT_BASE_URL = "https://data.gov.gr/api/3/action";

export interface CkanSearchParams {
  /** Free-text query, e.g. "budget" or "education". */
  query?: string;
  /** Number of results to return. Defaults to 10. */
  rows?: number;
  /** Offset for pagination. Defaults to 0. */
  start?: number;
}

export class CkanClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(options: { baseUrl?: string; token?: string } = {}) {
    this.baseUrl = options.baseUrl ?? process.env.DATA_GOV_GR_BASE_URL ?? DEFAULT_BASE_URL;
    this.token = options.token ?? process.env.DATA_GOV_GR_TOKEN;
  }

  private headers(): Record<string, string> | undefined {
    return this.token ? { Authorization: `Token ${this.token}` } : undefined;
  }

  /** Search the data.gov.gr open-data catalog for datasets. */
  async searchDatasets(params: CkanSearchParams = {}): Promise<CkanSearchResult> {
    const qs = buildQuery({
      q: params.query ?? "",
      rows: params.rows ?? 10,
      start: params.start ?? 0,
    });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/package_search${qs}`, {
      headers: this.headers(),
    });
    const envelope = CkanEnvelopeSchema(CkanSearchResultSchema).parse(raw);
    if (!envelope.success || envelope.result === undefined) {
      throw new GovApiError(
        envelope.error?.message ?? "data.gov.gr package_search reported failure",
        { url: `${this.baseUrl}/package_search` },
      );
    }
    return envelope.result;
  }

  /** Fetch full metadata for a single dataset by its CKAN id or name/slug. */
  async getDataset(idOrName: string): Promise<CkanDataset> {
    const qs = buildQuery({ id: idOrName });
    const raw = await fetchJson<unknown>(`${this.baseUrl}/package_show${qs}`, {
      headers: this.headers(),
    });
    const envelope = CkanEnvelopeSchema(CkanDatasetSchema).parse(raw);
    if (!envelope.success || envelope.result === undefined) {
      throw new GovApiError(
        envelope.error?.message ?? "data.gov.gr package_show reported failure",
        { url: `${this.baseUrl}/package_show` },
      );
    }
    return envelope.result;
  }
}
