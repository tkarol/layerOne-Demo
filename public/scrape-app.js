// "AI web scraper → database": an AI crawler reads pages from the open web and
// writes one record per page into a vendor database. Each page's AI request goes
// through LayerOne. Poisoned pages either get quarantined (LayerOne on) or write
// planted "facts" into the database that analysts later search (LayerOne off).
import { esc, mark, sleep, runStep, outcome, showTrace, cmpCols } from './fmt-common.js';

const s = { runs: { on: null, off: null }, running: false, current: null, showHidden: false };
let ctx; // { el, app, isProtected, paceMs }

export function mountScrapeApp(options) {
  if (ctx?.app?.id !== options.app.id) Object.assign(s, { runs: { on: null, off: null }, running: false, current: null, showHidden: false });
  ctx = options;
  s.current ||= ctx.app.workflows[0]?.id;
  draw();
}

const pages = () => ctx.app.workflows;
const mode = () => (ctx.isProtected() ? 'on' : 'off');
const host = (u) => String(u).replace(/^https?:\/\//, '').split('/')[0];

// "Field: value" lines from the AI's answer; a leading "Done. …" line is what the injected instruction made it do.
function parseRecord(text) {
  const rec = {};
  let leak = null;
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^(Company|Type|Summary|Past performance|Flags):\s*(.*)$/);
    if (m) rec[m[1]] = m[2];
    else if (/^Done\.\s+\S/.test(line)) leak = line.replace(/^Done\.\s*/, '');
  }
  return { rec, leak };
}

// What each page became in the database for this run.
function rowFor(wf, r) {
  if (!r) return { kind: 'pending' };
  if (r.error) return { kind: 'error', why: r.error };
  const t = r.trace;
  if (!t || t.status === 'running') return { kind: 'running' };
  const v = outcome(t, wf);
  if (v.cls === 'stop') return { kind: 'quarantine', why: v.text, v };
  if (v.cls === 'held') return { kind: 'held', why: v.text, v };
  const { rec, leak } = parseRecord(t.output);
  const poisoned = t.bypass && /^Done\./.test(t.output || '');
  return { kind: poisoned ? 'poisoned' : v.cls === 'bad' ? 'risky' : v.cls === 'clean' ? 'clean' : 'ok', rec, leak, v };
}

