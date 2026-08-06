# @my-mcp/business-mcp

**BusinessMCP**: A public, rate-limited Cloudflare Worker exposing Greek business/tax data — Diavgeia, ΓΕΜΗ, myDATA, and Ergani — as an MCP server.

## Overview

This package deploys the Diavgeia, ΓΕΜΗ, myDATA, and Ergani tool sets from `@my-mcp/core` to Cloudflare Workers. See also [`@my-mcp/citizen-mcp`](../citizen-mcp) for transparency/open-data tools — Diavgeia and ΓΕΜΗ are both shared between the two workers, since procurement decisions and the business registry are genuinely cross-domain.

**Live URL**: `https://business-mcp.nickdandis96.workers.dev`

**Tool set**:

- All 15 Diavgeia tools. See [`packages/core/src/diavgeia/tools.ts`](/packages/core/src/diavgeia/tools.ts).
- `gemi_search_company_by_tin`, `gemi_get_company`, `gemi_get_company_documents`, `gemi_list_metadata`. See [`packages/core/src/gemi/tools.ts`](/packages/core/src/gemi/tools.ts).
- 10 myDATA tools (request/send invoices, income/expense/VAT/E3 summaries, classifications, payment methods, cancellation) plus `mydata_connect`/`mydata_forget`. See [`packages/core/src/mydata/tools.ts`](/packages/core/src/mydata/tools.ts).
- `ergani_list_services` plus `ergani_connect`/`ergani_forget`. Read-only — Ergani's write endpoints (work-card submission, schedule declarations) aren't exposed since their exact live payload shape hasn't been confirmed. See [`packages/core/src/ergani/tools.ts`](/packages/core/src/ergani/tools.ts).

## Auth models — three different patterns on one worker

- **Diavgeia**: fully open, no key.
- **ΓΕΜΗ**: a single manually-approved `api_key` held server-side (`GEMI_API_KEY` secret), shared by every caller of this worker. ΚΥ ΓΕΜΗ caps that one key at **30 requests/minute in total** — see Rate limiting below. **This worker needs its own ΓΕΜΗ API key, separate from citizen-mcp's** — the 30 req/min cap is per key, so reusing the same key across both independently-rate-limited workers would double-book that shared quota.
- **myDATA / Ergani**: credentials belong to an individual business/employer, so there's no shared server key. Every tool accepts raw credentials (`userId`+`subscriptionKey`, or `username`+`password`) on every call — **or** you can call `mydata_connect`/`ergani_connect` once to encrypt and store them server-side (Cloudflare KV, AES-GCM), getting back an opaque `credentialToken` to pass on future calls instead. Call `mydata_forget`/`ergani_forget` to delete a stored token. If the KV/encryption-key setup below isn't done yet, connect/forget tools simply don't appear — raw-credential calls still work.

## Rate limiting — ΓΕΜΗ only

- **ΓΕΜΗ**: 30 requests per 60 seconds **globally, shared across every visitor to this worker** — not per IP, because the underlying `api_key` itself is capped that way regardless of caller. ΓΕΜΗ tool calls will 429 quickly under any real concurrent traffic; that's expected, not a bug.

Uses Cloudflare's native `ratelimit` binding (requires Wrangler v4.36.0+).

## Local Development

```bash
pnpm install
pnpm run dev   # http://localhost:8787
```

For ΓΕΜΗ/credential-storage testing locally, put secrets in a git-ignored `.dev.vars` file in this package:

```
GEMI_API_KEY=your-key-here
CREDENTIAL_ENCRYPTION_KEY=your-base64-key-here
```

## Deployment

### Prerequisites

- Cloudflare account with Workers enabled
- `wrangler` CLI authenticated with your Cloudflare credentials
- Node.js 22+ (required by Wrangler 4.x) and `wrangler` v4.36.0+ (required for the `ratelimits` binding)

### 1. Set the ΓΕΜΗ API key secret

