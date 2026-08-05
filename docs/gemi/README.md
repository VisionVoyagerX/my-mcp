# ΓΕΜΗ API — Πώς λειτουργεί στο my-mcp

Αναλυτική περιγραφή, σε απλή γλώσσα, του πώς τα εργαλεία στο `packages/core/src/gemi/` καλούν το ανοιχτό API του ΓΕΜΗ (Γενικό Εμπορικό Μητρώο): τι κάνει κάθε endpoint, πώς λειτουργεί το auth και το rate limiting, εντολές για δοκιμή, το πλήρες επίσημο API σε σχέση με ό,τι υλοποιούμε, δυνατότητες και περιορισμούς.

> **Κατάσταση 2026-08-04:** Και τα 4 read endpoints του `opendata-api.businessportal.gr` είναι υλοποιημένα και επαληθευμένα end-to-end με πραγματικό, εγκεκριμένο `GEMI_API_KEY` σε production. Το spec διαφωνεί με τα πραγματικά δεδομένα σε μερικά σημεία τύπων (`arGemi` και τα `id` πεδία των μεταδεδομένων είναι strings, όχι integers) — βλ. §3.

## 1. Τι είναι το ΓΕΜΗ

Το **ΓΕΜΗ** (Γενικό Εμπορικό Μητρώο) είναι το επίσημο μητρώο όλων των εμπορικών επιχειρήσεων στην Ελλάδα — κάθε ΑΕ, ΕΠΕ, ΙΚΕ, ΟΕ κ.λπ. πρέπει να είναι εγγεγραμμένη εκεί. Το open-data API του ΓΕΜΗ (`opendata-api.businessportal.gr`) εκθέτει στοιχεία εταιρειών (επωνυμία, έδρα, νομική μορφή, εκπροσώπους, μετοχικό κεφάλαιο, δραστηριότητες) και δημόσια έγγραφα (πρακτικά συνελεύσεων, ανακοινώσεις, δημοσιεύσεις ΦΕΚ/ΓΕΜΗ).

Σε αντίθεση με τη Διαύγεια, αυτό το API **δεν είναι no-auth**: κάθε κλήση απαιτεί έναν `api_key` header, ο οποίος αποκτάται μέσω μη-αυτόματης έγκρισης (βλ. §2.1). Το repo κρατά αυτό το auth pattern ρητό στο δικό του κώδικα αντί να το κρύβει πίσω από μια γενική αφαίρεση, σύμφωνα με τον κανόνα του CLAUDE.md.

**Base URL** που χρησιμοποιείται σε αυτό το repo:

```
https://opendata-api.businessportal.gr/api/opendata/v1
```

Μπορεί να αλλάξει μέσω του env var `GEMI_BASE_URL`.

### 2.1 Το κλειδί: μη-αυτόματη έγκριση, όχι self-service

Σε αντίθεση με το `data.gov.gr` (CKAN token) που εκδίδεται αμέσως, το ΓΕΜΗ API απαιτεί εγγραφή στο `opendata.businessportal.gr/register` και **χειροκίνητη έγκριση από την ΚΥ ΓΕΜΗ** (την κεντρική υπηρεσία ΓΕΜΗ) πριν εκδοθεί πραγματικό `api_key`. Αυτό επαληθεύτηκε ζωντανά 2026-07-25: ένα προηγουμένως τεκμηριωμένο "test key" (`api-docs-key`) δοκιμάστηκε σε κάθε endpoint και επέστρεψε `{"message":"Unauthorized"}` σε όλα, ίδιο με ένα άδειο/λάθος κλειδί — δεν υπάρχει δημόσιο test key.

Το `GemiClient` διαβάζει το κλειδί από `options.apiKey` ή το env var `GEMI_BASE_URL`/`GEMI_API_KEY`, και αν λείπει ρίχνει ένα `GovApiError` με actionable μήνυμα (registration URL + εξήγηση ότι η έγκριση είναι χειροκίνητη) αντί να αφήσει το αίτημα να φτάσει στο upstream API και να αποτύχει με ένα αδιαφανές 401.

### 2.2 Rate limit: 30 req/min, ΠΑΓΚΟΣΜΙΟ ανά κλειδί, όχι ανά χρήστη

