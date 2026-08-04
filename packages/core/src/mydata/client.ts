import { buildQuery, fetchText } from "../http.js";
import {
  buildXml,
  parseMyDataResponseOrThrow,
  type MyDataResponse,
} from "./xml.js";
import type {
  MyDataClassificationInput,
  MyDataExpensesClassificationDetail,
  MyDataExpensesClassificationInput,
  MyDataIncomeClassificationDetail,
  MyDataInvoiceInput,
  MyDataParty,
  MyDataPaymentMethodInput,
} from "./types.js";

/**
 * Confirmed via AADE's official myDATA REST API documentation (v2.0.1,
 * March 2026, "myDATA API Documentation v2.0.1_official_erp.pdf"): base
 * URLs, required headers, and the full 11-endpoint ERP-user surface.
 *
 * Endpoint existence and routing live-verified 2026-07-25 from an
 * unrestricted network (unauthenticated, no real subscription key
 * available — sandbox credentials still require a human to register via
 * Taxisnet at https://mydata-dev-register.azurewebsites.net first):
 * - All 11 paths below exist under `https://mydatapi.aade.gr/myDATA/*` in
 *   production — GET endpoints return 401 ("missing subscription key"),
 *   POST endpoints return 411 ("length required") for a bodyless POST,
 *   both confirming the route exists and requires exactly the method this
 *   client uses, not a 404.
 * - The dev sandbox at `https://mydataapidev.aade.gr` is live and correctly
 *   reachable, but — confirmed against the official PDF's worked dev-URL
 *   examples too — does NOT use the `/myDATA` path prefix. Set
 *   `MYDATA_BASE_URL=https://mydataapidev.aade.gr` (no `/myDATA` suffix) to
 *   target it; this client's `${baseUrl}/${endpoint}` construction handles
 *   both forms correctly already.
 * - Sending a bogus/invalid subscription key produces HTTP 403 with an
 *   empty body (vs. 401 with none at all) — confirming this client's
 *   header wiring (`aade-user-id` / `Ocp-Apim-Subscription-Key`) reaches
 *   the real APIM gateway correctly for both GET and POST calls.
 * - The gateway authenticates before validating query parameters or body
 *   content, so no unauthenticated check can confirm parameter *names* —
 *   see `counterVatNumber` below for the one still-open case.
 */
const DEFAULT_BASE_URL = "https://mydatapi.aade.gr/myDATA";

/** Namespaces confirmed against the vendored v1.0.10 XSDs (`./__xsd__/`) and live sandbox testing 2026-07-24. */
const INV_NS = "http://www.aade.gr/myDATA/invoice/v1.0";
const ICLS_NS = "https://www.aade.gr/myDATA/incomeClassificaton/v1.0";
const ECLS_NS = "https://www.aade.gr/myDATA/expensesClassificaton/v1.0";
const PMT_NS = "https://www.aade.gr/myDATA/paymentMethod/v1.0";

export interface MyDataCredentials {
  /** The AADE-issued user id for the subscribed business/software house. */
  userId: string;
  /** The Ocp-Apim-Subscription-Key issued alongside the user id. */
  subscriptionKey: string;
}

/** Shared query shape for `RequestDocs` and `RequestTransmittedDocs`. */
export interface MyDataDocsQueryParams {
  /** Only invoices with a mark (unique id) greater than this value. */
  mark?: string;
  /** Start of the issue-date range, format YYYY-MM-DD. */
  dateFrom?: string;
  /** End of the issue-date range, format YYYY-MM-DD. */
  dateTo?: string;
  /** Restrict to invoices issued by this ΑΦΜ. */
  entityVatNumber?: string;
  /**
   * Restrict to invoices involving this counterparty ΑΦΜ. Confirmed 2026-07-25
   * against the official v1.0.6/v2.0.1 PDFs: this table/URL mismatch is real
   * and present in both doc versions, specific to `RequestDocs` and
   * `RequestTransmittedDocs` only — the worked URL examples embed
   * `[&counterVatNumber]`, but the parameter table two lines below (and
   * note 5 beneath it) both call it `receiverVatNumber`. No unauthenticated
   * live request can settle which name the backend actually reads (the
   * APIM gateway 401s on the missing subscription key before parameters are
   * evaluated), so `getDocs` below sends the value under BOTH query keys —
   * cheap, harmless if one is ignored, and correct either way. (This
   * ambiguity does not affect `RequestMyIncome`/`RequestMyExpenses`, whose
   * table and URL examples agree on `counterVatNumber` — see
   * `MyDataIncomeExpenseQueryParams` below.)
   */
  counterVatNumber?: string;
  /** AADE invoice-type code, e.g. "1.1" for a sales invoice. */
  invType?: string;
  /** Only invoices with a mark less than or equal to this value. */
  maxMark?: string;
  /** Pagination cursor from a previous response. */
  nextPartitionKey?: string;
  /** Pagination cursor from a previous response. */
  nextRowKey?: string;
}

