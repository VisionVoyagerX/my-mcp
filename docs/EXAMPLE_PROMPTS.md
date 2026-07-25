# GreekGovMCP — Example Prompts

Copy and paste these examples into your MCP client (Claude Desktop, etc.) to get started with GreekGovMCP.

---

## English Examples

### 1. Search Recent Procurement Decisions from a Ministry

**Prompt:**

```
Search for procurement decisions from the Ministry of Education issued in May 2026.
Use organizationUid: "100037417" and a date range from May 1 to May 31.
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: A list of recent procurement decisions from that organization, with ADA codes you can use to dig deeper.

---

### 2. Find Decisions by Type

**Prompt:**

```
Show me the 20 most recent "Β.1.1" type decisions (procurement decisions).
Use decisionTypeUid: "Β.1.1" and size: 20.
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: Procurement decisions, up to 20 results, with the newest first.

---

### 3. Free-Text Search for Specific Content

**Prompt:**

```
Search Diavgeia for decisions about "προμήθεια γραφικής ύλης" (office supplies purchase).
Return 15 results per page.
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: Decisions whose subject or text contains the search term, ranked by relevance (newest first).

---

### 4. Get Full Details for a Specific Decision

**Prompt:**

```
Fetch the complete details for decision ADA: 6ΣΦ4ΩΞΧ-ΑΒΓ
```

**Tool used**: `diavgeia_get_decision`

**What to expect**: Full record including subject, date, organization, protocol number, decision type, status, and link to the PDF document.

---

### 5. Paginate Through Search Results

**Prompt:**

```
Search for decisions from organization "100037417" starting from January 1, 2026.
Show page 2 with 25 results per page (page 0 = first page, page 1 = second page, etc.).
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: The second page of results (results 26-50), helping you explore beyond the first 10 or 25 results.

---

### 6. Narrow Search by Date Range Only

**Prompt:**

```
Find all decisions issued between July 15, 2026 and July 20, 2026.
Limit to 50 results per page.
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: A broad list of all decisions in that week, useful for compliance checks or audit trails.

---

### 7. Search by Signer

**Prompt:**

```
Show decisions signed by signer UID "100091120" in the last month (June 1 - July 1, 2026).
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: All decisions signed by that official, filtered by date.

---

### 8. Combine Multiple Filters

**Prompt:**

```
Find procurement decisions (Β.1.1) from the Ministry of Finance (organizationUid: 100051613)
issued between March 1 and April 30, 2026. Show 30 results per page.
```

**Tool used**: `diavgeia_search_decisions`

**What to expect**: A focused result set combining organization, decision type, and date range filters.

---

## Greek Examples / Παραδείγματα στα Ελληνικά

### 1. Αναζήτηση Πρόσφατων Αποφάσεων Διαγωνισμών από Υπουργείο

**Prompt:**

```
Αναζήτησε αποφάσεις διαγωνισμών (προμήθειας) του Υπουργείου Παιδείας που εκδόθηκαν
τον Μάιο 2026. Χρησιμοποίησε organizationUid: "100037417" με εύρος ημερομηνιών
1 Μαΐου έως 31 Μαΐου.
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Λίστα πρόσφατων αποφάσεων διαγωνισμών από αυτό το Υπουργείο,
με κωδικούς ADA που μπορείς να χρησιμοποιήσεις για περισσότερες λεπτομέρειες.

---

### 2. Αναζήτηση Αποφάσεων Συγκεκριμένου Τύπου

**Prompt:**

```
Δείξε μου τις 20 πιο πρόσφατες αποφάσεις τύπου "Β.1.1" (αποφάσεις διαγωνισμών).
Χρησιμοποίησε decisionTypeUid: "Β.1.1" και size: 20.
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Αποφάσεις διαγωνισμών, έως 20 αποτελέσματα, με τις πιο πρόσφατες πρώτα.

---

### 3. Ελεύθερη Αναζήτηση Κειμένου

**Prompt:**

```
Αναζήτησε στη Διαύγεια αποφάσεις για "προμήθεια γραφικής ύλης" (αγορά χαρτικών).
Επέστρεψε 15 αποτελέσματα ανά σελίδα.
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Αποφάσεις που περιέχουν το ζητούμενο κείμενο,
ταξινομημένες με τις πιο πρόσφατες πρώτα.

---

### 4. Λήψη Πλήρων Λεπτομερειών για Μία Απόφαση

**Prompt:**

```
Λήψε όλες τις λεπτομέρειες της απόφασης με κωδικό ADA: 6ΣΦ4ΩΞΧ-ΑΒΓ
```

**Εργαλείο**: `diavgeia_get_decision`

**Αναμενόμενο αποτέλεσμα**: Πλήρης καταχώρηση με τίτλο, ημερομηνία, οργανισμό,
αριθμό πρωτοκόλλου, τύπο απόφασης, κατάσταση και σύνδεσμο προς το PDF έγγραφο.

---

### 5. Περιήγηση στις Σελίδες Αποτελεσμάτων

**Prompt:**

```
Αναζήτησε αποφάσεις από τον οργανισμό "100037417" ξεκινώντας από 1 Ιανουαρίου 2026.
Δείξε σελίδα 2 με 25 αποτελέσματα ανά σελίδα (σελίδα 0 = πρώτη σελίδα, σελίδα 1 = δεύτερη κ.λπ.).
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Η δεύτερη σελίδα αποτελεσμάτων (αποτελέσματα 26-50),
βοηθά να εξερευνήσεις πέρα από τα πρώτα 10 ή 25 αποτελέσματα.

