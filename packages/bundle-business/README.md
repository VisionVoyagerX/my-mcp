# @my-mcp/bundle-business

MCP server for the **business / tax** domain bundle of Greek government
services, per the architecture in the repo root's `CLAUDE.md`.

## What it does

Exposes tools over ΓΕΜΗ (the General Commercial Registry) open data: look up
a Greek company by tax ID (ΑΦΜ) or by its ΓΕΜΗ registration number.

myDATA (AADE e-invoicing) and Ergani (labor/employment) tools are planned
for this bundle (see `PLAN.md` Phases 6-7) but not yet implemented.

> **Verification status**: the client is built against
> github.com/firebed/vat-registry, a maintained open-source client, which
> confirms the base URL, endpoint paths, and `api_key` header — but no
> evidence of the actual company-record field names was found (the official
> Swagger docs returned 403 to automated fetches from this environment), so
> tool output is the raw JSON response rather than a hand-picked field
> summary. This sandbox cannot reach `.gov.gr`/`.gr` domains at all
> (confirmed 403 at the proxy), so no live response has been verified —
> do that from an unrestricted network before relying on this in
> production, per `CLAUDE.md`.

## Tools

- `gemi_search_company_by_tin` — look up companies by ΑΦΜ.
- `gemi_get_company` — fetch full details by ΓΕΜΗ registration number.

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
    "greek-gov-business": {
      "command": "node",
      "args": ["/absolute/path/to/my-mcp/packages/bundle-business/dist/index.js"],
      "env": {
        "GEMI_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Configuration

- `GEMI_API_KEY` (**required**) — free self-service key from
  `opendata.businessportal.gr/register`. Without it, the GEMI tools return
  an actionable configuration error instead of calling the API. The Swagger
  docs page also lists a limited test key, `api-docs-key`.
- `GEMI_BASE_URL` (optional) — override the GEMI API base URL.
