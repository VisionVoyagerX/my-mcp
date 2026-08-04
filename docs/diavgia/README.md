# Diavgeia API — Πώς λειτουργεί στο my-mcp

Αναλυτική περιγραφή, σε απλή γλώσσα, του πώς τα εργαλεία στο `packages/core/src/diavgeia/` καλούν το API της Διαύγειας: τι κάνει κάθε endpoint, εντολές για δοκιμή, το πλήρες επίσημο API σε σχέση με ό,τι υλοποιούμε, δυνατότητες και περιορισμούς.

> **Ενημέρωση 2026-07-23:** Αυτή η αναθεώρηση υλοποιεί **όλα** τα read-only endpoints του Opendata API (όλα εκτός από τα 3 που απαιτούν HTTP Basic Auth ανά φορέα δημοσίευσης — βλ. §3). Στην πορεία εντοπίστηκαν και διορθώθηκαν **3 πραγματικά bugs**, το σοβαρότερο εκ των οποίων έκανε το `fromDate`/`toDate` filter του `diavgeia_search_decisions` πλήρως ανενεργό — βλ. §3.1 παρακάτω. Κάθε endpoint σε αυτό το έγγραφο δοκιμάστηκε live· η πλήρης λίστα με τα καλέσματα δοκιμής ανά endpoint είναι στο §6.

## 1. Τι είναι η Διαύγεια

Η **Διαύγεια** είναι η επίσημη πλατφόρμα διαφάνειας του ελληνικού δημοσίου: κάθε δημόσια απόφαση (εγκρίσεις προϋπολογισμού, προμήθειες, διορισμοί, πληρωμές) πρέπει από τον νόμο να αναρτηθεί εκεί πριν αποκτήσει νομική ισχύ. Κάθε απόφαση παίρνει έναν μοναδικό κωδικό, τον **ADA** (Αριθμός Διαδικτυακής Ανάρτησης), και ένα υπογεγραμμένο PDF.

Η Διαύγεια εκθέτει αυτά τα δεδομένα μέσω ενός δωρεάν, χωρίς αυθεντικοποίηση (no-auth), read-only API που ονομάζεται **Opendata**. Δεν υπάρχει επίσημο Swagger/OpenAPI spec δημοσιευμένο στο GitHub — το GitHub org της Διαύγειας (`github.com/diavgeia`) φιλοξενεί μόνο τρία repos με sample clients (Python, PHP, Java), το καθένα με έναν μικρό reference client που καλεί κάθε υποστηριζόμενο endpoint. Ο Python client (`opendata-client-samples-python/opendata.py`) είναι ό,τι πιο κοντινό σε επίσημη τεκμηρίωση υπάρχει, και σε αυτόν επαληθεύτηκαν το base URL και τα paths όλων των endpoints.

**Base URL** που χρησιμοποιείται σε αυτό το repo:

```
https://diavgeia.gov.gr/luminapi/opendata
```

Μπορεί να αλλάξει μέσω του env var `DIAVGEIA_BASE_URL` (π.χ. για να δείξει στο sandbox `test3.diavgeia.gov.gr` της ίδιας της Διαύγειας).

## 2. Τα 15 εργαλεία

Κάθε εργαλείο παρακάτω είναι ένα λεπτό wrapper: χτίζει ένα query string, καλεί ένα ή περισσότερα endpoints της Διαύγειας, επικυρώνει το JSON με ένα Zod schema, και το μορφοποιεί ώστε να το διαβάσει ένας AI agent. Ομαδοποιημένα κατά θέμα:

### Αποφάσεις (decisions)