Η ΚΥ ΓΕΜΗ περιορίζει κάθε `api_key` σε **30 requests/λεπτό συνολικά** — όχι ανά caller. Επειδή το `business-mcp` είναι δημόσιος Cloudflare Worker όπου όλοι οι επισκέπτες μοιράζονται ένα server-held κλειδί (`env.GEMI_API_KEY`), αυτό το όριο πρέπει να επιβληθεί **παγκόσμια** στο worker, όχι ανά IP όπως το γενικό rate limiter του Worker.

Η υλοποίηση:

- `packages/business-mcp/src/worker.ts` ορίζει ένα δεύτερο, ξεχωριστό Cloudflare Rate Limiting binding, `GEMI_RATE_LIMITER`, με **σταθερό key** (`"gemi-global"`) αντί για key ανά IP.
- `registerGemiTools()` δέχεται ένα προαιρετικό `checkRateLimit` callback, καλείται πριν από κάθε upstream κλήση ΓΕΜΗ (`tools.ts`). Αν επιστρέψει `{ success: false }`, το εργαλείο αρνείται την κλήση με ένα σαφές, ελληνικό μήνυμα ("το κοινόχρηστο όριο έχει εξαντληθεί, δοκιμάστε ξανά σε ένα λεπτό") αντί να χτυπήσει το upstream API και να πάρει ένα αδιαφανές σφάλμα.
- Το callback είναι προαιρετικό ώστε single-tenant deployments (π.χ. τοπική εκτέλεση με προσωπικό κλειδί) να μη χρειάζονται κανένα limiter — ο caller είναι υπεύθυνος για τον δικό του ρυθμό.

## 3. Τα 4 εργαλεία

