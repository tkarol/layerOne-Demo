// Vellox Ranger: a separate product page from LayerOne (like Vellox Reverser).
// A short pitch deck (slides + talking points) and an "under the hood"
// architecture explainer.
//
// Product facts come from Booz Allen's announcements (RSAC 2026 launch of the
// Vellox suite; Ranger generally available July 2026) and press coverage of them.
// Results such as less dwell time and fewer false positives are Booz Allen's own
// claims; the talking points say so. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';
import { loadTailoring, tailorButton, openTailor } from './tailor.js';
import { T, tx, jewel, review, hostPattern, NODES, EDGES, PATH, pts, step, SLIDES, setT } from './ranger-slides.js';

// ---------- architecture: watch Ranger build your detections ----------
// The customer's network map is the centerpiece. Six stages build on it, one
// at a time (or played in order): model → threat intel → exploitable path →
// ATT&CK techniques → ranked detections → review & deploy. Examples are made up.
const TECH = {
  mail: ['T1566', 'Phishing'],
  lap2: ['T1204', 'User execution'],
  fs: ['T1021.002', 'Admin shares'],
  dc: ['T1003', 'Credential dumping'],
  db: ['T1005', 'Data from local system'],
};
const RULES = () => [
  ['dc', 'P1', 'Credential dumping on the domain controller', 'T1003'],
  ['db', 'P1', `Unusual bulk reads from ${jewel()}`, 'T1005'],
  ['fs', 'P2', 'Admin-share access from a workstation', 'T1021.002'],
  ['lap2', 'P3', 'Office app launching a script', 'T1204'],
];
const STAGES = [
  ['model', 'monitor', 'Model your environment'],
  ['cti', 'globe', 'Add threat intelligence'],
  ['paths', 'route', 'Find exploitable paths'],
  ['attack', 'target', 'Map to MITRE ATT&CK'],
  ['detect', 'shieldPlus', 'Write & rank detections'],
  ['ship', 'gitPr', 'Review & deploy'],
];
const THREAT_NODES = new Set(['mail', 'lap1', 'lap2', 'fs']);
const STAGE_MS = 5200;

const SOURCES = [
  ['Booz Allen: Vellox Ranger product page', 'https://www.boozallen.com/expertise/products/vellox/vellox-ranger.html'],
  ['Booz Allen newsroom: “Booz Allen Expands Mission-Grade Cyber Defense Product Suite” (July 2026)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-expands-mission-grade-cyber-defense-product-suite'],
  ['Booz Allen: “Booz Allen Launches Agentic Cyber Product Suite at RSAC 2026”', 'https://investors.boozallen.com/news-releases/news-release-details/booz-allen-launches-agentic-cyber-product-suite-rsac-2026'],
  ['ExecutiveBiz: Booz Allen Adds Vellox Ranger to AI Cyber Defense Suite', 'https://www.executivebiz.com/articles/booz-allen-vellox-ranger-ai-cyber-defense'],
  ['Help Net Security: Booz Allen expands Vellox Suite with AI-driven threat detection platform', 'https://www.helpnetsecurity.com/2026/07/27/booz-allen-hamilton-vellox-ranger/'],
  ['Booz Allen: Vellox product suite', 'https://www.boozallen.com/expertise/products/vellox.html'],
];

const st = { stage: 0, playing: false, timer: null };
let archEl;

// The environment map: nodes, connections, and overlays that switch on by stage (CSS, via data-stage).
function archMap() {
  const onPath = new Set(PATH);
  const label = (id) => (id === 'db' ? esc(jewel().slice(0, 22)) : NODES[id][2]);
  const pct = (id) => [((NODES[id][0] / 580) * 100).toFixed(2), ((NODES[id][1] / 300) * 100).toFixed(2)];
  const edges = EDGES.map(([a, b]) => `<line class="${onPath.has(a) && onPath.has(b) && PATH.indexOf(b) - PATH.indexOf(a) === 1 ? 'on-path' : ''}" x1="${NODES[a][0]}" y1="${NODES[a][1]}" x2="${NODES[b][0]}" y2="${NODES[b][1]}"/>`).join('');
  const nodes = Object.entries(NODES)
    .map(([id, [x, y]], i) => `<g class="rg2-n ${onPath.has(id) ? 'path' : 'off'} ${THREAT_NODES.has(id) ? 'threat' : ''} ${id === 'db' ? 'jewel' : ''}" style="--i:${i}"><circle cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${id === 'dc' ? y - 22 : y + 32}" text-anchor="middle">${label(id)}</text></g>`)
    .join('');
  const badges = Object.entries(TECH)
    .map(([id, [t, name]], i) => {
      const [x, y] = pct(id);
      return `<span class="rg2-tech ${id === 'dc' ? 'below' : ''}" style="left:${x}%;top:${y}%;--i:${i}"><b>${t}</b>${name}</span>`;
    })
    .join('');
  const shields = RULES()
    .map(([id, p], i) => {
      const [x, y] = pct(id);
      return `<span class="rg2-shield ${p} ${id === 'dc' || id === 'db' ? 'left' : ''}" style="left:${x}%;top:${y}%;--i:${i}">${icon('shieldPlus')}<b>${p}</b></span>`;
    })
    .join('');
  const [mx, my] = pct('mail');
  return `
    <div class="rg2-map">
      <svg viewBox="0 0 580 300" aria-hidden="true">
        <g class="rg2-edges">${edges}</g>
        <path class="rg2-path" pathLength="100" d="M${pts(PATH)}"/>
        ${nodes}
      </svg>
      ${badges}${shields}
      <span class="rg2-covered" style="left:${mx}%;top:${my}%">${icon('check')}Covered</span>
      <span class="rg2-entry" style="left:${((NODES.net[0] / 580) * 100).toFixed(2)}%;top:${((NODES.net[1] / 300) * 100).toFixed(2)}%">Attacker</span>
    </div>`;
}

