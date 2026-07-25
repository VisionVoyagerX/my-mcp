import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { GovApiError } from "../http.js";

/**
 * myDATA's `ResponseDoc` envelope (v2.0.1 PDF §6.1): every submission endpoint
 * (`SendInvoices`, `SendIncomeClassification`, `SendExpensesClassification`,
 * `SendPaymentsMethod`, `CancelInvoice`) returns **HTTP 200 even when the
 * submission itself failed** — success/failure only shows up in this body.
 * Not live-verified from this environment; shape taken from the official PDF
 * and cross-checked against the `yiannis-spyridakis/mydata-client` and
 * `firebed/aade-mydata` reference implementations.
 */
export interface MyDataResponseEntry {
  index?: number;
  invoiceUid?: string;
  invoiceMark?: string;
  classificationMark?: string;
  paymentMethodMark?: string;
  cancellationMark?: string;
  qrUrl?: string;
  statusCode: string;
  errors: Array<{ code?: string; message: string }>;
}

export interface MyDataResponse {
  entries: MyDataResponseEntry[];
}

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "response" || name === "error",
});

/** Parses a myDATA `ResponseDoc` XML body into a normalized, always-array shape. */
export function parseMyDataResponse(xml: string): MyDataResponse {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (cause) {
    throw new GovApiError("myDATA response was not valid XML", {
      url: "",
      body: xml.slice(0, 2000),
      cause,
    });
  }

  const root = (parsed as Record<string, unknown>)?.ResponseDoc as
    Record<string, unknown> | undefined;
  const rawResponses = (root?.response ?? []) as Array<Record<string, unknown>>;

  const entries: MyDataResponseEntry[] = rawResponses.map((entry) => {
    const rawErrors = (entry.errors as Record<string, unknown> | undefined)
      ?.error as Array<Record<string, unknown>> | undefined;
    return {
      index: entry.index !== undefined ? Number(entry.index) : undefined,
      invoiceUid: asString(entry.invoiceUid),
      invoiceMark: asString(entry.invoiceMark),
      classificationMark: asString(entry.classificationMark),
      paymentMethodMark: asString(entry.paymentMethodMark),
      cancellationMark: asString(entry.cancellationMark),
      qrUrl: asString(entry.qrUrl),
      statusCode: asString(entry.statusCode) ?? "Unknown",
      errors: (rawErrors ?? []).map((error) => ({
        code: asString(error.code),
        message: asString(error.message) ?? "",
      })),
    };
  });

  return { entries };
}

function asString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

/**
 * A myDATA submission (`Send*`/`CancelInvoice`) responded 200 OK, but at
 * least one `response` entry's `statusCode` was not `Success` — the HTTP
 * layer alone (`GovApiError`) can't catch this, see `parseMyDataResponse`.
 */
export class MyDataApiError extends Error {
  readonly entries: MyDataResponseEntry[];

  constructor(message: string, entries: MyDataResponseEntry[]) {
    super(message);
    this.name = "MyDataApiError";
    this.entries = entries;
  }
}

/**
 * Parses a submission-endpoint response and throws `MyDataApiError` if any
 * entry's `statusCode` isn't `Success`, per the "HTTP 200 even on failure"
 * gotcha shared by every `Send*`/`CancelInvoice` endpoint.
 */
export function parseMyDataResponseOrThrow(xml: string): MyDataResponse {
  const response = parseMyDataResponse(xml);
  const failed = response.entries.filter(
    (entry) => entry.statusCode !== "Success",
  );
  if (failed.length > 0) {
    const details = failed
      .map((entry) => {
        const errorText = entry.errors
          .map((e) => `${e.code ? `[${e.code}] ` : ""}${e.message}`)
          .join("; ");
        return `${entry.statusCode}${errorText ? `: ${errorText}` : ""}`;
      })
      .join(" | ");
    throw new MyDataApiError(
      `myDATA rejected the submission: ${details}`,
      response.entries,
    );
  }
  return response;
}

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: true,
  format: false,
});

/**
 * Serializes a plain object into an XML document, prefixed with the
 * `<?xml?>` prolog — matching the reference `mydata-client` implementation's
 * proven-working request shape (AADE's schema validator tolerates omitting
 * it, per live testing, but there's no reason to diverge from what's known
 * to work).
 */
export function buildXml(
  rootTag: string,
  body: Record<string, unknown>,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${builder.build({ [rootTag]: body }) as string}`;
}
