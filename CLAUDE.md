# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository is pre-implementation. It currently contains only `RESEARCH.md` — no source code, package manifest, build tooling, or tests exist yet. There are no build/lint/test commands to run because there is nothing to build yet.

## Purpose

The goal (per `RESEARCH.md`) is an MCP server exposing Greek government/public-sector APIs (gov.gr, .gr official domains) to AI agents. `RESEARCH.md` is the source of truth for which services are in scope and should be consulted before adding any new service integration or scaffolding the server.

Key points from that research to carry into implementation decisions:

- **Recommended v1 scope**, in priority order: Diavgeia (transparency/procurement decisions, no auth), data.gov.gr (CKAN open-data catalog, free token), Geodata.gov.gr (geospatial, no auth), ΓΕΜΗ open data (business registry, free API key), AADE myDATA (e-invoicing — requires the *user's own* Taxisnet subscription key, so the MCP would be a thin client rather than holding a shared credential), Ergani (labor/employment — same bring-your-own-credentials pattern).
- **Tier 3 services have no public developer API** (gov.gr Wallet, Taxisnet personal e-services, e-EFKA/ΑΜΚΑ, ΕΟΠΥΥ) and should not be integrated — only flagged as unsupported if requested.
- **Auth patterns vary by service** and should stay explicit in code rather than unified behind one abstraction: some services are fully open (Diavgeia, Geodata), some need a free self-service API key/token owned by the MCP deployment (data.gov.gr, ΓΕΜΗ), and some need per-user credentials the MCP cannot supply itself (myDATA, Ergani).
- Confidence ratings in the research table are based on search evidence, not verified live HTTP checks (this sandbox's network policy blocks outbound requests to `.gov.gr`/`.gr` domains). Before wiring up a new endpoint, do a real liveness check from an unrestricted network rather than trusting the table alone.
- The `monopigi.com` competitive note is explicitly unresolved/unverified — don't treat it as confirmed prior art.

## Working in this repo right now

Since there's no scaffolding yet, the first implementation work here will involve setting up the MCP server project structure itself (language/runtime choice, package manifest, MCP SDK dependency, per-service client modules). When that scaffolding is added, update this file with the actual build/lint/test commands and the resulting architecture.

## Merge strategy

Feature branches are squash-merged into `main` (one commit per feature/PR). This is a documentation preference, not a standing authorization — merges to `main` still require an explicit go-ahead in the conversation before they happen.
