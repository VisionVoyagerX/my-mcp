import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerDiavgeiaTools } from "@my-mcp/core";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

// Minimalist civic-building glyph (pediment + columns) in Greek-flag blue.
// Served at /icon.svg and referenced from serverInfo.icons per MCP's icons
// extension (SEP-973) — not yet rendered by Claude.ai's connector list, but
// forward-compatible for when it is.
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="64" fill="#0D5EAF"/>
  <polygon points="24,52 64,28 104,52" fill="#FFFFFF"/>
  <rect x="20" y="52" width="88" height="8" fill="#FFFFFF"/>
  <rect x="28" y="64" width="10" height="36" fill="#FFFFFF"/>
  <rect x="48" y="64" width="10" height="36" fill="#FFFFFF"/>
  <rect x="70" y="64" width="10" height="36" fill="#FFFFFF"/>
  <rect x="90" y="64" width="10" height="36" fill="#FFFFFF"/>
  <rect x="18" y="100" width="92" height="10" fill="#FFFFFF"/>
</svg>`;

interface Env {
  RATE_LIMITER: RateLimit;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  // Handle CORS preflight
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
    name: "greekgov-mcp",
    version: "0.1.0",
    title: "GreekGovMCP",
    websiteUrl: "https://github.com/VisionVoyagerX/my-mcp",
    icons: [
      {
        src: `${url.origin}/icon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
    ],
  });

  registerDiavgeiaTools(server, {
    framing:
      "GreekGovMCP: a public MCP server for Greek government transparency data (Diavgeia). Current release (v0.1) exposes only Diavgeia; future releases will add data.gov.gr, Geodata.gov.gr, and other domains.",
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
