import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiavgeiaClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("DiavgeiaClient", () => {
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

  it("fetches and parses a decision by ADA", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("decision.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const decision = await client.getDecision("6ΣΦ4ΩΞΧ-ΑΒΓ");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/decisions/6%CE%A3%CE%A64%CE%A9%CE%9E%CE%A7-%CE%91%CE%92%CE%93/",
      expect.anything(),
    );
    expect(decision.ada).toBe("6ΣΦ4ΩΞΧ-ΑΒΓ");
    expect(decision.organizationId).toBe("100037417");
  });

  it("searches decisions and builds a Solr-style query from filters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const result = await client.searchDecisions({
      organizationUid: "100037417",
      fromDate: "2026-05-01",
      page: 0,
      size: 10,
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/api/search/advanced");
    expect(calledUrl.searchParams.get("q")).toBe(
      'organizationUid:"100037417" AND issueDate>="2026-05-01"',
    );
    expect(result.decisions).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("wraps a free-text query in a quoted content: field clause", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await client.searchDecisions({ query: 'budget "review"' });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("q")).toBe('content:"budget \\"review\\""');
  });

  it("rejects a search with no filters instead of sending a match-all query", async () => {
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.searchDecisions()).rejects.toThrow(/at least one filter/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a GovApiError with status on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not found", { status: 404 }),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.getDecision("does-not-exist")).rejects.toMatchObject({
      name: "GovApiError",
      status: 404,
    });
  });
});
