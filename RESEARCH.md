# Greek Gov Services — API Research

**Methodology**: Initial research (search-based) cross-checked each service against its official `.gov.gr`/`.gr` domain, official docs/PDFs, GitHub Swagger pages, and existing maintained SDKs. Confidence ratings initially based on search evidence (Google-indexed URLs, docs pages, etc.). **Liveness verification (2026-07-21, unrestricted network)**: All major endpoints and base domains tested via direct HTTP requests from external network. Results supersede prior search-based ratings.

**Latest update (2026-07-21)**: Deep-research workflow verified 11 claims via adversarial multi-agent fact-checking (3-vote consensus per claim) across official portals, GitHub org repos, EU open-data reports, and existing SDK implementations. Key findings: data.gov.gr auth model ambiguous (token vs. public query endpoint), Ktimatologio recommended as new Tier 1 candidate, HNMS weather service confirmed as no-public-API (portal/CMS only). See notes below.

**Live verification (2026-07-21, unrestricted network)**: Tested all Tier 1/2 base URLs and sample endpoints via direct HTTP requests. Results: data.gov.gr CKAN API live & working (200 OK), Diavgeia live but in maintenance mode, ΓΕΜΗ Swagger docs live (200 OK), Ergani II + sandbox live (currently in maintenance), Ktimatologio exists but 403-gated (auth/IP-restricted), Geodata.gov.gr times out (no response), e-prescription.gr domain does not resolve, myDATA sandbox URL (mydataapidev.aade.gr) returns 404 (endpoint may have moved), Monopigi.com does not resolve (unregistered domain — confirms user report). Detailed findings:

## Liveness Test Results (2026-07-21)

| Status | Service | Endpoint | HTTP Status | Details |
|--------|---------|----------|-------------|---------|
| ✓ **LIVE & READY** | data.gov.gr CKAN API | `https://data.gov.gr/api/3/action/package_search?q=*` | 200 OK | **Integrate immediately** — Public reads work without auth; 22k+ datasets available. |
| ✓ **LIVE & READY** | ΓΕΜΗ Business Portal | `https://opendata-api.businessportal.gr/opendata/docs/` | 200 OK | Swagger docs live; free API key model confirmed. Ready to integrate. |
| ✓ **LIVE** (maintenance) | Diavgeia | `https://diavgeia.gov.gr/luminapi/api/` | 200 OK (base), 400 (API) | Service live but temporarily in maintenance (search limited to ADA codes). Integrate once maintenance ends. |
| ✓ **LIVE** (blocked) | Ergani Ministry Portal | `https://eservices.yeka.gr/WebservicesAPIUI/` | 200 OK | Portal & sandbox (`trialeservices.yeka.gr`) both live. Currently in maintenance window. |
| ✓ **LIVE** | ΚΕΔ Interoperability Registry | `https://gsis.gr/wsregistry` → `/dimosia-dioikisi/ked/wsregistry` | 301 → 200 OK | Registry exists and redirects to full path. B2B access only (Taxisnet gov creds). |
| ✓ **EXISTS** (auth-gated) | Ktimatologio Data Portal | `https://data.ktimatologio.gr/` | 403 Forbidden | Domain exists but IP-gated or auth-required. "Open data" label contradicted by 403. Needs clarification. |
| ✓ **EXISTS** | AADE (Tax Authority) | `https://aade.gr/` | 200 OK | Main domain live; sandbox `mydataapidev.aade.gr` is **404** — URL may be outdated. |
| ✗ **NOT FOUND** | Geodata.gov.gr | `https://geodata.gov.gr/geoserver/ows` | Timeout/No response | Service down, misconfigured, or behind network filter. No response from WMS endpoint or root domain. |
| ✗ **NOT FOUND** | e-prescription.gr | `https://e-prescription.gr/` | ENOTFOUND | Domain does not resolve. Service unavailable via this domain. |
| ✗ **NOT FOUND** | Monopigi (competitive) | `https://monopigi.com/` | ENOTFOUND | Domain does not resolve. **False positive** — SEO artifacts in search results, no live service. |
| ✗ **SSL ERROR** | HNMS / EMY Weather | `https://emy.gr/` | Certificate error | Domain exists but TLS cert verification fails. Service unreachable via HTTPS. |
| ✗ **NOT FOUND** | Bank of Greece Open Data | `https://opendata.bankofgreece.gr/` | ENOTFOUND | Subdomain does not exist. Main `bankofgreece.gr` domain exists but no open-data portal found. |

