// Vellox Reverser: a separate product page from Layer One. A short pitch deck
// (slides + talking points) and an interactive architecture explainer.
//
// Product facts come from Booz Allen's announcements (July 2025 launch,
// general availability) and press coverage of them; vendor-reported results are
// labeled as such. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';

const STEPS = ['Triage', 'Unpack', 'Disassemble', 'Analyze', 'Write detections'];
const CLOCK = ['Hour 1', 'Day 2', 'Day 5', 'Week 2', 'Week 3']; // illustrative
const big = (ic, t, d) => `<div class="rv-big"><span class="d-ic">${icon(ic)}</span><b>${t}</b><p>${d}</p></div>`;

const SLIDES = [
  {
    id: 'title',
    html: () => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>Booz Allen · Vellox</div>
        <h1>Reverser</h1>
        <p class="d-lead">Malware reverse engineering, <span>at machine speed.</span></p>
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'Reverser turns the slowest, scarcest step in cyber defense into a fast, repeatable one.',
      points: [
        'Open with their world: “When a new piece of malware lands, how long until your team knows what it does and can detect it everywhere?”',
        'Reverser in one sentence: AI agents take a malware sample apart, work out what it does, and hand back detections your tools can use.',
        'It’s part of Booz Allen’s Vellox line of cyber products that pair human operators with AI agents. It is a separate product from Layer One.',
      ],
      ask: 'Who on your team reverse engineers malware today, and how big is their queue?',
      next: 'First, the bigger picture: why defenders are falling behind.',
    },
  },
  {
    id: 'gap',
    title: 'Attackers are outpacing defenders',
    html: () => `
      <div class="rv-gap">
        <figure class="rv-chart" aria-label="Illustrative chart: attacker speed and volume rising steeply while defender capacity stays nearly flat">
          <svg viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="rvGapFill" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#f87171" stop-opacity="0"/><stop offset="1" stop-color="#f87171" stop-opacity="0.28"/></linearGradient>
            </defs>
            <path class="rv-gap-area" d="M40 222 C 240 214, 420 150, 580 26 L 580 196 C 420 202, 240 214, 40 222 Z" fill="url(#rvGapFill)"/>
            <line x1="40" y1="260" x2="580" y2="260" class="rv-axis"/>
            <line x1="40" y1="20" x2="40" y2="260" class="rv-axis"/>
            <path class="rv-line atk" d="M40 222 C 240 214, 420 150, 580 26"/>
            <path class="rv-line def" d="M40 222 C 240 214, 420 202, 580 196"/>
          </svg>
          <span class="rv-lbl atk">Attacks: speed &amp; volume</span>
          <span class="rv-lbl def">Defenders: manual capacity</span>
          <span class="rv-lbl gap">The gap</span>
          <span class="rv-lbl time">Time → · illustrative</span>
        </figure>
        <div class="rv-drivers">
          <div class="rv-drv">${icon('sparkle')}<span><b>New attacks</b><small>Frontier AI models help write and mutate malware</small></span></div>
          <div class="rv-drv">${icon('zap')}<span><b>Faster</b><small>From idea to working attack in less time</small></span></div>
          <div class="rv-drv">${icon('layers')}<span><b>More</b><small>A rising volume of novel samples</small></span></div>
          <div class="rv-drv def">${icon('users')}<span><b>Defense</b><small>The same handful of reverse engineers</small></span></div>
        </div>
      </div>
      <div class="rv-callout">${icon('shieldPlus')}<span><b>Machine-speed attacks need machine-speed defense.</b> Human-only analysis can’t close this gap.</span></div>`,
    talk: {
      key: 'The market gap: AI has made attacking cheaper and faster, and defense hasn’t kept up.',
      points: [
        '<b>Read the chart, don’t explain it:</b> attacks are climbing in both speed and volume, while the number of people who can take malware apart stays roughly flat. The red wedge is the gap, and it’s widening.',
        '<b>What changed:</b> frontier AI models lower the skill and time needed to build and modify malicious code. Attackers can generate new variants quickly and try more of them.',
        '<b>Why defenders feel it:</b> every new variant can mean another sample to analyze, and reverse engineering is the slowest, most specialized step. More samples, same experts.',
        '<b>If you cite evidence,</b> point to public 2025 threat reports from AI labs and threat intelligence teams describing attackers using AI models in their operations. Pull the specific report you’ll reference before the meeting; don’t quote numbers from memory.',
        '<b>The bridge to Reverser:</b> Booz Allen built the Vellox line on exactly this idea: pair human operators with AI agents to counter adversaries who are already using AI.',
      ],
      ask: 'Are you seeing more novel or modified samples than a year or two ago? How is your team keeping up?',
      objection: '“Isn’t this just hype about AI?” Skip the hype and use their data: queue length, time to analysis, how many samples never get a full look. The gap shows up there.',
      next: 'The fastest way to close that gap is time-to-answer. Here’s what that looks like.',
    },
  },
  {
    id: 'speed',
    title: 'From days to minutes',
    html: () => `
      <div class="race go">
        <div class="rlane slow">
          <div class="rlane-h"><b>Manual reverse engineering</b><small>One expert · one step at a time</small></div>
          <div class="rlane-track">
            ${STEPS.map((x, i) => `<div class="stn" style="--d:${(0.9 + i * 1.5).toFixed(1)}s"><span>${x}</span></div>`).join('')}
            <div class="runner">${icon('bug')}</div>
          </div>
          <div class="rclock bad">${CLOCK.map((t, i) => `<span style="--d:${(0.9 + i * 1.5).toFixed(1)}s;--e:${(2.4 + i * 1.5).toFixed(1)}s" class="${i === CLOCK.length - 1 ? 'last' : ''}">${t}</span>`).join('')}</div>
        </div>
        <div class="rlane fast">
          <div class="rlane-h"><b>Vellox Reverser</b><small>AI agents · all steps in parallel</small></div>
          <div class="rlane-track">
            ${STEPS.map((x, i) => `<div class="stn" style="--d:${(1.5 + i * 0.06).toFixed(2)}s"><span>${x}</span></div>`).join('')}
            ${STEPS.map((_, i) => `<i class="agent" style="--x:${i * 20 + 10}%"></i>`).join('')}
          </div>
          <div class="rclock good"><span>Minutes</span></div>
        </div>
        <div class="race-flag">${icon('shieldPlus')}<b>Detections ready</b><span>while the manual lane is still working</span></div>
      </div>
      <p class="d-note">Illustrative timing · Reverser’s minutes-not-weeks is vendor-reported · <button type="button" class="race-replay">↻ Replay</button></p>`,
    talk: {
      key: 'Speed is the whole game: the attacker keeps operating while you wait for analysis.',
      points: [
        '<b>Let the animation run first, then narrate it.</b> Top lane: a skilled analyst triages, unpacks, disassembles, analyzes and finally writes detections. Each step waits on the one before, and on that analyst’s calendar; watch the clock tick into weeks.',
        '<b>Bottom lane:</b> Reverser splits the sample across many AI agents (Booz Allen calls it a peer-to-peer swarm), so every step runs at once. Point at the flag: detections are ready while the manual lane has barely started. Hit ↻ Replay if they want to see it again.',
        '<b>Why it matters:</b> if detections arrive after the incident is over, they only protect the next victim. Minutes means you can still contain this one.',
        '<b>Be careful with the claim:</b> Booz Allen reports minutes instead of days or weeks in representative cases. In one evaluation it assessed more than 120 functions of a sophisticated sample and flagged dozens as malicious. Call these vendor-reported.',
      ],
      ask: 'When you last had a novel sample, how long did it take to get from “found it” to “detecting it everywhere”?',
      objection: '“Our sandbox already does this.” A sandbox shows what a sample did in one run. Reverse engineering explains how it works, including paths that didn’t run, and that is what turns into durable detections.',
      next: 'Fast is only useful if what comes out is usable. Here’s what you get.',
    },
  },
  {
    id: 'outputs',
    title: 'One sample in. Defenses out.',
    html: () => `
      <div class="rv-io">
        <div class="rv-file">${icon('bug')}<b>invoice_update.exe</b><small>Suspicious file</small></div>
        <div class="rv-via"><span>${icon('nodes')}Vellox<br />Reverser</span><i></i></div>
        <div class="rv-arts">
          <div class="rv-art"><div class="rv-art-h">${icon('code')}<b>YARA rule</b><small>Ready for detection tools</small></div>
            <pre>rule Invoice_Lure_Loader {
  strings: $c2 = "update-cdn"
  condition: $c2
}</pre></div>
          <div class="rv-art"><div class="rv-art-h">${icon('fingerprint')}<b>Indicators (IOCs)</b><small>To block and hunt</small></div>
            <pre>domain  update-cdn[.]example
ip      203.0.113.24
sha256  9f2c…e41a</pre></div>
          <div class="rv-art"><div class="rv-art-h">${icon('target')}<b>MITRE ATT&amp;CK</b><small>Behaviors mapped</small></div>
            <div class="rv-tags"><span>T1059 Command &amp; scripting</span><span>T1071 Application-layer C2</span><span>T1547 Autostart persistence</span></div></div>
          <div class="rv-art"><div class="rv-art-h">${icon('file')}<b>Reports</b><small>For leaders and analysts</small></div>
            <div class="rv-tags"><span>Executive summary</span><span>Technical report</span><span>Mitigation guidance</span><span>Links to known campaigns</span></div></div>
        </div>
      </div>
      <p class="d-note">Illustrative example</p>`,
    talk: {
      key: 'The output isn’t a report to read. It’s countermeasures you can deploy.',
      points: [
        '<b>Go around the four boxes:</b> a YARA rule your detection tools can load, indicators to block and hunt across the network, the behaviors mapped to MITRE ATT&amp;CK, and reports for both leadership and analysts.',
        '<b>The campaign link is the sleeper feature:</b> similarity matching connects the new sample to past samples and campaigns, so you learn not just what it does but what it’s related to.',
        '<b>Point out it’s an example:</b> the file name, rule and indicators on screen are made up for illustration.',
      ],
      ask: 'Where would these go first for you: your SIEM, your EDR, or your threat intel platform?',
      objection: '“Can we trust AI-generated detections?” Treat them like any detection: review and test before rollout. Reverser gets you to a reviewed, deployable rule in minutes instead of weeks.',
      next: 'So what does that change for your team?',
    },
  },
  {
    id: 'team',
    title: 'What changes for your team',
    html: () => `
      <div class="rv-bigs">
        ${big('layers', 'Every sample', 'Not just the scariest one. Coverage stops depending on who’s free.')}
        ${big('users', 'Experts on judgment', 'Not on the grind. Analysts review and decide; agents do the heavy lifting.')}
        ${big('link', 'Every finding connected', 'Linked to known campaigns, and shared as detections, not lost in one analyst’s notes.')}
      </div>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> a pilot with your own samples, compared side by side with your team’s analysis.</span></div>`,
    talk: {
      key: 'Prove it on their own malware: that’s the most convincing demo.',
      points: [
        '<b>Every sample:</b> today, teams triage which samples deserve an expert. With Reverser, every sample gets analyzed, not only the ones that look scariest.',
        '<b>Experts on judgment:</b> this doesn’t replace reverse engineers. It gives them their time back for the hard calls.',
        '<b>Where it fits:</b> incident response (understand an implant while the incident is live), threat intel (link samples to campaigns), detection engineering (start from a rule, not a blank page), and the SOC.',
        '<b>Close with a pilot:</b> use samples they’ve already reversed by hand, so they can compare time and quality side by side. Deployment questions (environment, data handling, classification level) go to the Booz Allen Vellox team; don’t guess.',
      ],
      ask: 'Do you have a recent sample that took a long time to reverse? That’s the perfect pilot candidate.',
      next: 'Open the Architecture tab for a closer look, or take questions.',
    },
  },
];

