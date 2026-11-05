// Shared by the top bar (workspace.js) and the deck library (decks.js): the
// products, deck links, and the "New deck" and "Account" dialogs.
//
// Two ideas only:
//   Account: who you present to (a customer, an opportunity, an event).
//            Name, color, logo, details, and its team.
//   Deck:    your presentation across the whole suite (Vellox, LayerOne,
//            Reverser, Ranger, Navigator), optionally for one account. For each
//            product: which slides, their order, titles and the talk track.
// You open a deck once; its account's logo and name are on every product page.

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

// ---------- New deck ----------
// opts: { accounts, account (preselected id), from (a deck to copy, optional), onCreated(deck) }
export function newDeckDialog(opts) {
  const dlg = dialog('nd');
  const ui = { account: opts.account ?? opts.from?.customer ?? '', start: opts.from ? 'copy' : 'official', name: '', named: false, newName: '', newColor: '#2563eb', error: '' };
  const accounts = [...(opts.accounts || [])].sort((a, b) => a.name.localeCompare(b.name));
  const acctName = (id) => accounts.find((a) => a.id === id)?.name || '';
  const suggest = () => (ui.account === 'new' ? ui.newName.trim() : acctName(ui.account)) || 'My deck';
  const draw = () => {
    if (!ui.named) ui.name = suggest();
    const copyable = Boolean(opts.from);
    dlg.innerHTML = `
      <form novalidate>
        <div class="s-head"><h2>New deck</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="s-body">
          <p class="s-hint">A deck is your presentation across the whole suite: Vellox, LayerOne, Reverser, Ranger and Navigator. Pick an account and its name, logo and color show on every product. Change any product’s slides later with <b>✎ Edit slides</b>.</p>
          <div class="grid2">
            <label class="full">Account <span class="muted">(who you’re presenting to)</span><select id="ndAccount">
              <option value="">No account (general deck)</option>
              ${accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === ui.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
              <option value="new" ${ui.account === 'new' ? 'selected' : ''}>＋ New account…</option>
            </select></label>
            ${
              ui.account === 'new'
                ? `<label>New account name<input id="ndNewName" maxlength="80" value="${esc(ui.newName)}" placeholder="e.g. Department of Example" /></label>
                   <label>Brand color <span class="muted">(an accent)</span><span class="color-row"><input type="color" id="ndNewColor" value="${esc(ui.newColor)}" /><code>${esc(ui.newColor)}</code></span></label>`
                : ''
            }
            <label class="full">Deck name<input id="ndName" maxlength="60" value="${esc(ui.name)}" /></label>
          </div>
          <div class="s-section-title">Start from</div>
          <div class="nd-start">
            <label class="check"><input type="radio" name="ndStart" value="official" ${ui.start === 'official' ? 'checked' : ''} /> The official slides, for every product</label>
            ${copyable ? `<label class="check"><input type="radio" name="ndStart" value="copy" ${ui.start === 'copy' ? 'checked' : ''} /> A copy of “${esc(opts.from.name)}”</label>` : ''}
          </div>
          <p class="err">${esc(ui.error)}</p>
        </div>
        <div class="s-foot"><span class="spacer"></span>
          <button type="button" class="secondary" data-close>Cancel</button>
          <button type="submit" class="save">Create deck</button>
        </div>
      </form>`;
    const q = (s) => dlg.querySelector(s);
    q('#ndAccount').onchange = (e) => {
      ui.account = e.target.value;
      draw();
      q('#ndNewName')?.focus();
    };
    q('#ndNewName')?.addEventListener('input', (e) => {
      ui.newName = e.target.value;
      if (!ui.named) q('#ndName').value = ui.name = suggest();
    });
    q('#ndNewColor')?.addEventListener('input', (e) => ((ui.newColor = e.target.value), (e.target.nextElementSibling.textContent = e.target.value)));
    q('#ndName').oninput = (e) => ((ui.name = e.target.value), (ui.named = true));
    dlg.querySelectorAll('[name="ndStart"]').forEach((r) => (r.onchange = () => (ui.start = r.value)));
    q('form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        if (!ui.name.trim()) throw new Error('Name the deck');
        let account = ui.account;
        if (account === 'new') {
          if (!ui.newName.trim()) throw new Error('Enter the account name');
          account = (await call('/api/profiles', 'POST', { name: ui.newName.trim(), color: ui.newColor })).id;
        }
        const deck =
          ui.start === 'copy'
            ? await call(`/api/layouts/${opts.from.id}/copy`, 'POST', { name: ui.name.trim(), customer: account || null })
            : await call('/api/layouts', 'POST', { name: ui.name.trim(), customer: account || null, products: {} });
        dlg.close();
        opts.onCreated?.(deck);
      } catch (err) {
        ui.error = err.message;
        draw();
      }
    };
  };
  draw();
  dlg.showModal();
  dlg.querySelector('#ndAccount').focus();
}

