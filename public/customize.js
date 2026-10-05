// "Customize for a customer": create, switch, edit, export and import customer
// profiles that white-label the sample apps (names, colors, logos, which apps).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MAX_LOGO_BYTES = 150 * 1024;

// The optional settings password (SETTINGS_PASSWORD) also protects profiles.
export function authHeaders() {
  let pw = '';
  try {
    pw = sessionStorage.getItem('l1-settings-pw') || '';
  } catch {}
  return pw ? { 'X-Settings-Password': pw } : {};
}

async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.errors ? Object.values(data.errors).join('; ') : data.error || res.statusText), { status: res.status, data });
  return data;
}

let dlg;

export async function openCustomize({ appId, onChange, hint }) {
  // Defaults for the form come from the un-customized apps.
  const [list, defaults] = await Promise.all([call('/api/profiles'), fetch('/api/apps?default=1').then((r) => r.json())]);
  const ui = { list, defaults: defaults.apps, selected: list.active || '', draft: null, appId, onChange, hint, error: '' };
  if (ui.selected) ui.draft = await call(`/api/profiles/${ui.selected}`);

  dlg?.remove();
  dlg = document.createElement('dialog');
  dlg.className = 'settings customize';
  document.body.append(dlg);
  draw(ui);
  dlg.showModal();
  dlg.addEventListener('close', () => dlg.remove());
}

const blankProfile = (defaults) => ({ name: '', show: defaults.map((a) => a.id), apps: {}, steps: {} });

