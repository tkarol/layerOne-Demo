// Shared by the top bar (workspace.js) and the deck library (decks.js): the
// products, deck links, and the "New deck" and "Customer" dialogs.
//
// People only make decks. A deck is a presentation across the whole suite
// (Vellox, LayerOne, Reverser, Ranger, Navigator), optionally for a customer
// (a customer, an opportunity or an event). The customer's name, logo and color
// are on every product page; for each product the deck can change the slides.
// Under the hood a customer is shared by every deck for it (stored as a
// "profile"), so its logo and its team (who can edit) are set once.

export const PRODUCTS = [
  { id: 'vellox', name: 'Vellox', label: 'Vellox suite', page: '/vellox.html', rgb: '250 204 21' },
  { id: 'layerone', name: 'LayerOne', label: 'Vellox LayerOne', page: '/', rgb: '74 222 128' },
  { id: 'reverser', name: 'Reverser', label: 'Vellox Reverser', page: '/reverser.html', rgb: '34 211 238' },
  { id: 'ranger', name: 'Ranger', label: 'Vellox Ranger', page: '/ranger.html', rgb: '167 139 250' },
  { id: 'navigator', name: 'Navigator', label: 'Vellox Navigator', page: '/navigator.html', rgb: '96 165 250' },
];
export const productOf = (id) => PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Open a deck on its product page (the official deck when id is empty).
export function deckHref(product, id, account, { edit = false } = {}) {
  const qs = new URLSearchParams({ deck: id || 'official' });
  if (id && account) qs.set('acct', account);
  if (edit) qs.set('edit', '1');
  return `${productOf(product).page}?${qs}#overview`;
}
// The short link to share: /d/<id> always opens the deck as it is now.
export const shareUrl = (id) => `${location.origin}/d/${id}`;

export async function copyLink(id) {
  const url = shareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    prompt('Copy this link', url);
    return false;
  }
}

export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.round(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.errors ? Object.values(data.errors).join('; ') : data.error || res.statusText), { status: res.status, data });
  return data;
}

function dialog(cls) {
  const dlg = document.createElement('dialog');
  dlg.className = `settings ${cls}`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => e.target.closest('[data-close]') && dlg.close());
  return dlg;
}

// ---------- logo input (upload or https URL) ----------
const MAX_LOGO = 150 * 1024;
const logoField = (logo, id, hint) => `
  <label class="full">Logo <span class="muted">(${hint})</span>
    <span class="logo-row">${logo ? `<img src="${esc(logo)}" alt="" />` : ''}<input type="file" id="${id}File" accept="image/png,image/jpeg,image/svg+xml,image/webp" />${logo ? `<button type="button" class="link-btn" id="${id}Clear">Remove</button>` : ''}</span>
    <input id="${id}Url" value="${esc(logo?.startsWith('data:') ? '' : logo || '')}" placeholder="…or paste an https:// image link" /></label>`;
// Wire a logo field: onChange(newLogo) with a data: URL, an https URL or ''.
function wireLogo(dlg, id, get, onChange, onError) {
  dlg.querySelector(`#${id}File`)?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_LOGO) return onError('That image is over 150 KB; use a smaller file or an https:// link.');
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
  });
  dlg.querySelector(`#${id}Clear`)?.addEventListener('click', () => onChange(''));
  dlg.querySelector(`#${id}Url`)?.addEventListener('change', (e) => {
    const v = e.target.value.trim();
    if (v || !get()?.startsWith('data:')) onChange(v);
  });
}

