import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyDataClient } from "./client.js";

describe("MyDataClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends the aade-user-id and subscription-key headers, and returns raw XML", async () => {
    const xml = '<RequestedDoc><invoicesDoc></invoicesDoc></RequestedDoc>';
    fetchMock.mockResolvedValueOnce(new Response(xml, { status: 200 }));
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
    fetchMock.mockResolvedValueOnce(new Response("<RequestedDoc/>", { status: 200 }));
    const client = new MyDataClient({ baseUrl: "https://example.test/myDATA" });

    await client.requestDocs({ userId: "u", subscriptionKey: "k" });

    const calledUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("mark")).toBe("0");
  });
});
