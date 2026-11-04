// Vellox Reverser: a separate product page from LayerOne. A short pitch deck
// (slides + talking points) and an interactive architecture explainer.
//
// Product facts come from Booz Allen's announcements (July 2025 launch,
// general availability) and press coverage of them; vendor-reported results are
// labeled as such. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';
import { loadTailoring, tailorButton, openTailor } from './tailor.js';

// Optional tailoring for one customer (see tailor.js); empty means the standard version.
let T = { p: {} };
const tx = (k, fallback) => (T.p[k] ? esc(T.p[k]) : fallback);
const prepared = (ctx) => `${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}`;

const STEPS = ['Triage', 'Sandbox run', 'Unpack', 'Analyze code', 'Write detections'];
// Slide 4 and the architecture: what one sample does when Reverser runs it (illustrative).
const FEED = [
  ['proc', '0.4s', 'Launches a hidden PowerShell'],
  ['file', '1.1s', 'Drops updsvc.dll in AppData'],
  ['reg', '1.3s', 'Adds a Run key to survive reboots'],
  ['evade', '2.0s', 'Sleeps 10 minutes → fast-forwarded'],
  ['evade', '2.2s', 'Checks for a virtual machine → fooled'],
  ['net', '2.9s', 'Beacons to update-cdn[.]example'],
];
// The sample's functions: m = malicious, d = dormant (never ran in the sandbox).
const FUNCS = 'nnmnnmnndnnmnnnmnnnmnnmnndnnnmnnmnnnmnmnndnnnmnn'.split('');
const CLOCK = ['Hour 1', 'Day 2', 'Day 5', 'Week 2', 'Week 3']; // illustrative
const big = (ic, t, d) => `<div class="rv-big"><span class="d-ic">${icon(ic)}</span><b>${t}</b><p>${d}</p></div>`;

