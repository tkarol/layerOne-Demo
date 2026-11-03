// Vellox: the suite overview page, shown first in the product switch. A short
// deck on the suite as a whole, and an architecture view of how the four
// products' work connects. Each product has its own page for the deep dive.
//
// Product facts come from Booz Allen's Vellox announcements (RSAC 2026 launch,
// July 2026 update) and each product's page in this demo; statuses are as of
// those announcements. The "how the work connects" story is a way to explain
// the suite, not a list of product integrations; the talking points say so.
import { createDeck, icon, $, esc } from './deck-core.js';
import { loadTailoring, tailorButton, openTailor } from './tailor.js';

let T = { p: {} };
const tx = (k, fallback) => (T.p[k] ? esc(T.p[k]) : fallback);
const prepared = (ctx) => `${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}`;

const STATUS = { ga: 'Generally available', preview: 'Limited preview', soon: 'Coming soon' };
const PRODUCTS = [
  { k: 'reverser', name: 'Reverser', role: 'Understand the threat', does: 'AI agents take malware apart and explain it, in minutes.', pain: 'Malware piles up faster than experts can reverse it', status: 'ga', href: 'reverser.html', rgb: '34 211 238', icon: 'bug' },
  { k: 'ranger', name: 'Ranger', role: 'Detect it where it matters', does: 'Detections written for your environment and ranked by real attack paths.', pain: 'Generic detections miss what matters in your network', status: 'ga', href: 'ranger.html', rgb: '167 139 250', icon: 'radar' },
  { k: 'navigator', name: 'Navigator', role: 'Prove you’re compliant', does: 'Evidence collected and mapped to controls, so the package stays current.', pain: 'Compliance paperwork is out of date the day it’s signed', status: 'soon', href: 'navigator.html', rgb: '96 165 250', icon: 'target' },
  { k: 'layerone', name: 'LayerOne', role: 'Govern your AI', does: 'Every AI request checked, governed and logged before it reaches a model.', pain: 'AI agents are going into production without guardrails', status: 'preview', href: './#overview', rgb: '74 222 128', icon: 'shield' },
];
const P = Object.fromEntries(PRODUCTS.map((p) => [p.k, p]));
const chip = (p) => `<span class="vx-status ${p.status}">${STATUS[p.status]}</span>`;

// Slide 4: one threat, followed through the suite. Keyframes are generated so each
// step lights up in turn and the whole thing loops.
const FLOW = [
  [null, 'alert', 'New malware lands', 'A phishing email delivers a sample nobody has seen before'],
  ['reverser', 'bug', 'Reverser explains it', 'What it does, its indicators and behaviors, in minutes'],
  ['ranger', 'radar', 'Ranger detects it', 'Detections tuned to your network, guarding the systems that matter'],
  ['navigator', 'target', 'Navigator records it', 'The new coverage becomes evidence against your controls'],
  ['layerone', 'shield', 'LayerOne governs the AI', 'The AI agents your teams use stay checked and logged'],
];
const LOOP_S = 20;
const RUN = 80; // % of the loop spent lighting the steps
const stepAt = (i) => +((i / (FLOW.length - 1)) * (RUN - 8) + 4).toFixed(2);
const flowKeyframes = FLOW.map((_, i) => `@keyframes vx-st${i} { 0%, ${Math.max(stepAt(i) - 0.5, 0)}% { opacity: .35; transform: none; } ${stepAt(i)}% { opacity: 1; transform: translateY(-0.4cqw); } ${stepAt(i) + 3}%, 93% { opacity: 1; transform: none; } 98%, 100% { opacity: .35; } }`).join('\n');

