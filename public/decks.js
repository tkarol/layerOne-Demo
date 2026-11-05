// The deck library (/decks): every deck in one place. A deck is one presentation
// across the whole suite, usually for a customer (their name and logo on every
// product). The official deck, yours, ones you can edit for your customers, and
// everyone else's. Search, or filter by person or customer. Opening a deck takes
// you to a product page with that deck open.
import { PRODUCTS, esc, deckHref, ago, call, newDeckDialog, accountDialog, deckSettingsDialog } from './decks-ui.js';

const $ = (s) => document.querySelector(s);
const root = $('#lib');
const qs = new URLSearchParams(location.search);
const st = {
  q: '',
  who: qs.get('mine') ? 'mine' : '',
  account: qs.get('account') || '',
  me: null,
  people: [],
  former: [],
  decks: [],
  accounts: [],
  presented: [],
  note: qs.get('missing') ? 'That deck link doesn’t work anymore: the deck was deleted. Here’s everything else.' : '',
};
const nameOf = (id) => [...st.people, ...st.former].find((p) => p.id === id)?.name || id;
const acct = (id) => st.accounts.find((a) => a.id === id);
const initials = (id) => esc((nameOf(id) || '?')[0]);
const logoImg = (a, cls = 'lib-logo') => (a?.hasLogo ? `<img class="${cls}" src="/api/profiles/${esc(a.id)}/logo?v=${encodeURIComponent(a.updatedAt || '')}" alt="${esc(a.name)} logo" loading="lazy" />` : '');

async function load() {
  const [{ me }, people] = await Promise.all([call('/api/presenters/me'), call('/api/presenters')]);
  st.me = me;
  st.people = people.presenters;
  st.former = people.former || [];
  if (!me) return false;
  if (!me.guest) {
    const [decks, accounts, presented] = await Promise.all([call('/api/layouts'), call('/api/profiles'), call('/api/presented').catch(() => ({ presented: [] }))]);
    st.decks = decks.layouts;
    st.accounts = accounts.profiles;
    st.presented = presented.presented;
  }
  return true;
}

