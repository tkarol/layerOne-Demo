// Workspaces, in the browser. Loaded first (a classic script) on every Vellox
// page and the deck library, so it can:
//  1. add who's signed in (X-Presenter-Token) and the open deck's account
//     (X-Customer) to every /api/ request;
//  2. show "Who's presenting?": find your name, enter your PIN (or look around
//     as a guest);
//  3. add the top bar: ⌂ Decks (the library), the deck picker for this page,
//     and your name menu.
//
// One rule: you open a deck. A deck covers the whole suite (Vellox, LayerOne,
// Reverser, Ranger, Navigator) and can be for an account (a customer, an
// opportunity, an event); that account's name, logo and color are on every
// product page. Nothing switches on by itself. The open deck is remembered per
// person, in this browser, so it follows you from product to product.
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
  const isGuest = () => Boolean(me?.guest);
  const isAe = () => me?.role === 'ae';
  const signedIn = () => Boolean(me && !me.guest);
  const markRoles = () => {
    document.documentElement.classList.toggle('ws-guest', isGuest());
    document.documentElement.classList.toggle('ws-ae', isAe());
    document.documentElement.classList.toggle('ws-in', signedIn());
  };
  markRoles();

  // Which product deck lives on this page (null on the library).
  const PAGE = (() => {
    const f = location.pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
    return { '': 'layerone', index: 'layerone', vellox: 'vellox', reverser: 'reverser', ranger: 'ranger', navigator: 'navigator' }[f] ?? null;
  })();
  const LABELS = { vellox: 'Vellox', layerone: 'LayerOne', reverser: 'Reverser', ranger: 'Ranger', navigator: 'Navigator' };

  // The open deck, for every product page: { id ('' = official), customer, name }.
  const openKey = () => `ws-open:${me?.id}`;
  let open = { id: '', customer: '', name: '' };
  // The leave-behind PDF page loads product pages with ?print=1&deck=…: show that deck,
  // but don't change the deck you have open, and leave the URL alone.
  const PRINTING = new URLSearchParams(location.search).has('print');
  if (PRINTING) {
    const qs = new URLSearchParams(location.search);
    const id = qs.get('deck') === 'official' ? '' : qs.get('deck') || '';
    if (signedIn()) open = { id, customer: id ? qs.get('acct') || '' : '', color: qs.get('color') || '', name: '' };
  } else if (signedIn()) {
    try {
      open = { ...open, ...JSON.parse(read(openKey()) || '{}') };
    } catch {}
    // A deck link (/d/<id>, or ?deck=…&acct=… from the library) opens that deck here.
    const qs = new URLSearchParams(location.search);
    if (qs.has('deck')) {
      const id = qs.get('deck') === 'official' ? '' : qs.get('deck');
      open = { id, customer: id ? qs.get('acct') || '' : '', name: '' };
      write(openKey(), JSON.stringify(open));
      if (qs.get('edit')) {
        try {
          sessionStorage.setItem('ws-edit-now', id);
        } catch {}
      }
      ['deck', 'acct', 'edit'].forEach((k) => qs.delete(k));
      history.replaceState(null, '', `${location.pathname}${qs.toString() ? `?${qs}` : ''}${location.hash}`);
    }
  }
  const customer = signedIn() && open.id ? open.customer || '' : '';

  // Brand color: Booz Allen's by default (styles.css); on a product page with a deck for a
  // customer, the customer's color, in two shades that stay readable: a bright one for the
  // dark slides and diagrams, and a deeper one for text on light pages.
  function brandShades(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const lum = (c) => c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const mix = (c, to, w) => c.map((v, i) => Math.round(v + (to[i] - v) * w));
    let bright = rgb;
    for (let w = 0.05; contrast(bright, [11, 11, 13]) < 4.5 && w <= 1; w += 0.05) bright = mix(rgb, [255, 255, 255], w);
    let ink = rgb;
    for (let w = 0.05; contrast(ink, [255, 255, 255]) < 4.5 && w <= 1; w += 0.05) ink = mix(rgb, [0, 0, 0], w);
    return { bright: bright.join(' '), ink: `rgb(${ink.join(' ')})` };
  }
  function applyBrand(hex) {
    const st = document.documentElement.style;
    const b = PAGE ? brandShades(hex) : null;
    if (b) {
      st.setProperty('--brand-rgb', b.bright);
      st.setProperty('--brand-ink', b.ink);
      st.setProperty('--cust', hex);
    } else {
      ['--brand-rgb', '--brand-ink', '--cust'].forEach((k) => st.removeProperty(k));
    }
  }
  applyBrand(customer ? open.color : '');

  // 1. Every /api/ call carries who's signed in and which account the page is for.
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

  const state = { presenters: [], former: [], setupPasswordRequired: false, customers: [], deck: null, open: null };
  const nameOf = (id) => [...state.presenters, ...state.former].find((p) => p.id === id)?.name || id;
  const account = (id) => state.customers.find((c) => c.id === id);
  const ui = () => import('./decks-ui.js');

  function openDeck(d) {
    if (!signedIn() || PRINTING) return;
    const next = { id: d.id || '', customer: d.id ? d.customer || '' : '', name: d.id ? d.name || '' : '' };
    next.color = next.customer ? account(next.customer)?.color || '' : '';
    applyBrand(next.color);
    write(openKey(), JSON.stringify(next));
    open = next;
    state.open = d.id ? d : null;
    // A different account rebrands a product page (and the sample apps): reload.
    if (PAGE && next.customer !== customer) return location.reload();
    if (state.deck) return state.deck.reload().then(() => drawBar());
    drawBar();
  }

  async function openEditor(layout) {
    const d = state.deck;
    if (!d) return;
    closeMenu();
    const { openLayoutEditor } = await import('./layouts.js');
    openLayoutEditor({
      deck: d,
      layout,
      customers: state.customers,
      onSaved: (saved) => openDeck(saved),
      onDeleted: () => openDeck({ id: '' }),
    });
  }

  async function newDeck(from) {
    closeMenu();
    const { newDeckDialog } = await ui();
    newDeckDialog({
      product: PAGE,
      accounts: state.customers,
      nameOf,
      from,
      onCreated: async (deck) => {
        await refreshAccounts();
        if ((deck.customer || '') !== customer) {
          // Another account rebrands the page: reload, then open the editor.
          try {
            sessionStorage.setItem('ws-edit-now', deck.id);
          } catch {}
          return openDeck(deck);
        }
        await openDeck(deck);
        if (state.deck) openEditor(state.deck.layout);
      },
    });
  }

  // The open deck's customer: name, logo, color. Product pages have their own ✎ Customer
  // (with that product's details); elsewhere, the account dialog.
  async function editAccount() {
    closeMenu();
    const id = open.customer;
    const btn = document.querySelector('#tailorBtn:not([hidden])');
    if (btn && id === customer) return btn.click();
    if (!account(id)) return;
    const { accountDialog } = await ui();
    accountDialog({ account: account(id), people: state.presenters, me, onSaved: () => location.reload(), onDeleted: () => openDeck({ id: '' }) });
  }

  async function refreshAccounts() {
    if (signedIn()) state.customers = (await api('/api/profiles').catch(() => ({ profiles: [] }))).profiles || [];
    if (document.querySelector('.ws-bar')) drawBar();
  }

  // Shared with the page scripts (deck-core.js, tailor.js, customize.js, decks.js).
  window.ws = {
    get signedIn() {
      return signedIn();
    },
    get guest() {
      return isGuest();
    },
    get me() {
      return me;
    },
    // The account the page is for (the open deck's account), or ''.
    get customer() {
      return customer;
    },
    get accounts() {
      return state.customers;
    },
    get people() {
      return state.presenters;
    },
    page: PAGE,
    presenterName: nameOf,
    layoutId: () => (signedIn() ? open.id : ''),
    openDeck,
    newDeck,
    editDeck: () => state.deck?.layout && openEditor(state.deck.layout),
    refreshAccounts,
    // A deck on this page (deck-core.js) shows in the top bar.
    registerDeck(deck) {
      state.deck = deck;
      if (me && document.querySelector('.ws-bar')) drawBar();
      let pending = null;
      try {
        pending = sessionStorage.getItem('ws-edit-now');
        sessionStorage.removeItem('ws-edit-now');
      } catch {}
      if (pending && deck.layout?.id === pending && deck.layout.canEdit) setTimeout(() => openEditor(deck.layout), 80);
    },
  };

  // 2. "Who's presenting?": find your name, then your PIN.
  let gate;
  const recent = () => {
    try {
      return JSON.parse(read('ws-recent') || '[]');
    } catch {
      return [];
    }
  };
  function remember(id) {
    write('ws-recent', JSON.stringify([id, ...recent().filter((x) => x !== id)].slice(0, 4)));
  }
  const roleTag = (p) => `<span class="ws-role">${p.role === 'ae' ? 'AE' : 'SE'}</span>`;

  function showGate(step = { who: null, error: '', q: '' }) {
    gate?.remove();
    gate = document.createElement('div');
    gate.className = 'ws-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    const p = step.who && state.presenters.find((x) => x.id === step.who);
    const recentPeople = recent()
      .map((id) => state.presenters.find((x) => x.id === id))
      .filter(Boolean);
    const card = (x) => `<button type="button" data-who="${esc(x.id)}" data-name="${esc(x.name.toLowerCase())}"><span class="ws-av big">${esc(x.name[0])}</span><b>${esc(x.name)}</b>${roleTag(x)}${x.hasPin ? '' : '<em>New: choose a PIN</em>'}</button>`;
    const everyone = [...state.presenters].sort((a, b) => a.name.localeCompare(b.name));
    gate.innerHTML = `
      <div class="ws-gate-card">
        <div class="ws-gate-brand"><b>Booz Allen</b><span>Vellox demos</span></div>
        ${
          !p
            ? `<h2>Who’s presenting?</h2>
               <input class="ws-find" id="wsFind" type="search" placeholder="Find your name" autocomplete="off" value="${esc(step.q || '')}" aria-label="Find your name" />
               ${recentPeople.length ? `<div class="ws-gate-sub">On this device</div><div class="ws-people recent">${recentPeople.map(card).join('')}</div><div class="ws-gate-sub">Everyone</div>` : ''}
               <div class="ws-people all">${everyone.map(card).join('')}</div>
               <p class="ws-none" hidden>No one by that name. An admin can add you.</p>
               <p class="ws-gate-note">Sales engineers and account executives sign in with their own PIN. Your decks are yours; everyone can open and copy them.</p>
               <div class="ws-guest-opt"><span>Just looking?</span><button type="button" class="ws-link" data-guest>Continue as a guest →</button></div>
               ${step.error ? `<p class="ws-err">${esc(step.error)}</p>` : ''}`
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
    const find = gate.querySelector('#wsFind');
    if (find) {
      const filter = () => {
        const q = find.value.trim().toLowerCase();
        let shown = 0;
        gate.querySelectorAll('.ws-people.all [data-who]').forEach((b) => {
          const hit = !q || b.dataset.name.split(/\s+/).some((w) => w.startsWith(q)) || b.dataset.name.includes(q);
          b.hidden = !hit;
          shown += hit;
        });
        gate.querySelectorAll('.ws-people.recent, .ws-gate-sub').forEach((el) => (el.hidden = Boolean(q)));
        gate.querySelector('.ws-none').hidden = shown > 0;
        return shown;
      };
      find.oninput = filter;
      find.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault(); // don't let this Enter also submit the PIN form that replaces it
        const hits = [...gate.querySelectorAll('.ws-people.all [data-who]:not([hidden])')];
        if (hits.length === 1) showGate({ who: hits[0].dataset.who, error: '' });
      };
      filter();
      if (!matchMedia('(pointer: coarse)').matches) find.focus();
    }
    gate.querySelector('[data-guest]')?.addEventListener('click', async () => {
      try {
        const out = await api('/api/presenters/guest', 'POST');
        token = out.token;
        me = out.me;
        write('ws-token', token);
        write('ws-me', JSON.stringify({ id: me.id, name: me.name, guest: true }));
        location.reload();
      } catch (err) {
        showGate({ who: null, error: err.message });
      }
    });
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
          write('ws-me', JSON.stringify({ id: me.id, name: me.name, admin: me.admin, role: me.role }));
          remember(me.id);
          location.reload();
        } catch (err) {
          showGate({ who: p.id, error: err.message });
        }
      };
    }
  }

  // 3. The top bar.
  let menu;
  const closeMenu = () => {
    menu?.remove();
    menu = null;
  };
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target) && !e.target.closest('.ws-bar, .product-switch a.on')) closeMenu();
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

  // The deck picker: official, yours, your accounts', everyone else's; search; actions.
  // A deck covers every product, so this is the same list on every page.
  async function deckMenu(anchor, note = '') {
    const d = state.deck;
    let list = [];
    try {
      list = (await api('/api/layouts')).layouts;
    } catch {}
    const cur = open.id ? list.find((l) => l.id === open.id) || state.open : null;
    const row = (l) => {
      const a = account(l.customer);
      return `<button type="button" class="ws-item ${cur?.id === l.id ? 'on' : ''}" data-open="${esc(l.id)}" data-cust="${esc(l.customer || '')}" data-name="${esc(l.name)}" data-find="${esc(`${l.name} ${a?.name || ''} ${nameOf(l.owner)} ${(l.products || []).join(' ')}`.toLowerCase())}">
        <i class="ws-dot ${a ? '' : 'gen'}" style="${a?.color ? `background:${esc(a.color)}` : ''}"></i>
        <span>${esc(l.name)}${a ? ` <em>· ${esc(a.name)}</em>` : ''}</span><small>${l.mine ? 'Yours' : esc(nameOf(l.owner))}</small></button>`;
    };
    // "Your accounts' decks": decks for accounts you own or are on the team of.
    const onTeam = (l) => {
      const a = account(l.customer);
      return Boolean(a && ((a.owner || 'tyler') === me.id || a.team?.includes(me.id)));
    };
    const mine = list.filter((l) => l.mine);
    const team = list.filter((l) => !l.mine && onTeam(l));
    const others = list.filter((l) => !l.mine && !onTeam(l));
    openMenu(
      anchor,
      `${
         cur
           ? `<div class="ws-deck-acts">
                <div class="ws-acts-h">Presenting</div>
                <div class="ws-acts-name"><b>${esc(cur.name)}</b>${account(cur.customer) ? `<small>for ${esc(account(cur.customer).name)}</small>` : '<small>general deck</small>'}</div>
                ${d && cur.canEdit ? `<button type="button" class="ws-small primary-act" data-edit>✎ Edit the ${esc(LABELS[PAGE] || '')} slides</button>` : ''}
                ${d && !cur.canEdit ? '<p class="ws-note">You can present this deck. To change its slides, make your own copy (Deck settings).</p>' : ''}
                <div class="ws-acts-row">
                  <button type="button" class="ws-small" data-settings>⚙ Deck settings</button>
                  ${account(cur.customer) && cur.canEdit ? '<button type="button" class="ws-small" data-acct>Logo &amp; color</button>' : ''}
                  <button type="button" class="ws-small" data-link>🔗 Link</button>
                  <button type="button" class="ws-small" data-pdf title="A PDF of the slides to send after the meeting">⬇ PDF</button>
                </div>
              </div>`
           : `<div class="ws-deck-acts"><div class="ws-acts-h">Presenting</div><div class="ws-acts-name"><b>The official deck</b><small>Booz Allen’s slides, no customer</small></div><div class="ws-acts-row"><button type="button" class="ws-small" data-pdf>⬇ PDF</button></div></div>`
       }
       ${note ? `<p class="ws-note">${esc(note)}</p>` : ''}
       <div class="ws-menu-sub ws-switch">Switch to another deck</div>
       <input class="ws-search" type="search" placeholder="Search decks, customers or people" aria-label="Search decks" />
       <button type="button" class="ws-item ${cur ? '' : 'on'}" data-open="" data-find="official deck"><i class="ws-dot std"></i><span>Official deck</span><small>Booz Allen</small></button>
       ${mine.length ? `<div class="ws-menu-sub">Your decks</div>${mine.map(row).join('')}` : ''}
       ${team.length ? `<div class="ws-menu-sub">Shared with you <span>decks for customers you can edit</span></div>${team.map(row).join('')}` : ''}
       ${others.length ? `<div class="ws-menu-sub">Everyone else’s <span>${me.admin ? 'you can edit these as an admin' : 'open, or copy to change'}</span></div>${others.map(row).join('')}` : ''}
       <div class="ws-menu-f"><button type="button" class="ws-small" data-new>＋ New deck</button></div>
       <a class="ws-item ws-lib" href="/decks"><span>All decks</span><small>Library →</small></a>`,
      (m) => {
        const search = m.querySelector('.ws-search');
        search.oninput = () => {
          const q = search.value.trim().toLowerCase();
          m.querySelectorAll('[data-find]').forEach((b) => (b.hidden = Boolean(q) && !b.dataset.find.includes(q)));
          m.querySelectorAll('.ws-menu-sub:not(.ws-switch)').forEach((s) => (s.hidden = Boolean(q)));
        };
        if (list.length > 6) search.focus();
        else search.hidden = true;
        m.querySelectorAll('[data-open]').forEach(
          (b) =>
            (b.onclick = () => {
              closeMenu();
              openDeck({ id: b.dataset.open, customer: b.dataset.cust || '', name: b.dataset.name || '' });
            }),
        );
        m.querySelector('[data-edit]')?.addEventListener('click', () => openEditor(d.layout));
        m.querySelector('[data-acct]')?.addEventListener('click', editAccount);
        m.querySelector('[data-new]').onclick = () => newDeck(null);
        m.querySelector('[data-settings]')?.addEventListener('click', async () => {
          closeMenu();
          const { deckSettingsDialog } = await ui();
          deckSettingsDialog({
            deck: cur,
            customer: account(cur.customer),
            product: PAGE,
            nameOf,
            onRenamed: (saved) => openDeck(saved),
            onCopy: () => newDeck(cur),
            onDeleted: () => openDeck({ id: '' }),
          });
        });
        m.querySelector('[data-pdf]')?.addEventListener('click', async () => {
          closeMenu();
          const { pdfHref } = await ui();
          window.open(pdfHref({ id: cur?.id, customer: cur?.customer, color: account(cur?.customer)?.color || '', name: cur?.name || '', products: PAGE ? [PAGE] : [] }), '_blank', 'noopener');
        });
        m.querySelector('[data-link]')?.addEventListener('click', async () => {
          const { copyLink } = await ui();
          await copyLink(PAGE ? `${cur.id}/${PAGE}` : cur.id);
          deckMenu(anchor, `Link copied: anyone signed in can open “${cur.name}” with it.`);
        });
      },
    );
  }

  async function meMenu(anchor, note = '') {
    // Admins manage people here: add someone, set SE or AE, reset a PIN, remove someone.
    let people = [];
    if (me.admin) people = (await api('/api/presenters/manage').catch(() => ({ people: [] }))).people;
    const others = people.filter((p) => p.id !== me.id).sort((a, b) => a.name.localeCompare(b.name));
    const person = (p) => `<div class="ws-reset"><span>${esc(p.name)}${p.admin ? ' <em>Admin</em>' : ''}${p.hasPin ? '' : ' <em>no PIN yet</em>'}</span>
      <span class="ws-acts"><select class="ws-role-pick" data-role="${esc(p.id)}" aria-label="${esc(p.name)}’s role"><option value="se" ${p.role !== 'ae' ? 'selected' : ''}>SE</option><option value="ae" ${p.role === 'ae' ? 'selected' : ''}>AE</option></select>
      <button type="button" class="ws-small" data-reset="${esc(p.id)}" ${p.hasPin ? '' : 'disabled'}>Reset PIN</button>${p.builtIn ? '' : `<button type="button" class="ws-small danger" data-remove="${esc(p.id)}">Remove</button>`}</span></div>`;
    openMenu(
      anchor,
      `<div class="ws-menu-h">${esc(me.name)} · ${isAe() ? 'Account executive' : 'Sales engineer'}</div>
       <a class="ws-item" href="/decks?mine=1"><span>My decks</span><small>Library →</small></a>
       <button type="button" class="ws-item" data-tour><span>Take the quick tour</span><small>1 minute</small></button>
       <form class="ws-chpin"><div class="ws-menu-sub">Change your PIN</div>
         <input type="password" inputmode="numeric" maxlength="8" placeholder="Current PIN" data-old />
         <input type="password" inputmode="numeric" maxlength="8" placeholder="New PIN (4–8 digits)" data-new />
         <button type="submit" class="ws-small">Change PIN</button></form>
       ${
         me.admin
           ? `<div class="ws-menu-sub">People <span>a reset or new person chooses a PIN at next sign-in</span></div>${others.map(person).join('')}
              <form class="ws-add"><input type="text" maxlength="30" placeholder="Add a person: their name" data-name autocomplete="off" />
                <select data-newrole aria-label="Role"><option value="se">SE</option><option value="ae">AE</option></select>
                <label><input type="checkbox" data-admin /> Admin</label><button type="submit" class="ws-small">Add</button></form>`
           : ''
       }
       ${note ? `<p class="ws-note">${esc(note)}</p>` : ''}
       <div class="ws-menu-f"><button type="button" class="ws-link" data-signout>Sign out</button></div>`,
      (m) => {
        m.querySelector('.ws-add')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = m.querySelector('[data-name]').value.trim();
          try {
            const out = await api('/api/presenters', 'POST', { name, role: m.querySelector('[data-newrole]').value, admin: m.querySelector('[data-admin]').checked });
            state.presenters.push(out.presenter);
            meMenu(anchor, `${out.presenter.name} was added. They find their name on the sign-in screen and choose a PIN.`);
          } catch (err) {
            meMenu(anchor, err.message);
          }
        });
        m.querySelectorAll('[data-role]').forEach(
          (s) =>
            (s.onchange = async () => {
              try {
                await api(`/api/presenters/${s.dataset.role}`, 'PUT', { role: s.value });
                meMenu(anchor, `${nameOf(s.dataset.role)} is now ${s.value === 'ae' ? 'an AE' : 'an SE'}.`);
              } catch (err) {
                meMenu(anchor, err.message);
              }
            }),
        );
        m.querySelectorAll('[data-remove]').forEach(
          (b) =>
            (b.onclick = async () => {
              const who = nameOf(b.dataset.remove);
              if (!confirm(`Remove ${who}? They’re signed out and can’t sign in again. Their decks and customers stay, still marked as theirs.`)) return;
              try {
                await api(`/api/presenters/${b.dataset.remove}`, 'DELETE');
                state.presenters = state.presenters.filter((p) => p.id !== b.dataset.remove);
                state.former = [...state.former, { id: b.dataset.remove, name: who }];
                meMenu(anchor, `${who} was removed.`);
              } catch (err) {
                meMenu(anchor, err.message);
              }
            }),
        );
        m.querySelector('.ws-chpin').onsubmit = async (e) => {
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
        m.querySelector('[data-tour]').onclick = () => {
          closeMenu();
          tour(0);
        };
        m.querySelector('[data-signout]').onclick = async () => {
          await api('/api/presenters/logout', 'POST').catch(() => {});
          signOut();
        };
      },
    );
  }

  function guestMenu(anchor) {
    openMenu(
      anchor,
      `<div class="ws-menu-h">Browsing as a guest</div>
       <p class="ws-note">Look around the official decks, architecture and sample apps, and try the demos. Anything you try in the demos is just for this visit, and nothing here can be changed.</p>
       <div class="ws-menu-f"><button type="button" class="ws-link" data-signout>On the team? Sign in</button></div>`,
      (m) => {
        m.querySelector('[data-signout]').onclick = async () => {
          await api('/api/presenters/logout', 'POST').catch(() => {});
          signOut();
        };
      },
    );
  }

  // A short first-time tour, anchored to what's on this page. Replay it from your name menu.
  const TOUR = [
    ['.ws-home', 'Every deck lives here', 'The deck library: yours, ones shared with you, everyone else’s, and the official deck. Start here to make a deck for a customer, with their logo.'],
    ['.ws-deck', 'What you’re presenting', 'One deck covers all five products and follows you from page to page, with the customer’s logo and colors. Click it to edit this product’s slides, switch decks, or get a PDF to send afterwards.'],
    ['[data-full]', 'Present', 'Full screen for the room. 🗔 Presenter view (next to it) keeps your talking points, the next slide and a timer on your laptop.'],
    ['.ws-me', 'That’s it', 'Your name menu has your PIN and this tour, if you want it again.'],
  ];
  const tourKey = () => `ws-tour:${me?.id}`;
  function tour(i = 0) {
    document.querySelector('.ws-tour')?.remove();
    document.querySelector('.ws-tour-on')?.classList.remove('ws-tour-on');
    const steps = TOUR.filter(([sel]) => document.querySelector(sel)?.getClientRects().length);
    const step = steps[i];
    if (!step) return write(tourKey(), '1');
    const el = document.querySelector(step[0]);
    el.classList.add('ws-tour-on');
    const pop = document.createElement('div');
    pop.className = 'ws-tour';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Quick tour');
    pop.innerHTML = `<div class="ws-tour-n">${i + 1} of ${steps.length}</div><b>${esc(step[1])}</b><p>${esc(step[2])}</p>
      <div class="ws-tour-f"><button type="button" class="ws-link" data-skip>${i === steps.length - 1 ? '' : 'Skip the tour'}</button><span>
        ${i ? '<button type="button" class="ws-small" data-back>Back</button>' : ''}<button type="button" class="ws-small primary-act" data-next>${i === steps.length - 1 ? 'Done' : 'Next'}</button></span></div>`;
    document.body.append(pop);
    const r = el.getBoundingClientRect();
    const below = r.bottom + pop.offsetHeight + 16 < innerHeight;
    pop.style.top = `${(below ? r.bottom + 12 : r.top - pop.offsetHeight - 12) + scrollY}px`;
    pop.style.left = `${Math.max(12, Math.min(r.left + r.width / 2 - pop.offsetWidth / 2, innerWidth - pop.offsetWidth - 12))}px`;
    pop.classList.toggle('above', !below);
    pop.querySelector('[data-next]').onclick = () => tour(i + 1);
    pop.querySelector('[data-back]')?.addEventListener('click', () => tour(i - 1));
    pop.querySelector('[data-skip]').onclick = () => tour(99);
    pop.querySelector('[data-next]').focus();
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
    document.querySelector('.ws-bar')?.remove();
    const bar = document.createElement('div');
    bar.className = 'ws-bar';
    const home = `<a class="ws-home" href="/decks" title="All decks">⌂<span class="ws-lbl">Decks</span></a>`;
    if (isGuest()) {
      bar.innerHTML = `${home}<button type="button" class="ws-me ws-guest-chip" title="Browsing as a guest (read-only)"><span class="ws-av">G</span><span class="ws-me-n">Guest</span><span class="ws-caret">▾</span></button>`;
      host.prepend(bar);
      bar.querySelector('.ws-me').onclick = (e) => (menu ? closeMenu() : guestMenu(e.currentTarget));
      return;
    }
    const a = account(open.customer);
    // Keep the remembered brand color in step with the customer (it may have changed).
    if (open.id && (a?.color || '') !== (open.color || '')) {
      open.color = a?.color || '';
      write(openKey(), JSON.stringify(open));
    }
    applyBrand(open.id ? open.color : '');
    const name = open.id ? state.deck?.layout?.name || state.open?.name || open.name || 'Deck' : 'Official';
    const deckChip = `<button type="button" class="ws-deck" title="The deck you’re presenting, on every product: click to switch, edit, copy or share"><i class="ws-dot ${open.id ? (a ? '' : 'gen') : 'std'}" style="${a?.color ? `background:${esc(a.color)}` : ''}"></i><span class="ws-lbl">Deck</span><b>${esc(name)}</b>${a && a.name !== name ? `<small>${esc(a.name)}</small>` : ''}<span class="ws-caret">▾</span></button>`;
    bar.innerHTML = `${home}${deckChip}<button type="button" class="ws-me" title="Signed in as ${esc(me.name)}"><span class="ws-av">${esc(me.name[0])}</span><span class="ws-me-n">${esc(me.name)}</span><span class="ws-caret">▾</span></button>`;
    host.prepend(bar);
    bar.querySelector('.ws-me').onclick = (e) => (menu ? closeMenu() : meMenu(e.currentTarget));
    bar.querySelector('.ws-deck')?.addEventListener('click', (e) => (menu ? closeMenu() : deckMenu(e.currentTarget)));
  }

  // On narrower screens the product switch collapses to the current product + a menu.
  const narrow = matchMedia('(max-width: 1520px)');
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
      state.former = list.former || [];
      state.setupPasswordRequired = list.setupPasswordRequired;
      if (!mine.me) {
        if (me || token) {
          write('ws-token', null);
          write('ws-me', null);
          token = '';
          me = null;
        }
        document.dispatchEvent(new CustomEvent('ws:ready'));
        return showGate();
      }
      const wasSignedIn = signedIn();
      me = mine.me;
      markRoles();
      write('ws-me', JSON.stringify(me.guest ? { id: me.id, name: me.name, guest: true } : { id: me.id, name: me.name, admin: me.admin, role: me.role }));
      // Signed in on the server but not when this page started (another tab): start again.
      if (!wasSignedIn && signedIn()) return location.reload();
      await refreshAccounts();
      if (PRINTING) return; // the PDF page only needs the slides
      // The open deck's account must still be its account (a deck can be moved, merged or deleted).
      if (signedIn() && open.id) {
        const deck = await api(`/api/layouts/${encodeURIComponent(open.id)}`).catch((err) => (err.status === 404 ? null : undefined));
        if (deck && (deck.id !== open.id || (deck.customer || '') !== (open.customer || ''))) return openDeck(deck);
        if (deck) state.open = deck;
        if (deck === null) await openDeck({ id: '' });
      }
      drawBar();
      document.dispatchEvent(new CustomEvent('ws:ready'));
      // First time here: a short tour (once the page has drawn its deck).
      if (signedIn() && !read(tourKey()) && !matchMedia('(max-width: 700px)').matches) setTimeout(() => !document.querySelector('dialog[open], .ws-gate') && tour(0), 1200);
    } catch {
      // The page still works signed out if the server can't be reached.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
