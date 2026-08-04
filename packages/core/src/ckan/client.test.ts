import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { CkanClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("CkanClient", () => {
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

  it("searches datasets and unwraps the CKAN result envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("package_search.json")),
    );
    const client = new CkanClient({
      baseUrl: "https://example.test/api/3/action",
    });

    const result = await client.searchDatasets({ query: "budget" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/3/action/package_search?q=budget&rows=10&start=0",
      expect.anything(),
    );
    expect(result.count).toBe(2);
    expect(result.results[0]?.title).toBe("State Budget 2026");
  });

  it("sends the Authorization: Token header when a token is configured", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("package_show.json")),
    );
    const client = new CkanClient({
      baseUrl: "https://example.test/api/3/action",
      token: "my-token",
    });

    await client.getDataset("state-budget-2026");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ Authorization: "Token my-token" });
  });

  it("throws a GovApiError when CKAN reports success: false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { message: "Not found" } }),
    );
    const client = new CkanClient({
      baseUrl: "https://example.test/api/3/action",
    });

    await expect(client.getDataset("missing")).rejects.toMatchObject({
      name: "GovApiError",
      message: "Not found",
    });
  });

  function bufferResponse(bytes: Uint8Array) {
    return new Response(bytes, { status: 200 });
  }

  describe("getResourceData", () => {
    it("parses a CSV resource into columns and rows", async () => {
      const csv = "name,population\nAthens,664046\nThessaloniki,315196\n";
      fetchMock.mockResolvedValueOnce(
        bufferResponse(new TextEncoder().encode(csv)),
      );
      const client = new CkanClient({
        baseUrl: "https://example.test/api/3/action",
      });

      const data = await client.getResourceData(
        "https://example.test/files/cities.csv",
      );

      expect(data.columns).toEqual(["name", "population"]);
      expect(data.rows).toEqual([
        ["Athens", 664046],
        ["Thessaloniki", 315196],
      ]);
      expect(data.totalRows).toBe(2);
    });

    it("parses an XLSX resource and paginates rows", async () => {
      const sheet = XLSX.utils.aoa_to_sheet([
        ["id", "amount"],
        [1, 100],
        [2, 200],
        [3, 300],
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Data");
      const bytes = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Uint8Array;
      fetchMock.mockResolvedValueOnce(bufferResponse(bytes));
      const client = new CkanClient({
        baseUrl: "https://example.test/api/3/action",
      });

      const data = await client.getResourceData(
        "https://example.test/files/amounts.xlsx",
        { limit: 2, offset: 1 },
      );

      expect(data.sheet).toBe("Data");
      expect(data.sheetNames).toEqual(["Data"]);
      expect(data.rows).toEqual([
        [2, 200],
        [3, 300],
      ]);
      expect(data.totalRows).toBe(3);
    });

    it("does not send the CKAN API token when downloading a resource", async () => {
      fetchMock.mockResolvedValueOnce(
        bufferResponse(new TextEncoder().encode("a,b\n1,2\n")),
      );
      const client = new CkanClient({
        baseUrl: "https://example.test/api/3/action",
        token: "my-token",
      });

      await client.getResourceData("https://other-host.test/file.csv");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toBeUndefined();
    });

    it("throws a GovApiError for an unknown sheet name", async () => {
      const sheet = XLSX.utils.aoa_to_sheet([["a"]]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Data");
      const bytes = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Uint8Array;
      fetchMock.mockResolvedValueOnce(bufferResponse(bytes));
      const client = new CkanClient({
        baseUrl: "https://example.test/api/3/action",
      });

      await expect(
        client.getResourceData("https://example.test/files/x.xlsx", {
          sheet: "Missing",
        }),
      ).rejects.toMatchObject({ name: "GovApiError" });
    });
  });
});