```bash
wrangler secret put GEMI_API_KEY
# paste the key when prompted
```

Never set this as a plain `var` — secrets aren't visible in `wrangler.toml`, dashboard config exports, or `wrangler deploy` output. Without it, `gemi_*` tool calls fail with the same actionable "no API key configured" error `GemiClient` returns everywhere else in this repo; Diavgeia/myDATA/Ergani tools are unaffected.

### 2. Create the credentials KV namespace and set the encryption key

```bash
wrangler kv namespace create CREDENTIALS_KV
```

Copy the printed `id` into `wrangler.toml`'s `[[kv_namespaces]]` block (replacing the `REPLACE_WITH_REAL_KV_NAMESPACE_ID` placeholder), then:

```bash
openssl rand -base64 32 | wrangler secret put CREDENTIAL_ENCRYPTION_KEY
```

Skipping this step doesn't break the worker — `mydata_connect`/`ergani_connect`/`*_forget` just won't be registered, and raw-credential calls keep working. Rotating this key invalidates every previously-issued `credentialToken` (the encrypted blobs in KV become undecryptable) — that's an accepted trade-off, not a bug, if you ever need to rotate it.

### 3. Deploy

```bash
wrangler login
pnpm run deploy
```

Deploys to `https://business-mcp.<your-account-subdomain>.workers.dev` (or a custom domain if configured).

## Configuration

Edit `wrangler.toml` to adjust:

- **Rate limit**: `[ratelimits.simple] limit`/`period` under the `GEMI_RATE_LIMITER` `[[ratelimits]]` block. Raising it above 30/min only helps if ΚΥ ΓΕΜΗ has actually granted your key a higher quota (request that at `support@uhc.gr`) — otherwise the worker just forwards more 429s from upstream instead of serving them itself.
- **Worker name**: `name = "business-mcp"`
- **Compatibility**: `compatibility_date` if needed for specific Cloudflare API versions

## Using the Remote Server

```json
{
  "mcpServers": {
    "business-mcp": {
      "url": "https://business-mcp.nickdandis96.workers.dev"
    }
  }
}
```

### From claude.ai (web) as a custom connector

1. Go to **Settings → Connectors** in claude.ai.
2. Scroll to **Custom Connectors** and click **Add custom connector**.
3. Name it (e.g. `BusinessMCP`) and paste the URL: `https://business-mcp.nickdandis96.workers.dev`.
4. Click **Add** — no OAuth or API key prompt appears at setup time. ΓΕΜΗ's key is already held server-side; myDATA/Ergani credentials are supplied per-call (or once via `mydata_connect`/`ergani_connect`) from inside the conversation, not during connector setup.
5. In a chat, open the tools/search picker next to the message box and enable BusinessMCP's tools for that conversation.

## Architecture

- **Stateless per request**: each HTTP request creates a fresh MCP server instance — except `CREDENTIALS_KV`, which is the one piece of state this worker persists across requests/callers by design (the whole point of the connect-once flow).
- **Transport**: `WebStandardStreamableHTTPServerTransport` (Web Standard APIs — works on any runtime).
- **Credential encryption**: AES-GCM via WebCrypto (`globalThis.crypto.subtle`), implemented in `packages/core/src/credentials/` — platform-agnostic; this worker only supplies the KV-backed `CredentialStore` and the imported `CryptoKey`.
- **Icon**: served at `/icon.svg`, a briefcase glyph distinct from CitizenMCP's civic-building icon.

## See Also

- [ΓΕΜΗ Client](/packages/core/src/gemi/), [myDATA Client](/packages/core/src/mydata/), [Ergani Client](/packages/core/src/ergani/) — shared client libraries
- [Credentials module](/packages/core/src/credentials/) — the connect-once token system
- [`@my-mcp/citizen-mcp`](../citizen-mcp) — the other half of this repo's public MCP servers
- [MCP Spec](https://spec.modelcontextprotocol.io/) — full MCP protocol documentation
