# @my-mcp/worker-greekgov

**GreekGovMCP**: A public, rate-limited Cloudflare Worker exposing Diavgeia (Greek government transparency portal) as an MCP server.

## Overview

This package deploys the Diavgeia MCP tools to Cloudflare Workers, making them available as a remote MCP server that any MCP client can point at via HTTP.

**Current scope (v0.1)**:
- `diavgeia_search_decisions` — search Greek public-sector decisions by organization, type, signer, and date range
- `diavgeia_get_decision` — fetch full details for a specific decision by ADA code
- `diavgeia_get_organization` — resolve organization UIDs to names and metadata

**Rate limiting**: 100 requests per 60 seconds per IP address (Cloudflare native rate limiter).

## Local Development

```bash
# Install dependencies
pnpm install

# Run local dev server on http://localhost:8787
pnpm run dev

# Point your MCP client to http://localhost:8787 to test
```

## Deployment

### Prerequisites
- Cloudflare account with Workers enabled
- `wrangler` CLI authenticated with your Cloudflare credentials

### Deploy to Cloudflare Workers

```bash
wrangler login
pnpm run deploy
```

The worker will be deployed to `https://greekgov-mcp.workers.dev` (or a custom domain if configured).

## Configuration

Edit `wrangler.toml` to adjust:
- **Rate limits**: Change `simple = { limit = 100, period = 60 }` to adjust requests/period
- **Worker name**: Change `name = "greekgov-mcp"` to deploy under a different name
- **Compatibility**: Adjust `compatibility_date` if needed for specific Cloudflare API versions

## Using the Remote Server

In your MCP client (e.g., Claude Desktop), add the remote server configuration:

```json
{
  "mcpServers": {
    "greekgov-mcp": {
      "url": "https://greekgov-mcp.workers.dev",
      "transport": "sse"
    }
  }
}
```

The server will respond to MCP protocol requests over HTTP/SSE from any client.

## Examples

### Search procurement decisions from a ministry
```
User → Client: "Search Diavgeia for procurement decisions (type Β.1.1) from ministry 100037417 issued in the last 30 days"
Client → MCP → diavgeia_search_decisions:
  { decisionTypeUid: "Β.1.1", organizationUid: "100037417", fromDate: "2026-06-21" }
```

### Fetch a specific decision
```
User → Client: "Get full details for Diavgeia decision with ADA 6ΣΦ4ΩΞΧ-ΑΒΓ"
Client → MCP → diavgeia_get_decision:
  { ada: "6ΣΦ4ΩΞΧ-ΑΒΓ" }
```

### Resolve organization metadata
```
User → Client: "What is organization UID 100037417?"
Client → MCP → diavgeia_get_organization:
  { organizationUid: "100037417" }
```

## Architecture

- **Stateless**: Each HTTP request creates a fresh MCP server instance (no persistent sessions)
- **Transport**: `WebStandardStreamableHTTPServerTransport` (Web Standard APIs — works on any runtime: Cloudflare Workers, Node.js 18+, Deno, Bun, etc.)
- **Rate limiting**: Cloudflare Workers' native `ratelimit` binding checks IP address before MCP logic runs

## Future Enhancements (Parked for v0.2+)

- Add CKAN (data.gov.gr) tools to match the full transparency bundle
- Add Geodata.gov.gr tools
- Custom domain support instead of `workers.dev`
- API key / tiered billing if usage grows (currently free/public)
- Persistent sessions for resumability (if eventStore provided)

## See Also

- [Diavgeia Client](/packages/core/src/diavgeia/) — Shared client library
- [Transparency Bundle](/packages/bundle-transparency/) — Stdio MCP server with Diavgeia, CKAN, and Geodata
- [MCP Spec](https://spec.modelcontextprotocol.io/) — Full MCP protocol documentation