const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>Booz Allen · Vellox</div>
        <h1>Reverser</h1>
        <p class="d-lead">${tx('lead', 'Malware reverse engineering, <span>at machine speed.</span>')}</p>
        ${prepared(ctx)}
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'Reverser turns the slowest, scarcest step in cyber defense into a fast, repeatable one.',
      points: [
        'Open with their world: “When a new piece of malware lands, how long until your team knows what it does and can detect it everywhere?”',
        'Reverser in one sentence: AI agents take a malware sample apart, work out what it does, and hand back detections your tools can use.',
        'It’s part of Booz Allen’s Vellox line of cyber products that pair human operators with AI agents. It is a separate product from LayerOne.',
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
          <span class="rv-lbl time">Time →</span>
        </figure>
        <div class="rv-drivers">
          <div class="rv-drv">${icon('sparkle')}<span><b>New attacks</b><small>Frontier AI models help write and mutate malware</small></span></div>
          <div class="rv-drv">${icon('zap')}<span><b>Faster</b><small>From idea to working attack in less time</small></span></div>
          <div class="rv-drv">${icon('layers')}<span><b>More</b><small>A rising volume of novel samples</small></span></div>
          <div class="rv-drv def">${icon('users')}<span><b>Defense</b><small>The same handful of reverse engineers</small></span></div>
        </div>
      </div>
      <div class="rv-callout">${icon('shieldPlus')}<span>${T.p.callout ? `<b>${esc(T.p.callout)}</b>` : '<b>Machine-speed attacks need machine-speed defense.</b> Human-only analysis can’t close this gap.'}</span></div>`,
    talk: {
      key: 'The market gap: AI has made attacking cheaper and faster, and defense hasn’t kept up.',
      points: [
        '<b>Read the chart, don’t explain it:</b> attacks are climbing in both speed and volume, while the number of people who can take malware apart stays roughly flat. The red wedge is the gap, and it’s widening. The chart shows the trend, not real data, so don’t quote numbers off it.',
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
            ${STEPS.map((x, i) => `<div class="stn" style="--d:${(2.2 + i * 3.27).toFixed(2)}s"><span>${x}</span></div>`).join('')}
            <div class="runner">${icon('bug')}</div>
          </div>
          <div class="rclock bad">${CLOCK.map((t, i) => `<span style="--d:${(2.2 + i * 3.27).toFixed(2)}s;--e:${(4.95 + i * 3.27).toFixed(2)}s" class="${i === CLOCK.length - 1 ? 'last' : ''}">${t}</span>`).join('')}</div>
        </div>
        <div class="rlane fast">
          <div class="rlane-h"><b>Vellox Reverser</b><small>AI agents · all steps in parallel</small></div>
          <div class="rlane-track">
            ${STEPS.map((x, i) => `<div class="stn" style="--d:${(3.3 + i * 0.13).toFixed(2)}s"><span>${x}</span></div>`).join('')}
            ${STEPS.map((_, i) => `<i class="agent" style="--x:${i * 20 + 10}%"></i>`).join('')}
          </div>
          <div class="rclock good"><span>Minutes</span></div>
        </div>
        <div class="race-flag">${icon('shieldPlus')}<b>Detections ready</b><span>while the manual lane is still working</span></div>
      </div>`,
    talk: {
      key: 'Speed is the whole game: the attacker keeps operating while you wait for analysis.',
      points: [
        '<b>Let the animation run first, then narrate it.</b> Top lane: a skilled analyst triages the file, runs it in a sandbox, unpacks it, analyzes the code and finally writes detections. Each step waits on the one before, and on that analyst’s calendar; watch the clock tick into weeks.',
        '<b>Bottom lane:</b> Reverser splits the sample across many AI agents (Booz Allen calls it a peer-to-peer swarm), so every step runs at once. Point at the flag: detections are ready while the manual lane has barely started. It replays on a loop, so you can point at it again whenever you like. The timing is illustrative; Reverser’s minutes-not-weeks figure is vendor-reported, so say so if asked.',
        '<b>Why it matters:</b> if detections arrive after the incident is over, they only protect the next victim. Minutes means you can still contain this one.',
        '<b>Be careful with the claim:</b> Booz Allen reports minutes instead of days or weeks in representative cases. In one evaluation it assessed more than 120 functions of a sophisticated sample and flagged dozens as malicious. Call these vendor-reported.',
      ],
      ask: 'When you last had a novel sample, how long did it take to get from “found it” to “detecting it everywhere”?',
      objection: '“We already have a sandbox.” Good: Reverser runs one too. But a sandbox only shows what the sample did in one run. Reverser also reads the code, so it finds what didn’t run, and that’s what makes detections durable.',
      next: 'So what’s happening inside those minutes? Two things at once.',
    },
  },
  {
    id: 'how',
    title: 'Watch it run. Read the code.',
    html: () => `
      <div class="rvh">
        <div class="rvh-file">${icon('bug')}<b>${tx('file', 'invoice_update.exe')}</b><small>Never seen before</small></div>
        <div class="rvh-split" aria-hidden="true"><i></i><i></i></div>
        <div class="rvh-lanes">
          <div class="rvh-lane sbx">
            <div class="rvh-lh">${icon('monitor')}<b>Sandbox</b><span>Run it safely and watch everything it does</span></div>
            <ul class="rvh-feed">${FEED.map(([k, t, d], i) => `<li class="${k}" style="--i:${i}"><em>${t}</em>${d}</li>`).join('')}</ul>
          </div>
          <div class="rvh-lane code">
            <div class="rvh-lh">${icon('code')}<b>Code</b><span>Unpack it and read every function</span></div>
            <div class="rvh-grid">${FUNCS.map((f, i) => `<i class="${f}" style="--i:${i}"></i>`).join('')}</div>
            <p class="rvh-key"><span class="m">Malicious</span><span class="d">Never ran in the sandbox</span></p>
          </div>
        </div>
        <div class="rvh-split join" aria-hidden="true"><i></i><i></i></div>
        <div class="rvh-merge">${icon('nodes')}<b>AI agents cross-check both</b><small>YARA · IOCs · ATT&amp;CK · report</small></div>
      </div>`,
    talk: {
      key: 'Reverser does both halves of malware analysis: it runs the sample in a sandbox to see what it does, and reverse engineers the code to see everything it could do.',
      points: [
        '<b>Top lane, the sandbox:</b> Reverser detonates the sample in an instrumented sandbox and records what it does: the processes it launches, the files it drops, how it persists, where it calls home. Booz Allen describes Reverser as fully executing malware to expose its logic, behavior and intent.',
        '<b>The amber lines are evasion:</b> malware stalls or checks for a virtual machine to hide from sandboxes. Reverser counters common tricks like delayed execution and environment detection, so the sample behaves as it would on a real machine.',
        '<b>Bottom lane, the code:</b> the real payload is unpacked and every function is analyzed by AI agents in parallel. Red is malicious. <b>Amber is the point:</b> code that never ran in the sandbox, like a backup server or a trigger date. A sandbox alone would miss it.',
        '<b>Both lanes meet:</b> the agents cross-check each other and the two views, so what the sample did confirms what the code says, and the detections cover both.',
        'The sample, events and function counts are illustrative.',
      ],
      ask: 'Do you use a sandbox today? What happens when a sample detects it and goes quiet?',
      objection: '“Malware detects sandboxes.” That’s why Reverser counters common evasion, and why it doesn’t rely on the run alone: the code lane still sees what the sample was hiding.',
      next: 'Here’s what comes out the other end.',
    },
  },
  {
    id: 'outputs',
    title: 'One sample in. Defenses out.',
    html: () => `
      <div class="rv-io">
        <div class="rv-file">${icon('bug')}<b>${tx('file', 'invoice_update.exe')}</b><small>Suspicious file</small></div>
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
      </div>`,
    talk: {
      key: 'The output isn’t a report to read. It’s countermeasures you can deploy.',
      points: [
        '<b>Go around the four boxes:</b> a YARA rule your detection tools can load, indicators to block and hunt across the network, the behaviors mapped to MITRE ATT&amp;CK, and reports for both leadership and analysts.',
        '<b>The campaign link is the sleeper feature:</b> similarity matching connects the new sample to past samples and campaigns, so you learn not just what it does but what it’s related to.',
        '<b>Point out it’s an example:</b> the file name, rule and indicators on screen are made up for illustration.',
      ],
      ask: 'Where would these go first for you: your SIEM, your EDR, or your threat intel platform?',
      objection: '“Can we trust AI-generated detections?” Treat them like any detection: review and test before rollout. Reverser gets you to a reviewed, deployable rule in minutes instead of weeks.',
      next: 'And two add-ons are on the way.',
    },
  },
  {
    id: 'addons',
    title: 'Coming soon: two add-ons',
    html: () => `
      <div class="rf">
        <section class="rf-col flash">
          <div class="rf-h"><span class="d-ic">${icon('zap')}</span><span><b>Reverser Flash</b><small>Triage every sample, fast</small></span><em class="rf-soon">Coming soon</em></div>
          <div class="rf-funnel" aria-label="Every sample goes through Flash; most get an answer, the ones that need more go on to full Reverser">
            <div class="rf-in">${icon('inbox')}<b>Every sample</b></div>
            <div class="rf-gate">${icon('zap')}<b>Flash</b><span>~15 min</span></div>
            <div class="rf-out ok">${icon('check')}<b>Answered</b><small>Verdict &amp; key indicators</small></div>
            <div class="rf-out deep">${icon('nodes')}<b>Full Reverser</b><small>Needs a deeper look</small></div>
            ${[0, 1, 2, 3, 4].map((i) => `<i class="rf-dot ${i === 2 ? 'deep' : 'ok'}" style="--k:${i}"></i>`).join('')}
          </div>
          <ul class="rf-pts">
            <li><b>~15 minutes</b> to a result on a sample</li>
            <li><b>Lower cost</b>, so you can run everything through it</li>
            <li><b>A lighter report</b>: send what needs more to full Reverser</li>
          </ul>
        </section>
        <section class="rf-col jail">
          <div class="rf-h"><span class="d-ic">${icon('unlock')}</span><span><b>Reverser Jailbreak</b><small>Built for ransomware</small></span><em class="rf-soon">Coming soon</em></div>
          <div class="rf-jb" aria-label="Encrypted files, Jailbreak works on the encryption, files recovered">
            <div class="rf-file locked">${icon('lock')}<b>Encrypted files</b><small>report.docx.locked</small></div>
            <div class="rf-key">${icon('key')}<span>Jailbreak</span></div>
            <div class="rf-file free">${icon('unlock')}<b>Files back</b><small>report.docx</small></div>
          </div>
          <ul class="rf-pts">
            <li><b>Goes after the encryption</b>, not just the behavior</li>
            <li><b>Works to recover the key</b> from the ransomware itself</li>
            <li><b>Get files back</b> without paying, where the encryption can be broken</li>
          </ul>
        </section>
      </div>`,
    talk: {
      key: 'Two add-ons extend Reverser: Flash for speed and cost at volume, Jailbreak for ransomware recovery.',
      points: [
        '<b>Reverser Flash (left):</b> built for cost and speed. It gets you to a result on a sample in about 15 minutes, with a lighter report than full Reverser. Watch the dots: everything goes through Flash, most samples are answered there, and the ones that need more go on to full Reverser.',
        '<b>How to position it:</b> “Throw everything into Flash, then send what needs further investigation into Reverser.” Flash replaces guesswork about which samples deserve an expert; Reverser stays the deep, function-level analysis.',
        '<b>Reverser Jailbreak (right):</b> focused on ransomware. Instead of only explaining what the ransomware does, it goes after the encryption itself and works to recover the key, so files can come back without paying.',
        '<b>Set expectations on Jailbreak:</b> not every ransomware family’s encryption can be broken. Say it works to recover files, never that it always will.',
        '<b>Both are coming soon.</b> For dates, pricing and access, connect them with the Booz Allen Vellox team; don’t commit to timelines.',
      ],
      ask: 'How many samples a week never get looked at today? And when ransomware hits, what does your recovery plan look like?',
      objection: '“Why not just use Flash for everything?” Flash is for breadth: a fast answer on every sample. When a sample matters, like an active intrusion or a new campaign, full Reverser gives the depth: every function, detections and campaign links.',
      next: 'So what does all of this change for your team?',
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
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> ${tx('next', 'a pilot with your own samples, compared side by side with your team’s analysis.')}</span></div>`,
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

// ---------- architecture: one sample through Reverser ----------
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

const st = { stage: 0, playing: false, timer: null, addon: null };
let archEl;

function drawArch(el) {
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

    <div class="rva-addons">
      <span class="rva-addons-h">Coming soon</span>
      <button type="button" class="rva-addon flash ${st.addon === 'flash' ? 'on' : ''}" data-addon="flash">
        <span class="rva-ad-step">${icon('inbox')}Every sample</span><i class="rva-ad-arr"></i>
        <span class="rva-ad-main">${icon('zap')}<b>Reverser Flash</b><small>~15 min · lighter report</small></span><i class="rva-ad-arr"></i>
        <span class="rva-ad-split"><span>${icon('check')}Answered</span><span class="deep">${icon('nodes')}Needs more → <b>Reverser</b></span></span>
      </button>
      <button type="button" class="rva-addon jail ${st.addon === 'jail' ? 'on' : ''}" data-addon="jail">
        <span class="rva-ad-step">${icon('lock')}Ransomware</span><i class="rva-ad-arr"></i>
        <span class="rva-ad-main">${icon('key')}<b>Reverser Jailbreak</b><small>works to recover the key</small></span><i class="rva-ad-arr"></i>
        <span class="rva-ad-step ok">${icon('unlock')}Files back</span>
      </button>
    </div>
    ${st.addon ? `<p class="rva-tip"><b>${esc(ADDONS[st.addon][0])}:</b> ${esc(ADDONS[st.addon][1])}</p>` : ''}
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements, the AWS case study and press coverage. Booz Allen describes Reverser as fully executing malware to expose its logic, behavior and intent, and defeating evasive techniques such as delayed execution and environment detection. The architecture (one orchestrator, 20+ subagents with peer validation, Amazon Bedrock) reflects the product team’s description. The sample, events and counts are illustrative. Reverser Flash and Reverser Jailbreak are upcoming add-ons described by the product team; they aren’t in the public announcements yet. Confirm figures and deployment options with the Vellox team.</p></details>`;
  el.querySelectorAll('[data-stage]').forEach(
    (b) =>
      (b.onclick = () => {
        pause();
        st.stage = Number(b.dataset.stage);
        paint();
      }),
  );
  el.querySelectorAll('[data-addon]').forEach((b) => (b.onclick = () => ((st.addon = st.addon === b.dataset.addon ? null : b.dataset.addon), drawArch(el))));
  el.querySelector('#rv3Play').onclick = () => (st.playing ? pause() : play());
  paint();
}

function paint() {
  const el = archEl;
  if (!el) return;
  el.querySelector('.rv3').dataset.stage = String(st.stage);
  el.querySelectorAll('.rv3-stages button').forEach((b) => {
    const i = Number(b.dataset.stage);
    b.classList.toggle('on', i === st.stage);
    b.classList.toggle('done', i < st.stage);
  });
  el.querySelector('#rv3N').textContent = `Step ${st.stage + 1} of ${STAGES.length} · ${STAGES[st.stage][2]}`;
  const cap = el.querySelector('#rv3Cap');
  cap.textContent = CAPTIONS[st.stage];
  cap.style.animation = 'none';
  void cap.offsetWidth;
  cap.style.animation = '';
  const btn = el.querySelector('#rv3Play');
  btn.innerHTML = st.playing ? '❚❚ Pause' : st.stage === STAGES.length - 1 ? '↻ Watch again' : '▶ Watch it work';
  btn.classList.toggle('on', st.playing);
  const bar = el.querySelector('.rv3-stages');
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
  label: 'Vellox Reverser',
  storageKey: 'rv',
  context: async () => (T = await loadTailoring('reverser')),
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
  drawArch($('#rvArchRoot'));
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
drawArch($('#rvArchRoot'));
tailorButton($('#tailorBtn'), T);