/** Shared query shape for `RequestMyIncome` and `RequestMyExpenses`. */
export interface MyDataIncomeExpenseQueryParams {
  /**
   * Start of the date range. Required. Format dd/MM/yyyy — confirmed live
   * 2026-07-24 against the dev sandbox (AADE returned HTTP 400 "Please pass
   * dateFrom in dd/MM/yyyy format" for a YYYY-MM-DD value), contradicting
   * this endpoint's official documentation, which implied YYYY-MM-DD like
   * `RequestDocs`.
   */
  dateFrom: string;
  /** End of the date range, format dd/MM/yyyy (see `dateFrom`). Required. */
  dateTo: string;
  counterVatNumber?: string;
  entityVatNumber?: string;
  invType?: string;
  nextPartitionKey?: string;
  nextRowKey?: string;
}

/** Shared query shape for `RequestVatInfo` and `RequestE3Info`. */
export interface MyDataVatE3QueryParams {
  entityVatNumber?: string;
  /**
   * Start of the date range. Unlike every other endpoint (YYYY-MM-DD), this
   * pair uses format dd/MM/yyyy per the official PDF — a documented
   * inconsistency in AADE's own API, not a bug here.
   */
  dateFrom: string;
  /** End of the date range, format dd/MM/yyyy. */
  dateTo: string;
  /** When true, results are grouped per day. `nextPartitionKey`/`nextRowKey` are ignored when false. */
  groupedPerDay?: boolean;
  nextPartitionKey?: string;
  nextRowKey?: string;
}

export interface MyDataCancelInvoiceParams {
  /** The `mark` of the invoice to cancel. */
  mark: string;
  /** Third-party callers only. */
  entityVatNumber?: string;
}

function partyXml(party: MyDataParty): Record<string, unknown> {
  return {
    vatNumber: party.vatNumber,
    country: party.country ?? "GR",
    branch: party.branch ?? 0,
  };
}

/**
 * Per-line `incomeClassification` (required live for several invoice types,
 * e.g. retail receipts — confirmed 2026-07-24) inherits the default `inv`
 * namespace for its own tag, but its CHILDREN belong to `icls:` per the
 * XSD's `icls:IncomeClassificationType`, matching the reference
 * implementation's proven serialization (only content inside
 * `<incomeClassification>` gets prefixed, not the wrapper tag itself).
 */
function embeddedIncomeClassificationXml(
  detail: MyDataIncomeClassificationDetail,
): Record<string, unknown> {
  return {
    ...(detail.classificationType
      ? { "icls:classificationType": detail.classificationType }
      : {}),
    "icls:classificationCategory": detail.classificationCategory,
    "icls:amount": detail.amount.toFixed(2),
    ...(detail.id !== undefined ? { "icls:id": detail.id } : {}),
  };
}

/**
 * Namespace confirmed against the real `InvoicesDoc-v1.0.10.xsd` (vendored
 * under `./__xsd__/`, live-verified against AADE's dev sandbox 2026-07-24):
 * it's `http://` not `https://` — a real bug caught only by testing against
 * the live sandbox, which rejected the `https://` guess with `XMLSyntaxError`
 * on every single element. `InvoicesDoc`'s own elements use this as an
 * unqualified default namespace (no prefix), matching the reference
 * implementation's proven-working serialization.
 */
