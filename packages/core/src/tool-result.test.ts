import { describe, expect, it } from "vitest";
import { GovApiError } from "./http.js";
import { toolErrorResult, toolTextResult } from "./tool-result.js";

describe("toolTextResult", () => {
  it("wraps text as a non-error result", () => {
    expect(toolTextResult("hello")).toEqual({ content: [{ type: "text", text: "hello" }] });
  });
});

describe("toolErrorResult", () => {
  it("includes the HTTP status and response body snippet for a GovApiError", () => {
    const error = new GovApiError("GET https://example.test returned HTTP 401", {
      url: "https://example.test",
      status: 401,
      body: '{"message":"No API key found in request"}',
    });

    const result = toolErrorResult(error, "Failed to fetch thing");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'Failed to fetch thing: GET https://example.test returned HTTP 401 (HTTP 401) — {"message":"No API key found in request"}',
    );
  });

  it("omits the body suffix when the GovApiError has no body", () => {
    const error = new GovApiError("Request timed out", { url: "https://example.test" });

    const result = toolErrorResult(error, "Failed to fetch thing");

    expect(result.content[0].text).toBe("Failed to fetch thing: Request timed out");
  });

  it("truncates long response bodies", () => {
    const longBody = "x".repeat(400);
    const error = new GovApiError("GET https://example.test returned HTTP 500", {
      url: "https://example.test",
      status: 500,
      body: longBody,
    });

    const result = toolErrorResult(error, "Failed");

    expect(result.content[0].text).toBe(
      `Failed: GET https://example.test returned HTTP 500 (HTTP 500) — ${"x".repeat(300)}…`,
    );
  });

  it("falls back to the plain error message for non-GovApiError errors", () => {
    const result = toolErrorResult(new Error("boom"), "Failed");
    expect(result.content[0].text).toBe("Failed: boom");
  });
});
