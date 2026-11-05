// The deck library (/decks): every deck and account in one place.
//   Decks:    the official decks, yours, your accounts' (you're on the team),
//             and everyone else's. Search and filter by product, person or account.
//   Accounts: who you present to, with their team and their decks.
// Opening a deck takes you to its product page with that deck open.
import { PRODUCTS, productOf, esc, deckHref, copyLink, ago, call, newDeckDialog, accountDialog } from './decks-ui.js';

const $ = (s) => document.querySelector(s);
const root = $('#lib');
const qs = new URLSearchParams(location.search);
const st = {
  view: location.hash === '#accounts' ? 'accounts' : 'decks',
  q: '',
  product: '',
  who: qs.get('mine') ? 'mine' : '',
  account: qs.get('account') || '',
  me: null,
  people: [],
  former: [],
  decks: [],
  accounts: [],
  note: qs.get('missing') ? 'That deck link doesn’t work anymore: the deck was deleted. Here’s everything else.' : '',
};
const nameOf = (id) => [...st.people, ...st.former].find((p) => p.id === id)?.name || id;
const acct = (id) => st.accounts.find((a) => a.id === id);
const initials = (id) => esc((nameOf(id) || '?')[0]);

async function load() {
  const [{ me }, people] = await Promise.all([call('/api/presenters/me'), call('/api/presenters')]);
  st.me = me;
  st.people = people.presenters;
  st.former = people.former || [];
  if (!me) return false;
  if (!me.guest) {
    const [decks, accounts] = await Promise.all([call('/api/layouts'), call('/api/profiles')]);
    st.decks = decks.layouts;
    st.accounts = accounts.profiles;
  }
  return true;
}

// ---------- decks ----------
const matches = (text) => !st.q || text.toLowerCase().includes(st.q);
function deckCard(d) {
  const p = productOf(d.deck);
  const a = acct(d.customer);
  return `<article class="lib-card" style="--p:${p.rgb}">
    <div class="lib-card-top"><span class="lib-prod">${esc(p.name)}</span>${a ? `<button type="button" class="lib-acct" data-account="${esc(a.id)}" title="Show ${esc(a.name)}’s decks"><i style="${a.color ? `background:${esc(a.color)}` : ''}"></i>${esc(a.name)}</button>` : '<span class="lib-acct gen">General</span>'}</div>
    <h3><a href="${deckHref(d.deck, d.id, d.customer)}">${esc(d.name)}</a></h3>
    <p class="lib-meta"><span class="lib-av">${initials(d.owner)}</span>${d.mine ? 'Yours' : esc(nameOf(d.owner))} · updated ${esc(ago(d.updatedAt))}${d.updatedBy && d.updatedBy !== d.owner ? ` by ${esc(nameOf(d.updatedBy))}` : ''}</p>
    <div class="lib-acts">
      <a class="lib-btn lib-primary" href="${deckHref(d.deck, d.id, d.customer)}">Open</a>
      ${d.canEdit ? `<a class="lib-btn" href="${deckHref(d.deck, d.id, d.customer, { edit: true })}">Edit</a>` : ''}
      ${d.mine ? '' : `<button type="button" class="lib-btn" data-copy="${esc(d.id)}">Copy</button>`}
      <button type="button" class="lib-btn icon" data-link="${esc(d.id)}" title="Copy link">🔗</button>
    </div>
  </article>`;
}
function officialCard(p) {
  return `<article class="lib-card official" style="--p:${p.rgb}">
    <div class="lib-card-top"><span class="lib-prod">${esc(p.name)}</span><span class="lib-acct gen">Official</span></div>
    <h3><a href="${deckHref(p.id, '')}">${esc(p.label)}</a></h3>
    <div class="lib-acts"><a class="lib-btn lib-primary" href="${deckHref(p.id, '')}">Open</a>${st.me.guest ? '' : `<button type="button" class="lib-btn" data-new="${p.id}" title="Make your own deck from the official ${esc(p.name)} deck">＋ Make mine</button>`}</div>
  </article>`;
}

