import { GovApiError } from "./http.js";

/**
 * Shared plain-object shape matching the MCP SDK's `CallToolResult` for a
 * single text block. Defined here (not imported from
 * @modelcontextprotocol/sdk) so core stays a plain API-client library with
 * no MCP SDK dependency — every bundle's tool handlers return this same
 * shape regardless.
 */
export interface ToolTextResult {
  [key: string]: unknown;
  content: [{ type: "text"; text: string }];
  isError?: true;
}

/** Wraps a plain text response as a successful tool result. */
export function toolTextResult(text: string): ToolTextResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Normalizes an error caught in a tool handler into an actionable message
 * instead of a raw stack trace, with the HTTP status appended when known.
 * Used consistently across every bundle's tool handlers.
 */
export function toolErrorResult(error: unknown, context: string): ToolTextResult {
  const message =
    error instanceof GovApiError
      ? `${context}: ${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
      : `${context}: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text", text: message }], isError: true };
}
