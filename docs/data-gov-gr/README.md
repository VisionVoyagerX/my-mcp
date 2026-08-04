# data.gov.gr (CKAN Action API) — Αναλυτική αναφορά ανά endpoint

Το data.gov.gr είναι το εθνικό portal ανοιχτών δεδομένων της Ελλάδας (Υπουργείο Ψηφιακής Διακυβέρνησης), χτισμένο πάνω στο **CKAN** — ένα open-source σύστημα καταλόγου δεδομένων που χρησιμοποιούν δεκάδες κυβερνήσεις παγκοσμίως (ίδιο λογισμικό με data.gov στις ΗΠΑ, data.gov.uk στο Ηνωμένο Βασίλειο κ.ά.). Επειδή είναι CKAN, όλο το API είναι το **τυπικό CKAN "Action API"**: μία επίπεδη λίστα από "ενέργειες" (function-like endpoints), όχι REST resources με URL paths ανά οντότητα.

**Ζωντανή επαλήθευση:** 2026-07-26, όλα τα endpoints παρακάτω που φέρουν ✅ δοκιμάστηκαν με πραγματικά HTTP calls στο `https://data.gov.gr/api/3/action/`.

- **Έκδοση CKAN:** 2.11.3 (από `status_show`)
- **Σύνολο datasets:** 22.705 (ζωντανά, μέσω `package_search?q=*:*&rows=0`) — ελαφρώς αυξημένο σε σχέση με τα 22.552 που είχαν καταγραφεί στο `RESEARCH.md` στις 2026-07-21
- **Resources (αρχεία):** 6.248+ μόνο σε format CSV (μέσω `resource_search`) — το συνολικό πλήθος πόρων είναι μεγαλύτερο
- **Φορείς (organizations):** τουλάχιστον 50 εμφανίζονται στα facets ενός μόνο query· ο πλήρης κατάλογος είναι μεγαλύτερος (482 στο RESEARCH.md)
- **Ομάδες (groups):** **καμία** — το `group_list` γυρνάει άδειο array `[]`. Το data.gov.gr οργανώνει δεδομένα μόνο μέσω _organizations_, όχι _groups_ (και τα δύο υπάρχουν σαν έννοιες στο CKAN, αλλά αυτή η εγκατάσταση χρησιμοποιεί μόνο το πρώτο).

## 1. Βάση, auth, format

**Base URL:** `https://data.gov.gr/api/3/action/`

Κάθε endpoint καλείται σαν `GET .../action/<όνομα_ενέργειας>?param=value` (οι περισσότερες ενέργειες ανάγνωσης δέχονται και POST με JSON body). Η απάντηση είναι πάντα ένα "envelope":

```json
{ "success": true, "result": { ... } }
```

ή σε σφάλμα:

```json
{ "success": false, "error": { "message": "...", "__type": "..." } }
```

**Auth model (επιβεβαιωμένο ζωντανά):**

- Οι **αναγνώσεις (reads) είναι δημόσιες** — `package_search`, `package_show`, `resource_search`, `tag_list`, `license_list`, `package_autocomplete` κ.λπ. δουλεύουν χωρίς κανένα API key.
- Ένα **δωρεάν API token** (μενού χρήστη → API Tokens στο ίδιο το site) πιθανότατα χρειάζεται μόνο για **εγγραφές (writes)** — `package_create`, `resource_create` κ.λπ. — και ίσως για υψηλότερα rate limits στις αναγνώσεις. Δεν επαληθεύτηκε rate limiting σε αυτή τη δοκιμή.
- Το token στέλνεται στο header `Authorization: Token <το-token-σας>` (τυπικό CKAN 2.10+· το παλιότερο CKAN χρησιμοποιούσε `Authorization: <api-key>` χωρίς το πρόθεμα `Token`).
- **Ιδιαιτερότητα αυτής της εγκατάστασης:** μερικά endpoints (π.χ. `organization_list`) απορρίπτουν GET requests με ένα custom μήνυμα λάθους ("Λάθος αίτημα - Λάθος JSON: Invalid request. Please use POST method for your request") — μοιάζει με κανόνα ενός WAF/reverse proxy μπροστά από το CKAN, όχι περιορισμό του ίδιου του CKAN, γιατί άλλα endpoints με παρόμοιο query string (π.χ. `package_search`) δουλεύουν κανονικά με GET. Λύση: στείλτε αυτά τα endpoints ως **POST με `Content-Type: application/json`**.

