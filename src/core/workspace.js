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
// Guests (anyone who isn't an SE) can look around without a PIN, but can't change
// anything. Each guest visit gets its own throwaway sandbox for the sample apps.
export const GUEST = { id: 'guest', name: 'Guest', guest: true };
const GUEST_HOURS = 12;
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

const publicPresenter = (p, rec) => ({ id: p.id, name: p.name, hasPin: Boolean(rec?.pinHash) });
// Only you see whether you're an admin.
const selfPresenter = (p, rec) => ({ ...publicPresenter(p, rec), admin: Boolean(p.admin) });
// Admins can add people; they're stored here, on top of the built-in four.
// Removed people stay in the list (marked removed) so their customers and
// layouts still show whose they are, but they can't sign in.
const PEOPLE_KEY = 'presenters:added';
const added = async (storage) => (await storage.getKV(PEOPLE_KEY)) || [];
const allPresenters = async (storage) => [...PRESENTERS, ...(await added(storage)).filter((p) => !p.removed)];
const byId = async (storage, id) => (await allPresenters(storage)).find((p) => p.id === id);
const slug = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'se';

// The signed-in presenter for this request, or null.
export async function presenterFromRequest(request, storage) {
  const token = request.headers.get('x-presenter-token') || '';
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const session = await storage.getKV(`session:${token}`);
  if (!session || session.expires < Date.now()) return null;
  if (session.presenter === GUEST.id) return { ...GUEST, token, scope: `guest-${session.scope}` };
  const p = await byId(storage, session.presenter);
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
    const list = await Promise.all((await allPresenters(storage)).map(async (p) => publicPresenter(p, await rec(p.id))));
    // Names of removed people, so their customers and layouts still say whose they are.
    const former = (await added(storage)).filter((p) => p.removed).map((p) => ({ id: p.id, name: p.name }));
    return json(200, { presenters: list, former, setupPasswordRequired: Boolean(cfg.settingsPassword) });
  }
  if (method === 'GET' && rest === 'me') return json(200, { me: me ? (me.guest ? { id: GUEST.id, name: GUEST.name, guest: true } : selfPresenter(me, await rec(me.id))) : null });

  // Look around as a guest: no PIN, read-only, a short-lived session.
  if (method === 'POST' && rest === 'guest') {
    const token = randomHex(24);
    await storage.putKV(`session:${token}`, { presenter: GUEST.id, scope: randomHex(4), expires: Date.now() + GUEST_HOURS * 36e5 });
    return json(200, { token, me: { id: GUEST.id, name: GUEST.name, guest: true } });
  }

  if (method === 'POST' && rest === 'login') {
    const { id, pin, setupPassword } = await readJson(request);
    const p = await byId(storage, id);
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
    return json(200, { token, me: selfPresenter(p, await rec(p.id)) });
  }

  if (!me) return json(401, { error: 'Sign in first' });

  if (method === 'POST' && rest === 'logout') {
    await storage.deleteKV(`session:${me.token}`);
    return json(200, { ok: true });
  }
  if (me.guest && rest !== 'logout') return json(403, { error: 'Guests can look around, but can’t change anything.' });
  if (method === 'PUT' && rest === 'me/pin') {
    const { pin, newPin } = await readJson(request);
    const r = (await rec(me.id)) || {};
    if (r.pinHash && !safeEqual(await hashPin(String(pin || ''), r.salt), r.pinHash)) return json(401, { error: 'Your current PIN isn’t right' });
    if (!PIN_RE.test(String(newPin || ''))) return json(400, { error: 'Use 4 to 8 digits' });
    const salt = randomHex(16);
    await storage.putKV(`presenter:${me.id}`, { salt, pinHash: await hashPin(newPin, salt), setAt: new Date().toISOString() });
    return json(200, { ok: true });
  }
  // Admins add people. They choose their own PIN at first sign-in.
  if (method === 'POST' && rest === '') {
    if (!me.admin) return json(403, { error: 'Only an admin can add people' });
    const body = await readJson(request);
    const name = String(body.name || '').replace(/\s+/g, ' ').trim();
    if (!name) return json(400, { error: 'Enter their name' });
    if (name.length > 30) return json(400, { error: 'Keep the name under 30 characters' });
    const list = await added(storage);
    const everyone = [...PRESENTERS, ...list];
    if (everyone.some((p) => !p.removed && p.name.toLowerCase() === name.toLowerCase())) return json(409, { error: `${name} is already on the list` });
    const taken = new Set([...everyone.map((p) => p.id), GUEST.id]);
    let id = slug(name);
    for (let n = 2; taken.has(id); n++) id = `${slug(name).slice(0, 17)}-${n}`;
    const person = { id, name, admin: body.admin === true, addedBy: me.id, addedAt: new Date().toISOString() };
    await storage.putKV(PEOPLE_KEY, [...list, person]);
    return json(200, { presenter: { ...publicPresenter(person, null), admin: person.admin } });
  }
  // Admins see everyone's role (to manage people); nobody else does.
  if (method === 'GET' && rest === 'manage') {
    if (!me.admin) return json(403, { error: 'Only an admin can manage people' });
    const list = await added(storage);
    const people = await Promise.all(
      (await allPresenters(storage)).map(async (p) => ({ ...publicPresenter(p, await rec(p.id)), admin: Boolean(p.admin), builtIn: PRESENTERS.includes(p), addedBy: list.find((a) => a.id === p.id)?.addedBy || null })),
    );
    return json(200, { people });
  }
  const one = rest.match(/^([a-z0-9-]{1,24})$/);
  if (method === 'DELETE' && one) {
    if (!me.admin) return json(403, { error: 'Only an admin can remove people' });
    if (one[1] === me.id) return json(400, { error: 'You can’t remove yourself' });
    if (PRESENTERS.some((p) => p.id === one[1])) return json(400, { error: 'The original four can’t be removed here' });
    const list = await added(storage);
    const person = list.find((p) => p.id === one[1] && !p.removed);
    if (!person) return json(404, { error: 'Unknown presenter' });
    person.removed = true;
    person.removedBy = me.id;
    await storage.putKV(PEOPLE_KEY, list);
    await storage.deleteKV(`presenter:${person.id}`);
    await storage.putKV(`presenter-epoch:${person.id}`, ((await storage.getKV(`presenter-epoch:${person.id}`)) || 0) + 1);
    return json(200, { ok: true });
  }
  const reset = rest.match(/^([a-z0-9-]{1,24})\/reset$/);
  if (method === 'POST' && reset) {
    if (!me.admin) return json(403, { error: 'You can’t reset someone else’s PIN' });
    if (!(await byId(storage, reset[1]))) return json(404, { error: 'Unknown presenter' });
    await storage.deleteKV(`presenter:${reset[1]}`);
    await storage.putKV(`presenter-epoch:${reset[1]}`, ((await storage.getKV(`presenter-epoch:${reset[1]}`)) || 0) + 1);
    return json(200, { ok: true });
  }
  return json(404, { error: 'Not found' });
}
