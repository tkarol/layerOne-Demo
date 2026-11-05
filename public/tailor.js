// "✎ Customer" on the Vellox product pages: the branding and details of the
// account the open deck is for (name, color, logo, "Prepared for", and this
// product's details such as their environment or next step). Slides and talk
// track live in the deck itself (Deck ▾ → Edit slides). Every detail is
// optional; blank keeps the standard text.
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
    if (customer?.color) document.documentElement.style.setProperty('--cust', customer.color);
    return {
      customer: customer?.name || null,
      prepared: customer && !pitch?.hidePrepared ? customer.name : null,
      logo: pitch?.logo || null,
      p,
    };
  } catch {
    return { customer: null, prepared: null, logo: null, p: {} };
  }
}

// The header button: "✎ Customer" while the open deck is for a customer; hidden otherwise.
export function tailorButton(btn, t) {
  const show = Boolean(window.ws?.signedIn && window.ws.customer && t.customer);
  btn.hidden = !show;
  btn.innerHTML = '✎ Customer';
  btn.title = show ? `${t.customer}: name, logo, color and details on this page` : '';
}

let dlg;

// opts: { product, label, fields: [{ k, label, placeholder, options? }], onSaved }
export async function openTailor(opts) {
  const id = window.ws?.customer;
  if (!id) return;
  const ui = { ...opts, draft: await call(`/api/profiles/${id}`), error: '' };
  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'settings customize tailor';
  document.body.append(dlg);
  draw(ui);
  dlg.showModal();
  dlg.addEventListener('close', () => dlg.remove());
}

function draw(ui) {
  const { draft, product, label } = ui;
  const readOnly = draft.canEdit === false;
  const pitch = draft.pitch || {};
  const p = pitch[product] || {};
  const owner = window.ws?.presenterName(draft.owner || 'tyler') || 'the owner';
  const field = (f) => {
    const v = p[f.k] || '';
    const input = f.options
      ? `<select data-f="${f.k}">${f.options.map(([val, txt]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`
      : `<input data-f="${f.k}" value="${esc(v)}" placeholder="${esc(f.placeholder)}" />`;
    return `<label class="${f.full ? 'full' : ''}">${esc(f.label)}${f.where ? ` <span class="muted">(${esc(f.where)})</span>` : ''}${input}</label>`;
  };

  dlg.innerHTML = `
    <form novalidate>
      <div class="s-head"><h2>${esc(draft.name)} <span class="muted">· customer</span></h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="s-body">
        <p class="s-hint">What every deck for this customer shows: its name, color and logo, plus details for the ${esc(label)} slides. Anything left blank keeps the standard text. To change slides or the talk track, use <b>Deck ▾ → Edit slides</b>.</p>
        ${readOnly ? `<p class="s-locked tl-ro">Set up by <b>${esc(owner)}</b>. Only they and the people they added can change it; ask them, or an admin, to add you.</p>` : ''}
        <fieldset class="tl-fields" ${readOnly ? 'disabled' : ''}><div class="grid2">
          <label class="full">Customer name<input id="tlName" value="${esc(draft.name || '')}" placeholder="e.g. Department of Example" /></label>
          <label>Brand color <span class="muted">(an accent: title slide, “Prepared for”, top bar)</span><span class="color-row"><input type="color" id="tlColor" value="${esc(draft.color || '#2563eb')}" /><code>${esc(draft.color || 'none')}</code></span></label>
          <label class="check tl-usecolor"><input type="checkbox" id="tlUseColor" ${draft.color ? 'checked' : ''} /> Use the brand color</label>
          <label class="check full"><input type="checkbox" id="tlPrepared" ${pitch.hidePrepared ? '' : 'checked'} /> Show “Prepared for ${esc(draft.name || 'the customer')}” on title slides</label>
          <label class="full">Logo <span class="muted">(title slides; optional)</span>
            <span class="logo-row">${pitch.logo ? `<img src="${esc(pitch.logo)}" alt="" />` : ''}<input type="file" id="tlLogoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp" />${pitch.logo ? '<button type="button" class="link-btn" id="tlLogoClear">Remove</button>' : ''}</span>
            <input id="tlLogo" value="${esc(pitch.logo?.startsWith('data:') ? '' : pitch.logo || '')}" placeholder="…or an https:// image URL" /></label>
        </div>
        ${ui.fields.length ? `<div class="s-section-title">${esc(label)} details <span class="dim-note">blank keeps the standard text</span></div><div class="grid2">${ui.fields.map(field).join('')}</div>` : ''}
        <p class="muted small">Name, color and logo apply to every product, every deck for this customer, and the LayerOne sample apps.</p></fieldset>
        <p class="err">${esc(ui.error)}</p>
      </div>
      <div class="s-foot"><span class="spacer"></span>
        <button type="button" class="secondary" data-close>${readOnly ? 'Close' : 'Cancel'}</button>
        ${readOnly ? '' : '<button type="submit" class="save">Save</button>'}
      </div>
    </form>`;
  wire(ui);
}

// Copy the form into the draft account.
function collect(ui) {
  const d = ui.draft;
  if (d.canEdit === false) return;
  const q = (s) => dlg.querySelector(s);
  d.name = q('#tlName')?.value.trim() || '';
  d.color = q('#tlUseColor')?.checked ? q('#tlColor').value : '';
  d.pitch ||= {};
  d.pitch.hidePrepared = !q('#tlPrepared')?.checked;
  const url = q('#tlLogo')?.value.trim();
  if (url) d.pitch.logo = url;
  else if (!d.pitch.logo?.startsWith('data:')) delete d.pitch.logo;
  const p = (d.pitch[ui.product] ||= {});
  dlg.querySelectorAll('[data-f]').forEach((el) => (p[el.dataset.f] = el.value.trim()));
}

function wire(ui) {
  const q = (s) => dlg.querySelector(s);
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  q('#tlColor')?.addEventListener('input', (e) => {
    q('#tlUseColor').checked = true;
    e.target.nextElementSibling.textContent = e.target.value;
  });
  q('#tlLogoClear')?.addEventListener('click', () => {
    collect(ui);
    delete ui.draft.pitch.logo;
    draw(ui);
  });
  q('#tlLogoFile')?.addEventListener('change', (e) => {
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
  });
  q('form').onsubmit = async (e) => {
    e.preventDefault();
    collect(ui);
    try {
      if (!ui.draft.name) throw new Error('Enter the customer’s name');
      await call(`/api/profiles/${ui.draft.id}`, 'PUT', ui.draft);
      dlg.close();
      await window.ws?.refreshAccounts?.();
      await ui.onSaved?.();
    } catch (err) {
      ui.error = err.message;
      draw(ui);
    }
  };
}