// What each stage adds, told in the panel on the right.
function stageBody(i) {
  const rules = RULES();
  switch (STAGES[i][0]) {
    case 'model':
      return `<p>Ranger starts from what you actually run, not a generic template.</p>
        <div class="rg2-chips"><span>Assets</span><span>Network layout</span><span>Vulnerabilities</span><span>Telemetry</span><span>Existing rules</span></div>
        <p class="rg2-stat"><b>10</b> assets · <b>13</b> connections mapped</p>`;
    case 'cti':
      return `<p>The latest threat intelligence, filtered down to what applies to you.</p>
        <ul class="rg2-intel">
          <li class="yes">${icon('check')}<span><b>Ransomware crew</b>: phishing, stolen credentials, file shares</span><em>Applies</em></li>
          <li>${icon('x')}<span><b>VPN appliance exploit</b></span><em>You don’t run it</em></li>
          <li>${icon('x')}<span><b>Mobile banking trojan</b></span><em>Not in scope</em></li>
        </ul>`;
    case 'paths':
      return `<p>Agents work out the routes an attacker could actually take.</p>
        <p class="rg2-route">${PATH.map((id) => `<span class="${id === 'db' ? 'jewel' : ''}">${id === 'db' ? esc(jewel()) : NODES[id][2]}</span>`).join('<i>→</i>')}</p>
        <p class="rg2-stat"><b>1</b> exploitable path to ${esc(jewel())} · other routes dead-end</p>`;
    case 'attack':
      return `<p>Each step on the path is tied to the MITRE ATT&amp;CK technique an attacker would use.</p>
        <ul class="rg2-techs">${Object.entries(TECH).map(([id, [t, name]]) => `<li><b>${t}</b><span>${name}</span><small>${id === 'db' ? esc(jewel()) : NODES[id][2]}</small></li>`).join('')}</ul>`;
    case 'detect':
      return `<p>Detections written for this path, ranked by what protects ${esc(jewel())} most.</p>
        <ul class="rg2-rules">${rules.map(([, p, t, tech]) => `<li><span class="rg2-p ${p}">${p}</span><span>${t}</span><small>${tech}</small></li>`).join('')}
          <li class="skip"><span class="rg2-p">✓</span><span>Phishing link clicked</span><small>Already covered by your rules · skipped</small></li></ul>`;
    case 'ship':
      return `<div class="rg2-pr">
          <div class="rg2-pr-h">${icon('gitPr')}<b>${rules.length} new detections for the ${esc(jewel())} path</b><span>${T.p.review ? review() : 'GitHub · GitLab'}</span></div>
          <pre><span class="add">+ title: Credential dumping on the domain controller</span>
<span class="add">+ technique: T1003</span>
<span class="add">+ hosts: ${esc(hostPattern())}</span>
<span class="add">+ priority: P1</span></pre>
          <div class="rg2-pr-f"><span class="rg2-approved">${icon('check')}Engineer approved</span><span class="rg2-arrow">→</span><span class="rg2-tools">${icon('shield')}${tx('tools', 'Your detection tools')}</span></div>
        </div>`;
  }
  return '';
}