| Εργαλείο                            | Endpoint(s)                                                | Τι κάνει                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diavgeia_search_decisions`         | `GET /search/advanced`                                     | Αναζήτηση με σύνταξη Lucene. Φιλτράρισμα κατά φορέα, τύπο, υπογράφοντα, εύρος ημερομηνίας έκδοσης. **Διορθώθηκε σε αυτή την αναθεώρηση — βλ. §3.1.**                                         |
| `diavgeia_simple_search_decisions`  | `GET /search`                                              | Αναζήτηση με απλές παραμέτρους λέξεων-κλειδιών (ada, subject, protocol, term, org, unit, signer, type, tag) αντί για Lucene. Έχει **δύο ανεξάρτητα** φίλτρα ημερομηνίας — βλ. §3.2. **Νέο.** |
| `diavgeia_get_decision`             | `GET /decisions/{ada}/`<br>`GET /decisions/v/{versionId}/` | Πλήρες αρχείο μιας απόφασης, κατά ADA ή κατά συγκεκριμένο versionId (για ιστορική/διορθωμένη έκδοση). **Επεκτάθηκε** ώστε να δέχεται είτε `ada` είτε `versionId`.                            |
| `diavgeia_get_decision_version_log` | `GET /decisions/{ada}/versionlog`                          | Πλήρες ιστορικό εκδόσεων μιας απόφασης (αρχική δημοσίευση + διορθώσεις). **Νέο.**                                                                                                            |

### Φορείς (organizations)

| Εργαλείο                            | Endpoint(s)                        | Τι κάνει                                                                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diavgeia_get_organization`         | `GET /organizations/{uid}/`        | Βασικά μεταδεδομένα ενός φορέα (όνομα, κατηγορία, ΑΦΜ, website).                                                                                                                                                                      |
| `diavgeia_get_organization_details` | `GET /organizations/{uid}/details` | Πλήρη στοιχεία σε ένα κάλεσμα: ταυτότητα + μονάδες + υπογράφοντες + θέσεις + εποπτευόμενοι φορείς. **Νέο.** Καλύπτει επίσης τα `/organizations/{uid}/signers` και `/organizations/{uid}/positions` — βλ. σημείωση σχεδίασης στο §3.3. |
| `diavgeia_get_organization_units`   | `GET /organizations/{uid}/units`   | Μονάδες φορέα, με επιλογή `descendants=children\|all`. **Νέο** — έχει τιμή πέρα από το `details` επειδή το `details` πάντα επιστρέφει `all`.                                                                                          |
| `diavgeia_search_organizations`     | `GET /organizations`               | Περιήγηση φορέων κατά status/category, client-side σελιδοποίηση.                                                                                                                                                                      |
| `diavgeia_get_unit`                 | `GET /units/{id}/`                 | Μία μονάδα κατά UID — αποκωδικοποιεί τα `unitIds` μιας απόφασης. **Νέο.**                                                                                                                                                             |
| `diavgeia_get_signer`               | `GET /signers/{id}/`               | Ένας υπογράφων κατά UID — αποκωδικοποιεί τα `signerIds` μιας απόφασης. **Νέο.**                                                                                                                                                       |

### Τύποι αποφάσεων & λεξικά (reference data)

| Εργαλείο                             | Endpoint(s)                                                                       | Τι κάνει                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `diavgeia_list_decision_types`       | `GET /types`                                                                      | Λίστα όλων (~35) των εγκύρων `decisionTypeUid`.                                                                                                                          |
| `diavgeia_get_decision_type_details` | `GET /types/{typeUid}/details`                                                    | Σχήμα `extraFieldValues` για έναν τύπο: ποια πεδία απαιτούνται, τύπος δεδομένων, έγκυρες τιμές, `searchTerm`. **Νέο.**                                                   |
| `diavgeia_list_search_terms`         | `GET /search/terms`<br>`GET /search/terms/common`<br>`GET /types/{typeUid}/terms` | Λίστα πεδίων αναζήτησης — όλα, μόνο τα κοινά (`commonOnly=true`), ή μόνο όσα ισχύουν για έναν τύπο (`decisionTypeUid=...`). **Νέο**, ενοποιεί 3 endpoints σε 1 εργαλείο. |
| `diavgeia_get_dictionary`            | `GET /dictionaries`<br>`GET /dictionaries/{name}`                                 | Χωρίς `name`: λίστα λεξικών αναφοράς. Με `name`: στοιχεία ενός λεξικού (π.χ. ORG_CATEGORY, CPV). **Νέο**, ενοποιεί 2 endpoints σε 1 εργαλείο.                            |
| `diavgeia_list_positions`            | `GET /positions`                                                                  | Όλες οι θέσεις (~25.000, global, unfiltered) σε κάθε φορέα· client-side σελιδοποίηση. **Νέο.**                                                                           |

**Δοκιμή μέσω MCP Inspector** (γενική μορφή· δείτε §6 για τα ακριβή ορίσματα κάθε δοκιμής):

```bash
# από τη ρίζα του repo: ξεκινήστε το citizen-mcp worker τοπικά
# (χρειάζεται Node 22+ για το wrangler)
pnpm --filter @my-mcp/citizen-mcp run dev   # http://localhost:8787

# σε άλλο τερματικό:
npx @modelcontextprotocol/inspector --cli http://localhost:8787 \
  --method tools/call --tool-name <όνομα εργαλείου> --tool-arg <παράμετρος>=<τιμή>
```

## 3. Ευρήματα αυτής της αναθεώρησης

### 3.1 Bug: `fromDate`/`toDate` στο `diavgeia_search_decisions` δεν έκαναν ΤΙΠΟΤΑ

Πριν από αυτή την αναθεώρηση, το `searchDecisions()` έστελνε `fromDate`/`toDate` ως ξεχωριστές HTTP παραμέτρους (`from_date`/`to_date`) μαζί με το Lucene `q` στο `GET /search/advanced`. Ζωντανή δοκιμή (2026-07-23) απέδειξε ότι **η Διαύγεια αγνοεί σιωπηλά αυτές τις παραμέτρους σε αυτό το endpoint** — το ίδιο `total` αποτέλεσμα επιστρεφόταν είτε δίναμε `from_date=2020-01-01` είτε `from_date=2030-01-01` (μελλοντική ημερομηνία που θα έπρεπε λογικά να δώσει 0 αποτελέσματα):

