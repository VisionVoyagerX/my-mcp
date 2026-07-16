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
}

/**
 * Shared fetch wrapper for all gov-service clients: applies a timeout and
 * normalizes non-2xx responses into `GovApiError` instead of letting
 * callers deal with raw fetch exceptions. Returns the raw response body.
 */
export async function fetchText(
  url: string | URL,
  options: FetchJsonOptions = {},
): Promise<string> {
  const { timeoutMs = 15_000, ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
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

  const text = await response.text();

  if (!response.ok) {
    throw new GovApiError(
      `${init.method ?? "GET"} ${String(url)} returned HTTP ${response.status}`,
      { url: String(url), status: response.status, body: text.slice(0, 2000) },
    );
  }

  return text;
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
