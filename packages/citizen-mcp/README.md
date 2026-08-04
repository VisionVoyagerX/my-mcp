# @my-mcp/citizen-mcp

**CitizenMCP**: A public, rate-limited Cloudflare Worker exposing Greek government transparency and open data — Diavgeia and data.gov.gr — as an MCP server.

## Overview

This package deploys the Diavgeia and CKAN (data.gov.gr) tool sets from `@my-mcp/core` to Cloudflare Workers, making them available as a remote MCP server that any MCP client can point at via HTTP. No accounts or API keys are required for either service — Diavgeia is fully open, and CKAN works unauthenticated too (an optional free `DATA_GOV_GR_TOKEN` just raises its rate limit).

Geodata.gov.gr was originally planned for this worker but was dropped 2026-08-04 — the service has been unreachable (timeouts) across every liveness check since 2026-07-21, and raw GeoJSON isn't a great fit for a chat interface even when it works. See `RESEARCH.md`'s Tier 1 note if reviving it.

See also [`@my-mcp/business-mcp`](../business-mcp) for ΓΕΜΗ/myDATA/Ergani business data — Diavgeia is shared between both since procurement decisions are genuinely cross-domain.

**Live URL**: `https://citizen-mcp.nickdandis96.workers.dev`

**Tool set**:

- All 15 Diavgeia tools (search/get decisions and version history, organization/unit/signer lookups, decision-type and dictionary metadata, positions, organization browsing). See [`packages/core/src/diavgeia/tools.ts`](/packages/core/src/diavgeia/tools.ts).
- `ckan_search_datasets`, `ckan_get_dataset` — data.gov.gr's ~22k-dataset open-data catalog. See [`packages/core/src/ckan/tools.ts`](/packages/core/src/ckan/tools.ts).

**Rate limiting**: 30 requests per 60 seconds per IP address (Cloudflare native `ratelimit` binding, requires Wrangler v4.36.0+). No accounts or API keys — this is an open public endpoint.

## Local Development

```bash
pnpm install
pnpm run dev   # http://localhost:8787
```

## Deployment

### Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI authenticated with your Cloudflare credentials
- Node.js 22+ (required by Wrangler 4.x) and `wrangler` v4.36.0+ (required for the `ratelimits` binding)

### (Optional) raise data.gov.gr's rate limit

```bash
wrangler secret put DATA_GOV_GR_TOKEN
```

Free self-service token from data.gov.gr's registration page. Skip this and CKAN tools still work, just at the default unauthenticated rate limit.

### Deploy

```bash
wrangler login
pnpm run deploy
```

Deploys to `https://citizen-mcp.<your-account-subdomain>.workers.dev` (or a custom domain if configured).

## Configuration

Edit `wrangler.toml` to adjust:

- **Rate limit**: `[ratelimits.simple] limit`/`period`
- **Worker name**: `name = "citizen-mcp"`
- **Compatibility**: `compatibility_date` if needed for specific Cloudflare API versions

## Using the Remote Server

The server speaks MCP's [Streamable HTTP transport](https://spec.modelcontextprotocol.io/latest/basics/transports/) at the worker's root URL — no separate SSE endpoint.

```json
{
  "mcpServers": {
    "citizen-mcp": {
      "url": "https://citizen-mcp.nickdandis96.workers.dev"
    }
  }
}
```

## Architecture

- **Stateless**: Each HTTP request creates a fresh MCP server instance (no persistent sessions)
- **Transport**: `WebStandardStreamableHTTPServerTransport` (Web Standard APIs — works on any runtime: Cloudflare Workers, Node.js 18+, Deno, Bun, etc.)
- **Rate limiting**: Cloudflare Workers' native `ratelimit` binding checks IP address before MCP logic runs
- **Icon**: served at `/icon.svg` and referenced from `serverInfo.icons` per MCP's icons extension ([SEP-973](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2573))

## See Also

- [Diavgeia Client](/packages/core/src/diavgeia/), [CKAN Client](/packages/core/src/ckan/) — shared client libraries
- [`@my-mcp/business-mcp`](../business-mcp) — the other half of this repo's public MCP servers
- [MCP Spec](https://spec.modelcontextprotocol.io/) — full MCP protocol documentation