```bash
# και οι δύο επιστρέφουν total: 2778 — το from_date δεν επηρεάζει τίποτα
curl ".../search/advanced?q=organizationUid:\"100037417\"&from_date=2020-01-01&size=1"
curl ".../search/advanced?q=organizationUid:\"100037417\"&from_date=2030-01-01&size=1"
```

**Ο πραγματικός μηχανισμός:** το `/search/advanced` δεν έχει καθόλου παραμέτρους `from_date`/`to_date` — ένα εύρος ημερομηνίας εκφράζεται **μόνο** ως ρήτρα Lucene μέσα στο ίδιο το `q`, με τη μορφή `issueDate:[DT(...) TO DT(...)]` (η μορφή `DT(YYYY-MM-DDTHH:mm:ss)` απαιτείται — bare ISO ημερομηνίες ή ανοιχτά όρια με `*` επιστρέφουν 400 `InvalidQuertSyntaxException`):

```bash
curl ".../search/advanced?q=organizationUid:\"100037417\"%20AND%20issueDate:[DT(2020-01-01T00:00:00)%20TO%20DT(2020-01-10T23:59:59)]&size=1"
# → total: 39 — τώρα φιλτράρει σωστά
```

**Επιπλέον, ζωντανή δοκιμή αποκάλυψε ένα σκληρό, μη τεκμηριωμένο όριο:** η Διαύγεια κόβει **σιωπηλά** οποιοδήποτε εύρος `issueDate` στις **180 ημέρες** — ζητώντας `2020-01-01` έως `2020-12-31` (365 ημέρες), το `info.query` της απάντησης έδειχνε ότι το αίτημα ξαναγράφτηκε σε `2020-01-01` έως `2020-06-29` (180 ημέρες), χωρίς κανένα σφάλμα:

```json
{
  "query": "... issueDate:[DT(2020-01-01T00:00:00) TO DT(2020-06-29T23:59:59)] ...",
  "total": 1065
}
```

**Η διόρθωση εδώ:**

- Το `fromDate`/`toDate` του `diavgeia_search_decisions` τώρα χτίζει σωστά τη ρήτρα `issueDate:[DT(...) TO DT(...)]` μέσα στο `q`.
- Αν το εύρος ξεπερνά τις 180 ημέρες, το εργαλείο **αποτυγχάνει με σαφές μήνυμα** αντί να επιστρέψει σιωπηλά περικομμένα αποτελέσματα — καλύτερο UX από το να αντιγράψουμε την σιωπηλή συμπεριφορά της Διαύγειας.
- Αν δοθεί μόνο `fromDate`, το `toDate` προεπιλέγει σε `fromDate + 180 ημέρες` (και αντίστροφα) — δεδομένου ότι η Διαύγεια δεν δέχεται ανοιχτά όρια (`*`).
- Για μεγαλύτερα ιστορικά διαστήματα, χρειάζονται διαδοχικά καλέσματα των 180 ημερών.

### 3.2 Το `/search` (simple search) έχει ΔΥΟ ανεξάρτητα φίλτρα ημερομηνίας

Σε αντίθεση με το `/search/advanced`, το `GET /search` (το πίσω μέρος του `diavgeia_simple_search_decisions`) **δέχεται πραγματικά** `from_date`/`to_date` και `from_issue_date`/`to_issue_date` ως ξεχωριστές παραμέτρους — επαληθεύτηκε ζωντανά μέσω του `info.query` στην απάντηση, που επιστρέφει την πλήρη Lucene ρήτρα που κατασκευάστηκε:

```json
{
  "query": "submissionTimestamp:[DT(2020-01-01...) TO DT(2020-12-31...)] AND issueDate:[DT(2026-01-24...) TO DT(2026-07-23...)] AND organizationUid:\"100037417\" AND status:\"Αναρτημένη\"",
  "total": 0
}
```

Το σημαντικό εύρημα: **`fromDate`/`toDate` ελέγχει το `submissionTimestamp` (πότε υποβλήθηκε/τροποποιήθηκε), ενώ `fromIssueDate`/`toIssueDate` ελέγχει το `issueDate` (πότε εκδόθηκε αρχικά) — και τα δύο ΑΝΕΞΑΡΤΗΤΑ προεπιλέγουν σε παράθυρο ~6 μηνών όταν παραλείπονται, ενωμένα με AND.** Αν δώσετε μόνο `fromIssueDate=2020-01-01`, το `submissionTimestamp` παραμένει στο προεπιλεγμένο παράθυρο των τελευταίων 6 μηνών — άρα θα βρείτε μόνο _πρόσφατα τροποποιημένες_ παλιές αποφάσεις (π.χ. διορθώσεις), όχι όλες τις αποφάσεις του 2020. Για γνήσια παλιά δεδομένα πρέπει να διευρύνετε **και τα δύο** ζεύγη ταυτόχρονα — δοκιμάστηκε live: 2.774 (μόνο πρόσφατο παράθυρο) → 1.053 (`fromIssueDate=2020`, `fromDate` ακόμα στο default) → ίδιο 1.053 όταν διευρύνθηκε επιπλέον και το `fromDate`/`toDate` σε ευρύ εύρος. Αυτό τεκμηριώνεται στην περιγραφή του εργαλείου.

