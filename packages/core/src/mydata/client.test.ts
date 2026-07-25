import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyDataClient } from "./client.js";
import {
  MyDataApiError,
  parseMyDataResponse,
  parseMyDataResponseOrThrow,
} from "./xml.js";

function loadFixture(name: string): string {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
  return readFileSync(path, "utf-8");
}

describe("MyDataClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function xmlResponse(body: string): Response {
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }

  // ---- Existing tests from the original file (adjusted if needed) ----

  it("sends the aade-user-id and subscription-key headers, and returns raw XML", async () => {
    const xml = "<RequestedDoc><invoicesDoc></invoicesDoc></RequestedDoc>";
    fetchMock.mockResolvedValueOnce(xmlResponse(xml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestDocs(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { dateFrom: "2026-01-01", dateTo: "2026-01-31" },
    );

    expect(result).toBe(xml);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/RequestDocs");
    expect(url.searchParams.get("dateFrom")).toBe("2026-01-01");
    expect(init.headers).toEqual({
      "aade-user-id": "user-1",
      "Ocp-Apim-Subscription-Key": "sub-key-1",
    });
  });

  it("defaults mark to 0 to fetch from the beginning", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedDoc/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestDocs({ userId: "u", subscriptionKey: "k" });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("mark")).toBe("0");
  });

  // ---- requestDocs additional tests ----

  it("requestDocs includes counterVatNumber in query params", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedDoc/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestDocs(
      { userId: "u", subscriptionKey: "k" },
      { counterVatNumber: "123456789", mark: "1" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("counterVatNumber")).toBe("123456789");
  });

  it("requestDocs includes pagination and maxMark params", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedDoc/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestDocs(
      { userId: "u", subscriptionKey: "k" },
      { maxMark: "999", nextPartitionKey: "pk1", nextRowKey: "rk1" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("maxMark")).toBe("999");
    expect(url.searchParams.get("nextPartitionKey")).toBe("pk1");
    expect(url.searchParams.get("nextRowKey")).toBe("rk1");
  });

  // ---- requestTransmittedDocs ----

  it("requestTransmittedDocs fetches from /RequestTransmittedDocs endpoint and returns raw XML", async () => {
    const xml = loadFixture("request-transmitted-docs.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(xml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestTransmittedDocs(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { mark: "1", dateFrom: "2026-01-01" },
    );

    expect(result).toBe(xml);
    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/myDATA/RequestTransmittedDocs");
    expect(calledUrl.searchParams.get("mark")).toBe("1");
    expect(calledUrl.searchParams.get("dateFrom")).toBe("2026-01-01");
  });

  it("requestTransmittedDocs includes pagination params", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedDocs/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestTransmittedDocs(
      { userId: "u", subscriptionKey: "k" },
      { nextPartitionKey: "pk2", nextRowKey: "rk2" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("nextPartitionKey")).toBe("pk2");
    expect(url.searchParams.get("nextRowKey")).toBe("rk2");
  });

  // ---- requestMyIncome ----

  it("requestMyIncome fetches from /RequestMyIncome endpoint with required dateFrom/dateTo params", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedIncome/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestMyIncome(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { dateFrom: "2026-01-01", dateTo: "2026-12-31" },
    );

    expect(result).toBe("<RequestedIncome/>");
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/myDATA/RequestMyIncome");
    expect(url.searchParams.get("dateFrom")).toBe("2026-01-01");
    expect(url.searchParams.get("dateTo")).toBe("2026-12-31");
  });

  it("requestMyIncome includes optional counterVatNumber, entityVatNumber, and invType", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedIncome/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestMyIncome(
      { userId: "u", subscriptionKey: "k" },
      {
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
        counterVatNumber: "999888777",
        entityVatNumber: "111222333",
        invType: "1.1",
      },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("counterVatNumber")).toBe("999888777");
    expect(url.searchParams.get("entityVatNumber")).toBe("111222333");
    expect(url.searchParams.get("invType")).toBe("1.1");
  });

  // ---- requestMyExpenses ----

  it("requestMyExpenses fetches from /RequestMyExpenses endpoint", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedExpenses/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestMyExpenses(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { dateFrom: "2026-01-01", dateTo: "2026-12-31" },
    );

    expect(result).toBe("<RequestedExpenses/>");
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/myDATA/RequestMyExpenses");
  });

  it("requestMyExpenses includes pagination params", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedExpenses/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestMyExpenses(
      { userId: "u", subscriptionKey: "k" },
      { dateFrom: "2026-01-01", dateTo: "2026-12-31", nextPartitionKey: "pk3" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("nextPartitionKey")).toBe("pk3");
  });

  // ---- requestVatInfo ----

  it("requestVatInfo fetches from /RequestVatInfo endpoint", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedVat/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestVatInfo(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { dateFrom: "01/01/2026", dateTo: "31/12/2026" },
    );

    expect(result).toBe("<RequestedVat/>");
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/myDATA/RequestVatInfo");
  });

  it("requestVatInfo sends GroupedPerDay query param (capital G, P, D) when groupedPerDay is true", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedVat/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestVatInfo(
      { userId: "u", subscriptionKey: "k" },
      { dateFrom: "01/01/2026", dateTo: "31/12/2026", groupedPerDay: true },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("GroupedPerDay")).toBe("true");
  });

  it("sends GroupedPerDay=false explicitly (a real value, not an absent param) when groupedPerDay is false", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedVat/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestVatInfo(
      { userId: "u", subscriptionKey: "k" },
      { dateFrom: "01/01/2026", dateTo: "31/12/2026", groupedPerDay: false },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("GroupedPerDay")).toBe("false");
  });

  it("omits GroupedPerDay when groupedPerDay is not specified at all", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedVat/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestVatInfo(
      { userId: "u", subscriptionKey: "k" },
      { dateFrom: "01/01/2026", dateTo: "31/12/2026" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.has("GroupedPerDay")).toBe(false);
  });

  // ---- requestE3Info ----

  it("requestE3Info fetches from /RequestE3Info endpoint with GroupedPerDay param support", async () => {
    fetchMock.mockResolvedValueOnce(xmlResponse("<RequestedE3/>"));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.requestE3Info(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { dateFrom: "01/01/2026", dateTo: "31/12/2026", groupedPerDay: true },
    );

    expect(result).toBe("<RequestedE3/>");
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/myDATA/RequestE3Info");
    expect(url.searchParams.get("GroupedPerDay")).toBe("true");
  });

  // ---- sendInvoices success case ----

  it("sendInvoices POSTs to /SendInvoices with XML body and returns parsed response on success", async () => {
    const responseXml = loadFixture("send-invoices-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.sendInvoices(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      [
        {
          series: "A",
          aa: "1",
          issueDate: "2026-01-15",
          invoiceType: "1.1",
          currency: "EUR",
          issuer: { vatNumber: "123456789", country: "GR", branch: 0 },
          lines: [
            {
              lineNumber: 1,
              netValue: 100,
              vatCategory: "1",
              vatAmount: 24,
            },
          ],
          summary: {
            totalNetValue: 100,
            totalVatAmount: 24,
            totalGrossValue: 124,
          },
        },
      ],
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.statusCode).toBe("Success");
    expect(result.entries[0]!.invoiceMark).toBe("400000000000001");
    expect(result.entries[0]!.qrUrl).toContain("mydata.aade.gr");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/SendInvoices");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "aade-user-id": "user-1",
      "Ocp-Apim-Subscription-Key": "sub-key-1",
      "Content-Type": "application/xml",
    });

    const body = init.body as string;
    expect(body).toContain("123456789");
    expect(body).toContain("1.1");
  });

  // ---- sendInvoices validation error case ----

  it("sendInvoices rejects with MyDataApiError when response has ValidationError status", async () => {
    const errorXml = loadFixture("send-invoices-validation-error.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(errorXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await expect(
      client.sendInvoices({ userId: "user-1", subscriptionKey: "sub-key-1" }, [
        {
          series: "A",
          aa: "1",
          issueDate: "2026-01-15",
          invoiceType: "1.1",
          currency: "EUR",
          issuer: { vatNumber: "123456789" },
          lines: [
            { lineNumber: 1, netValue: 100, vatCategory: "1", vatAmount: 25 },
          ],
          summary: {
            totalNetValue: 100,
            totalVatAmount: 24,
            totalGrossValue: 124,
          },
        },
      ]),
    ).rejects.toThrow(MyDataApiError);

    fetchMock.mockResolvedValueOnce(xmlResponse(errorXml));
    const error: unknown = await client
      .sendInvoices({ userId: "user-1", subscriptionKey: "sub-key-1" }, [
        {
          series: "A",
          aa: "1",
          issueDate: "2026-01-15",
          invoiceType: "1.1",
          currency: "EUR",
          issuer: { vatNumber: "123456789" },
          lines: [
            { lineNumber: 1, netValue: 100, vatCategory: "1", vatAmount: 25 },
          ],
          summary: {
            totalNetValue: 100,
            totalVatAmount: 24,
            totalGrossValue: 124,
          },
        },
      ])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MyDataApiError);
    const apiError = error as MyDataApiError;
    expect(apiError.entries[0]!.statusCode).toBe("ValidationError");
    expect(apiError.entries[0]!.errors[0]!.code).toBe("209");
  });

  // ---- sendIncomeClassification ----

  it("sendIncomeClassification POSTs to /SendIncomeClassification with classification XML", async () => {
    const responseXml = loadFixture("send-invoices-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.sendIncomeClassification(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      {
        invoiceMark: "400000000000001",
        lines: [
          {
            lineNumber: 1,
            details: [
              {
                classificationType: "E3_561_001",
                classificationCategory: "category1_1",
                amount: 100,
              },
            ],
          },
        ],
      },
    );

    expect(result.entries[0]!.statusCode).toBe("Success");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/SendIncomeClassification");
    expect(init.method).toBe("POST");

    const body = init.body as string;
    expect(body).toContain("400000000000001");
    expect(body).toContain("icls:IncomeClassificationsDoc");
    expect(body).toContain("icls:invoicesIncomeClassificationDetails");
    expect(body).toContain("category1_1");
  });

  it("sendIncomeClassification sends transactionMode instead of lines when provided (XSD choice)", async () => {
    const responseXml = loadFixture("send-invoices-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.sendIncomeClassification(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { invoiceMark: "400000000000001", transactionMode: 2 },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain("icls:transactionMode");
    expect(body).not.toContain("icls:invoicesIncomeClassificationDetails");
  });

  // ---- sendExpensesClassification ----

  it("sendExpensesClassification POSTs to /SendExpensesClassification with classification XML", async () => {
    const responseXml = loadFixture("send-invoices-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.sendExpensesClassification(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      {
        invoiceMark: "400000000000001",
        classificationPostMode: 1,
        lines: [
          {
            lineNumber: 1,
            details: [
              {
                classificationType: "E3_102_001",
                classificationCategory: "category1_1",
                amount: 50,
              },
            ],
          },
        ],
      },
    );

    expect(result.entries[0]!.statusCode).toBe("Success");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/SendExpensesClassification");
    expect(init.method).toBe("POST");

    const body = init.body as string;
    expect(body).toContain("400000000000001");
    expect(body).toContain("ecls:ExpensesClassificationsDoc");
    expect(body).toContain("ecls:invoicesExpensesClassificationDetails");
    expect(body).toContain("ecls:classificationPostMode");
  });

  // ---- sendPaymentsMethod ----

  it("sendPaymentsMethod POSTs to /SendPaymentsMethod with payment method XML", async () => {
    const responseXml = loadFixture("send-payments-method-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.sendPaymentsMethod(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      {
        invoiceMark: "400000000000001",
        paymentMethods: [
          {
            type: "10",
            amount: 124,
          },
        ],
      },
    );

    expect(result.entries[0]!.statusCode).toBe("Success");
    expect(result.entries[0]!.paymentMethodMark).toBe("600000000000001");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/SendPaymentsMethod");
    expect(init.method).toBe("POST");

    const body = init.body as string;
    expect(body).toContain("400000000000001");
    expect(body).toContain("pmt:PaymentMethodsDoc");
    expect(body).toContain("inv:type");
    expect(body).toContain("inv:amount");
  });

  // ---- cancelInvoice ----

  it("cancelInvoice POSTs to /CancelInvoice with query params (no body)", async () => {
    const responseXml = loadFixture("cancel-invoice-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    const result = await client.cancelInvoice(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { mark: "400000000000001" },
    );

    expect(result.entries[0]!.statusCode).toBe("Success");
    expect(result.entries[0]!.cancellationMark).toBe("500000000000001");

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/myDATA/CancelInvoice");
    expect(url.searchParams.get("mark")).toBe("400000000000001");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("cancelInvoice includes optional entityVatNumber param", async () => {
    const responseXml = loadFixture("cancel-invoice-success.xml");
    fetchMock.mockResolvedValueOnce(xmlResponse(responseXml));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.cancelInvoice(
      { userId: "user-1", subscriptionKey: "sub-key-1" },
      { mark: "400000000000001", entityVatNumber: "123456789" },
    );

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("entityVatNumber")).toBe("123456789");
  });

  // ---- parseMyDataResponse and parseMyDataResponseOrThrow unit tests ----

  describe("parseMyDataResponse", () => {
    it("parses a success XML response into entries array", () => {
      const xml = loadFixture("send-invoices-success.xml");
      const result = parseMyDataResponse(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.index).toBe(1);
      expect(result.entries[0]!.invoiceUid).toBe(
        "625c3ba3-a0d9-4b8b-9f4e-8c2d1e5b7a9c",
      );
      expect(result.entries[0]!.invoiceMark).toBe("400000000000001");
      expect(result.entries[0]!.statusCode).toBe("Success");
      expect(result.entries[0]!.errors).toHaveLength(0);
    });

    it("parses an error response with error details", () => {
      const xml = loadFixture("send-invoices-validation-error.xml");
      const result = parseMyDataResponse(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.statusCode).toBe("ValidationError");
      expect(result.entries[0]!.errors).toHaveLength(1);
      expect(result.entries[0]!.errors[0]!.code).toBe("209");
      expect(result.entries[0]!.errors[0]!.message).toContain(
        "sum of the line-level VAT",
      );
    });
  });

  describe("parseMyDataResponseOrThrow", () => {
    it("returns response for Success status", () => {
      const xml = loadFixture("send-invoices-success.xml");
      const result = parseMyDataResponseOrThrow(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]!.statusCode).toBe("Success");
    });

    it("throws MyDataApiError for non-Success status", () => {
      const xml = loadFixture("send-invoices-validation-error.xml");

      expect(() => parseMyDataResponseOrThrow(xml)).toThrow(MyDataApiError);
    });

    it("includes entries in thrown MyDataApiError", () => {
      const xml = loadFixture("send-invoices-validation-error.xml");

      try {
        parseMyDataResponseOrThrow(xml);
        throw new Error("Should have thrown MyDataApiError");
      } catch (e) {
        if (e instanceof MyDataApiError) {
          expect(e.entries).toHaveLength(1);
          expect(e.entries[0]!.statusCode).toBe("ValidationError");
        }
      }
    });
  });
});