function drawDecks() {
  const guest = st.me.guest;
  const filtered = st.decks.filter((d) => {
    const a = acct(d.customer);
    return (
      (!st.product || d.deck === st.product) &&
      (!st.account || d.customer === st.account) &&
      (!st.who || (st.who === 'mine' ? d.mine : d.owner === st.who)) &&
      matches(`${d.name} ${a?.name || ''} ${nameOf(d.owner)} ${productOf(d.deck).name}`)
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
  const officials = PRODUCTS.filter((p) => (!st.product || p.id === st.product) && !st.account && (!st.who || st.who === '') && matches(`${p.label} official`));
  const owners = [...new Set(st.decks.map((d) => d.owner))].filter((id) => id !== st.me.id).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const section = (title, hint, list, empty) =>
    list.length || empty ? `<section class="lib-sec"><h3>${title}${hint ? ` <span>${hint}</span>` : ''}</h3>${list.length ? `<div class="lib-grid">${list.map(deckCard).join('')}</div>` : `<p class="lib-empty">${empty}</p>`}</section>` : '';
  const filtering = st.q || st.product || st.account || st.who;
  return `
    ${
      guest
        ? '<p class="lib-note">You’re browsing as a guest: here are the official decks. Sign in to see and make your own.</p>'
        : `<div class="lib-filters">
             <input id="libSearch" type="search" placeholder="Search decks, accounts or people" value="${esc(st.q)}" aria-label="Search decks" />
             <div class="lib-chips" role="group" aria-label="Product">
               <button type="button" data-product="" class="${st.product ? '' : 'on'}">All</button>
               ${PRODUCTS.map((p) => `<button type="button" data-product="${p.id}" class="${st.product === p.id ? 'on' : ''}" style="--p:${p.rgb}">${esc(p.name)}</button>`).join('')}
             </div>
             <select id="libWho" aria-label="Whose decks"><option value="">Everyone’s</option><option value="mine" ${st.who === 'mine' ? 'selected' : ''}>Mine</option>${owners.map((id) => `<option value="${esc(id)}" ${st.who === id ? 'selected' : ''}>${esc(nameOf(id))}’s</option>`).join('')}</select>
             <select id="libAcct" aria-label="Account"><option value="">Any account</option>${st.accounts.map((a) => `<option value="${esc(a.id)}" ${st.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
             ${filtering ? '<button type="button" class="lib-clear" id="libClear">Clear</button>' : ''}
           </div>`
    }
    ${officials.length ? `<section class="lib-sec"><h3>Official decks <span>start here, or make your own from one</span></h3><div class="lib-grid official">${officials.map(officialCard).join('')}</div></section>` : ''}
    ${guest ? '' : section('Your decks', '', mine, filtering ? '' : 'You haven’t made a deck yet. Pick an official deck and make your own, or copy one below.')}
    ${guest ? '' : section('Your accounts’ decks', 'you’re on the account team, so you can edit these', team, '')}
    ${guest ? '' : section('Everyone else’s', st.me.admin ? 'open, copy, or edit as an admin' : 'open to present, or copy to make your own', others, '')}
    ${!guest && filtering && !mine.length && !team.length && !others.length && !officials.length ? '<p class="lib-empty">Nothing matches. Try another search or clear the filters.</p>' : ''}`;
}

// ---------- accounts ----------
function drawAccounts() {
  const list = st.accounts.filter((a) => matches(`${a.name} ${nameOf(a.owner || 'tyler')} ${(a.team || []).map(nameOf).join(' ')}`));
  const mine = (a) => (a.owner || 'tyler') === st.me.id || (a.team || []).includes(st.me.id);
  const card = (a) => {
    const decks = st.decks.filter((d) => d.customer === a.id);
    const counts = PRODUCTS.map((p) => [p, decks.filter((d) => d.deck === p.id).length]).filter(([, n]) => n);
    const team = [a.owner || 'tyler', ...(a.team || [])];
    return `<article class="lib-card lib-acct-card" style="--c:${esc(a.color || '#71717a')}">
      <div class="lib-card-top"><span class="lib-prod">Owner · ${esc(nameOf(a.owner || 'tyler'))}</span><span class="lib-team">${team.map((id, i) => `<span class="lib-av ${i ? '' : 'own'}" title="${esc(nameOf(id))}${i ? '' : ' (owner)'}">${initials(id)}</span>`).join('')}</span></div>
      <h3><button type="button" class="lib-link" data-show="${esc(a.id)}">${esc(a.name)}</button></h3>
      <p class="lib-meta">${counts.length ? counts.map(([p, n]) => `<span class="lib-count" style="--p:${p.rgb}">${esc(p.name)} ${n}</span>`).join('') : 'No decks yet'}</p>
      <div class="lib-acts">
        <button type="button" class="lib-btn lib-primary" data-show="${esc(a.id)}">${decks.length ? `See ${decks.length} deck${decks.length === 1 ? '' : 's'}` : 'See decks'}</button>
        <button type="button" class="lib-btn" data-newfor="${esc(a.id)}">＋ Deck</button>
        <button type="button" class="lib-btn" data-details="${esc(a.id)}">${a.canEdit ? 'Edit' : 'Details'}</button>
      </div>
    </article>`;
  };
  const yours = list.filter(mine);
  const rest = list.filter((a) => !mine(a));
  return `
    <div class="lib-filters"><input id="libSearch" type="search" placeholder="Search accounts or people" value="${esc(st.q)}" aria-label="Search accounts" /></div>
    <section class="lib-sec"><h3>Your accounts <span>you own them or you’re on the team</span></h3>${yours.length ? `<div class="lib-grid">${yours.map(card).join('')}</div>` : `<p class="lib-empty">${st.q ? 'None match.' : 'No accounts yet. Make one for a customer, an opportunity or an event.'}</p>`}</section>
    ${rest.length ? `<section class="lib-sec"><h3>Everyone else’s</h3><div class="lib-grid">${rest.map(card).join('')}</div></section>` : ''}`;
}

// ---------- page ----------
function draw() {
  if (!st.me) return (root.innerHTML = '');
  const guest = st.me.guest;
  document.querySelector('.view-tabs').hidden = guest;
  const view = guest ? 'decks' : st.view;
  document.querySelectorAll('.view-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  });
  root.innerHTML = `
    <div class="lib-head">
      <div><h2>${view === 'decks' ? (guest ? 'Official decks' : `Decks${st.account && acct(st.account) ? ` for ${esc(acct(st.account).name)}` : ''}`) : 'Accounts'}</h2>
        <p class="muted">${view === 'decks' ? 'A deck is your version of a product deck: which slides, in what order, and what you say. Open one to present it.' : 'An account is who you present to: a customer, an opportunity or an event. Its decks show its name and color.'}</p></div>
      ${guest ? '' : `<div class="lib-new"><button type="button" class="lib-btn lib-primary big" id="libNewDeck">＋ New deck</button><button type="button" class="lib-btn big" id="libNewAcct">＋ New account</button></div>`}
    </div>
    ${st.note ? `<p class="lib-note">${esc(st.note)}</p>` : ''}
    ${view === 'decks' ? drawDecks() : drawAccounts()}`;
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
  root.querySelectorAll('[data-product]').forEach((b) => (b.onclick = () => ((st.product = b.dataset.product), draw())));
  $('#libWho')?.addEventListener('change', (e) => ((st.who = e.target.value), draw()));
  $('#libAcct')?.addEventListener('change', (e) => ((st.account = e.target.value), draw()));
  $('#libClear')?.addEventListener('click', () => {
    Object.assign(st, { q: '', product: '', who: '', account: '' });
    draw();
  });
  const showAccount = (id) => {
    Object.assign(st, { view: 'decks', account: id, q: '', product: '', who: '' });
    history.replaceState(null, '', '#decks');
    draw();
    window.scrollTo({ top: 0 });
  };
  root.querySelectorAll('[data-account], [data-show]').forEach((b) => (b.onclick = () => showAccount(b.dataset.account || b.dataset.show)));
  root.querySelectorAll('[data-link]').forEach(
    (b) =>
      (b.onclick = async () => {
        await copyLink(b.dataset.link);
        b.textContent = '✓';
        setTimeout(() => (b.textContent = '🔗'), 1500);
      }),
  );
  const created = (deck) => (location.href = deckHref(deck.deck, deck.id, deck.customer, { edit: true }));
  root.querySelectorAll('[data-copy]').forEach(
    (b) =>
      (b.onclick = () => {
        const from = st.decks.find((d) => d.id === b.dataset.copy);
        newDeckDialog({ accounts: st.accounts, from, onCreated: created });
      }),
  );
  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => newDeckDialog({ product: b.dataset.new, accounts: st.accounts, account: st.account, onCreated: created })));
  root.querySelectorAll('[data-newfor]').forEach((b) => (b.onclick = () => newDeckDialog({ accounts: st.accounts, account: b.dataset.newfor, onCreated: created })));
  $('#libNewDeck')?.addEventListener('click', () => newDeckDialog({ product: st.product || null, accounts: st.accounts, account: st.account, onCreated: created }));
  const reload = async () => {
    await load();
    draw();
  };
  root.querySelectorAll('[data-details]').forEach((b) => (b.onclick = () => accountDialog({ account: acct(b.dataset.details), people: st.people, me: st.me, onSaved: reload, onDeleted: reload })));
  $('#libNewAcct')?.addEventListener('click', () =>
    accountDialog({
      account: null,
      people: st.people,
      me: st.me,
      onSaved: async (a) => {
        await load();
        st.view = 'accounts';
        draw();
        newDeckDialog({ accounts: st.accounts, account: a.id, onCreated: created });
      },
    }),
  );
}

function setView(v) {
  st.view = v === 'accounts' ? 'accounts' : 'decks';
  st.q = '';
  history.replaceState(null, '', `#${st.view}`);
  draw();
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
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
if (qs.has('missing') || qs.has('mine') || qs.has('account')) history.replaceState(null, '', `${location.pathname}${location.hash}`);
try {
  if (await load()) draw();
} catch {
  root.innerHTML = '<p class="lib-empty">Couldn’t load the library. Check your connection and reload.</p>';
}
