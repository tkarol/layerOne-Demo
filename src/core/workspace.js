// SE workspaces: who's presenting. Each sales engineer signs in with a PIN and
// gets their own settings, Customer Hub data and request history; customers are
// a shared library that only their creator (or an admin) can edit.
//
// Presenters are fixed below. A presenter with no PIN yet chooses one at first
// sign-in (if SETTINGS_PASSWORD is set, choosing a first PIN also needs it).
// Admins can reset anyone's PIN, which sends that person back to "choose a PIN".
import { json, randomHex, safeEqual } from './util.js';

export const PRESENTERS = [
  { id: 'tyler', name: 'Tyler', admin: true },
  { id: 'emilio', name: 'Emilio', admin: true },
  { id: 'ethan', name: 'Ethan' },
  { id: 'chris', name: 'Chris' },
];
// Customers created before workspaces existed belong to this presenter.
export const LEGACY_OWNER = 'tyler';

const PIN_RE = /^\d{4,8}$/;
const MAX_FAILS = 5;
const LOCK_MS = 60_000;
const SESSION_DAYS = 30;
const ITERATIONS = 20_000;
const enc = new TextEncoder();

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const publicPresenter = (p, rec) => ({ id: p.id, name: p.name, admin: Boolean(p.admin), hasPin: Boolean(rec?.pinHash) });
const byId = (id) => PRESENTERS.find((p) => p.id === id);

// The signed-in presenter for this request, or null.
export async function presenterFromRequest(request, storage) {
  const token = request.headers.get('x-presenter-token') || '';
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const session = await storage.getKV(`session:${token}`);
  if (!session || session.expires < Date.now()) return null;
  const p = byId(session.presenter);
  // A PIN reset bumps the presenter's epoch, which signs out their old sessions.
  if (!p || (session.epoch || 0) !== ((await storage.getKV(`presenter-epoch:${p.id}`)) || 0)) return null;
  return { ...p, token };
}

// Storage seen through one presenter's eyes: their own settings, key/value data
// (Customer Hub) and request history, on top of the shared store.
export function scopeStorage(base, id) {
  const pre = `ws:${id}:`;
  const traceKey = (t) => `${pre}trace:${t}`;
  const INDEX = `${pre}traces`;
  const MAX = 200;
  return {
    getSettings: () => base.getKV(`${pre}settings`),
    saveSettings: (s) => base.putKV(`${pre}settings`, s),
    clearSettings: () => base.deleteKV(`${pre}settings`),
    getKV: (k) => base.getKV(pre + k),
    putKV: (k, v) => base.putKV(pre + k, v),
    deleteKV: (k) => base.deleteKV(pre + k),
    listKV: (prefix) => base.listKV(pre + prefix),
    async putTrace(trace) {
      await base.putKV(traceKey(trace.id), trace);
      const ids = (await base.getKV(INDEX)) || [];
      ids.push(trace.id);
      for (const old of ids.splice(0, Math.max(0, ids.length - MAX))) await base.deleteKV(traceKey(old));
      await base.putKV(INDEX, ids);
    },
    getTrace: (t) => base.getKV(traceKey(t)),
    async listTraces(limit = 100) {
      const ids = ((await base.getKV(INDEX)) || []).slice(-limit).reverse();
      return (await Promise.all(ids.map((t) => base.getKV(traceKey(t))))).filter(Boolean);
    },
    async clearTraces() {
      for (const t of (await base.getKV(INDEX)) || []) await base.deleteKV(traceKey(t));
      await base.putKV(INDEX, []);
    },
    getChainHead: () => base.getChainHead(),
    setChainHead: (h) => base.setChainHead(h),
  };
}

// Who may edit a customer: its owner or an admin. Signed out, only customers
// without an owner (the pre-workspace behavior, still password-protected).
export function canEditCustomer(profile, me) {
  if (!me) return !profile?.owner;
  const owner = profile?.owner || LEGACY_OWNER;
  return me.admin || owner === me.id;
}

