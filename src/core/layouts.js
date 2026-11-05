// Decks (stored as "layouts"): someone's saved version of a product deck. A deck
// reorders, hides and retitles slides and rewrites the talk track; anything it
// leaves out follows the official deck, so official improvements still come through.
// A deck can be for one account (customer): it then shows that account's branding.
// You always open a deck explicitly; nothing switches on by itself.
// Everyone can see, present and copy every deck. Its owner, an admin, or the
// account team of the deck's account can change it.
// This is the only place slides are changed (accounts hold branding and facts).
// Text is stored as plain text (with **bold**); the browser escapes it.
import { json, randomHex } from './util.js';
import { LEGACY_OWNER, canEditDeck } from './workspace.js';

export const DECKS = ['vellox', 'layerone', 'reverser', 'ranger', 'navigator'];
// The page each deck lives on.
export const DECK_PAGES = { vellox: '/vellox.html', layerone: '/', reverser: '/reverser.html', ranger: '/ranger.html', navigator: '/navigator.html' };
const ID_RE = /^[a-z0-9-]{1,40}$/;
const MAX = { name: 60, title: 160, key: 600, point: 900, points: 15, ask: 600, objection: 900, next: 400, notes: 3000, slides: 30 };
const TALK = ['key', 'ask', 'objection', 'next', 'notes'];
const str = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

export function validateLayout(input, existing) {
  const errors = {};
  const deck = existing?.deck || input.deck;
  if (!DECKS.includes(deck)) errors.deck = 'Unknown deck';
  const name = str(input.name);
  if (!name) errors.name = 'Name your layout';
  else if (name.length > MAX.name) errors.name = 'Too long';
  const ids = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && ID_RE.test(x)))].slice(0, MAX.slides) : []);
  const order = ids(input.order);
  const hidden = ids(input.hidden);
  const titles = {};
  for (const [id, t] of Object.entries(input.titles || {})) {
    if (!ID_RE.test(id) || !str(t)) continue;
    if (str(t).length > MAX.title) errors[`title.${id}`] = 'Too long';
    titles[id] = str(t);
  }
  const talk = {};
  for (const [id, t] of Object.entries(input.talk || {})) {
    if (!ID_RE.test(id) || !t || typeof t !== 'object') continue;
    const out = {};
    for (const k of TALK) {
      const v = str(t[k]);
      // An emptied question, objection or lead-in means "leave it out".
      if (!v && typeof t[k] === 'string' && ['ask', 'objection', 'next'].includes(k)) out[k] = '';
      if (!v) continue;
      if (v.length > MAX[k]) errors[`talk.${id}.${k}`] = 'Too long';
      out[k] = v;
    }
    if (Array.isArray(t.points)) {
      const pts = t.points.map(str).filter(Boolean);
      if (pts.length > MAX.points) errors[`talk.${id}.points`] = `At most ${MAX.points} points`;
      if (pts.some((p) => p.length > MAX.point)) errors[`talk.${id}.points`] = 'A point is too long';
      out.points = pts.slice(0, MAX.points);
    }
    // A fingerprint of the official talk track this override was written against (to flag updates later).
    if (typeof t.base === 'string' && /^[0-9a-f]{1,16}$/.test(t.base)) out.base = t.base;
    if (Object.keys(out).some((k) => k !== 'base')) talk[id] = out;
  }
  // Leaving the account out keeps the deck's account; null or '' makes it a general deck.
  const given = 'customer' in input ? input.customer : existing?.customer;
  const customer = typeof given === 'string' && /^p_[0-9a-f]+$/.test(given) ? given : null;
  const layout = {
    id: existing?.id || `l_${randomHex(6)}`,
    deck,
    name,
    customer,
    order,
    hidden,
    titles,
    talk,
    owner: existing?.owner,
    updatedAt: new Date().toISOString(),
  };
  return { layout, errors, ok: Object.keys(errors).length === 0 };
}

const summary = (l, me, accounts) => ({
  id: l.id,
  deck: l.deck,
  name: l.name,
  customer: l.customer || null,
  owner: l.owner,
  updatedAt: l.updatedAt,
  updatedBy: l.updatedBy || l.owner,
  mine: Boolean(me && l.owner === me.id),
  canEdit: canEditDeck(l, me, accounts.get(l.customer)),
});
const accountsById = async (storage) => new Map((await storage.listKV('profile:p_')).filter(Boolean).map((p) => [p.id, p]));