// ---------- decks ----------
const matches = (text) => !st.q || text.toLowerCase().includes(st.q);
function deckCard(d) {
  const a = acct(d.customer);
  const first = d.products?.[0] || 'vellox';
  return `<article class="lib-card" style="${a?.color ? `--acc:${esc(a.color)}` : ''}">
    <div class="lib-card-top">${
      a
        ? `<button type="button" class="lib-cust" data-account="${esc(a.id)}" title="Show every deck for ${esc(a.name)}">${logoImg(a) || `<i style="${a.color ? `background:${esc(a.color)}` : ''}"></i>`}<span>${esc(a.name)}</span></button><button type="button" class="lib-cust-edit" data-details="${esc(a.id)}" title="${esc(a.name)}: logo, color, who can edit" aria-label="Edit customer ${esc(a.name)}">✎</button>`
        : '<span class="lib-acct gen">General deck</span>'
    }</div>
    <h3><a href="${deckHref(first, d.id, d.customer)}">${esc(d.name)}</a></h3>
    <div class="lib-prods" aria-label="Open on a product">${PRODUCTS.map((p) => `<a href="${deckHref(p.id, d.id, d.customer)}" class="${d.products?.includes(p.id) ? 'changed' : ''}" style="--p:${p.rgb}" title="${d.products?.includes(p.id) ? `Your ${esc(p.name)} slides` : `Official ${esc(p.name)} slides`}">${esc(p.name)}</a>`).join('')}</div>
    <p class="lib-meta"><span class="lib-av">${initials(d.owner)}</span>${d.mine ? 'Yours' : esc(nameOf(d.owner))} · updated ${esc(ago(d.updatedAt))}${d.updatedBy && d.updatedBy !== d.owner ? ` by ${esc(nameOf(d.updatedBy))}` : ''}${(() => {
      const p = st.presented.find((x) => x.deck === d.id);
      return p ? `<br />Presented ${esc(ago(p.at))} by ${esc(p.by === st.me.id ? 'you' : nameOf(p.by))}` : '';
    })()}</p>
    <div class="lib-acts">
      <a class="lib-btn lib-primary" href="${deckHref(first, d.id, d.customer)}">Present</a>
      ${d.canEdit ? `<a class="lib-btn" href="${deckHref(first, d.id, d.customer, { edit: true })}" title="Edit the slides">Edit slides</a>` : `<button type="button" class="lib-btn" data-copy="${esc(d.id)}" title="Make your own copy">⧉ Copy</button>`}
      <button type="button" class="lib-btn icon" data-settings="${esc(d.id)}" title="Deck settings: rename, copy, link, delete" aria-label="Deck settings for ${esc(d.name)}">⚙</button>
    </div>
  </article>`;
}
// The last few things presented (deck and product), newest first, one line each.
function recent() {
  const seen = new Set();
  const rows = st.presented
    .filter((p) => {
      const k = `${p.deck}|${p.product}`;
      if (seen.has(k) || (p.deck && !st.decks.some((d) => d.id === p.deck))) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
  if (!rows.length) return '';
  return `<section class="lib-sec"><h3>Recently presented</h3><ul class="lib-recent">${rows
    .map((p) => {
      const d = st.decks.find((x) => x.id === p.deck);
      const a = acct(d?.customer);
      const prod = PRODUCTS.find((x) => x.id === p.product);
      return `<li><a href="${deckHref(p.product, p.deck, d?.customer)}">${logoImg(a, 'lib-recent-logo') || `<i style="${a?.color ? `background:${esc(a.color)}` : ''}"></i>`}<span><b>${esc(d?.name || 'Official deck')}</b> · ${esc(prod?.name || p.product)}</span><small>${esc(p.by === st.me.id ? 'You' : nameOf(p.by))}, ${esc(ago(p.at))}</small></a></li>`;
    })
    .join('')}</ul></section>`;
}
function officialCard() {
  return `<article class="lib-card official wide">
    <div class="lib-card-top"><span class="lib-prod">Booz Allen</span><span class="lib-acct gen">Official</span></div>
    <h3>The official deck</h3>
    <p class="lib-meta">Every product as Booz Allen built it. Make your own deck to put a customer’s name and logo on every product and change any slides.</p>
    <div class="lib-prods big">${PRODUCTS.map((p) => `<a href="${deckHref(p.id, '')}" style="--p:${p.rgb}" class="changed">${esc(p.label)}</a>`).join('')}</div>
    ${st.me.guest ? '' : '<div class="lib-acts"><button type="button" class="lib-btn lib-primary" data-new="1">＋ Make my own deck</button></div>'}
  </article>`;
}

function drawDecks() {
  const guest = st.me.guest;
  const filtered = st.decks.filter((d) => {
    const a = acct(d.customer);
    return (
      (!st.account || d.customer === st.account) &&
      (!st.who || (st.who === 'mine' ? d.mine : d.owner === st.who)) &&
      matches(`${d.name} ${a?.name || ''} ${nameOf(d.owner)} ${(d.products || []).join(' ')}`)
    );
  });
  const by = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '');
  // "Your accounts' decks": for accounts you own or are on the team of.
  const onTeam = (d) => {
    const a = acct(d.customer);
    return Boolean(a && ((a.owner || 'tyler') === st.me.id || (a.team || []).includes(st.me.id)));
  };
  const mine = filtered.filter((d) => d.mine).sort(by);
  const team = filtered.filter((d) => !d.mine && onTeam(d)).sort(by);
  const others = filtered.filter((d) => !d.mine && !onTeam(d)).sort(by);
  const showOfficial = !st.account && !st.who && matches('official deck booz allen vellox layerone reverser ranger navigator');
  const owners = [...new Set(st.decks.map((d) => d.owner))].filter((id) => id !== st.me.id).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const section = (title, hint, list, empty) =>
    list.length || empty ? `<section class="lib-sec"><h3>${title}${hint ? ` <span>${hint}</span>` : ''}</h3>${list.length ? `<div class="lib-grid">${list.map(deckCard).join('')}</div>` : `<p class="lib-empty">${empty}</p>`}</section>` : '';
  const filtering = st.q || st.account || st.who;
  return `
    ${
      guest
        ? '<p class="lib-note">You’re browsing as a guest: here are the official decks. Sign in to see and make your own.</p>'
        : `<div class="lib-filters">
             <input id="libSearch" type="search" placeholder="Search decks, customers or people" value="${esc(st.q)}" aria-label="Search decks" />
             <select id="libWho" aria-label="Whose decks"><option value="">Everyone’s</option><option value="mine" ${st.who === 'mine' ? 'selected' : ''}>Mine</option>${owners.map((id) => `<option value="${esc(id)}" ${st.who === id ? 'selected' : ''}>${esc(nameOf(id))}’s</option>`).join('')}</select>
             <select id="libAcct" aria-label="Customer"><option value="">Any customer</option>${st.accounts.map((a) => `<option value="${esc(a.id)}" ${st.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
             ${filtering ? '<button type="button" class="lib-clear" id="libClear">Clear</button>' : ''}
           </div>`
    }
    ${!guest && !filtering ? recent() : ''}
    ${showOfficial ? `<section class="lib-sec"><div class="lib-grid">${officialCard()}</div></section>` : ''}
    ${guest ? '' : section('Your decks', 'each deck covers all five products', mine, filtering ? '' : 'You haven’t made a deck yet. Make your own from the official deck, or copy one below.')}
    ${guest ? '' : section('Shared with you', 'decks for customers you can edit', team, '')}
    ${guest ? '' : section('Everyone else’s', st.me.admin ? 'open, copy, or edit as an admin' : 'open to present, or copy to make your own', others, '')}
    ${!guest && filtering && !mine.length && !team.length && !others.length && !showOfficial ? '<p class="lib-empty">Nothing matches. Try another search or clear the filters.</p>' : ''}`;
}

// ---------- page ----------
function draw() {
  if (!st.me) return (root.innerHTML = '');
  const guest = st.me.guest;
  const forCust = st.account && acct(st.account);
  root.innerHTML = `
    <div class="lib-head">
      <div><h2>${guest ? 'The official deck' : forCust ? `${logoImg(forCust, 'lib-head-logo')}Decks for ${esc(forCust.name)}` : 'Decks'}</h2>
        <p class="muted">${guest ? 'Every Vellox product, as Booz Allen built it.' : 'A deck is one presentation across Vellox, LayerOne, Reverser, Ranger and Navigator. Make one for a customer and their name and logo are on every product.'}</p></div>
      ${guest ? '' : '<div class="lib-new"><button type="button" class="lib-btn lib-primary big" id="libNewDeck">＋ New deck</button></div>'}
    </div>
    ${st.note ? `<p class="lib-note">${esc(st.note)}</p>` : ''}
    ${drawDecks()}`;
  wire();
}

function wire() {
  const search = $('#libSearch');
  if (search) {
    search.oninput = () => {
      st.q = search.value.trim().toLowerCase();
      const pos = search.selectionStart;
      draw();
      const s = $('#libSearch');
      s.focus();
      s.setSelectionRange(pos, pos);
    };
  }
  $('#libWho')?.addEventListener('change', (e) => ((st.who = e.target.value), draw()));
  $('#libAcct')?.addEventListener('change', (e) => ((st.account = e.target.value), draw()));
  $('#libClear')?.addEventListener('click', () => {
    Object.assign(st, { q: '', who: '', account: '' });
    draw();
  });
  const showAccount = (id) => {
    Object.assign(st, { account: id, q: '', who: '' });
    draw();
    window.scrollTo({ top: 0 });
  };
  root.querySelectorAll('[data-account]').forEach((b) => (b.onclick = () => showAccount(b.dataset.account)));
  const created = (deck) => (location.href = deckHref(deck.products?.[0] || 'vellox', deck.id, deck.customer));
  root.querySelectorAll('[data-copy]').forEach(
    (b) =>
      (b.onclick = () => {
        const from = st.decks.find((d) => d.id === b.dataset.copy);
        newDeckDialog({ accounts: st.accounts, from, nameOf, onCreated: created });
      }),
  );
  root.querySelectorAll('[data-settings]').forEach(
    (b) =>
      (b.onclick = () => {
        const d = st.decks.find((x) => x.id === b.dataset.settings);
        deckSettingsDialog({
          deck: d,
          customer: acct(d.customer),
          nameOf,
          onRenamed: reload,
          onCopy: () => newDeckDialog({ accounts: st.accounts, from: d, nameOf, onCreated: created }),
          onDeleted: reload,
        });
      }),
  );
  const fresh = () => newDeckDialog({ accounts: st.accounts, account: st.account || undefined, nameOf, onCreated: created });
  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = fresh));
  $('#libNewDeck')?.addEventListener('click', fresh);
  const reload = async () => {
    await load();
    draw();
  };
  root.querySelectorAll('[data-details]').forEach(
    (b) =>
      (b.onclick = () =>
        accountDialog({
          account: acct(b.dataset.details),
          people: st.people,
          me: st.me,
          deckCount: st.decks.filter((d) => d.customer === b.dataset.details).length,
          onSaved: reload,
          onDeleted: async () => {
            st.account = '';
            await reload();
          },
        })),
  );
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('l1-theme');
  } catch {}
  if (saved) document.documentElement.dataset.theme = saved;
  $('#themeToggle').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('l1-theme', next);
    } catch {}
  };
}

initTheme();
if (qs.has('missing') || qs.has('mine') || qs.has('account')) history.replaceState(null, '', `${location.pathname}${location.hash}`);
try {
  if (await load()) draw();
} catch {
  root.innerHTML = '<p class="lib-empty">Couldn’t load the library. Check your connection and reload.</p>';
}
