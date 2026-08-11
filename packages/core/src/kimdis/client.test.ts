import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KimdisClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("KimdisClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  it("searches requests via POST with a JSON body and parses the page envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("request-search.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const page = await client.searchRequests({ title: "νερό", page: 0 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/request?page=0",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "νερό" }),
      }),
    );
    expect(page.totalElements).toBeGreaterThan(0);
    expect(page.content[0]?.referenceNumber).toBe("26REQ019602548");
  });

  it("omits undefined filters from the search body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("notice-search.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    await client.searchNotices({});

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/notice?page=0",
      expect.objectContaining({ body: "{}" }),
    );
  });

  it("searches awards against the /auction endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("award-search.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const page = await client.searchAwards({ contractorName: "ACME" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/auction?page=0",
      expect.anything(),
    );
    expect(page.content[0]?.referenceNumber).toBe("26AWRD019602560");
  });

  it("searches contracts and parses cost/date fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("contract-search.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const page = await client.searchContracts({});

    expect(page.content[0]?.referenceNumber).toBe("26SYMV019602331");
    expect(page.content[0]?.contractBudget).toBe(8910);
  });

  it("searches payments", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("payment-search.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const page = await client.searchPayments({});

    expect(page.content[0]?.referenceNumber).toBe("26PAY019602557");
  });

  it("fetches the ADAM chain for a reference number", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("adam-chain.json")),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const chain = await client.getAdamChain("26REQ019602548");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/adamChain/26REQ019602548",
      expect.anything(),
    );
    expect(chain.requests).toEqual(["26REQ019602548"]);
    expect(chain.notices).toEqual([]);
  });

  it("builds an attachment URL without making a network call", () => {
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const url = client.getAttachmentUrl("request", "26REQ019602548");

    expect(url).toBe(
      "https://example.test/request/attachment/26REQ019602548",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("looks up ΑΔΑΜ codes for a ΠΔΕ number, keyed by lifecycle stage", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        notices: ["26PROC019602558"],
        contracts: ["26SYMV019602331"],
        payments: [],
      }),
    );
    const client = new KimdisClient({ baseUrl: "https://example.test" });

    const result = await client.lookupPde("2025ΝΑ39100001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/pde?pdeNumber=2025%CE%9D%CE%9139100001",
      expect.anything(),
    );
    expect(result.notices).toEqual(["26PROC019602558"]);
    expect(result.contracts).toEqual(["26SYMV019602331"]);
    expect(result.payments).toEqual([]);
  });
});
