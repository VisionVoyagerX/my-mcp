# @my-mcp/bundle-transparency

MCP server for the **transparency / open-data** domain bundle of Greek
government services, per the architecture in the repo root's `CLAUDE.md`.

## What it does

Exposes read-only tools over Greece's open transparency/open-data services.
This bundle is now feature-complete for v1 scope (`PLAN.md` Phases 2-4):

- [Diavgeia](https://diavgeia.gov.gr) — public-sector decisions, decrees, and
  budget acts. No authentication required.
- [data.gov.gr](https://data.gov.gr) — the national open-data catalog
  (~22k datasets), a standard CKAN deployment. No authentication required for
  reads, but a free token raises rate limits.
- [Geodata.gov.gr](https://geodata.gov.gr) — geospatial layers (boundaries,
  land use, etc.) via WFS. No authentication required.

> **Verification status**: all three clients were built against official
> client-sample repos / documented endpoint conventions (see `CLAUDE.md` and
> `RESEARCH.md` for per-service confidence ratings — Diavgeia and CKAN are
> High confidence, Geodata is Low-Medium since its exact base URL/layer
> catalog isn't independently confirmed). Every tool has been exercised
> end-to-end with the MCP Inspector CLI in this environment: schemas are
> correct and a real call reaches the network layer, but live `.gov.gr`
> traffic is blocked from this sandbox (confirmed 403 at the proxy), so no
> real 200-response payload has been verified here — do that from an
> unrestricted network before relying on this in production.

## Tools

- `diavgeia_search_decisions` — search decisions with optional filters
  (organization, decision type, signer, date range) and pagination.
- `diavgeia_get_decision` — fetch a single decision by ADA.
- `ckan_search_datasets` — free-text search over the data.gov.gr catalog.
- `ckan_get_dataset` — fetch full metadata + resource links for a dataset.
- `geodata_list_layers` — list available Geodata.gov.gr WFS layers.
- `geodata_get_features` — fetch GeoJSON features for a layer.

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
- `DATA_GOV_GR_TOKEN` (optional) — free self-service token from
  `data.gov.gr/token`, raises CKAN rate limits. Sent as `Authorization: Token
  <id>`.
- `DATA_GOV_GR_BASE_URL` (optional) — override the CKAN API base URL.
- `GEODATA_BASE_URL` (optional) — override the Geodata WFS base URL; the
  default is an unverified best guess (see Verification status above).
