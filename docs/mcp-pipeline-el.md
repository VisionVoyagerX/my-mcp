# Πώς λειτουργεί ένας MCP server, βήμα-βήμα — το παράδειγμα του ΓΕΜΗ

Αυτό το κείμενο εξηγεί τι ακριβώς συμβαίνει από τη στιγμή που ένας AI agent
ζητάει στοιχεία ελληνικής επιχείρησης μέχρι να πάρει πίσω μια απάντηση σε
JSON, χρησιμοποιώντας ως παράδειγμα την πραγματική υλοποίηση του ΓΕΜΗ (Γενικό
Εμπορικό Μητρώο) σε αυτό το repo. Αγγλική εκδοχή:
[mcp-pipeline-en.md](mcp-pipeline-en.md).

## Σύντομη επισκόπηση

Το MCP (Model Context Protocol) είναι ένα απλό πρωτόκολλο RPC που επιτρέπει
σε έναν AI agent να ανακαλύπτει και να καλεί "εργαλεία" (tools) που εκθέτει
ένας server. Σε αυτό το repo:

1. Το **`packages/core`** περιέχει έναν απλό TypeScript API client για κάθε
   κρατική υπηρεσία (χωρίς καμία γνώση του MCP) — ο `GemiClient` για το ΓΕΜΗ
   είναι ένας από αυτούς.
2. **Το `packages/core` έχει και την καταχώρηση των MCP tools** για τις
   περισσότερες υπηρεσίες, μεταξύ αυτών και το ΓΕΜΗ (`registerGemiTools`).
   Τυλίγει τις μεθόδους κάθε core client ως MCP _tools_ (`gemi_get_company`,
   `gemi_search_company_by_tin`, ...) με όνομα, περιγραφή και schema εισόδου
   που μπορεί να διαβάσει και να καλέσει ένα LLM — το `core` είναι το ένα και
   μοναδικό σημείο όπου ζουν και ο client και τα tools του, οπότε όποιο
   worker package θέλει tools ΓΕΜΗ εισάγει την ίδια `registerGemiTools`
   αντί να την ξαναγράφει.
3. **Το `packages/business-mcp`** είναι ένας λεπτός Cloudflare Worker: σε
   κάθε HTTP request χτίζει έναν καινούριο `McpServer`, καλεί
   `registerGemiTools(server, ...)` (και τα αντίστοιχα για τις άλλες
   υπηρεσίες που εκθέτει) για να τον γεμίσει, και συνδέει ένα **Streamable
   HTTP** transport που μιλάει JSON-RPC πάνω στο σώμα του request/response.
   Τίποτα εδώ δεν είναι stdio — πρόκειται για δημόσιο, απομακρυσμένο server.
4. Από κάτω, κάθε handler ενός tool καλεί τον core client, ο οποίος κάνει
   ένα πραγματικό HTTP request στο `opendata-api.businessportal.gr`,
   επικυρώνει τη μορφή της απάντησης με `zod`, και επιστρέφει typed δεδομένα
   — ή ένα δομημένο σφάλμα αν κάτι πάει στραβά.

Άρα το pipeline είναι:

```
Agent (Claude) ⇄ MCP Streamable HTTP ⇄ McpServer (business-mcp, ανά request)
                                            │
                                registerGemiTools(server, {apiKey, checkRateLimit})
                                            │
                                       GemiClient (core)
                                            │
                                  fetchJson()/fetchText() (core/http.ts)
                                            │
                              opendata-api.businessportal.gr (πραγματικό API)
```

Τώρα οι λεπτομέρειες, επίπεδο-επίπεδο.

---

## 1. Ο core client: επικοινωνία με το πραγματικό API

Το αρχείο
[`packages/core/src/gemi/client.ts`](../packages/core/src/gemi/client.ts)
ορίζει τον `GemiClient`, μια απλή κλάση **χωρίς καμία γνώση MCP ή
πρωτοκόλλου** — είναι απλώς ένας authenticated HTTP client για ένα κρατικό
API. Αυτός ο διαχωρισμός είναι σκόπιμος (βλ. την ενότητα "domain bundles"
στο `CLAUDE.md`): ο ίδιος client μπορεί να επαναχρησιμοποιηθεί από
οποιονδήποτε server θέλει δεδομένα ΓΕΜΗ, και μπορεί να testαριστεί χωρίς να
χρειάζεται καμία υποδομή MCP.

