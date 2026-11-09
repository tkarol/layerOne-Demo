// Vellox Reverser: a separate product page from LayerOne. A short pitch deck
// (slides + talking points) and an interactive architecture explainer.
//
// Product facts come from Booz Allen's announcements (July 2025 launch,
// general availability) and press coverage of them; vendor-reported results are
// labeled as such. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';
import { loadTailoring, tailorButton, openTailor } from './tailor.js';
import { T, tx, FEED, FUNCS, SLIDES, setT } from './reverser-slides.js';

// ---------- Walkthrough tab: one sample through Reverser ----------
// Six stages, played in order or clicked: triage → sandbox detonation → unpack &
// disassemble → AI agents → cross-check & connect → countermeasures. One
// orchestrator agent directs 20+ subagents that cross-check each other;
// Amazon Bedrock models power every agent. The sample and events are examples.
const STAGES = [
  ['triage', 'inbox', 'Triage'],
  ['sandbox', 'monitor', 'Run it in the sandbox'],
  ['unpack', 'layers', 'Unpack & disassemble'],
  ['agents', 'nodes', 'AI agents analyze it'],
  ['check', 'check', 'Cross-check & connect'],
  ['out', 'shieldPlus', 'Countermeasures'],
];
const CAPTIONS = [
  'Reverser identifies the file: a packed Windows executable it has never seen before, so it goes to full analysis.',
  'It runs the sample in an instrumented sandbox and records everything: processes, files, registry, network. When the malware stalls or checks for a virtual machine, Reverser counters it.',
  'The real payload, unpacked in memory during the run, is pulled out and disassembled into its functions.',
  'An orchestrator agent splits the functions across 20+ specialized subagents, which analyze them in parallel. Red marks malicious code.',
  'Subagents check each other’s findings, and the sandbox run confirms the code. Code that never ran (amber) is caught too, and similar samples link it to known campaigns.',
  'Out come countermeasures: YARA rules, indicators, ATT&CK mappings and reports, ready for your tools after analyst review.',
];
const ADDONS = {
  flash: ['Reverser Flash (coming soon)', 'A fast, lower-cost first pass: a result on a sample in about 15 minutes, with a lighter report. Run everything through Flash, and send what needs a deeper look into full Reverser.'],
  jail: ['Reverser Jailbreak (coming soon)', 'Built for ransomware: it goes after the encryption and works to recover the key, so files can come back without paying, where the encryption can be broken.'],
};
const STAGE_MS = 5600;

const SOURCES = [
  ['Booz Allen: Vellox Reverser product page', 'https://www.boozallen.com/expertise/products/vellox-reverser.html'],
  ['Booz Allen newsroom: “Booz Allen Automates Malware Analysis with Vellox Reverser” (July 2025)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-automates-malware-analysis-vellox-reverser'],
  ['Booz Allen announces general availability of Vellox Reverser (Nasdaq press release)', 'https://www.nasdaq.com/press-release/booz-allen-announces-general-availability-vellox-reverser-automate-malware-defense'],
  ['SiliconANGLE: Booz Allen debuts Vellox Reverser', 'https://siliconangle.com/2025/07/28/booz-allen-debuts-vellox-reverser-automate-malware-reverse-engineering-using-ai/'],
  ['Help Net Security: Vellox Reverser accelerates malware analysis and threat intelligence', 'https://www.helpnetsecurity.com/2026/01/26/booz-allen-vellox-reverser/'],
  ['AWS case study: Booz Allen powers malware reverse engineering with agentic AI', 'https://aws.amazon.com/solutions/case-studies/booz-allen-case-study/'],
  ['AWS Marketplace: Vellox Reverser', 'https://aws.amazon.com/marketplace/pp/prodview-neuhq5xqsisaa'],
];

const wt = { stage: 0, playing: false, timer: null, addon: null };
let archEl;