// /api/presenters/*
export async function handlePresenterApi(request, { storage, pathname, method, readJson, me, cfg }) {
  const rest = pathname.replace(/^\/api\/presenters\/?/, '');
  const rec = (id) => storage.getKV(`presenter:${id}`);

  if (method === 'GET' && rest === '') {
    const list = await Promise.all(PRESENTERS.map(async (p) => publicPresenter(p, await rec(p.id))));
    return json(200, { presenters: list, setupPasswordRequired: Boolean(cfg.settingsPassword) });
  }
  if (method === 'GET' && rest === 'me') return json(200, { me: me ? publicPresenter(me, await rec(me.id)) : null });

  if (method === 'POST' && rest === 'login') {
    const { id, pin, setupPassword } = await readJson(request);
    const p = byId(id);
    if (!p) return json(404, { error: 'Unknown presenter' });
    const r = (await rec(p.id)) || {};
    if (r.lockedUntil && r.lockedUntil > Date.now()) return json(429, { error: 'Too many tries. Wait a minute and try again.' });
    if (!PIN_RE.test(String(pin || ''))) return json(400, { error: 'Your PIN is 4 to 8 digits' });
    if (!r.pinHash) {
      // First sign-in: this sets the PIN.
      if (cfg.settingsPassword && !safeEqual(setupPassword || '', cfg.settingsPassword)) return json(401, { error: 'Enter the team setup password to choose your first PIN', setupPasswordRequired: true });
      const salt = randomHex(16);
      await storage.putKV(`presenter:${p.id}`, { salt, pinHash: await hashPin(pin, salt), setAt: new Date().toISOString() });
    } else if (!safeEqual(await hashPin(pin, r.salt), r.pinHash)) {
      const fails = (r.fails || 0) + 1;
      await storage.putKV(`presenter:${p.id}`, { ...r, fails: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
      return json(401, { error: fails >= MAX_FAILS ? 'Too many tries. Wait a minute and try again.' : 'That PIN isn’t right' });
    } else if (r.fails || r.lockedUntil) {
      await storage.putKV(`presenter:${p.id}`, { ...r, fails: 0, lockedUntil: 0 });
    }
    const token = randomHex(24);
    const epoch = (await storage.getKV(`presenter-epoch:${p.id}`)) || 0;
    await storage.putKV(`session:${token}`, { presenter: p.id, epoch, expires: Date.now() + SESSION_DAYS * 864e5 });
    return json(200, { token, me: publicPresenter(p, await rec(p.id)) });
  }

  if (!me) return json(401, { error: 'Sign in first' });

  if (method === 'POST' && rest === 'logout') {
    await storage.deleteKV(`session:${me.token}`);
    return json(200, { ok: true });
  }
  if (method === 'PUT' && rest === 'me/pin') {
    const { pin, newPin } = await readJson(request);
    const r = (await rec(me.id)) || {};
    if (r.pinHash && !safeEqual(await hashPin(String(pin || ''), r.salt), r.pinHash)) return json(401, { error: 'Your current PIN isn’t right' });
    if (!PIN_RE.test(String(newPin || ''))) return json(400, { error: 'Use 4 to 8 digits' });
    const salt = randomHex(16);
    await storage.putKV(`presenter:${me.id}`, { salt, pinHash: await hashPin(newPin, salt), setAt: new Date().toISOString() });
    return json(200, { ok: true });
  }
  const reset = rest.match(/^([a-z]+)\/reset$/);
  if (method === 'POST' && reset) {
    if (!me.admin) return json(403, { error: 'Only an admin can reset a PIN' });
    if (!byId(reset[1])) return json(404, { error: 'Unknown presenter' });
    await storage.deleteKV(`presenter:${reset[1]}`);
    await storage.putKV(`presenter-epoch:${reset[1]}`, ((await storage.getKV(`presenter-epoch:${reset[1]}`)) || 0) + 1);
    return json(200, { ok: true });
  }
  return json(404, { error: 'Not found' });
}
