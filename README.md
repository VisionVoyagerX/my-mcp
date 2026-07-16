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

## Bundles

| Package | Domain | Services | Auth |
|---|---|---|---|
| [`packages/bundle-transparency`](./packages/bundle-transparency) | Transparency / open-data | Diavgeia, data.gov.gr, Geodata.gov.gr | None required; optional free token for data.gov.gr |
| [`packages/bundle-business`](./packages/bundle-business) | Business / tax | ΓΕΜΗ, myDATA, Ergani, (+ shared Diavgeia) | ΓΕΜΗ needs a free server-side API key; myDATA/Ergani are bring-your-own-credential per call |

A service can appear in more than one bundle when it's genuinely
cross-domain — Diavgeia does, since procurement decisions matter to both
transparency and business users. That's packaging duplication only: both
bundles import the same client from `packages/core`, nothing is
reimplemented.

## Architecture

```
packages/
  core/                   shared per-service API clients + auth handling
  bundle-transparency/    thin MCP server: Diavgeia, CKAN, Geodata tools
  bundle-business/        thin MCP server: GEMI, myDATA, Ergani (+ Diavgeia) tools
```

`packages/core` holds all the actual HTTP/API integration logic and has no
`@modelcontextprotocol/sdk` dependency — it's a plain client library. Each
bundle package is a thin MCP server that imports clients from `core` and
registers only the tools relevant to its domain. See `CLAUDE.md` for the
full architecture strategy and `PLAN.md` for the phase-by-phase build log.

## Getting started

```sh
pnpm install
pnpm run build   # builds core, then both bundles (topologically ordered)
pnpm run test
pnpm run lint
pnpm run typecheck
```

Then follow the install/config instructions in whichever bundle's README you
want to use:

- [`packages/bundle-transparency/README.md`](./packages/bundle-transparency/README.md)
- [`packages/bundle-business/README.md`](./packages/bundle-business/README.md)

## Verification status

**No live `.gov.gr`/`.gr` traffic has been verified from this development
environment** — its network policy blocks all such domains at the proxy
level (confirmed via repeated 403s across every phase of `PLAN.md`). Every
client was built against the most authoritative evidence available without
live access (official documentation PDFs, maintained open-source SDKs,
indexed live call URLs) and every tool has been exercised end-to-end with
the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) CLI
in this environment — schemas are correct and calls reach the network layer
correctly, but the actual 200-response shapes are unconfirmed. **Do a real
liveness check from an unrestricted network before relying on this in
production.** Per-service confidence ratings are in
[`RESEARCH.md`](./RESEARCH.md); per-phase verification notes are in
[`PLAN.md`](./PLAN.md).

## Publishing

Packages are currently `"private": true` and unpublished. Before publishing
to npm: pick a real license (currently `UNLICENSED` as a placeholder),
confirm package names/scopes, and complete the live-verification pass above.