## 2. Ήδη υλοποιημένα στο my-mcp

Το `packages/core/src/ckan/client.ts` υλοποιεί σήμερα **μόνο 2 από τις δεκάδες διαθέσιμες ενέργειες**, εκτεθειμένες ως εργαλεία MCP στο `packages/core/src/ckan/tools.ts` (καταναλώνονται από το `citizen-mcp` worker):

| Εργαλείο MCP           | CKAN action      | Τι κάνει                                                                            |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `ckan_search_datasets` | `package_search` | Αναζήτηση datasets με ελεύθερο κείμενο, με σελιδοποίηση (`rows`, `start`).          |
| `ckan_get_dataset`     | `package_show`   | Πλήρη μεταδεδομένα ενός dataset (τίτλος, φορέας, άδεια χρήσης, resources με links). |

Αυτά καλύπτουν το πιο βασικό use case ("βρες μου δεδομένα για Χ, δώσε μου το link"). Παρακάτω είναι όλο το υπόλοιπο API, οργανωμένο κατά κατηγορία, για να φανεί τι άλλο θα άξιζε να προστεθεί.

## 3. Datasets / Packages — τα ίδια τα σύνολα δεδομένων

Στο CKAN, ένα "dataset" λέγεται εσωτερικά "package". Κάθε dataset έχει μεταδεδομένα (τίτλος, περιγραφή, φορέας, άδεια) και μία λίστα από **resources** (τα πραγματικά αρχεία — CSV, XLSX, JSON, API links).