### 3.3 Σχεδιαστική επιλογή: ενοποίηση αντί για 1-προς-1 mapping endpoint→εργαλείο

Το `GET /organizations/{uid}/details` επιστρέφει ήδη ενσωματωμένα τα `units`, `signers`, `positions`, `supervisedOrganizations` σε μία απάντηση (επαληθεύτηκε live). Τα ξεχωριστά `GET /organizations/{uid}/signers` και `GET /organizations/{uid}/positions` επιστρέφουν πανομοιότυπο σχήμα με ό,τι ήδη περιέχει το `/details` και δεν προσφέρουν επιπλέον παραμέτρους. Αντί να εκθέσουμε 2 επιπλέον, ουσιαστικά περιττά εργαλεία (κάτι που θα φούσκωνε άσκοπα το tool surface που βλέπει ο agent — βλ. αρχή CLAUDE.md για την πολιτική domain-bundles), δοκιμάστηκαν ζωντανά και τα δύο endpoints για να επιβεβαιωθεί η ισοδυναμία, αλλά **δεν εκτέθηκαν ως ξεχωριστά MCP tools** — το `diavgeia_get_organization_details` τα καλύπτει.

Αντίθετα, το `GET /organizations/{uid}/units` **διατηρήθηκε** ως ξεχωριστό εργαλείο (`diavgeia_get_organization_units`) επειδή έχει πραγματική πρόσθετη αξία: υποστηρίζει `descendants=children` (προεπιλογή) έναντι `descendants=all`, ενώ το `/details` πάντα επιστρέφει το ισοδύναμο του `all` (επαληθεύτηκε live: 27 vs 46 μονάδες για τον ίδιο φορέα).

Ομοίως, το bare `GET /types/{typeUid}/` (χωρίς `/details`) δοκιμάστηκε ζωντανά αλλά δεν έγινε ξεχωριστό εργαλείο — είναι πλήρως υποσύνολο του ήδη υπάρχοντος `diavgeia_list_decision_types` (uid/label/parent/allowedInDecisions), το οποίο ήδη φέρνει όλους τους ~35 τύπους σε μία κλήση.

## 4. Bugs που εντοπίστηκαν και διορθώθηκαν

Πέρα από το κύριο bug του §3.1, η ζωντανή δοκιμή αποκάλυψε 2 ακόμα σημεία όπου τα πραγματικά δεδομένα της Διαύγειας δεν ταίριαζαν με τις υποθέσεις του αρχικού σχήματος:

1. **`unitDomains` μπορεί να είναι `null`, όχι μόνο `[]`.** Στο `GET /organizations/{uid}/details`, ορισμένες μονάδες επιστρέφουν `"unitDomains": null` αντί για κενό πίνακα — το αρχικό schema απαιτούσε πίνακα και το validation απέτυχε σε πραγματικό φορέα (Ελληνικό Κτηματολόγιο, μονάδες index 6-7). Διορθώθηκε σε `z.array(z.string()).nullable()`.
2. **`label` σε ένα extraField μπορεί να είναι `null`.** Στο `GET /types/Β.1.1/details`, το πεδίο `documentType` επιστρέφει `"label": null` (έχει μόνο `searchTerm`, χωρίς ανθρώπινο τίτλο) — το schema απαιτούσε string και το validation απέτυχε. Διορθώθηκε σε `z.string().nullable()`, με το εργαλείο να πέφτει πίσω στο `uid` όταν λείπει η ετικέτα.

Και τα δύο θα είχαν προκαλέσει το ίδιο σφάλμα που έδειξε το §3.1: μια απάντηση 200 από τη Διαύγεια απορρίπτεται στο Zod validation και το εργαλείο αποτυγχάνει με "expected X, received null" — γι' αυτό κάθε νέο endpoint δοκιμάστηκε με πραγματικά, όχι υποθετικά, δεδομένα πριν θεωρηθεί έτοιμο.

## 5. Το πλήρες επίσημο API σε σχέση με ό,τι υλοποιούμε

