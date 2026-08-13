import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  registerDiavgeiaTools,
  registerGemiTools,
  registerKimdisTools,
  registerMyDataTools,
  registerErganiTools,
  importEncryptionKey,
  type CredentialStore,
} from "@my-mcp/core";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

// Briefcase in a warm gold — the "business" half of this repo's icon pair
// (CitizenMCP is a person silhouette instead). Served at /icon.svg, see
// citizen-mcp/src/worker.ts for the icons-extension rationale (SEP-973).
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="64" fill="#B8860B"/>
  <rect x="50" y="34" width="28" height="20" rx="10" fill="none" stroke="#FFFFFF" stroke-width="8"/>
  <rect x="24" y="54" width="80" height="54" rx="10" fill="#FFFFFF"/>
  <rect x="24" y="76" width="80" height="8" fill="#B8860B"/>
  <rect x="57" y="70" width="14" height="20" rx="3" fill="#B8860B"/>
</svg>`;

interface Env {
  RATE_LIMITER: RateLimit;
  /**
   * A second, GLOBAL (fixed-key, not per-IP) rate limiter for ΓΕΜΗ tool
   * calls. ΓΕΜΗ requires a single server-held API key (GEMI_API_KEY below)
   * that ΚΥ ΓΕΜΗ caps at 30 requests/minute in total — across every visitor
   * to this public worker, not per caller.
   */
  GEMI_RATE_LIMITER: RateLimit;
  /** Secret: `wrangler secret put GEMI_API_KEY`. Never set as a plain `var`. */
  GEMI_API_KEY: string;
  /** Stores encrypted myDATA/Ergani credentials for the connect-once token system. */
  CREDENTIALS_KV: KVNamespace;
  /**
   * Secret: `wrangler secret put CREDENTIAL_ENCRYPTION_KEY` (a base64
   * 256-bit key, e.g. from `openssl rand -base64 32`). Encrypts everything
   * written to CREDENTIALS_KV. If unset, myDATA/Ergani connect/forget
   * tools simply aren't registered — raw-credential calls still work.
   */
  CREDENTIAL_ENCRYPTION_KEY?: string;
  /**
   * Optional: overrides myDATA's base URL, e.g. to point the whole worker at
   * AADE's sandbox (`https://mydataapidev.aade.gr`) instead of production.
   * Unset defaults to production — Cloudflare Workers don't populate
   * `process.env` from bindings, so `MyDataClient`'s own env-var fallback
   * never applies here; this is the only way to override it on this worker.
   */
  MYDATA_BASE_URL?: string;
  /** Optional: overrides Ergani's base URL, same rationale as MYDATA_BASE_URL above. */
  ERGANI_BASE_URL?: string;
}

const FRAMING =
  "BusinessMCP: a public MCP server for Greek business/tax data — Diavgeia (procurement " +
  "decisions), ΓΕΜΗ (business registry), ΚΗΜΔΗΣ (structured public-contracts registry — " +
  "request/notice/award/contract/payment lifecycle data), myDATA (e-invoicing), and Ergani " +
  "(labor/employment). See also CitizenMCP for open-data/transparency tools.";

/**
 * Builds the myDATA/Ergani credential-storage options from the worker's
 * bindings. Returns `{}` (storage disabled, raw-credential calls still
 * work) if the KV binding or encryption-key secret isn't configured yet —
 * lets this worker deploy and function before that setup step happens.
 */
async function buildCredentialOptions(
  env: Env,
): Promise<{ credentialStore?: CredentialStore; encryptionKey?: CryptoKey }> {
  if (!env.CREDENTIAL_ENCRYPTION_KEY || !env.CREDENTIALS_KV) return {};

  const encryptionKey = await importEncryptionKey(
    env.CREDENTIAL_ENCRYPTION_KEY,
  );
  const credentialStore: CredentialStore = {
    async get(token) {
      const value = await env.CREDENTIALS_KV.get(token);
      return value ?? undefined;
    },
    put: (token, value) => env.CREDENTIALS_KV.put(token, value),
    delete: (token) => env.CREDENTIALS_KV.delete(token),
  };
  return { credentialStore, encryptionKey };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/icon.svg") {
    return new Response(ICON_SVG, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        ...CORS_HEADERS,
      },
    });
  }

  // The MCP endpoint is the bare origin URL only. Anything else — notably
  // OAuth discovery probes like /.well-known/oauth-protected-resource,
  // which MCP clients check first to decide whether auth is even needed —
  // must 404 cleanly. Letting these fall through to the transport below
  // returns a 406 (wrong Accept header) instead, which some clients read
  // as "this server wants some kind of auth" and then fail trying to
  // register OAuth against a server that has none.
  if (url.pathname !== "/" && url.pathname !== "") {
    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
  if (!success) {
    return new Response(
      "429 Too Many Requests: rate limit exceeded for this IP.",
      {
        status: 429,
        headers: CORS_HEADERS,
      },
    );
  }

  // Create a fresh server and transport per request (stateless mode)
  const server = new McpServer({
    name: "business-mcp",
    version: "0.1.0",
    title: "BusinessMCP",
    websiteUrl: "https://github.com/VisionVoyagerX/my-mcp",
    icons: [
      {
        src: `${url.origin}/icon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
    ],
  });

  registerDiavgeiaTools(server, { framing: FRAMING });

  registerGemiTools(server, {
    framing: FRAMING,
    apiKey: env.GEMI_API_KEY,
    checkRateLimit: () => env.GEMI_RATE_LIMITER.limit({ key: "gemi-global" }),
  });
  registerKimdisTools(server, { framing: FRAMING });

  const credentialOptions = await buildCredentialOptions(env);
  registerMyDataTools(server, {
    framing: FRAMING,
    baseUrl: env.MYDATA_BASE_URL,
    ...credentialOptions,
  });
  registerErganiTools(server, {
    framing: FRAMING,
    baseUrl: env.ERGANI_BASE_URL,
    ...credentialOptions,
  });

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  const response = await transport.handleRequest(request);

  // Add CORS headers to response
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
