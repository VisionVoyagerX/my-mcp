import { z } from "zod";

/**
 * Input shapes for myDATA's write endpoints (`SendInvoices`,
 * `SendIncomeClassification`, `SendExpensesClassification`,
 * `SendPaymentsMethod`). Structurally verified 2026-07-24 against the real
 * v1.0.10 XSDs vendored under `./__xsd__/` (fetched from the
 * `yiannis-spyridakis/mydata-client` reference implementation, since this
 * environment can't reach aade.gr directly to download AADE's own zip) and
 * confirmed against AADE's live dev sandbox. Deliberately a scoped subset of
 * the full `AadeBookInvoiceType` — the fields that matter for a typical
 * invoice — not a full XSD reproduction. Enum-restricted codes (invoice
 * type, VAT category, etc.) are still accepted as plain strings/numbers
 * rather than closed Zod enums, since the full code lists are large
 * (`./__xsd__/SimpleTypes-v1.0.10.xsd` has the authoritative values if
 * stricter validation is ever wanted).
 */

export const MyDataPartySchema = z.object({
  vatNumber: z.string().min(1).describe("ΑΦΜ (VAT number) of this party."),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO 3166-1 alpha-2 country code, default GR."),
  branch: z
    .number()
    .int()
    .optional()
    .describe("Branch number, default 0 (head office)."),
});
export type MyDataParty = z.infer<typeof MyDataPartySchema>;

/**
 * Confirmed against the real `IncomeClassificationsDoc-v1.0.10.xsd` (vendored
 * under `./__xsd__/incomeClassification-v1.0.10.xsd`, live-verified against
 * AADE's dev sandbox 2026-07-24). Also reused as-is for the embedded
 * per-line `incomeClassification` field on `InvoiceRowType` — same shape.
 */
export const MyDataIncomeClassificationDetailSchema = z.object({
  classificationType: z
    .string()
    .optional()
    .describe("Classification type code (XSD Appendix §8.8)."),
  classificationCategory: z
    .string()
    .min(1)
    .describe("Classification category code (XSD Appendix §8.8)."),
  amount: z.number(),
  id: z
    .number()
    .int()
    .optional()
    .describe("Optional unique id for this classification entry."),
});
export type MyDataIncomeClassificationDetail = z.infer<
  typeof MyDataIncomeClassificationDetailSchema
>;

export const MyDataPaymentMethodDetailSchema = z.object({
  type: z
    .string()
    .min(1)
    .describe(
      "Payment method type code; at least one entry must be the POS type code.",
    ),
  amount: z.number(),
  paymentMethodInfo: z.string().optional(),
  tipAmount: z.number().optional(),
});
export type MyDataPaymentMethodDetail = z.infer<
  typeof MyDataPaymentMethodDetailSchema
>;

/**
 * `incomeClassification` on `InvoiceRowType` is required by several
 * invoice types (confirmed live 2026-07-24: AADE rejected invoiceType
 * "11.1" with "[230] incomeClassification is mandatory for invoice detail 1"
 * until a per-line classification was included) — not just at the
 * invoice-summary level.
 */
export const MyDataInvoiceLineSchema = z.object({
  lineNumber: z.number().int().min(1),
  netValue: z.number().describe("Line net value, before VAT."),
  vatCategory: z
    .string()
    .min(1)
    .describe(
      'AADE VAT category code, e.g. "1" for the standard rate (see XSD Appendix §8.2).',
    ),
  vatAmount: z.number().describe("VAT amount for this line."),
  vatExemptionCategory: z
    .string()
    .optional()
    .describe(
      "Required when vatCategory denotes an exemption (XSD Appendix §8.3).",
    ),
  incomeClassifications: z
    .array(MyDataIncomeClassificationDetailSchema)
    .optional()
    .describe(
      "Required by several invoice types (confirmed live for retail receipts, invoiceType 11.x) — classify this line's income.",
    ),
});
export type MyDataInvoiceLine = z.infer<typeof MyDataInvoiceLineSchema>;

export const MyDataInvoiceSummarySchema = z.object({
  totalNetValue: z.number(),
  totalVatAmount: z.number(),
  totalWithheldAmount: z.number().optional(),
  totalFeesAmount: z.number().optional(),
  totalStampDutyAmount: z.number().optional(),
  totalOtherTaxesAmount: z.number().optional(),
  totalDeductionsAmount: z.number().optional(),
  incomeClassifications: z
    .array(MyDataIncomeClassificationDetailSchema)
    .optional()
    .describe(
      "Confirmed live 2026-07-24: must match the per-line incomeClassification entries when those are present (AADE error 321 otherwise) — this is a summary rollup, not an independent list.",
    ),
  totalGrossValue: z
    .number()
    .describe("Must equal net + VAT + other taxes/fees, minus deductions."),
});
export type MyDataInvoiceSummary = z.infer<typeof MyDataInvoiceSummarySchema>;