| Endpoint                                | Τι κάνει                                  | Υλοποιημένο εδώ;                                                                                                   |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/search/advanced`                      | Αναζήτηση σε σύνταξη Lucene               | ✅ `diavgeia_search_decisions`                                                                                     |
| `/search`                               | Απλή αναζήτηση με λέξεις-κλειδιά          | ✅ `diavgeia_simple_search_decisions`                                                                              |
| `/search/terms`, `/search/terms/common` | Λίστα έγκυρων πεδίων αναζήτησης           | ✅ `diavgeia_list_search_terms`                                                                                    |
| `/decisions/{ada}/`                     | Μία απόφαση                               | ✅ `diavgeia_get_decision`                                                                                         |
| `/decisions/v/{versionId}/`             | Απόφαση κατά έκδοση                       | ✅ `diavgeia_get_decision` (`versionId` param)                                                                     |
| `/decisions/{ada}/versionlog`           | Πλήρες ιστορικό αναθεωρήσεων              | ✅ `diavgeia_get_decision_version_log`                                                                             |
| `/organizations`                        | Περιήγηση φορέων κατά status/category     | ✅ `diavgeia_search_organizations`                                                                                 |
| `/organizations/{uid}/`                 | Ένας φορέας                               | ✅ `diavgeia_get_organization`                                                                                     |
| `/organizations/{uid}/details`          | Εκτεταμένα στοιχεία φορέα                 | ✅ `diavgeia_get_organization_details`                                                                             |
| `/organizations/{uid}/signers`          | Υπογράφοντες φορέα                        | ✅ δοκιμάστηκε live, καλύπτεται από `diavgeia_get_organization_details` (βλ. §3.3)                                 |
| `/organizations/{uid}/positions`        | Θέσεις φορέα                              | ✅ δοκιμάστηκε live, καλύπτεται από `diavgeia_get_organization_details` (βλ. §3.3)                                 |
| `/organizations/{uid}/units`            | Υπο-μονάδες φορέα                         | ✅ `diavgeia_get_organization_units`                                                                               |
| `/units/{id}/`                          | Απευθείας αναζήτηση μονάδας               | ✅ `diavgeia_get_unit`                                                                                             |
| `/signers/{id}/`                        | Απευθείας αναζήτηση υπογράφοντα           | ✅ `diavgeia_get_signer`                                                                                           |
| `/positions`                            | Όλες οι θέσεις (global)                   | ✅ `diavgeia_list_positions`                                                                                       |
| `/types`                                | Λίστα τύπων αποφάσεων                     | ✅ `diavgeia_list_decision_types`                                                                                  |
| `/types/{id}/`                          | Ένας τύπος                                | ✅ δοκιμάστηκε live, καλύπτεται από `diavgeia_list_decision_types`/`diavgeia_get_decision_type_details` (βλ. §3.3) |
| `/types/{id}/details`                   | Τύπος + κανόνες επικύρωσης/επιπλέον πεδία | ✅ `diavgeia_get_decision_type_details`                                                                            |
| `/types/{id}/terms`                     | Πεδία αναζήτησης έγκυρα για έναν τύπο     | ✅ `diavgeia_list_search_terms` (`decisionTypeUid` param)                                                          |
| `/dictionaries`, `/dictionaries/{name}` | Λεξιλόγιο αναφοράς                        | ✅ `diavgeia_get_dictionary`                                                                                       |
| `POST /decisions`                       | Δημοσίευση νέας απόφασης                  | 🔒 απαιτεί αυθεντικοποίηση — εκτός εμβέλειας                                                                       |
| `POST /decisions/{ada}`                 | Επεξεργασία δημοσιευμένης απόφασης        | 🔒 απαιτεί αυθεντικοποίηση — εκτός εμβέλειας                                                                       |
| `POST /decisions/requests/revocations`  | Αίτημα ανάκλησης απόφασης                 | 🔒 απαιτεί αυθεντικοποίηση — εκτός εμβέλειας                                                                       |

**Κάθε read endpoint του Opendata API είναι πλέον υλοποιημένο.** Τα endpoints εγγραφής (write) απαιτούν διαπιστευτήρια HTTP Basic Auth ανά φορέα δημοσίευσης — η Διαύγεια είναι και σύστημα δημοσίευσης για τους φορείς, όχι μόνο read API. Αυτό το MCP περιορίζεται στην read πλευρά, σύμφωνα με τον κανόνα του repo για ρητό (explicit) auth pattern ανά υπηρεσία, αντί να τον "ενοποιεί" ψεύτικα.

## 6. Αναφορά δοκιμών — κάθε κλήση που δοκιμάστηκε, ανά endpoint

Όλες οι δοκιμές έγιναν live στο `https://diavgeia.gov.gr/luminapi/opendata` στις 2026-07-23, τόσο με απευθείας `curl` (για να επαληθευτεί η ακριβής συμπεριφορά του upstream API πριν γραφτεί ο client) όσο και μέσω `npx @modelcontextprotocol/inspector --cli node packages/bundle-transparency/dist/index.js --method tools/call ...` (για να επαληθευτεί ολόκληρο το MCP tool, από είσοδο έως μορφοποιημένη έξοδο· ιστορική εγγραφή — το πακέτο `bundle-transparency` έχει έκτοτε αντικατασταθεί από το `citizen-mcp`, δείτε §2 για την τρέχουσα εντολή δοκιμής).

### `GET /search/advanced` — `diavgeia_search_decisions`

- Βασική αναζήτηση κατά `organizationUid=100037417`, `size=2` → 2.778 αποτελέσματα, σωστή μορφοποίηση με σύνδεσμο PDF.
- **Regression test του bug fix:** `organizationUid=100037417`, `fromDate=2020-01-01`, `toDate=2020-01-10` → 39 αποτελέσματα, ημερομηνίες 2020-01-10 (πριν τη διόρθωση θα επέστρεφε αποφάσεις 2026, αγνοώντας τα date params).
- **180-day cap:** `organizationUid=100037417`, `fromDate=2020-01-01`, `toDate=2020-12-31` (366 ημέρες) → σαφές σφάλμα πελάτη αντί για σιωπηλή περικοπή.