| Ενέργεια                                              | Μέθοδος            | Τι κάνει σε απλά λόγια                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package_search` ✅                                   | GET/POST           | Αναζήτηση datasets με λέξη-κλειδί, φίλτρα (`fq`, π.χ. `organization:chania`), ταξινόμηση, **facets** (π.χ. πόσα datasets ανά φορέα — δοκιμάστηκε: 50 φορείς σε ένα facet call). Η βασική "μηχανή αναζήτησης" του portal. |
| `package_show` ✅                                     | GET/POST           | Πλήρες αρχείο ενός συγκεκριμένου dataset by id/slug: όλα τα resources, licence, ημ/νία δημιουργίας/τροποποίησης, και custom πεδία που προσθέτει το data.gov.gr (βλ. §7).                                                 |
| `package_list` ✅                                     | GET/POST           | Απλή λίστα με όλα τα _ονόματα_ (slugs) των datasets — π.χ. `["0c8025ab", "11", "12-8-18-pyroplhktoi", ...]`. Χρήσιμο για πλήρη export/crawl, όχι για αναζήτηση.                                                          |
| `package_autocomplete` ✅                             | GET                | Autocomplete καθώς πληκτρολογεί ο χρήστης — γυρνάει tίτλους που ταιριάζουν μερικώς (δοκιμάστηκε με `q=covid`, βρήκε "Στατιστικά εμβολιασμού για τον COVID-19").                                                          |
| `current_package_list_with_resources`                 | GET                | Σαν το `package_list` αλλά με όλα τα resources μαζί, ταξινομημένα κατά πιο πρόσφατα τροποποιημένα. Βαρύ call — αποφεύγεται αν δεν χρειάζεται bulk export.                                                                |
| `package_create`                                      | POST (write, auth) | Δημιουργία νέου dataset. **Δεν αφορά το my-mcp** — read-only client, βλ. CLAUDE.md architecture.                                                                                                                         |
| `package_update` / `package_patch` / `package_revise` | POST (write, auth) | Τροποποίηση υπάρχοντος dataset (πλήρης αντικατάσταση / μερική ενημέρωση / pattern-based). Write-only, εκτός scope.                                                                                                       |
| `package_relationship_*` (create/list/update/delete)  | GET/POST           | Συνδέει δύο datasets μεταξύ τους με μια σχέση (π.χ. "child_of", "derives_from"). Σπάνια χρησιμοποιείται στην πράξη — δεν εντοπίστηκαν σχέσεις σε δείγμα datasets.                                                        |
| `package_collaborator_*` (list/create/delete)         | GET/POST (auth)    | Διαχείριση συνεργατών (ποιος χρήστης μπορεί να επεξεργαστεί ένα dataset). Αφορά μόνο editors, όχι consumers δεδομένων.                                                                                                   |

## 4. Resources — τα πραγματικά αρχεία μέσα σε ένα dataset

Ένα dataset είναι ο "φάκελος", ένα resource είναι το "αρχείο" μέσα του (π.χ. ένα CSV με στατιστικά).

| Ενέργεια                                                 | Μέθοδος            | Τι κάνει σε απλά λόγια                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resource_search` ✅                                     | GET                | Αναζήτηση **στα ίδια τα resources** (όχι στα datasets) με φίλτρα όπως `format:CSV`. Δοκιμάστηκε: 6.248 resources μόνο σε CSV format. Χρήσιμο για "βρες μου όλα τα αρχεία XLSX του δημόσιου τομέα" χωρίς να ξέρεις σε ποιο dataset ανήκουν. |
| `resource_show` ✅                                       | GET                | Πλήρη μεταδεδομένα ενός resource by id: άμεσο download URL, format, μέγεθος αρχείου, mimetype, και στοιχεία από τον **archiver** (data.gov.gr κρατάει cached αντίγραφο κάθε αρχείου — `cache_url`, αν το πηγαίο link σπάσει).              |
| `resource_create` / `resource_update` / `resource_patch` | POST (write, auth) | Προσθήκη/τροποποίηση αρχείου σε dataset. Write-only, εκτός scope.                                                                                                                                                                          |
| `resource_view_*` (create/show/update/list/reorder)      | GET/POST           | Οι "προεπισκοπήσεις" που βλέπεις στο site (πίνακας, γράφημα, χάρτης) πάνω σε ένα resource. Metadata για UI rendering, όχι για δεδομένα καθαυτά.                                                                                            |

## 5. Organizations — φορείς του δημοσίου

