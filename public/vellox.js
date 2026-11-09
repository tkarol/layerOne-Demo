// Vellox: the suite overview page, shown first in the product switch. A short
// deck on the suite as a whole, and an architecture view of how the four
// products' work connects. Each product has its own page for the deep dive.
//
// Product facts come from Booz Allen's Vellox announcements (RSAC 2026 launch,
// July 2026 update) and each product's page in this demo; statuses are as of
// those announcements. The products are separate today: they don't exchange
// data with each other, so nothing here shows one product feeding another.
import { createDeck, icon, $, esc } from './deck-core.js';
import { loadTailoring, tailorButton, openTailor } from './tailor.js';
import { eventSlides } from './vellox-event.js';
import { setT as setReverserT } from './reverser-slides.js';
import { setT as setRangerT } from './ranger-slides.js';
import { setT as setNavigatorT } from './navigator-slides.js';

let T = { p: {} };
const tx = (k, fallback) => (T.p[k] ? esc(T.p[k]) : fallback);
const prepared = (ctx) => `${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}`;

// Products share the brand color (Booz Allen, or the customer's); icons and names tell them apart.
const STATUS = { ga: 'Generally available', preview: 'Limited preview', soon: 'Coming soon' };
const PRODUCTS = [
  { k: 'reverser', name: 'Reverser', role: 'Understand the threat', does: 'AI agents take malware apart and explain it, in minutes.', pain: 'Malware piles up faster than experts can reverse it', status: 'ga', href: 'reverser.html', rgb: 'var(--brand-rgb)', icon: 'bug' },
  { k: 'ranger', name: 'Ranger', role: 'Detect it where it matters', does: 'Detections written for your environment and ranked by real attack paths.', pain: 'Generic detections miss what matters in your network', status: 'ga', href: 'ranger.html', rgb: 'var(--brand-rgb)', icon: 'radar' },
  { k: 'navigator', name: 'Navigator', role: 'Prove you’re compliant', does: 'Evidence collected and mapped to controls, so the package stays current.', pain: 'Compliance paperwork is out of date the day it’s signed', status: 'ga', href: 'navigator.html', rgb: 'var(--brand-rgb)', icon: 'target' },
  { k: 'layerone', name: 'LayerOne', role: 'Govern your AI', does: 'Every AI request checked, governed and logged before it reaches a model.', pain: 'AI agents are going into production without guardrails', status: 'preview', href: './#overview', rgb: 'var(--brand-rgb)', icon: 'shield' },
];
const P = Object.fromEntries(PRODUCTS.map((p) => [p.k, p]));
const chip = (p) => `<span class="vx-status ${p.status}">${STATUS[p.status]}</span>`;

// Title slide: the four products around a Vellox core (no lines between them:
// they're separate products).
const SAT_ANGLE = [-50, 40, 130, 220];
const satPos = (i) => [50 + 36 * Math.cos((SAT_ANGLE[i] * Math.PI) / 180), 50 + 36 * Math.sin((SAT_ANGLE[i] * Math.PI) / 180)].map((n) => n.toFixed(1));

