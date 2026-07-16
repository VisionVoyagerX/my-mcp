import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CkanClient } from "./client.js";

function loadFixture(name: string): unknown {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
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
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("package_search.json")));
    const client = new CkanClient({ baseUrl: "https://example.test/api/3/action" });

    const result = await client.searchDatasets({ query: "budget" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/3/action/package_search?q=budget&rows=10&start=0",
      expect.anything(),
    );
    expect(result.count).toBe(2);
    expect(result.results[0]?.title).toBe("State Budget 2026");
  });

  it("sends the Authorization: Token header when a token is configured", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(loadFixture("package_show.json")));
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
    const client = new CkanClient({ baseUrl: "https://example.test/api/3/action" });

    await expect(client.getDataset("missing")).rejects.toMatchObject({
      name: "GovApiError",
      message: "Not found",
    });
  });
});
