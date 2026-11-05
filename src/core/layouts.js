// Decks (stored as "layouts"): someone's saved version of a product deck. A deck
// reorders, hides and retitles slides and rewrites the talk track; anything it
// leaves out follows the official deck, so official improvements still come through.
// A deck can be for one customer (set when it's made, then fixed): it shows their branding.
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

// One product's changes inside a deck: slide order, hidden slides, titles, talk track.
// Returns null when nothing is changed (the product shows its official slides).
function validatePart(input, errors, pre) {
  const ids = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && ID_RE.test(x)))].slice(0, MAX.slides) : []);
  const order = ids(input.order);
  const hidden = ids(input.hidden);
  const titles = {};
  for (const [id, t] of Object.entries(input.titles || {})) {
    if (!ID_RE.test(id) || !str(t)) continue;
    if (str(t).length > MAX.title) errors[`${pre}title.${id}`] = 'Too long';
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
      if (v.length > MAX[k]) errors[`${pre}talk.${id}.${k}`] = 'Too long';
      out[k] = v;
    }
    if (Array.isArray(t.points)) {
      const pts = t.points.map(str).filter(Boolean);
      if (pts.length > MAX.points) errors[`${pre}talk.${id}.points`] = `At most ${MAX.points} points`;
      if (pts.some((p) => p.length > MAX.point)) errors[`${pre}talk.${id}.points`] = 'A point is too long';
      out.points = pts.slice(0, MAX.points);
    }
    // A fingerprint of the official talk track this override was written against (to flag updates later).
    if (typeof t.base === 'string' && /^[0-9a-f]{1,16}$/.test(t.base)) out.base = t.base;
    if (Object.keys(out).some((k) => k !== 'base')) talk[id] = out;
  }
  const part = { order, hidden, titles, talk };
  const changed = order.length || hidden.length || Object.keys(titles).length || Object.keys(talk).length;
  return changed ? part : null;
}

// A deck covers the whole suite: { name, customer, products: { vellox: part, reverser: part, … } }.
// Saving merges by product: a product you send replaces that product's part (null clears
// it back to the official slides); products you leave out keep what they had.
// The older one-product shape ({ deck, order, hidden, titles, talk }) is still accepted.
export function validateLayout(input, existing) {
  const errors = {};
  const name = str(input.name ?? existing?.name);
  if (!name) errors.name = 'Name your deck';
  else if (name.length > MAX.name) errors.name = 'Too long';
  const products = { ...(existing?.products || {}) };
  const incoming = input.products && typeof input.products === 'object' ? input.products : DECKS.includes(input.deck) ? { [input.deck]: input } : {};
  for (const [pid, part] of Object.entries(incoming)) {
    if (!DECKS.includes(pid)) continue;
    const p = part && typeof part === 'object' ? validatePart(part, errors, `${pid}.`) : null;
    if (p) products[pid] = p;
    else delete products[pid];
  }
  // Leaving the account out keeps the deck's account; null or '' makes it a general deck.
  const given = 'customer' in input ? input.customer : existing?.customer;
  const customer = typeof given === 'string' && /^p_[0-9a-f]+$/.test(given) ? given : null;
  const layout = {
    id: existing?.id || `l_${randomHex(6)}`,
    name,
    customer,
    products,
    owner: existing?.owner,
    updatedAt: new Date().toISOString(),
  };
  return { layout, errors, ok: Object.keys(errors).length === 0 };
}

// The product page a deck opens on: the one named, else the first it changes, else the suite.
export const deckPage = (layout, product) => DECK_PAGES[DECKS.includes(product) ? product : DECKS.find((d) => layout?.products?.[d]) || 'vellox'];

