import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiavgeiaClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(
    new URL(`./__fixtures__/${name}`, import.meta.url),
  );
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
      toDate: "2026-05-15",
      page: 0,
      size: 10,
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/api/search/advanced");
    expect(calledUrl.searchParams.get("q")).toBe(
      'organizationUid:"100037417" AND issueDate:[DT(2026-05-01T00:00:00) TO DT(2026-05-15T23:59:59)]',
    );
    expect(calledUrl.searchParams.has("from_date")).toBe(false);
    expect(result.decisions).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("wraps a free-text query in a quoted content: field clause", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await client.searchDecisions({ query: 'budget "review"' });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("q")).toBe(
      'content:"budget \\"review\\""',
    );
  });

  it("rejects a search with no filters instead of sending a match-all query", async () => {
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.searchDecisions()).rejects.toThrow(
      /at least one filter/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a GovApiError with status on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.getDecision("does-not-exist")).rejects.toMatchObject({
      name: "GovApiError",
      status: 404,
    });
  });

  it("lists decision types", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("types.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const types = await client.getDecisionTypes();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/types",
      expect.anything(),
    );
    expect(types).toHaveLength(3);
    expect(types.find((t) => t.uid === "Β.1.1")?.allowedInDecisions).toBe(true);
  });

  it("searches organizations by category, tolerating null email/website, and paginates client-side", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("organizations.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const result = await client.searchOrganizations({
      category: "MINISTRY",
      size: 1,
      page: 0,
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("category")).toBe("MINISTRY");
    expect(result.total).toBe(2);
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]!.odeManagerEmail).toBeNull();
  });

  it("rejects an organization search with no status or category filter", async () => {
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.searchOrganizations()).rejects.toThrow(
      /at least one filter/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("embeds fromDate/toDate as an issueDate:[DT(...) TO DT(...)] clause in q, not as separate HTTP params", async () => {
    // Regression test: /search/advanced has no from_date/to_date HTTP params — Diavgeia silently
    // ignores them if sent that way (confirmed live 2026-07-23). The only working mechanism is a
    // Lucene range clause on issueDate inside q itself.
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await client.searchDecisions({
      organizationUid: "100037417",
      fromDate: "2026-05-01",
      toDate: "2026-05-10",
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.has("from_date")).toBe(false);
    expect(calledUrl.searchParams.has("to_date")).toBe(false);
    expect(calledUrl.searchParams.get("q")).toBe(
      'organizationUid:"100037417" AND issueDate:[DT(2026-05-01T00:00:00) TO DT(2026-05-10T23:59:59)]',
    );
  });

  it("rejects a fromDate/toDate span wider than Diavgeia's 180-day hard cap instead of silently truncating", async () => {
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(
      client.searchDecisions({
        organizationUid: "100037417",
        fromDate: "2020-01-01",
        toDate: "2020-12-31",
      }),
    ).rejects.toThrow(/180 days/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults an open-ended toDate to fromDate + 180 days", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await client.searchDecisions({
      organizationUid: "100037417",
      fromDate: "2026-01-01",
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("q")).toContain(
      "issueDate:[DT(2026-01-01T00:00:00) TO DT(2026-06-30T",
    );
  });

  it("allows a date-only search (fromDate/toDate with no other filter)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(
      client.searchDecisions({ fromDate: "2026-01-01", toDate: "2026-02-01" }),
    ).resolves.toBeDefined();
  });

  it("performs a simple keyword search via /search", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("search.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const result = await client.simpleSearchDecisions({
      org: "100037417",
      protocol: "12345/2026",
    });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe("/api/search");
    expect(calledUrl.searchParams.get("org")).toBe("100037417");
    expect(calledUrl.searchParams.get("protocol")).toBe("12345/2026");
    expect(result.decisions).toHaveLength(2);
  });

  it("rejects a simple search with no filters", async () => {
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await expect(client.simpleSearchDecisions()).rejects.toThrow(
      /at least one filter/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches a decision by versionId", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("decision.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const decision = await client.getDecisionVersion(
      "726516c5-faad-4169-9b94-42897cf7a8c1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/decisions/v/726516c5-faad-4169-9b94-42897cf7a8c1/",
      expect.anything(),
    );
    expect(decision.ada).toBe("6ΣΦ4ΩΞΧ-ΑΒΓ");
  });

  it("fetches a decision's version log", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("version-log.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const log = await client.getDecisionVersionLog("6ΣΦ4ΩΞΧ-ΑΒΓ");

    expect(log.versions).toHaveLength(1);
    expect(log.versions[0]!.status).toBe("PUBLISHED");
  });

  it("fetches full organization details including units/signers/positions", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("organization-details.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const details = await client.getOrganizationDetails("100037417");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/organizations/100037417/details",
      expect.anything(),
    );
    expect(details.units).toHaveLength(1);
    expect(details.signers[0]!.firstName).toBe("ΚΩΝΣΤΑΝΤΙΝΟΣ");
    expect(details.positions).toHaveLength(1);
  });

  it("lists organization units, defaulting descendants to children", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("units.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const units = await client.getOrganizationUnits("100037417");

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("descendants")).toBe("children");
    expect(units).toHaveLength(2);
  });

  it("fetches a single unit by id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("unit.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const unit = await client.getUnit("73040");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/units/73040/",
      expect.anything(),
    );
    expect(unit.label).toBe("ΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ");
  });

  it("fetches a single signer by id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("signer.json")));
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const signer = await client.getSigner("102984");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/signers/102984/",
      expect.anything(),
    );
    expect(signer.units[0]!.positionLabel).toBe("Διευθυντής");
  });

  it("lists positions, paginating client-side since /positions ignores page/size", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("positions.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const result = await client.listPositions({ size: 2, page: 0 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/positions",
      expect.anything(),
    );
    expect(result.total).toBe(3);
    expect(result.positions).toHaveLength(2);
  });

  it("lists all dictionaries", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("dictionaries.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const dictionaries = await client.getDictionaries();

    expect(dictionaries).toHaveLength(2);
    expect(dictionaries.find((d) => d.uid === "ORG_CATEGORY")).toBeDefined();
  });

  it("fetches a single dictionary's items", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("dictionary.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const dict = await client.getDictionary("ORG_CATEGORY");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/dictionaries/ORG_CATEGORY",
      expect.anything(),
    );
    expect(dict.items).toHaveLength(2);
  });

  it("fetches decision type details with extraFields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("decision-type-details.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    const details = await client.getDecisionTypeDetails("Β.1.1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/types/%CE%92.1.1/details",
      expect.anything(),
    );
    expect(details.extraFields).toHaveLength(2);
    expect(details.extraFields[1]!.fixedValueList).toEqual([
      "Κρατικός",
      "Φορέα",
    ]);
  });

  it("lists search terms — all, common-only, and scoped to a decision type", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("search-terms.json")),
    );
    const client = new DiavgeiaClient({ baseUrl: "https://example.test/api" });

    await client.getSearchTerms();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://example.test/api/search/terms",
      expect.anything(),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("search-terms.json")),
    );
    await client.getSearchTerms({ commonOnly: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://example.test/api/search/terms/common",
      expect.anything(),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse(loadFixture("search-terms.json")),
    );
    await client.getSearchTerms({ typeUid: "Β.1.1" });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://example.test/api/types/%CE%92.1.1/terms",
      expect.anything(),
    );
  });
});