function drawWalkthrough(el) {
  archEl = el;
  const malicious = FUNCS.filter((f) => f === 'm').length;
  el.innerHTML = `
    <div class="xa-head">
      <div><h2>Inside Reverser: one sample, start to finish</h2><p class="muted">Step through it, or press play. Click any stage to jump.</p></div>
      <button type="button" class="rg2-play" id="rv3Play"></button>
    </div>
    <ol class="rg2-stages rv3-stages">${STAGES.map(([, ic, t], i) => `<li><button type="button" data-stage="${i}"><span class="rg2-sn">${i + 1}</span>${icon(ic)}<b>${t.replace('&', '&amp;')}</b></button></li>`).join('')}</ol>
    <div class="nv2-story rv3-cap"><div class="nv2-story-top"><span class="nv2-step-n" id="rv3N"></span></div><p id="rv3Cap"></p></div>

    <div class="rv3" data-stage="0">
      <div class="rv3-file">
        <span class="rv3-ic">${icon('bug')}</span>
        <b>${tx('file', 'invoice_update.exe')}</b>
        <small>sha256 9f2c…e41a</small>
        <span class="rv3-tags"><i>Windows executable</i><i>Packed</i><i class="new">Never seen before</i></span>
      </div>

      <div class="rv3-lanes">
        <section class="rv3-lane sbx">
          <div class="rv3-lh">${icon('monitor')}<b>Instrumented sandbox</b><span>Detonate and watch</span></div>
          <ul class="rv3-feed">${FEED.map(([k, t, d], i) => `<li class="${k}" style="--i:${i}"><em>${t}</em><span>${d}</span>${k === 'evade' ? '<b>countered</b>' : ''}</li>`).join('')}</ul>
        </section>
        <section class="rv3-lane code">
          <div class="rv3-lh">${icon('code')}<b>Static analysis</b><span>Unpack, disassemble, read</span></div>
          <div class="rv3-unpacked">${icon('layers')}Payload unpacked from memory · ${FUNCS.length} functions</div>
          <div class="rv3-grid">${FUNCS.map((f, i) => `<i class="${f}" style="--i:${i}"></i>`).join('')}</div>
          <p class="rv3-key"><span class="m">${malicious} malicious</span><span class="d">${FUNCS.filter((f) => f === 'd').length} never ran in the sandbox</span></p>
        </section>
      </div>

      <div class="rv3-agents">
        <div class="rv3-orch">${icon('sparkle')}<span><b>Orchestrator agent</b><small>Plans and assembles</small></span></div>
        <div class="rv3-subs">${Array.from({ length: 20 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <span class="rv3-subs-l">20+ subagents, in parallel</span>
        <div class="rv3-checks"><span>✓ Findings cross-checked</span><span>✓ Behavior matches code</span><span>✓ Linked to a known campaign</span></div>
      </div>

      <div class="rv3-out">
        <div class="rv3-out-h">${icon('shieldPlus')}<b>Countermeasures</b></div>
        <span class="rv3-chip">YARA rules</span><span class="rv3-chip">IOCs</span><span class="rv3-chip">MITRE ATT&amp;CK</span><span class="rv3-chip">Reports</span>
        <small>→ ${tx('tools', 'SIEM · EDR · threat intel')}, after analyst review</small>
      </div>

      <div class="rv3-aws">${icon('layers')}<span>Runs on AWS: <b>Amazon Bedrock</b> models power every agent · Lambda workers · Step Functions orchestration</span></div>
    </div>

    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements, the AWS case study and press coverage. Booz Allen describes Reverser as fully executing malware to expose its logic, behavior and intent, and defeating evasive techniques such as delayed execution and environment detection. The architecture (one orchestrator, 20+ subagents with peer validation, Amazon Bedrock) reflects the product team’s description. The sample, events and counts are illustrative. Reverser Flash and Reverser Jailbreak are upcoming add-ons described by the product team; they aren’t in the public announcements yet. Confirm figures and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('[data-stage]').forEach(
    (b) =>
      (b.onclick = () => {
        pauseWalk();
        wt.stage = Number(b.dataset.stage);
        paintWalk();
      }),
  );
  el.querySelector('#rv3Play').onclick = () => (wt.playing ? pauseWalk() : playWalk());
  paintWalk();
}

function paintWalk() {
  const el = archEl;
  if (!el) return;
  el.querySelector('.rv3').dataset.stage = String(wt.stage);
  el.querySelectorAll('.rv3-stages button').forEach((b) => {
    const i = Number(b.dataset.stage);
    b.classList.toggle('on', i === wt.stage);
    b.classList.toggle('done', i < wt.stage);
  });
  el.querySelector('#rv3N').textContent = `Step ${wt.stage + 1} of ${STAGES.length} · ${STAGES[wt.stage][2]}`;
  const cap = el.querySelector('#rv3Cap');
  cap.textContent = CAPTIONS[wt.stage];
  cap.style.animation = 'none';
  void cap.offsetWidth;
  cap.style.animation = '';
  const btn = el.querySelector('#rv3Play');
  btn.innerHTML = wt.playing ? '❚❚ Pause' : wt.stage === STAGES.length - 1 ? '↻ Watch again' : '▶ Watch it work';
  btn.classList.toggle('on', wt.playing);
  const bar = el.querySelector('.rv3-stages');
  bar.style.setProperty('--ms', wt.playing ? `${STAGE_MS}ms` : '0ms');
  bar.classList.toggle('playing', wt.playing);
}

function playWalk() {
  clearTimeout(wt.timer);
  if (wt.stage === STAGES.length - 1) wt.stage = 0;
  wt.playing = true;
  paintWalk();
  const tick = () => {
    if (!wt.playing) return;
    if (wt.stage >= STAGES.length - 1) return pauseWalk();
    wt.stage++;
    paintWalk();
    wt.timer = setTimeout(tick, STAGE_MS);
  };
  wt.timer = setTimeout(tick, STAGE_MS);
}
function pauseWalk() {
  clearTimeout(wt.timer);
  wt.playing = false;
  paintWalk();
}

// ---------- Architecture tab: under the hood ----------
// One orchestrator agent directs 20+ specialized subagents that cross-check each
// other's findings; Amazon Bedrock models power every agent.
const UH_PARTS = {
  sample: ['Malware sample', 'Any suspicious file: from incident response, an EDR alert or a phishing email.'],
  orch: ['Orchestrator agent', 'One orchestrator plans the analysis, hands tasks to the subagents, and assembles their findings into one answer.'],
  swarm: ['20+ subagents', 'More than twenty specialized subagents each take a piece of the work and run in parallel: running the sample in a sandbox to watch what it does, unpacking and disassembling it, analyzing its functions, matching it to known campaigns and mapping its behaviors.'],
  validate: ['Peer validation', 'Subagents check each other’s findings, so a conclusion is confirmed before it is reported.'],
  bedrock: ['Amazon Bedrock', 'Foundation models on Amazon Bedrock power every agent; the work runs on AWS.'],
  out: ['Countermeasures', 'YARA rules, IOCs, ATT&CK mappings and reports, ready for the tools your analysts already use.'],
  flash: ['Reverser Flash (coming soon)', 'A fast, lower-cost first pass: a result on a sample in about 15 minutes, with a lighter report. Run everything through Flash, and send what needs a deeper look into full Reverser.'],
  jail: ['Reverser Jailbreak (coming soon)', 'Built for ransomware: it goes after the encryption and works to recover the key, so files can come back without paying, where the encryption can be broken.'],
};
const UH_GROUPS = [
  ['Sandbox run', 4],
  ['Unpack & disassemble', 5],
  ['Analyze functions', 5],
  ['Match campaigns', 4],
  ['Map behaviors', 4],
];

const uh = { part: 'orch' };

function drawUnderHood(el) {
  const on = (k) => (uh.part === k ? 'on' : '');
  let n = 0;
  const swarm = UH_GROUPS.map(([name, count]) => `<div class="uh-col"><span class="uh-role">${esc(name)}</span><div class="uh-dots">${Array.from({ length: count }, () => `<i style="--i:${n++}"></i>`).join('')}</div></div>`).join('');
  el.innerHTML = `
    <div class="rva-head"><h2>Under the hood</h2><span class="muted">Click any part</span></div>
    <div class="uh">
      <button type="button" class="uh-side uh-sample ${on('sample')}" data-part="sample">${icon('bug')}<b>Malware sample</b><small>${tx('file', 'invoice_update.exe')}</small></button>
      <div class="uh-flow in" aria-hidden="true"><i></i></div>

      <div class="uh-box">
        <div class="uh-box-h">${icon('nodes')}<b>Vellox Reverser</b></div>


        <button type="button" class="uh-orch ${on('orch')}" data-part="orch">
          <span class="uh-orch-ic">${icon('sparkle')}</span>
          <span><b>Orchestrator agent</b><small>Plans · delegates · assembles the answer</small></span>
        </button>

        <svg class="uh-fan" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          ${[10, 30, 50, 70, 90].map((x) => `<path d="M50 0 C 50 22, ${x} 18, ${x} 40"/>`).join('')}
        </svg>

        <div class="uh-swarm-wrap">
          <button type="button" class="uh-swarm ${on('swarm')}" data-part="swarm">${swarm}</button>
          <button type="button" class="uh-validate ${on('validate')}" data-part="validate" aria-label="Peer validation">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
              <path d="M10 0 Q 20 26, 30 0"/><path d="M30 0 Q 40 26, 50 0"/><path d="M50 0 Q 60 26, 70 0"/><path d="M70 0 Q 80 26, 90 0"/>
            </svg>
            ${[20, 40, 60, 80].map((x, i) => `<span class="uh-check" style="left:${x}%;--k:${i}">✓</span>`).join('')}
          </button>
          <div class="uh-swarm-cap"><b>20+ subagents</b> · <span class="uh-val-cap">⇄ they cross-check each other’s findings</span></div>
        </div>

        <button type="button" class="uh-bedrock ${on('bedrock')}" data-part="bedrock">
          <span class="uh-bedrock-main"><b>Amazon Bedrock</b> foundation models power every agent</span>
          <span class="uh-bedrock-sub">Runs on AWS · Lambda workers and Step Functions orchestration</span>
        </button>
      </div>

      <div class="uh-flow out" aria-hidden="true"><i></i></div>
      <button type="button" class="uh-side uh-out ${on('out')}" data-part="out">
        <span class="uh-out-h">${icon('shieldPlus')}<b>Countermeasures</b></span>
        <span class="uh-chip">YARA rules</span><span class="uh-chip">IOCs</span><span class="uh-chip">MITRE ATT&amp;CK</span><span class="uh-chip">Reports</span>
        <small>→ ${tx('tools', 'SIEM · EDR · threat intel')}, after analyst review</small>
      </button>
    </div>
    <div class="rva-addons">
      <span class="rva-addons-h">Coming soon</span>
      <button type="button" class="rva-addon flash ${on('flash')}" data-part="flash">
        <span class="rva-ad-step">${icon('inbox')}Every sample</span><i class="rva-ad-arr"></i>
        <span class="rva-ad-main">${icon('zap')}<b>Reverser Flash</b><small>~15 min · lighter report</small></span><i class="rva-ad-arr"></i>
        <span class="rva-ad-split"><span>${icon('check')}Answered</span><span class="deep">${icon('nodes')}Needs more → <b>Reverser</b></span></span>
      </button>
      <button type="button" class="rva-addon jail ${on('jail')}" data-part="jail">
        <span class="rva-ad-step">${icon('lock')}Ransomware</span><i class="rva-ad-arr"></i>
        <span class="rva-ad-main">${icon('key')}<b>Reverser Jailbreak</b><small>works to recover the key</small></span><i class="rva-ad-arr"></i>
        <span class="rva-ad-step ok">${icon('unlock')}Files back</span>
      </button>
    </div>
    <p class="rva-tip"><b>${esc(UH_PARTS[uh.part][0])}:</b> ${esc(UH_PARTS[uh.part][1])}</p>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements and press coverage. Booz Allen describes Reverser as fully executing malware to expose its logic, behavior and intent. The architecture (one orchestrator, 20+ subagents with peer validation, including a sandbox run, Amazon Bedrock) reflects the product team’s description; subagent role names here are examples. Reverser Flash and Reverser Jailbreak are upcoming add-ons described by the product team; they aren’t in the public announcements yet. Confirm figures and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('[data-part]').forEach((b) => (b.onclick = () => ((uh.part = b.dataset.part), drawUnderHood(el))));
}

