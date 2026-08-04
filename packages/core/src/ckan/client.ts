import * as XLSX from "xlsx";
import { buildQuery, fetchBinary, fetchJson, GovApiError } from "../http.js";
import {
  CkanDatasetSchema,
  CkanEnvelopeSchema,
  CkanSearchResultSchema,
  type CkanDataset,
  type CkanSearchResult,
} from "./types.js";

/** Resources over this size aren't parsed in-memory in a Worker. */
const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;

/** Data rows (excluding the header) returned per call unless overridden. */
const DEFAULT_ROW_LIMIT = 50;
const MAX_ROW_LIMIT = 500;

export interface CkanResourceDataParams {
  /** Max number of data rows to return, after the header row. Defaults to 50, capped at 500. */
  limit?: number;
  /** Row offset (0-based, after the header row). Defaults to 0. */
  offset?: number;
  /** Sheet name to read, for multi-sheet workbooks. Defaults to the first sheet. */
  sheet?: string;
}

export interface CkanResourceData {
  sheetNames: string[];
  sheet: string;
  columns: string[];
  rows: unknown[][];
  /** Total data rows in the sheet, independent of `limit`/`offset`. */
  totalRows: number;
}

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
    this.baseUrl =
      options.baseUrl ?? process.env.DATA_GOV_GR_BASE_URL ?? DEFAULT_BASE_URL;
    this.token = options.token ?? process.env.DATA_GOV_GR_TOKEN;
  }

  private headers(): Record<string, string> | undefined {
    return this.token ? { Authorization: `Token ${this.token}` } : undefined;
  }

  /** Search the data.gov.gr open-data catalog for datasets. */
  async searchDatasets(
    params: CkanSearchParams = {},
  ): Promise<CkanSearchResult> {
    const qs = buildQuery({
      q: params.query ?? "",
      rows: params.rows ?? 10,
      start: params.start ?? 0,
    });
    const raw = await fetchJson<unknown>(
      `${this.baseUrl}/package_search${qs}`,
      {
        headers: this.headers(),
      },
    );
    const envelope = CkanEnvelopeSchema(CkanSearchResultSchema).parse(raw);
    if (!envelope.success || envelope.result === undefined) {
      throw new GovApiError(
        envelope.error?.message ??
          "data.gov.gr package_search reported failure",
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

  /**
   * Downloads a dataset resource (from the `url` on a `CkanResource`, e.g.
   * a CSV/XLS/XLSX file) and parses it into rows so callers can analyze
   * tabular data without needing their own spreadsheet tooling.
   *
   * Deliberately doesn't send the CKAN API token: resource URLs can point
   * to any host the dataset publisher chose (mirrors, external file
   * stores), not just this client's configured CKAN `baseUrl`, so
   * attaching a secret meant for the Action API would leak it to arbitrary
   * third parties.
   */
  async getResourceData(
    url: string,
    params: CkanResourceDataParams = {},
  ): Promise<CkanResourceData> {
    const buffer = await fetchBinary(url);
    if (buffer.byteLength > MAX_RESOURCE_BYTES) {
      throw new GovApiError(
        `Resource is ${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB, over the ` +
          `${MAX_RESOURCE_BYTES / (1024 * 1024)}MB limit this tool can parse in-memory.`,
        { url },
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    } catch (cause) {
      throw new GovApiError(
        "Failed to parse resource as a spreadsheet (expected CSV, XLS, or XLSX)",
        { url, cause },
      );
    }

    const sheetNames = workbook.SheetNames;
    const sheetName = params.sheet ?? sheetNames[0];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheetName || !worksheet) {
      throw new GovApiError(
        `Sheet "${params.sheet ?? ""}" not found. Available sheets: ${sheetNames.join(", ") || "none"}`,
        { url },
      );
    }

    const allRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: null,
    });
    const [header, ...dataRows] = allRows;
    const columns = (header ?? []).map((cell) =>
      cell === null || cell === undefined ? "" : String(cell),
    );

    const offset = Math.max(params.offset ?? 0, 0);
    const limit = Math.min(params.limit ?? DEFAULT_ROW_LIMIT, MAX_ROW_LIMIT);

    return {
      sheetNames,
      sheet: sheetName,
      columns,
      rows: dataRows.slice(offset, offset + limit),
      totalRows: dataRows.length,
    };
  }
}
