// Deck layouts: each SE's own version of a deck. A layout reorders, hides and
// retitles slides and rewrites the talk track; anything it leaves out follows
// the official deck, so official improvements still come through.
// Layouts are shared to view and copy; only their owner can change them.
// Text is stored as plain text (with **bold**); the browser escapes it.
import { json, randomHex } from './util.js';

export const DECKS = ['vellox', 'layerone', 'reverser', 'ranger', 'navigator'];
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
  const layout = {
    id: existing?.id || `l_${randomHex(6)}`,
    deck,
    name,
    order,
    hidden,
    titles,
    talk,
    owner: existing?.owner,
    updatedAt: new Date().toISOString(),
  };
  return { layout, errors, ok: Object.keys(errors).length === 0 };
}

const summary = (l, me) => ({ id: l.id, deck: l.deck, name: l.name, owner: l.owner, updatedAt: l.updatedAt, mine: Boolean(me && l.owner === me.id) });

// /api/layouts/*
export async function handleLayoutApi(request, { storage, pathname, method, readJson, me, url }) {
  if (!me) return json(401, { error: 'Sign in to use layouts' });
  const [, , , id, action] = pathname.split('/');

  if (method === 'GET' && !id) {
    const deck = url.searchParams.get('deck');
    const all = (await storage.listKV('layout:l_')).filter((l) => l && (!deck || l.deck === deck));
    return json(200, { layouts: all.map((l) => summary(l, me)).sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name)) });
  }
  const existing = id ? await storage.getKV(`layout:${id}`) : null;
  if (id && !existing) return json(404, { error: 'Layout not found' });
  if (method === 'GET') return json(200, { ...existing, mine: existing.owner === me.id });

  if (method === 'POST' && !id) {
    const { layout, errors, ok } = validateLayout(await readJson(request));
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    layout.owner = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, { ...layout, mine: true });
  }
  if (method === 'POST' && action === 'copy') {
    const { name } = await readJson(request);
    const { layout, errors, ok } = validateLayout({ ...existing, name: String(name || `${existing.name} (copy)`).slice(0, MAX.name) });
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    layout.owner = me.id;
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, { ...layout, mine: true });
  }
  if (existing.owner !== me.id) return json(403, { error: 'This is someone else’s layout. Make a copy to change it.' });
  if (method === 'PUT') {
    const { layout, errors, ok } = validateLayout(await readJson(request), existing);
    if (!ok) return json(400, { error: 'Some fields are invalid', errors });
    await storage.putKV(`layout:${layout.id}`, layout);
    return json(200, { ...layout, mine: true });
  }
  if (method === 'DELETE') {
    await storage.deleteKV(`layout:${id}`);
    return json(200, { ok: true });
  }
  return json(404, { error: 'Not found' });
}
