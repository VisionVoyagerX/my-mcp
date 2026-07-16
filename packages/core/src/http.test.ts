import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText, GovApiError } from "./http.js";

describe("fetchText retry/backoff", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it("retries a 503 with backoff and succeeds on a later attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchText("https://example.test/thing");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors a numeric Retry-After header instead of the default backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429, headers: { "Retry-After": "1" } }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchText("https://example.test/thing");
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe("ok");
  });

  it("does not retry a non-retryable 4xx status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

    await expect(fetchText("https://example.test/thing")).rejects.toMatchObject({
      name: "GovApiError",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries and surfaces the last response's status", async () => {
    fetchMock.mockImplementation(async () => new Response("unavailable", { status: 503 }));

    const promise = fetchText("https://example.test/thing", { maxRetries: 1 });
    const expectation = expect(promise).rejects.toMatchObject({
      name: "GovApiError",
      status: 503,
    } satisfies Partial<GovApiError>);
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
