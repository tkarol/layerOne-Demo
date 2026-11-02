// "Tailor" for the Vellox Reverser and Ranger pages: optionally fit the slides and
// the architecture to one customer. Tailoring lives in the customer profile (the
// same profiles that white-label the LayerOne demo apps), under profile.pitch.
// Every field is optional; blank means "keep the standard version".
import { esc } from './deck-core.js';

const MAX_LOGO_BYTES = 150 * 1024;

function authHeaders() {
  let pw = '';
  try {
    pw = sessionStorage.getItem('l1-settings-pw') || '';
  } catch {}
  return pw ? { 'X-Settings-Password': pw } : {};
}

async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.errors ? Object.values(data.errors).join('; ') : data.error || res.statusText), { status: res.status });
  return data;
}

// What the page needs to draw itself: the active customer and this product's tailoring.
export async function loadTailoring(product) {
  try {
    const { customer, pitch } = await fetch('/api/pitch').then((r) => r.json());
    const p = pitch?.[product] || {};
    return {
      customer: customer?.name || null,
      prepared: customer && !pitch?.hidePrepared ? customer.name : null,
      logo: pitch?.logo || null,
      p,
      hide: p.hide || [],
      titles: p.titles || {},
      notes: p.notes || {},
    };
  } catch {
    return { customer: null, prepared: null, logo: null, p: {}, hide: [], titles: {}, notes: {} };
  }
}

// The header button: "Tailor", or "For <customer>" while one is active.
export function tailorButton(btn, t) {
  btn.innerHTML = t.customer ? `<span class="tailor-dot"></span>For ${esc(t.customer)}` : '✎ Tailor';
  btn.title = t.customer ? 'Tailored for this customer: click to edit or switch back to the standard version' : 'Optional: tailor the slides and architecture for a customer';
}

let dlg;

// opts: { product, label, fields: [{ k, label, placeholder, options? }], slides: [{ id, title }], onSaved }
export async function openTailor(opts) {
  const list = await call('/api/profiles');
  const ui = { ...opts, list, selected: list.active || '', draft: null, error: '' };
  if (ui.selected) ui.draft = await call(`/api/profiles/${ui.selected}`);
  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'settings customize tailor';
  document.body.append(dlg);
  draw(ui);
  dlg.showModal();
  dlg.addEventListener('close', () => dlg.remove());
}

