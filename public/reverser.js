// Vellox Reverser: a separate product page from Layer One. A short pitch deck
// (slides + talking points) and an interactive architecture explainer.
//
// Product facts come from Booz Allen's announcements (July 2025 launch,
// general availability) and press coverage of them; vendor-reported results are
// labeled as such. See SOURCES at the bottom.
import { createDeck, icon, outcome, $, esc } from './deck-core.js';

const fit = (ic, t, d) => `<div class="d-fit"><span class="d-ic">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span></div>`;

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
      next: 'Let’s look at how that work happens today.',
    },
  },
  {
    id: 'without',
    title: 'Today, every sample waits for an expert',
    html: () => `
      <div class="d-arch2 off">
        <div class="d-end">${icon('bug')}<b>Suspicious<br />file</b></div>
        <div class="d-wire"><span>queue →</span><i></i><i class="back"></i><span>← findings</span></div>
        <div class="d-void">${icon('hourglass')}<b>Manual reverse engineering</b><small>A few scarce experts · days to weeks per complex sample</small></div>
        <div class="d-wire"><span>eventually →</span><i></i><i class="back"></i><span>← waiting</span></div>
        <div class="d-end">${icon('shieldPlus')}<b>Your<br />defenses</b></div>
      </div>
      <div class="d-outcomes">
        ${outcome('bad', 'Backlog grows', 'More samples than experts')}
        ${outcome('bad', 'Adversaries iterate', 'New variants keep coming')}
        ${outcome('bad', 'Detections lag', 'Defenses wait on analysis')}
        ${outcome('bad', 'Knowledge siloed', 'Findings in one analyst’s notes')}
      </div>
      <p class="d-note bad">Meanwhile, the attacker keeps operating.</p>`,
    talk: {
      key: 'The bottleneck isn’t detection tools. It’s the handful of people who can take malware apart.',
      points: [
        '<b>Point at the empty box.</b> Between “we found something” and “we can detect it everywhere” sits a manual, expert-only step.',
        '<b>Tell it as a story.</b> Incident response pulls a loader off a server late on a Friday. The one person who can reverse it is already on two other cases. Everyone else waits, and so do the detections.',
        '<b>Why it’s getting worse:</b> attackers use automation and AI too. Variants arrive faster, and evasive malware takes longer to unpack and understand.',
        '<b>The hidden cost:</b> even when the work gets done, it often lives in one analyst’s notes and never becomes reusable detections or links to known campaigns.',
      ],
      ask: 'When you last had a novel sample, how long did it take to get from “found it” to “detecting it everywhere”?',
      objection: '“Our sandbox already does this.” A sandbox shows what a sample did in one run. Reverse engineering explains how it works, including paths that didn’t run, and that’s what turns into durable detections.',
      next: 'Now, the same picture with Reverser in the middle.',
    },
  },
  {
    id: 'how',
    title: 'AI agents take the sample apart',
    html: () => `
      <div class="d-arch2">
        <div class="d-end">${icon('bug')}<b>Malware<br />sample</b></div>
        <div class="d-wire"><span>submit →</span><i></i><i class="back"></i><span>← results</span></div>
        <div class="d-core">
          <div class="d-core-h">${icon('nodes')}<b>Vellox Reverser</b></div>
          <ol>
            <li><span>1</span>Split the binary across agents</li>
            <li><span>2</span>Assess every function</li>
            <li><span>3</span>Match to known campaigns</li>
            <li><span>4</span>Generate countermeasures</li>
          </ol>
        </div>
        <div class="d-wire"><span>deploy →</span><i></i><i class="back"></i><span>← new samples</span></div>
        <div class="d-end">${icon('shieldPlus')}<b>Your<br />defenses</b></div>
      </div>
      <div class="d-outcomes">
        ${outcome('ok', 'YARA rules', 'Ready for detection tools')}
        ${outcome('ok', 'IOCs', 'Indicators to block and hunt')}
        ${outcome('ok', 'MITRE ATT&amp;CK', 'Behaviors mapped')}
        ${outcome('ok', 'Reports', 'Executive and technical')}
      </div>
      <p class="d-note">Minutes instead of days in representative cases (vendor-reported) · analysts stay in charge</p>`,
    talk: {
      key: 'Same picture, but the expert-only step becomes a team of AI agents working in parallel.',
      points: [
        '<b>How it works, simply:</b> Reverser splits the binary across many cooperating agents (Booz Allen describes a peer-to-peer “swarm”), so the work runs in parallel instead of one function at a time.',
        '<b>Every function gets looked at,</b> and similar code is matched to past samples and campaigns, so you learn not just what it does but who it may be tied to.',
        '<b>The output is something you can use:</b> YARA rules and IOCs your detection tools can take in, behaviors mapped to MITRE ATT&amp;CK, mitigation guidance, and reports for both executives and analysts.',
        '<b>Speed, carefully:</b> Booz Allen reports minutes instead of days or weeks in representative cases. In one evaluation, it assessed more than 120 functions of a sophisticated sample and flagged dozens as malicious. Call these vendor-reported.',
        '<b>Analysts stay in charge.</b> It takes the grind off experts so they can spend their time on judgment.',
      ],
      ask: 'Where would the output go first for you: your SIEM, your EDR, or your threat intel platform?',
      objection: '“Can we trust AI-generated detections?” Treat them like any detection: review and test before rollout. Reverser’s job is to get you to a reviewed, deployable rule in minutes instead of weeks.',
      next: 'Here’s where that matters most.',
    },
  },
  {
    id: 'fit',
    title: 'Where it fits',
    html: () => `
      <div class="d-grid d-2 d-fits">
        ${fit('zap', 'Security operations', 'Understand a suspicious file fast, without waiting on an expert.')}
        ${fit('target', 'Incident response', 'Know what an implant does while the incident is still live.')}
        ${fit('link', 'Threat intelligence', 'Link new samples to known campaigns and evolving behaviors.')}
        ${fit('code', 'Detection engineering', 'Start from YARA rules and IOCs instead of a blank page.')}
      </div>
      <p class="d-note">Next step: a pilot with your own samples · runs on AWS, listed in AWS Marketplace</p>`,
    talk: {
      key: 'Prove it on their own malware: that’s the most convincing demo.',
      points: [
        'Ask which team feels the pain most and lead with that card. It’s usually incident response or the threat intel team.',
        'Suggest a pilot with samples they’ve already reversed by hand, so they can compare time-to-answer and quality side by side.',
        'Deployment questions (environment, data handling, classification level) go to the Booz Allen Vellox team. Don’t guess.',
      ],
      ask: 'Do you have a recent sample that took a long time to reverse? That’s the perfect pilot candidate.',
      next: 'Open the architecture view for a closer look, or take questions.',
    },
  },
];