| Εργαλείο                     | Endpoint(s)                                        | Τι κάνει                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemi_search_company_by_tin`  | `GET /companies`                                    | Αναζήτηση εταιρείας κατά ΑΦΜ (`afm`), με προαιρετικό φίλτρο `isActive`. Ξετυλίγει το envelope `{ searchMetadata, searchResults }` σε επίπεδη λίστα εταιρειών.        |
| `gemi_get_company`            | `GET /companies/{arGemi}`                           | Πλήρες αρχείο μιας εταιρείας κατά αριθμό ΓΕΜΗ (`arGemi`): επωνυμία, έδρα, νομική μορφή, δραστηριότητες (ΚΑΔ), εκπρόσωποι, μετοχικό κεφάλαιο, μετοχές.                 |
| `gemi_get_company_documents`  | `GET /companies/{arGemi}/documents`                 | Δημόσια έγγραφα μιας εταιρείας: αποφάσεις συνέλευσης/διοικητικού συμβουλίου (`decision[]`) και δημοσιεύσεις ΦΕΚ/ΓΕΜΗ (`publication[]`), με σύνδεσμο στο πηγαίο αρχείο. |
| `gemi_list_metadata`          | `GET /metadata/{category}`                          | Λίστες αναφοράς (parametric files) για επτά κατηγορίες — βλ. §3.1. Ένα εργαλείο, παράμετρος `category` επιλέγει ποια λίστα φέρνει.                                    |

Και τα 4 εργαλεία περνούν πρώτα από το rate-limit check (§2.2) και μετά καλούν το upstream API με τον `api_key` header (§2.1). Κάθε απάντηση επικυρώνεται με Zod schema (`types.ts`) πριν επιστραφεί στον agent.

### 3.1 `gemi_list_metadata` — ενοποίηση 7 endpoints σε 1 εργαλείο

Το ΓΕΜΗ εκθέτει 7 ξεχωριστά, ομοιόμορφα endpoints κάτω από `/metadata/*` (activities, prefectures, municipalities, companyStatuses, legalTypes, gemiOffices, assemblySubjects) — όλα επιστρέφουν την ίδια βασική μορφή `{ id, descr, descrEn, lastUpdated, ... }`. Αντί να εκτεθούν ως 7 ξεχωριστά MCP tools (που θα φούσκωνε άσκοπα το tool surface — βλ. πολιτική domain-bundles στο CLAUDE.md), ενοποιήθηκαν σε ένα εργαλείο με enum παράμετρο `category`, ίδια λογική σχεδίασης με το `diavgeia_get_dictionary`/`diavgeia_list_search_terms` στο [Diavgeia doc](../diavgia/README.md#33-σχεδιαστική-επιλογή-ενοποίηση-αντί-για-1-προς-1-mapping-endpointεργαλείο).

Αυτές οι λίστες χρησιμεύουν για να αποκωδικοποιηθούν τα ενσωματωμένα `{ id, descr }` refs μέσα σε ένα `Company` (π.χ. `company.legalType.id` → ανθρώπινη ετικέτα μέσω `gemi_list_metadata(category: "legalTypes")`) ή για να χτιστούν μελλοντικά φίλτρα αναζήτησης.

**Δοκιμή μέσω MCP Inspector** (γενική μορφή):

```bash
# από τη ρίζα του repo: ξεκινήστε το business-mcp worker τοπικά
# (χρειάζεται Node 22+ για το wrangler· χρειάζεται και ένα εγκεκριμένο
# GEMI_API_KEY μέσω wrangler secret/vars, αλλιώς τα gemi_* εργαλεία θα
# επιστρέφουν το actionable "no API key configured" σφάλμα)
pnpm --filter @my-mcp/business-mcp run dev   # http://localhost:8787

# σε άλλο τερματικό:
npx @modelcontextprotocol/inspector --cli http://localhost:8787 \
  --method tools/call --tool-name gemi_search_company_by_tin --tool-arg tin=094014201
```

## 4. Ευρήματα — πού διαφωνεί το spec με τα πραγματικά δεδομένα

Το επίσημο Swagger 2.0 spec (βρέθηκε μέσω του `Swagger-API-Docs-URL` response header σε HEAD request στη σελίδα docs, βλ. `types.ts` πάνω μέρος) είναι η μόνη διαθέσιμη πηγή αλήθειας για paths/params — το API Gateway μπροστά στο ΓΕΜΗ επιστρέφει το ίδιο `{"message":"Unauthorized"}` τόσο σε πραγματικά paths χωρίς κλειδί όσο και σε ανύπαρκτα paths, οπότε ζωντανό HTTP probing χωρίς κλειδί δεν μπορεί να διακρίνει σωστό path από typo (βλ. σχόλιο στην κορυφή του `client.ts`).

Με ένα πραγματικό εγκεκριμένο κλειδί (2026-08-04), κάθε method επαληθεύτηκε end-to-end. Δύο σημεία όπου το spec λέει integer αλλά η πραγματική απάντηση είναι string:

1. **`Company.arGemi`** — το spec δηλώνει integer· η πραγματική απάντηση επιστρέφει `"8515901000"` (string). Το schema δέχεται `z.union([z.string(), z.number()])` αντί να εμπιστευτεί το spec.
2. **Το αυτόνομο `id` πεδίο στις οντότητες `/metadata/*`** (`legalTypes`, `companyStatuses`, `gemiOffices`, κ.λπ.) — string στην πραγματικότητα, ενώ το **ίδιο** εννοιολογικά πεδίο όταν εμφανίζεται ως nested ref μέσα σε ένα `Company` (π.χ. `company.legalType.id`) **είναι πράγματι number**. Δηλαδή το ίδιο "id ενός legalType" έχει διαφορετικό τύπο ανάλογα με το αν έρχεται από το μητρώο μεταδεδομένων ή ενσωματωμένο σε μια εταιρεία — ιδιορρυθμία του upstream API, καταγεγραμμένη ρητά σε σχόλιο πάνω από κάθε σχετικό schema στο `types.ts` αντί να "διορθωθεί" σιωπηλά.

Δύο endpoints που το spec τεκμηριώνει αλλά αυτό το client δεν υλοποιεί (βλ. §5 για λεπτομέρειες): `GET /downloadFile` και `GET /health`.

## 5. Το πλήρες επίσημο API σε σχέση με ό,τι υλοποιούμε

| Endpoint                        | Τι κάνει                                    | Υλοποιημένο εδώ;                                                                                                                                       |
| -------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /companies`                 | Αναζήτηση εταιρειών (κατά ΑΦΜ)              | ✅ `gemi_search_company_by_tin`                                                                                                                          |
| `GET /companies/{id}`            | Μία εταιρεία κατά αριθμό ΓΕΜΗ               | ✅ `gemi_get_company`                                                                                                                                    |
| `GET /companies/{id}/documents`  | Δημόσια έγγραφα εταιρείας                    | ✅ `gemi_get_company_documents`                                                                                                                          |
| `GET /metadata/activities`       | ΚΑΔ κωδικοί δραστηριότητας                   | ✅ `gemi_list_metadata` (`category: activities`)                                                                                                        |
| `GET /metadata/prefectures`      | Νομοί                                        | ✅ `gemi_list_metadata` (`category: prefectures`)                                                                                                       |
| `GET /metadata/municipalities`   | Δήμοι                                        | ✅ `gemi_list_metadata` (`category: municipalities`)                                                                                                    |
| `GET /metadata/companyStatuses`  | Κωδικοί κατάστασης επιχείρησης               | ✅ `gemi_list_metadata` (`category: companyStatuses`)                                                                                                   |
| `GET /metadata/legalTypes`       | Κωδικοί νομικής μορφής (ΑΕ, ΕΠΕ, ΙΚΕ, ...)   | ✅ `gemi_list_metadata` (`category: legalTypes`)                                                                                                        |
| `GET /metadata/gemiOffices`      | Τοπικές υπηρεσίες ΓΕΜΗ                       | ✅ `gemi_list_metadata` (`category: gemiOffices`)                                                                                                       |
| `GET /metadata/assemblySubjects` | Κωδικοί θέματος απόφασης/συνέλευσης          | ✅ `gemi_list_metadata` (`category: assemblySubjects`)                                                                                                  |
| `GET /downloadFile?key&elementId`| Λήψη του υποκείμενου αρχείου ενός εγγράφου   | ❌ δεν υλοποιήθηκε — τα `decision`/`publication` entries του `CompanyDocumentSet` ήδη έχουν άμεσα `assemblyDecisionUrl`/`url` πεδία, πιθανώς επικαλυπτόμενο ή edge-case path, όχι επιβεβαιωμένα απαραίτητο |
| `GET /health`                    | Liveness check                               | ❌ δεν υλοποιήθηκε — παρά το όνομα, απαιτεί το ίδιο `api_key` με όλα τα άλλα (επαληθεύτηκε live), άρα δεν είναι χρήσιμο ως ανώνυμο health probe          |

**Οι 3 βασικές λειτουργικές διαδρομές (αναζήτηση, ανάκτηση, έγγραφα) και όλα τα 7 metadata endpoints είναι υλοποιημένα.** Δεν υπάρχουν write endpoints στο ΓΕΜΗ open-data API — είναι εξ ολοκλήρου read-only εκ σχεδιασμού, το open-data API δεν είναι το σύστημα καταχώρισης του ΓΕΜΗ.

## 6. Δυνατότητες (Features)

- **Actionable σφάλμα όταν λείπει το κλειδί.** Αντί να αφήσει ένα αίτημα χωρίς `api_key` να φτάσει στο upstream και να πάρει ένα αδιαφανές 401, ο client ρίχνει `GovApiError` με το registration URL και εξήγηση για τη χειροκίνητη έγκριση (§2.1) πριν καν γίνει το HTTP αίτημα.
- **Παγκόσμιο rate limiting ξεχωριστό από το γενικό, ανά-IP limiter του worker.** Αντικατοπτρίζει το πραγματικό όριο 30 req/min/κλειδί της ΚΥ ΓΕΜΗ αντί να υποθέτει (λάθος) ότι είναι ανά χρήστη (§2.2).
- **Επικυρωμένες απαντήσεις με schema, με ρητή τεκμηρίωση των αποκλίσεων spec-vs-πραγματικότητα.** Κάθε union type (`z.union([z.string(), z.number()])`) στο `types.ts` έχει σχόλιο πάνω από πάνω του που εξηγεί ΓΙΑΤΙ χρειάζεται — όχι απλώς "δέξου και τα δύο", αλλά ποιο endpoint επιστρέφει ποιον τύπο και πότε επαληθεύτηκε (§4).
- **Ξετύλιγμα του search envelope.** Το `GET /companies` επιστρέφει `{ searchMetadata, searchResults }`, όχι bare array — το `searchCompanyByTin()` το ξετυλίγει ώστε ο agent να πάρει κατευθείαν μια λίστα εταιρειών.
- **Ενοποιημένο εργαλείο για τα 7 metadata endpoints** (§3.1) αντί για 7 ξεχωριστά, μειώνοντας το tool-surface που βλέπει ένας agent χωρίς απώλεια κάλυψης.

## 7. Περιορισμοί (Limitations)

- **Χρειάζεται εγκεκριμένο κλειδί — δεν υπάρχει δημόσιο test/sandbox κλειδί.** Η εγγραφή στο `opendata.businessportal.gr/register` απαιτεί χειροκίνητη έγκριση από την ΚΥ ΓΕΜΗ, όχι στιγμιαία self-service έκδοση (§2.1). Μέχρι να εγκριθεί ένα κλειδί, κάθε `gemi_*` εργαλείο επιστρέφει actionable σφάλμα αντί δεδομένων.
- **Παγκόσμιο όριο 30 req/min σε δημόσιο, πολυχρηστικό deployment.** Σε αντίθεση με τη Διαύγεια (no-auth, χωρίς κοινό όριο), το `business-mcp` μοιράζεται ένα κλειδί μεταξύ όλων των επισκεπτών — σε περιόδους αιχμής, κλήσεις ΓΕΜΗ μπορεί να απορριφθούν με το κοινόχρηστο rate-limit μήνυμα ακόμα κι αν ο μεμονωμένος χρήστης δεν έχει κάνει πολλές κλήσεις ο ίδιος (§2.2).
- **Η αναζήτηση γίνεται μόνο κατά ΑΦΜ.** Το `GET /companies` δεν υποστηρίζει αναζήτηση με ελεύθερο κείμενο επωνυμίας — αν δεν ξέρεις ήδη το ΑΦΜ ή τον αριθμό ΓΕΜΗ μιας εταιρείας, δεν μπορείς να την "ψάξεις με το όνομα" μέσω αυτού του API.
- **Δεν υπάρχει λήψη του πηγαίου αρχείου εγγράφου.** Το `GET /downloadFile` δεν υλοποιήθηκε (§5) — τα `decision`/`publication` entries έχουν ήδη άμεσα URLs, αλλά αν αυτά αποδειχθούν ανεπαρκή σε μελλοντική χρήση, αυτό το endpoint θα χρειαστεί να προστεθεί.
- **Ασυνέπεια τύπων δεδομένων στο ίδιο το upstream API** (§4) — το `id` του ίδιου εννοιολογικά πεδίου είναι string σε ένα endpoint και number σε άλλο. Το repo το αποτυπώνει όπως είναι (union types + σχόλια) αντί να το "διορθώνει" σιωπηλά, ώστε ένας μελλοντικός maintainer να μην ξαναανακαλύψει την ίδια έκπληξη.
- **Read-only.** Δεν υπάρχουν write/καταχώρισης endpoints σε αυτό το open-data API εξ ορισμού — καμία λειτουργικότητα δεν παραλείφθηκε λόγω auth, όπως στη Διαύγεια.

## Πηγές

- `https://opendata-api.businessportal.gr/api-docs` — το ζωντανό Swagger 2.0 spec (βρέθηκε μέσω `Swagger-API-Docs-URL` header, όχι από τη JS-rendered docs σελίδα)
- `opendata.businessportal.gr/register` — φόρμα εγγραφής/αίτησης κλειδιού API
- `packages/core/src/gemi/client.ts`, `tools.ts`, `types.ts` — η υλοποίηση αυτού του repo, με ζωντανή επαλήθευση τεκμηριωμένη inline (σχόλια με ημερομηνίες 2026-07-25 / 2026-08-04)
- `packages/core/src/gemi/client.test.ts`, `__fixtures__/` — unit tests πάνω σε πραγματικά fixture δεδομένα
- `packages/business-mcp/src/worker.ts` — καλωδίωση του `GEMI_RATE_LIMITER` και `GEMI_API_KEY` binding
- [docs/diavgia/README.md](../diavgia/README.md) — αντίστοιχο έγγραφο για τη Διαύγεια, ίδια δομή/σύμβαση τεκμηρίωσης
