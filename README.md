# LayerOne Demo Console

A customer-facing demo app for **Booz Allen Vellox LayerOne**, the governance and compliance gateway for AI agents. The console sends a real request from a demo "agent" through LayerOne to the model. It shows the exact endpoint being hit and the full request and response. It traces every hop of the workflow live and keeps a history of every run.

![Demo console](docs/screenshot.png)

## How it works

```
 Browser (demo UI)  ──►  Demo Agent (Node server)  ──HTTPS──►  LayerOne gateway  ──►  Model provider
        ▲                       │   records every step                │ policy, validation,
        └──── live trace (SSE) ─┘   to data/traces.jsonl              │ evidence record
```

* The **browser never talks to LayerOne directly**. The Node server acts as the agent. It holds the API key, makes the HTTPS call, and records each hop. Customers see real traffic, but credentials never reach the screen. Auth headers are masked in every trace.
* Each run is a **trace** with seven steps (UI → agent → LayerOne → model → back). Each step has its own timing and detail. Updates stream to every open browser over Server-Sent Events, so a second screen or projector stays in sync.
* **Governance evidence** is pulled out generically: `X-LayerOne-*` / `X-Vellox-*` headers, any `layerone` / `governance` object in the body, and any non-standard response fields. If the gateway returns no explicit decision, one is inferred from the HTTP status and labeled as inferred.
* Traces are appended to `data/traces.jsonl` and survive restarts. Any trace can be exported as JSON from the *Raw trace* tab. The *Request* tab has a copy-as-cURL button, so you can show the same call from a terminal.

### What the customer sees

The page is one column and reads top to bottom:

1. **Ask the AI agent something.** Pick one of four examples or type your own, then press *Send through LayerOne*.
2. **What LayerOne did.** Three boxes (AI agent → LayerOne → AI model) light up as the request moves through. Underneath, a plain-English verdict says **Allowed**, **Allowed, with sensitive info removed**, or **Blocked**, with the reason and the audit record ID. When a request is blocked, the AI model box shows *Never reached*.
3. **The details.** What you sent next to what the AI actually received (removed items are highlighted), the AI's answer or LayerOne's block message, and a ✓/✕ list of the rules LayerOne checked.

**Technical details** stays collapsed until someone asks. It holds the exact endpoint, step-by-step timing, the raw request (API key hidden) and response, the audit record, *Copy as cURL*, and *Download full trace (JSON)*. **Recent requests** at the bottom reopens any earlier run.

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
| `DEMO_SYSTEM_PROMPT` | mission-support assistant | System message the agent sends |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Use `HOST=0.0.0.0` to open from another device |

### If your LayerOne API differs

LayerOne is in limited preview, and the request format here is an **assumption**. The demo sends an OpenAI-compatible chat-completions request, which matches LayerOne's "sits between agents and models without changing agent code" positioning. Confirm the exact route, auth scheme, and any governance response fields with your Booz Allen contact. Everything wire-format-specific is in [`server/layerone.js`](server/layerone.js):

* `buildRequest()`: URL, headers, body
* `extractGovernance()`: where to find the decision, evidence ID, and policy results
* `extractOutput()`: where the model text lives

## Demo scenarios

| Scenario | What it exercises |
| --- | --- |
| A normal question | Clean pass-through, baseline latency |
| Includes personal info | PII detection / redaction |
| Tries to trick the AI | Prompt-injection defense |
| Classified marking | Data-handling / spillage control |

What happens in live mode depends on the policies configured in your LayerOne tenant. In simulated mode the built-in gateway (`server/mock-layerone.js`) allows, redacts, or blocks these scenarios. It does not call a model; replies are canned. It also produces a hash-chained evidence record, so you can rehearse the narrative. Edit the scenarios in `server/scenarios.js`.

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
