import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerDiavgeiaTools } from "@my-mcp/core";

interface CloudflareEnv {
  RATE_LIMITER: RateLimit;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean; resetAfter: number }>;
}

async function handleRequest(
  request: Request,
  env: CloudflareEnv,
): Promise<Response> {
  const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

  try {
    const rateLimitResult = await env.RATE_LIMITER.limit({ key: clientIp });
    if (!rateLimitResult.success) {
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAfter - Date.now()) / 1000),
          ),
        },
      });
    }
  } catch (error) {
    console.error("Rate limiting error:", error);
  }

  // Create a fresh server and transport per request (stateless mode)
  const server = new McpServer({
    name: "greekgov-mcp",
    version: "0.1.0",
  });

  registerDiavgeiaTools(server, {
    framing:
      "GreekGovMCP: a public, rate-limited MCP server for Greek government transparency data (Diavgeia). Current release (v0.1) exposes only Diavgeia; future releases will add data.gov.gr, Geodata.gov.gr, and other domains.",
  });

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export default {
  fetch: (request: Request, env: CloudflareEnv) =>
    handleRequest(request, env),
};
