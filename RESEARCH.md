# Greek Gov Services — API Research

Methodology: cross-checked each service against its official `.gov.gr`/`.gr` domain, official docs/PDFs, GitHub Swagger pages, and existing maintained SDKs. **Note**: this sandbox's network policy blocks outbound HTTP to these domains (proxy returns 403 on CONNECT, confirmed even for plain Wikipedia), so I could not personally curl live status codes. Verification was done via repeated, targeted web searches instead — each row below has a Confidence rating based on how directly the search evidence pointed at a live endpoint (e.g. Google having indexed an actual API call URL with real parameters is strong evidence the endpoint is live and responds; a generic docs page describing the service is weaker). Recommend a real HTTP liveness check from an unrestricted machine before building.

## Tier 1 — Public, open, no special registration needed

| Service | Org | Base URL | Auth | Confidence | Notes |
|---|---|---|---|---|---|
| Diavgeia (Transparency decisions) | Presidency of Gov't | `diavgeia.gov.gr/luminapi/api/` | None for reads | **High** — Google has indexed actual live API call URLs with real query params (e.g. `luminapi/api/search/export?q=organizationUid:"52642"&sort=recent&wt=xls`) returning content, plus official `github.com/diavgeia/opendata-client-samples-{java,python,php}` repos | Search/fetch all public sector decisions, decrees, budget acts. JSON/XML by appending `.json`/`.xml`. Mature, ~15yr old. |
| National Open Data Portal | Min. Digital Governance | `data.gov.gr/api/3/action/` | Token (free, self-service at `data.gov.gr/token`) | **High** — registration flow and token-header format (`Authorization: Token token_id`) independently confirmed in a Greek tutorial blog and the official token page | CKAN standard API — `package_search`, `package_show`, etc. ~22k datasets. |
| ΓΕΜΗ Business Registry Open Data | GG Emporiou / KEEE | `opendata-api.businessportal.gr/opendata/docs/` (Swagger UI) | Free `api_key`, apply at `opendata.businessportal.gr/register/` | **High** — dedicated register page, tech-docs page (`/techdocs/`), and a documented test key (`api-docs-key`) all confirmed | Company name, GEMI no., legal form, status, directors. |
| Geodata.gov.gr | Min. Digital Governance | likely `geodata.gov.gr/geoserver/ows` (WMS/WFS) | None | **Low-Medium** — service description and INSPIRE/WMS+WFS claims corroborated by multiple aggregator listings, but I could not re-confirm the exact live endpoint path this round | Geospatial data (maps, boundaries, land use). Verify exact path before integrating. |
| Hellenic Cadastre Open Data | Ktimatologio S.A. | `data.ktimatologio.gr` + `github.com/Ktimatologio/opendata` | None for open datasets | **Medium** — official GitHub org repo exists and is named for this purpose; portal page description consistent across sources | DKAN-based portal, cadastral open datasets. Distinct from the paid parcel-lookup e-service. |
| Bank of Greece Open Data | Bank of Greece | `opendata.bankofgreece.gr` | None | **Medium** — domain and purpose repeated consistently, not independently deep-checked | Monetary/financial statistics. |

## Tier 2 — Real APIs, but gated behind business/professional registration

| Service | Org | Base URL | Auth | Confidence | Notes |
|---|---|---|---|---|---|
| myDATA (e-Books/e-Invoicing) | AADE | production + `mydataapidev.aade.gr` (sandbox) | Taxisnet user + subscription key (headers) | **High** — official dated PDFs hosted directly on `aade.gr` (v1.0.6 eng, v1.0.8, v1.0.9 as of Oct 2024), separate dev-registration site, maintained community SDKs in Go/PHP | REST API for sending/cancelling invoices, mandatory for Greek businesses. Biggest single integration target. |
| Ergani (labor/employment) | Min. Labour | `eservices.yeka.gr/WebservicesAPIUI/` | Employer/software-house credentials | **Medium-High** — official eservices.yeka.gr portal + actively maintained Python and Rust SDKs (withlogicco, pavlospt) both targeting a `trialeservices.yeka.gr/WebServicesAPI/api` sandbox base URL | Digital work card, hiring/termination declarations, working-time schedules. |
| e-Prescription pharmacy interoperability API | ΗΔΙΚΑ (health) | `e-prescription.gr` partner API | Restricted to registered pharmacy-software vendors | **Medium** — ΗΔΙΚΑ press release specifically describes presenting a new pharmacy interoperability API mechanism | Not open to arbitrary developers — requires vendor onboarding with ΗΔΙΚΑ. |
| ΚΕΔ Interoperability Center (~180 web services, 550 methods) | GSIS / Min. Digital Gov. | catalog at `gsis.gr/wsregistry` | Taxisnet creds of a **public body**, per-service approval | **Medium** — official gsis.gr pages describe the catalog and service counts consistently | B2G only — access to ΑΦΜ registry, cadastre queries etc., but only for other government/authorized entities, not general public developers. |

## Tier 3 — No public developer API (portal/app only — exclude from v1)

| Service | Why excluded |
|---|---|
| gov.gr Wallet (digital ID/driving license) | Mobile-app + OpenID4VCI issuance flow for verified relying parties only; no open developer API found. |
| Taxisnet personal e-services | Login-only web portal for citizens; no public REST API. |
| e-EFKA / ΑΜΚΑ citizen portal | Authenticated via Taxisnet; no public API, only web forms (`amka.gr`, `atlas.gov.gr`). |
| ΕΟΠΥΥ citizen e-services | Portal login only; programmatic access only via the restricted ΗΔΙΚΑ vendor API above. |
| EU VIES VAT validation | Not Greek-specific — it's an EU Commission SOAP service Greece participates in (`ec.europa.eu/taxation_customs/vies`). Useful as a companion tool, not "Greek gov" per se. |

## Competitive note (contradictory evidence — unresolved)
Multiple independent web searches return rich, specific, consistent detail for a product called **Monopigi** (`monopigi.com`): "One API — All Greek Government Data," ~31M decisions ingested, EU procurement + energy permits + open data, REST API + Python SDK + CLI, MCP support for AI agents, hosted on Scaleway/Paris, GDPR-native. That level of specific, repeated detail normally indicates a real, crawled, live page. However, the user directly reports the link does not resolve for them. This sandbox cannot fetch the URL directly to settle it (outbound HTTP is blocked here). Possible explanations: the site went down/moved after being indexed, it's geo-restricted, or it's a pre-launch SEO page. **Do not treat this as confirmed** — check `monopigi.com` yourself from a normal browser/network before drawing conclusions either way.

## Recommended v1 MCP scope (highest value, lowest friction)
1. Diavgeia — open reads, zero friction, rich data (transparency/procurement/decisions)
2. data.gov.gr — open catalog, broad coverage
3. Geodata.gov.gr — open geospatial
4. ΓΕΜΗ open data — free key, business lookups
5. AADE myDATA — highest business value, but requires user's own Taxisnet subscription key (MCP would be a thin client, not a shared-key service)
6. Ergani — same pattern as myDATA (bring-your-own credentials)

Everything in Tier 3 should be dropped or explicitly flagged as "not integrable via public API."
