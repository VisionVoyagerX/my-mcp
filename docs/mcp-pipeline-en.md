# How an MCP server works, end to end — the ΓΕΜΗ example

This walks through everything that happens between "an AI agent wants Greek
company data" and "it gets a JSON answer," using the real ΓΕΜΗ (business
registry) integration in this repo as the running example. Greek version:
[mcp-pipeline-el.md](mcp-pipeline-el.md).

## Brief overview

MCP (Model Context Protocol) is a small RPC protocol that lets an AI agent
discover and call "tools" exposed by a server. In this repo:

1. **`packages/core`** holds a plain TypeScript API client per government
   service (no MCP knowledge at all) — `GemiClient` for ΓΕΜΗ is one of these.
2. **`packages/core` also owns the MCP tool registration** for most
   services, including ΓΕΜΗ (`registerGemiTools`). It wraps each core
   client's methods as MCP _tools_ (`gemi_get_company`,
   `gemi_search_company_by_tin`, ...) with a name, description, and input
   schema an LLM can read and call — `core` is the one place both the client
   and its tools live, so any worker package that wants ΓΕΜΗ tools imports
   the same `registerGemiTools` function rather than reimplementing it.
3. **`packages/business-mcp`** is a thin Cloudflare Worker: on every HTTP
   request it builds a fresh `McpServer`, calls `registerGemiTools(server,
...)` (plus the other services it exposes) to populate it, and connects
   a **Streamable HTTP** transport that speaks JSON-RPC over the request/
   response body. Nothing is stdio here — this is a public, remote server.
4. Under the hood, each tool handler calls into the core client, which does
   a real HTTP request to `opendata-api.businessportal.gr`, validates the
   response shape with `zod`, and returns typed data — or a structured error
   if something goes wrong.

So the pipeline is:

```
Agent (Claude) ⇄ MCP Streamable HTTP ⇄ McpServer (business-mcp, per-request)
                                            │
                                registerGemiTools(server, {apiKey, checkRateLimit})
                                            │
                                       GemiClient (core)
                                            │
                                  fetchJson()/fetchText() (core/http.ts)
                                            │
                              opendata-api.businessportal.gr (real HTTP API)
```

Now the detail, layer by layer.

---

## 1. The core client: talking to the real API

