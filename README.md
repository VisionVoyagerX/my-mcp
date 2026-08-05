# my-mcp

MCP servers exposing Greek government/public-sector APIs (gov.gr and other
official `.gr` domains) to AI agents.

## Why bundles, not one server

This repo does **not** ship a single MCP server exposing every Greek gov
service, and does **not** ship one server per service either. Instead, it
ships multiple MCP servers, each bundling the services for one **data
domain** — see [`CLAUDE.md`](./CLAUDE.md) for the full rationale (a single
server loads every tool's schema into every user's context regardless of
relevance; one server per service creates setup friction disproportionate to
how few tools each service exposes).

Users compose bundles themselves: install whichever domain bundles you need,
not a persona-shaped combination someone else picked for you.

## Servers

Exactly two, both public Cloudflare Workers — no local install or stdio
process required.

| Server                                                               | Domain                   | Services                                  | Auth                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/citizen-mcp`](./packages/citizen-mcp) — **CitizenMCP**    | Transparency / open-data | Diavgeia, data.gov.gr                     | None required; optional free token for data.gov.gr                                                                                                          |
| [`packages/business-mcp`](./packages/business-mcp) — **BusinessMCP** | Business / tax           | ΓΕΜΗ, myDATA, Ergani, (+ shared Diavgeia) | ΓΕΜΗ needs a free server-side API key; myDATA/Ergani are bring-your-own-credential, with an optional connect-once token so you don't resend them every call |

"CitizenMCP" and "BusinessMCP" are product names for the same two domain
groupings this repo has always used — not a persona-based redesign. A
service can appear in more than one when it's genuinely cross-domain —
Diavgeia does, since procurement decisions matter to both. That's packaging
duplication only: both workers import the same client from `packages/core`,
nothing is reimplemented.

## Architecture

```
packages/
  core/            shared per-service API clients, MCP tool registration,
                    and auth handling (including the credentials/ module
                    used by BusinessMCP's connect-once token system)
  citizen-mcp/      Cloudflare Worker: Diavgeia, CKAN tools
  business-mcp/     Cloudflare Worker: Diavgeia, GEMI, myDATA, Ergani tools
```

`packages/core` holds all the actual HTTP/API integration logic _and_ the
`server.registerTool(...)` MCP wiring for every service — it does depend on
`@modelcontextprotocol/sdk`, unlike a plain client library, precisely so
that tool logic is shared instead of duplicated across workers. Each worker
package is a thin Cloudflare Worker (`src/worker.ts`) that imports
`registerXTools` functions from `core`, wires up its own auth/rate-limiting
bindings, and registers only the tools relevant to its domain. See
`CLAUDE.md` for the full architecture strategy.

## Live servers

```
https://citizen-mcp.nickdandis96.workers.dev
https://business-mcp.nickdandis96.workers.dev
```

See each package's README for its exact tool list, rate limits, and how to
point an MCP client at it:

- [`packages/citizen-mcp/README.md`](./packages/citizen-mcp/README.md)
- [`packages/business-mcp/README.md`](./packages/business-mcp/README.md)

## Connecting from claude.ai (web)

Both servers work as **custom connectors** in the claude.ai web app — no
local install, no OAuth:

1. **Settings → Connectors → Add custom connector** in claude.ai.
2. Give it a name and paste the live URL (`https://citizen-mcp.nickdandis96.workers.dev`
   or `https://business-mcp.nickdandis96.workers.dev`).
3. Click **Add**. Neither server requires an OAuth or API-key step at
   connector setup — CitizenMCP is fully open, and BusinessMCP's ΓΕΜΗ key is
   held server-side (myDATA/Ergani credentials are supplied from within the
   conversation instead, per-call or via `mydata_connect`/`ergani_connect`).
4. In a chat, open the tools/search picker next to the message box and
   enable the connector's tools for that conversation.

Repeat for the other bundle if you want both installed. See each package's
README (linked above) for the exact steps with that server's URL.

## Getting started

```sh
pnpm install
pnpm run build   # builds core, then both workers (topologically ordered)
pnpm run test
pnpm run lint
pnpm run typecheck
```

Cloudflare Workers commands (`wrangler dev`/`deploy`) require Node.js 22+;
the rest of the repo works on Node 20+. See each worker's README for local
dev and deployment instructions, including BusinessMCP's KV namespace and
secret setup.

## Verification status

Diavgeia, ΓΕΜΗ, and data.gov.gr have been verified live end-to-end: direct
calls to their production APIs, and real tool calls through the deployed
Cloudflare Workers, all return real 200 responses. myDATA's credential-token
wiring is verified live (a real request with dummy credentials returns a
genuine 403 from AADE, proving the encrypt/store/resolve/call path works)
but hasn't been exercised with real credentials. Ergani hasn't been
exercised live at all — do a real liveness check before relying on either
in production. Per-service confidence ratings are in
[`RESEARCH.md`](./RESEARCH.md).

## Publishing

Packages are currently `"private": true` and unpublished — both are
deployed as Cloudflare Workers rather than published to npm, so this
mostly applies to `packages/core` if it's ever split out for reuse. Before
publishing anything to npm: pick a real license (currently `UNLICENSED` as
a placeholder), confirm package names/scopes, and complete the
live-verification pass above.
