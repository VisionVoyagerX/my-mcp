import { buildQuery, fetchText } from "../http.js";

/**
 * Confirmed via AADE's official myDATA API documentation PDFs and the
 * mydata-prod-apim/mydata-dev developer portals: RequestDocs is a GET
 * endpoint authenticated with the `aade-user-id` + `Ocp-Apim-Subscription-Key`
 * headers, returning an XML document (myDATA's invoices are XSD-schema
 * based, not JSON) describing the matched e-invoices. Not live-verified
 * from this environment.
 *
 * This is a bring-your-own-credential service per CLAUDE.md: myDATA
 * subscription keys are tied to an individual business's Taxisnet
 * registration, so this client never reads credentials from the
 * environment — every call takes them as explicit parameters.
 */
const DEFAULT_BASE_URL = "https://mydatapi.aade.gr/myDATA";

export interface MyDataCredentials {
  /** The AADE-issued user id for the subscribed business/software house. */
  userId: string;
  /** The Ocp-Apim-Subscription-Key issued alongside the user id. */
  subscriptionKey: string;
}

export interface MyDataRequestDocsParams {
  /** Only invoices with a mark (unique id) greater than this value. */
  mark?: string;
  /** Start of the issue-date range, format YYYY-MM-DD. */
  dateFrom?: string;
  /** End of the issue-date range, format YYYY-MM-DD. */
  dateTo?: string;
  /** Restrict to invoices issued by this ΑΦΜ. */
  entityVatNumber?: string;
  /** Restrict to invoices involving this counterparty ΑΦΜ. */
  counterVatNumber?: string;
  /** AADE invoice-type code, e.g. "1.1" for a sales invoice. */
  invType?: string;
}

export class MyDataClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? process.env.MYDATA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  /**
   * Fetch the raw XML of invoices matching the given filters. Returned
   * as-is (not parsed into structured fields) — myDATA's invoice XSD is
   * large and this v1 client doesn't model it; treat the result as a
   * document to read or hand to a downstream XML tool.
   */
  async requestDocs(
    credentials: MyDataCredentials,
    params: MyDataRequestDocsParams = {},
  ): Promise<string> {
    const qs = buildQuery({
      mark: params.mark ?? "0",
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      entityVatNumber: params.entityVatNumber,
      counterVatNumber: params.counterVatNumber,
      invType: params.invType,
    });
    return fetchText(`${this.baseUrl}/RequestDocs${qs}`, {
      headers: {
        "aade-user-id": credentials.userId,
        "Ocp-Apim-Subscription-Key": credentials.subscriptionKey,
      },
    });
  }
}