// One-time move to suite-wide decks: each one-product deck becomes a suite deck with that
// product's changes. One person's decks for the same account (changing different products)
// are merged into their oldest deck, which keeps its name; old ids keep working as aliases.
export async function migrateSuiteDecks(storage) {
  if (await storage.getKV('migrated:suite-decks')) return;
  const all = (await storage.listKV('layout:l_')).filter(Boolean);
  const converted = [];
  for (const l of all) {
    if (l.products) {
      converted.push(l);
      continue;
    }
    const { deck, order, hidden, titles, talk, ...rest } = l;
    const part = validatePart({ order, hidden, titles, talk }, {}, '');
    const next = { ...rest, products: DECKS.includes(deck) && part ? { [deck]: part } : {} };
    await storage.putKV(`layout:${l.id}`, next);
    converted.push(next);
  }
  const groups = new Map();
  for (const l of converted) {
    if (!l.customer) continue;
    const k = `${l.owner}|${l.customer}`;
    groups.set(k, [...(groups.get(k) || []), l]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
    const keep = list[0];
    for (const other of list.slice(1)) {
      if (Object.keys(other.products).some((p) => keep.products[p])) continue; // both change the same product: keep both
      Object.assign(keep.products, other.products);
      await storage.deleteKV(`layout:${other.id}`);
      await storage.putKV(`deck-alias:${other.id}`, keep.id);
    }
    await storage.putKV(`layout:${keep.id}`, keep);
  }
  await storage.putKV('migrated:suite-decks', new Date().toISOString());
}

// A deck by id, following the alias of a deck that was merged into another.
export async function getDeck(storage, id) {
  return (await storage.getKV(`layout:${id}`)) || ((await storage.getKV(`deck-alias:${id}`)) ? storage.getKV(`layout:${await storage.getKV(`deck-alias:${id}`)}`) : null);
}

const summary = (l, me, accounts) => ({
  id: l.id,
  name: l.name,
  products: DECKS.filter((d) => l.products?.[d]),
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
    const products = {};
    for (const deck of DECKS) {
      const p = profile.pitch?.[deck];
      if (!p || !(p.hide?.length || p.titles || p.notes)) continue;
      const talk = Object.fromEntries(Object.entries(p.notes || {}).map(([id, notes]) => [id, { notes }]));
      products[deck] = { hidden: p.hide || [], titles: p.titles || {}, talk };
      delete p.hide;
      delete p.titles;
      delete p.notes;
      changed = true;
    }
    if (changed) {
      const { layout, ok } = validateLayout({ name: profile.name, customer: profile.id, products });
      if (ok) {
        layout.owner = profile.owner || LEGACY_OWNER;
        await storage.putKV(`layout:${layout.id}`, layout);
      }
    }
    if (changed) await storage.putKV(`profile:${profile.id}`, profile);
  }
  await storage.putKV('migrated:customer-slides', new Date().toISOString());
}

// /api/layouts/*
export async function handleLayoutApi(request, { storage, pathname, method, readJson, me, url }) {
  if (!me) return json(401, { error: 'Sign in to use decks' });
  const [, , , id, action] = pathname.split('/');

  if (method === 'GET' && !id) {
    const customer = url.searchParams.get('customer');
    const accounts = await accountsById(storage);
    const all = (await storage.listKV('layout:l_')).filter((l) => l && (!customer || l.customer === customer));
    return json(200, { layouts: all.map((l) => summary(l, me, accounts)).sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name)) });
  }
  const existing = id ? await getDeck(storage, id) : null;
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
    // A deck stays with the customer it was made for: saving never changes it.
    // To present a deck to someone else, copy it for them.
    const body = await readJson(request);
    delete body.customer;
    const { layout, errors, ok } = validateLayout(body, existing);
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    if (!(await checkAccount(layout.customer))) return json(400, { error: 'That account doesn’t exist' });
    layout.updatedBy = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, await out(layout));
  }
  if (method === 'DELETE') {
    await storage.deleteKV(`layout:${existing.id}`);
    return json(200, { ok: true });
  }
  return json(404, { error: 'Not found' });
}