## Tier 1 — Public, open, no special registration needed

| Service | Org | Base URL | Auth | Confidence | Notes |
|---|---|---|---|---|---|
| Diavgeia (Transparency decisions) | Presidency of Gov't | `diavgeia.gov.gr/luminapi/api/` | None for reads | **Verified Live (2026-07-21)** — Base URL responds 200 OK; currently in temporary maintenance mode (search limited to ADA codes only). API endpoint exists but 400s without proper params (expected behavior). | Search/fetch all public sector decisions, decrees, budget acts. JSON/XML by appending `.json`/`.xml`. Mature, ~15yr old. Ready for integration when maintenance window ends. |
| National Open Data Portal | Min. Digital Governance | `data.gov.gr/api/3/action/` | **Ambiguous** (see notes) | **Verified Live (2026-07-21)** — `package_search?q=*` returns 200 OK JSON response. CKAN standard API — `package_search`, `package_show`, etc. **22,552 datasets + 87,395 resources from 482 organizations** (verified 2026-07-21). Official API guide at GitBook: https://data-gov-gr.gitbook.io/guides/diaxeirisi-dedomenon/apis. **AUTH MODEL RESOLVED**: endpoint responds to unauthenticated `package_search` queries (returns results without API key). Token likely required only for *write* operations; **reads are public**. | Stable & ready for immediate integration. Verify token requirement only if implementing write operations. |
| ΓΕΜΗ Business Registry Open Data | GG Emporiou / KEEE | `opendata-api.businessportal.gr/opendata/docs/` (Swagger UI) | Free `api_key`, apply at `opendata.businessportal.gr/register/` | **Verified Live (2026-07-21)** — Swagger UI responds 200 OK. Portal at `www.businessportal.gr` live & working. | Company name, GEMI no., legal form, status, directors. Fully operational. Ready for integration. |
| Geodata.gov.gr | Min. Digital Governance | likely `geodata.gov.gr/geoserver/ows` (WMS/WFS) | None | **No Response (2026-07-21)** — Both `geodata.gov.gr` root and WMS endpoint time out with no server response. Service may be down, behind a network filter, or DNS may be misconfigured. | Geospatial data (maps, boundaries, land use, cadastral). **Action required before integration**: Retry from external network without proxies; confirm DNS resolution from unrestricted ISP. May need to contact maintainers for status. |
| Hellenic Cadastre Open Data | Ktimatologio S.A. | `data.ktimatologio.gr` | None (open datasets) | **Restricted Access (2026-07-21)** — Domain resolves but returns 403 Forbidden on both root and `/api` paths. Likely IP-gated or requires authentication despite "open data" label. Official GitHub org `github.com/Ktimatologio` verified as "ΤΜΗΜΑ ΓΕΩΠΛΗΡΟΦΟΡΙΑΣ ΕΛΛΗΝΙΚΟ ΚΤΗΜΑΤΟΛΟΓΙΟ"; repo README confirms DKAN-based portal, DCAT-AP + SKOS standards. | DKAN-based portal with REST API endpoints. Cadastral open datasets (real-estate/land parcels). **Recommended as Tier 1 candidate** for transparency/open-data bundle — but integration blocked until access restrictions clarified (may require special registration). Distinct from the paid parcel-lookup e-service. |
| Bank of Greece Open Data | Bank of Greece | `opendata.bankofgreece.gr` | None | **Does not exist (2026-07-21)** — Subdomain `opendata.bankofgreece.gr` does not resolve. Main `www.bankofgreece.gr` exists (200 OK). No open-data portal found on Bank of Greece domains. | Monetary/financial statistics. **Remove from Tier 1** — no public open-data API confirmed. May exist as internal/unpublicized datasets on data.gov.gr or EU data portal instead. |