### `GET /search` — `diavgeia_simple_search_decisions`

- `protocol=2633807`, `org=100037417` → 1 αποτέλεσμα, σωστό ADA.
- `org=100037417`, `fromDate=2010-01-01`, `toDate=2026-12-31`, `fromIssueDate=2020-01-01`, `toIssueDate=2020-12-31` → 1.053 αποτελέσματα (πρώτη προσπάθεια timeout στα 15s λόγω εύρους ερωτήματος· επιβεβαιώθηκε με `curl` ότι το ίδιο ερώτημα χρειάζεται ~14s upstream — οριακό αλλά όχι σπασμένο· η δεύτερη προσπάθεια μέσω MCP πέτυχε).

### `GET /search/terms`, `/search/terms/common`, `/types/{typeUid}/terms` — `diavgeia_list_search_terms`

- Χωρίς παραμέτρους → 86 πεδία αναζήτησης συνολικά.
- `commonOnly=true` → 18 κοινά πεδία.
- `decisionTypeUid=Β.1.1` → 7 πεδία ειδικά για τον τύπο "ΕΓΚΡΙΣΗ ΠΡΟΥΠΟΛΟΓΙΣΜΟΥ".

### `GET /decisions/{ada}/` — `diavgeia_get_decision`

- `ada=9ΒΒΦ46ΜΨΦΖ-ΝΚ0` → πλήρες αρχείο απόφασης (Ελληνικό Κτηματολόγιο, τύπος Β.5).
- **Error path:** `ada=0000000000-0000` (ανύπαρκτο) → σαφές σφάλμα `HTTP 404 ResourceNotFoundException`.
- **Validation:** χωρίς `ada` ούτε `versionId` → σφάλμα "provide exactly one"· με ΚΑΙ τα δύο → ίδιο σφάλμα.

### `GET /decisions/v/{versionId}/` — `diavgeia_get_decision`

- `versionId=5e490151-d3ec-43e3-8447-07ad45960865` → ίδια απόφαση με το `ada=9ΒΒΦ46ΜΨΦΖ-ΝΚ0` (επιβεβαιώνει ότι το versionId αντιστοιχεί σωστά).

### `GET /decisions/{ada}/versionlog` — `diavgeia_get_decision_version_log`

- `ada=9ΒΒΦ46ΜΨΦΖ-ΝΚ0` → 1 έκδοση, status PUBLISHED.

### `GET /organizations/{uid}/` — `diavgeia_get_organization`

- `organizationUid=100037417` → πλήρη μεταδεδομένα (ΕΛΛΗΝΙΚΟ ΚΤΗΜΑΤΟΛΟΓΙΟ, NPDD, active).

### `GET /organizations/{uid}/details` — `diavgeia_get_organization_details`

- `organizationUid=100037417` (μικρός φορέας) → 46 μονάδες, 59 υπογράφοντες, 22 θέσεις, 0 εποπτευόμενοι — εντοπίστηκε και διορθώθηκε το bug `unitDomains: null` σε αυτή τη δοκιμή.
- `organizationUid=100054486` (Υπουργείο Ψηφιακής Διακυβέρνησης, μεγάλος φορέας) → 317 μονάδες, 229 υπογράφοντες, 12 εποπτευόμενοι φορείς — επιβεβαίωσε την ανάγκη για client-side cap στην έξοδο (βλ. §3.3-adjacent design fix: cap 25 items + "...και N ακόμα").

### `GET /organizations/{uid}/units` — `diavgeia_get_organization_units`

- `organizationUid=100037417` (χωρίς `descendants`) → 27 άμεσες μονάδες.
- `organizationUid=100037417`, `descendants=all` → 46 μονάδες (επιβεβαιώνει τη διαφορά από το `/details`).
- `organizationUid=100054486`, `descendants=all` → 317 μονάδες, ~23KB κειμένου πριν το cap — επιβεβαίωσε την ανάγκη για cap 50 items εδώ επίσης.

### `GET /organizations/{uid}/signers` — δοκιμάστηκε live (χωρίς ξεχωριστό tool, βλ. §3.3)

- `organizationUid=100037417` → 59 υπογράφοντες, ίδιο σχήμα με το ενσωματωμένο `signers` στο `/details`.

### `GET /organizations/{uid}/positions` — δοκιμάστηκε live (χωρίς ξεχωριστό tool, βλ. §3.3)

- `organizationUid=100037417` → 22 θέσεις, ίδιο σχήμα με το ενσωματωμένο `positions` στο `/details`.

### `GET /organizations` — `diavgeia_search_organizations`

- `category=MINISTRY`, `size=3` → 21 υπουργεία συνολικά, 3 πρώτα εμφανίστηκαν.

### `GET /units/{id}/` — `diavgeia_get_unit`

- `unitId=73040` → ΓΕΝΙΚΗ ΔΙΕΥΘΥΝΣΗ, active.