// ---------- architecture: under the hood ----------
// One orchestrator agent directs 20+ specialized subagents that cross-check each
// other's findings; Amazon Bedrock models power every agent.
const PARTS = {
  sample: ['Malware sample', 'Any suspicious file: from incident response, an EDR alert or a phishing email.'],
  orch: ['Orchestrator agent', 'One orchestrator plans the analysis, hands tasks to the subagents, and assembles their findings into one answer.'],
  swarm: ['20+ subagents', 'More than twenty specialized subagents each take a piece of the work and run in parallel.'],
  validate: ['Peer validation', 'Subagents check each other’s findings, so a conclusion is confirmed before it is reported.'],
  bedrock: ['Amazon Bedrock', 'Foundation models on Amazon Bedrock power every agent; the work runs on AWS.'],
  out: ['Countermeasures', 'YARA rules, IOCs, ATT&CK mappings and reports, ready for the tools your analysts already use.'],
};
const GROUPS = [
  ['Unpack', 4],
  ['Disassemble', 5],
  ['Analyze functions', 5],
  ['Match campaigns', 4],
  ['Map behaviors', 4],
];

const SOURCES = [
  ['Booz Allen: Vellox Reverser product page', 'https://www.boozallen.com/expertise/products/vellox-reverser.html'],
  ['Booz Allen newsroom: “Booz Allen Automates Malware Analysis with Vellox Reverser” (July 2025)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-automates-malware-analysis-vellox-reverser'],
  ['Booz Allen announces general availability of Vellox Reverser (Nasdaq press release)', 'https://www.nasdaq.com/press-release/booz-allen-announces-general-availability-vellox-reverser-automate-malware-defense'],
  ['SiliconANGLE: Booz Allen debuts Vellox Reverser', 'https://siliconangle.com/2025/07/28/booz-allen-debuts-vellox-reverser-automate-malware-reverse-engineering-using-ai/'],
  ['Help Net Security: Vellox Reverser accelerates malware analysis and threat intelligence', 'https://www.helpnetsecurity.com/2026/01/26/booz-allen-vellox-reverser/'],
  ['AWS Marketplace: Vellox Reverser', 'https://aws.amazon.com/marketplace/pp/prodview-neuhq5xqsisaa'],
];

