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

// Optional tailoring for one customer (see tailor.js); empty means the standard version.
let T = { p: {} };
const tx = (k, fallback) => (T.p[k] ? esc(T.p[k]) : fallback);
const prepared = (ctx) => `${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}`;
const jewel = () => tx('jewel', 'finance DB'); // the system an attacker is after
const review = () => ({ github: 'GitHub', gitlab: 'GitLab' })[T.p.review] || 'GitHub or GitLab';
const hostPattern = () => (T.p.jewel ? `${T.p.jewel.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16)}-*` : 'FIN-DB-*');

// ---------- the network picture used on slides 2 and 4 ----------
const NODES = {
  net: [40, 150, 'Internet'],
  mail: [150, 70, 'Email'],
  web: [150, 230, 'Web server'],
  lap1: [270, 50, 'Laptop'],
  lap2: [270, 150, 'Laptop'],
  prn: [270, 250, 'Printer'],
  fs: [400, 90, 'File server'],
  app: [400, 210, 'App server'],
  dc: [525, 60, 'Domain controller'],
  db: [525, 220, 'Finance DB'],
};
const EDGES = [['net', 'mail'], ['net', 'web'], ['mail', 'lap1'], ['mail', 'lap2'], ['web', 'app'], ['lap1', 'fs'], ['lap2', 'fs'], ['lap2', 'app'], ['prn', 'app'], ['prn', 'lap2'], ['fs', 'dc'], ['app', 'db'], ['dc', 'db']];
const PATH = ['net', 'mail', 'lap2', 'fs', 'dc', 'db']; // the route an attacker would really take
const NOISE = ['web', 'lap1', 'prn', 'app']; // where generic rules fire on harmless activity
const pts = (ids) => ids.map((id) => `${NODES[id][0]} ${NODES[id][1]}`).join(' L');

// mode: 'without' (generic rules) | 'with' (Ranger) | 'mini' (architecture thumbnail)
function netMap(mode) {
  const onPath = new Set(PATH);
  const edges = EDGES.map(([a, b]) => `<line class="rg-edge" x1="${NODES[a][0]}" y1="${NODES[a][1]}" x2="${NODES[b][0]}" y2="${NODES[b][1]}"/>`).join('');
  const halos = mode === 'without' ? '' : PATH.map((id) => `<circle class="rg-halo" cx="${NODES[id][0]}" cy="${NODES[id][1]}" r="17"/>`).join('');
  const nodes = Object.entries(NODES)
    .map(([id, [x, y, base]]) => [id, [x, y, id === 'db' && T.p.jewel ? esc(T.p.jewel.slice(0, 22)) : base]])
    .map(([id, [x, y, label]]) => `<g class="rg-n ${id === 'dc' || id === 'db' ? 'jewel' : ''}"><circle cx="${x}" cy="${y}" r="11"/>${mode === 'mini' ? '' : `<text x="${x}" y="${id === 'dc' ? y - 24 : y + 33}" text-anchor="middle">${label}</text>`}</g>`)
    .join('');
  let story = '';
  if (mode === 'without') {
    story =
      NOISE.map((id, i) => `<g class="rg-alert" style="--i:${i}"><circle cx="${NODES[id][0] + 12}" cy="${NODES[id][1] - 12}" r="9"/><text x="${NODES[id][0] + 12}" y="${NODES[id][1] - 8.5}" text-anchor="middle">!</text></g>`).join('') +
      `<path class="rg-atk" pathLength="100" d="M${pts(PATH)}"/>
       <g class="rg-tag bad"><rect x="463" y="262" width="124" height="28" rx="14"/><text x="525" y="281" text-anchor="middle">Missed</text></g>`;
  } else if (mode === 'with') {
    const [fx, fy] = NODES.fs;
    story = `<path class="rg-rest" d="M${pts(PATH.slice(3))}"/>
       <path class="rg-atk short" pathLength="100" d="M${pts(PATH.slice(0, 4))}"/>
       <g class="rg-catch"><circle cx="${fx}" cy="${fy}" r="17"/><path d="M${fx - 6} ${fy} l4 4.5 l8 -9"/></g>
       <g class="rg-tag good"><rect x="${fx - 62}" y="${fy - 52}" width="124" height="28" rx="14"/><text x="${fx}" y="${fy - 33}" text-anchor="middle">Detected</text></g>`;
  } else {
    story = `<path class="rg-mini-path" d="M${pts(PATH)}"/>`;
  }
  return `<svg class="rg-net ${mode}" viewBox="0 0 600 300" aria-hidden="true">${edges}${halos}${story}${nodes}</svg>`;
}