function buildInvoicesDocXml(invoices: MyDataInvoiceInput[]): string {
  return buildXml("InvoicesDoc", {
    "@_xmlns": INV_NS,
    "@_xmlns:icls": ICLS_NS,
    invoice: invoices.map((inv) => ({
      issuer: partyXml(inv.issuer),
      ...(inv.counterpart ? { counterpart: partyXml(inv.counterpart) } : {}),
      invoiceHeader: {
        series: inv.series,
        aa: inv.aa,
        issueDate: inv.issueDate,
        invoiceType: inv.invoiceType,
        currency: inv.currency,
      },
      ...(inv.paymentMethods && inv.paymentMethods.length > 0
        ? {
            paymentMethods: {
              paymentMethodDetails: inv.paymentMethods.map((detail) => ({
                type: detail.type,
                amount: detail.amount.toFixed(2),
                ...(detail.paymentMethodInfo
                  ? { paymentMethodInfo: detail.paymentMethodInfo }
                  : {}),
                ...(detail.tipAmount !== undefined
                  ? { tipAmount: detail.tipAmount.toFixed(2) }
                  : {}),
              })),
            },
          }
        : {}),
      invoiceDetails: inv.lines.map((line) => ({
        lineNumber: line.lineNumber,
        netValue: line.netValue.toFixed(2),
        vatCategory: line.vatCategory,
        vatAmount: line.vatAmount.toFixed(2),
        ...(line.vatExemptionCategory
          ? { vatExemptionCategory: line.vatExemptionCategory }
          : {}),
        ...(line.incomeClassifications && line.incomeClassifications.length > 0
          ? {
              incomeClassification: line.incomeClassifications.map(
                embeddedIncomeClassificationXml,
              ),
            }
          : {}),
      })),
      invoiceSummary: {
        totalNetValue: inv.summary.totalNetValue.toFixed(2),
        totalVatAmount: inv.summary.totalVatAmount.toFixed(2),
        totalWithheldAmount: (inv.summary.totalWithheldAmount ?? 0).toFixed(2),
        totalFeesAmount: (inv.summary.totalFeesAmount ?? 0).toFixed(2),
        totalStampDutyAmount: (inv.summary.totalStampDutyAmount ?? 0).toFixed(
          2,
        ),
        totalOtherTaxesAmount: (inv.summary.totalOtherTaxesAmount ?? 0).toFixed(
          2,
        ),
        totalDeductionsAmount: (inv.summary.totalDeductionsAmount ?? 0).toFixed(
          2,
        ),
        totalGrossValue: inv.summary.totalGrossValue.toFixed(2),
        ...(inv.summary.incomeClassifications &&
        inv.summary.incomeClassifications.length > 0
          ? {
              incomeClassification: inv.summary.incomeClassifications.map(
                embeddedIncomeClassificationXml,
              ),
            }
          : {}),
      },
    })),
  });
}

/**
 * Confirmed against the real `IncomeClassificationsDoc-v1.0.10.xsd` /
 * `ExpensesClassificationsDoc-v1.0.10.xsd` (vendored under `./__xsd__/`) via
 * the reference `yiannis-spyridakis/mydata-client` implementation's proven
 * XML serialization: unlike `InvoicesDoc`, these two docs namespace-qualify
 * EVERY element with a prefix (`icls:`/`ecls:`), not just a default `xmlns`
 * on the root — a plain default-namespace attempt is exactly what produced
 * the "could not find schema information" `XMLSyntaxError` we hit live
 * against the sandbox on 2026-07-24 before this fix.
 */
function incomeDetailXml(
  detail: MyDataIncomeClassificationDetail,
): Record<string, unknown> {
  return {
    ...(detail.classificationType
      ? { "icls:classificationType": detail.classificationType }
      : {}),
    "icls:classificationCategory": detail.classificationCategory,
    "icls:amount": detail.amount.toFixed(2),
    ...(detail.id !== undefined ? { "icls:id": detail.id } : {}),
  };
}

function buildIncomeClassificationXml(
  input: MyDataClassificationInput,
): string {
  return buildXml("icls:IncomeClassificationsDoc", {
    "@_xmlns:icls": ICLS_NS,
    "icls:incomeInvoiceClassification": {
      "icls:invoiceMark": input.invoiceMark,
      ...(input.entityVatNumber
        ? { "icls:entityVatNumber": input.entityVatNumber }
        : {}),
      ...(input.transactionMode !== undefined
        ? { "icls:transactionMode": input.transactionMode }
        : {
            "icls:invoicesIncomeClassificationDetails": (input.lines ?? []).map(
              (line) => ({
                "icls:lineNumber": line.lineNumber,
                "icls:incomeClassificationDetailData":
                  line.details.map(incomeDetailXml),
              }),
            ),
          }),
    },
  });
}

function expensesDetailXml(
  detail: MyDataExpensesClassificationDetail,
): Record<string, unknown> {
  return {
    ...(detail.classificationType
      ? { "ecls:classificationType": detail.classificationType }
      : {}),
    ...(detail.classificationCategory
      ? { "ecls:classificationCategory": detail.classificationCategory }
      : {}),
    "ecls:amount": detail.amount.toFixed(2),
    ...(detail.vatAmount !== undefined
      ? { "ecls:vatAmount": detail.vatAmount.toFixed(2) }
      : {}),
    ...(detail.vatCategory ? { "ecls:vatCategory": detail.vatCategory } : {}),
    ...(detail.vatExemptionCategory
      ? { "ecls:vatExemptionCategory": detail.vatExemptionCategory }
      : {}),
    ...(detail.id !== undefined ? { "ecls:id": detail.id } : {}),
  };
}

