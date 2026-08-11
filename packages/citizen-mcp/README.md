# @my-mcp/citizen-mcp

**CitizenMCP**: A public Cloudflare Worker exposing Greek government transparency and open data — Diavgeia, data.gov.gr, ΓΕΜΗ, and ΚΗΜΔΗΣ — as an MCP server.

## Overview

This package deploys the Diavgeia, CKAN (data.gov.gr), ΓΕΜΗ, and ΚΗΜΔΗΣ tool sets from `@my-mcp/core` to Cloudflare Workers, making them available as a remote MCP server that any MCP client can point at via HTTP. Diavgeia, CKAN, and ΚΗΜΔΗΣ need no accounts or API keys (an optional free `DATA_GOV_GR_TOKEN` just raises CKAN's rate limit); ΓΕΜΗ needs a free server-side API key, same as on business-mcp — see Auth below.

Geodata.gov.gr was originally planned for this worker but was dropped 2026-08-04 — the service has been unreachable (timeouts) across every liveness check since 2026-07-21, and raw GeoJSON isn't a great fit for a chat interface even when it works. See `RESEARCH.md`'s Tier 1 note if reviving it.

See also [`@my-mcp/business-mcp`](../business-mcp) for myDATA/Ergani business data — Diavgeia and ΓΕΜΗ are both shared between the two workers, since procurement decisions and the business registry are genuinely cross-domain (transparency data that also matters to business/tax use cases).

**Live URL**: `https://citizen-mcp.nickdandis96.workers.dev`

**Tool set**:

- All 15 Diavgeia tools (search/get decisions and version history, organization/unit/signer lookups, decision-type and dictionary metadata, positions, organization browsing). See [`packages/core/src/diavgeia/tools.ts`](/packages/core/src/diavgeia/tools.ts).
- `ckan_search_datasets`, `ckan_get_dataset` — data.gov.gr's ~22k-dataset open-data catalog. See [`packages/core/src/ckan/tools.ts`](/packages/core/src/ckan/tools.ts).
- `gemi_search_company_by_tin`, `gemi_get_company`, `gemi_get_company_documents`, `gemi_list_metadata` — ΓΕΜΗ (business registry) open data. See [`packages/core/src/gemi/tools.ts`](/packages/core/src/gemi/tools.ts).
- `kimdis_search_requests`, `kimdis_search_notices`, `kimdis_search_awards`, `kimdis_search_contracts`, `kimdis_search_payments` (one per procurement lifecycle stage), plus `kimdis_get_adam_chain` (trace a procurement end-to-end via ΑΔΑΜ), `kimdis_get_attachment` (PDF link for a record), `kimdis_lookup_pde` — ΚΗΜΔΗΣ (public-contracts registry) structured open data, complementing Diavgeia's free-text disclosure acts. See [`packages/core/src/kimdis/tools.ts`](/packages/core/src/kimdis/tools.ts).

## Auth — Diavgeia/CKAN/ΚΗΜΔΗΣ open, ΓΕΜΗ needs a server key

- **Diavgeia / CKAN / ΚΗΜΔΗΣ**: fully open, no key.
- **ΓΕΜΗ**: a single manually-approved `api_key` held server-side (`GEMI_API_KEY` secret), shared by every caller of *this* worker. ΚΥ ΓΕΜΗ caps that one key at **30 requests/minute in total** — see Rate limiting below. **This worker needs its own ΓΕΜΗ API key, separate from business-mcp's** — the 30 req/min cap is per key, so reusing the same key across two independently-rate-limited workers would double-book that shared quota.

## Rate limiting

- **ΓΕΜΗ**: 30 requests per 60 seconds **globally, shared across every visitor to this worker** — not per IP, because the underlying `api_key` itself is capped that way regardless of caller. ΓΕΜΗ tool calls will 429 quickly under any real concurrent traffic; that's expected, not a bug.
- **Diavgeia / CKAN / ΚΗΜΔΗΣ**: no dedicated limiter — covered by the worker's general 30 requests/60s per-IP `RATE_LIMITER`. ΚΗΜΔΗΣ's own documented cap (350 req/min) sits well above that, so it's never the binding constraint.

Uses Cloudflare's native `ratelimit` binding (requires Wrangler v4.36.0+).

## Local Development

```bash
pnpm install
pnpm run dev   # http://localhost:8787
```

For ΓΕΜΗ testing locally, put a secret in a git-ignored `.dev.vars` file in this package:

```
GEMI_API_KEY=your-key-here
```

## Deployment

### Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI authenticated with your Cloudflare credentials
- Node.js 22+ (required by Wrangler 4.x) and `wrangler` v4.36.0+ (required for the `ratelimits` binding)

### 1. Set the ΓΕΜΗ API key secret

```bash
wrangler secret put GEMI_API_KEY
# paste a key here that's separate from business-mcp's — see Auth above
```

Never set this as a plain `var` — secrets aren't visible in `wrangler.toml`, dashboard config exports, or `wrangler deploy` output. Without it, `gemi_*` tool calls fail with the same actionable "no API key configured" error `GemiClient` returns everywhere else in this repo; Diavgeia/CKAN tools are unaffected.

### 2. (Optional) raise data.gov.gr's rate limit

```bash
wrangler secret put DATA_GOV_GR_TOKEN
```

Free self-service token from data.gov.gr's registration page. Skip this and CKAN tools still work, just at the default unauthenticated rate limit.

### 3. Deploy

```bash
wrangler login
pnpm run deploy
```

Deploys to `https://citizen-mcp.<your-account-subdomain>.workers.dev` (or a custom domain if configured).

## Configuration

Edit `wrangler.toml` to adjust:

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

### From claude.ai (web) as a custom connector

1. Go to **Settings → Connectors** in claude.ai.
2. Scroll to **Custom Connectors** and click **Add custom connector**.
3. Name it (e.g. `CitizenMCP`) and paste the URL: `https://citizen-mcp.nickdandis96.workers.dev`.
4. Click **Add** — no OAuth or API key prompt appears; ΓΕΜΗ's key is held server-side, same as Diavgeia/CKAN/ΚΗΜΔΗΣ needing none at all from the client's perspective.
5. In a chat, open the tools/search picker next to the message box and enable CitizenMCP's tools for that conversation.

## Architecture

- **Stateless**: Each HTTP request creates a fresh MCP server instance (no persistent sessions)
- **Transport**: `WebStandardStreamableHTTPServerTransport` (Web Standard APIs — works on any runtime: Cloudflare Workers, Node.js 18+, Deno, Bun, etc.)
- **Icon**: served at `/icon.svg` and referenced from `serverInfo.icons` per MCP's icons extension ([SEP-973](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2573))

## See Also

- [Diavgeia Client](/packages/core/src/diavgeia/), [CKAN Client](/packages/core/src/ckan/), [ΓΕΜΗ Client](/packages/core/src/gemi/), [ΚΗΜΔΗΣ Client](/packages/core/src/kimdis/) — shared client libraries
- [`@my-mcp/business-mcp`](../business-mcp) — the other half of this repo's public MCP servers
- [MCP Spec](https://spec.modelcontextprotocol.io/) — full MCP protocol documentation