const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>Booz Allen</div>
        <h1>Vellox</h1>
        <p class="d-lead">${tx('lead', 'AI-native cyber defense, <span>built on adversary tradecraft.</span>')}</p>
        ${prepared(ctx)}
      </div>
      <div class="d-orbit vx-orbit" aria-hidden="true"><div>${PRODUCTS.slice(0, 2).map((p, i) => `<i class="orb-dot vx-od ${i ? 'b' : ''}" style="--c:${p.rgb}"></i>`).join('')}</div><div>${PRODUCTS.slice(2).map((p, i) => `<i class="orb-dot vx-od ${i ? 'b' : ''}" style="--c:${p.rgb}"></i>`).join('')}</div><div></div></div>`,
    talk: {
      key: 'Vellox is Booz Allen’s suite of AI-native cyber products: human operators and AI agents working together, built from how real adversaries operate.',
      points: [
        'Open with their world: “Where is your team falling behind today: the malware, the detections, the compliance paperwork, or the AI your own people are adopting?”',
        'Vellox in one sentence: four products that use AI agents to do the slow, specialized parts of cyber defense at machine speed, with people making the calls.',
        'This deck is the map. Each product has its own page for the deep dive; use the switch in the top right.',
      ],
      ask: 'Which of those four areas would you fix first if you could?',
      next: 'First, why now.',
    },
  },
  {
    id: 'shift',
    title: 'AI changed both sides',
    html: () => `
      <div class="vx-shift">
        <section class="vx-side atk">
          <h3>${icon('alert')}Attackers, with AI</h3>
          <div class="rv-drv">${icon('zap')}<span><b>Faster</b><small>From idea to working attack in less time</small></span></div>
          <div class="rv-drv">${icon('layers')}<span><b>More</b><small>New and modified malware at higher volume</small></span></div>
          <div class="rv-drv">${icon('sparkle')}<span><b>Newer</b><small>Frontier AI helps write and mutate code</small></span></div>
        </section>
        <div class="vx-vs" aria-hidden="true">vs</div>
        <section class="vx-side def">
          <h3>${icon('users')}Defenders, today</h3>
          ${PRODUCTS.map((p, i) => `<div class="vx-pain" style="--c:${p.rgb};--i:${i}"><span class="vx-pain-t">${p.pain}</span><span class="vx-pain-p">${icon(p.icon)}${p.name}</span></div>`).join('')}
        </section>
      </div>`,
    talk: {
      key: 'AI made attacking cheaper and faster. Defense still runs on a handful of experts and manual processes.',
      points: [
        '<b>Left side:</b> attackers are using frontier AI to move faster, produce more variants, and try new techniques. Public 2025 threat reports from AI labs and threat intelligence teams describe this; pull the one you’ll cite before the meeting.',
        '<b>Right side, four bottlenecks:</b> malware analysis, detections that fit your environment, compliance that keeps up, and governing the AI your own organization is adopting. Watch each one get matched to a Vellox product.',
        '<b>Let them pick:</b> ask which bottleneck is theirs. That tells you which product page to go to next.',
      ],
      ask: 'Which of these four is costing your team the most today?',
      objection: '“Isn’t this AI hype?” Use their own numbers instead: malware backlog, alert noise, hours spent on authorization packages, AI tools in use without review.',
      next: 'Here’s the suite that answers those four.',
    },
  },
  {
    id: 'suite',
    title: 'Four products, one mission',
    html: () => `
      <div class="vx-suite">
        ${PRODUCTS.map((p, i) => `<div class="vx-card" style="--c:${p.rgb};--i:${i}"><span class="vx-ic">${icon(p.icon)}</span><b>${p.name}</b><span class="vx-role">${p.role}</span><p>${p.does}</p>${chip(p)}</div>`).join('')}
        <div class="vx-hub"><b>Vellox</b><span>Human operators<br />+ AI agents</span></div>
      </div>`,
    talk: {
      key: 'Four products, each aimed at one bottleneck, all built the same way: AI agents do the volume, people make the decisions.',
      points: [
        '<b>Reverser</b> (generally available): AI agents reverse engineer malware and produce detections, indicators and reports in minutes instead of days or weeks (vendor-reported). Add-ons Reverser Flash and Reverser Jailbreak are coming.',
        '<b>Ranger</b> (generally available): models their environment, finds the paths an attacker would take, and writes detections ranked for those paths.',
        '<b>Navigator</b> (coming soon): collects evidence, maps it to controls and keeps the authorization package current.',
        '<b>LayerOne</b> (limited preview): a governance gateway for AI agents. Every request is checked against policy and logged before it reaches a model.',
        '<b>Check status before the meeting:</b> availability changes; confirm with the Vellox team.',
      ],
      ask: 'Do you already have something in place for any of these four?',
      next: 'They’re separate products, but the work connects. Let’s follow one threat.',
    },
  },
  {
    id: 'together',
    title: 'Follow one threat through the suite',
    html: () => `
      <style>${flowKeyframes}</style>
      <ol class="vx-flow">
        ${FLOW.map(([k, ic, t, d], i) => `<li style="--c:${k ? P[k].rgb : '248 113 113'};animation-name:vx-st${i};animation-duration:${LOOP_S}s">
          <span class="vx-flow-ic">${icon(ic)}</span><b>${t}</b><small>${d}</small>${k ? `<em>${P[k].name}</em>` : '<em class="t">The threat</em>'}</li>`).join('')}
      </ol>
      <div class="vx-flow-rail" aria-hidden="true"><i style="animation-duration:${LOOP_S}s"></i></div>`,
    talk: {
      key: 'Each product is useful on its own; together they cover a threat from first sighting to proof of compliance.',
      points: [
        '<b>Let it play once, then narrate:</b> a new piece of malware arrives. Reverser explains what it does and pulls out its indicators and behaviors. Ranger turns that into detections tuned to their network. Navigator records the new coverage as evidence against their controls.',
        '<b>LayerOne is the thread under all of it:</b> as their teams put AI agents to work, LayerOne checks and logs every request, so the AI is governed too.',
        '<b>Be precise:</b> this shows how the work connects, not a list of built-in integrations. Confirm which integrations exist with the Vellox team before promising any.',
      ],
      ask: 'Today, how long does it take from a new sample to detections deployed, and does that show up in your compliance record?',
      next: 'Why Booz Allen built it this way.',
    },
  },
  {
    id: 'why',
    title: 'Built on adversary tradecraft',
    html: () => `
      <div class="rv-bigs">
        <div class="rv-big"><span class="d-ic">${icon('target')}</span><b>From the attacker’s side</b><p>Built from how real adversaries operate, so the defense anticipates the offense.</p></div>
        <div class="rv-big"><span class="d-ic">${icon('users')}</span><b>Humans make the calls</b><p>AI agents do the volume; your analysts review and approve what matters.</p></div>
        <div class="rv-big"><span class="d-ic">${icon('landmark')}</span><b>Mission-grade</b><p>Designed for government and critical-mission environments, with evidence you can defend.</p></div>
      </div>
      <div class="rv-next">${icon('arrow')}<span>Each product page goes deeper: slides, architecture and live demos.</span></div>`,
    talk: {
      key: 'Vellox comes from Booz Allen’s cyber mission work: the people who think like attackers built the defense.',
      points: [
        '<b>Adversary tradecraft:</b> Booz Allen describes Vellox as built on adversary tradecraft. The products start from how attackers actually work: the paths they take, the code they write.',
        '<b>Human + AI:</b> none of these products take people out of the loop. Detections go through review, compliance changes need approval, AI requests are governed.',
        '<b>Mission-grade:</b> built for the environments Booz Allen serves. Deployment details (environment, data handling, classification level) go to the Vellox team; don’t guess.',
      ],
      ask: 'What would your team need to see to trust AI agents doing this work?',
      next: 'So where should they start?',
    },
  },
  {
    id: 'start',
    title: 'Start where it hurts most',
    html: () => `
      <div class="vx-start">
        ${PRODUCTS.map((p, i) => `<a class="vx-go" href="${p.href}" style="--c:${p.rgb};--i:${i}"><span class="vx-go-pain">${p.pain}</span><span class="vx-go-arrow">${icon('arrow')}</span><span class="vx-go-prod">${icon(p.icon)}<b>${p.name}</b>${chip(p)}</span></a>`).join('')}
      </div>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> ${tx('next', 'pick the bottleneck that hurts most, and pilot that product on your own data.')}</span></div>`,
    talk: {
      key: 'Don’t sell four products at once. Find the one bottleneck that hurts most and start there.',
      points: [
        '<b>Each row is clickable:</b> it opens that product’s page, so you can go straight into the deep dive from here.',
        '<b>Qualify, don’t pitch all four:</b> the right first product is the one tied to a pain they already feel and can measure.',
        '<b>Close on a pilot</b> with their own data: their samples for Reverser, their environment for Ranger, one of their systems for Navigator, one AI app for LayerOne.',
      ],
      ask: 'If we ran a pilot next month, which of these would you want proof on first?',
      next: 'Open the Architecture tab to see how the suite fits together, or jump to a product page.',
    },
  },
];

// ---------- architecture: how the suite fits together ----------
// The four products around the customer's environment, with how their work
// connects. Click a product, or follow one threat through the suite.
const NODE_POS = { reverser: [17, 20], ranger: [83, 20], navigator: [83, 80], layerone: [17, 80] };
const EDGES = [
  ['reverser', 'ranger', 'Indicators · YARA · behaviors'],
  ['ranger', 'navigator', 'Detection coverage as evidence'],
  ['layerone', 'navigator', 'AI audit records'],
];
const SPOKES = { reverser: 'Suspicious files', ranger: 'Telemetry & existing rules', navigator: 'Evidence from your systems', layerone: 'Every AI request' };
const STORY = [
  { lit: ['env'], text: 'A phishing email delivers a piece of malware nobody has seen before.' },
  { lit: ['reverser', 'spoke-reverser'], text: 'Reverser takes the sample apart and explains what it does, in minutes.' },
  { lit: ['ranger', 'edge-reverser-ranger'], text: 'Its indicators and behaviors feed Ranger, which writes detections tuned to your network.' },
  { lit: ['navigator', 'edge-ranger-navigator'], text: 'The new detection coverage becomes evidence in Navigator, mapped to your controls.' },
  { lit: ['layerone', 'spoke-layerone', 'edge-layerone-navigator'], text: 'Throughout, LayerOne governs the AI agents your teams use, and its audit records feed the same compliance picture.' },
];
const STEP_MS = 5000;

const SOURCES = [
  ['Booz Allen: “Booz Allen Launches Agentic Cyber Product Suite at RSAC 2026”', 'https://investors.boozallen.com/news-releases/news-release-details/booz-allen-launches-agentic-cyber-product-suite-rsac-2026'],
  ['Booz Allen: “Booz Allen Expands Mission-Grade Cyber Defense Product Suite” (July 2026)', 'https://investors.boozallen.com/news-releases/news-release-details/booz-allen-expands-mission-grade-cyber-defense-product-suite'],
  ['Security Boulevard: Booz Allen Rolls Out Vellox, a Five-Product AI Cyber Suite Built on Adversary Tradecraft', 'https://securityboulevard.com/2026/03/booz-allen-rolls-out-vellox-a-five-product-ai-cyber-suite-built-on-adversary-tradecraft-2/'],
  ['Booz Allen: Vellox product suite', 'https://www.boozallen.com/expertise/products/vellox.html'],
];

const st = { sel: 'reverser', step: -1, playing: false, timer: null };
let archEl;

function drawArch(el) {
  archEl = el;
  const pos = (k) => NODE_POS[k];
  const edgeSvg = EDGES.map(([a, b]) => `<line class="vx-e" data-e="edge-${a}-${b}" x1="${pos(a)[0]}" y1="${pos(a)[1]}" x2="${pos(b)[0]}" y2="${pos(b)[1]}"/>`).join('');
  const spokeSvg = PRODUCTS.map((p) => `<line class="vx-e spoke" data-e="spoke-${p.k}" x1="${pos(p.k)[0]}" y1="${pos(p.k)[1]}" x2="50" y2="50"/>`).join('');
  const edgeLabels = EDGES.map(([a, b, t]) => `<span class="vx-el" data-e="edge-${a}-${b}" style="left:${(pos(a)[0] + pos(b)[0]) / 2}%;top:${(pos(a)[1] + pos(b)[1]) / 2}%">${t}</span>`).join('');
  const spokeLabels = PRODUCTS.map((p) => `<span class="vx-el spoke" data-e="spoke-${p.k}" style="left:${(pos(p.k)[0] + 50) / 2}%;top:${(pos(p.k)[1] + 50) / 2}%">${SPOKES[p.k]}</span>`).join('');
  el.innerHTML = `
    <div class="xa-head">
      <div><h2>How the suite fits together</h2><p class="muted">Four products around your environment. Click one, or follow a threat through the suite.</p></div>
      <div class="nv2-modes vx-modes">
        <button type="button" id="vxExplore">${icon('search')}Explore</button>
        <button type="button" id="vxPlay">${icon('alert')}Follow one threat</button>
      </div>
    </div>
    <div class="vx-cap" id="vxCap" aria-live="polite"></div>
    <div class="vx-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${spokeSvg}${edgeSvg}</svg>
      ${spokeLabels}${edgeLabels}
      <div class="vx-env" data-n="env">${icon('globe')}<b>Your environment</b><span>Networks · cloud · endpoints · apps · AI agents</span></div>
      ${PRODUCTS.map((p) => `<button type="button" class="vx-node" data-n="${p.k}" style="--c:${p.rgb};left:${pos(p.k)[0]}%;top:${pos(p.k)[1]}%"><span class="vx-ic">${icon(p.icon)}</span><span class="vx-node-t"><b>${p.name}</b><small>${p.role}</small></span>${chip(p)}</button>`).join('')}
    </div>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Product descriptions and statuses come from Booz Allen’s Vellox announcements. The connections show how the work relates across the suite, not a list of built-in integrations; confirm integrations, availability and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('.vx-node').forEach(
    (b) =>
      (b.onclick = () => {
        stop();
        st.sel = b.dataset.n;
        paint();
      }),
  );
  el.querySelector('#vxExplore').onclick = () => (stop(), paint());
  el.querySelector('#vxPlay').onclick = () => (st.step >= 0 && st.playing ? pause() : start());
  paint();
}