function buildExpensesClassificationXml(
  input: MyDataExpensesClassificationInput,
): string {
  return buildXml("ecls:ExpensesClassificationsDoc", {
    "@_xmlns:ecls": ECLS_NS,
    "ecls:expensesInvoiceClassification": {
      "ecls:invoiceMark": input.invoiceMark,
      ...(input.entityVatNumber
        ? { "ecls:entityVatNumber": input.entityVatNumber }
        : {}),
      ...(input.transactionMode !== undefined
        ? { "ecls:transactionMode": input.transactionMode }
        : {
            "ecls:invoicesExpensesClassificationDetails": (
              input.lines ?? []
            ).map((line) => ({
              "ecls:lineNumber": line.lineNumber,
              "ecls:expensesClassificationDetailData":
                line.details.map(expensesDetailXml),
            })),
          }),
      ...(input.classificationPostMode !== undefined
        ? { "ecls:classificationPostMode": input.classificationPostMode }
        : {}),
    },
  });
}

/**
 * Confirmed against the real `paymentMethods-v1.0.10.xsd`: the doc's own
 * elements are qualified with a `pmt:` prefix, but `paymentMethodDetails`
 * (and its children `type`/`amount`/`paymentMethodInfo`/`tipAmount`) reuse
 * `inv:PaymentMethodDetailType` from the invoice namespace, so those get the
 * `inv:` prefix instead — both namespaces need declaring on the root.
 */
function buildPaymentMethodXml(input: MyDataPaymentMethodInput): string {
  return buildXml("pmt:PaymentMethodsDoc", {
    "@_xmlns:pmt": PMT_NS,
    "@_xmlns:inv": INV_NS,
    "pmt:paymentMethods": {
      "pmt:invoiceMark": input.invoiceMark,
      "pmt:paymentMethodDetails": input.paymentMethods.map((detail) => ({
        "inv:type": detail.type,
        "inv:amount": detail.amount.toFixed(2),
        ...(detail.paymentMethodInfo
          ? { "inv:paymentMethodInfo": detail.paymentMethodInfo }
          : {}),
        ...(detail.tipAmount !== undefined
          ? { "inv:tipAmount": detail.tipAmount.toFixed(2) }
          : {}),
      })),
    },
  });
}