| Ενέργεια                                     | Μέθοδος            | Τι κάνει σε απλά λόγια                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_list` ✅ (μόνο POST)           | POST               | Λίστα με ονόματα (slugs) όλων των φορέων-εκδοτών δεδομένων — π.χ. `1dype-2026` (1η Υγειονομική Περιφέρεια Αττικής), `chania` (Δήμος Χανίων). Με `all_fields=true` γυρνάει και τίτλο, λογότυπο, πλήθος datasets ανά φορέα. |
| `organization_show`                          | GET/POST           | Πλήρες προφίλ ενός φορέα: περιγραφή, λογότυπο, λίστα datasets του (αν `include_datasets=true`).                                                                                                                           |
| `organization_autocomplete`                  | GET                | Autocomplete φορέα καθώς πληκτρολογείς όνομα.                                                                                                                                                                             |
| `organization_list_for_user`                 | GET (auth)         | Σε ποιους φορείς έχει δικαιώματα ο συνδεδεμένος χρήστης. Αφορά μόνο editors.                                                                                                                                              |
| `organization_create` / `_update` / `_patch` | POST (write, auth) | Δημιουργία/τροποποίηση φορέα. Εκτός scope.                                                                                                                                                                                |
| `organization_follower_list` / `_count`      | GET                | Ποιοι χρήστες "ακολουθούν" έναν φορέα (social feature του CKAN, σπάνια χρήσιμο για data access).                                                                                                                          |

## 6. Groups — ομάδες θεματικές (μη χρησιμοποιούμενες εδώ)

Το CKAN έχει επιπλέον από τα organizations μια δεύτερη ταξινόμηση, τα **groups** (θεματικές συλλογές, π.χ. "Υγεία", "Περιβάλλον", ανεξάρτητα από ποιος φορέας τα δημοσίευσε). Στο data.gov.gr **δεν χρησιμοποιούνται καθόλου** — `group_list` ✅ γυρνάει άδειο array. Τα endpoints `group_show`, `group_package_show`, `group_autocomplete`, `group_create/update/patch` κ.λπ. υπάρχουν στο CKAN core αλλά δεν έχουν αντικείμενο σε αυτή την εγκατάσταση — δεν αξίζει να υλοποιηθούν.

## 7. Tags & Vocabularies — ετικέτες και ελεγχόμενα λεξιλόγια

| Ενέργεια                           | Μέθοδος            | Τι κάνει σε απλά λόγια                                                                                                                                                                             |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tag_list` ✅                      | GET                | Όλες οι ελεύθερες ετικέτες (tags) που έχουν μπει σε datasets — π.χ. "Αρχαιολογία", "Νοσοκομεία", ελεύθερο κείμενο, όχι ελεγχόμενο λεξιλόγιο.                                                       |
| `tag_search` ✅                    | GET                | Αναζήτηση ετικετών που περιέχουν ένα substring (δοκιμάστηκε `query=covid` → 0 αποτελέσματα, τα σχετικά datasets χρησιμοποιούν διαφορετικά tags).                                                   |
| `tag_show`                         | GET                | Λεπτομέρειες μιας ετικέτας + ποια datasets την έχουν.                                                                                                                                              |
| `tag_autocomplete`                 | GET                | Autocomplete tag καθώς πληκτρολογείς.                                                                                                                                                              |
| `vocabulary_list` ✅               | GET                | Λίστα **ελεγχόμενων λεξιλογίων** — π.χ. δοκιμάστηκε και βρέθηκε "Access right" με τιμές όπως `CONFIDENTIAL`. Αυτά είναι πεδία τυποποιημένα κατά το EU DCAT-AP πρότυπο (βλ. §9), όχι ελεύθερα tags. |
| `vocabulary_show`                  | GET                | Οι τιμές ενός συγκεκριμένου λεξιλογίου.                                                                                                                                                            |
| `tag_create` / `vocabulary_create` | POST (write, auth) | Εκτός scope.                                                                                                                                                                                       |

## 8. Users, Followers, Config, Misc — διαχειριστικά/κοινωνικά, όχι δεδομένα

Αυτές οι κατηγορίες αφορούν τη διαχείριση της πλατφόρμας ή κοινωνικά χαρακτηριστικά (ποιος ακολουθεί ποιον), **όχι** την ανάκτηση δημόσιων δεδομένων — γι' αυτό δεν αναλύονται ενέργεια-προς-ενέργεια όσο τα παραπάνω:

- **Users** (`user_list`, `user_show`, `user_create`, ...): λογαριασμοί χρηστών της πλατφόρμας (κυρίως δημόσιοι υπάλληλοι που ανεβάζουν δεδομένα). Άσχετο με ένα read-only MCP.
- **Followers** (`follow_dataset`, `dataset_follower_list`, ...): "ακολούθα ένα dataset για ειδοποιήσεις" — social feature, απαιτεί login.
- **API Tokens** (`api_token_create`, `api_token_list`): διαχείριση των δικών σου API keys — θα χρειαστεί μόνο αν το my-mcp αποκτήσει ποτέ write-access.
- **Config** (`config_option_show/list/update`): ρυθμίσεις της ίδιας της εγκατάστασης CKAN — διαχειριστικό, όχι δεδομένα.
- **Misc χρήσιμα:**
  - `status_show` ✅ — "healthcheck" endpoint: έκδοση CKAN, ενεργά extensions. Καλό για ένα MCP tool τύπου "είναι online το data.gov.gr;".
  - `license_list` ✅ — όλες οι άδειες χρήσης δεδομένων που εμφανίζονται στα datasets (π.χ. Creative Commons Attribution, "Η άδεια δεν έχει καθοριστεί"). Χρήσιμο ώστε ένας agent να εξηγήσει σε τι όρους επιτρέπεται η χρήση ενός dataset.
  - `help_show` — επιστρέφει το docstring μιας ενέργειας. Χρήσιμο μόνο για developers, όχι για end-user tools.
  - `term_translation_show` — μεταφράσεις UI strings. Άσχετο με δεδομένα.