// ---------- page ----------
function setView(v) {
  const view = ['architecture', 'walkthrough'].includes(v) ? v : 'overview';
  $('#rvOverview').hidden = view !== 'overview';
  $('#rvArch').hidden = view !== 'architecture';
  $('#rvWalk').hidden = view !== 'walkthrough';
  if (view !== 'walkthrough' && wt.playing) pauseWalk();
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
  label: 'Vellox Reverser',
  storageKey: 'rv',
  context: async () => setT(await loadTailoring('reverser')),
  onGoto: () => setView('architecture'),
});

// Optional tailoring: what can be changed for a customer, and where it shows.
const TAILOR_FIELDS = [
  { k: 'lead', label: 'Title slide tagline', where: 'slide 1', placeholder: 'Malware reverse engineering, at machine speed.', full: true },
  { k: 'callout', label: 'Key message on the threat slide', where: 'slide 2', placeholder: 'Machine-speed attacks need machine-speed defense.', full: true },
  { k: 'file', label: 'Sample file name', where: 'slide 4, architecture', placeholder: 'invoice_update.exe' },
  { k: 'tools', label: 'Their tools for detections', where: 'architecture', placeholder: 'SIEM · EDR · threat intel' },
  { k: 'next', label: 'Next step', where: 'last slide', placeholder: 'a pilot with your own samples, compared side by side with your team’s analysis.', full: true },
];
async function retailor() {
  await deck.refresh();
  drawUnderHood($('#rvArchRoot'));
  drawWalkthrough($('#rvWalkRoot'));
  tailorButton($('#tailorBtn'), T);
}
$('#tailorBtn').onclick = () =>
  openTailor({ product: 'reverser', label: 'Reverser', fields: TAILOR_FIELDS, slides: SLIDES.map((x) => ({ id: x.id, title: x.title || 'Title slide' })), onSaved: retailor });

// The race slide loops while it's on screen: when the manual runner reaches the end,
// hold the finished picture for a moment, fade out, and start again.
document.addEventListener('animationend', (e) => {
  if (e.animationName !== 'runner') return;
  const race = e.target.closest('.race');
  setTimeout(() => {
    if (!race?.isConnected) return;
    race.classList.add('fade');
    setTimeout(() => {
      race.classList.remove('go');
      void race.offsetWidth;
      race.classList.add('go');
      race.classList.remove('fade');
    }, 900);
  }, 5500);
});

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
await deck.mount($('#rvDeck'));
drawUnderHood($('#rvArchRoot'));
drawWalkthrough($('#rvWalkRoot'));
tailorButton($('#tailorBtn'), T);
