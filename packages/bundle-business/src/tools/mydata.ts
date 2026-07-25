import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MyDataClient,
  toolErrorResult,
  MyDataInvoiceInputSchema,
  MyDataIncomeClassificationLineSchema,
  MyDataExpensesClassificationLineSchema,
  MyDataPaymentMethodDetailSchema,
} from "@my-mcp/core";

export function registerMyDataTools(server: McpServer): void {
  const client = new MyDataClient();

  const sandboxWarning =
    "This affects real tax records — verify you are pointed at the myDATA SANDBOX (MYDATA_BASE_URL=https://mydataapidev.aade.gr) before testing, not production.";
  const credentialNote =
    "This is a bring-your-own-credential tool: myDATA subscription keys belong to an individual business's own Taxisnet " +
    "registration, so the server never holds a shared credential — pass your own userId and subscriptionKey with every call (get them from aade.gr's myDATA registration).";

  server.registerTool(
    "mydata_request_docs",
    {
      title: "Request myDATA invoices received",
      description:
        "Fetch e-invoices (myDATA electronic books) from AADE that other parties submitted to you. " +
        "Filter by date range and/or counterparty ΑΦΜ. Returns the raw XML response. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        mark: z
          .string()
          .optional()
          .describe(
            "Only invoices with a mark (unique id) greater than this value; use for " +
              'incremental sync. Defaults to "0" (fetch from the beginning).',
          ),
        dateFrom: z
          .string()
          .optional()
          .describe("Start of the issue-date range (YYYY-MM-DD)."),
        dateTo: z
          .string()
          .optional()
          .describe("End of the issue-date range (YYYY-MM-DD)."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices issued by this ΑΦΜ."),
        counterVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices involving this counterparty ΑΦΜ."),
        invType: z
          .string()
          .optional()
          .describe(
            'AADE invoice-type code to filter by, e.g. "1.1" for a sales invoice.',
          ),
        maxMark: z
          .string()
          .optional()
          .describe(
            "Only invoices with a mark less than or equal to this value.",
          ),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestDocs(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to fetch myDATA received invoices",
        );
      }
    },
  );

  server.registerTool(
    "mydata_request_transmitted_docs",
    {
      title: "Request myDATA invoices you submitted",
      description:
        "Fetch e-invoices (myDATA electronic books) from AADE that you submitted yourself. " +
        "Filter by date range and/or counterparty ΑΦΜ. Returns the raw XML response. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        mark: z
          .string()
          .optional()
          .describe(
            "Only invoices with a mark (unique id) greater than this value; use for " +
              'incremental sync. Defaults to "0" (fetch from the beginning).',
          ),
        dateFrom: z
          .string()
          .optional()
          .describe("Start of the issue-date range (YYYY-MM-DD)."),
        dateTo: z
          .string()
          .optional()
          .describe("End of the issue-date range (YYYY-MM-DD)."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices issued by this ΑΦΜ."),
        counterVatNumber: z
          .string()
          .optional()
          .describe("Restrict to invoices involving this counterparty ΑΦΜ."),
        invType: z
          .string()
          .optional()
          .describe(
            'AADE invoice-type code to filter by, e.g. "1.1" for a sales invoice.',
          ),
        maxMark: z
          .string()
          .optional()
          .describe(
            "Only invoices with a mark less than or equal to this value.",
          ),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestTransmittedDocs(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to fetch myDATA transmitted invoices",
        );
      }
    },
  );

  server.registerTool(
    "mydata_request_my_income",
    {
      title: "Request myDATA income summary",
      description:
        "Fetch aggregated income information from AADE for a specified date range. " +
        "Returns XML with income totals and classifications by category. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        dateFrom: z
          .string()
          .describe(
            "Start of the date range, format dd/MM/yyyy (confirmed live — despite this endpoint's official docs implying YYYY-MM-DD). Required.",
          ),
        dateTo: z
          .string()
          .describe("End of the date range, format dd/MM/yyyy (see dateFrom). Required."),
        counterVatNumber: z
          .string()
          .optional()
          .describe("Restrict to transactions with this counterparty ΑΦΜ."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to this ΑΦΜ (for third-party submissions)."),
        invType: z
          .string()
          .optional()
          .describe("AADE invoice-type code to filter by."),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestMyIncome(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(error, "Failed to fetch myDATA income summary");
      }
    },
  );

  server.registerTool(
    "mydata_request_my_expenses",
    {
      title: "Request myDATA expenses summary",
      description:
        "Fetch aggregated expense information from AADE for a specified date range. " +
        "Returns XML with expense totals and classifications by category. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        dateFrom: z
          .string()
          .describe(
            "Start of the date range, format dd/MM/yyyy (confirmed live — despite this endpoint's official docs implying YYYY-MM-DD). Required.",
          ),
        dateTo: z
          .string()
          .describe("End of the date range, format dd/MM/yyyy (see dateFrom). Required."),
        counterVatNumber: z
          .string()
          .optional()
          .describe("Restrict to transactions with this counterparty ΑΦΜ."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to this ΑΦΜ (for third-party submissions)."),
        invType: z
          .string()
          .optional()
          .describe("AADE invoice-type code to filter by."),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestMyExpenses(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to fetch myDATA expenses summary",
        );
      }
    },
  );

  server.registerTool(
    "mydata_request_vat_info",
    {
      title: "Request myDATA VAT details",
      description:
        "Fetch VAT in/out details from AADE for a specified date range, optionally grouped per day. " +
        "Returns XML with VAT totals and classifications. " +
        "IMPORTANT: dates for this endpoint use format dd/MM/yyyy (not YYYY-MM-DD like other endpoints). " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        dateFrom: z
          .string()
          .describe("Start of the date range (dd/MM/yyyy format). Required."),
        dateTo: z
          .string()
          .describe("End of the date range (dd/MM/yyyy format). Required."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to this ΑΦΜ (for third-party submissions)."),
        groupedPerDay: z
          .boolean()
          .optional()
          .describe(
            "When true, results are grouped per day; pagination is ignored when false.",
          ),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestVatInfo(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(error, "Failed to fetch myDATA VAT details");
      }
    },
  );

  server.registerTool(
    "mydata_request_e3_info",
    {
      title: "Request myDATA E3 (business activity tax) info",
      description:
        "Fetch E3 (business activity tax form) details from AADE for a specified date range. " +
        "Returns XML with E3 entries and tax calculations. " +
        "IMPORTANT: dates for this endpoint use format dd/MM/yyyy (not YYYY-MM-DD like other endpoints). " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        dateFrom: z
          .string()
          .describe("Start of the date range (dd/MM/yyyy format). Required."),
        dateTo: z
          .string()
          .describe("End of the date range (dd/MM/yyyy format). Required."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Restrict to this ΑΦΜ (for third-party submissions)."),
        groupedPerDay: z
          .boolean()
          .optional()
          .describe(
            "When true, results are grouped per day; pagination is ignored when false.",
          ),
        nextPartitionKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
        nextRowKey: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async ({ userId, subscriptionKey, ...params }) => {
      try {
        const xml = await client.requestE3Info(
          { userId, subscriptionKey },
          params,
        );
        return { content: [{ type: "text", text: xml }] };
      } catch (error) {
        return toolErrorResult(error, "Failed to fetch myDATA E3 info");
      }
    },
  );

  server.registerTool(
    "mydata_send_invoices",
    {
      title: "Submit invoices to myDATA",
      description:
        "Submit one or more e-invoices (including corrected/amending types) to AADE's myDATA. " +
        "Each invoice must include header details (series, aa, issue date, type, currency), " +
        "issuer/counterpart parties, line items, and invoice summary (totals). " +
        "Returns XML response with submission status and marks for each invoice. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        invoices: z
          .array(MyDataInvoiceInputSchema)
          .min(1)
          .describe("One or more invoices to submit."),
      },
    },
    async ({ userId, subscriptionKey, invoices }) => {
      try {
        const result = await client.sendInvoices(
          { userId, subscriptionKey },
          invoices,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to submit invoice(s) to myDATA");
      }
    },
  );

  server.registerTool(
    "mydata_send_income_classification",
    {
      title: "Submit income classification to myDATA",
      description:
        "Submit income classification(s) against an already-submitted invoice. " +
        "Classifications categorize income from the invoice for tax purposes. " +
        "Returns XML response with submission status. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        invoiceMark: z
          .string()
          .min(1)
          .describe(
            "The `mark` (unique id) of the already-submitted invoice being classified.",
          ),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Required for third-party (e.g. accountant) submissions."),
        transactionMode: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe(
            "1 = Reject the classification, 2 = Deviation. Mutually exclusive with `lines` — the myDATA XSD models this as a choice, provide exactly one.",
          ),
        lines: z
          .array(MyDataIncomeClassificationLineSchema)
          .optional()
          .describe(
            "Per-invoice-line classification details. Mutually exclusive with `transactionMode` — provide exactly one.",
          ),
      },
    },
    async ({ userId, subscriptionKey, invoiceMark, entityVatNumber, transactionMode, lines }) => {
      try {
        const result = await client.sendIncomeClassification(
          { userId, subscriptionKey },
          { invoiceMark, entityVatNumber, transactionMode, lines },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to submit income classification to myDATA",
        );
      }
    },
  );

  server.registerTool(
    "mydata_send_expenses_classification",
    {
      title: "Submit expenses classification to myDATA",
      description:
        "Submit expense classification(s) against an already-submitted invoice. " +
        "Classifications categorize expenses from the invoice for deduction purposes. " +
        "Returns XML response with submission status. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        invoiceMark: z
          .string()
          .min(1)
          .describe(
            "The `mark` (unique id) of the already-submitted invoice being classified.",
          ),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Required for third-party (e.g. accountant) submissions."),
        transactionMode: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe(
            "1 = Reject the classification, 2 = Deviation. Mutually exclusive with `lines` — the myDATA XSD models this as a choice, provide exactly one.",
          ),
        lines: z
          .array(MyDataExpensesClassificationLineSchema)
          .optional()
          .describe(
            "Per-invoice-line classification details. Mutually exclusive with `transactionMode` — provide exactly one.",
          ),
        classificationPostMode: z
          .union([z.literal(0), z.literal(1)])
          .optional()
          .describe(
            "0 or 1 — submission method for the classification. See AADE's SendExpensesClassificationPostPerInvoiceGuidelines.",
          ),
      },
    },
    async ({
      userId,
      subscriptionKey,
      invoiceMark,
      entityVatNumber,
      transactionMode,
      lines,
      classificationPostMode,
    }) => {
      try {
        const result = await client.sendExpensesClassification(
          { userId, subscriptionKey },
          {
            invoiceMark,
            entityVatNumber,
            transactionMode,
            lines,
            classificationPostMode,
          },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to submit expenses classification to myDATA",
        );
      }
    },
  );

  server.registerTool(
    "mydata_send_payments_method",
    {
      title: "Submit payment method(s) to myDATA",
      description:
        "Submit payment method details for an already-submitted invoice. " +
        "Specifies how the invoice was or will be paid (e.g., cash, card, bank transfer). " +
        "The sum of payment amounts must equal the invoice's total gross value. " +
        "Returns XML response with submission status. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        invoiceMark: z
          .string()
          .min(1)
          .describe(
            "The `mark` (unique id) of the already-submitted invoice being paid.",
          ),
        paymentMethods: z
          .array(MyDataPaymentMethodDetailSchema)
          .min(1)
          .describe(
            "One or more payment methods. The sum of `amount` across all entries must equal the invoice's totalGrossValue.",
          ),
      },
    },
    async ({ userId, subscriptionKey, invoiceMark, paymentMethods }) => {
      try {
        const result = await client.sendPaymentsMethod(
          { userId, subscriptionKey },
          { invoiceMark, paymentMethods },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Failed to submit payment method(s) to myDATA",
        );
      }
    },
  );

  server.registerTool(
    "mydata_cancel_invoice",
    {
      title: "Cancel invoice in myDATA",
      description:
        "Cancel a previously submitted invoice in myDATA without re-submission. " +
        "The invoice must have been successfully submitted before it can be cancelled. " +
        "Returns XML response with cancellation status. " +
        sandboxWarning +
        " " +
        credentialNote,
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued aade-user-id for the myDATA subscription.",
          ),
        subscriptionKey: z
          .string()
          .min(1)
          .describe(
            "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription.",
          ),
        mark: z
          .string()
          .min(1)
          .describe("The `mark` (unique id) of the invoice to cancel."),
        entityVatNumber: z
          .string()
          .optional()
          .describe("Required for third-party (e.g. accountant) submissions."),
      },
    },
    async ({ userId, subscriptionKey, mark, entityVatNumber }) => {
      try {
        const result = await client.cancelInvoice(
          { userId, subscriptionKey },
          { mark, entityVatNumber },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to cancel invoice in myDATA");
      }
    },
  );
}
