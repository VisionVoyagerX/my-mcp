# @my-mcp/bundle-transparency

MCP server for the **transparency / open-data** domain bundle of Greek
government services, per the architecture in the repo root's `CLAUDE.md`.

## What it does

Exposes read-only tools over [Diavgeia](https://diavgeia.gov.gr), the Greek
government transparency portal: search public-sector decisions, decrees, and
budget acts, and fetch a specific decision by its ADA. No authentication is
required — Diavgeia's OpenData API is fully public.

data.gov.gr and Geodata.gov.gr tools are planned for this bundle (see
`PLAN.md` Phases 3-4) but not yet implemented.

> **Verification status**: this server's request/response handling was built
> against Diavgeia's official client-sample repos and documented endpoint
> shapes, and has been exercised end-to-end with the MCP Inspector CLI in
> this environment. Live `.gov.gr` traffic is blocked from this sandbox
> (confirmed 403 at the proxy), so a real 200-response payload has **not**
> been verified here — do that from an unrestricted network before relying
> on this in production, per `CLAUDE.md`.

## Tools

- `diavgeia_search_decisions` — search decisions with optional filters
  (organization, decision type, signer, date range) and pagination.
- `diavgeia_get_decision` — fetch a single decision by ADA.

## Install / configure

Build the workspace first (from the repo root):

```sh
pnpm install
pnpm run build
```

Then point an MCP client at the built server:

```json
{
  "mcpServers": {
    "greek-gov-transparency": {
      "command": "node",
      "args": ["/absolute/path/to/my-mcp/packages/bundle-transparency/dist/index.js"]
    }
  }
}
```

### Configuration

- `DIAVGEIA_BASE_URL` (optional) — override the Diavgeia API base URL, e.g.
  to point at the `test3.diavgeia.gov.gr` sandbox instead of production.