---

### 6. Στένεψε την Αναζήτηση ανά Εύρος Ημερομηνιών

**Prompt:**

```
Βρες όλες τις αποφάσεις που εκδόθηκαν μεταξύ 15 Ιουλίου 2026 και 20 Ιουλίου 2026.
Περιόρισε σε 50 αποτελέσματα ανά σελίδα.
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Ευρεία λίστα όλων των αποφάσεων εκείνης της εβδομάδας,
χρήσιμη για ελέγχους συμμόρφωσης ή ελέγχους δοσοληψιών.

---

### 7. Αναζήτηση ανά Υπογράφοντα

**Prompt:**

```
Δείξε αποφάσεις που υπέγραψε ο υπογράφων με UID "100091120"
το τελευταίο μήνα (1 Ιουνίου - 1 Ιουλίου 2026).
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Όλες οι αποφάσεις που υπέγραψε αυτός ο υπάλληλος,
φιλτραρισμένες ανά ημερομηνία.

---

### 8. Συνδυασμός Πολλαπλών Φίλτρων

**Prompt:**

```
Βρες αποφάσεις διαγωνισμών (Β.1.1) από το Υπουργείο Οικονομικών
(organizationUid: 100051613) που εκδόθηκαν μεταξύ 1 Μαρτίου και 30 Απριλίου 2026.
Δείξε 30 αποτελέσματα ανά σελίδα.
```

**Εργαλείο**: `diavgeia_search_decisions`

**Αναμενόμενο αποτέλεσμα**: Εστιασμένο σύνολο αποτελεσμάτων που συνδυάζει
φιλτράρισμα οργανισμού, τύπου απόφασης και εύρος ημερομηνιών.

---

## Tips for Success

- **Known organization UIDs**: Common organizations to use in filters:
  - Ministry of Education: `100037417`
  - Ministry of Finance: `100051613`
  - (Find more by searching and noting the `organizationId` in results)

- **Common decision types**:
  - `Β.1.1` = Procurement decisions (common to search)
  - (Diavgeia supports hundreds of types; experiment with `decisionTypeUid`)

- **ADA codes**: Always 13 characters with Greek letters and numbers (e.g., `6ΣΦ4ΩΞΧ-ΑΒΓ`). Get them from search results.

- **Pagination**: Always 0-based. Page 0 = first 10 (or your custom size). Page 1 = next 10, etc.

- **Rate limiting**: GreekGovMCP uses IP-based rate limiting. Don't hammer it; reasonable use is fine.

---

## Κατευθυντήριες οδηγίες για Επιτυχία

- **Γνωστά UID οργανισμών**: Κοινοί οργανισμοί προς χρήση σε φίλτρα:
  - Υπουργείο Παιδείας: `100037417`
  - Υπουργείο Οικονομικών: `100051613`
  - (Βρες περισσότερα αναζητώντας και σημειώνοντας το `organizationId` στα αποτελέσματα)

- **Κοινοί τύποι αποφάσεων**:
  - `Β.1.1` = Αποφάσεις διαγωνισμών (συνηθισμένο να αναζητήσουμε)
  - (Η Διαύγεια υποστηρίζει εκατοντάδες τύπους· δοκίμασε διαφορετικές τιμές `decisionTypeUid`)

- **Κωδικοί ADA**: Πάντα 13 χαρακτήρες με ελληνικά γράμματα και αριθμούς (π.χ., `6ΣΦ4ΩΞΧ-ΑΒΓ`). Λάβε τους από αποτελέσματα αναζήτησης.

- **Σελιδοποίηση**: Πάντα 0-based. Σελίδα 0 = πρώτα 10 (ή το προσαρμοσμένο μέγεθος σας). Σελίδα 1 = επόμενα 10 κ.λπ.

- **Περιορισμός ρυθμού**: Το GreekGovMCP χρησιμοποιεί περιορισμό ρυθμού που βασίζεται στη διεύθυνση IP. Μην το χτυπήσεις δυσκολά· η λογική χρήση είναι εντάξει.
