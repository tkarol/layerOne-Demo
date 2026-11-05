// The layout editor: an SE's own version of a deck. Reorder, show or hide and
// retitle slides, and rewrite the talk track. Only what differs from the
// official deck is saved, so official improvements still reach every layout
// for the parts nobody changed. Opened from the top bar (workspace.js).
import { esc } from './deck-core.js';

// Official talk text is HTML (<b>, entities); the editor works in plain text with **bold**.
const toText = (html) => {
  const ta = document.createElement('textarea');
  ta.innerHTML = String(html || '')
    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return ta.value.trim();
};
const plainTitle = (t) => toText(t).replace(/\*\*/g, '');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// A short fingerprint of a slide's official talk track, saved with any rewrite of it.
export function talkHash(talk) {
  const str = JSON.stringify([talk.key, talk.points, talk.ask, talk.objection, talk.next]);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}
const FIELDS = [
  ['key', 'Key message', 2],
  ['ask', 'Ask the room', 2],
  ['objection', 'If they say…', 3],
  ['next', 'Lead-in to the next slide', 2],
];

let dlg;

// opts: { deck: { id, label, slides }, layout: the whole deck (all products) or null for a
// new one, customers, onSaved(deck), onDeleted() }. This edits one product's slides.
export function openLayoutEditor(opts) {
  const { deck } = opts;
  const layout = opts.layout?.products?.[deck.id] || null; // this product's part of the deck
  const official = Object.fromEntries(deck.slides.map((s) => [s.id, s]));
  // The working copy: every slide, with official text filled in where the layout has none.
  const order = (layout?.order?.length ? [...layout.order.filter((id) => official[id]), ...deck.slides.map((s) => s.id).filter((id) => !layout.order.includes(id))] : deck.slides.map((s) => s.id));
  const ui = {
    ...opts,
    name: opts.layout?.name || 'My deck',
    customer: opts.layout?.customer || '',
    hasPart: Boolean(layout),
    rows: order.map((id) => {
      const s = official[id];
      const o = layout?.talk?.[id] || {};
      return {
        id,
        official: s,
        show: !layout?.hidden?.includes(id),
        title: layout?.titles?.[id] || '',
        key: o.key ?? toText(s.talk.key),
        points: o.points ? [...o.points] : s.talk.points.map(toText),
        ask: o.ask ?? toText(s.talk.ask),
        objection: o.objection ?? toText(s.talk.objection),
        next: o.next ?? toText(s.talk.next),
        notes: o.notes || '',
        open: false,
      };
    }),
    error: '',
  };
  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'settings layout-ed';
  document.body.append(dlg);
  draw(ui);
  dlg.showModal();
  dlg.addEventListener('close', () => dlg.remove());
}

