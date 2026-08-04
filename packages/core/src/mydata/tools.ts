import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MyDataClient, type MyDataCredentials } from "./client.js";
import {
  MyDataInvoiceInputSchema,
  MyDataIncomeClassificationLineSchema,
  MyDataExpensesClassificationLineSchema,
  MyDataPaymentMethodDetailSchema,
} from "./types.js";
import { toolErrorResult, type ToolTextResult } from "../tool-result.js";
import {
  createCredentialHelpers,
  type CreateCredentialHelpersOptions,
} from "../credentials/helpers.js";

export interface RegisterMyDataToolsOptions extends CreateCredentialHelpersOptions {
  framing?: string;
  /** Overrides the `MYDATA_BASE_URL` env var. */
  baseUrl?: string;
}

const credentialFields = {
  credentialToken: z
    .string()
    .optional()
    .describe(
      "A token from mydata_connect, in place of userId+subscriptionKey.",
    ),
  userId: z
    .string()
    .optional()
    .describe(
      "Your AADE-issued aade-user-id for the myDATA subscription. Omit if using credentialToken.",
    ),
  subscriptionKey: z
    .string()
    .optional()
    .describe(
      "Your AADE-issued Ocp-Apim-Subscription-Key for the myDATA subscription. Omit if using credentialToken.",
    ),
};

export function registerMyDataTools(
  server: McpServer,
  options?: RegisterMyDataToolsOptions,
): void {
  const client = new MyDataClient({ baseUrl: options?.baseUrl });
  const framingNote = options?.framing ? ` ${options.framing}` : "";
  const helpers = createCredentialHelpers<MyDataCredentials>({
    credentialStore: options?.credentialStore,
    encryptionKey: options?.encryptionKey,
  });

  const sandboxWarning =
    "This affects real tax records — verify you are pointed at the myDATA SANDBOX (MYDATA_BASE_URL=https://mydataapidev.aade.gr) before testing, not production.";
  const credentialNote = helpers.storageEnabled
    ? "This is a bring-your-own-credential tool: myDATA subscription keys belong to an individual business's own Taxisnet " +
      "registration, so the server never holds a shared credential. Either pass your own userId and subscriptionKey " +
      "(get them from aade.gr's myDATA registration), or call mydata_connect once and pass the returned credentialToken instead."
    : "This is a bring-your-own-credential tool: myDATA subscription keys belong to an individual business's own Taxisnet " +
      "registration, so the server never holds a shared credential — pass your own userId and subscriptionKey with every call (get them from aade.gr's myDATA registration).";

  async function resolveCredentials(args: {
    credentialToken?: string;
    userId?: string;
    subscriptionKey?: string;
  }): Promise<
    | { ok: true; credentials: MyDataCredentials }
    | { ok: false; result: ToolTextResult }
  > {
    const resolved = await helpers.resolve(args, ["userId", "subscriptionKey"]);
    if ("error" in resolved) {
      return {
        ok: false,
        result: {
          content: [{ type: "text", text: resolved.error }],
          isError: true,
        },
      };
    }
    return { ok: true, credentials: resolved.credentials };
  }

  server.registerTool(
    "mydata_request_docs",
    {
      title: "Request myDATA invoices received",
      description:
        "Fetch e-invoices (myDATA electronic books) from AADE that other parties submitted to you. " +
        "Filter by date range and/or counterparty ΑΦΜ. Returns the raw XML response. " +
        sandboxWarning +
        " " +
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestDocs(resolved.credentials, params);
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestTransmittedDocs(
          resolved.credentials,
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
        dateFrom: z
          .string()
          .describe(
            "Start of the date range, format dd/MM/yyyy (confirmed live — despite this endpoint's official docs implying YYYY-MM-DD). Required.",
          ),
        dateTo: z
          .string()
          .describe(
            "End of the date range, format dd/MM/yyyy (see dateFrom). Required.",
          ),
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestMyIncome(resolved.credentials, params);
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
        dateFrom: z
          .string()
          .describe(
            "Start of the date range, format dd/MM/yyyy (confirmed live — despite this endpoint's official docs implying YYYY-MM-DD). Required.",
          ),
        dateTo: z
          .string()
          .describe(
            "End of the date range, format dd/MM/yyyy (see dateFrom). Required.",
          ),
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestMyExpenses(
          resolved.credentials,
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestVatInfo(resolved.credentials, params);
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({ credentialToken, userId, subscriptionKey, ...params }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const xml = await client.requestE3Info(resolved.credentials, params);
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
        invoices: z
          .array(MyDataInvoiceInputSchema)
          .min(1)
          .describe("One or more invoices to submit."),
      },
    },
    async ({ credentialToken, userId, subscriptionKey, invoices }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const result = await client.sendInvoices(
          resolved.credentials,
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({
      credentialToken,
      userId,
      subscriptionKey,
      invoiceMark,
      entityVatNumber,
      transactionMode,
      lines,
    }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const result = await client.sendIncomeClassification(
          resolved.credentials,
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
      credentialToken,
      userId,
      subscriptionKey,
      invoiceMark,
      entityVatNumber,
      transactionMode,
      lines,
      classificationPostMode,
    }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const result = await client.sendExpensesClassification(
          resolved.credentials,
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({
      credentialToken,
      userId,
      subscriptionKey,
      invoiceMark,
      paymentMethods,
    }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const result = await client.sendPaymentsMethod(resolved.credentials, {
          invoiceMark,
          paymentMethods,
        });
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
        credentialNote +
        framingNote,
      inputSchema: {
        ...credentialFields,
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
    async ({
      credentialToken,
      userId,
      subscriptionKey,
      mark,
      entityVatNumber,
    }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        userId,
        subscriptionKey,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const result = await client.cancelInvoice(resolved.credentials, {
          mark,
          entityVatNumber,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to cancel invoice in myDATA");
      }
    },
  );

  if (helpers.storageEnabled) {
    server.registerTool(
      "mydata_connect",
      {
        title: "Save myDATA credentials for reuse",
        description:
          "Encrypts and stores your myDATA userId+subscriptionKey server-side, returning a " +
          "credentialToken you can pass to other mydata_* tools instead of resending your " +
          "raw credentials every call. Call mydata_forget to revoke it." +
          framingNote,
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
        },
      },
      async ({ userId, subscriptionKey }) => {
        const token = await helpers.connect({ userId, subscriptionKey });
        return {
          content: [
            {
              type: "text",
              text:
                `Saved. Use this as credentialToken on other mydata_* calls:\n\n${token}\n\n` +
                "Save it now — it will not be shown again. Call mydata_forget with this token to revoke it.",
            },
          ],
        };
      },
    );

    server.registerTool(
      "mydata_forget",
      {
        title: "Delete saved myDATA credentials",
        description:
          "Deletes the credentials stored under a credentialToken previously returned by " +
          "mydata_connect." +
          framingNote,
        inputSchema: {
          credentialToken: z
            .string()
            .min(1)
            .describe("The token to revoke, from a prior mydata_connect call."),
        },
      },
      async ({ credentialToken }) => {
        await helpers.forget(credentialToken);
        return {
          content: [
            {
              type: "text",
              text: "Credentials for that token have been deleted.",
            },
          ],
        };
      },
    );
  }
}
