// Vellox Reverser: a separate product page from Layer One. A short pitch deck
// (slides + talking points) and an interactive architecture explainer.
//
// Product facts come from Booz Allen's announcements (July 2025 launch,
// general availability) and press coverage of them; vendor-reported results are
// labeled as such. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';

const STEPS = ['Triage', 'Unpack', 'Disassemble', 'Analyze', 'Write detections'];
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
      next: 'Let’s start with the thing that matters most in an incident: time.',
    },
  },
  {
    id: 'speed',
    title: 'From days to minutes',
    html: () => `
      <div class="rv-time">
        <div class="rv-row">
          <div class="rv-who"><b>Manual reverse engineering</b><small>One expert, one step at a time</small></div>
          <div class="rv-track"><div class="rv-bar slow">${STEPS.map((x) => `<span>${x}</span>`).join('')}</div></div>
          <div class="rv-dur bad">Days to weeks</div>
        </div>
        <div class="rv-row">
          <div class="rv-who"><b>Vellox Reverser</b><small>AI agents, all steps in parallel</small></div>
          <div class="rv-track"><div class="rv-bar fast"><span>${icon('zap')}</span></div></div>
          <div class="rv-dur good">Minutes</div>
        </div>
      </div>
      <div class="rv-callout">${icon('shieldPlus')}<span>Detections are ready <b>while the incident is still live</b>, not after it’s over.</span></div>
      <p class="d-note">Minutes instead of days or weeks in representative cases (vendor-reported)</p>`,
    talk: {
      key: 'Speed is the whole game: the attacker keeps operating while you wait for analysis.',
      points: [
        '<b>Walk the top bar:</b> today a skilled analyst triages, unpacks, disassembles, analyzes and finally writes detections. Each step waits on the one before, and on that analyst’s calendar.',
        '<b>Then the bottom bar:</b> Reverser splits the sample across many AI agents (Booz Allen calls it a peer-to-peer swarm), so the steps run in parallel.',
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

// ---------- architecture: one picture, one sentence at a time ----------
const PARTS = {
  in: 'Any suspicious file: from incident response, an EDR alert or a phishing email.',
  core: 'Many AI agents split the file and analyze every function in parallel, then match it to known campaigns.',
  out: 'Countermeasures ready to use, not just a report to read.',
  tools: 'Analysts review the results and push rules and indicators into the tools they already use.',
};

const SOURCES = [
  ['Booz Allen: Vellox Reverser product page', 'https://www.boozallen.com/expertise/products/vellox-reverser.html'],
  ['Booz Allen newsroom: “Booz Allen Automates Malware Analysis with Vellox Reverser” (July 2025)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-automates-malware-analysis-vellox-reverser'],
  ['Booz Allen announces general availability of Vellox Reverser (Nasdaq press release)', 'https://www.nasdaq.com/press-release/booz-allen-announces-general-availability-vellox-reverser-automate-malware-defense'],
  ['SiliconANGLE: Booz Allen debuts Vellox Reverser', 'https://siliconangle.com/2025/07/28/booz-allen-debuts-vellox-reverser-automate-malware-reverse-engineering-using-ai/'],
  ['Help Net Security: Vellox Reverser accelerates malware analysis and threat intelligence', 'https://www.helpnetsecurity.com/2026/01/26/booz-allen-vellox-reverser/'],
  ['AWS Marketplace: Vellox Reverser', 'https://aws.amazon.com/marketplace/pp/prodview-neuhq5xqsisaa'],
];

const st = { part: 'core' };

function drawArch(el) {
  const sel = (k) => (st.part === k ? 'on' : '');
  el.innerHTML = `
    <div class="rva-head"><h2>How Reverser works</h2><span class="muted">Click any part</span></div>
    <div class="rva">
      <button type="button" class="rva-node ${sel('in')}" data-part="in">${icon('bug')}<b>Malware sample</b></button>
      <div class="rva-arrow" aria-hidden="true"></div>
      <button type="button" class="rva-core ${sel('core')}" data-part="core">
        <span class="rva-core-h">${icon('nodes')}<b>Vellox Reverser</b></span>
        <span class="rva-swarm" aria-hidden="true">${'<i></i>'.repeat(15)}</span>
        <span class="rva-chips"><span>Split</span><span>Analyze</span><span>Match</span></span>
      </button>
      <div class="rva-arrow" aria-hidden="true"></div>
      <button type="button" class="rva-outs ${sel('out')}" data-part="out"><span>YARA rules</span><span>IOCs</span><span>ATT&amp;CK</span><span>Reports</span></button>
      <div class="rva-arrow" aria-hidden="true"></div>
      <button type="button" class="rva-node ${sel('tools')}" data-part="tools">${icon('shieldPlus')}<b>Your tools</b><small>SIEM · EDR · Threat intel</small></button>
    </div>
    <div class="rva-loop">↺ Analysts review, deploy, and send new samples back in</div>
    <p class="rva-tip">${esc(PARTS[st.part])}</p>
    <div class="rva-meta"><span><b>Speed</b> Minutes, not days (vendor-reported)</span><span><b>Runs on</b> AWS · listed in AWS Marketplace</span></div>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Summarizes Booz Allen’s public announcements and press coverage. Reported to be built on AWS Lambda, Amazon Bedrock and AWS Step Functions. Confirm figures, deployment options and classification levels with the Vellox team.</p></details>`;
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

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
deck.mount($('#rvDeck'));
drawArch($('#rvArchRoot'));
