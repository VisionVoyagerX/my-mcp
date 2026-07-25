# @my-mcp/bundle-business

MCP server for the **business / tax** domain bundle of Greek government
services, per the architecture in the repo root's `CLAUDE.md`.

## What it does

Exposes tools over three business/tax services, per `PLAN.md` Phases 5-7:

- **ΓΕΜΗ** (General Commercial Registry) — look up a Greek company by tax ID
  (ΑΦΜ) or by its ΓΕΜΗ registration number, fetch its public documents
  (decisions/gazette publications), and browse ΓΕΜΗ's reference code lists
  (activities, prefectures, municipalities, statuses, legal types, offices,
  assembly subjects). Server-side API key (`GEMI_API_KEY`).
- **myDATA** (AADE e-invoicing) — fetch e-invoices for a business. **Bring
  your own credentials**: myDATA subscription keys belong to an individual
  business's Taxisnet registration, so this server never holds one —
  `userId`/`subscriptionKey` are passed as tool arguments on every call, not
  server config.
- **Ergani** (labor/employment) — list the Ergani web services available to
  your account. **Bring your own credentials**, same pattern as myDATA
  (`username`/`password` as tool arguments). Deliberately **read-only**:
  Ergani's write endpoints (work-card submission, overtime/schedule
  declarations) are real filings to the labor ministry, and only their URL
  paths — not their request payload schemas — could be confirmed, so they
  aren't exposed as tools yet.
- **Diavgeia** — search/fetch public-sector decisions, re-exposed from
  `bundle-transparency` since procurement/contract-award decisions matter
  to business users too (e.g. checking a counterparty's public contracts).
  This is the same `@my-mcp/core` client both bundles share, not a
  reimplementation — see `CLAUDE.md`'s cross-domain note. No auth required.

> **Verification status**: ΓΕΜΗ's client is built directly against the
> official Swagger 2.0 spec, fetched live 2026-07-25 from
> `https://opendata-api.businessportal.gr/api-docs` (the interactive docs
> page is a JS-rendered Swagger UI shell; the actual spec URL is only
> discoverable via the `Swagger-API-Docs-URL` response header on a HEAD
> request to that page). All 12 endpoints in the spec are catalogued; 4 are
> implemented as tools (company lookup, company search, company documents,
> metadata/reference lists) — `downloadFile` (binary file attachment) and
> `health` (ops-only) are deliberately not exposed as tools. Response field
> names come straight from the spec's `definitions`, cross-checked against
> github.com/firebed/vat-registry (a maintained open-source client) for the
> base URL/auth pattern. myDATA's `RequestDocs` endpoint, headers, and query params are
> confirmed against AADE's official API documentation PDFs; its response is
> raw XML, returned as-is (not parsed) since the invoice XSD is large and
> out of scope for v1. Ergani's authentication flow and `ServicesList`
> endpoint are confirmed against github.com/withlogicco/ergani-python-sdk.
> This sandbox cannot reach `.gov.gr`/`.gr` domains at all (confirmed 403 at
> the proxy), so no live response has been verified for any of the three —
> do that from an unrestricted network before relying on this in
> production, per `CLAUDE.md`.

## Tools

- `gemi_search_company_by_tin` — look up companies by ΑΦΜ.
- `gemi_get_company` — fetch full details by ΓΕΜΗ registration number.
- `gemi_get_company_documents` — fetch a company's public documents
  (assembly/board decisions, gazette publications) by ΓΕΜΗ registration
  number.
- `gemi_list_metadata` — browse ΓΕΜΗ's reference code lists (activities,
  prefectures, municipalities, business statuses, legal types, ΓΕΜΗ
  offices, assembly subjects).
- `mydata_request_docs` — fetch e-invoices (raw XML) for a date range/
  counterparty, using your own myDATA credentials.
- `ergani_list_services` — list Ergani services available to your account,
  using your own Ergani credentials.
- `diavgeia_search_decisions` / `diavgeia_get_decision` — search and fetch
  Diavgeia public-sector decisions (shared with `bundle-transparency`).

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
      "args": [
        "/absolute/path/to/my-mcp/packages/bundle-business/dist/index.js"
      ],
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
- `MYDATA_BASE_URL` (optional) — override the myDATA API base URL, e.g. to
  point at AADE's dev/sandbox environment instead of production.
- `DIAVGEIA_BASE_URL` (optional) — override the Diavgeia API base URL, e.g.
  to point at the `test3.diavgeia.gov.gr` sandbox instead of production.
- `ERGANI_BASE_URL` (optional) — override the Ergani API base URL; defaults
  to the `trialeservices.yeka.gr` sandbox rather than production, since
  production credentials are a much higher-stakes thing to point an
  unverified client at.

myDATA and Ergani take no server-side credentials — pass your own
`userId`/`subscriptionKey` (myDATA) or `username`/`password` (Ergani) as
arguments to the relevant tool call.