function drawArch(el) {
  archEl = el;
  el.innerHTML = `
    <div class="xa-head">
      <div><h2>Watch Ranger build your detections</h2><p class="muted">Step through it, or press play. Click any stage to jump.</p></div>
      <button type="button" class="rg2-play" id="rg2Play"></button>
    </div>
    <ol class="rg2-stages">${STAGES.map(([k, ic, t], i) => `<li><button type="button" data-stage="${i}"><span class="rg2-sn">${i + 1}</span>${icon(ic)}<b>${t.replace('&', '&amp;')}</b></button></li>`).join('')}</ol>
    <div class="rg2" data-stage="0">
      <section class="rg2-left">
        <div class="rg2-map-h"><b>${icon('radar')}Your environment, as Ranger sees it</b><span class="rg2-legend"><i class="p"></i>Attack path <i class="j"></i>${esc(jewel())}</span></div>
        ${archMap()}
        <div class="rg2-fw">${icon('nodes')}<span><b>AI agents</b> on Booz Allen’s agentic AI framework do the work at every stage</span></div>
      </section>
      <section class="rg2-right">
        <ol class="rg2-story">${STAGES.map(([k, ic, t], i) => `<li data-i="${i}"><div class="rg2-sh"><span class="rg2-sn">${i + 1}</span><b>${t.replace('&', '&amp;')}</b></div><div class="rg2-sb">${stageBody(i)}</div></li>`).join('')}</ol>
      </section>
    </div>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements and press coverage. The six stages summarize the published approach (model the environment, add threat intelligence, find exploitable paths, map them to MITRE ATT&amp;CK, generate prioritized detections, review them as code in GitHub or GitLab). The network, threats, techniques and rules shown are illustrative examples. Confirm integrations and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('[data-stage]').forEach(
    (b) =>
      (b.onclick = () => {
        pause();
        st.stage = Number(b.dataset.stage);
        paint();
      }),
  );
  el.querySelectorAll('.rg2-story li').forEach(
    (li) =>
      (li.onclick = () => {
        if (Number(li.dataset.i) === st.stage) return;
        pause();
        st.stage = Number(li.dataset.i);
        paint();
      }),
  );
  el.querySelector('#rg2Play').onclick = () => (st.playing ? pause() : play());
  paint();
}

function paint() {
  const el = archEl;
  if (!el) return;
  el.querySelector('.rg2').dataset.stage = String(st.stage);
  el.querySelectorAll('.rg2-stages button').forEach((b) => {
    const i = Number(b.dataset.stage);
    b.classList.toggle('on', i === st.stage);
    b.classList.toggle('done', i < st.stage);
  });
  el.querySelectorAll('.rg2-story li').forEach((li) => {
    const i = Number(li.dataset.i);
    li.classList.toggle('on', i === st.stage);
    li.classList.toggle('done', i < st.stage);
  });
  const btn = el.querySelector('#rg2Play');
  btn.innerHTML = st.playing ? '❚❚ Pause' : st.stage === STAGES.length - 1 ? '↻ Watch again' : '▶ Watch it build';
  btn.classList.toggle('on', st.playing);
  const bar = el.querySelector('.rg2-stages');
  bar.style.setProperty('--ms', st.playing ? `${STAGE_MS}ms` : '0ms');
  bar.classList.toggle('playing', st.playing);
}

function play() {
  clearTimeout(st.timer);
  if (st.stage === STAGES.length - 1) st.stage = 0;
  st.playing = true;
  paint();
  const tick = () => {
    if (!st.playing) return;
    if (st.stage >= STAGES.length - 1) return pause();
    st.stage++;
    paint();
    st.timer = setTimeout(tick, STAGE_MS);
  };
  st.timer = setTimeout(tick, STAGE_MS);
}
function pause() {
  clearTimeout(st.timer);
  st.playing = false;
  paint();
}

// ---------- page ----------
function setView(v) {
  const view = v === 'architecture' ? 'architecture' : 'overview';
  $('#rvOverview').hidden = view !== 'overview';
  $('#rvArch').hidden = view !== 'architecture';
  if (view !== 'architecture' && st.playing) pause();
  document.querySelectorAll('.view-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  });
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
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

const deck = createDeck({
  slides: SLIDES,
  label: 'Vellox Ranger',
  storageKey: 'rg',
  context: async () => setT(await loadTailoring('ranger')),
  onGoto: () => setView('architecture'),
});

// Optional tailoring: what can be changed for a customer, and where it shows.
const TAILOR_FIELDS = [
  { k: 'lead', label: 'Title slide tagline', where: 'slide 1', placeholder: 'Detections built for your environment, not someone else’s.', full: true },
  { k: 'jewel', label: 'Their crown jewel system', where: 'slides 2, 4, 5, architecture', placeholder: 'Finance DB (e.g. Claims database)' },
  { k: 'review', label: 'Where they review rules', where: 'slide 5, architecture', options: [['', 'GitHub or GitLab'], ['github', 'GitHub'], ['gitlab', 'GitLab']] },
  { k: 'tools', label: 'Their detection tools', where: 'architecture', placeholder: 'e.g. Splunk · Microsoft Sentinel', full: true },
  { k: 'next', label: 'Next step', where: 'last slide', placeholder: 'a pilot on your environment, compared side by side with your current rules.', full: true },
];
async function retailor() {
  await deck.refresh();
  drawArch($('#rvArchRoot'));
  tailorButton($('#tailorBtn'), T);
}
$('#tailorBtn').onclick = () =>
  openTailor({ product: 'ranger', label: 'Ranger', fields: TAILOR_FIELDS, slides: SLIDES.map((x) => ({ id: x.id, title: x.title || 'Title slide' })), onSaved: retailor });

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
await deck.mount($('#rvDeck'));
drawArch($('#rvArchRoot'));
tailorButton($('#tailorBtn'), T);