function draw(ui) {
  const { list, draft, product, label } = ui;
  const locked = list.locked;
  const pitch = draft?.pitch || {};
  const p = pitch[product] || {};
  const field = (f) => {
    const v = p[f.k] || '';
    const input = f.options
      ? `<select data-f="${f.k}">${f.options.map(([val, txt]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`
      : `<input data-f="${f.k}" value="${esc(v)}" placeholder="${esc(f.placeholder)}" />`;
    return `<label class="${f.full ? 'full' : ''}">${esc(f.label)}${f.where ? ` <span class="muted">(${esc(f.where)})</span>` : ''}${input}</label>`;
  };
  const slideRow = (s, n) => `
    <details class="tl-slide">
      <summary><label class="check" onclick="event.stopPropagation()"><input type="checkbox" data-show-slide="${s.id}" ${p.hide?.includes(s.id) ? '' : 'checked'} /> Show</label>
        <span class="tl-n">${n + 1}</span><b>${esc(p.titles?.[s.id] || s.title)}</b>${p.titles?.[s.id] || p.notes?.[s.id] ? '<span class="tl-edited">edited</span>' : ''}</summary>
      <div class="grid2">
        <label class="full">Slide title<input data-title="${s.id}" value="${esc(p.titles?.[s.id] || '')}" placeholder="${esc(s.title)}" /></label>
        <label class="full">Your notes for this customer <span class="muted">(talking points only; never shown on the slide)</span><textarea data-note="${s.id}" rows="3" placeholder="e.g. Their CISO cares most about…">${esc(p.notes?.[s.id] || '')}</textarea></label>
      </div>
    </details>`;

  dlg.innerHTML = `
    <form novalidate>
      <div class="s-head"><h2>Tailor ${esc(label)} for a customer</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="s-body">
        ${locked ? '<p class="s-locked">Customization is locked on this server (ALLOW_UI_SETTINGS=false).</p>' : ''}
        <p class="s-hint">Optional. Pick a customer and fill in only what helps; anything left blank keeps the standard version. Choose <b>Standard</b> to go back at any time.</p>
        <div class="profile-row">
          <label>Customer<select id="tlPick">
            <option value="">Standard (no customer)</option>
            ${list.profiles.map((x) => `<option value="${esc(x.id)}" ${x.id === ui.selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
            <option value="new" ${ui.selected === 'new' ? 'selected' : ''}>＋ New customer…</option>
          </select></label>
        </div>
        ${
          draft
            ? `<div class="grid2">
                 <label class="full">Customer name<input id="tlName" value="${esc(draft.name || '')}" placeholder="e.g. Department of Example" /></label>
                 <label class="check full"><input type="checkbox" id="tlPrepared" ${pitch.hidePrepared ? '' : 'checked'} /> Show “Prepared for ${esc(draft.name || 'the customer')}” on the title slide</label>
                 <label class="full">Customer logo <span class="muted">(title slide; optional)</span>
                   <span class="logo-row">${pitch.logo ? `<img src="${esc(pitch.logo)}" alt="" />` : ''}<input type="file" id="tlLogoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp" />${pitch.logo ? '<button type="button" class="link-btn" id="tlLogoClear">Remove</button>' : ''}</span>
                   <input id="tlLogo" value="${esc(pitch.logo?.startsWith('data:') ? '' : pitch.logo || '')}" placeholder="…or an https:// image URL" /></label>
                 ${list.passwordRequired ? '<label class="full">Settings password<input type="password" id="tlPw" autocomplete="current-password" placeholder="Required to save on this deployment" /></label>' : ''}
               </div>
               <div class="s-section-title">${esc(label)} details <span class="dim-note">blank keeps the standard text</span></div>
               <div class="grid2">${ui.fields.map(field).join('')}</div>
               <div class="s-section-title">Slides <span class="dim-note">untick to skip a slide; open one to retitle it or add notes</span></div>
               ${ui.slides.map(slideRow).join('')}
               <p class="muted small">This customer also applies to the LayerOne demo apps and the other Vellox pages. Clear just this page with <button type="button" class="link-btn" id="tlReset">reset ${esc(label)} to standard</button>.</p>`
            : '<p class="muted">The standard version: no customer name, standard slides and architecture.</p>'
        }
        <p class="err">${esc(ui.error)}</p>
      </div>
      <div class="s-foot"><span class="spacer"></span>
        <button type="button" class="secondary" data-close>Cancel</button>
        <button type="submit" class="save" ${locked ? 'disabled' : ''}>${draft ? 'Save and use' : 'Use the standard version'}</button>
      </div>
    </form>`;
  wire(ui);
}

// Copy the form into the draft profile.
function collect(ui) {
  const d = ui.draft;
  if (!d) return;
  const q = (s) => dlg.querySelector(s);
  d.name = q('#tlName')?.value.trim() || '';
  d.pitch ||= {};
  d.pitch.hidePrepared = !q('#tlPrepared')?.checked;
  const url = q('#tlLogo')?.value.trim();
  if (url) d.pitch.logo = url;
  else if (!d.pitch.logo?.startsWith('data:')) delete d.pitch.logo;
  const p = (d.pitch[ui.product] ||= {});
  dlg.querySelectorAll('[data-f]').forEach((el) => (p[el.dataset.f] = el.value.trim()));
  p.hide = ui.slides.map((s) => s.id).filter((id) => !q(`[data-show-slide="${id}"]`)?.checked);
  p.titles = {};
  p.notes = {};
  dlg.querySelectorAll('[data-title]').forEach((el) => el.value.trim() && (p.titles[el.dataset.title] = el.value.trim()));
  dlg.querySelectorAll('[data-note]').forEach((el) => el.value.trim() && (p.notes[el.dataset.note] = el.value.trim()));
  const pw = q('#tlPw')?.value;
  if (pw) {
    try {
      sessionStorage.setItem('l1-settings-pw', pw);
    } catch {}
  }
}

function wire(ui) {
  const q = (s) => dlg.querySelector(s);
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  q('#tlPick').onchange = async (e) => {
    ui.selected = e.target.value;
    ui.error = '';
    ui.draft = ui.selected === 'new' ? { name: '', apps: {}, steps: {}, pitch: {} } : ui.selected ? await call(`/api/profiles/${ui.selected}`) : null;
    draw(ui);
    if (ui.selected === 'new') q('#tlName')?.focus();
  };
  if (q('#tlReset')) q('#tlReset').onclick = () => {
    collect(ui);
    delete ui.draft.pitch[ui.product];
    draw(ui);
  };
  if (q('#tlLogoClear')) q('#tlLogoClear').onclick = () => {
    collect(ui);
    delete ui.draft.pitch.logo;
    draw(ui);
  };
  if (q('#tlLogoFile')) q('#tlLogoFile').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_LOGO_BYTES) {
      ui.error = 'That image is over 150 KB; use a smaller file or an https:// URL.';
      return draw(ui);
    }
    const r = new FileReader();
    r.onload = () => {
      collect(ui);
      ui.draft.pitch.logo = r.result;
      ui.error = '';
      draw(ui);
    };
    r.readAsDataURL(f);
  };
  q('form').onsubmit = async (e) => {
    e.preventDefault();
    collect(ui);
    try {
      if (ui.draft) {
        if (!ui.draft.name) throw new Error('Enter the customer name');
        const saved = ui.draft.id ? await call(`/api/profiles/${ui.draft.id}`, 'PUT', ui.draft) : await call('/api/profiles', 'POST', ui.draft);
        await call('/api/profiles/active', 'PUT', { id: saved.id });
      } else {
        await call('/api/profiles/active', 'PUT', { id: null });
      }
      dlg.close();
      await ui.onSaved?.();
    } catch (err) {
      ui.error = err.status === 401 ? 'Enter the settings password to save.' : err.message;
      draw(ui);
    }
  };
}
