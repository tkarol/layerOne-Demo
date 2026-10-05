// Request router shared by the Cloudflare Worker (src/worker.js) and the local
// Node server (src/node-server.js). Handles /api/* and /mock/*; returns null for
// anything else so the platform can serve the static page from /public.
import { envConfig, mergeSaved, publicConfig } from './config.js';
import { SCENARIOS } from './scenarios.js';
import { publicApps, findWorkflow } from './sample-apps.js';
import { createTrace, runWorkflow } from './workflow.js';
import { handleMockChat } from './mock-layerone.js';
import { handleMockModel, handleMockJudge } from './mock-model.js';
import { validate, publicSettings, toSaved, testConnection } from './settings.js';
import { json, safeEqual } from './util.js';

const summarize = (t) => ({
  id: t.id,
  createdAt: t.createdAt,
  status: t.status,
  mode: t.mode,
  scenario: t.scenario,
  app: t.app ?? null,
  workflow: t.workflow ?? null,
  bypass: Boolean(t.bypass),
  prompt: t.prompt.slice(0, 140),
  decision: t.governance?.decision ?? null,
  httpStatus: t.response?.status ?? null,
  totalMs: t.totalMs ?? null,
});

async function readJson(request) {
  const text = await request.text();
  if (text.length > 1_000_000) throw Object.assign(new Error('Body too large'), { status: 413 });
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('Body must be JSON'), { status: 400 });
  }
}

/**
 * @param {object} opts
 * @param {Record<string,string>} opts.env  Environment (process.env, or the Worker env)
 * @param {object} opts.storage  Settings + trace storage (see src/storage/*)
 */
export function createApp({ env, storage }) {
  const baseConfig = () => envConfig(env);
  const currentConfig = async () => mergeSaved(baseConfig(), await storage.getSettings());

  // Dry-run calls to this app's own /mock/* stand-ins are handled in-process
  // (a Worker cannot fetch its own URL); everything else goes to the network.
  const makeFetch = (origin) => (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith(`${origin}/mock/`)) return handle(new Request(url, init));
    return fetch(input, init);
  };

  // Run one request and stream a trace snapshot after every step (server-sent events).
  function streamRun(input, cfg, origin, waitUntil) {
    const trace = createTrace(input, cfg, origin);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let queue = Promise.resolve();
    // Writes are chained so frames stay in order; a closed browser tab must not stop the run.
    const send = (obj) => (queue = queue.then(() => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))).catch(() => {}));

    const job = (async () => {
      let final = null;
      try {
        await runWorkflow(trace, {
          cfg,
          origin,
          input,
          fetchFn: makeFetch(origin),
          emit: (snapshot, isFinal) => {
            send(snapshot);
            if (isFinal) final = snapshot;
          },
        });
      } catch (err) {
        final = { ...structuredClone(trace), status: 'error', error: `Internal error: ${err.message}` };
        send(final);
      }
      if (final) await storage.putTrace(final);
      await queue;
      await writer.close().catch(() => {});
    })();
    waitUntil?.(job);

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  }

  async function handle(request, { waitUntil } = {}) {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = url.origin;
    const method = request.method;

    try {
      // ----- Built-in dry-run stand-ins (always available) -----
      if (method === 'POST' && pathname.startsWith('/mock/layerone/')) {
        return handleMockChat(request, { origin, fetchFn: makeFetch(origin), storage });
      }
      if (method === 'POST' && pathname.startsWith('/mock/model/')) return handleMockModel(request);
      if (method === 'POST' && pathname.startsWith('/mock/judge/')) return handleMockJudge(request);

      if (!pathname.startsWith('/api/')) return null;

      if (pathname === '/api/health') return json(200, { ok: true });
      if (pathname === '/api/scenarios') return json(200, SCENARIOS);
      if (pathname === '/api/config') return json(200, publicConfig(await currentConfig(), origin));

      // ----- Settings -----
      if (pathname === '/api/settings' || pathname === '/api/settings/test') {
        const cfg = await currentConfig();
        const saved = await storage.getSettings();
        if (method === 'GET' && pathname === '/api/settings') return json(200, publicSettings(cfg, origin, { savedInUi: Boolean(saved) }));
        if (cfg.settingsLocked) return json(403, { error: 'Settings are locked on this server (ALLOW_UI_SETTINGS=false)' });
        if (cfg.settingsPassword && !safeEqual(request.headers.get('x-settings-password') || '', cfg.settingsPassword)) {
          return json(401, { error: 'Enter the settings password to make changes', passwordRequired: true });
        }
        if (method === 'POST' && pathname === '/api/settings/test') {
          return json(200, await testConnection(await readJson(request), cfg, { origin, fetchFn: makeFetch(origin) }));
        }
        if (method === 'PUT' && pathname === '/api/settings') {
          const result = validate(await readJson(request), cfg);
          if (!result.ok) return json(400, { error: 'Some settings are invalid', errors: result.errors });
          await storage.saveSettings(toSaved(result.next));
          const updated = mergeSaved(baseConfig(), result.next);
          return json(200, { settings: publicSettings(updated, origin, { savedInUi: true }), notice: result.notice });
        }
        if (method === 'DELETE' && pathname === '/api/settings') {
          await storage.clearSettings();
          return json(200, { settings: publicSettings(baseConfig(), origin, { savedInUi: false }) });
        }
      }

      // ----- Run a request; streams trace snapshots as server-sent events -----
      if (pathname === '/api/run' && method === 'POST') {
        const { prompt, scenario } = await readJson(request);
        if (!prompt || typeof prompt !== 'string') return json(400, { error: 'prompt is required' });
        return streamRun({ prompt: prompt.slice(0, 20000), scenario }, await currentConfig(), origin, waitUntil);
      }

      // ----- Sample applications -----
      if (pathname === '/api/apps' && method === 'GET') return json(200, publicApps());
      if (pathname === '/api/app/run' && method === 'POST') {
        const body = await readJson(request);
        const found = findWorkflow(body.app, body.workflow);
        if (!found) return json(404, { error: 'Unknown sample app or workflow' });
        const cfg = await currentConfig();
        const { app, workflow } = found;
        // A workflow with a model picker may only use the models it offers.
        const offered = workflow.screen.models?.map((m) => (m.id === '$approved' ? cfg.model : m.id)) || [];
        const model = offered.includes(body.model) ? body.model : offered[0];
        const ai = workflow.build(workflow, { model });
        return streamRun(
          {
            prompt: ai.prompt,
            scenario: `${app.id}:${workflow.id}`,
            app: app.id,
            workflow: workflow.id,
            protected: body.protected !== false,
            system: app.system,
            model: ai.model,
            maxTokens: ai.maxTokens,
          },
          cfg,
          origin,
          waitUntil,
        );
      }

      // ----- History -----
      if (pathname === '/api/traces' && method === 'GET') return json(200, (await storage.listTraces(100)).map(summarize));
      if (pathname === '/api/traces' && method === 'DELETE') {
        await storage.clearTraces();
        return json(200, { ok: true });
      }
      const m = pathname.match(/^\/api\/traces\/([\w-]+)(\/export)?$/);
      if (m && method === 'GET') {
        const trace = await storage.getTrace(m[1]);
        if (!trace) return json(404, { error: 'Trace not found' });
        return json(200, trace, m[2] ? { 'Content-Disposition': `attachment; filename="${trace.id}.json"` } : {});
      }

      return json(404, { error: 'Not found' });
    } catch (err) {
      return json(err.status || 500, { error: err.message });
    }
  }

  return handle;
}