## 9. Ελληνικά-συγκεκριμένα πεδία μέσα στα datasets

Το `package_show` ✅ γυρνάει, πέρα από τα τυπικά πεδία του CKAN, μια σειρά **custom πεδία** που προσθέτει η εγκατάσταση data.gov.gr μέσω των extensions `dcat`, `scheming_datasets`, `data_gov_gr` (ορατά στη λίστα extensions του `status_show`). Αυτά ευθυγραμμίζουν τα datasets με το ευρωπαϊκό πρότυπο **DCAT-AP** και τη νομοθεσία περί **High-Value Datasets (HVD)**:

- `access_rights` — δικαίωμα πρόσβασης (π.χ. `PUBLIC`), σε μορφή URI του EU Publications Office.
- `frequency` — πόσο συχνά ανανεώνεται το dataset (π.χ. `NOT_PLANNED`, ή ημερήσια/μηνιαία).
- `hvd_category` — αν το dataset ανήκει σε μία από τις κατηγορίες "υψηλής αξίας δεδομένων" της ΕΕ (γεωχωρικά, γη-παρατήρηση, εταιρείες, κ.λπ.) — αυτά έχουν αυξημένες νομικές υποχρεώσεις δωρεάν & μηχανικά αναγνώσιμης διάθεσης.
- `dcat_type` — τύπος dataset κατά DCAT-AP.
- `language_options` — γλώσσα περιεχομένου (π.χ. `ELL` = Ελληνικά).

Αν το MCP επεκταθεί ώστε να εκθέτει αυτά τα πεδία, ένας agent θα μπορούσε να απαντήσει ερωτήματα τύπου "ποια datasets είναι υποχρεωτικά δωρεάν βάσει HVD;" χωρίς να τα κατεβάσει όλα και να τα ελέγξει ένα-ένα.

## 10. Προτάσεις — τι αξίζει να προστεθεί μετά

Με βάση τη ζωντανή δοκιμή, τα πιο αξιόλογα endpoints που **λείπουν** σήμερα από το `ckan.ts`, σε σειρά χρησιμότητας για έναν AI agent:

1. **`resource_search`** — αναζήτηση αρχείων by format/ιδιότητα ανεξάρτητα από dataset· κάλυψη σήμερα: καμία.
2. **`organization_show`** / **`organization_list`** — "ποιοι φορείς δημοσιεύουν δεδομένα" και "τι έχει δημοσιεύσει ο Δήμος Χανίων" — θυμηθείτε να καλέσετε `organization_list` με **POST**, όχι GET, λόγω του WAF quirk στο §1.
3. **`license_list`** — φτηνό, στατικό, βοηθάει τον agent να εξηγήσει όρους χρήσης χωρίς hallucination.
4. **`package_search` με `facet.field`** — δίνει στατιστικά ("πόσα datasets ανά φορέα/tag") χωρίς να τραβήξεις όλα τα αποτελέσματα· ήδη διαθέσιμο μέσω του υπάρχοντος `searchDatasets`, αλλά δεν εκτίθεται σήμερα το facet param.
5. **`status_show`** — ένα ελαφρύ healthcheck tool.

Τα υπόλοιπα (groups, followers, users, config, write-ενέργειες) δεν προσφέρουν αξία σε έναν read-only, δημόσια-δεδομένα MCP και μπορούν να αγνοηθούν.
