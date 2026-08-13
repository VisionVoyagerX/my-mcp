import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  registerDiavgeiaTools,
  registerCkanTools,
  registerGemiTools,
  registerKimdisTools,
} from "@my-mcp/core";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

// Person silhouette in Greek-flag blue — the "citizen" half of this repo's
// icon pair (BusinessMCP is a briefcase instead). Served at /icon.svg and
// referenced from serverInfo.icons per MCP's icons extension (SEP-973) — not
// yet rendered by Claude.ai's connector list, but forward-compatible for
// when it is.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="64" fill="#0D5EAF"/>
  <circle cx="64" cy="42" r="22" fill="#FFFFFF"/>
  <path d="M20,108 C20,66 108,66 108,108 Z" fill="#FFFFFF"/>
</svg>`;

interface Env {
  RATE_LIMITER: RateLimit;
  /** Optional: raises data.gov.gr's rate limit. Free self-service token from data.gov.gr's registration page. */
  DATA_GOV_GR_TOKEN?: string;
  /**
   * A second, GLOBAL (fixed-key, not per-IP) rate limiter for ΓΕΜΗ tool
   * calls. ΓΕΜΗ requires a single server-held API key (GEMI_API_KEY below)
   * that ΚΥ ΓΕΜΗ caps at 30 requests/minute in total — across every visitor
   * to this public worker, not per caller. This worker uses its own
   * GEMI_API_KEY, separate from business-mcp's — sharing one key across
   * two independently-limited workers would double-book the 30 req/min
   * quota, since each worker's rate limiter binding only tracks its own
   * traffic.
   */
  GEMI_RATE_LIMITER: RateLimit;
  /** Secret: `wrangler secret put GEMI_API_KEY`. Never set as a plain `var`. */
  GEMI_API_KEY: string;
}

const FRAMING =
  "CitizenMCP: a public MCP server for Greek government transparency and open data — Diavgeia " +
  "(procurement/decisions), data.gov.gr (open dataset catalog), ΓΕΜΗ (business registry open " +
  "data), and ΚΗΜΔΗΣ (structured public-contracts registry — request/notice/award/contract/" +
  "payment lifecycle data, complementing Diavgeia's free-text disclosure acts). See also " +
  "BusinessMCP for myDATA/Ergani business data (ΓΕΜΗ is shared between both, like Diavgeia, " +
  "since the business registry is genuinely cross-domain).";

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
    name: "citizen-mcp",
    version: "0.1.0",
    title: "CitizenMCP",
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
  registerCkanTools(server, { framing: FRAMING, token: env.DATA_GOV_GR_TOKEN });
  registerGemiTools(server, {
    framing: FRAMING,
    apiKey: env.GEMI_API_KEY,
    checkRateLimit: () => env.GEMI_RATE_LIMITER.limit({ key: "gemi-global" }),
  });
  registerKimdisTools(server, { framing: FRAMING });

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
