# Greek Gov Services — API Research

Methodology: cross-checked each service against its official `.gov.gr`/`.gr` domain, official docs/PDFs, GitHub Swagger pages, and existing maintained SDKs. **Note**: this sandbox's network policy blocks outbound HTTP to these domains (proxy returns 403 on CONNECT), so I could not personally curl live status codes — verification below is via multiple corroborating sources (official docs, dated technical specs, active third-party SDKs), not a live ping. Recommend a real HTTP liveness check from an unrestricted machine before building.

## Tier 1 — Public, open, no special registration needed

| Service | Org | Base URL | Auth | Notes |
|---|---|---|---|---|
| Diavgeia (Transparency decisions) | Presidency of Gov't | `diavgeia.gov.gr/luminapi/api/` | None for reads | Search/fetch all public sector decisions, decrees, budget acts. JSON/XML. Mature, ~15yr old. |
| National Open Data Portal | Min. Digital Governance | `data.gov.gr/api/3/action/` | Token (free, self-service at `/token`) | CKAN standard API — `package_search`, `package_show`, etc. ~22k datasets. |
| Geodata.gov.gr | Min. Digital Governance | `geodata.gov.gr/geoserver/ows` | None | Standard WMS/WFS/INSPIRE geospatial services (maps, boundaries, land use). |
| Hellenic Cadastre Open Data | Ktimatologio S.A. | `data.ktimatologio.gr` + `github.com/Ktimatologio/opendata` | None for open datasets | DKAN-based portal, cadastral open datasets. Distinct from the paid parcel-lookup e-service. |
| Bank of Greece Open Data | Bank of Greece | `opendata.bankofgreece.gr` | None | Monetary/financial statistics. |

## Tier 2 — Real APIs, but gated behind business/professional registration

| Service | Org | Base URL | Auth | Notes |
|---|---|---|---|---|
| myDATA (e-Books/e-Invoicing) | AADE | production + `mydataapidev.aade.gr` (sandbox) | Taxisnet user + subscription key (headers) | REST API for sending/cancelling invoices, mandatory for Greek businesses. Well-documented (v1.0.8 PDF, Feb 2025). Biggest single integration target. |
| ΓΕΜΗ Business Registry Open Data | GG Emporiou / KEEE | `opendata-api.businessportal.gr/opendata/docs/` (Swagger) | Free `api_key` via registration form | Company name, GEMI no., legal form, status, directors. |
| Ergani (labor/employment) | Min. Labour | `eservices.yeka.gr/WebservicesAPIUI/` | Employer/software-house credentials | Digital work card, hiring/termination declarations, working-time schedules. Community Python/Rust SDKs exist and are maintained. |
| e-Prescription pharmacy interoperability API | ΗΔΙΚΑ (health) | `e-prescription.gr` partner API | Restricted to registered pharmacy-software vendors | Not open to arbitrary developers — requires vendor onboarding with ΗΔΙΚΑ. |
| ΚΕΔ Interoperability Center (~180 web services, 550 methods) | GSIS / Min. Digital Gov. | catalog at `gsis.gr/wsregistry` | Taxisnet creds of a **public body**, per-service approval | B2G only — grants access to things like ΑΦΜ registry lookups, cadastre queries, etc., but only to other government/authorized entities, not general public developers. |

## Tier 3 — No public developer API (portal/app only — exclude from v1)

| Service | Why excluded |
|---|---|
| gov.gr Wallet (digital ID/driving license) | Mobile-app + OpenID4VCI issuance flow for verified relying parties only; no open developer API found. |
| Taxisnet personal e-services | Login-only web portal for citizens; no public REST API. |
| e-EFKA / ΑΜΚΑ citizen portal | Authenticated via Taxisnet; no public API, only web forms (`amka.gr`, `atlas.gov.gr`). |
| ΕΟΠΥΥ citizen e-services | Portal login only; programmatic access only via the restricted ΗΔΙΚΑ vendor API above. |
| EU VIES VAT validation | Not Greek-specific — it's an EU Commission SOAP service Greece participates in (`ec.europa.eu/taxation_customs/vies`). Useful as a companion tool, not "Greek gov" per se. |

## Competitive note (unverified)
Search snippets referenced a product called **Monopigi** (`monopigi.com`) marketing "One API — All Greek Government Data" with MCP support. The domain could not be confirmed live — this sandbox's outbound network access is blocked, so no direct fetch was possible, and the user separately reported the link doesn't resolve. Treat as unverified; do not rely on it as a confirmed competitor without checking directly from an unrestricted machine.

## Recommended v1 MCP scope (highest value, lowest friction)
1. Diavgeia — open reads, zero friction, rich data (transparency/procurement/decisions)
2. data.gov.gr — open catalog, broad coverage
3. Geodata.gov.gr — open geospatial
4. ΓΕΜΗ open data — free key, business lookups
5. AADE myDATA — highest business value, but requires user's own Taxisnet subscription key (MCP would be a thin client, not a shared-key service)
6. Ergani — same pattern as myDATA (bring-your-own credentials)

Everything in Tier 3 should be dropped or explicitly flagged as "not integrable via public API."
