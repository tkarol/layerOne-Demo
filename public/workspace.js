// SE workspaces, in the browser. Loaded first (a classic script) on the Vellox
// pages so it can:
//  1. add the signed-in presenter (X-Presenter-Token) and the customer this
//     browser is presenting to (X-Customer) to every /api/ request;
//  2. show "Who's presenting?" until someone signs in with their PIN;
//  3. add the presenter and customer pickers to the top bar.
// The customer choice is kept per presenter in this browser, so nobody else's
// choice ever changes what you see.
(() => {
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {}
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let token = read('ws-token') || '';
  let me = null;
  try {
    me = JSON.parse(read('ws-me') || 'null');
  } catch {}
  const custKey = () => `ws-customer:${me?.id}`;
  let customer = me ? read(custKey()) || '' : '';

  // 1. Every /api/ call carries who's presenting and to whom.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
        const h = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers));
        if (token) h.set('X-Presenter-Token', token);
        if (me) h.set('X-Customer', customer || 'none');
        init = { ...init, headers: h };
      }
    } catch {}
    return nativeFetch(input, init);
  };

  const api = async (path, method = 'GET', body) => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
    return data;
  };

  const state = { presenters: [], setupPasswordRequired: false, customers: [] };
  const nameOf = (id) => state.presenters.find((p) => p.id === id)?.name || id;

  // Shared with the page scripts (tailor.js, customize.js).
  window.ws = {
    get signedIn() {
      return Boolean(me);
    },
    get me() {
      return me;
    },
    get customer() {
      return customer;
    },
    presenterName: nameOf,
    setCustomer(id) {
      customer = id || '';
      write(custKey(), customer);
      location.reload();
    },
  };

  // 2. "Who's presenting?"
  let gate;
  function showGate(step = { who: null, error: '' }) {
    gate?.remove();
    gate = document.createElement('div');
    gate.className = 'ws-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    const p = step.who && state.presenters.find((x) => x.id === step.who);
    gate.innerHTML = `
      <div class="ws-gate-card">
        <div class="ws-gate-brand"><b>Booz Allen</b><span>Vellox demos</span></div>
        ${
          !p
            ? `<h2>Who’s presenting?</h2>
               <div class="ws-people">${state.presenters
                 .map((x) => `<button type="button" data-who="${esc(x.id)}"><span class="ws-av big">${esc(x.name[0])}</span><b>${esc(x.name)}</b>${x.admin ? '<small>Admin</small>' : ''}${x.hasPin ? '' : '<em>New: choose a PIN</em>'}</button>`)
                 .join('')}</div>
               <p class="ws-gate-note">Your customers, slides and settings stay yours. Other SEs can use your customers, but only you can change them.</p>`
            : `<form class="ws-pin">
                 <button type="button" class="ws-back" data-back>← Not ${esc(p.name)}?</button>
                 <span class="ws-av big">${esc(p.name[0])}</span>
                 <h2>${p.hasPin ? `Hi ${esc(p.name)}` : `Welcome, ${esc(p.name)}`}</h2>
                 <p class="muted">${p.hasPin ? 'Enter your PIN.' : 'Choose a PIN (4 to 8 digits). You’ll use it to sign in from now on.'}</p>
                 <input id="wsPin" type="password" inputmode="numeric" autocomplete="${p.hasPin ? 'current-password' : 'new-password'}" maxlength="8" placeholder="PIN" />
                 ${p.hasPin ? '' : '<input id="wsPin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="Type it again" />'}
                 ${!p.hasPin && state.setupPasswordRequired ? '<input id="wsSetup" type="password" autocomplete="off" placeholder="Team setup password" />' : ''}
                 <p class="ws-err">${esc(step.error)}</p>
                 <button type="submit" class="ws-go">${p.hasPin ? 'Sign in' : 'Set PIN and sign in'}</button>
               </form>`
        }
      </div>`;
    document.body.append(gate);
    gate.querySelectorAll('[data-who]').forEach((b) => (b.onclick = () => showGate({ who: b.dataset.who, error: '' })));
    gate.querySelector('[data-back]')?.addEventListener('click', () => showGate());
    const form = gate.querySelector('form');
    if (form) {
      gate.querySelector('#wsPin').focus();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const pin = gate.querySelector('#wsPin').value.trim();
        const again = gate.querySelector('#wsPin2');
        if (again && again.value.trim() !== pin) return showGate({ who: p.id, error: 'The two PINs don’t match' });
        try {
          const out = await api('/api/presenters/login', 'POST', { id: p.id, pin, setupPassword: gate.querySelector('#wsSetup')?.value || '' });
          token = out.token;
          me = out.me;
          write('ws-token', token);
          write('ws-me', JSON.stringify({ id: me.id, name: me.name, admin: me.admin }));
          location.reload();
        } catch (err) {
          showGate({ who: p.id, error: err.message });
        }
      };
    }
  }

  // 3. The top bar: "Presenting to ▾" and "Tyler ▾".
  let menu;
  const closeMenu = () => {
    menu?.remove();
    menu = null;
  };
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target) && !e.target.closest('.ws-bar') && !e.target.closest('.product-switch a.on')) closeMenu();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

  function openMenu(anchor, html, wire) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'ws-menu';
    menu.innerHTML = html;
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 6 + window.scrollY}px`;
    menu.style.left = `${Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8))}px`;
    wire(menu);
  }

  function customerMenu(anchor) {
    const row = (c) => {
      const owner = c.owner || 'tyler';
      const tag = owner === me.id ? 'Yours' : `${esc(nameOf(owner))}’s`;
      return `<button type="button" class="ws-item ${c.id === customer ? 'on' : ''}" data-cust="${esc(c.id)}"><i class="ws-dot" style="background:${esc(c.color || '#a1a1aa')}"></i><span>${esc(c.name)}</span><small>${tag}</small></button>`;
    };
    const mine = state.customers.filter((c) => (c.owner || 'tyler') === me.id);
    const others = state.customers.filter((c) => (c.owner || 'tyler') !== me.id);
    openMenu(
      anchor,
      `<div class="ws-menu-h">Presenting to</div>
       <button type="button" class="ws-item ${customer ? '' : 'on'}" data-cust=""><i class="ws-dot std"></i><span>Standard (no customer)</span></button>
       ${mine.length ? `<div class="ws-menu-sub">Your customers</div>${mine.map(row).join('')}` : ''}
       ${others.length ? `<div class="ws-menu-sub">Other SEs’ customers <span>use as-is, or copy to edit</span></div>${others.map(row).join('')}` : ''}
       <div class="ws-menu-f"><button type="button" class="ws-link" data-manage>${customer ? 'Edit or copy this customer…' : '＋ New customer…'}</button></div>`,
      (m) => {
        m.querySelectorAll('[data-cust]').forEach((b) => (b.onclick = () => window.ws.setCustomer(b.dataset.cust)));
        m.querySelector('[data-manage]').onclick = () => {
          closeMenu();
          (document.querySelector('#tailorBtn') || document.querySelector('#customizeBtn'))?.click();
        };
      },
    );
  }

  function meMenu(anchor, note = '') {
    const others = state.presenters.filter((p) => p.id !== me.id);
    openMenu(
      anchor,
      `<div class="ws-menu-h">${esc(me.name)}${me.admin ? ' · Admin' : ''}</div>
       <form class="ws-chpin"><div class="ws-menu-sub">Change your PIN</div>
         <input type="password" inputmode="numeric" maxlength="8" placeholder="Current PIN" data-old />
         <input type="password" inputmode="numeric" maxlength="8" placeholder="New PIN (4–8 digits)" data-new />
         <button type="submit" class="ws-small">Change PIN</button></form>
       ${me.admin ? `<div class="ws-menu-sub">Reset someone’s PIN <span>they choose a new one at next sign-in</span></div>${others.map((p) => `<div class="ws-reset"><span>${esc(p.name)}</span><button type="button" class="ws-small" data-reset="${esc(p.id)}">Reset</button></div>`).join('')}` : ''}
       ${note ? `<p class="ws-note">${esc(note)}</p>` : ''}
       <div class="ws-menu-f"><button type="button" class="ws-link" data-signout>Sign out</button></div>`,
      (m) => {
        m.querySelector('form').onsubmit = async (e) => {
          e.preventDefault();
          try {
            await api('/api/presenters/me/pin', 'PUT', { pin: m.querySelector('[data-old]').value, newPin: m.querySelector('[data-new]').value });
            meMenu(anchor, 'PIN changed.');
          } catch (err) {
            meMenu(anchor, err.message);
          }
        };
        m.querySelectorAll('[data-reset]').forEach(
          (b) =>
            (b.onclick = async () => {
              if (!confirm(`Reset ${nameOf(b.dataset.reset)}’s PIN? They’ll be signed out and choose a new PIN next time.`)) return;
              try {
                await api(`/api/presenters/${b.dataset.reset}/reset`, 'POST');
                meMenu(anchor, `${nameOf(b.dataset.reset)}’s PIN was reset.`);
              } catch (err) {
                meMenu(anchor, err.message);
              }
            }),
        );
        m.querySelector('[data-signout]').onclick = async () => {
          await api('/api/presenters/logout', 'POST').catch(() => {});
          signOut();
        };
      },
    );
  }

  function signOut() {
    write('ws-token', null);
    write('ws-me', null);
    token = '';
    me = null;
    location.reload();
  }

  function drawBar() {
    const host = document.querySelector('.topbar .top-right');
    if (!host) return;
    const cur = state.customers.find((c) => c.id === customer);
    if (customer && !cur) {
      // The customer was deleted: back to the standard version.
      customer = '';
      write(custKey(), '');
    }
    if (cur?.color) document.documentElement.style.setProperty('--cust', cur.color);
    document.querySelector('.ws-bar')?.remove();
    const bar = document.createElement('div');
    bar.className = 'ws-bar';
    bar.innerHTML = `
      <button type="button" class="ws-cust" title="Who you’re presenting to (only in this browser)"><i class="ws-dot ${cur ? '' : 'std'}" style="${cur?.color ? `background:${esc(cur.color)}` : ''}"></i><span class="ws-lbl">Presenting to</span><b>${esc(cur?.name || 'Standard')}</b><span class="ws-caret">▾</span></button>
      <button type="button" class="ws-me" title="Signed in as ${esc(me.name)}"><span class="ws-av">${esc(me.name[0])}</span><span class="ws-me-n">${esc(me.name)}</span><span class="ws-caret">▾</span></button>`;
    host.prepend(bar);
    bar.querySelector('.ws-cust').onclick = (e) => (menu ? closeMenu() : customerMenu(e.currentTarget));
    bar.querySelector('.ws-me').onclick = (e) => (menu ? closeMenu() : meMenu(e.currentTarget));
  }

  // On narrower screens the product switch collapses to the current product + a menu.
  const narrow = matchMedia('(max-width: 1400px)');
  document.addEventListener('click', (e) => {
    const cur = e.target.closest('.product-switch a.on');
    if (!cur || !narrow.matches) return;
    e.preventDefault();
    if (menu) return closeMenu();
    const links = [...document.querySelectorAll('.product-switch a')];
    openMenu(
      cur,
      `<div class="ws-menu-h">Products</div>${links.map((a) => `<a class="ws-item ${a.classList.contains('on') ? 'on' : ''}" href="${esc(a.getAttribute('href'))}"><span>${esc(a.textContent)}</span></a>`).join('')}`,
      () => {},
    );
  });

  async function start() {
    try {
      const [list, mine] = await Promise.all([api('/api/presenters'), token ? api('/api/presenters/me') : { me: null }]);
      state.presenters = list.presenters;
      state.setupPasswordRequired = list.setupPasswordRequired;
      if (!mine.me) {
        if (me || token) {
          write('ws-token', null);
          write('ws-me', null);
          token = '';
          me = null;
        }
        return showGate();
      }
      me = mine.me;
      write('ws-me', JSON.stringify({ id: me.id, name: me.name, admin: me.admin }));
      state.customers = (await api('/api/profiles')).profiles || [];
      drawBar();
    } catch {
      // The page still works signed out if the server can't be reached.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