function draw() {
  if (!ctx?.el?.isConnected) return;
  const cmp = ctx.isCompare?.();
  const m = cmp ? 'off' : mode(); // in Compare the database shows what gets stored without LayerOne
  const run = s.runs[m];
  const wf = pages().find((w) => w.id === s.current) || pages()[0];
  const rows = pages().map((w) => ({ w, row: rowFor(w, run?.results[w.id]), on: rowFor(w, s.runs.on?.results[w.id]) }));
  const stored = rows.filter((x) => ['ok', 'clean', 'risky', 'poisoned'].includes(x.row.kind));
  const done = rows.filter((x) => !['pending', 'running'].includes(x.row.kind)).length;
  ctx.el.innerHTML = `
    <div class="fmt-flow ${m === 'on' || cmp ? '' : 'off'}">
      <span class="hop">🌐 Web pages</span><span class="arr">→</span><span class="hop">🕷️ Crawler</span><span class="arr">→</span>
      <span class="hop l1">${cmp ? '⇆ With and without LayerOne' : m === 'on' ? '🛡️ LayerOne' : '⚠️ LayerOne off'}</span><span class="arr">→</span><span class="hop">✨ AI extracts a record</span><span class="arr">→</span><span class="hop">🗄️ Vendor database</span>
    </div>
    <div class="sc-top">
      <button class="batch-go" id="crawlGo" ${s.running ? 'disabled' : ''}>${s.running ? `<span class="spinner small"></span> Crawling… ${done}/${pages().length}` : run ? '↻ Crawl again' : `▶ Crawl ${pages().length} pages`}</button>
      <span class="muted small">Every page on the web is untrusted. ${cmp ? 'Compare: each page is read with and without LayerOne.' : `LayerOne is <b>${m === 'on' ? 'on' : 'off'}</b>.${run?.finished && !s.runs[m === 'on' ? 'off' : 'on'] ? ` Switch it ${m === 'on' ? 'off' : 'on'} and crawl again to compare.` : ''}`}</span>
    </div>
    <div class="sc-app">
      <aside class="sc-queue">
        <div class="side-title">Crawl queue</div>
        <ol>${rows
          .map(({ w, row, on }) => `<li><button class="sq-item ${w.id === wf.id ? 'active' : ''}" data-page="${esc(w.id)}" ${s.running ? 'disabled' : ''}>
            <span class="sq-host">${esc(host(w.screen.url))}</span><b>${esc(w.site)}</b>${cmp ? `<span class="chip2"><span class="${rowTone(on.kind)}">🛡️ ${esc(statusText(on))}</span><span class="${rowTone(row.kind)}">⚠️ ${esc(statusText(row))}</span></span>` : `<span class="sq-st k-${row.kind}">${esc(statusText(row))}</span>`}</button></li>`)
          .join('')}</ol>
      </aside>
      ${drawBrowser(wf, rowFor(wf, run?.results[wf.id]), run?.results[wf.id], cmp)}
    </div>
    ${drawDb(rows, stored, m, cmp)}
    ${cmp ? (s.runs.on?.finished && run?.finished ? cmpCols(drawSearch(rows.map((x) => ({ w: x.w, row: x.on })), 'on'), drawSearch(rows, 'off')) : '') : run?.finished ? drawSearch(rows, m) : ''}`;
  wire();
}

// Chip color follows the outcome, not the side.
const rowTone = (k) => (['poisoned', 'risky', 'error'].includes(k) ? 'bad' : ['quarantine', 'held', 'clean'].includes(k) ? 'caught' : k === 'ok' ? 'good' : '');

function statusText(row) {
  return { pending: 'Waiting', running: 'Reading…', ok: '✓ Stored', clean: '🛡️ Stored, cleaned', quarantine: '⛔ Quarantined', held: '✋ Held', poisoned: '☠ Poisoned record stored', risky: '⚠ Stored unchecked', error: 'Error' }[row.kind] || '';
}

function drawBrowser(wf, row, r, cmp) {
  const sc = wf.screen;
  return `<section class="sc-browser">
    <div class="br-bar"><span class="br-dots"><i></i><i></i><i></i></span><span class="br-url">🔒 ${esc(sc.url)}</span></div>
    <div class="br-page">
      <small>${esc(wf.site)}</small>
      <h3>${esc(sc.title)}</h3>
      <p>${mark(sc.excerpt)}</p>
      ${sc.long ? `<p class="muted small">… 220 pages · about ${Math.round(sc.size / 4).toLocaleString('en-US')} tokens</p>` : ''}
      ${sc.hidden ? `<p class="hidden-text ${s.showHidden ? 'shown' : ''}">${esc(sc.hidden)}</p>` : ''}
    </div>
    ${sc.hidden ? `<div class="br-hide"><button class="reveal" id="scReveal">${s.showHidden ? '🙈 Hide' : '👁 Reveal'} what the reader can’t see</button><span class="muted small">Hidden in ${esc(sc.hideIn)}</span></div>` : ''}
    <div class="br-result">${cmp ? cmpCols(drawPageResult(rowFor(wf, s.runs.on?.results[wf.id]), s.runs.on?.results[wf.id]), drawPageResult(row, r)) : drawPageResult(row, r)}</div>
  </section>`;
}

