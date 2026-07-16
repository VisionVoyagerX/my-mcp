import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErganiClient } from "./client.js";

describe("ErganiClient", () => {
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

  it("authenticates then lists services with a bearer token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ accessToken: "token-123" }))
      .mockResolvedValueOnce(jsonResponse([{ name: "WRKCardSE" }, { name: "OvTime" }]));
    const client = new ErganiClient({ baseUrl: "https://example.test/api" });

    const services = await client.listServices({ username: "u", password: "p" });

    const [authUrl, authInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(authUrl).toBe("https://example.test/api/Authentication");
    expect(JSON.parse(authInit.body as string)).toEqual({
      Username: "u",
      Password: "p",
      UserType: "01",
    });

    const [servicesUrl, servicesInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(servicesUrl).toBe("https://example.test/api/WebServices/ServicesList");
    expect(servicesInit.headers).toEqual({ Authorization: "Bearer token-123" });

    expect(services).toEqual([{ name: "WRKCardSE" }, { name: "OvTime" }]);
  });

  it("throws when authentication succeeds but no accessToken is returned", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = new ErganiClient({ baseUrl: "https://example.test/api" });

    await expect(client.listServices({ username: "u", password: "p" })).rejects.toThrow(
      /no accessToken/,
    );
  });
});