export class MyDataClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.MYDATA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private headers(credentials: MyDataCredentials): Record<string, string> {
    return {
      "aade-user-id": credentials.userId,
      "Ocp-Apim-Subscription-Key": credentials.subscriptionKey,
    };
  }

  // ---- Retrieval (GET) endpoints — return raw XML text, unparsed. ----

  /** Retrieve invoices/classifications/cancellations other users submitted that involve you. */
  async requestDocs(
    credentials: MyDataCredentials,
    params: MyDataDocsQueryParams = {},
  ): Promise<string> {
    return this.getDocs("RequestDocs", credentials, params);
  }

  /** Retrieve invoices/classifications/cancellations you submitted. */
  async requestTransmittedDocs(
    credentials: MyDataCredentials,
    params: MyDataDocsQueryParams = {},
  ): Promise<string> {
    return this.getDocs("RequestTransmittedDocs", credentials, params);
  }

  private async getDocs(
    endpoint: "RequestDocs" | "RequestTransmittedDocs",
    credentials: MyDataCredentials,
    params: MyDataDocsQueryParams,
  ): Promise<string> {
    const qs = buildQuery({
      mark: params.mark ?? "0",
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      entityVatNumber: params.entityVatNumber,
      // Sent under both names — see the doc comment on `counterVatNumber`
      // in `MyDataDocsQueryParams` for why.
      counterVatNumber: params.counterVatNumber,
      receiverVatNumber: params.counterVatNumber,
      invType: params.invType,
      maxMark: params.maxMark,
      nextPartitionKey: params.nextPartitionKey,
      nextRowKey: params.nextRowKey,
    });
    return fetchText(`${this.baseUrl}/${endpoint}${qs}`, {
      headers: this.headers(credentials),
    });
  }

  /** Aggregated income info for a date range. */
  async requestMyIncome(
    credentials: MyDataCredentials,
    params: MyDataIncomeExpenseQueryParams,
  ): Promise<string> {
    return this.getIncomeExpense("RequestMyIncome", credentials, params);
  }

  /** Aggregated expense info for a date range. */
  async requestMyExpenses(
    credentials: MyDataCredentials,
    params: MyDataIncomeExpenseQueryParams,
  ): Promise<string> {
    return this.getIncomeExpense("RequestMyExpenses", credentials, params);
  }

  private async getIncomeExpense(
    endpoint: "RequestMyIncome" | "RequestMyExpenses",
    credentials: MyDataCredentials,
    params: MyDataIncomeExpenseQueryParams,
  ): Promise<string> {
    const qs = buildQuery({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      counterVatNumber: params.counterVatNumber,
      entityVatNumber: params.entityVatNumber,
      invType: params.invType,
      nextPartitionKey: params.nextPartitionKey,
      nextRowKey: params.nextRowKey,
    });
    return fetchText(`${this.baseUrl}/${endpoint}${qs}`, {
      headers: this.headers(credentials),
    });
  }

  /** VAT in/out details for a date range, optionally grouped per day. */
  async requestVatInfo(
    credentials: MyDataCredentials,
    params: MyDataVatE3QueryParams,
  ): Promise<string> {
    return this.getVatOrE3("RequestVatInfo", credentials, params);
  }

  /** E3 (business activity tax form) details for a date range. */
  async requestE3Info(
    credentials: MyDataCredentials,
    params: MyDataVatE3QueryParams,
  ): Promise<string> {
    return this.getVatOrE3("RequestE3Info", credentials, params);
  }

  private async getVatOrE3(
    endpoint: "RequestVatInfo" | "RequestE3Info",
    credentials: MyDataCredentials,
    params: MyDataVatE3QueryParams,
  ): Promise<string> {
    const qs = buildQuery({
      entityVatNumber: params.entityVatNumber,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      GroupedPerDay: params.groupedPerDay,
      nextPartitionKey: params.nextPartitionKey,
      nextRowKey: params.nextRowKey,
    });
    return fetchText(`${this.baseUrl}/${endpoint}${qs}`, {
      headers: this.headers(credentials),
    });
  }

  // ---- Submission (POST) endpoints — parsed via parseMyDataResponseOrThrow. ----

  /** Submit one or more invoices (including corrected/amending types). */
  async sendInvoices(
    credentials: MyDataCredentials,
    invoices: MyDataInvoiceInput[],
  ): Promise<MyDataResponse> {
    const responseXml = await fetchText(`${this.baseUrl}/SendInvoices`, {
      method: "POST",
      headers: {
        ...this.headers(credentials),
        "Content-Type": "application/xml",
      },
      body: buildInvoicesDocXml(invoices),
    });
    return parseMyDataResponseOrThrow(responseXml);
  }

  /** Submit income classification(s) against an already-submitted invoice. */
  async sendIncomeClassification(
    credentials: MyDataCredentials,
    input: MyDataClassificationInput,
  ): Promise<MyDataResponse> {
    const responseXml = await fetchText(
      `${this.baseUrl}/SendIncomeClassification`,
      {
        method: "POST",
        headers: {
          ...this.headers(credentials),
          "Content-Type": "application/xml",
        },
        body: buildIncomeClassificationXml(input),
      },
    );
    return parseMyDataResponseOrThrow(responseXml);
  }

  /** Submit expense classification(s) against an already-submitted invoice. */
  async sendExpensesClassification(
    credentials: MyDataCredentials,
    input: MyDataExpensesClassificationInput,
  ): Promise<MyDataResponse> {
    const responseXml = await fetchText(
      `${this.baseUrl}/SendExpensesClassification`,
      {
        method: "POST",
        headers: {
          ...this.headers(credentials),
          "Content-Type": "application/xml",
        },
        body: buildExpensesClassificationXml(input),
      },
    );
    return parseMyDataResponseOrThrow(responseXml);
  }

  /** Submit payment method(s) for an invoice. */
  async sendPaymentsMethod(
    credentials: MyDataCredentials,
    input: MyDataPaymentMethodInput,
  ): Promise<MyDataResponse> {
    const responseXml = await fetchText(`${this.baseUrl}/SendPaymentsMethod`, {
      method: "POST",
      headers: {
        ...this.headers(credentials),
        "Content-Type": "application/xml",
      },
      body: buildPaymentMethodXml(input),
    });
    return parseMyDataResponseOrThrow(responseXml);
  }

  /** Cancel a previously submitted invoice, no re-submission. Query params only, no body. */
  async cancelInvoice(
    credentials: MyDataCredentials,
    params: MyDataCancelInvoiceParams,
  ): Promise<MyDataResponse> {
    const qs = buildQuery({
      mark: params.mark,
      entityVatNumber: params.entityVatNumber,
    });
    const responseXml = await fetchText(`${this.baseUrl}/CancelInvoice${qs}`, {
      method: "POST",
      headers: this.headers(credentials),
    });
    return parseMyDataResponseOrThrow(responseXml);
  }
}