// ---------- architecture explainer ----------
const STAGES = [
  {
    id: 'ingest',
    icon: 'inbox',
    title: 'Submit a sample',
    what: 'A suspicious file comes in from incident response, an EDR alert, a phishing email or a threat intel feed.',
    why: 'Starting is the same as today; what changes is everything after.',
  },
  {
    id: 'deconstruct',
    icon: 'nodes',
    title: 'Deconstruct across agents',
    what: 'The binary is broken into pieces and spread across a network of cooperating AI agents (described by Booz Allen as peer-to-peer nodes working as a swarm), so analysis runs in parallel.',
    why: 'Parallel work is what turns days of sequential expert effort into minutes.',
  },
  {
    id: 'analyze',
    icon: 'code',
    title: 'Assess every function',
    what: 'Agents examine the code function by function and flag malicious behavior, using AI and patented algorithms from Booz Allen’s U.S. government cyber defense work.',
    why: 'Reverse engineering explains how the malware works, including paths a sandbox run never triggers.',
  },
  {
    id: 'match',
    icon: 'link',
    title: 'Match to known campaigns',
    what: 'Function and binary similarity matching links the new sample to historical samples, campaigns and evolving behaviors.',
    why: 'You learn not only what it does, but what it is related to.',
  },
  {
    id: 'synthesize',
    icon: 'shieldPlus',
    title: 'Generate countermeasures',
    what: 'Findings are synthesized into YARA rules, indicators of compromise, MITRE ATT&CK mappings, mitigation guidance, and executive and technical reports.',
    why: 'The answer arrives in the formats defenders already use.',
  },
  {
    id: 'deploy',
    icon: 'zap',
    title: 'Defend, with analysts in charge',
    what: 'Analysts review the results and push rules and indicators into detection platforms (SIEM, EDR, threat intel).',
    why: 'Experts spend their time on judgment, not on the grind.',
  },
];

