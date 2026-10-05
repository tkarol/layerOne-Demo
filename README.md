# LayerOne Demo Console

A customer-facing demo app for **Booz Allen Vellox LayerOne**, the governance and compliance gateway for AI agents. A demo web application sends a real request through LayerOne to the AI model and back. It shows the exact endpoint being hit and the full request and response. It traces every hop of the workflow live and keeps a history of every run.

![Demo console](docs/screenshot.png)

![Endpoints and request/response lanes](docs/endpoints.png)

## How it works

```
 Browser (demo UI)  ──►  Web Application (Node server)  ──HTTPS──►  LayerOne gateway  ──►  Model provider
        ▲                       │   records every step                │ policy, validation,
        └──── live trace (SSE) ─┘   to data/traces.jsonl              │ evidence record
```

* The **browser never talks to LayerOne directly**. The Node server plays the web application. It holds the API key, makes the HTTPS call, and records each hop. Customers see real traffic, but credentials never reach the screen. Auth headers are masked in every trace.
* Each run is a **trace** with seven steps (user → web application → LayerOne → AI model → back). Each step has its own timing and detail. Updates stream to every open browser over Server-Sent Events, so a second screen or projector stays in sync.
* **Governance evidence** is pulled out generically: `X-LayerOne-*` / `X-Vellox-*` headers, any `layerone` / `governance` object in the body, and any non-standard response fields. If the gateway returns no explicit decision, one is inferred from the HTTP status and labeled as inferred.
* Traces are appended to `data/traces.jsonl` and survive restarts. *Technical details* has *Download full trace (JSON)* and *Copy as cURL*, so you can replay the same call from a terminal.

### What the customer sees

The demo is framed as a **benefits-claims web application** whose AI assistant sits behind LayerOne. The page reads top to bottom:

1. **Ask the claims assistant something.** Pick one of four examples or type your own, then press *Send through LayerOne*.
2. **Follow the request and the response.** At the top, two endpoint cards show **both URLs in the chain**:
   * **Web Application → LayerOne**: the gateway URL the app calls, with HTTP status and latency.
   * **LayerOne → AI Model**: where LayerOne forwarded the request. It is struck through and marked *Not called* when LayerOne blocks a request.

   Below that, two lanes light up hop by hop:
   * **Request:** Web Application → LayerOne (checks the request) → AI Model
   * **Response:** AI Model → LayerOne (checks the answer) → Web Application

   Each LayerOne box says what it did, for example *4 checks passed*, *Removed 1 Social Security number…* or *Blocked*. Underneath, a plain-English verdict gives the outcome and the audit record ID.
3. **What LayerOne checked**, split by direction. For the request, it shows what was typed next to what the AI model actually received, plus the rules checked. For the response, it shows what the web application received (removed items highlighted), plus the rules checked.

**Technical details** stays collapsed until someone asks. It holds the exact endpoint, step-by-step timing, the raw request (API key hidden) and response, the audit record, *Copy as cURL*, and *Download full trace (JSON)*. **Recent requests** at the bottom reopens any earlier run.

In live mode the request and response sides are filled in from the `stage` field on each policy result LayerOne returns (`input`/`request` vs `output`/`response`).

## Quick start

Requires Node 20+. There are no npm dependencies.

```bash
# 1. Rehearse with the built-in simulated gateway (no credentials needed)
npm start                      # http://localhost:3000

# 2. Point at your real LayerOne gateway
cp .env.example .env           # fill in LAYERONE_BASE_URL, LAYERONE_API_KEY, LAYERONE_MODEL
npm start
```

The header shows **Connected to LayerOne** or **Practice mode**. Practice mode also shows a note under the intro, so the stand-in is never mistaken for the real product in front of a customer.

Docker:

```bash
docker build -t layerone-demo .
docker run --rm -p 3000:3000 --env-file .env layerone-demo
```

## Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `LAYERONE_MODE` | `live` if a base URL is set, else `mock` | `live` or `mock` |
| `LAYERONE_BASE_URL` | — | Gateway base URL |
| `LAYERONE_CHAT_PATH` | `/v1/chat/completions` | Chat route on the gateway |
| `LAYERONE_API_KEY` | — | Credential (server-side only) |
| `LAYERONE_AUTH_HEADER` / `LAYERONE_AUTH_SCHEME` | `Authorization` / `Bearer` | e.g. `x-api-key` with an empty scheme |
| `LAYERONE_MODEL` | `demo-model` | Model/route LayerOne should use upstream |
| `LAYERONE_EXTRA_HEADERS` | `{}` | JSON of extra headers (agent ID, policy set, …) |
| `LAYERONE_TIMEOUT_MS` | `60000` | Request timeout |
| `LAYERONE_UPSTREAM_URL` / `LAYERONE_UPSTREAM_PROVIDER` | — | Model endpoint LayerOne forwards to, shown when LayerOne doesn't report it |
| `DEMO_SYSTEM_PROMPT` | benefits claims assistant | System message the web application sends |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Use `HOST=0.0.0.0` to open from another device |

### Showing the LayerOne → AI model endpoint

The web application only talks to LayerOne, so it can only show where LayerOne sent the request if LayerOne says so. The demo checks these places in order and labels the source in the UI:

1. **Reported by LayerOne** in the response: an `upstream` (or `route` / `target`) object inside the `layerone` / `governance` body field with `url`, `provider`, `model`, `status`, `latency_ms`, or the headers `X-LayerOne-Upstream-Url`, `X-LayerOne-Upstream-Provider`, `X-LayerOne-Upstream-Model`.
2. **From demo settings**: `LAYERONE_UPSTREAM_URL` / `LAYERONE_UPSTREAM_PROVIDER` in `.env`. This is display only; the demo never calls that URL itself.
3. Otherwise the card says LayerOne did not report it.

In practice mode the simulated gateway makes a real HTTP call to a simulated model endpoint (`/mock/model/v1/chat/completions`, in `server/mock-model.js`) and reports it, so both hops are genuine network calls.

### If your LayerOne API differs

LayerOne is in limited preview, and the request format here is an **assumption**. The demo sends an OpenAI-compatible chat-completions request, which matches LayerOne's "sits between agents and models without changing agent code" positioning. Confirm the exact route, auth scheme, and any governance response fields with your Booz Allen contact. Everything wire-format-specific is in [`server/layerone.js`](server/layerone.js):

* `buildRequest()`: URL, headers, body
* `extractGovernance()`: where to find the decision, evidence ID, policy results, and upstream endpoint
* `extractOutput()`: where the model text lives

## Demo scenarios

All four tell one story about protecting personal information in a claims workflow:

| Example | What happens (simulated mode) |
| --- | --- |
| Normal request | No personal information. Passes both ways untouched. |
| SSN in the request | A caseworker pastes an SSN, date of birth and phone number. LayerOne removes them **before the AI model sees them**. |
| AI answer leaks an SSN | The request is clean, but the AI model's answer (a "record lookup") contains an SSN, DOB and phone. LayerOne removes them **on the way back**, before they reach the web application. |
| Bulk SSN export | Someone asks for every claimant's SSN. LayerOne **blocks it**, and the AI model is never called. |

What happens in live mode depends on the policies configured in your LayerOne tenant. The simulated gateway (`server/mock-layerone.js`) uses regex detectors for SSNs, dates of birth, phone numbers, emails and card numbers. It does not call a model; replies are canned, and the record-lookup reply deliberately contains PII. It also produces a hash-chained audit record, so you can rehearse the story. Edit the examples in `server/scenarios.js`.

## API

| Route | |
| --- | --- |
| `POST /api/run` `{prompt, scenario?}` | Start a run, returns `{id}` (202) |
| `GET /api/stream` | SSE stream of trace updates |
| `GET /api/traces` · `GET /api/traces/:id` · `GET /api/traces/:id/export` · `DELETE /api/traces` | History |
| `GET /api/config` | Mode, endpoint, model (no secrets) |

## Development

```bash
npm run dev    # restart on change
npm test       # end-to-end smoke tests against the simulated gateway
```
