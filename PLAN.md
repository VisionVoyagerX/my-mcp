# Implementation Plan

This is the step-by-step build plan for the Greek gov-services MCP project. It
follows the domain-bundle architecture in `CLAUDE.md` (shared core library +
one thin MCP server per domain bundle, never a single monolith and never
one server per service) and the scope/auth notes in `RESEARCH.md`.

**Ground rule: one chunk at a time.** Each chunk below is a self-contained,
reviewable unit — implement it, verify it actually works (liveness-check the
real endpoint, not just typecheck), then stop and check in before starting the
next chunk. Do not batch multiple chunks into one pass.

Tool-design choices in every chunk follow Anthropic's `mcp-builder` guidance:
small, verb-named tools with rich descriptions and examples in their schema,
concise/structured output (not raw API payloads dumped at the model), explicit
pagination for list endpoints, and actionable error messages — evaluated by
actually calling the tool with a realistic prompt, not just by type-checking.

## Phase 0 — Repo scaffolding

- [x] 0.1 Choose runtime/tooling: Node/TypeScript + `@modelcontextprotocol/sdk`,
      pnpm workspaces monorepo, `vitest` for tests, `eslint`/`prettier`.
      (Rationale: best MCP SDK maturity/docs, and a single `fetch`-based HTTP
      client style suits all these REST/CKAN-style gov APIs.) TypeScript pinned
      to 5.9.3 rather than the 7.0.2 `latest` tag — `typescript-eslint` 8.64.0
      doesn't support the TS 7 line yet.
- [x] 0.2 Create workspace skeleton only — no service logic yet:
      `packages/core`, `packages/bundle-transparency`, `packages/bundle-business`,
      root `package.json`, `tsconfig.json`, CI config (lint + test on push).
- [x] 0.3 Add a minimal "hello world" MCP server in `bundle-transparency` with
      one placeholder tool, wired up end-to-end and confirmed to load in an
      MCP client (e.g. MCP Inspector). Proves the scaffolding before any real
      API work starts. Verified with `@modelcontextprotocol/inspector --cli`:
      `tools/list` shows the `ping` tool and `tools/call` round-trips correctly.

## Phase 1 — Core library, first client (Diavgeia)

- [x] 1.1 `packages/core`: shared HTTP client wrapper (fetch + timeout + error
      normalization) and shared types. No auth logic yet — Diavgeia is open.
- [x] 1.2 Diavgeia client: search decisions + get decision by ADA. **Live
      liveness check NOT done** — this sandbox's proxy hard-blocks all
      `.gov.gr` CONNECT attempts at the policy level (confirmed via
      `$HTTPS_PROXY/__agentproxy/status`), so this must happen from an
      unrestricted network before trusting the request/response shapes.
      Client built against the official client-sample repos
      (github.com/diavgeia/opendata-client-samples-*) and indexed live call
      URLs; response schemas use lenient/passthrough parsing so a shape
      drift degrades to "missing field" rather than a crash.
- [x] 1.3 Unit tests for the Diavgeia client against recorded fixtures.

## Phase 2 — Transparency bundle v1 (Diavgeia only)

- [x] 2.1 Expose `diavgeia_search_decisions` and `diavgeia_get_decision` tools
      in `bundle-transparency`, replacing the placeholder from 0.3.
- [x] 2.2 Write tool descriptions/schemas and hand-test with real prompts in
      an MCP client — confirm the model actually picks and uses them
      correctly, not just that they typecheck. Verified via
      `@modelcontextprotocol/inspector --cli`: `tools/list` shows both tools
      with correct schemas, and `tools/call` on `diavgeia_get_decision`
      round-trips through the real HTTP call, hits the blocked network, and
      surfaces a clean actionable `GovApiError` instead of crashing —
      confirms the full wiring except the live 200-response shape.
- [x] 2.3 README for the bundle: what it does, install/config snippet for
      Claude Desktop / Claude Code.

## Phase 3 — Add data.gov.gr (CKAN) to transparency bundle

- [ ] 3.1 Core: CKAN client (dataset search, dataset detail). Needs the free
      token — add a small, explicit config/env-var pattern in core (not a
      generic "auth abstraction").
- [ ] 3.2 Liveness-check the real CKAN endpoints, then add
      `ckan_search_datasets` / `ckan_get_dataset` tools to the bundle.
- [ ] 3.3 Tests + README update.

## Phase 4 — Add Geodata.gov.gr, close out transparency bundle v1

- [ ] 4.1 Core: Geodata client (no auth, like Diavgeia).
- [ ] 4.2 Liveness-check, then add its tool(s) to the bundle.
- [ ] 4.3 Tests + README update. Transparency bundle is now feature-complete
      for v1 scope.

## Phase 5 — Business bundle v1, first service (ΓΕΜΗ)

- [ ] 5.1 New `packages/bundle-business` package (same scaffolding pattern as
      Phase 0.3, using the now-proven approach).
- [ ] 5.2 Core: ΓΕΜΗ client (free self-service API key — same explicit
      config pattern as data.gov.gr).
- [ ] 5.3 Liveness-check, then add ΓΕΜΗ lookup tool(s). Tests + README.

## Phase 6 — Business bundle: myDATA

- [ ] 6.1 Core: myDATA client. This is bring-your-own-Taxisnet-credential —
      design the tool so the caller supplies their own key per call/session
      rather than the MCP holding a shared credential (per `CLAUDE.md`).
- [ ] 6.2 Liveness-check (or sandboxed test account if available), then add
      tool(s). Tests + README, including a clear note on what credential the
      user must supply and how.

## Phase 7 — Business bundle: Ergani

- [ ] 7.1 Same bring-your-own-credential pattern as Phase 6, applied to
      Ergani's labor/employment endpoints.
- [ ] 7.2 Liveness-check, tools, tests, README. Business bundle is now
      feature-complete for v1 scope.

## Phase 8 — Cross-bundle sharing pass

- [ ] 8.1 Revisit whether any service belongs in more than one bundle (e.g.
      Diavgeia procurement decisions inside the business bundle too, per the
      cross-domain note in `CLAUDE.md`). Where it does, re-export the
      existing core client into the second bundle — do not reimplement it.

## Phase 9 — Hardening

- [ ] 9.1 Consistent error handling/messages across all tools (actionable,
      not raw stack traces or raw HTTP errors).
- [ ] 9.2 Rate-limit/backoff handling in the shared core HTTP wrapper.
- [ ] 9.3 End-to-end pass: re-run every tool against live endpoints, confirm
      nothing drifted since its liveness check.

## Phase 10 — Packaging & distribution

- [ ] 10.1 Per-bundle `package.json` metadata, versioning, publish config.
- [ ] 10.2 Root README: what bundles exist, why bundles (link to `CLAUDE.md`),
      install instructions per bundle.

## Later / not yet scoped

- Health bundle (e.g. ΙΔΙΚΑ) — start only once a viable public API is
  confirmed; kept as its own bundle from day one so it never pulls in
  business/tax tools for a user who only needs health data.
- Any Tier 3 service (gov.gr Wallet, Taxisnet personal e-services, e-EFKA/ΑΜΚΑ,
  ΕΟΠΥΥ) — out of scope per `RESEARCH.md` unless a public developer API
  later appears.