const SOURCES = [
  ['Booz Allen: Vellox Reverser product page', 'https://www.boozallen.com/expertise/products/vellox-reverser.html'],
  ['Booz Allen newsroom: “Booz Allen Automates Malware Analysis with Vellox Reverser” (July 2025)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-automates-malware-analysis-vellox-reverser'],
  ['Booz Allen announces general availability of Vellox Reverser (Nasdaq press release)', 'https://www.nasdaq.com/press-release/booz-allen-announces-general-availability-vellox-reverser-automate-malware-defense'],
  ['SiliconANGLE: Booz Allen debuts Vellox Reverser', 'https://siliconangle.com/2025/07/28/booz-allen-debuts-vellox-reverser-automate-malware-reverse-engineering-using-ai/'],
  ['Help Net Security: Vellox Reverser accelerates malware analysis and threat intelligence', 'https://www.helpnetsecurity.com/2026/01/26/booz-allen-vellox-reverser/'],
  ['AWS Marketplace: Vellox Reverser', 'https://aws.amazon.com/marketplace/pp/prodview-neuhq5xqsisaa'],
];

const st = { stage: 0 };

function drawArch(el) {
  const s = STAGES[st.stage];
  el.innerHTML = `
    <p class="rv-intro">How a sample moves through Reverser. Click a step to explain it.</p>
    <ol class="rv-flow">
      ${STAGES.map((x, n) => `<li><button type="button" class="rv-step ${n === st.stage ? 'on' : ''} ${n === 1 || n === 2 || n === 3 || n === 4 ? 'core' : ''}" data-stage="${n}"><span class="rv-n">${n + 1}</span>${icon(x.icon)}<b>${esc(x.title)}</b></button></li>`).join('')}
    </ol>
    <div class="rv-bracket"><span>Inside Vellox Reverser · AI agents working in parallel</span></div>
    <section class="rv-detail">
      <div class="rv-detail-h">${icon(s.icon)}<div><small>Step ${st.stage + 1} of ${STAGES.length}</small><h3>${esc(s.title)}</h3></div></div>
      <p>${esc(s.what)}</p>
      <p class="rv-why"><b>Why it matters:</b> ${esc(s.why)}</p>
      <div class="rv-detail-nav"><button type="button" class="secondary" data-step="-1" ${st.stage === 0 ? 'disabled' : ''}>← Previous</button><button type="button" class="con-go" data-step="1" ${st.stage === STAGES.length - 1 ? 'disabled' : ''}>Next step →</button></div>
    </section>
    <div class="rv-cards">
      <div class="rv-card"><h4>What comes out</h4><ul><li>YARA rules, ready for detection tools</li><li>Indicators of compromise (IOCs)</li><li>MITRE ATT&amp;CK mapping</li><li>Mitigation guidance</li><li>Executive and technical reports</li></ul></div>
      <div class="rv-card"><h4>How it’s built</h4><ul><li>Agentic AI: many cooperating agents, not one model</li><li>Reported to run on AWS (Lambda workers, Amazon Bedrock models, Step Functions orchestration)</li><li>Listed in AWS Marketplace</li></ul></div>
      <div class="rv-card"><h4>Results (vendor-reported)</h4><ul><li>Minutes instead of days or weeks in representative cases</li><li>One evaluation: 120+ functions assessed, dozens flagged as malicious</li></ul><p class="muted small">Confirm current figures with the Vellox team before quoting them.</p></div>
    </div>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Descriptions on this page summarize Booz Allen’s public announcements and press coverage of them. Product details such as deployment options and classification levels should come from the Vellox team.</p></details>`;
  el.querySelectorAll('[data-stage]').forEach((b) => (b.onclick = () => ((st.stage = Number(b.dataset.stage)), drawArch(el))));
  el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => ((st.stage = Math.max(0, Math.min(STAGES.length - 1, st.stage + Number(b.dataset.step)))), drawArch(el))));
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