// ---------- New deck ----------
// opts: { accounts (customers), account (preselected customer id), from (a deck to copy), onCreated(deck) }
export function newDeckDialog(opts) {
  const dlg = dialog('nd');
  const customers = [...(opts.accounts || [])].sort((a, b) => a.name.localeCompare(b.name));
  const ui = {
    cust: opts.account ?? opts.from?.customer ?? 'new',
    start: opts.from ? 'copy' : 'official',
    name: '',
    named: false,
    newName: '',
    color: '#2563eb',
    logo: '',
    full: null, // the chosen existing customer, loaded
    change: false, // changing an existing customer's logo or color (affects all their decks)
    error: '',
    busy: false,
  };
  const custName = () => (ui.cust === 'new' ? ui.newName.trim() : customers.find((c) => c.id === ui.cust)?.name || '');
  const load = async () => {
    ui.full = null;
    if (ui.cust && ui.cust !== 'new') {
      try {
        ui.full = await call(`/api/profiles/${ui.cust}`);
        ui.logo = ui.full.pitch?.logo || '';
        ui.color = ui.full.color || '#2563eb';
      } catch {}
    } else if (ui.cust === '') ui.logo = '';
  };
  const draw = () => {
    if (!ui.named) ui.name = custName() || 'My deck';
    const isNew = ui.cust === 'new';
    const canEditCust = isNew || ui.full?.canEdit !== false;
    dlg.innerHTML = `
      <form novalidate>
        <div class="s-head"><h2>New deck</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="s-body">
          <p class="s-hint">One deck covers the whole suite: Vellox, LayerOne, Reverser, Ranger and Navigator. The customer’s name and logo go on every product’s title slide. You can change any product’s slides afterwards.</p>
          <div class="grid2">
            <label class="full">Who are you presenting to?<select id="ndCust">
              <option value="new" ${isNew ? 'selected' : ''}>＋ A new customer</option>
              ${customers.length ? `<optgroup label="Customers already here">${customers.map((c) => `<option value="${esc(c.id)}" ${c.id === ui.cust ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}
              <option value="" ${ui.cust === '' ? 'selected' : ''}>No one in particular (a general deck)</option>
            </select></label>
            ${
              ui.cust === ''
                ? ''
                : `${isNew ? `<label>Customer name<input id="ndNewName" maxlength="80" value="${esc(ui.newName)}" placeholder="e.g. Department of Example" /></label>` : ''}
                   ${
                     isNew || ui.change
                       ? `<label ${isNew ? '' : 'class="full"'}>Brand color <span class="muted">(an accent)</span><span class="color-row"><input type="color" id="ndColor" value="${esc(ui.color)}" /><code>${esc(ui.color)}</code></span></label>
                          ${logoField(ui.logo, 'ndLogo', 'on every product’s title slide; PNG, JPEG, SVG or WebP under 150 KB')}
                          ${isNew ? '' : `<p class="s-locked full">This changes the logo and color on <b>every deck</b> for ${esc(ui.full?.name || 'this customer')}.</p>`}`
                       : `<div class="nd-cust full">${ui.logo ? `<img src="${esc(ui.logo)}" alt="" />` : `<i style="background:${esc(ui.color)}"></i>`}<span><b>${esc(ui.full?.name || '')}</b><small>${ui.logo ? 'Their logo goes on every product.' : 'No logo yet.'}</small></span>
                            ${canEditCust && ui.full ? `<button type="button" class="link-btn" id="ndChange">${ui.logo ? 'Change logo or color' : 'Add a logo'}</button>` : `<small class="muted">Set up by ${esc(opts.nameOf?.(ui.full?.owner) || 'someone else')}</small>`}</div>`
                   }`
            }
            <label class="full">Deck name <span class="muted">(so you can tell your decks apart)</span><input id="ndName" maxlength="60" value="${esc(ui.name)}" /></label>
          </div>
          ${
            opts.from
              ? `<div class="s-section-title">Start from</div>
                 <div class="nd-start">
                   <label class="check"><input type="radio" name="ndStart" value="official" ${ui.start === 'official' ? 'checked' : ''} /> The official slides</label>
                   <label class="check"><input type="radio" name="ndStart" value="copy" ${ui.start === 'copy' ? 'checked' : ''} /> A copy of “${esc(opts.from.name)}”</label>
                 </div>`
              : ''
          }
          <p class="err">${esc(ui.error)}</p>
        </div>
        <div class="s-foot"><span class="spacer"></span>
          <button type="button" class="secondary" data-close>Cancel</button>
          <button type="submit" class="save" ${ui.busy ? 'disabled' : ''}>Create deck</button>
        </div>
      </form>`;
    const q = (s) => dlg.querySelector(s);
    q('#ndChange')?.addEventListener('click', () => ((ui.change = true), draw()));
    q('#ndCust').onchange = async (e) => {
      ui.cust = e.target.value;
      ui.change = false;
      ui.error = '';
      if (ui.cust === 'new') {
        ui.logo = '';
        ui.color = '#2563eb';
      }
      await load();
      draw();
      q('#ndNewName')?.focus();
    };
    q('#ndNewName')?.addEventListener('input', (e) => {
      ui.newName = e.target.value;
      if (!ui.named) q('#ndName').value = ui.name = custName() || 'My deck';
    });
    q('#ndColor')?.addEventListener('input', (e) => ((ui.color = e.target.value), (e.target.nextElementSibling.textContent = e.target.value)));
    wireLogo(
      dlg,
      'ndLogo',
      () => ui.logo,
      (v) => ((ui.logo = v), (ui.error = ''), draw()),
      (m) => ((ui.error = m), draw()),
    );
    q('#ndName').oninput = (e) => ((ui.name = e.target.value), (ui.named = true));
    dlg.querySelectorAll('[name="ndStart"]').forEach((r) => (r.onchange = () => (ui.start = r.value)));
    q('form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        if (!ui.name.trim()) throw new Error('Name the deck');
        ui.busy = true;
        let customer = ui.cust;
        if (customer === 'new') {
          if (!ui.newName.trim()) throw new Error('Enter the customer’s name');
          customer = (await call('/api/profiles', 'POST', { name: ui.newName.trim(), color: ui.color, pitch: ui.logo ? { logo: ui.logo } : {} })).id;
        } else if (customer && ui.change && ui.full && ui.full.canEdit !== false && ((ui.full.pitch?.logo || '') !== ui.logo || (ui.full.color || '#2563eb') !== ui.color)) {
          // A new logo or color for an existing customer: saved on the customer.
          await call(`/api/profiles/${customer}`, 'PUT', { ...ui.full, color: ui.color, pitch: { ...(ui.full.pitch || {}), logo: ui.logo || undefined } });
        }
        const deck =
          ui.start === 'copy'
            ? await call(`/api/layouts/${opts.from.id}/copy`, 'POST', { name: ui.name.trim(), customer: customer || null })
            : await call('/api/layouts', 'POST', { name: ui.name.trim(), customer: customer || null, products: {} });
        dlg.close();
        opts.onCreated?.(deck);
      } catch (err) {
        ui.busy = false;
        ui.error = err.message;
        draw();
      }
    };
  };
  dlg.showModal();
  load().then(() => {
    draw();
    (dlg.querySelector('#ndNewName') || dlg.querySelector('#ndCust')).focus();
  });
  draw();
}

// ---------- Customer ----------
// The customer a deck is for: name, logo, color, Prepared for, and who else can edit.
// opts: { account (summary), people, me, onSaved(customer), onDeleted() }
export async function accountDialog(opts) {
  const dlg = dialog('acct');
  const full = await call(`/api/profiles/${opts.account.id}`);
  const ui = { a: { ...full, team: [...(full.team || [])], pitch: { ...(full.pitch || {}) } }, useColor: Boolean(full.color), error: '' };
  const ro = full.canEdit === false;
  const owner = full.owner || 'tyler';
  const nameOf = (id) => opts.people.find((p) => p.id === id)?.name || id;
  const draw = () => {
    const teamable = opts.people.filter((p) => p.id !== owner);
    dlg.innerHTML = `
      <form novalidate>
        <div class="s-head"><h2>${esc(full.name)} <span class="muted">· customer</span></h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="s-body">
          <p class="s-hint">What every deck for this customer shows, on every product.${opts.deckCount > 1 ? ` <b>${opts.deckCount} decks</b> use it.` : ''}</p>
          ${ro ? `<p class="s-locked">Set up by <b>${esc(nameOf(owner))}</b>. Ask them (or an admin) to add you below to make changes.</p>` : ''}
          <fieldset ${ro ? 'disabled' : ''} class="tl-fields">
            <div class="grid2">
              <label class="full">Customer name<input id="acName" maxlength="80" value="${esc(ui.a.name)}" /></label>
              ${logoField(ui.a.pitch.logo, 'acLogo', 'on every product’s title slide; PNG, JPEG, SVG or WebP under 150 KB')}
              <label>Brand color <span class="muted">(an accent)</span><span class="color-row"><input type="color" id="acColor" value="${esc(ui.a.color || '#2563eb')}" /><code>${esc(ui.useColor ? ui.a.color || '#2563eb' : 'none')}</code></span></label>
              <label class="check"><input type="checkbox" id="acUseColor" ${ui.useColor ? 'checked' : ''} /> Use the brand color</label>
              <label class="check full"><input type="checkbox" id="acPrepared" ${ui.a.pitch.hidePrepared ? '' : 'checked'} /> Show “Prepared for ${esc(ui.a.name || 'the customer')}” on title slides</label>
            </div>
            <div class="s-section-title">Who else can edit <span class="dim-note">${esc(nameOf(owner))} set it up; these people can change this customer and its decks</span></div>
            <div class="ac-team">${teamable.map((p) => `<label class="check"><input type="checkbox" data-team="${esc(p.id)}" ${ui.a.team.includes(p.id) ? 'checked' : ''} /> ${esc(p.name)} <span class="ac-role">${p.role === 'ae' ? 'AE' : 'SE'}</span></label>`).join('')}</div>
          </fieldset>
          <p class="s-hint">Product details (their environment, tools, next steps) are on each product page under <b>✎ Customer</b>.</p>
          <p class="err">${esc(ui.error)}</p>
        </div>
        <div class="s-foot">
          ${ro ? '' : '<button type="button" class="link-btn danger" id="acDelete">Delete customer</button>'}
          <span class="spacer"></span>
          <button type="button" class="secondary" data-close>${ro ? 'Close' : 'Cancel'}</button>
          ${ro ? '' : '<button type="submit" class="save">Save</button>'}
        </div>
      </form>`;
    const q = (s) => dlg.querySelector(s);
    // Keep what's typed when the form redraws (a logo upload redraws it).
    const keep = () => {
      ui.a.name = q('#acName').value;
      ui.useColor = q('#acUseColor').checked;
      ui.a.team = [...dlg.querySelectorAll('[data-team]:checked')].map((x) => x.dataset.team);
      ui.a.pitch.hidePrepared = !q('#acPrepared').checked;
    };
    q('#acColor').oninput = (e) => {
      ui.a.color = e.target.value;
      ui.useColor = true;
      q('#acUseColor').checked = true;
      e.target.nextElementSibling.textContent = e.target.value;
    };
    wireLogo(
      dlg,
      'acLogo',
      () => ui.a.pitch.logo,
      (v) => {
        keep();
        if (v) ui.a.pitch.logo = v;
        else delete ui.a.pitch.logo;
        ui.error = '';
        draw();
      },
      (m) => {
        keep();
        ui.error = m;
        draw();
      },
    );
    q('#acDelete')?.addEventListener('click', async () => {
      if (!confirm(`Delete the customer “${full.name}”? Its decks stay, as general decks without a logo.`)) return;
      try {
        await call(`/api/profiles/${full.id}`, 'DELETE');
        dlg.close();
        opts.onDeleted?.();
      } catch (err) {
        ui.error = err.message;
        draw();
      }
    });
    q('form').onsubmit = async (e) => {
      e.preventDefault();
      keep();
      ui.a.name = ui.a.name.trim();
      try {
        if (!ui.a.name) throw new Error('Enter the customer’s name');
        const saved = await call(`/api/profiles/${full.id}`, 'PUT', { ...ui.a, color: ui.useColor ? ui.a.color || '#2563eb' : '' });
        dlg.close();
        opts.onSaved?.(saved);
      } catch (err) {
        ui.error = err.message;
        draw();
      }
    };
  };
  draw();
  dlg.showModal();
  if (!ro) dlg.querySelector('#acName').focus();
}
export const customerDialog = accountDialog;

// ---------- Deck settings ----------
// Rename, copy for someone else, share, delete. The customer can't be changed here
// (or anywhere): a deck stays with the customer it was made for.
// opts: { deck (summary or full), customer (summary or null), product (page), onRenamed(deck), onCopy(), onDeleted() }
export function deckSettingsDialog(opts) {
  const dlg = dialog('dset');
  const d = opts.deck;
  const c = opts.customer;
  const ui = { name: d.name, error: '', copied: false };
  const link = shareUrl(opts.product ? `${d.id}/${opts.product}` : d.id);
  const draw = () => {
    const ro = d.canEdit === false;
    dlg.innerHTML = `
      <form novalidate>
        <div class="s-head"><h2>Deck settings</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="s-body">
          <div class="grid2">
            <label class="full">Deck name<input id="dsName" maxlength="60" value="${esc(ui.name)}" ${ro ? 'disabled' : ''} /></label>
          </div>
          <div class="s-section-title">Who it’s for</div>
          <div class="nd-cust">${c ? (c.hasLogo ? `<img src="/api/profiles/${esc(c.id)}/logo?v=${encodeURIComponent(c.updatedAt || '')}" alt="" />` : `<i style="${c.color ? `background:${esc(c.color)}` : ''}"></i>`) : '<i></i>'}
            <span><b>${c ? esc(c.name) : 'No one in particular'}</b><small>A deck stays with the customer it was made for. To present it to someone else, make a copy for them.</small></span></div>
          <p><button type="button" class="secondary small" id="dsCopy">⧉ Make a copy…</button> <span class="muted small">for another customer, or your own version for this one</span></p>
          <div class="s-section-title">Share</div>
          <div class="ds-link"><input readonly value="${esc(link)}" aria-label="Deck link" /><button type="button" class="secondary small" id="dsLink">${ui.copied ? '✓ Copied' : 'Copy link'}</button></div>
          ${ro ? '<p class="s-hint">You can open and copy this deck; its owner (and the people they share the customer with) can change it.</p>' : `<div class="s-section-title">Delete</div><p><button type="button" class="link-btn danger" id="dsDelete">Delete this deck…</button> <span class="muted small">for every product; this can’t be undone</span></p>`}
          <p class="err">${esc(ui.error)}</p>
        </div>
        <div class="s-foot"><span class="spacer"></span>
          <button type="button" class="secondary" data-close>Close</button>
          ${ro ? '' : '<button type="submit" class="save" id="dsSave" disabled>Save name</button>'}
        </div>
      </form>`;
    const q = (s) => dlg.querySelector(s);
    q('#dsName').oninput = (e) => {
      ui.name = e.target.value;
      if (q('#dsSave')) q('#dsSave').disabled = !ui.name.trim() || ui.name.trim() === d.name;
    };
    q('#dsCopy').onclick = () => {
      dlg.close();
      opts.onCopy?.();
    };
    q('#dsLink').onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        q('.ds-link input').select();
      }
      ui.copied = true;
      draw();
    };
    q('#dsDelete')?.addEventListener('click', async () => {
      const typed = prompt(`Delete “${d.name}” for every product? Its link stops working and this can’t be undone.\n\nType the deck name to confirm:`);
      if (typed == null) return;
      if (typed.trim() !== d.name.trim()) {
        ui.error = 'The name didn’t match, so nothing was deleted.';
        return draw();
      }
      try {
        await call(`/api/layouts/${d.id}`, 'DELETE');
        dlg.close();
        opts.onDeleted?.();
      } catch (err) {
        ui.error = err.message;
        draw();
      }
    });
    q('form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const saved = await call(`/api/layouts/${d.id}`, 'PUT', { name: ui.name.trim() });
        dlg.close();
        opts.onRenamed?.(saved);
      } catch (err) {
        ui.error = err.message;
        draw();
      }
    };
  };
  draw();
  dlg.showModal();
}
