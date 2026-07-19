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

/** Max characters of a GovApiError's response body to inline into a tool error message. */
const MAX_BODY_SNIPPET_LENGTH = 300;

/**
 * Normalizes an error caught in a tool handler into an actionable message
 * instead of a raw stack trace, with the HTTP status and a snippet of the
 * response body appended when known — often the only clue distinguishing,
 * e.g., a missing API key from an invalid one. Used consistently across
 * every bundle's tool handlers.
 */
export function toolErrorResult(error: unknown, context: string): ToolTextResult {
  const message =
    error instanceof GovApiError
      ? `${context}: ${error.message}${error.status ? ` (HTTP ${error.status})` : ""}${bodySnippet(error.body)}`
      : `${context}: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text", text: message }], isError: true };
}

function bodySnippet(body: string | undefined): string {
  if (!body) return "";
  const trimmed = body.trim();
  if (!trimmed) return "";
  const snippet =
    trimmed.length > MAX_BODY_SNIPPET_LENGTH
      ? `${trimmed.slice(0, MAX_BODY_SNIPPET_LENGTH)}…`
      : trimmed;
  return ` — ${snippet}`;
}