[`packages/core/src/gemi/client.ts`](../packages/core/src/gemi/client.ts)
defines `GemiClient`, a plain class with **no MCP or protocol awareness at
all** — it's just an authenticated HTTP client for one government API. This
separation is deliberate (see `CLAUDE.md`'s "domain bundles" section): the
same client can be reused by any server that wants ΓΕΜΗ data, and it can be
unit-tested without spinning up any MCP machinery.

Key pieces:

- **Configuration** ([client.ts:74–78](../packages/core/src/gemi/client.ts#L74-L78)):
  the base URL and API key come from constructor options or fall back to
  `GEMI_BASE_URL` / `GEMI_API_KEY` environment variables. Cloudflare Workers
  don't expose secrets as Node-style env vars, so `business-mcp` always
  passes `apiKey` explicitly from its own `env.GEMI_API_KEY` binding rather
  than relying on the fallback. ΓΕΜΗ requires a manually-approved API key
  (no self-service), so if it's missing either way, `headers()` throws a
  `GovApiError` with an actionable message instead of silently sending an
  unauthenticated request
  ([client.ts:80–91](../packages/core/src/gemi/client.ts#L80-L91)).
- **Methods map 1:1 to API endpoints.** For example
  `searchCompanyByTin()` ([client.ts:108–121](../packages/core/src/gemi/client.ts#L108-L121))
  calls `GET /companies?afm=...`, and `getCompany()`
  ([client.ts:124–130](../packages/core/src/gemi/client.ts#L124-L130)) calls
  `GET /companies/{registrationNumber}`. There's also `getCompanyDocuments()`
  and seven `list*()` metadata lookups (activities, prefectures,
  municipalities, ...), all following the same shape.
- **Every response is validated with `zod`**, not just cast. `getCompany`
  parses the raw JSON through `GemiCompanySchema.parse(raw)`
  ([client.ts:129](../packages/core/src/gemi/client.ts#L129)); if the API's
  shape doesn't match what's expected, this throws immediately instead of
  handing the caller malformed data.

The schemas themselves live in
[`packages/core/src/gemi/types.ts`](../packages/core/src/gemi/types.ts).
Notice the comments documenting where live responses disagreed with the
official Swagger spec — e.g. `arGemi` is documented as an integer but is
actually a string in production, so the schema accepts both
([types.ts:78–81](../packages/core/src/gemi/types.ts#L78-L81)). This is the
project's "verify against a live API, don't trust the docs" discipline
mentioned in `CLAUDE.md`, encoded directly into the type layer.

## 2. The shared HTTP plumbing

Every core client (ΓΕΜΗ, Diavgeia, myDATA, Ergani, ...) is built on the same
two helpers in
[`packages/core/src/http.ts`](../packages/core/src/http.ts):

- **`fetchText()`** ([http.ts:72–107](../packages/core/src/http.ts#L72-L107))
  wraps the global `fetch`, adds a timeout via `AbortController`
  ([http.ts:48–49](../packages/core/src/http.ts#L48-L49)), retries `429` and
  `5xx` responses with exponential backoff (honoring a `Retry-After` header
  if present — [http.ts:95–96](../packages/core/src/http.ts#L95-L96)), and
  on a final failure throws a `GovApiError` carrying the URL, HTTP status,
  and a snippet of the response body
  ([http.ts:99–106](../packages/core/src/http.ts#L99-L106)).
- **`fetchJson<T>()`** ([http.ts:110–132](../packages/core/src/http.ts#L110-L132))
  calls `fetchText` and `JSON.parse`s the result, turning a non-JSON body
  into another `GovApiError` rather than an opaque `SyntaxError`.

`GemiClient.getMetadata()` and every public method call `fetchJson` and then
immediately validate the result with a `zod` schema — HTTP concerns
(timeouts, retries, transport errors) and shape concerns (does this actually
look like a `GemiCompany`?) are handled at two clearly separate layers. Both
helpers are built on Web Standard `fetch`/`AbortController`, so they run
identically in Node.js and in a Cloudflare Worker — no platform branching
anywhere in `core`.

## 3. Turning the client into MCP tools

This is where MCP actually enters the picture, and it happens inside `core`
itself, not in a downstream server package.

[`packages/core/src/gemi/tools.ts`](../packages/core/src/gemi/tools.ts)
does this for ΓΕΜΗ. `registerGemiTools(server, options)`
([tools.ts:69](../packages/core/src/gemi/tools.ts#L69)) constructs one
`GemiClient` (reused across all calls — connection/config setup happens
once, not per-request) and calls `server.registerTool(...)` four times, once
per tool. Take `gemi_get_company` as the concrete example
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

Four things matter here:

1. **The `name`, `title`, `description`, and `inputSchema` are exactly what
   the LLM agent sees when it lists tools.** The description is written for
   the model, not for a human reading source — it says what the tool does,
   when to use it instead of another tool (e.g. "use
   `gemi_search_company_by_tin` first if you only have the ΑΦΜ"), and what
   preconditions must hold (`GEMI_API_KEY` configured). `inputSchema` is a
   `zod` schema; the SDK converts it to JSON Schema for the agent and
   validates incoming arguments against it before the handler ever runs.
2. **`rateLimitError()` runs before any upstream call.** ΓΕΜΗ's `api_key`
   is capped at 30 requests/minute _in total_, not per caller, so on a
   public multi-tenant deployment like `business-mcp` every visitor shares
   one quota. `registerGemiTools` accepts an optional `checkRateLimit`
   callback ([tools.ts:37–53](../packages/core/src/gemi/tools.ts#L37-L53));
   when the caller (the worker) supplies one backed by a Cloudflare
   `ratelimit` binding, every handler checks it first and returns an
   actionable "shared limit reached" message instead of ever calling
   `GemiClient`. This is optional precisely so single-tenant callers don't
   need to wire up rate limiting they don't need.
3. **The handler is a thin adapter**, not business logic: it calls the
   already-validated `GemiClient` method and serializes the result to text.
   All the real work (HTTP, retries, response validation) already happened
   in `core`.
4. **Errors never crash the server or return a raw stack trace.** Every
   handler wraps its call in `try/catch` and funnels failures through
   `toolErrorResult()` from
   [`packages/core/src/tool-result.ts`](../packages/core/src/tool-result.ts).
   That helper ([tool-result.ts:31–40](../packages/core/src/tool-result.ts#L31-L40))
   turns a `GovApiError` into a message with the HTTP status and a body
   snippet appended — enough for the agent to tell "missing API key" apart
   from "company not found" — and sets `isError: true` so the MCP client
   knows this was a failure, not a normal answer.

`gemi_list_metadata` ([tools.ts:209–245](../packages/core/src/gemi/tools.ts#L209-L245))
is worth a look too: instead of exposing seven near-identical tools (one per
metadata list), it exposes one tool with a `category` enum parameter, and
dispatches internally via `fetchMetadata()`
([tools.ts:18–35](../packages/core/src/gemi/tools.ts#L18-L35)).
This keeps the tool list — and therefore the agent's context window — small
without losing any functionality.

## 4. Wiring tools into a server, and the server into a transport

[`packages/business-mcp/src/worker.ts`](../packages/business-mcp/src/worker.ts)
is the whole entry point — and unlike a stdio server that starts once and
runs forever, this is a Cloudflare Worker's `fetch` handler, invoked fresh
for every incoming HTTP request:

```ts
async function handleRequest(request: Request, env: Env): Promise<Response> {
  // ...CORS preflight, /icon.svg, per-IP rate limit check...

  const server = new McpServer({ name: "business-mcp", version: "0.1.0", ... });

  registerDiavgeiaTools(server, { framing: FRAMING });
  registerGemiTools(server, {
    framing: FRAMING,
    apiKey: env.GEMI_API_KEY,
    checkRateLimit: () => env.GEMI_RATE_LIMITER.limit({ key: "gemi-global" }),
  });
  // ...registerMyDataTools, registerErganiTools with credential-store options...

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  // ...attach CORS headers, return response...
}
```

`McpServer` is the SDK's protocol implementation: it knows how to answer
`tools/list` and `tools/call` JSON-RPC requests once tools are registered on
it. `registerGemiTools(server, ...)` and friends just populate that
registry — this is also exactly why the domain-bundle architecture in
`CLAUDE.md` works cleanly: a _different_ worker
([`packages/citizen-mcp`](../packages/citizen-mcp)) imports the very same
`registerDiavgeiaTools` from `core` and ends up with the same Diavgeia
tools, without duplicating any logic, even though it exposes a completely
different set of other tools (CKAN instead of ΓΕΜΗ/myDATA/Ergani).

`WebStandardStreamableHTTPServerTransport` is what actually moves bytes: it
reads a JSON-RPC request from the incoming `Request` body and writes the
response back onto a `Response` — no `stdin`/`stdout`, no persistent
process. Building a fresh `McpServer` per request (rather than one long-
lived instance) is what makes this safe to run multi-tenant: nothing from
one caller's request can leak into another's, and there's no session state
to worry about invalidating. `WebStandardStreamableHTTPServerTransport` is
built entirely on Web Standard `Request`/`Response`, so the exact same
transport class works unmodified on Cloudflare Workers, Node.js 18+, Deno,
or Bun — only the surrounding `fetch` handler (rate-limit bindings, secret
env vars, KV lookups) is Cloudflare-specific.

## 5. The full request/response walk, concretely

Putting it together, here's literally what happens when an agent calls
`gemi_get_company` with `{ "registrationNumber": "000237954001" }` against
the deployed `business-mcp` worker:

1. The agent's MCP client sends a `tools/call` JSON-RPC message as an HTTP
   `POST` to the worker's URL.
2. The worker checks the per-IP `RATE_LIMITER` binding first, before any
   MCP logic runs at all; if it's exceeded, the request never reaches
   `McpServer`.
3. A fresh `McpServer` is built and populated via
   `registerDiavgeiaTools`/`registerGemiTools`/etc., then connected to a
   `WebStandardStreamableHTTPServerTransport`, which parses the request
   body as the JSON-RPC message.
4. `McpServer` (SDK internals) looks up the registered tool named
   `gemi_get_company`, validates the arguments against its `inputSchema`
   (`{ registrationNumber: z.string().min(1) }`), and invokes the handler
   from [tools.ts:153–167](../packages/core/src/gemi/tools.ts#L153-L167).
5. The handler calls `rateLimitError()` — ΓΕΜΗ's global 30/min limiter, via
   the `checkRateLimit` callback the worker supplied. If that's also clear,
   it calls `client.getCompany("000237954001")`.
6. `GemiClient.getCompany()` ([client.ts:124–130](../packages/core/src/gemi/client.ts#L124-L130))
   builds the URL, attaches the `api_key` header via `headers()`, and calls
   `fetchJson()`.
7. `fetchJson()` → `fetchText()` ([http.ts:72–132](../packages/core/src/http.ts#L72-L132))
   performs the real HTTPS request to
   `opendata-api.businessportal.gr/api/opendata/v1/companies/000237954001`,
   with a 15s timeout and automatic retry on `429`/`5xx`.
8. The raw JSON is parsed and validated against `GemiCompanySchema`
   ([types.ts:76–113](../packages/core/src/gemi/types.ts#L76-L113)). If it
   passes, a typed `GemiCompany` object comes back up through the client.
9. The tool handler `JSON.stringify`s it into a single text content block
   and returns `{ content: [{ type: "text", text: "..." }] }`.
10. `McpServer` serializes that as the JSON-RPC response; the transport
    writes it onto the HTTP `Response` body (as a `text/event-stream`
    message), CORS headers get attached, and the agent's client reads it as
    the tool's result.

If step 2 or 5 hits a rate limit, or step 6/7/8 fails for any reason (no API
key, bad network, non-2xx, malformed JSON, schema mismatch), the relevant
`catch`/guard intercepts it and returns an `isError: true` text result (or,
for step 2, a plain `429` HTTP response) instead — the agent sees a clear
failure message instead of the server crashing or the connection breaking.

## Why the layering matters

- **`core` has zero _client-side_ platform dependency** — `GemiClient` and
  `http.ts` only use Web Standard APIs, so they run unmodified in Node.js or
  a Cloudflare Worker. `core` does depend on `@modelcontextprotocol/sdk`
  (unlike a plain client library) precisely so the tool-registration logic
  itself is shared too, not just the HTTP client — every service's
  `registerXTools` function lives here once, and every worker package that
  wants those tools imports the same function instead of reimplementing it.
- **Validation happens once, at the boundary with the real API**, not
  scattered through tool handlers — by the time a handler has a `GemiCompany`
  value, it's guaranteed to match the schema.
- **Tool handlers are uniform**: construct client, (optionally) check a rate
  limit, call method, serialize success as text, funnel any error through
  `toolErrorResult`. Once you've read one (`gemi_get_company`), you've
  effectively read all of them across every service in this repo.
- **Descriptions are a first-class part of the code**, not documentation —
  they're what the agent uses to decide _which_ tool to call and _how_, so
  they're written and reviewed with that audience in mind.
- **Platform-specific concerns (secrets, rate-limit bindings, KV storage)
  stay in the worker package**, injected into `core`'s tool registration as
  plain options/callbacks (`apiKey`, `checkRateLimit`, `credentialStore`) —
  `core` never imports `@cloudflare/workers-types` or references `env`
  directly.
