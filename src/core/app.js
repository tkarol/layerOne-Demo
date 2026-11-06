// Request router shared by the Cloudflare Worker (src/worker.js) and the local
// Node server (src/node-server.js). Handles /api/* and /mock/*; returns null for
// anything else so the platform can serve the static page from /public.
import { envConfig, mergeSaved, publicConfig } from './config.js';
import { SCENARIOS } from './scenarios.js';
import { publicApps, publicPitch, findWorkflow, getActiveProfile, listProfiles, validateProfile } from './profiles.js';
import { createTrace, runWorkflow } from './workflow.js';
import { viaConfig, buildForBrowser, finishOptions, replay } from './browser-route.js';
import { handleMockChat } from './mock-layerone.js';
import { handleMockModel, handleMockJudge } from './mock-model.js';
import { validate, publicSettings, toSaved, testConnection } from './settings.js';
import { handleDataApi } from './data-app.js';
import { FREE_WORKFLOW, MAX_MESSAGE } from './chat-app.js';
import { json, safeEqual } from './util.js';
import { connectInfo, runChecks, sendCustom } from './connect.js';
import { presenterFromRequest, scopeStorage, canEditCustomer, handlePresenterApi, presenterIds } from './workspace.js';
import { applySeeds } from './seeds.js';
import { handleLayoutApi, deckPage, migrateSuiteDecks, migrateCustomerSlides, getDeck, DECKS } from './layouts.js';

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
    if (url.startsWith(`${origin}/mock/`)) return handle(new Request(url, init)).then((res) => res || json(404, { error: { message: 'Not found' } }));
    return fetch(input, init);
  };

  // Run one request and stream a trace snapshot after every step (server-sent events).
  // `opts` (browser route): the trace id from step 1, the browser's result as `fetchFn`,
  // which snapshots to send (`filter`) and a final touch to each (`patch`).
  function streamRun(input, cfg, origin, waitUntil, store = storage, opts = {}) {
    const trace = createTrace(input, cfg, origin);
    if (opts.traceId) trace.id = opts.traceId;
    const out = opts.patch || ((t) => t);
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
          fetchFn: opts.fetchFn || makeFetch(origin),
          emit: (snapshot, isFinal) => {
            snapshot = out(snapshot);
            if (isFinal || !opts.filter || opts.filter(snapshot)) send(snapshot);
            if (isFinal) final = snapshot;
          },
        });
      } catch (err) {
        final = out({ ...structuredClone(trace), status: 'error', error: `Internal error: ${err.message}` });
        send(final);
      }
      if (final) await store.putTrace(final);
      await queue;
      await writer.close().catch(() => {});
    })();
    waitUntil?.(job);

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  }

  // A run sent the usual way (from this server), or from the presenter's browser
  // (browser-route.js) when `via` is given. LayerOne switched off always goes from here.
  async function runVia(input, via, cfg, origin, waitUntil, store) {
    if (!via || input.protected === false) return streamRun(input, cfg, origin, waitUntil, store);
    const v = viaConfig(cfg, via);
    if (v.error) return json(400, { error: v.error });
    if (via.step === 'build') {
      const built = await buildForBrowser(input, v.cfg);
      if (built.request) return json(200, built);
      await store.putTrace(built.trace);
      return json(200, built);
    }
    return streamRun(input, v.cfg, origin, waitUntil, store, finishOptions(via, v.cfg));
  }

  // Changing settings or customer profiles honors ALLOW_UI_SETTINGS and SETTINGS_PASSWORD.
  function checkChangeAllowed(request, cfg, me) {
    if (cfg.settingsLocked) return json(403, { error: 'Settings are locked on this server (ALLOW_UI_SETTINGS=false)' });
    if (!me && cfg.settingsPassword && !safeEqual(request.headers.get('x-settings-password') || '', cfg.settingsPassword)) {
      return json(401, { error: 'Enter the settings password to make changes', passwordRequired: true });
    }
    return null;
  }

  async function handle(request, { waitUntil } = {}) {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = url.origin;
    const method = request.method;

    try {
      // ----- Built-in dry-run stand-ins (always available) -----
      // GET on the stand-in: a health answer at its base URL and a model list, like a real gateway.
      if (method === 'GET' && (pathname === '/mock/layerone' || pathname === '/mock/layerone/')) return json(200, { service: 'LayerOne (dry-run stand-in)', status: 'ok' });
      if (method === 'GET' && pathname === '/mock/layerone/health') return json(200, { status: 'ok', service: 'LayerOne proxy (dry-run stand-in)' });
      if (method === 'GET' && pathname === '/mock/layerone/v1/models') {
        const cfg = await currentConfig();
        return json(200, { object: 'list', data: [{ id: cfg.model, object: 'model', owned_by: 'approved' }, { id: 'deepseek-r1', object: 'model', owned_by: 'denylisted' }] });
      }
      if (method === 'POST' && pathname.startsWith('/mock/layerone/')) {
        return handleMockChat(request, { origin, fetchFn: makeFetch(origin), storage });
      }
      if (method === 'POST' && pathname.startsWith('/mock/model/')) return handleMockModel(request, { storage });
      if (method === 'POST' && pathname.startsWith('/mock/judge/')) return handleMockJudge(request, { storage });

      const link = pathname.match(/^\/d\/(l_[0-9a-f]{1,24})(?:\/([a-z]+))?\/?$/);
      if (!link && !pathname.startsWith('/api/')) return null;

      // Ready-made accounts and decks (added once), and one-time moves of older data.
      await applySeeds(storage);
      await migrateCustomerSlides(storage);
      await migrateSuiteDecks(storage);

      // Deck links: /d/<deck id>[/<product>] opens that deck (it covers the whole suite)
      // on a product page, for its account.
      if (link) {
        if (method !== 'GET') return json(405, { error: 'Method not allowed' });
        const deck = await getDeck(storage, link[1]);
        if (!deck) return Response.redirect(`${origin}/decks?missing=1`, 302);
        const qs = new URLSearchParams({ deck: deck.id, ...(deck.customer ? { acct: deck.customer } : {}) });
        return Response.redirect(`${origin}${deckPage(deck, link[2])}?${qs}#overview`, 302);
      }

      // Who's presenting: a signed-in SE gets their own settings, data and history
      // (falling back to the site-wide settings until they save their own).
      const me = await presenterFromRequest(request, storage);
      const mine = me ? scopeStorage(storage, me.scope || me.id) : storage;
      // Guests look around: they can use the demos (in their own sandbox) but change nothing,
      // and never see the customer list or SEs' layouts.
      // Account executives: accounts and decks, but not the Live/API settings,
      // the Connect tab's live requests, or sample-app step edits.
      if (me?.role === 'ae' && method !== 'GET' && /^\/api\/(settings|connect\/(check|send))(\/|$)/.test(pathname)) {
        return json(403, { error: 'Live settings and Connect are for sales engineers.', role: 'ae' });
      }
      if (me?.guest) {
        const write = method !== 'GET';
        if (write && /^\/api\/(settings|profiles|layouts|connect)(\/|$)/.test(pathname)) return json(403, { error: 'Guests can look around, but can’t change anything.', guest: true });
        if (pathname === '/api/profiles') return json(200, { active: null, profiles: [], me: { id: 'guest', guest: true }, locked: true, passwordRequired: false });
        if (pathname.startsWith('/api/profiles/') || pathname.startsWith('/api/layouts/')) return json(403, { error: 'Not available to guests', guest: true });
        if (pathname === '/api/layouts') return json(200, { layouts: [] });
      }
      const configNow = async () => mergeSaved(baseConfig(), (me && (await mine.getSettings())) || (await storage.getSettings()));
      // The customer this browser is presenting to (X-Customer), or the legacy site-wide one.
      const customerFor = async () => {
        const h = request.headers.get('x-customer');
        if (me?.guest) return null; // guests always see the standard version
        if (h === null) return getActiveProfile(storage);
        return /^p_[0-9a-f]+$/.test(h) ? storage.getKV(`profile:${h}`) : null;
      };

      // Recently presented (the deck library): who presented which deck on which product, when.
      if (pathname === '/api/presented') {
        if (!me || me.guest) return method === 'GET' ? json(200, { presented: [] }) : json(200, { ok: true });
        const LOG = 'presented:log';
        if (method === 'POST') {
          const { deck, product } = await readJson(request);
          if (!DECKS.includes(product)) return json(400, { error: 'Unknown product' });
          const d = typeof deck === 'string' && deck ? await getDeck(storage, deck) : null;
          const log = (await storage.getKV(LOG)) || [];
          log.push({ at: new Date().toISOString(), by: me.id, deck: d?.id || '', product, customer: d?.customer || null });
          await storage.putKV(LOG, log.slice(-300));
          return json(200, { ok: true });
        }
        if (method === 'GET') return json(200, { presented: ((await storage.getKV(LOG)) || []).slice(-60).reverse() });
      }
      if (pathname === '/api/layouts' || pathname.startsWith('/api/layouts/')) return handleLayoutApi(request, { storage, pathname, method, readJson, me, url });
      if (pathname === '/api/presenters' || pathname.startsWith('/api/presenters/')) {
        return handlePresenterApi(request, { storage, pathname, method, readJson, me, cfg: await configNow() });
      }

      if (pathname === '/api/health') return json(200, { ok: true });
      if (pathname === '/api/scenarios') return json(200, SCENARIOS);
      if (pathname === '/api/config') return json(200, publicConfig(await configNow(), origin));

      // ----- Settings -----
      if (pathname === '/api/settings' || pathname === '/api/settings/test') {
        const cfg = await configNow();
        const saved = await mine.getSettings();
        if (method === 'GET' && pathname === '/api/settings') return json(200, { ...publicSettings(cfg, origin, { savedInUi: Boolean(saved) }), ...(me ? { passwordRequired: false } : {}) });
        const denied = checkChangeAllowed(request, cfg, me);
        if (denied) return denied;
        if (method === 'POST' && pathname === '/api/settings/test') {
          return json(200, await testConnection(await readJson(request), cfg, { origin, fetchFn: makeFetch(origin) }));
        }
        if (method === 'PUT' && pathname === '/api/settings') {
          const result = validate(await readJson(request), cfg);
          if (!result.ok) return json(400, { error: 'Some settings are invalid', errors: result.errors });
          await mine.saveSettings(toSaved(result.next));
          const updated = mergeSaved(baseConfig(), result.next);
          return json(200, { settings: { ...publicSettings(updated, origin, { savedInUi: true }), ...(me ? { passwordRequired: false } : {}) }, notice: result.notice });
        }
        if (method === 'DELETE' && pathname === '/api/settings') {
          await mine.clearSettings();
          return json(200, { settings: { ...publicSettings(await configNow(), origin, { savedInUi: false }), ...(me ? { passwordRequired: false } : {}) } });
        }
      }

      // ----- Connect tab: connection checks and a request builder (they use the saved key) -----
      // With `?via=<url>&model=&key=1` (or `via` in the body), the same thing for a LayerOne this
      // browser sends to (browser-route.js): the browser makes each call, one round trip each.
      if (pathname === '/api/connect' && method === 'GET') {
        const via = url.searchParams.get('via');
        const v = via ? viaConfig(await configNow(), { url: via, model: url.searchParams.get('model'), hasKey: url.searchParams.get('key') === '1' }, { withKey: true }) : null;
        if (v?.error) return json(400, { error: v.error });
        return json(200, connectInfo(v ? v.cfg : await configNow(), origin));
      }
      if ((pathname === '/api/connect/check' || pathname === '/api/connect/send') && method === 'POST') {
        const body = await readJson(request);
        if (body.via) {
          const v = viaConfig(await configNow(), body.via, { withKey: true });
          if (v.error) return json(400, { error: v.error });
          const r = await replay((fetchFn) => (pathname === '/api/connect/check' ? runChecks(v.cfg, { origin, fetchFn }) : sendCustom(body, v.cfg, { origin, fetchFn })), body.via.results);
          if (r.need) return json(200, { need: r.need });
          if (pathname === '/api/connect/check') return json(200, r.value);
          return r.value.error ? json(r.value.status, { error: r.value.error }) : json(200, r.value.result);
        }
        const cfg = await configNow();
        if (!me && cfg.settingsPassword && !safeEqual(request.headers.get('x-settings-password') || '', cfg.settingsPassword)) {
          return json(401, { error: 'Enter the settings password to send requests with the saved key', passwordRequired: true });
        }
        if (pathname === '/api/connect/check') return json(200, await runChecks(cfg, { origin, fetchFn: makeFetch(origin) }));
        const out = await sendCustom(body, cfg, { origin, fetchFn: makeFetch(origin) });
        return out.error ? json(out.status, { error: out.error }) : json(200, out.result);
      }

      // ----- Run a request; streams trace snapshots as server-sent events -----
      if (pathname === '/api/run' && method === 'POST') {
        const { prompt, scenario, via } = await readJson(request);
        if (!prompt || typeof prompt !== 'string') return json(400, { error: 'prompt is required' });
        return runVia({ prompt: prompt.slice(0, 20000), scenario }, via, await configNow(), origin, waitUntil, mine);
      }

      // ----- Sample applications -----
      if (pathname === '/api/apps' && method === 'GET') {
        // ?default=1 returns the un-customized apps (used as defaults in the Customize dialog).
        return json(200, publicApps(url.searchParams.get('default') ? null : await customerFor()));
      }

      // ----- Customer Hub: the interactive database sample app -----
      if (pathname === '/api/data' || pathname.startsWith('/api/data/')) return handleDataApi(request, { storage: mine, pathname, method, readJson });

      // ----- Tailoring for the Vellox Reverser and Ranger pages (from the active customer profile) -----
      if (pathname === '/api/pitch' && method === 'GET') return json(200, publicPitch(await customerFor()));

      // ----- Customer profiles (white-labeling) -----
      if (pathname === '/api/profiles' || pathname.startsWith('/api/profiles/')) {
        const cfg = await configNow();
        const id = pathname.split('/')[3];
        if (method === 'GET' && !id) {
          const profiles = (await listProfiles(storage)).map((p) => ({ ...p, canEdit: canEditCustomer(p, me) }));
          return json(200, { active: (await storage.getKV('profile:active')) || null, profiles, me: me ? { id: me.id, admin: Boolean(me.admin), role: me.role } : null, locked: cfg.settingsLocked, passwordRequired: !me && Boolean(cfg.settingsPassword) });
        }
        // A customer's logo as an image, so lists can show logos without loading them all.
        if (method === 'GET' && pathname.split('/')[4] === 'logo') {
          const logo = (await storage.getKV(`profile:${id}`))?.pitch?.logo || '';
          const data = logo.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
          if (data) {
            const bytes = Uint8Array.from(atob(data[2]), (c) => c.charCodeAt(0));
            return new Response(bytes, { headers: { 'Content-Type': data[1], 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
          }
          if (/^https:\/\//.test(logo)) return Response.redirect(logo, 302);
          return json(404, { error: 'No logo' });
        }
        if (method === 'GET') {
          const profile = await storage.getKV(`profile:${id}`);
          return profile ? json(200, { ...profile, canEdit: canEditCustomer(profile, me) }) : json(404, { error: 'Profile not found' });
        }
        const denied = checkChangeAllowed(request, cfg, me);
        if (denied) return denied;
        const existing = id && id !== 'active' ? await storage.getKV(`profile:${id}`) : null;
        if (existing && !canEditCustomer(existing, me) && !(method === 'POST' && pathname.endsWith('/copy'))) {
          return json(403, { error: 'Only the account’s owner or its account team can change it.' });
        }
        // Make a copy: any signed-in SE can copy any customer and own the copy.
        if (method === 'POST' && pathname.endsWith('/copy')) {
          if (!me) return json(401, { error: 'Sign in to copy a customer' });
          if (!existing) return json(404, { error: 'Profile not found' });
          const { name } = await readJson(request);
          const { profile, errors, ok } = validateProfile({ ...existing, name: String(name || `${existing.name} (copy)`) });
          if (!ok) return json(400, { error: 'Some fields are invalid', errors });
          profile.owner = me.id;
          profile.team = [];
          await storage.putKV(`profile:${profile.id}`, profile);
          return json(200, { ...profile, canEdit: true });
        }
        if (id === 'active' && method === 'PUT') {
          const { id: activeId } = await readJson(request);
          if (activeId && !(await storage.getKV(`profile:${activeId}`))) return json(404, { error: 'Profile not found' });
          if (activeId) await storage.putKV('profile:active', activeId);
          else await storage.deleteKV('profile:active');
          return json(200, { active: activeId || null });
        }
        if ((method === 'POST' && !id) || (method === 'PUT' && id)) {
          if (id && !(await storage.getKV(`profile:${id}`))) return json(404, { error: 'Profile not found' });
          const body = await readJson(request);
          const { profile, errors, ok } = validateProfile(body, id);
          if (!ok) return json(400, { error: 'Some fields are invalid', errors });
          const owner = existing ? existing.owner : me?.id;
          if (owner) profile.owner = owner;
          // The account team: people who can edit this account and its decks.
          if (Array.isArray(body.team) && me) {
            const known = await presenterIds(storage);
            profile.team = [...new Set(body.team.filter((t) => typeof t === 'string' && known.has(t) && t !== profile.owner))].slice(0, 20);
          } else if (existing?.team) profile.team = existing.team;
          // Account executives don't rewrite sample-app steps.
          if (me?.role === 'ae') profile.steps = existing?.steps || {};
          await storage.putKV(`profile:${profile.id}`, profile);
          return json(200, { ...profile, canEdit: canEditCustomer(profile, me) });
        }
        if (method === 'DELETE' && id) {
          await storage.deleteKV(`profile:${id}`);
          // Its decks stay, as general decks.
          for (const l of (await storage.listKV('layout:l_')).filter((x) => x?.customer === id)) await storage.putKV(`layout:${l.id}`, { ...l, customer: null });
          if ((await storage.getKV('profile:active')) === id) await storage.deleteKV('profile:active');
          return json(200, { ok: true });
        }
      }
      if (pathname === '/api/app/run' && method === 'POST') {
        const body = await readJson(request);
        const found = findWorkflow(body.app, body.workflow, await customerFor());
        if (!found) return json(404, { error: 'Unknown sample app or workflow' });
        const cfg = await configNow();
        const { app, workflow } = found;
        // A workflow with a model picker may only use the models it offers.
        const offered = workflow.screen.models?.map((m) => (m.id === '$approved' ? cfg.model : m.id)) || [];
        const model = offered.includes(body.model) ? body.model : offered[0];
        // "Ask AI" also takes a message the presenter types.
        const message = workflow.id === FREE_WORKFLOW ? String(body.message ?? '').trim().slice(0, MAX_MESSAGE) : '';
        if (workflow.id === FREE_WORKFLOW && !message) return json(400, { error: 'Type a message first' });
        const ai = workflow.build(workflow, { model, message });
        return runVia(
          {
            prompt: ai.prompt,
            scenario: `${app.id}:${workflow.id}`,
            app: app.id,
            workflow: workflow.id,
            protected: body.protected !== false,
            system: app.system,
            model: ai.model,
            maxTokens: ai.maxTokens,
            demoWorkflow: `${app.id}:${workflow.id}`,
          },
          body.via,
          cfg,
          origin,
          waitUntil,
          mine,
        );
      }

      // ----- History -----
      if (pathname === '/api/traces' && method === 'GET') return json(200, (await mine.listTraces(100)).map(summarize));
      if (pathname === '/api/traces' && method === 'DELETE') {
        await mine.clearTraces();
        return json(200, { ok: true });
      }
      const m = pathname.match(/^\/api\/traces\/([\w-]+)(\/export)?$/);
      if (m && method === 'GET') {
        const trace = await mine.getTrace(m[1]);
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