const drv = (ic, t, d, tone = '') => `<div class="rv-drv ${tone}">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`;
const step = (n, ic, t, d) => `<li style="--s:${n}"><span class="rg-num">${n}</span><span class="rg-step-ic">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span></li>`;
const why = (ic, t, d) => `<div class="rg-why">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`;

const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <h1 class="d-logo" data-p="ranger"><img src="brand/vellox-ranger.png" alt="Vellox Ranger, a Booz Allen product" /></h1>
        <p class="d-lead">${tx('lead', 'Detections built for your environment, <span>not someone else’s.</span>')}</p>
        ${prepared(ctx)}
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'Most detection content is written for a generic network. Ranger writes it for theirs.',
      points: [
        'Open with their world: “How many of your detection rules were written with your network in mind, and how many came in a vendor content pack?”',
        'Ranger in one sentence: AI agents learn their environment, work out how an attacker would actually move through it, and write the detections to catch that.',
        'It’s part of Booz Allen’s Vellox line of cyber products, alongside Reverser. It is a separate product from LayerOne.',
      ],
      ask: 'Who owns detection engineering on your team today, and how many rules are they looking after?',
      next: 'Let’s start with what goes wrong with detections today.',
    },
  },
  {
    id: 'noise',
    title: 'Generic rules miss what matters',
    html: () => `
      <div class="rg-split">
        <figure class="rg-map">${netMap('without')}
          <figcaption><span class="rg-key alert"></span>Alert from a generic rule <span class="rg-key atk"></span>A real attack path</figcaption>
        </figure>
        <div class="rv-drivers">
          ${drv('bell', 'Noise', 'Generic rules fire on harmless activity all day')}
          ${drv('eyeOff', 'Blind spots', 'The route an attacker would really take goes unwatched')}
          ${drv('clock', 'Dwell time', 'Attackers stay hidden while analysts chase alerts')}
        </div>
      </div>`,
    talk: {
      key: 'The problem isn’t too few rules. It’s rules that don’t know their network.',
      points: [
        '<b>Let the picture play, then point at it.</b> Yellow alerts keep going off on the printer, the web server, a laptop: harmless things. Meanwhile the red line walks from a phishing email to a laptop, through the file server, to the domain controller and the finance database. Nobody looks at it.',
        '<b>Why that happens:</b> most detection content is written for an average network. It doesn’t know which systems they have, how they connect, or which ones are actually exposed. So it’s loud where it doesn’t matter and quiet where it does.',
        '<b>The human cost:</b> analysts learn to tune out alerts. That’s alert fatigue, and it’s exactly where a real intrusion hides.',
        '<b>Dwell time is the business cost:</b> the longer an attacker sits in the network, the more they take and the more expensive the cleanup.',
        '<b>The picture is a simplified example.</b> If asked, it shows the pattern, not their network.',
      ],
      ask: 'Roughly what share of your alerts turn out to be nothing? And when did a rule last get written because of something specific to your network?',
      objection: '“We tune our rules already.” Good, and that’s the point: tuning by hand doesn’t keep up with a network that changes every week. Ranger starts from the network itself.',
      next: 'Ranger flips the approach: start from the inside.',
    },
  },
  {
    id: 'inside',
    title: 'Detection from the inside out',
    html: () => `
      <div class="rg-inside">
        <div class="rg-rings" aria-hidden="true">
          <div class="rg-sweep"></div>
          ${[4, 3, 2, 1].map((r) => `<i style="--r:${r}"></i><span class="rg-ring-n" style="--r:${r}">${r}</span>`).join('')}
          <span class="rg-core">${icon('radar')}<b>Your<br />environment</b></span>
        </div>
        <ol class="rg-steps">
          ${step(1, 'radar', 'Model your environment', 'Assets, network layout, vulnerabilities and telemetry')}
          ${step(2, 'globe', 'Add threat intelligence', 'Keep only the threats that apply to what you run')}
          ${step(3, 'target', 'Map exposure to MITRE ATT&amp;CK', 'Which techniques would actually work here, and where')}
          ${step(4, 'shieldPlus', 'Write and prioritize detections', 'Rules for the paths that matter most, first')}
        </ol>
      </div>`,
    talk: {
      key: 'Start from what they have, then decide what to watch, not the other way round.',
      points: [
        '<b>Read the rings from the middle out.</b> Everything starts with their environment, not a threat feed. Each ring narrows the world down to what matters to them.',
        '<b>1 · Model:</b> Ranger’s AI agents build a picture of the environment: what assets exist, how they connect, which have vulnerabilities, and what telemetry is available to detect with.',
        '<b>2 · Threat intel, filtered:</b> the latest threat intelligence is applied through that lens. A threat to software they don’t run is noise; it gets dropped.',
        '<b>3 · ATT&amp;CK:</b> exposures are mapped to MITRE ATT&amp;CK techniques, so coverage is measured in the language their team and auditors already use.',
        '<b>4 · Detections, ranked:</b> Ranger writes detection logic for their environment and ranks it, so the most exploitable paths get covered first.',
      ],
      ask: 'Do you have a current map of your environment that your detection team actually uses? Most teams don’t; that’s the gap Ranger fills.',
      objection: '“Isn’t this just attack path management?” Those tools show you exposure. Ranger takes the next step and writes the detections for it.',
      next: 'Here’s what that does to the same network.',
    },
  },
  {
    id: 'caught',
    title: 'The same network, with Ranger',
    html: () => `
      <div class="rg-split">
        <figure class="rg-map">${netMap('with')}
          <figcaption><span class="rg-key halo"></span>Path Ranger found and watches <span class="rg-key catch"></span>Detection fires</figcaption>
        </figure>
        <div class="rv-drivers">
          ${drv('check', 'Less noise', 'Rules only fire where they apply', 'good')}
          ${drv('route', 'Real coverage', 'Watching the paths an attacker would really use', 'good')}
          ${drv('clock', 'Caught early', 'Stopped at the file server, before the crown jewels', 'good')}
        </div>
      </div>`,
    talk: {
      key: 'Quieter where it doesn’t matter, sharper where it does.',
      points: [
        '<b>Same picture as before; point out what changed.</b> The yellow alerts are gone. The purple rings mark the path Ranger worked out an attacker would take, and the detection fires at the file server, two hops before the domain controller and the finance database.',
        '<b>Less noise</b> because rules are written for systems they actually have. Booz Allen positions this as fewer false positives, which means analyst time saved.',
        '<b>Shorter dwell time</b> because detections sit on the routes that lead to the crown jewels. Catching an attacker early is the difference between an incident and a breach.',
        '<b>Be careful with claims:</b> lower dwell time and fewer false positives are Booz Allen’s stated goals for the product. Don’t quote numbers; offer to measure it in a pilot.',
      ],
      ask: 'What are your crown jewels, the systems you’d least want an attacker to reach? That’s where a pilot would start.',
      next: 'And your engineers stay in control of every rule.',
    },
  },
  {
    id: 'control',
    title: 'Your engineers stay in charge',
    html: () => `
      <div class="rg-ctl">
        <div class="rg-pr">
          <div class="rg-pr-h">${icon('gitPr')}<span><small>Ranger opened a pull request</small><b>#214 · Detect credential dumping on ${jewel()} servers</b></span></div>
          <div class="rg-pr-tags"><span>ATT&amp;CK T1003</span><span>Priority: high</span><span>Laptop → file server → DC → ${jewel()}</span></div>
          <pre>title:    Credential dumping on ${jewel()} servers
hosts:    ${esc(hostPattern())}
when:     a process reads lsass.exe memory
  and:    the process is not an approved backup tool
priority: high</pre>
          <div class="rg-pr-why"><b>Why this rule:</b> these servers sit on a reachable path from user laptops, and you already collect the endpoint data to see it.</div>
          <div class="rg-pr-btns"><span class="rg-approve">${icon('check')}Approve</span><span class="rg-changes">Request changes</span></div>
        </div>
        <div class="rg-whys">
          ${why('gitPr', 'Reviewed like code', `New rules arrive as pull requests in ${review()}`)}
          ${why('help', 'Explains every rule', 'The asset, the exposure and the ATT&amp;CK technique behind it')}
          ${why('users', 'People decide', 'Engineers approve, edit or reject before anything ships')}
        </div>
      </div>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> ${tx('next', 'a pilot on your environment, compared side by side with your current rules.')}</span></div>`,
    talk: {
      key: 'Autonomous where it saves time, human-led where it matters.',
      points: [
        '<b>Walk through the pull request like an engineer would.</b> It says what to detect, where, which ATT&amp;CK technique, how important it is, and why it matters in their network. That “why” is what makes it reviewable.',
        '<b>It fits how detection teams already work:</b> detections as code, reviewed in GitHub or GitLab, with a history of who approved what. Nothing goes live without a person saying yes.',
        '<b>The rule on screen is a made-up example</b>; if they ask, the real rules are written for their tools and their data.',
        '<b>Close with a pilot:</b> run Ranger on a slice of their environment and compare it with their current rule set: coverage of their real attack paths, and alert volume. Deployment questions (where it runs, data handling, classification level, which SIEMs) go to the Booz Allen Vellox team; don’t guess.',
      ],
      ask: 'Do you manage detections as code today? If so, Ranger slots straight into that review process.',
      objection: '“We can’t let AI push rules to production.” It doesn’t. It opens a pull request; your engineers decide.',
      next: 'Open the Architecture tab for a closer look, or take questions.',
    },
  },
];

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
  context: async () => (T = await loadTailoring('ranger')),
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
