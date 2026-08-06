# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

A pnpm workspaces monorepo with `packages/core` (shared library with HTTP client, per-service client implementations, and MCP tool registration for every service) and exactly two public MCP servers, both Cloudflare Workers: `packages/citizen-mcp` (Diavgeia and CKAN/data.gov.gr, no auth needed; plus ΓΕΜΗ, which needs its own server-side API key) and `packages/business-mcp` (Diavgeia, ΓΕΜΗ, myDATA, Ergani). ΓΕΜΗ is cross-listed in both bundles like Diavgeia, but each worker holds a *separate* `GEMI_API_KEY` — ΚΥ ΓΕΜΗ's 30 req/min cap is per key, so the two workers can't share one without double-booking that quota. There is no local/stdio distribution mode — both packages are Worker-only, matching the pattern the earlier `worker-greekgov` package proved out before being superseded by this two-worker split. `packages/business-mcp` additionally implements a connect-once credential-token system (`packages/core/src/credentials/`) for myDATA/Ergani, since those need per-caller credentials rather than one shared server key like ΓΕΜΗ.

### Build/lint/test commands

Run from the repo root (requires `pnpm`):

- `pnpm install` — install all workspace dependencies
- `pnpm run build` — build every package (`tsc`), topologically ordered so `core` builds before the bundles that depend on it
- `pnpm run typecheck` — typecheck every package with `tsc --noEmit`
- `pnpm run lint` — `eslint .` across the whole repo (flat config in `eslint.config.js`, typescript-eslint + eslint-config-prettier)
- `pnpm run format` — `prettier --write .`
- `pnpm run test` — run each package's `vitest` suite
- Per-package: `pnpm --filter @my-mcp/<pkg> <script>` (e.g. `pnpm --filter @my-mcp/citizen-mcp run build`)
- Manually exercise a worker locally: `pnpm --filter @my-mcp/citizen-mcp run dev` (needs Node 22+ for `wrangler`; use `nvm use` if the default Node is older) starts it on `http://localhost:8787`, then either drive it with the MCP Inspector CLI (`npx @modelcontextprotocol/inspector --cli http://localhost:8787 --method tools/list`) or `curl` the Streamable HTTP endpoint directly (`POST /` with a JSON-RPC body, `Accept: application/json, text/event-stream`)

TypeScript is pinned to `^5.9.3`, not the `latest` npm dist-tag (currently 7.0.2) — `typescript-eslint` doesn't support the TS 7 line yet. Re-evaluate this pin once the lint tooling catches up.

## Purpose

The goal (per `RESEARCH.md`) is an MCP server exposing Greek government/public-sector APIs (gov.gr, .gr official domains) to AI agents. `RESEARCH.md` is the source of truth for which services are in scope and should be consulted before adding any new service integration or scaffolding the server.

Key points from that research to carry into implementation decisions:

- **Recommended v1 scope**, in priority order: Diavgeia (transparency/procurement decisions, no auth), data.gov.gr (CKAN open-data catalog, free token), ΓΕΜΗ open data (business registry, free API key), AADE myDATA (e-invoicing — requires the _user's own_ Taxisnet subscription key, so the MCP would be a thin client rather than holding a shared credential), Ergani (labor/employment — same bring-your-own-credentials pattern). Geodata.gov.gr was in this list originally but was dropped 2026-08-04 — see the RESEARCH.md Tier 1 note.
- **Tier 3 services have no public developer API** (gov.gr Wallet, Taxisnet personal e-services, e-EFKA/ΑΜΚΑ, ΕΟΠΥΥ) and should not be integrated — only flagged as unsupported if requested.
- **Auth patterns vary by service** and should stay explicit in code rather than unified behind one abstraction: some services are fully open (Diavgeia), some need a free self-service API key/token owned by the MCP deployment (data.gov.gr, ΓΕΜΗ), and some need per-user credentials the MCP cannot supply itself (myDATA, Ergani).
- Confidence ratings in the research table are based on search evidence, not verified live HTTP checks (this sandbox's network policy blocks outbound requests to `.gov.gr`/`.gr` domains). Before wiring up a new endpoint, do a real liveness check from an unrestricted network rather than trusting the table alone.
- The `monopigi.com` competitive note is explicitly unresolved/unverified — don't treat it as confirmed prior art.

## Architecture strategy: domain bundles, not one monolith and not one-per-service

We are not shipping a single MCP server exposing every Greek gov service, and not shipping one MCP server per service. Instead: multiple MCP servers, each bundling the services for one **data domain**.

- **Split axis is domain (what the data is about), never persona (who uses it).** Personas overlap endlessly (a researcher, an accountant, and a journalist might all want business data) so persona-based bundles never converge on clean boundaries. Domains don't overlap this way. "CitizenMCP" and "BusinessMCP" are product names for these same two domain groupings (transparency/open-data, business/tax) — not a persona-based redesign. A researcher who wants business data installs BusinessMCP same as an accountant would; the naming is just friendlier than "bundle-transparency"/"bundle-business" was, the domain boundary underneath is unchanged.
- **Bundles** (may grow as `RESEARCH.md` scope grows):
  - `citizen-mcp` — transparency/open-data: Diavgeia, data.gov.gr (+ shared ΓΕΜΗ)
  - `business-mcp` — business/tax: ΓΕΜΗ, myDATA, Ergani (+ shared Diavgeia)
  - Health: reserved for if/when a viable service appears (e.g. ΙΔΙΚΑ) — kept separate so installing it never pulls in business/tax tools
- **Users compose bundles themselves.** A researcher who also wants business data installs the open-data bundle _and_ the business bundle — we don't build a combined "researcher" bundle.
- **A service can appear in more than one bundle** if it's genuinely cross-domain (e.g. Diavgeia's procurement decisions matter to both the transparency and business bundles; ΓΕΜΗ's business registry data is likewise public open data that also matters to business/tax use cases). Duplication at the packaging level is fine; it's just re-exposing the same client, not reimplementing it. Where the service needs its own server-held credential (ΓΕΜΗ's `GEMI_API_KEY`), each bundle provisions a *separate* key/secret rather than sharing one — see the ΓΕΜΗ rate-limit note in Project state above.
- **Code is shared, packaging is not**: one core library holds the per-service clients and auth handling; each bundle is a thin server package that imports from core and exposes only its domain's tools. Auth patterns stay explicit per service inside that shared core (see above), not unified behind one abstraction.
- **Why not the alternatives**: a single server loads every tool's schema into every user's context regardless of relevance, which both hurts tool-selection performance and is confusing for users who only need one domain. One server per service creates setup friction disproportionate to how few tools each service exposes (e.g. Diavgeia alone might only need a handful of endpoints).

## Working in this repo right now

Follow `PLAN.md`'s phases in order, one chunk at a time: implement, verify it actually works (build + lint + typecheck + a real MCP Inspector call, and for any live API a liveness check from an unrestricted network per the confidence-rating caveat above), then check in before starting the next chunk. Current state: Phase 0 (scaffolding) is done; Phase 1 (core HTTP client + Diavgeia client) is next.

## Merge strategy

Feature branches are squash-merged into `main` (one commit per feature/PR). This is a documentation preference, not a standing authorization — merges to `main` still require an explicit go-ahead in the conversation before they happen.