function draw(ui) {
  const { list, defaults, draft } = ui;
  const locked = list.locked;
  const appsFields = draft
    ? defaults
        .map((a) => {
          const p = draft.apps?.[a.id] || {};
          const shown = draft.show?.includes(a.id);
          return `<details class="cust-app" ${a.id === ui.appId ? 'open' : ''}>
            <summary><label class="check" onclick="event.stopPropagation()"><input type="checkbox" data-show="${esc(a.id)}" ${shown ? 'checked' : ''} /> Show</label>
              <span class="app-icon">${a.icon}</span><b>${esc(p.org || a.org)}</b><small>${esc(a.sector)}</small></summary>
            <div class="grid2">
              <label>Organization<input data-app="${a.id}" data-k="org" value="${esc(p.org || '')}" placeholder="${esc(a.org)}" /></label>
              <label>Product name<input data-app="${a.id}" data-k="product" value="${esc(p.product || '')}" placeholder="${esc(a.product)}" /></label>
              <label>Employee name<input data-app="${a.id}" data-k="personName" value="${esc(p.personName || '')}" placeholder="${esc(a.person.name)}" /></label>
              <label>Employee role<input data-app="${a.id}" data-k="personRole" value="${esc(p.personRole || '')}" placeholder="${esc(a.person.role)}" /></label>
              <label>Brand color<span class="color-row"><input type="color" data-app="${a.id}" data-k="color" value="${esc(p.color || a.brand.color)}" /><code>${esc(p.color || a.brand.color)}</code></span></label>
              <label>Logo<span class="logo-row">${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : ''}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-logo="${a.id}" />${p.logo ? `<button type="button" class="link-btn" data-clearlogo="${a.id}">Remove</button>` : ''}</span>
                <input data-app="${a.id}" data-k="logo" value="${esc(p.logo?.startsWith('data:') ? '' : p.logo || '')}" placeholder="…or an https:// image URL" /></label>
            </div>
          </details>`;
        })
        .join('')
    : '';

  dlg.innerHTML = `
    <form id="custForm" novalidate>
      <div class="s-head"><h2>Customize for a customer</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="s-body">
        ${ui.hint ? `<p class="s-locked">${esc(ui.hint)}</p>` : ''}
        ${locked ? '<p class="s-locked">Customization is locked on this server (ALLOW_UI_SETTINGS=false).</p>' : ''}
        <p class="s-hint">A customer profile renames and rebrands the sample apps for one customer: organization, product, employee, color and logo. You can also rewrite any step with <b>✏️ Edit step</b>. Profiles are saved on the server, so you can prepare one before the meeting and switch in a click.</p>
        <div class="profile-row">
          <label>Profile<select id="profilePick">
            <option value="">Default demo (no customization)</option>
            ${list.profiles.map((p) => `<option value="${esc(p.id)}" ${p.id === ui.selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            ${ui.selected === 'new' ? '<option value="new" selected>New profile…</option>' : ''}
          </select></label>
          <div class="profile-actions">
            <button type="button" class="secondary small" id="newProfile" ${locked ? 'disabled' : ''}>＋ New</button>
            <button type="button" class="secondary small" id="importProfile" ${locked ? 'disabled' : ''}>Import…</button>
            ${draft?.id ? `<button type="button" class="secondary small" id="exportProfile">Export</button><button type="button" class="link-btn danger" id="deleteProfile" ${locked ? 'disabled' : ''}>Delete</button>` : ''}
            <input type="file" id="importFile" accept="application/json" hidden />
          </div>
        </div>
        ${
          draft
            ? `<div class="grid2"><label class="full">Customer name <span class="muted">(shown as "Prepared for …")</span><input id="custName" value="${esc(draft.name || '')}" placeholder="e.g. Acme Federal" /></label></div>
               ${list.passwordRequired ? '<div class="grid2"><label class="full">Settings password<input type="password" id="custPw" autocomplete="current-password" placeholder="Required to save on this deployment" /></label></div>' : ''}
               <div class="s-section-title">Sample apps <span class="dim-note">tick the ones to show; leave fields blank to keep the defaults</span></div>
               ${appsFields}
               ${Object.keys(draft.steps || {}).length ? `<p class="muted">${Object.keys(draft.steps).length} step(s) edited for this customer.</p>` : ''}`
            : '<p class="muted">The default demo shows all four sample apps with their fictional names.</p>'
        }
        <p class="err">${esc(ui.error)}</p>
      </div>
      <div class="s-foot"><span class="spacer"></span>
        <button type="button" class="secondary" data-close>Cancel</button>
        <button type="submit" class="save" ${locked ? 'disabled' : ''}>${draft ? 'Save and use this profile' : 'Use the default demo'}</button>
      </div>
    </form>`;
  wire(ui);
}

// Copy the form into the draft profile.
function collect(ui) {
  const d = ui.draft;
  if (!d) return;
  d.name = dlg.querySelector('#custName')?.value || '';
  d.show = ui.defaults.map((a) => a.id).filter((id) => dlg.querySelector(`[data-show="${id}"]`)?.checked);
  d.apps ||= {};
  dlg.querySelectorAll('[data-app][data-k]').forEach((el) => {
    const a = (d.apps[el.dataset.app] ||= {});
    const v = el.value.trim();
    const def = ui.defaults.find((x) => x.id === el.dataset.app);
    if (el.dataset.k === 'color') a.color = v.toLowerCase() === def.brand.color.toLowerCase() ? '' : v;
    else if (el.dataset.k === 'logo') {
      if (v) a.logo = v;
      else if (!a.logo?.startsWith('data:')) a.logo = '';
    } else a[el.dataset.k] = v;
  });
  const pw = dlg.querySelector('#custPw')?.value;
  if (pw) {
    try {
      sessionStorage.setItem('l1-settings-pw', pw);
    } catch {}
  }
}

function wire(ui) {
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  dlg.querySelector('#profilePick').onchange = async (e) => {
    collect(ui);
    ui.selected = e.target.value;
    ui.error = '';
    ui.draft = ui.selected && ui.selected !== 'new' ? await call(`/api/profiles/${ui.selected}`) : null;
    draw(ui);
  };
  dlg.querySelector('#newProfile').onclick = () => {
    ui.selected = 'new';
    ui.draft = blankProfile(ui.defaults);
    ui.error = '';
    draw(ui);
  };
  dlg.querySelectorAll('[data-app][data-k="color"]').forEach((el) => (el.oninput = () => (el.nextElementSibling.textContent = el.value)));
  dlg.querySelectorAll('[data-logo]').forEach((input) => {
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_LOGO_BYTES) {
        ui.error = `That logo is ${Math.round(file.size / 1024)} KB; use one under 150 KB, or paste an https image URL.`;
        collect(ui);
        draw(ui);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        collect(ui);
        (ui.draft.apps[input.dataset.logo] ||= {}).logo = reader.result;
        draw(ui);
      };
      reader.readAsDataURL(file);
    };
  });
  dlg.querySelectorAll('[data-clearlogo]').forEach((b) => {
    b.onclick = () => {
      collect(ui);
      ui.draft.apps[b.dataset.clearlogo].logo = '';
      draw(ui);
    };
  });
  dlg.querySelector('#exportProfile')?.addEventListener('click', () => {
    collect(ui);
    const { id, updatedAt, ...profile } = ui.draft;
    const blob = new Blob([JSON.stringify({ layeroneDemoProfile: 1, ...profile }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${(profile.name || 'profile').replace(/[^\w-]+/g, '-').toLowerCase()}.layerone-profile.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  dlg.querySelector('#importProfile')?.addEventListener('click', () => dlg.querySelector('#importFile').click());
  dlg.querySelector('#importFile').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      delete data.id;
      delete data.layeroneDemoProfile;
      ui.draft = { ...blankProfile(ui.defaults), ...data };
      ui.selected = 'new';
      ui.error = '';
    } catch {
      ui.error = 'That file is not a LayerOne demo profile.';
    }
    draw(ui);
  };
  dlg.querySelector('#deleteProfile')?.addEventListener('click', async () => {
    if (!confirm(`Delete the profile "${ui.draft.name}"?`)) return;
    try {
      collect(ui);
      await call(`/api/profiles/${ui.draft.id}`, 'DELETE');
      dlg.close();
      await ui.onChange();
    } catch (err) {
      ui.error = err.message;
      draw(ui);
    }
  });
  dlg.querySelector('#custForm').onsubmit = async (e) => {
    e.preventDefault();
    collect(ui);
    try {
      let id = null;
      if (ui.draft) {
        const saved = ui.draft.id ? await call(`/api/profiles/${ui.draft.id}`, 'PUT', ui.draft) : await call('/api/profiles', 'POST', ui.draft);
        id = saved.id;
      }
      await call('/api/profiles/active', 'PUT', { id });
      dlg.close();
      await ui.onChange();
    } catch (err) {
      ui.error = err.status === 401 ? 'Enter the settings password to save.' : err.message;
      draw(ui);
    }
  };
}