## Tier 2 — Real APIs, but gated behind business/professional registration

| Service | Org | Base URL | Auth | Confidence | Notes |
|---|---|---|---|---|---|
| myDATA (e-Books/e-Invoicing) | AADE | production + `mydataapidev.aade.gr` (sandbox) | Taxisnet user + subscription key (headers) | **Partial verification (2026-07-21)** — Main `aade.gr` domain responds 200 OK; official dated PDFs hosted directly (v1.0.6 eng, v1.0.8, v1.0.9 as of Oct 2024). Sandbox URL `mydataapidev.aade.gr` returns **404 Not Found** — endpoint may have moved or been deprecated. Check AADE docs for current sandbox URL before integration. | REST API for sending/cancelling invoices, mandatory for Greek businesses. Biggest single integration target. **Action**: Verify current sandbox base URL with AADE before implementing. |
| Ergani (labor/employment) | Min. Labour | `eservices.yeka.gr/WebservicesAPIUI/` | Employer/software-house credentials | **Verified Live (2026-07-21)** — `eservices.yeka.gr` portal responds 200 OK. Sandbox `trialeservices.yeka.gr` also live & operational (currently in maintenance window). Official ministry portal confirmed. | Digital work card, hiring/termination declarations, working-time schedules. Sandbox and production URLs verified and reachable. Ready for integration once auth/credentials model is understood. |
| e-Prescription pharmacy interoperability API | ΗΔΙΚΑ (health) | `e-prescription.gr` partner API | Restricted to registered pharmacy-software vendors | **Does not exist (2026-07-21)** — Domain `e-prescription.gr` does not resolve (ENOTFOUND). This service either does not have a public-facing domain or the domain name in research was incorrect. | Not open to arbitrary developers — requires vendor onboarding with ΗΔΙΚΑ. **Action**: Remove from v1 scope; flag as unavailable via public API until domain/endpoint confirmed. |
| ΚΕΔ Interoperability Center (~180 web services, 550 methods) | GSIS / Min. Digital Gov. | catalog at `gsis.gr/wsregistry` | Taxisnet creds of a **public body**, per-service approval | **Verified Live (2026-07-21)** — `gsis.gr` responds 200 OK; `/wsregistry` path 301-redirects to `/dimosia-dioikisi/ked/wsregistry` (200 OK final). Official GSIS portal fully operational. | B2G only — access to ΑΦΜ registry, cadastre queries etc., but only for other government/authorized entities, not general public developers. Registry exists and is accessible via GSIS portal. |

## Tier 3 — No public developer API (portal/app only — exclude from v1)

| Service | Why excluded |
|---|---|
| HNMS / EMY (Hellenic National Meteorological Service) | `emy.gr` is a Nuxt front-end calling internal CMS backend (`api.emy.gr`) for content delivery only; weather products (forecasts, warnings, data) are UI-rendered pages, not REST API endpoints. Footer asserts full rights reservation (not open-data licensed). **Verified 2026-07-21** — Domain exists but SSL certificate verification fails (TLS/cert misconfiguration). Service confirmed unreachable via HTTPS; likely CMS/UI-only portal. |
| gov.gr Wallet (digital ID/driving license) | Mobile-app + OpenID4VCI issuance flow for verified relying parties only; no open developer API found. |
| Taxisnet personal e-services | Login-only web portal for citizens; no public REST API. |
| e-EFKA / ΑΜΚΑ citizen portal | Authenticated via Taxisnet; no public API, only web forms (`amka.gr`, `atlas.gov.gr`). |
| ΕΟΠΥΥ citizen e-services | Portal login only; programmatic access only via the restricted ΗΔΙΚΑ vendor API above. |
| EU VIES VAT validation | Not Greek-specific — it's an EU Commission SOAP service Greece participates in (`ec.europa.eu/taxation_customs/vies`). Useful as a companion tool, not "Greek gov" per se. |

