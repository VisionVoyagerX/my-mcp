export class GovApiError extends Error {
  readonly url: string;
  readonly status?: number;
  readonly body?: string;

  constructor(
    message: string,
    opts: { url: string; status?: number; body?: string; cause?: unknown },
  ) {
    super(message, { cause: opts.cause });
    this.name = "GovApiError";
    this.url = opts.url;
    this.status = opts.status;
    this.body = opts.body;
  }
}

export interface FetchJsonOptions extends RequestInit {
  /** Aborts the request after this many milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /**
   * How many times to retry a 429 or 5xx response before giving up.
   * Defaults to 2 (i.e. up to 3 attempts total). Set to 0 to disable.
   */
  maxRetries?: number;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses a `Retry-After` header (seconds, or an HTTP-date) into milliseconds. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

async function attemptFetch(
  url: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    const isAbort = cause instanceof Error && cause.name === "AbortError";
    throw new GovApiError(
      isAbort
        ? `Request to ${String(url)} timed out after ${timeoutMs}ms`
        : `Request to ${String(url)} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { url: String(url), cause },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Shared fetch wrapper for all gov-service clients: applies a timeout,
 * retries 429/5xx responses with exponential backoff (honoring
 * `Retry-After` when the server sends one), and normalizes any final
 * non-2xx response into `GovApiError` instead of letting callers deal with
 * raw fetch exceptions. Returns the raw response body.
 */
export async function fetchText(
  url: string | URL,
  options: FetchJsonOptions = {},
): Promise<string> {
  const { timeoutMs = 15_000, maxRetries = 2, ...init } = options;

  let lastResponse: Response | undefined;
  let lastText = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await attemptFetch(url, init, timeoutMs);
    const text = await response.text();

    if (response.ok) {
      return text;
    }

    lastResponse = response;
    lastText = text;

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) {
      break;
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    await sleep(retryAfterMs ?? 2 ** attempt * 500);
  }

  throw new GovApiError(
    `${init.method ?? "GET"} ${String(url)} returned HTTP ${lastResponse!.status}`,
    { url: String(url), status: lastResponse!.status, body: lastText.slice(0, 2000) },
  );
}

/** Same as `fetchText`, but parses the body as JSON. */
export async function fetchJson<T>(
  url: string | URL,
  options: FetchJsonOptions = {},
): Promise<T> {
  const text = await fetchText(url, options);

  if (text.length === 0) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new GovApiError(`${options.method ?? "GET"} ${String(url)} returned a non-JSON body`, {
      url: String(url),
      body: text.slice(0, 2000),
      cause,
    });
  }
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : "";
}