function drawPageResult(row, r) {
  if (row.kind === 'pending') return '<p class="muted">Not crawled yet.</p>';
  if (row.kind === 'running') return '<p class="muted"><span class="spinner small"></span> The AI is reading this page…</p>';
  if (row.kind === 'error') return `<p class="ac-issues">${esc(row.why)}</p>`;
  const t = r.trace;
  const link = t?.id ? `<a href="#" class="muted small" data-trace="${esc(t.id)}">See what LayerOne did →</a>` : '';
  const head = `<div class="bd-verdict v-${row.v.cls}"><span class="ac-badge">${row.v.badge}</span><span>${esc(row.v.text)}</span></div>${row.v.list?.length ? `<ul class="ac-issues">${row.v.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
  if (row.kind === 'quarantine') return `${head}<p class="ac-none">Nothing written to the database. The page is quarantined for a person to look at.</p>${link}`;
  if (row.kind === 'held') return `${head}<p class="ac-none">The record is held for review instead of going into the database.</p>${link}`;
  return `${head}${row.leak ? `<p class="sc-leak">☠ ${mark(row.leak)}</p>` : ''}<p class="ac-recv"><span>Written to the database</span>${Object.entries(row.rec).map(([k, v]) => `<b>${esc(k)}:</b> ${mark(v)}`).join('<br>')}</p>${link}`;
}

function drawDb(rows, stored, m, cmp) {
  const quarantined = rows.filter((x) => x.row.kind === 'quarantine');
  const held = rows.filter((x) => x.row.kind === 'held');
  return `<section class="sc-db">
    <div class="db-cyl-head"><span>🗄️</span><b>Vendor database${cmp ? ', as stored without LayerOne' : ''}</b><code>${esc(ctx.app.table || 'vendors')}</code><small>${stored.length} record${stored.length === 1 ? '' : 's'}</small></div>
    <div class="sc-table-wrap"><table class="sc-table">
      <thead><tr>${cmp ? '<th>🛡️ With LayerOne</th>' : ''}<th>Source</th><th>Company</th><th>Summary</th><th>Past performance</th><th>Flags</th></tr></thead>
      <tbody>${
        stored.length
          ? stored
              .map(({ w, row, on }) => `<tr class="r-${row.kind}">${cmp ? `<td class="on-col">${esc(statusText(on))}</td>` : ''}<td>${esc(host(w.screen.url))}</td><td>${esc(row.rec.Company || '')}</td><td>${mark(row.rec.Summary || '')}</td><td>${esc(row.rec['Past performance'] || '')}</td><td>${row.kind === 'poisoned' ? '☠ ' : ''}${esc(row.rec.Flags || '')}</td></tr>`)
              .join('')
          : `<tr><td colspan="${cmp ? 6 : 5}" class="muted">Empty. Crawl the pages to fill it.</td></tr>`
      }</tbody>
    </table></div>
    ${!cmp && (quarantined.length || held.length) ? `<div class="sc-side-lists">${quarantined.length ? `<div class="sc-q"><b>⛔ Quarantined pages</b> (not in the database)<ul>${quarantined.map(({ w }) => `<li>${esc(host(w.screen.url))}: ${esc(w.title)}</li>`).join('')}</ul></div>` : ''}${held.length ? `<div class="sc-h"><b>✋ Held for review</b><ul>${held.map(({ w }) => `<li>${esc(host(w.screen.url))}: ${esc(w.title)}</li>`).join('')}</ul></div>` : ''}</div>` : ''}
    ${m === 'off' && stored.some((x) => x.row.kind === 'poisoned') ? '<p class="sc-warn">☠ Rows in red were written by instructions hidden in web pages. Nothing marks them as different: analysts will trust them like any other record.</p>' : ''}
  </section>`;
}

// Later, an analyst searches the database. Planted records now look like facts.
function drawSearch(rows, m) {
  const recs = rows.filter((x) => ['ok', 'clean', 'risky', 'poisoned'].includes(x.row.kind));
  const vendors = recs
    .filter((x) => /cyber|cloud/i.test(x.row.rec.Type || '') && !/debarred/i.test(x.row.rec.Flags || ''))
    .sort((a, b) => (/TOP RECOMMENDED/.test(b.row.rec.Flags || '') ? 1 : 0) - (/TOP RECOMMENDED/.test(a.row.rec.Flags || '') ? 1 : 0));
  const excluded = recs.filter((x) => /debarred/i.test(x.row.rec.Flags || ''));
  const malicious = recs.find((x) => /hxxp:\/\//.test(x.row.rec.Summary || ''));
  const leak = recs.find((x) => x.row.leak);
  const quarantined = rows.filter((x) => x.row.kind === 'quarantine');
  const held = rows.filter((x) => x.row.kind === 'held');
  return `<section class="sc-search ${m}">
    <div class="ss-q"><span>🔎 Two weeks later, ${esc(ctx.app.person.name.split(' ')[0])} searches the database:</span><b>“${esc(ctx.app.question)}”</b></div>
    <ol class="ss-results">${vendors.map(({ row }) => `<li class="${/TOP RECOMMENDED/.test(row.rec.Flags || '') ? 'planted' : ''}"><b>${esc(row.rec.Company)}</b> · ${esc(row.rec['Past performance'] || '')}<small>${mark(row.rec.Summary || '')}</small></li>`).join('')}</ol>
    <ul class="ss-notes">
      ${excluded.map(({ row }) => `<li class="bad">Excluded: <b>${esc(row.rec.Company)}</b>, marked “debarred”. It isn’t; it won its protest.</li>`).join('')}
      ${vendors.some(({ row }) => /TOP RECOMMENDED/.test(row.rec.Flags || '')) ? '<li class="bad">The top result is a company with no cyber past performance. Its own web page told the AI to say otherwise.</li>' : ''}
      ${malicious ? '<li class="bad">A summary now tells analysts to download a “capability statement”: a malware link planted in a forum post.</li>' : ''}
      ${leak ? '<li class="bad">The crawler also sent its database connection details to an outside address.</li>' : ''}
      ${quarantined.length ? `<li class="good">${quarantined.length} pages that tried to instruct the AI never reached the database.</li>` : ''}
      ${held.length ? `<li class="good">${held.map(({ w }) => esc(w.title)).join(', ')}: held for a person, not recorded as fact.</li>` : ''}
    </ul>
  </section>`;
}

function wire() {
  const el = ctx.el;
  el.querySelector('#crawlGo')?.addEventListener('click', crawl);
  el.querySelectorAll('[data-page]').forEach(
    (b) =>
      (b.onclick = () => {
        s.current = b.dataset.page;
        s.showHidden = false;
        draw();
      }),
  );
  el.querySelector('#scReveal')?.addEventListener('click', () => {
    s.showHidden = !s.showHidden;
    draw();
  });
  el.querySelectorAll('[data-trace]').forEach((a) => (a.onclick = (e) => (e.preventDefault(), showTrace(a.dataset.trace))));
}

// One page at a time, so the browser view follows the crawler (both ways at once in Compare).
async function crawl() {
  if (s.running) return;
  const modes = ctx.isCompare?.() ? ['on', 'off'] : [mode()];
  for (const m of modes) s.runs[m] = { results: {}, finished: false };
  s.running = true;
  for (const wf of pages()) {
    s.current = wf.id;
    s.showHidden = Boolean(wf.screen.hidden);
    await Promise.all(
      modes.map(async (m) => {
        const r = (s.runs[m].results[wf.id] = { trace: { status: 'running' } });
        draw();
        try {
          await runStep(ctx.app.id, wf.id, m === 'on', (tr) => ((r.trace = tr), draw()));
        } catch (err) {
          r.error = err.message;
        }
      }),
    );
    draw();
    await sleep(ctx.paceMs());
  }
  for (const m of modes) s.runs[m].finished = true;
  s.running = false;
  draw();
}