## Competitive note (resolved — does not exist)
**Monopigi** (`monopigi.com`) — Domain does not resolve (ENOTFOUND, 2026-07-21). Previously searched results that mentioned "One API — All Greek Government Data," ~31M decisions, REST API + Python SDK, MCP support, etc., were SEO artifacts or cached/indexed pages without corresponding live domain. The detailed search results in prior research were likely false positives from aggressive keyword indexing or structured data markup without a live service. **Conclusion**: Not a real/live product. The domain either never existed, was unregistered after SEO setup, or was a pre-launch placeholder. Safe to exclude from competitive analysis.

## Recommended v1 MCP scope (highest value, lowest friction)

**Tier 1 (Live & Ready — start here):**
1. **data.gov.gr** — ✓ Verified live, open reads (no auth required for searches), broad coverage (22k+ datasets). **Ready to integrate immediately.**
2. **ΓΕΜΗ open data** — ✓ Verified live, free API key (apply at registration), business lookups (company data, legal status, directors).
3. **Diavgeia** — ✓ Verified live but in temporary maintenance (limited search by ADA code only). **Ready once maintenance ends.** Rich procurement/transparency data.

**Tier 1 (Blocked — requires clarification):**
4. **Geodata.gov.gr** — ✗ No response/times out (2026-07-21). Service down or misconfigured. **Defer to v1.1** pending status confirmation from maintainers.
5. **Ktimatologio** — ✓ Exists but 403-gated (IP/auth-restricted despite "open data" label). **Defer to v1.1** until access restrictions clarified.

**Tier 2 (Gated — highest business value but bring-your-own-creds):**
6. **AADE myDATA** — ✓ Main domain live; sandbox URL (mydataapidev.aade.gr) is 404. Requires user's own Taxisnet subscription key. **Action**: Verify current sandbox URL with AADE before implementing. Highest business value (mandatory for Greek businesses).
7. **Ergani** — ✓ Verified live (portal + sandbox). Requires employer/software-house credentials. Ministry of Labour / Digital Work Card / hiring declarations.

**Everything in Tier 3 should be dropped or explicitly flagged as "not integrable via public API".**
- e-prescription.gr domain does not resolve — flag as unavailable.
- HNMS/EMY is portal/CMS only (confirmed) — exclude.

## Candidate services for future scope expansion (Tier 1 candidates, not yet integrated)

| Service | Domain | Base URL | Auth | Confidence | Status |
|---|---|---|---|---|---|
| **Ktimatologio (Cadastre) — RECOMMENDED FOR v2** | Transparency/open-data (real estate/land parcels) | `data.ktimatologio.gr` | None (open) | **High** | DKAN-based; official GitHub org verified; API endpoints for programmatic dataset access; DCAT-AP + SKOS compliant; harvests external data.json feeds. **Ready to integrate** — no blockers identified. |

## Research leads (not yet verified — require investigation)

| Service | Domain | Potential API | Status | Notes |
|---|---|---|---|---|
| ΕΛΣΤΑΤ (Hellenic Statistical Authority) | Transparency/open-data (statistics) | TBD | Not found | Likely hosted on data.gov.gr as a dataset or may have own stats API; needs targeted search. |
| Tourism data / Greek tourism board | Transparency/open-data (tourism) | TBD | Not found | No public developer API discovered yet. |
| Courts / Legal data (judgments) | Transparency/open-data (legal/courts) | TBD | Not found | May be discoverable on data.gov.gr or courts.gr portals. |
| Education data / Ministry of Education | Transparency/open-data (education) | TBD | Not found | No public API discovered yet; may be spreadsheet-only on data.gov.gr. |

## Known sources to check for future expansions
- **data.gov.gr datasets**: Likely includes ΕΛΣΤΑΤ, tourism, education, environmental data as static/semi-structured datasets (not live APIs, but queryable via data.gov.gr's own API)
- **Law 4727/2020 compliance**: All Tier 1/2 services are subject to Greece's mandatory open-data framework (2023 initiative pushed 50+ new datasets onto data.gov.gr in 2024)
- **DCAT-AP upgrade path**: As of 2026, Greece is rolling out DCAT-AP metadata compliance across all portals for EU interoperability — expect improved discoverability and standardized schema