// One-time move: slide changes that used to live on customers (Tailor: hidden
// slides, titles, notes) become customer layouts owned by the customer's owner.
export async function migrateCustomerSlides(storage) {
  if (await storage.getKV('migrated:customer-slides')) return;
  for (const profile of (await storage.listKV('profile:p_')).filter(Boolean)) {
    let changed = false;
    for (const deck of DECKS) {
      const p = profile.pitch?.[deck];
      if (!p || !(p.hide?.length || p.titles || p.notes)) continue;
      const talk = Object.fromEntries(Object.entries(p.notes || {}).map(([id, notes]) => [id, { notes }]));
      const { layout, ok } = validateLayout({ deck, name: profile.name, customer: profile.id, hidden: p.hide || [], titles: p.titles || {}, talk });
      if (ok) {
        layout.owner = profile.owner || LEGACY_OWNER;
        await storage.putKV(`layout:${layout.id}`, layout);
      }
      delete p.hide;
      delete p.titles;
      delete p.notes;
      changed = true;
    }
    if (changed) await storage.putKV(`profile:${profile.id}`, profile);
  }
  await storage.putKV('migrated:customer-slides', new Date().toISOString());
}

// /api/layouts/*
export async function handleLayoutApi(request, { storage, pathname, method, readJson, me, url }) {
  if (!me) return json(401, { error: 'Sign in to use decks' });
  await migrateCustomerSlides(storage);
  const [, , , id, action] = pathname.split('/');

  if (method === 'GET' && !id) {
    const deck = url.searchParams.get('deck');
    const customer = url.searchParams.get('customer');
    const accounts = await accountsById(storage);
    const all = (await storage.listKV('layout:l_')).filter((l) => l && (!deck || l.deck === deck) && (!customer || l.customer === customer));
    return json(200, { layouts: all.map((l) => summary(l, me, accounts)).sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name)) });
  }
  const existing = id ? await storage.getKV(`layout:${id}`) : null;
  if (id && !existing) return json(404, { error: 'Deck not found' });
  const accountOf = async (cid) => (cid ? storage.getKV(`profile:${cid}`) : null);
  const out = async (l) => ({ ...l, mine: l.owner === me.id, canEdit: canEditDeck(l, me, await accountOf(l.customer)) });
  if (method === 'GET') return json(200, await out(existing));
  if (me.guest) return json(403, { error: 'Guests can look around, but can’t change anything.' });
  // The account a new or changed deck is for must exist.
  const checkAccount = async (cid) => !cid || Boolean(await accountOf(cid));

  if (method === 'POST' && !id) {
    const { layout, errors, ok } = validateLayout(await readJson(request));
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    if (!(await checkAccount(layout.customer))) return json(400, { error: 'That account doesn’t exist' });
    layout.owner = me.id;
    layout.updatedBy = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, await out(layout));
  }
  // Copy any deck into your own, optionally renamed and for a different account.
  if (method === 'POST' && action === 'copy') {
    const body = await readJson(request);
    const customer = 'customer' in body ? body.customer || null : existing.customer;
    const { layout, errors, ok } = validateLayout({ ...existing, customer, name: String(body.name || `${existing.name} (copy)`).slice(0, MAX.name) });
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    if (!(await checkAccount(layout.customer))) return json(400, { error: 'That account doesn’t exist' });
    layout.owner = me.id;
    layout.updatedBy = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, await out(layout));
  }
  if (!canEditDeck(existing, me, await accountOf(existing.customer))) return json(403, { error: 'Only the deck’s owner or its account team can change it. Copy it to make your own.' });
  if (method === 'PUT') {
    const { layout, errors, ok } = validateLayout(await readJson(request), existing);
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    if (!(await checkAccount(layout.customer))) return json(400, { error: 'That account doesn’t exist' });
    layout.updatedBy = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, await out(layout));
  }
  if (method === 'DELETE') {
    await storage.deleteKV(`layout:${id}`);
    return json(200, { ok: true });
  }
  return json(404, { error: 'Not found' });
}