const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <img class="d-bah" src="brand/logo.svg" alt="Booz Allen" />
        <h1 class="d-logo" data-p="vellox"><img src="brand/vellox.svg" alt="Vellox, Agentic Cyber Product Suite" /></h1>
        <p class="d-lead">${tx('lead', 'AI-native cyber defense, <span>built on adversary tradecraft.</span>')}</p>
        ${prepared(ctx)}
      </div>
      <div class="vx-const" aria-hidden="true">
        <div class="vx-ring"></div><div class="vx-ring b"></div>
        <div class="vx-core"><span>V</span></div>
        ${PRODUCTS.map((p, i) => `<span class="vx-sat" style="--c:${p.rgb};--i:${i};left:${satPos(i)[0]}%;top:${satPos(i)[1]}%"><i>${icon(p.icon)}</i><b>${p.name}</b></span>`).join('')}
      </div>`,
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
          <h3>${icon('alert')}The gap is growing</h3>
          <div class="vx-gap">
            <svg viewBox="0 0 100 58" aria-hidden="true">
              <path class="vx-gap-fill" d="M2,50 C40,47 62,30 98,6 L98,40 C70,43 40,47 2,50 Z"/>
              <path class="vx-gap-l atk" pathLength="1" d="M2,50 C40,47 62,30 98,6"/>
              <path class="vx-gap-l def" pathLength="1" d="M2,50 C40,47 70,43 98,40"/>
            </svg>
            <span class="vx-gap-t atk">Attackers, with AI</span>
            <span class="vx-gap-t def">Defenders, today</span>
            <span class="vx-gap-x">the gap</span>
          </div>
          <div class="vx-tags"><span>${icon('zap')}Faster</span><span>${icon('layers')}More</span><span>${icon('sparkle')}Newer</span></div>
        </section>
        <div class="vx-vs" aria-hidden="true">vs</div>
        <section class="vx-side def">
          <h3>${icon('users')}Where defenders fall behind</h3>
          ${PRODUCTS.map((p, i) => `<div class="vx-pain" style="--c:${p.rgb};--i:${i}"><span class="vx-pain-t">${p.pain}</span><span class="vx-pain-p">${icon(p.icon)}${p.name}</span></div>`).join('')}
        </section>
      </div>`,
    talk: {
      key: 'AI made attacking cheaper and faster. Defense still runs on a handful of experts and manual processes.',
      points: [
        '<b>Left side:</b> the chart is a picture, not data: attacker capability is climbing with AI while defense grows slowly. Attackers are using frontier AI to move faster, produce more variants, and try new techniques. Public 2025 threat reports from AI labs and threat intelligence teams describe this; pull the one you’ll cite before the meeting.',
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
        '<b>Navigator</b> (generally available): collects evidence, maps it to controls and keeps the authorization package current.',
        '<b>LayerOne</b> (limited preview): a governance gateway for AI agents. Every request is checked against policy and logged before it reaches a model.',
        '<b>Check status before the meeting:</b> availability changes; confirm with the Vellox team.',
      ],
      ask: 'Do you already have something in place for any of these four?',
      next: 'They’re separate products today. Here’s what each one does when a new threat lands.',
    },
  },
  {
    id: 'together',
    title: 'When a new threat lands',
    html: () => `
      <div class="vx-par">
        <div class="vx-par-row">
          <div class="vx-threat"><span class="vx-flow-ic">${icon('alert')}</span><b>New malware lands</b><small>A phishing email delivers a sample nobody has seen before</small></div>
          <svg class="vx-wire fork" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,50 C55,50 45,22 100,22"/><path d="M0,50 C55,50 45,78 100,78"/></svg>
          <div class="vx-pair">
            <span class="vx-same">At the same time</span>
            ${[
              ['ranger', 'Ranger spots it', 'Detections tuned to your network flag it on the systems that matter', 'Detected'],
              ['reverser', 'Reverser takes it apart', 'What it does, its indicators and behaviors, in minutes', 'Explained'],
            ]
              .map(([k, t, d, done]) => `<div class="vx-act" style="--c:${P[k].rgb}"><span class="vx-flow-ic">${icon(P[k].icon)}</span><span class="vx-act-t"><b>${t}</b><small>${d}</small></span><span class="vx-act-bar"><i></i></span><em>${icon('check')}${done}</em></div>`)
              .join('')}
          </div>
          <svg class="vx-wire join" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0,22 C55,22 45,50 100,50"/><path d="M0,78 C55,78 45,50 100,50"/></svg>
          <div class="vx-threat you"><span class="vx-flow-ic">${icon('users')}</span><b>Your analysts decide</b><small>Contain, hunt and tune, with both answers in hand</small></div>
        </div>
        <div class="vx-bands">
          ${[
            ['navigator', 'Navigator keeps compliance current', 'Evidence collected and mapped to your controls'],
            ['layerone', 'LayerOne governs your AI', 'Every request your AI agents make, checked and logged'],
          ]
            .map(([k, t, d], i) => `<div class="vx-band" style="--c:${P[k].rgb};--i:${i}"><span class="vx-flow-ic">${icon(P[k].icon)}</span><span><b>${t}</b><small>${d}</small></span><em>Always on</em></div>`)
            .join('')}
        </div>
        <p class="vx-par-note">Each product runs on its own today: start with one, add the others when you’re ready.</p>
      </div>`,
    talk: {
      key: 'When a new threat lands, Ranger and Reverser go to work at the same time; Navigator and LayerOne are always on in the background.',
      points: [
        '<b>Let it play, then narrate:</b> a new piece of malware arrives. Ranger’s detections, tuned to their network, flag it on the systems that matter. At the same time, Reverser takes the sample apart and explains what it does, its indicators and behaviors.',
        '<b>People make the call:</b> their analysts decide what to do with both answers in hand: contain, hunt for more, tune detections.',
        '<b>Always on:</b> Navigator keeps their compliance evidence current, and LayerOne governs the AI agents their teams use, checking and logging every request.',
        '<b>Be precise:</b> the products are separate today and don’t pass data to each other. Don’t promise integrations; check the roadmap with the Vellox team.',
      ],
      ask: 'Today, when a new sample shows up, how long until you know what it does, and whether it’s already in your network?',
      objection: '“Do they work together?” Today they’re separate products, each useful on its own. That’s also why it’s easy to start with just one.',
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
// The products are separate today, so each one connects to your environment only.
const EDGES = [];
const SPOKES = { reverser: 'Suspicious files', ranger: 'Telemetry & existing rules', navigator: 'Evidence from your systems', layerone: 'Every AI request' };
const STORY = [
  { lit: ['env'], text: 'A phishing email delivers a piece of malware nobody has seen before.' },
  { lit: ['ranger', 'spoke-ranger', 'reverser', 'spoke-reverser'], text: 'At the same time, Ranger’s detections flag it on the systems that matter, and Reverser takes the sample apart to explain what it does.' },
  { lit: ['env'], text: 'Your analysts decide what to do, with both answers in hand: contain, hunt, tune.' },
  { lit: ['navigator', 'spoke-navigator'], text: 'All along, Navigator keeps your compliance evidence current, mapped to your controls.' },
  { lit: ['layerone', 'spoke-layerone'], text: 'And LayerOne governs the AI agents your teams use, checking and logging every request.' },
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
      <div><h2>The suite around your environment</h2><p class="muted">Four products around your environment, each working on its own today. Click one, or follow a threat.</p></div>
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
      <p class="muted small">Product descriptions and statuses come from Booz Allen’s Vellox announcements. The products are separate today and don’t exchange data with each other; confirm the roadmap, availability and deployment options with the Vellox team.</p></details>`;
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

// The official six, plus the event story's add-on slides (vellox-event.js), which only
// show in decks that include them.
const ALL_SLIDES = [...SLIDES, ...eventSlides({ P, chip, tx })];

const deck = createDeck({
  slides: ALL_SLIDES,
  label: 'Vellox',
  storageKey: 'vx',
  // The borrowed product slides follow the customer's details for their own product too.
  context: async () => {
    const [v, rv, rg, nv] = await Promise.all(['vellox', 'reverser', 'ranger', 'navigator'].map((k) => loadTailoring(k)));
    setReverserT(rv);
    setRangerT(rg);
    setNavigatorT(nv);
    return (T = v);
  },
  onGoto: () => setView('architecture'),
});

const TAILOR_FIELDS = [
  { k: 'lead', label: 'Title slide tagline', where: 'slide 1', placeholder: 'AI-native cyber defense, built on adversary tradecraft.', full: true },
  { k: 'next', label: 'Next step', where: 'last slide', placeholder: 'pick the bottleneck that hurts most, and pilot that product on your own data.', full: true },
  { k: 'booth', label: 'Booth or room', where: 'event slides: welcome and closing', placeholder: 'Booth #1234' },
  { k: 'cta', label: 'Closing line', where: 'event slides: closing', placeholder: 'boozallen.com/expertise/products/vellox', full: true },
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
