import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GemiClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("GemiClient", () => {
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

  it("throws an actionable error when no API key is configured", async () => {
    const client = new GemiClient({ baseUrl: "https://example.test/api" });

    await expect(client.getCompany("237954001")).rejects.toMatchObject({
      name: "GovApiError",
      message: expect.stringContaining("GEMI_API_KEY"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the api_key header and parses a company lookup", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("company_show.json")),
    );
    const client = new GemiClient({
      baseUrl: "https://example.test/api",
      apiKey: "test-key",
    });

    const company = await client.getCompany("237954001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/companies/237954001",
      expect.objectContaining({
        headers: { api_key: "test-key", Accept: "application/json" },
      }),
    );
    expect(company.coNameEl).toBe("ΠΑΡΑΔΕΙΓΜΑ ΑΕ");
    expect(company.arGemi).toBe(237954001);
    expect(company.persons[0]?.personName).toBe("ΓΕΩΡΓΙΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ");
  });

  it("searches companies by TIN and unwraps the searchResults envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("companies_search.json")),
    );
    const client = new GemiClient({
      baseUrl: "https://example.test/api",
      apiKey: "test-key",
    });

    const results = await client.searchCompanyByTin("094014201");

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("afm")).toBe("094014201");
    expect(results).toHaveLength(1);
    expect(results[0]?.arGemi).toBe(237954001);
    expect(results[0]?.coNameEl).toBe("ΠΑΡΑΔΕΙΓΜΑ ΑΕ");
  });

  it("fetches a company's public documents", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("company_documents.json")),
    );
    const client = new GemiClient({
      baseUrl: "https://example.test/api",
      apiKey: "test-key",
    });

    const docs = await client.getCompanyDocuments("237954001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/companies/237954001/documents",
      expect.objectContaining({
        headers: { api_key: "test-key", Accept: "application/json" },
      }),
    );
    expect(docs.decision).toHaveLength(1);
    expect(docs.decision[0]?.summary).toBe("Σύσταση εταιρείας");
    expect(docs.publication[0]?.kad).toBe("67890");
  });

  it("fetches the legal-types metadata list", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("legal_types.json")),
    );
    const client = new GemiClient({
      baseUrl: "https://example.test/api",
      apiKey: "test-key",
    });

    const legalTypes = await client.listLegalTypes();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/metadata/legalTypes",
      expect.objectContaining({
        headers: { api_key: "test-key", Accept: "application/json" },
      }),
    );
    expect(legalTypes).toHaveLength(2);
    expect(legalTypes[0]?.descr).toBe("Ανώνυμη Εταιρεία");
  });
});