### `GET /signers/{id}/` — `diavgeia_get_signer`

- `signerId=102984` → ΚΩΝΣΤΑΝΤΙΝΟΣ ΑΓΡΟΓΙΑΝΝΗΣ, θέσεις σε 2 μονάδες.

### `GET /positions` — `diavgeia_list_positions`

- Χωρίς παραμέτρους (πρώτη σελίδα) → 25.082 θέσεις συνολικά, 10 εμφανίστηκαν.

### `GET /types` — `diavgeia_list_decision_types`

- Χωρίς παραμέτρους → 35 τύποι, σωστά ομαδοποιημένοι ανά κατηγορία.

### `GET /types/{typeUid}/` — δοκιμάστηκε live (χωρίς ξεχωριστό tool, βλ. §3.3)

- `Β.1.1` → `{"uid":"Β.1.1","label":"ΕΓΚΡΙΣΗ ΠΡΟΥΠΟΛΟΓΙΣΜΟΥ","parent":"2.4.2","allowedInDecisions":true}`.

### `GET /types/{typeUid}/details` — `diavgeia_get_decision_type_details`

- `decisionTypeUid=Β.1.1` → 7 πρόσθετα πεδία, σωστή αναδρομή σε nested field (`relatedDecisions` → `relatedDecisionsADA`) — εντοπίστηκε και διορθώθηκε το bug `label: null` σε αυτή τη δοκιμή.

### `GET /dictionaries` — `diavgeia_get_dictionary`

- Χωρίς `name` → 19 λεξικά.

### `GET /dictionaries/{name}` — `diavgeia_get_dictionary`

- `name=ORG_CATEGORY` → 22 στοιχεία (NPID, NPDD, MINISTRY, ...).

### `GET /decisions`, `GET /decisions/{ada}`, `POST /decisions/requests/revocations` (write) — εκτός εμβέλειας

- Δεν δοκιμάστηκαν — απαιτούν HTTP Basic Auth ανά φορέα δημοσίευσης που αυτό το MCP δεν κατέχει. Επιβεβαιώθηκε από το `opendata.py` reference client ότι είναι τα μόνα 3 endpoints του Opendata API που απαιτούν αυθεντικοποίηση.

## 7. Δυνατότητες (Features)

- **Αυτόματο retry με backoff.** Απαντήσεις 429/502/503/504 ξαναδοκιμάζονται έως δύο φορές με exponential backoff, τηρώντας το header `Retry-After` όταν υπάρχει — γίνεται μία φορά στο `http.ts` για κάθε κλήση στη Διαύγεια.
- **Timeout 15 δευτερολέπτων ανά αίτημα**, ώστε ένα κολλημένο upstream request να μην κρατήσει όλη την κλήση του MCP εργαλείου. Σημείωση: πολύ ευρέα `diavgeia_simple_search_decisions` ερωτήματα (πολυετές `fromDate`/`toDate` εύρος) μπορεί να πλησιάσουν αυτό το όριο — δοκιμάστηκε upstream στα ~14s για ένα 16-ετές εύρος.
- **Επικυρωμένες απαντήσεις με schema.** Κάθε απάντηση περνάει από Zod schema πριν φτάσει στον agent· δύο πραγματικά schema gaps (§4) εντοπίστηκαν ακριβώς έτσι, με σαφές σφάλμα αντί για σιωπηλά παραμορφωμένα δεδομένα.
- **Δίγλωσσες (Ελληνικά/Αγγλικά) περιγραφές εργαλείων και έξοδος.** Κάθε τίτλος εργαλείου, περιγραφή παραμέτρου και γραμμή αποτελέσματος γράφεται πρώτα στα ελληνικά με αγγλική μετάφραση, μιας και πρόκειται για δεδομένα του ελληνικού δημοσίου.
- **Client-side pagination εκεί που το API δεν έχει.** Τα `/organizations` και `/positions` αγνοούν page/size server-side· η `searchOrganizations()`/`listPositions()` φέρνουν όλο το σύνολο μία φορά και το τεμαχίζουν τοπικά.
- **Cap στην έξοδο μεγάλων ενσωματωμένων λιστών.** Το `diavgeia_get_organization_details` και το `diavgeia_get_organization_units` κόβουν την εμφανιζόμενη λίστα (25 / 50 στοιχεία αντίστοιχα, με "...και N ακόμα") για μεγάλα υπουργεία (300+ μονάδες, 200+ υπογράφοντες) ώστε ένα κάλεσμα να μη γεμίσει το context ενός agent, κρατώντας πάντα το ακριβές σύνολο.
- **Σαφές σφάλμα πελάτη αντί για σιωπηλή περικοπή upstream.** Το `diavgeia_search_decisions` αρνείται ρητά ένα `fromDate`/`toDate` εύρος πάνω από 180 ημέρες, αντί να επιτρέψει στη Διαύγεια να το κόψει σιωπηλά (§3.1).
- **Ενοποιημένα εργαλεία αντί για 1-προς-1 endpoint mapping** όπου τα endpoints είναι ουσιαστικά υποσύνολα άλλων (§3.3) — 20 read endpoints καλύπτονται από 15 εργαλεία, χωρίς απώλεια λειτουργικότητας.