function paint() {
  const el = archEl;
  if (!el) return;
  const s = st.step >= 0 ? STORY[st.step] : null;
  // In explore mode, light the selected product and everything it connects to.
  const lit = new Set(s ? s.lit : [st.sel, `spoke-${st.sel}`, ...EDGES.filter(([a, b]) => a === st.sel || b === st.sel).flatMap(([a, b]) => [`edge-${a}-${b}`, a, b])]);
  const done = new Set(s ? STORY.slice(0, st.step).flatMap((x) => x.lit) : []);
  el.querySelector('.vx-map').classList.toggle('playing', !!s);
  el.querySelectorAll('[data-n]').forEach((n) => {
    n.classList.toggle('lit', lit.has(n.dataset.n));
    n.classList.toggle('done', !lit.has(n.dataset.n) && done.has(n.dataset.n));
    n.classList.toggle('sel', !s && n.dataset.n === st.sel);
  });
  el.querySelectorAll('[data-e]').forEach((e) => {
    e.classList.toggle('lit', lit.has(e.dataset.e));
    e.classList.toggle('done', !lit.has(e.dataset.e) && done.has(e.dataset.e));
  });
  el.querySelector('#vxExplore').classList.toggle('on', !s);
  const play = el.querySelector('#vxPlay');
  play.classList.toggle('on', !!s);
  play.innerHTML = !s ? `${icon('alert')}Follow one threat` : st.playing ? '❚❚ Pause' : st.step === STORY.length - 1 ? '↻ Again' : '▶ Resume';
  const cap = el.querySelector('#vxCap');
  if (!s) {
    const p = P[st.sel];
    const links = EDGES.filter(([a, b]) => a === p.k || b === p.k).map(([a, b, t]) => `<li>${a === p.k ? `→ ${P[b].name}` : `← ${P[a].name}`}: ${esc(t)}</li>`).join('');
    cap.innerHTML = `<div class="vx-info" style="--c:${p.rgb}"><span class="vx-ic">${icon(p.icon)}</span><div><div class="vx-info-h"><b>${p.name}</b>${chip(p)}<span class="muted">${p.role}</span></div><p>${p.does}</p>${links ? `<ul>${links}</ul>` : ''}</div><a class="vx-open" href="${p.href}">Open ${p.name} ${icon('arrow')}</a></div>`;
    return;
  }
  cap.innerHTML = `
    <div class="nv2-story">
      <div class="nv2-story-top"><span class="nv2-step-n">Step ${st.step + 1} of ${STORY.length}</span>
        <span class="nv2-ctrl"><button type="button" data-go="-1" aria-label="Previous step" ${st.step === 0 ? 'disabled' : ''}>‹</button><button type="button" data-go="1" aria-label="Next step" ${st.step === STORY.length - 1 ? 'disabled' : ''}>›</button></span></div>
      <p>${esc(s.text)}</p>
      <div class="nv2-dots">${STORY.map((_, i) => `<i class="${i < st.step ? 'done' : i === st.step ? 'on' : ''}" ${i === st.step && st.playing ? `style="--ms:${STEP_MS}ms"` : ''}></i>`).join('')}</div>
    </div>`;
  cap.querySelectorAll('[data-go]').forEach(
    (b) =>
      (b.onclick = () => {
        pause();
        st.step = Math.max(0, Math.min(STORY.length - 1, st.step + Number(b.dataset.go)));
        paint();
      }),
  );
}