function draw(ui) {
  const edited = (r) => {
    const s = r.official.talk;
    return (
      r.title ||
      r.notes ||
      norm(r.key) !== norm(toText(s.key)) ||
      norm(r.ask) !== norm(toText(s.ask)) ||
      norm(r.objection) !== norm(toText(s.objection)) ||
      norm(r.next) !== norm(toText(s.next)) ||
      JSON.stringify(r.points.map(norm).filter(Boolean)) !== JSON.stringify(s.points.map((p) => norm(toText(p))))
    );
  };
  const row = (r, n) => `
    <li class="le-row ${r.show ? '' : 'off'}" data-i="${n}" draggable="true">
      <div class="le-top">
        <span class="le-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
        <span class="le-move"><button type="button" data-up="${n}" aria-label="Move up" ${n === 0 ? 'disabled' : ''}>▲</button><button type="button" data-down="${n}" aria-label="Move down" ${n === ui.rows.length - 1 ? 'disabled' : ''}>▼</button></span>
        <label class="le-show"><input type="checkbox" data-show="${n}" ${r.show ? 'checked' : ''} /> Show</label>
        <span class="le-n">${n + 1}</span>
        <input class="le-title" data-title="${n}" value="${esc(r.title)}" placeholder="${esc(plainTitle(r.official.title || 'Title slide'))}" aria-label="Slide title" />
        ${edited(r) ? '<span class="le-edited">edited</span>' : ''}
        <button type="button" class="le-open" data-open="${n}" aria-expanded="${r.open}">${r.open ? 'Close' : 'Talk track'} ${r.open ? '▴' : '▾'}</button>
      </div>
      ${
        r.open
          ? `<div class="le-body">
              ${FIELDS.slice(0, 1).map(([k, label, rows]) => `<label>${label}<textarea data-f="${k}" data-r="${n}" rows="${rows}">${esc(r[k])}</textarea></label>`).join('')}
              <div class="le-points"><span class="le-lbl">Talking points</span>
                ${r.points.map((p, j) => `<div class="le-point"><textarea data-p="${j}" data-r="${n}" rows="2">${esc(p)}</textarea><span class="le-pbtn"><button type="button" data-pup="${j}" data-r="${n}" ${j === 0 ? 'disabled' : ''} aria-label="Move point up">▲</button><button type="button" data-pdown="${j}" data-r="${n}" ${j === r.points.length - 1 ? 'disabled' : ''} aria-label="Move point down">▼</button><button type="button" data-pdel="${j}" data-r="${n}" aria-label="Remove point">✕</button></span></div>`).join('')}
                <button type="button" class="link-btn" data-padd="${n}">＋ Add a point</button>
              </div>
              ${FIELDS.slice(1).map(([k, label, rows]) => `<label>${label}<textarea data-f="${k}" data-r="${n}" rows="${rows}">${esc(r[k])}</textarea></label>`).join('')}
              <label>Notes <span class="muted">(only in the talking points, never on the slide)</span><textarea data-f="notes" data-r="${n}" rows="2" placeholder="Reminders for yourself on this slide">${esc(r.notes)}</textarea></label>
              <p class="muted small">Use **double asterisks** for bold. <button type="button" class="link-btn" data-reset="${n}">Reset this slide to the official version</button></p>
            </div>`
          : ''
      }
    </li>`;
  dlg.innerHTML = `
    <form novalidate>
      <div class="s-head"><h2>${ui.layout?.id ? esc(ui.layout.name) : 'New deck'} <span class="muted">· ${esc(ui.deck.label)} slides</span></h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="s-body">
        <div class="le-headrow">
          <label class="le-name">Deck name<input id="leName" value="${esc(ui.name)}" maxlength="60" /></label>
          <label class="le-name">Account<select id="leCust"><option value="">No account (general deck)</option>${(ui.customers || []).map((c) => `<option value="${esc(c.id)}" ${c.id === ui.customer ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        </div>
        <p class="s-hint">One deck covers all five products. Here you change the <b>${esc(ui.deck.label)}</b> slides: drag or use ▲▼ to reorder, untick to skip a slide, and open <b>Talk track</b> to rewrite what you say. Anything you don’t change follows the official slides. The <b>account</b> puts its name, logo and color on every product. Everyone can open and copy this deck; its owner and the account’s team can change it.</p>
        <ol class="le-list">${ui.rows.map(row).join('')}</ol>
        <p class="err">${esc(ui.error)}</p>
      </div>
      <div class="s-foot">
        ${ui.layout?.id ? '<button type="button" class="link-btn danger" id="leDelete">Delete deck</button>' : ''}
        ${ui.layout?.id && ui.hasPart ? `<button type="button" class="link-btn" id="leReset">Reset ${esc(ui.deck.label)} slides to official</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="secondary" data-close>Cancel</button>
        <button type="submit" class="save">Save deck</button>
      </div>
    </form>`;
  wire(ui);
}

// Copy the visible inputs into the working copy.
function collect(ui) {
  const q = (sel) => dlg.querySelectorAll(sel);
  ui.name = dlg.querySelector('#leName').value;
  ui.customer = dlg.querySelector('#leCust').value;
  q('[data-show]').forEach((el) => (ui.rows[el.dataset.show].show = el.checked));
  q('[data-title]').forEach((el) => (ui.rows[el.dataset.title].title = el.value.trim()));
  q('[data-f]').forEach((el) => (ui.rows[el.dataset.r][el.dataset.f] = el.value));
  q('[data-p]').forEach((el) => (ui.rows[el.dataset.r].points[el.dataset.p] = el.value));
}

const swap = (a, i, j) => ([a[i], a[j]] = [a[j], a[i]]);

function wire(ui) {
  const on = (sel, fn) => dlg.querySelectorAll(sel).forEach((el) => (el.onclick = () => (collect(ui), fn(el), draw(ui))));
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  on('[data-up]', (b) => swap(ui.rows, +b.dataset.up, +b.dataset.up - 1));
  on('[data-down]', (b) => swap(ui.rows, +b.dataset.down, +b.dataset.down + 1));
  on('[data-open]', (b) => (ui.rows[b.dataset.open].open = !ui.rows[b.dataset.open].open));
  on('[data-padd]', (b) => ui.rows[b.dataset.padd].points.push(''));
  on('[data-pdel]', (b) => ui.rows[b.dataset.r].points.splice(+b.dataset.pdel, 1));
  on('[data-pup]', (b) => swap(ui.rows[b.dataset.r].points, +b.dataset.pup, +b.dataset.pup - 1));
  on('[data-pdown]', (b) => swap(ui.rows[b.dataset.r].points, +b.dataset.pdown, +b.dataset.pdown + 1));
  on('[data-reset]', (b) => {
    const r = ui.rows[b.dataset.reset];
    const t = r.official.talk;
    Object.assign(r, { title: '', key: toText(t.key), points: t.points.map(toText), ask: toText(t.ask), objection: toText(t.objection), next: toText(t.next), notes: '' });
  });
  dlg.querySelectorAll('[data-show]').forEach((el) => (el.onchange = () => (collect(ui), draw(ui))));

  // Drag and drop to reorder rows.
  let from = null;
  dlg.querySelectorAll('.le-row').forEach((li) => {
    li.ondragstart = (e) => {
      if (e.target.closest('input, textarea, button')) return e.preventDefault();
      from = +li.dataset.i;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    li.ondragend = () => li.classList.remove('dragging');
    li.ondragover = (e) => {
      e.preventDefault();
      li.classList.add('over');
    };
    li.ondragleave = () => li.classList.remove('over');
    li.ondrop = (e) => {
      e.preventDefault();
      const to = +li.dataset.i;
      if (from == null || from === to) return;
      collect(ui);
      const [moved] = ui.rows.splice(from, 1);
      ui.rows.splice(to, 0, moved);
      from = null;
      draw(ui);
    };
  });

  dlg.querySelector('#leDelete')?.addEventListener('click', async () => {
    if (!confirm(`Delete the deck “${ui.layout.name}”, for every product? Its link stops working, and anyone who has it open goes back to the official decks.`)) return;
    try {
      await call(`/api/layouts/${ui.layout.id}`, 'DELETE');
      dlg.close();
      ui.onDeleted?.();
    } catch (err) {
      ui.error = err.message;
      draw(ui);
    }
  });

  dlg.querySelector('#leReset')?.addEventListener('click', async () => {
    if (!confirm(`Put the ${ui.deck.label} slides in “${ui.layout.name}” back to the official slides? The deck’s other products keep their changes.`)) return;
    try {
      const saved = await call(`/api/layouts/${ui.layout.id}`, 'PUT', { products: { [ui.deck.id]: null } });
      dlg.close();
      ui.onSaved?.(saved);
    } catch (err) {
      ui.error = err.message;
      draw(ui);
    }
  });

  dlg.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    collect(ui);
    if (!ui.rows.some((r) => r.show)) {
      ui.error = 'Show at least one slide.';
      return draw(ui);
    }
    // Only this product's changes; the official order isn't stored.
    const order = ui.rows.map((r) => r.id);
    const part = { order: order.join() === ui.deck.slides.map((s) => s.id).join() ? [] : order, hidden: ui.rows.filter((r) => !r.show).map((r) => r.id), titles: {}, talk: {} };
    const body = { name: ui.name.trim(), customer: ui.customer || null, products: { [ui.deck.id]: part } };
    for (const r of ui.rows) {
      const s = r.official.talk;
      if (r.title) part.titles[r.id] = r.title;
      const t = {};
      for (const [k] of FIELDS) if (norm(r[k]) !== norm(toText(s[k]))) t[k] = r[k].trim();
      const pts = r.points.map((p) => p.trim()).filter(Boolean);
      if (JSON.stringify(pts.map(norm)) !== JSON.stringify(s.points.map((p) => norm(toText(p))))) t.points = pts;
      if (r.notes.trim()) t.notes = r.notes.trim();
      if (Object.keys(t).length) part.talk[r.id] = { ...t, base: talkHash(s) };
    }
    try {
      const saved = ui.layout?.id ? await call(`/api/layouts/${ui.layout.id}`, 'PUT', body) : await call('/api/layouts', 'POST', body);
      dlg.close();
      ui.onSaved?.(saved);
    } catch (err) {
      ui.error = err.data?.errors ? Object.values(err.data.errors).join('; ') : err.message;
      draw(ui);
    }
  };
}

async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  return data;
}