// ---------- Account ----------
// opts: { account (summary or null for a new one), people, me, onSaved(account), onDeleted() }
export async function accountDialog(opts) {
  const dlg = dialog('acct');
  const full = opts.account ? await call(`/api/profiles/${opts.account.id}`) : { name: '', color: '#2563eb', team: [], canEdit: true };
  const ui = { a: { ...full, team: [...(full.team || [])], pitch: { ...(full.pitch || {}) } }, useColor: Boolean(full.color) || !opts.account, error: '' };
  const ro = full.canEdit === false;
  const owner = full.owner || (opts.account ? 'tyler' : opts.me.id);
  const nameOf = (id) => opts.people.find((p) => p.id === id)?.name || id;
  const draw = () => {
    const teamable = opts.people.filter((p) => p.id !== owner);
    dlg.innerHTML = `
      <form novalidate>
        <div class="s-head"><h2>${opts.account ? esc(full.name) : 'New account'}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="s-body">
          <p class="s-hint">An account is who you present to: a customer, an opportunity or an event. Its decks show its name and color. The owner and the account team can change the account and all of its decks.</p>
          ${ro ? `<p class="s-locked">Owned by <b>${esc(nameOf(owner))}</b>. Ask them (or an admin) to add you to the team to make changes.</p>` : ''}
          <fieldset ${ro ? 'disabled' : ''} class="tl-fields">
            <div class="grid2">
              <label class="full">Account name<input id="acName" maxlength="80" value="${esc(ui.a.name)}" placeholder="e.g. Department of Example" /></label>
              <label>Brand color <span class="muted">(an accent)</span><span class="color-row"><input type="color" id="acColor" value="${esc(ui.a.color || '#2563eb')}" /><code>${esc(ui.useColor ? ui.a.color || '#2563eb' : 'none')}</code></span></label>
              <label class="check"><input type="checkbox" id="acUseColor" ${ui.useColor ? 'checked' : ''} /> Use the brand color</label>
              <label class="full">Logo <span class="muted">(on the title slide of every product; PNG, JPEG, SVG or WebP under 150 KB)</span>
                <span class="logo-row">${ui.a.pitch.logo ? `<img src="${esc(ui.a.pitch.logo)}" alt="" />` : ''}<input type="file" id="acLogoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp" />${ui.a.pitch.logo ? '<button type="button" class="link-btn" id="acLogoClear">Remove</button>' : ''}</span>
                <input id="acLogo" value="${esc(ui.a.pitch.logo?.startsWith('data:') ? '' : ui.a.pitch.logo || '')}" placeholder="…or an https:// image URL" /></label>
              <label class="check full"><input type="checkbox" id="acPrepared" ${ui.a.pitch.hidePrepared ? '' : 'checked'} /> Show “Prepared for ${esc(ui.a.name || 'the account')}” on title slides</label>
            </div>
            <div class="s-section-title">Account team <span class="dim-note">owner: ${esc(nameOf(owner))}</span></div>
            <div class="ac-team">${teamable.map((p) => `<label class="check"><input type="checkbox" data-team="${esc(p.id)}" ${ui.a.team.includes(p.id) ? 'checked' : ''} /> ${esc(p.name)} <span class="ac-role">${p.role === 'ae' ? 'AE' : 'SE'}</span></label>`).join('')}</div>
          </fieldset>
          ${opts.account ? '<p class="s-hint">Product details (their environment, tools and next steps) are on each product page: open one of the account’s decks and use <b>✎ Account</b> there.</p>' : ''}
          <p class="err">${esc(ui.error)}</p>
        </div>
        <div class="s-foot">
          ${opts.account && !ro ? '<button type="button" class="link-btn danger" id="acDelete">Delete account</button>' : ''}
          <span class="spacer"></span>
          <button type="button" class="secondary" data-close>${ro ? 'Close' : 'Cancel'}</button>
          ${ro ? '' : `<button type="submit" class="save">${opts.account ? 'Save' : 'Create account'}</button>`}
        </div>
      </form>`;
    const q = (s) => dlg.querySelector(s);
    q('#acColor').oninput = (e) => {
      ui.a.color = e.target.value;
      ui.useColor = true;
      q('#acUseColor').checked = true;
      e.target.nextElementSibling.textContent = e.target.value;
    };
    // Keep what's typed when the form redraws (a logo upload redraws it).
    const keep = () => {
      ui.a.name = q('#acName').value;
      ui.useColor = q('#acUseColor').checked;
      ui.a.team = [...dlg.querySelectorAll('[data-team]:checked')].map((x) => x.dataset.team);
      ui.a.pitch.hidePrepared = !q('#acPrepared').checked;
      const url = q('#acLogo').value.trim();
      if (url) ui.a.pitch.logo = url;
      else if (!ui.a.pitch.logo?.startsWith('data:')) delete ui.a.pitch.logo;
    };
    q('#acLogoFile')?.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      keep();
      if (f.size > 150 * 1024) {
        ui.error = 'That image is over 150 KB; use a smaller file or an https:// URL.';
        return draw();
      }
      const r = new FileReader();
      r.onload = () => {
        ui.a.pitch.logo = r.result;
        ui.error = '';
        draw();
      };
      r.readAsDataURL(f);
    });
    q('#acLogoClear')?.addEventListener('click', () => {
      keep();
      delete ui.a.pitch.logo;
      draw();
    });
    q('#acDelete')?.addEventListener('click', async () => {
      if (!confirm(`Delete the account “${full.name}”? Its decks stay, as general decks.`)) return;
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
        if (!ui.a.name) throw new Error('Enter the account name');
        const body = { ...ui.a, color: ui.useColor ? ui.a.color || '#2563eb' : '' };
        const saved = opts.account ? await call(`/api/profiles/${full.id}`, 'PUT', body) : await call('/api/profiles', 'POST', body);
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
