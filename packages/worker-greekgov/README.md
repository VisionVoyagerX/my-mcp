# @my-mcp/worker-greekgov

**GreekGovMCP**: A public, rate-limited Cloudflare Worker exposing Diavgeia (Greek government transparency portal) as an MCP server.

## Overview

This package deploys the full Diavgeia tool set from `@my-mcp/core` to Cloudflare Workers, making them available as a remote MCP server that any MCP client can point at via HTTP. It reuses the exact same `registerDiavgeiaTools` factory as `bundle-transparency`/`bundle-business` — no separate copy of the tool logic.

**Live URL**: `https://greekgov-mcp.nickdandis96.workers.dev`

**Current scope (v0.1)**: all 15 Diavgeia tools (search/get decisions and version history, organization/unit/signer lookups, decision-type and dictionary metadata, positions, organization browsing). See [`packages/core/src/diavgeia/tools.ts`](/packages/core/src/diavgeia/tools.ts) for the full list and schemas.

**Rate limiting**: 30 requests per 60 seconds per IP address (Cloudflare native `ratelimit` binding, requires Wrangler v4.36.0+). No accounts or API keys — this is an open public endpoint.

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
- Node.js 22+ (required by Wrangler 4.x) and `wrangler` v4.36.0+ (required for the `ratelimits` binding)

### Deploy to Cloudflare Workers

```bash
wrangler login
pnpm run deploy
```

The worker deploys to `https://greekgov-mcp.<your-account-subdomain>.workers.dev` (or a custom domain if configured).

## Configuration

Edit `wrangler.toml` to adjust:

- **Rate limits**: change `[ratelimits.simple] limit`/`period` to adjust requests/period
- **Worker name**: change `name = "greekgov-mcp"` to deploy under a different name
- **Compatibility**: adjust `compatibility_date` if needed for specific Cloudflare API versions

## Using the Remote Server

The server speaks MCP's [Streamable HTTP transport](https://spec.modelcontextprotocol.io/latest/basics/transports/) at the worker's root URL — no separate SSE endpoint. Point any MCP client that supports remote/Streamable HTTP servers at:

```
https://greekgov-mcp.nickdandis96.workers.dev
```

For clients that take raw JSON config (exact key names vary by client — check its docs):

```json
{
  "mcpServers": {
    "greekgov-mcp": {
      "url": "https://greekgov-mcp.nickdandis96.workers.dev"
    }
  }
}
```

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
- **Icon**: served at `/icon.svg` and referenced from `serverInfo.icons` per MCP's icons extension ([SEP-973](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2573)). Claude.ai doesn't render connector icons yet ([anthropics/claude-ai-mcp#152](https://github.com/anthropics/claude-ai-mcp/issues/152)), so this is forward-compatible rather than immediately visible

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