export const MyDataInvoiceInputSchema = z.object({
  series: z.string().min(1).describe('Invoice series (e.g. "A").'),
  aa: z.string().min(1).describe("Invoice number within the series."),
  issueDate: z
    .string()
    .describe(
      "Issue date, format YYYY-MM-DD. Must be >= 2020-01-01 and <= today (confirmed live: AADE rejects future-dated invoices).",
    ),
  invoiceType: z
    .string()
    .min(1)
    .describe(
      'AADE invoice-type code, e.g. "1.1" sales invoice, "2.1" service invoice, "5.1" credit invoice, "11.1" retail receipt.',
    ),
  currency: z
    .string()
    .length(3)
    .default("EUR")
    .describe("ISO 4217 currency code."),
  issuer: MyDataPartySchema,
  counterpart: MyDataPartySchema.optional().describe(
    "Omit for retail/simplified receipts with no identified counterparty. Some invoice types (confirmed live for 1.1) require this.",
  ),
  lines: z.array(MyDataInvoiceLineSchema).min(1),
  summary: MyDataInvoiceSummarySchema,
  paymentMethods: z
    .array(MyDataPaymentMethodDetailSchema)
    .optional()
    .describe(
      "Embedded payment method details. Several invoice types require this at submission time (confirmed live for 11.1), separately from the standalone SendPaymentsMethod endpoint.",
    ),
});
export type MyDataInvoiceInput = z.infer<typeof MyDataInvoiceInputSchema>;

export const MyDataIncomeClassificationLineSchema = z.object({
  lineNumber: z
    .number()
    .int()
    .min(1)
    .describe("The invoice line being classified."),
  details: z.array(MyDataIncomeClassificationDetailSchema).min(1),
});
export type MyDataIncomeClassificationLine = z.infer<
  typeof MyDataIncomeClassificationLineSchema
>;

/**
 * The real XSD models this as an `xs:choice`: a classification is EITHER a
 * bare `transactionMode` (reject/deviation, no line detail) OR a set of
 * per-line classification details — never both, never neither. Enforced
 * below via `.refine` since Zod's raw-shape `inputSchema` for MCP tools
 * can't express a discriminated union at the top level.
 */
export const MyDataClassificationInputSchema = z
  .object({
    invoiceMark: z
      .string()
      .min(1)
      .describe(
        "The `mark` of the already-submitted invoice being classified.",
      ),
    entityVatNumber: z
      .string()
      .optional()
      .describe("Required for third-party (e.g. accountant) submissions."),
    transactionMode: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe(
        "1 = Reject the classification, 2 = Deviation. Mutually exclusive with `lines` — provide exactly one.",
      ),
    lines: z
      .array(MyDataIncomeClassificationLineSchema)
      .optional()
      .describe(
        "Per-line classification details. Mutually exclusive with `transactionMode` — provide exactly one.",
      ),
  })
  .refine(
    (v) =>
      (v.transactionMode !== undefined) !==
      (v.lines !== undefined && v.lines.length > 0),
    {
      message:
        "Provide exactly one of transactionMode or lines (the myDATA XSD models these as a choice).",
    },
  );
export type MyDataClassificationInput = z.infer<
  typeof MyDataClassificationInputSchema
>;

/**
 * `ExpensesClassificationType` (confirmed against
 * `./__xsd__/expensesClassification-v1.0.10.xsd`) carries more optional
 * fields than the income side (vatAmount/vatCategory/vatExemptionCategory),
 * and both classificationType AND classificationCategory are optional here
 * (unlike income, where classificationCategory is required).
 */
export const MyDataExpensesClassificationDetailSchema = z.object({
  classificationType: z.string().optional(),
  classificationCategory: z.string().optional(),
  amount: z.number(),
  vatAmount: z.number().optional(),
  vatCategory: z.string().optional(),
  vatExemptionCategory: z.string().optional(),
  id: z.number().int().optional(),
});
export type MyDataExpensesClassificationDetail = z.infer<
  typeof MyDataExpensesClassificationDetailSchema
>;

export const MyDataExpensesClassificationLineSchema = z.object({
  lineNumber: z
    .number()
    .int()
    .min(1)
    .describe("The invoice line being classified."),
  details: z.array(MyDataExpensesClassificationDetailSchema).min(1),
});
export type MyDataExpensesClassificationLine = z.infer<
  typeof MyDataExpensesClassificationLineSchema
>;

export const MyDataExpensesClassificationInputSchema = z
  .object({
    invoiceMark: z
      .string()
      .min(1)
      .describe(
        "The `mark` of the already-submitted invoice being classified.",
      ),
    entityVatNumber: z
      .string()
      .optional()
      .describe("Required for third-party (e.g. accountant) submissions."),
    transactionMode: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .describe(
        "1 = Reject the classification, 2 = Deviation. Mutually exclusive with `lines` — provide exactly one.",
      ),
    lines: z
      .array(MyDataExpensesClassificationLineSchema)
      .optional()
      .describe(
        "Per-line classification details. Mutually exclusive with `transactionMode` — provide exactly one.",
      ),
    classificationPostMode: z
      .union([z.literal(0), z.literal(1)])
      .optional()
      .describe(
        "0 or 1 — submission method for the classification. See AADE's SendExpensesClassificationPostPerInvoiceGuidelines.",
      ),
  })
  .refine(
    (v) =>
      (v.transactionMode !== undefined) !==
      (v.lines !== undefined && v.lines.length > 0),
    {
      message:
        "Provide exactly one of transactionMode or lines (the myDATA XSD models these as a choice).",
    },
  );
export type MyDataExpensesClassificationInput = z.infer<
  typeof MyDataExpensesClassificationInputSchema
>;

export const MyDataPaymentMethodInputSchema = z.object({
  invoiceMark: z
    .string()
    .min(1)
    .describe("The `mark` of the already-submitted invoice being paid."),
  paymentMethods: z
    .array(MyDataPaymentMethodDetailSchema)
    .min(1)
    .describe(
      "The sum of `amount` across entries must equal the invoice's totalGrossValue.",
    ),
});
export type MyDataPaymentMethodInput = z.infer<
  typeof MyDataPaymentMethodInputSchema
>;