Βασικά σημεία:

- **Ρύθμιση** ([client.ts:74–78](../packages/core/src/gemi/client.ts#L74-L78)):
  το base URL και το API key έρχονται είτε από τις παραμέτρους του
  constructor, είτε (ελλείψει αυτών) από τις μεταβλητές περιβάλλοντος
  `GEMI_BASE_URL` / `GEMI_API_KEY`. Οι Cloudflare Workers δεν εκθέτουν
  secrets ως μεταβλητές περιβάλλοντος στυλ Node, οπότε το `business-mcp`
  περνάει πάντα το `apiKey` ρητά από το δικό του binding
  `env.GEMI_API_KEY`, αντί να βασίζεται στο fallback. Το ΓΕΜΗ απαιτεί API
  key που εγκρίνεται χειροκίνητα (όχι αυτόματη εγγραφή), οπότε αν λείπει σε
  οποιαδήποτε από τις δύο περιπτώσεις, η `headers()` πετάει ένα
  `GovApiError` με σαφές, χρήσιμο μήνυμα αντί να στείλει σιωπηλά ένα
  μη αυθεντικοποιημένο request
  ([client.ts:80–91](../packages/core/src/gemi/client.ts#L80-L91)).
- **Οι μέθοδοι αντιστοιχούν 1:1 σε endpoints του API.** Για παράδειγμα, η
  `searchCompanyByTin()` ([client.ts:108–121](../packages/core/src/gemi/client.ts#L108-L121))
  καλεί `GET /companies?afm=...`, και η `getCompany()`
  ([client.ts:124–130](../packages/core/src/gemi/client.ts#L124-L130)) καλεί
  `GET /companies/{registrationNumber}`. Υπάρχουν επίσης η
  `getCompanyDocuments()` και επτά μέθοδοι `list*()` για μεταδεδομένα
  (δραστηριότητες, νομοί, δήμοι, ...), όλες με την ίδια δομή.
- **Κάθε απάντηση επικυρώνεται με `zod`**, δεν γίνεται απλό cast. Η
  `getCompany` περνάει το ακατέργαστο JSON μέσα από το
  `GemiCompanySchema.parse(raw)`
  ([client.ts:129](../packages/core/src/gemi/client.ts#L129)) — αν η μορφή
  του API δεν ταιριάζει με το αναμενόμενο, πετάγεται σφάλμα αμέσως, αντί να
  δοθούν στον καλούντα κακοσχηματισμένα δεδομένα.

Τα ίδια τα schemas βρίσκονται στο
[`packages/core/src/gemi/types.ts`](../packages/core/src/gemi/types.ts).
Αξίζει να προσέξετε τα σχόλια που τεκμηριώνουν πού οι πραγματικές απαντήσεις
διέφεραν από το επίσημο Swagger spec — π.χ. το `arGemi` τεκμηριώνεται ως
integer αλλά στην πραγματικότητα είναι string σε production, οπότε το
schema δέχεται και τα δύο
([types.ts:78–81](../packages/core/src/gemi/types.ts#L78-L81)). Αυτή είναι η
πειθαρχία του project "επαλήθευσε με ζωντανό API, μην εμπιστεύεσαι μόνο τα
docs" που αναφέρεται στο `CLAUDE.md`, κωδικοποιημένη απευθείας στο επίπεδο
των types.

## 2. Η κοινή υποδομή HTTP

Κάθε core client (ΓΕΜΗ, Διαύγεια, myDATA, Εργάνη, ...) χτίζεται πάνω στα ίδια
δύο βοηθητικά functions στο
[`packages/core/src/http.ts`](../packages/core/src/http.ts):

- Η **`fetchText()`** ([http.ts:72–107](../packages/core/src/http.ts#L72-L107))
  τυλίγει το global `fetch`, προσθέτει timeout μέσω `AbortController`
  ([http.ts:48–49](../packages/core/src/http.ts#L48-L49)), ξανα-δοκιμάζει
  αυτόματα σε απαντήσεις `429` και `5xx` με exponential backoff (σεβόμενη το
  header `Retry-After` αν υπάρχει —
  [http.ts:95–96](../packages/core/src/http.ts#L95-L96)), και σε τελική
  αποτυχία πετάει ένα `GovApiError` που κουβαλάει το URL, το HTTP status, και
  ένα απόσπασμα του σώματος της απάντησης
  ([http.ts:99–106](../packages/core/src/http.ts#L99-L106)).
- Η **`fetchJson<T>()`** ([http.ts:110–132](../packages/core/src/http.ts#L110-L132))
  καλεί την `fetchText` και κάνει `JSON.parse` στο αποτέλεσμα, μετατρέποντας
  ένα μη-JSON σώμα σε ένα ακόμα `GovApiError` αντί για ένα αδιαφανές
  `SyntaxError`.

Η `GemiClient.getMetadata()` και κάθε δημόσια μέθοδος καλούν την `fetchJson`
και αμέσως μετά επικυρώνουν το αποτέλεσμα με ένα `zod` schema — τα ζητήματα
HTTP (timeouts, retries, σφάλματα μεταφοράς) και τα ζητήματα μορφής (μοιάζει
πράγματι με `GemiCompany` αυτό που ήρθε;) χειρίζονται σε δύο ξεκάθαρα
διαχωρισμένα επίπεδα. Και τα δύο βοηθητικά functions χτίζονται πάνω σε Web
Standard `fetch`/`AbortController`, οπότε τρέχουν αυτούσια και σε Node.js και
σε Cloudflare Worker — καμία πλατφορμο-εξαρτημένη διακλάδωση πουθενά στο
`core`.

## 3. Μετατροπή του client σε MCP tools

Εδώ μπαίνει στην εικόνα το MCP, και συμβαίνει μέσα στο ίδιο το `core`, όχι σε
κάποιο κατάντη (downstream) server package.

Το αρχείο
[`packages/core/src/gemi/tools.ts`](../packages/core/src/gemi/tools.ts)
το κάνει αυτό για το ΓΕΜΗ. Η `registerGemiTools(server, options)`
([tools.ts:69](../packages/core/src/gemi/tools.ts#L69)) δημιουργεί έναν
`GemiClient` (που επαναχρησιμοποιείται σε όλες τις κλήσεις — η ρύθμιση/
σύνδεση γίνεται μία φορά, όχι σε κάθε request) και καλεί τη
`server.registerTool(...)` τέσσερις φορές, μία ανά tool. Ας δούμε συγκεκριμένα
το `gemi_get_company`
([tools.ts:135–168](../packages/core/src/gemi/tools.ts#L135-L168)):

```ts
server.registerTool(
  "gemi_get_company",
  {
    title: "Get a ΓΕΜΗ company",
    description: "Fetch full ΓΕΜΗ ... details for a single Greek business ...",
    inputSchema: {
      registrationNumber: z
        .string()
        .min(1)
        .describe(
          'The company\'s ΓΕΜΗ registration number, e.g. "000237954001".',
        ),
    },
  },
  async ({ registrationNumber }) => {
    const limited = await rateLimitError();
    if (limited) return limited;
    try {
      const company = await client.getCompany(registrationNumber);
      return {
        content: [{ type: "text", text: JSON.stringify(company, null, 2) }],
      };
    } catch (error) {
      return toolErrorResult(
        error,
        `Failed to fetch ΓΕΜΗ company "${registrationNumber}"`,
      );
    }
  },
);
```

Τέσσερα πράγματα έχουν σημασία εδώ:

1. **Το `name`, `title`, `description`, και `inputSchema` είναι ακριβώς αυτά
   που βλέπει ο LLM agent όταν ζητάει τη λίστα των tools.** Η περιγραφή είναι
   γραμμένη για το μοντέλο, όχι για κάποιον που διαβάζει τον κώδικα — λέει τι
   κάνει το tool, πότε να το χρησιμοποιήσει αντί για κάποιο άλλο (π.χ. "χρησι-
   μοποίησε πρώτα το `gemi_search_company_by_tin` αν έχεις μόνο το ΑΦΜ"), και
   ποιες προϋποθέσεις πρέπει να ισχύουν (να είναι ρυθμισμένο το
   `GEMI_API_KEY`). Το `inputSchema` είναι ένα `zod` schema· το SDK το
   μετατρέπει σε JSON Schema για τον agent και επικυρώνει τα εισερχόμενα
   ορίσματα πριν καν τρέξει ο handler.
2. **Η `rateLimitError()` τρέχει πριν από κάθε κλήση προς το upstream API.**
   Το `api_key` του ΓΕΜΗ έχει όριο 8 requests/λεπτό _συνολικά_, όχι ανά
   καλούντα, οπότε σε μια δημόσια multi-tenant εγκατάσταση όπως το
   `business-mcp` κάθε επισκέπτης μοιράζεται το ίδιο όριο. Η
   `registerGemiTools` δέχεται μια προαιρετική callback `checkRateLimit`
   ([tools.ts:37–53](../packages/core/src/gemi/tools.ts#L37-L53))· όταν ο
   καλών (ο worker) δίνει μία, υποστηριζόμενη από ένα Cloudflare binding
   `ratelimit`, κάθε handler το ελέγχει πρώτα και επιστρέφει ένα χρήσιμο
   μήνυμα "συνολικό όριο εξαντλήθηκε" αντί να καλέσει ποτέ τον `GemiClient`.
   Είναι προαιρετικό ακριβώς ώστε οι single-tenant καλούντες να μη χρειάζεται
   να ρυθμίσουν κάτι που δεν τους χρειάζεται.
3. **Ο handler είναι ένας λεπτός προσαρμογέας (adapter)**, όχι business
   logic: καλεί την ήδη-επικυρωμένη μέθοδο του `GemiClient` και μετατρέπει το
   αποτέλεσμα σε κείμενο. Όλη η ουσιαστική δουλειά (HTTP, retries, επικύρωση
   απάντησης) έχει ήδη γίνει στο `core`.
4. **Τα σφάλματα ποτέ δεν ρίχνουν τον server ούτε επιστρέφουν ακατέργαστο
   stack trace.** Κάθε handler τυλίγει την κλήση του σε `try/catch` και
   περνάει τις αποτυχίες μέσα από την `toolErrorResult()` από το
   [`packages/core/src/tool-result.ts`](../packages/core/src/tool-result.ts).
   Αυτή η βοηθητική συνάρτηση
   ([tool-result.ts:31–40](../packages/core/src/tool-result.ts#L31-L40))
   μετατρέπει ένα `GovApiError` σε μήνυμα που περιλαμβάνει το HTTP status και
   ένα απόσπασμα του σώματος της απάντησης — αρκετό ώστε ο agent να ξεχωρίσει
   "λείπει το API key" από "η επιχείρηση δεν βρέθηκε" — και θέτει
   `isError: true` ώστε ο MCP client να ξέρει ότι πρόκειται για αποτυχία, όχι
   για κανονική απάντηση.

Αξίζει επίσης μια ματιά στο `gemi_list_metadata`
([tools.ts:209–245](../packages/core/src/gemi/tools.ts#L209-L245)):
αντί να εκθέτει επτά σχεδόν πανομοιότυπα tools (ένα ανά λίστα
μεταδεδομένων), εκθέτει ένα tool με παράμετρο `category` τύπου enum, και
κάνει dispatch εσωτερικά μέσω της `fetchMetadata()`
([tools.ts:18–35](../packages/core/src/gemi/tools.ts#L18-L35)).
Αυτό κρατάει τη λίστα των tools — και άρα το context window του agent —
μικρή, χωρίς απώλεια λειτουργικότητας.

## 4. Σύνδεση των tools σε έναν server, και του server σε ένα transport

Το αρχείο
[`packages/business-mcp/src/worker.ts`](../packages/business-mcp/src/worker.ts)
είναι ολόκληρο το entry point — και σε αντίθεση με έναν stdio server που
ξεκινάει μία φορά και τρέχει για πάντα, αυτό είναι ο handler `fetch` ενός
Cloudflare Worker, που καλείται από την αρχή για κάθε εισερχόμενο HTTP
request:

```ts
async function handleRequest(request: Request, env: Env): Promise<Response> {
  // ...CORS preflight, /icon.svg, έλεγχος per-IP rate limit...

  const server = new McpServer({ name: "business-mcp", version: "0.1.0", ... });

  registerDiavgeiaTools(server, { framing: FRAMING });
  registerGemiTools(server, {
    framing: FRAMING,
    apiKey: env.GEMI_API_KEY,
    checkRateLimit: () => env.GEMI_RATE_LIMITER.limit({ key: "gemi-global" }),
  });
  // ...registerMyDataTools, registerErganiTools με τις επιλογές credential-store...

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  // ...προσθήκη headers CORS, επιστροφή response...
}
```

Ο `McpServer` είναι η υλοποίηση του πρωτοκόλλου από το SDK: ξέρει πώς να
απαντάει σε αιτήματα JSON-RPC τύπου `tools/list` και `tools/call` αφού έχουν
καταχωρηθεί σε αυτόν τα tools. Οι κλήσεις `registerGemiTools(server, ...)`
κ.λπ. απλώς γεμίζουν αυτό το μητρώο (registry) — αυτός είναι ακριβώς και ο
λόγος που η αρχιτεκτονική "domain bundles" του `CLAUDE.md` λειτουργεί καθαρά:
ένας _διαφορετικός_ worker
([`packages/citizen-mcp`](../packages/citizen-mcp)) εισάγει την ίδια ακριβώς
`registerDiavgeiaTools` από το `core` και καταλήγει με τα ίδια tools
Διαύγειας, χωρίς να διπλασιάζεται καμία λογική, παρότι εκθέτει ένα εντελώς
διαφορετικό σύνολο άλλων tools (CKAN αντί για ΓΕΜΗ/myDATA/Εργάνη).

Το `WebStandardStreamableHTTPServerTransport` είναι αυτό που πραγματικά
μεταφέρει τα bytes: διαβάζει ένα αίτημα JSON-RPC από το σώμα του
εισερχόμενου `Request` και γράφει την απάντηση πάνω σε ένα `Response` —
χωρίς `stdin`/`stdout`, χωρίς μόνιμη διεργασία. Το να χτίζεται ένας
καινούριος `McpServer` ανά request (αντί για ένα μακρόβιο instance) είναι
αυτό που το κάνει ασφαλές να τρέχει multi-tenant: τίποτα από το request ενός
καλούντα δεν μπορεί να διαρρεύσει σε άλλον, και δεν υπάρχει session state
που να χρειάζεται ακύρωση. Το `WebStandardStreamableHTTPServerTransport`
είναι χτισμένο εξ ολοκλήρου πάνω σε Web Standard `Request`/`Response`, οπότε
η ίδια ακριβώς κλάση transport δουλεύει αυτούσια σε Cloudflare Workers,
Node.js 18+, Deno, ή Bun — μόνο ο γύρω `fetch` handler (bindings rate-limit,
secrets ως env vars, αναζητήσεις KV) είναι εξαρτημένος από το Cloudflare.

## 5. Ολόκληρη η πορεία ενός request/response, συγκεκριμένα

Συνοψίζοντας, αυτό ακριβώς συμβαίνει όταν ένας agent καλεί το
`gemi_get_company` με `{ "registrationNumber": "000237954001" }` στον
αναρτημένο (deployed) worker `business-mcp`:

1. Ο MCP client του agent στέλνει ένα μήνυμα JSON-RPC `tools/call` ως HTTP
   `POST` στο URL του worker.
2. Ο worker ελέγχει πρώτα το per-IP binding `RATE_LIMITER`, πριν τρέξει
   καθόλου λογική MCP· αν έχει εξαντληθεί, το request δεν φτάνει ποτέ στον
   `McpServer`.
3. Χτίζεται ένας καινούριος `McpServer` και γεμίζει μέσω των
   `registerDiavgeiaTools`/`registerGemiTools`/κ.λπ., έπειτα συνδέεται σε ένα
   `WebStandardStreamableHTTPServerTransport`, το οποίο κάνει parse το σώμα
   του request ως το μήνυμα JSON-RPC.
4. Ο `McpServer` (εσωτερικά στο SDK) εντοπίζει το καταχωρημένο tool με όνομα
   `gemi_get_company`, επικυρώνει τα ορίσματα βάσει του `inputSchema`
   (`{ registrationNumber: z.string().min(1) }`), και καλεί τον handler από
   το [tools.ts:153–167](../packages/core/src/gemi/tools.ts#L153-L167).
5. Ο handler καλεί την `rateLimitError()` — το συνολικό όριο 8/λεπτό του
   ΓΕΜΗ, μέσω της callback `checkRateLimit` που έδωσε ο worker. Αν κι αυτό
   είναι ελεύθερο, καλεί το `client.getCompany("000237954001")`.
6. Η `GemiClient.getCompany()` ([client.ts:124–130](../packages/core/src/gemi/client.ts#L124-L130))
   φτιάχνει το URL, προσθέτει το header `api_key` μέσω της `headers()`, και
   καλεί την `fetchJson()`.
7. Η `fetchJson()` → `fetchText()` ([http.ts:72–132](../packages/core/src/http.ts#L72-L132))
   κάνει το πραγματικό HTTPS request στο
   `opendata-api.businessportal.gr/api/opendata/v1/companies/000237954001`,
   με timeout 15 δευτερολέπτων και αυτόματο retry σε `429`/`5xx`.
8. Το ακατέργαστο JSON γίνεται parse και επικυρώνεται βάσει του
   `GemiCompanySchema` ([types.ts:76–113](../packages/core/src/gemi/types.ts#L76-L113)).
   Αν περάσει την επικύρωση, ένα typed αντικείμενο `GemiCompany` επιστρέφει
   μέσα από τον client.
9. Ο handler του tool κάνει `JSON.stringify` το αποτέλεσμα σε ένα block
   κειμένου και επιστρέφει `{ content: [{ type: "text", text: "..." }] }`.
10. Ο `McpServer` το σειριοποιεί ως απάντηση JSON-RPC· το transport τη γράφει
    πάνω στο σώμα του HTTP `Response` (ως μήνυμα `text/event-stream`),
    προστίθενται headers CORS, και ο client του agent το διαβάζει ως το
    αποτέλεσμα του tool.

Αν στο βήμα 2 ή 5 χτυπήσει κάποιο rate limit, ή αν το βήμα 6/7/8 αποτύχει για
οποιονδήποτε λόγο (δεν υπάρχει API key, πρόβλημα δικτύου, μη-2xx status,
κακοσχηματισμένο JSON, ασυμφωνία με το schema), το αντίστοιχο `catch`/έλεγχος
το πιάνει και επιστρέφει ένα αποτέλεσμα κειμένου με `isError: true` (ή, για
το βήμα 2, μια απλή HTTP απάντηση `429`) αντί — ο agent βλέπει ένα σαφές
μήνυμα αποτυχίας, αντί ο server να καταρρεύσει ή να σπάσει η σύνδεση.

## Γιατί έχει σημασία αυτή η διαστρωμάτωση (layering)

- **Το `core` δεν έχει καμία εξάρτηση από πλατφόρμα στην πλευρά του client**
  — ο `GemiClient` και το `http.ts` χρησιμοποιούν μόνο Web Standard APIs,
  οπότε τρέχουν αυτούσια σε Node.js ή σε Cloudflare Worker. Το `core`
  εξαρτάται όντως από το `@modelcontextprotocol/sdk` (σε αντίθεση με μια
  απλή client library), ακριβώς ώστε να μοιράζεται και η ίδια η λογική
  καταχώρησης tools, όχι μόνο ο HTTP client — η `registerXTools` κάθε
  υπηρεσίας ζει εδώ μία φορά, και κάθε worker package που θέλει αυτά τα
  tools εισάγει την ίδια συνάρτηση αντί να την ξαναγράφει.
- **Η επικύρωση γίνεται μία φορά, στο σύνορο με το πραγματικό API**, όχι
  διάσπαρτη μέσα σε handlers tools — μέχρι να φτάσει μια τιμή `GemiCompany`
  σε έναν handler, είναι εγγυημένο ότι ταιριάζει με το schema.
- **Οι handlers των tools είναι ομοιόμορφοι**: δημιουργία client,
  (προαιρετικά) έλεγχος rate limit, κλήση μεθόδου, σειριοποίηση επιτυχίας σε
  κείμενο, δρομολόγηση κάθε σφάλματος μέσω της `toolErrorResult`. Αφού
  διαβάσετε έναν (`gemi_get_company`), ουσιαστικά έχετε διαβάσει όλους, σε
  κάθε υπηρεσία αυτού του repo.
- **Οι περιγραφές είναι πρωτεύον μέρος του κώδικα**, όχι τεκμηρίωση — είναι
  αυτό που χρησιμοποιεί ο agent για να αποφασίσει _ποιο_ tool να καλέσει και
  _πώς_, οπότε γράφονται και ελέγχονται με αυτό το κοινό (audience) στο
  μυαλό.
- **Τα ζητήματα εξαρτημένα από την πλατφόρμα (secrets, bindings rate-limit,
  αποθήκευση KV) μένουν στο worker package**, και περνιούνται στην
  καταχώρηση tools του `core` ως απλές επιλογές/callbacks (`apiKey`,
  `checkRateLimit`, `credentialStore`) — το `core` ποτέ δεν εισάγει το
  `@cloudflare/workers-types` ούτε αναφέρεται απευθείας στο `env`.