function start() {
  clearTimeout(st.timer);
  if (st.step < 0 || st.step === STORY.length - 1) st.step = 0;
  st.playing = true;
  paint();
  const tick = () => {
    if (!st.playing) return;
    if (st.step >= STORY.length - 1) return pause();
    st.step++;
    paint();
    st.timer = setTimeout(tick, STEP_MS);
  };
  st.timer = setTimeout(tick, STEP_MS);
}
function pause() {
  clearTimeout(st.timer);
  st.playing = false;
  paint();
}
function stop() {
  clearTimeout(st.timer);
  st.playing = false;
  st.step = -1;
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
  label: 'Vellox',
  storageKey: 'vx',
  context: async () => (T = await loadTailoring('vellox')),
  onGoto: () => setView('architecture'),
});

const TAILOR_FIELDS = [
  { k: 'lead', label: 'Title slide tagline', where: 'slide 1', placeholder: 'AI-native cyber defense, built on adversary tradecraft.', full: true },
  { k: 'next', label: 'Next step', where: 'last slide', placeholder: 'pick the bottleneck that hurts most, and pilot that product on your own data.', full: true },
];
async function retailor() {
  await deck.refresh();
  drawArch($('#rvArchRoot'));
  tailorButton($('#tailorBtn'), T);
}
$('#tailorBtn').onclick = () =>
  openTailor({ product: 'vellox', label: 'Vellox', fields: TAILOR_FIELDS, slides: SLIDES.map((x) => ({ id: x.id, title: x.title || 'Title slide' })), onSaved: retailor });

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
await deck.mount($('#rvDeck'));
drawArch($('#rvArchRoot'));
tailorButton($('#tailorBtn'), T);