const st = { part: 'orch' };

function drawArch(el) {
  const on = (k) => (st.part === k ? 'on' : '');
  let n = 0;
  const swarm = GROUPS.map(([name, count]) => `<div class="uh-col"><span class="uh-role">${esc(name)}</span><div class="uh-dots">${Array.from({ length: count }, () => `<i style="--i:${n++}"></i>`).join('')}</div></div>`).join('');
  const total = GROUPS.reduce((t, [, c]) => t + c, 0);
  el.innerHTML = `
    <div class="rva-head"><h2>Under the hood</h2><span class="muted">Click any part</span></div>
    <div class="uh">
      <button type="button" class="uh-side uh-sample ${on('sample')}" data-part="sample">${icon('bug')}<b>Malware sample</b><small>invoice_update.exe</small></button>
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
          <div class="uh-swarm-cap"><b>${total} subagents</b> in this example · <span class="uh-val-cap">⇄ they cross-check each other’s findings</span> · example roles</div>
        </div>

        <button type="button" class="uh-bedrock ${on('bedrock')}" data-part="bedrock">
          <span class="uh-bedrock-main"><b>Amazon Bedrock</b> foundation models power every agent</span>
          <span class="uh-bedrock-sub">Runs on AWS · Lambda workers and Step Functions orchestration (as reported)</span>
        </button>
      </div>

      <div class="uh-flow out" aria-hidden="true"><i></i></div>
      <button type="button" class="uh-side uh-out ${on('out')}" data-part="out">
        <span class="uh-out-h">${icon('shieldPlus')}<b>Countermeasures</b></span>
        <span class="uh-chip">YARA rules</span><span class="uh-chip">IOCs</span><span class="uh-chip">MITRE ATT&amp;CK</span><span class="uh-chip">Reports</span>
        <small>→ SIEM · EDR · threat intel, after analyst review</small>
      </button>
    </div>
    <p class="rva-tip"><b>${esc(PARTS[st.part][0])}:</b> ${esc(PARTS[st.part][1])}</p>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements and press coverage. The architecture (one orchestrator, 20+ subagents with peer validation, Amazon Bedrock) reflects the product team’s description; subagent role names here are examples. Confirm figures and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('[data-part]').forEach((b) => (b.onclick = () => ((st.part = b.dataset.part), drawArch(el))));
}

// ---------- page ----------
function setView(v) {
  const view = v === 'architecture' ? 'architecture' : 'overview';
  $('#rvOverview').hidden = view !== 'overview';
  $('#rvArch').hidden = view !== 'architecture';
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
  onGoto: () => setView('architecture'),
});

// ↻ Replay on the race slide restarts its animation.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.race-replay');
  if (!btn) return;
  const race = btn.closest('.slide')?.querySelector('.race');
  if (!race) return;
  race.classList.remove('go');
  void race.offsetWidth;
  race.classList.add('go');
});

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
deck.mount($('#rvDeck'));
drawArch($('#rvArchRoot'));