## 8. Περιορισμοί (Limitations)

- **Η αναζήτηση ελεύθερου κειμένου δεν μπορεί να είναι μεμονωμένος όρος.** Ο Lucene parser της Διαύγειας γυρνάει 400 σε unfielded query — επιβεβαιώθηκε live. Αυτό το repo το παρακάμπτει τυλίγοντας πάντα το ελεύθερο κείμενο ως `content:"..."`.
- **Το `/search/advanced` δεν έχει native from_date/to_date HTTP params** (§3.1) — ένα εύρος ημερομηνίας εκφράζεται μόνο ως ρήτρα Lucene στο `q`, και είναι σκληρά περιορισμένο στις 180 ημέρες ανά κλήση. Χωρίς φίλτρο ημερομηνίας, η προεπιλογή της Διαύγειας είναι ~6 μήνες.
- **Το `/search` (simple search) έχει δύο ανεξάρτητα default παράθυρα ~6 μηνών** (§3.2) — για γνήσια παλιά δεδομένα κατά ημερομηνία έκδοσης χρειάζεται να διευρυνθούν ΚΑΙ τα δύο ζεύγη `fromDate`/`toDate` και `fromIssueDate`/`toIssueDate`.
- **Τουλάχιστον ένα φίλτρο είναι υποχρεωτικό** στα `diavgeia_search_decisions`, `diavgeia_simple_search_decisions`, και `diavgeia_search_organizations`. Η Διαύγεια αρνείται ένα unfiltered request αντί να σελιδοποιήσει ολόκληρο το index της — το repo σηκώνει σαφές σφάλμα στην πλευρά του client αντί να στείλει ένα request που θα κάνει 400 ή θα κρεμάσει.
- **Δεν υπάρχει αναζήτηση φορέα με ελεύθερο κείμενο ονόματος.** Το `/organizations` φιλτράρει μόνο κατά status/category, ποτέ κατά όνομα — αν δεν ξέρεις ήδη ένα UID, περιηγείσαι σε μια κατηγορία, δεν "ψάχνεις για Υπουργείο Υγείας."
- **Η ονοματολογία πεδίων του ίδιου του API είναι ασυνεπής.** Τα φίλτρα αναζήτησης χρησιμοποιούν `organizationUid`/`decisionTypeUid`, αλλά το αντικείμενο απόφασης που επιστρέφεται χρησιμοποιεί `organizationId`/`decisionTypeId` για τις ίδιες τιμές — πραγματική ιδιορρυθμία στο API της Διαύγειας, που αποτυπώνεται όπως είναι αντί να "διορθώνεται" σιωπηλά.
- **Το `/positions` (global) είναι τεράστιο και unfiltered** (~25.000 εγγραφές, καμία server-side σελιδοποίηση) — χρήσιμο μόνο ως γενικό λεξικό ετικετών θέσεων, όχι για περιήγηση. Για τις θέσεις ενός συγκεκριμένου φορέα προτιμήστε το `diavgeia_get_organization_details`.
- **Ορισμένα ερωτήματα `diavgeia_simple_search_decisions` με πολύ ευρύ εύρος ημερομηνιών είναι αργά** (δοκιμάστηκε ~14 δευτ. upstream για 16-ετές εύρος) — οριακά μέσα στο default timeout των 15 δευτ.
- **Read-only.** Δημοσίευση, επεξεργασία ή ανάκληση απόφασης απαιτεί διαπιστευτήρια HTTP Basic Auth ανά φορέα που αυτό το MCP δεν κατέχει — συνεπές με τον κανόνα του repo για ρητό auth pattern ανά υπηρεσία, αντί να προσποιείται ενοποίηση.
- **Δεν υπάρχει επίσημο OpenAPI/Swagger spec.** Το GitHub org της Διαύγειας διαθέτει sample clients, όχι machine-readable spec — όλα εδώ ελέγχθηκαν σταυρωτά με τις πραγματικές HTTP κλήσεις του `opendata.py` και με live απαντήσεις, όχι μόνο με σελίδα τεκμηρίωσης.

## Πηγές

- [github.com/diavgeia/opendata-client-samples-python](https://github.com/diavgeia/opendata-client-samples-python) — reference client, base URL, πλήρης λίστα endpoints
- [opendata.py](https://github.com/diavgeia/opendata-client-samples-python/blob/master/opendata.py) — αντιστοίχιση method-προς-endpoint που χρησιμοποιήθηκε στον πίνακα του §5
- [github.com/diavgeia](https://github.com/diavgeia) — επισκόπηση org (3 repos: Python/PHP/Java samples, όχι docs/spec repo)
- `packages/core/src/diavgeia/client.ts`, `tools.ts`, `types.ts`, `http.ts` — η υλοποίηση αυτού του repo
- `packages/core/src/diavgeia/client.test.ts` — 46 unit tests, καλύπτουν και τα δύο bug fixes περιγραφή στο §3.1/§4
