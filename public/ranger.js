// Vellox Ranger: a separate product page from Layer One (like Vellox Reverser).
// A short pitch deck (slides + talking points) and an "under the hood"
// architecture explainer.
//
// Product facts come from Booz Allen's announcements (RSAC 2026 launch of the
// Vellox suite; Ranger generally available July 2026) and press coverage of them.
// Results such as less dwell time and fewer false positives are Booz Allen's own
// claims; the talking points say so. See SOURCES at the bottom.
import { createDeck, icon, $, esc } from './deck-core.js';

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
    html: () => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>Booz Allen · Vellox</div>
        <h1>Ranger</h1>
        <p class="d-lead">Detections built for your environment, <span>not someone else’s.</span></p>
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'Most detection content is written for a generic network. Ranger writes it for theirs.',
      points: [
        'Open with their world: “How many of your detection rules were written with your network in mind, and how many came in a vendor content pack?”',
        'Ranger in one sentence: AI agents learn their environment, work out how an attacker would actually move through it, and write the detections to catch that.',
        'It’s part of Booz Allen’s Vellox line of cyber products, alongside Reverser. It is a separate product from Layer One.',
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
          <div class="rg-pr-h">${icon('gitPr')}<span><small>Ranger opened a pull request</small><b>#214 · Detect credential dumping on finance DB servers</b></span></div>
          <div class="rg-pr-tags"><span>ATT&amp;CK T1003</span><span>Priority: high</span><span>Laptop → file server → DC → finance DB</span></div>
          <pre>title:    Credential dumping on finance DB servers
hosts:    FIN-DB-*
when:     a process reads lsass.exe memory
  and:    the process is not an approved backup tool
priority: high</pre>
          <div class="rg-pr-why"><b>Why this rule:</b> these servers sit on a reachable path from user laptops, and you already collect the endpoint data to see it.</div>
          <div class="rg-pr-btns"><span class="rg-approve">${icon('check')}Approve</span><span class="rg-changes">Request changes</span></div>
        </div>
        <div class="rg-whys">
          ${why('gitPr', 'Reviewed like code', 'New rules arrive as pull requests in GitHub or GitLab')}
          ${why('help', 'Explains every rule', 'The asset, the exposure and the ATT&amp;CK technique behind it')}
          ${why('users', 'People decide', 'Engineers approve, edit or reject before anything ships')}
        </div>
      </div>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> a pilot on your environment, compared side by side with your current rules.</span></div>`,
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

// ---------- architecture: under the hood ----------
const PARTS = {
  env: ['Your environment', 'Ranger starts from what you actually run: assets, network layout, vulnerabilities, telemetry and the rules you already have.'],
  cti: ['Threat intelligence', 'The latest cyber threat intelligence, filtered down to the threats that apply to your environment.'],
  model: ['Environment model', 'A model of your enterprise: what is there, how it connects, and where it is exposed.'],
  paths: ['Find exploitable paths', 'AI agents work out the routes an attacker could actually take through your network.'],
  attack: ['Map to MITRE ATT&CK', 'Each exposure is tied to the ATT&CK techniques an attacker would use, so coverage is measured in a common language.'],
  detect: ['Write and prioritize detections', 'Agents write detection logic for your environment and rank it, so the most important paths are covered first.'],
  fw: ['Agentic AI framework', 'Booz Allen’s own agentic AI framework runs the agents.'],
  pr: ['Pull request', 'New and changed rules arrive as pull requests in GitHub or GitLab, so your engineers review them like code.'],
  deploy: ['Your detection tools', 'Approved rules go to the tools where your detections run today.'],
};

const SOURCES = [
  ['Booz Allen: Vellox Ranger product page', 'https://www.boozallen.com/expertise/products/vellox/vellox-ranger.html'],
  ['Booz Allen newsroom: “Booz Allen Expands Mission-Grade Cyber Defense Product Suite” (July 2026)', 'https://newsroom.boozallen.com/news-releases/news-release-details/booz-allen-expands-mission-grade-cyber-defense-product-suite'],
  ['Booz Allen: “Booz Allen Launches Agentic Cyber Product Suite at RSAC 2026”', 'https://investors.boozallen.com/news-releases/news-release-details/booz-allen-launches-agentic-cyber-product-suite-rsac-2026'],
  ['ExecutiveBiz: Booz Allen Adds Vellox Ranger to AI Cyber Defense Suite', 'https://www.executivebiz.com/articles/booz-allen-vellox-ranger-ai-cyber-defense'],
  ['Help Net Security: Booz Allen expands Vellox Suite with AI-driven threat detection platform', 'https://www.helpnetsecurity.com/2026/07/27/booz-allen-hamilton-vellox-ranger/'],
  ['Booz Allen: Vellox product suite', 'https://www.boozallen.com/expertise/products/vellox.html'],
];

const st = { part: 'model' };

function drawArch(el) {
  const on = (k) => (st.part === k ? 'on' : '');
  const agent = (k, ic, t) => `<button type="button" class="rga-agent ${on(k)}" data-part="${k}">${icon(ic)}<b>${t}</b></button>`;
  el.innerHTML = `
    <div class="rva-head"><h2>Under the hood</h2><span class="muted">Click any part</span></div>
    <div class="uh rga">
      <div class="rga-ins">
        <button type="button" class="uh-side rga-in ${on('env')}" data-part="env">
          <span class="rga-in-h">${icon('monitor')}<b>Your environment</b></span>
          <span class="rga-chips"><span>Assets</span><span>Network layout</span><span>Vulnerabilities</span><span>Telemetry</span><span>Existing rules</span></span>
        </button>
        <button type="button" class="uh-side rga-in ${on('cti')}" data-part="cti">
          <span class="rga-in-h">${icon('globe')}<b>Threat intelligence</b></span>
          <small>The latest, filtered to what applies</small>
        </button>
      </div>
      <div class="uh-flow in" aria-hidden="true"><i></i></div>

      <div class="uh-box">
        <div class="uh-box-h">${icon('radar')}<b>Vellox Ranger</b></div>
        <button type="button" class="rga-model ${on('model')}" data-part="model">
          ${netMap('mini')}
          <span><b>Environment model</b><small>What you have, how it connects, where it’s exposed</small></span>
        </button>
        <div class="rga-down" aria-hidden="true"><i></i></div>
        <div class="rga-agents">
          <span class="rga-agents-h">AI agents</span>
          <div class="rga-row">
            ${agent('paths', 'route', 'Find exploitable paths')}
            <span class="rga-arrow" aria-hidden="true">${icon('arrow')}</span>
            ${agent('attack', 'target', 'Map to MITRE ATT&amp;CK')}
            <span class="rga-arrow" aria-hidden="true">${icon('arrow')}</span>
            ${agent('detect', 'shieldPlus', 'Write &amp; prioritize detections')}
          </div>
        </div>
        <button type="button" class="rga-fw ${on('fw')}" data-part="fw"><b>Booz Allen agentic AI framework</b> runs every agent</button>
      </div>

      <div class="uh-flow out" aria-hidden="true"><i></i></div>
      <div class="rga-outs">
        <button type="button" class="uh-side rga-pr ${on('pr')}" data-part="pr">
          <span class="rga-in-h">${icon('gitPr')}<b>Pull request</b></span>
          <small>GitHub · GitLab</small>
        </button>
        <div class="rga-approve" aria-hidden="true">${icon('check')}Engineer approves</div>
        <button type="button" class="uh-side rga-deploy ${on('deploy')}" data-part="deploy">
          <span class="rga-in-h">${icon('shield')}<b>Your detection tools</b></span>
          <small>Where your rules run today</small>
        </button>
      </div>
    </div>
    <p class="rva-tip"><b>${esc(PARTS[st.part][0])}:</b> ${esc(PARTS[st.part][1])}</p>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">Public descriptions: Booz Allen’s announcements and press coverage. The three agent stages summarize the published approach (model the environment, add threat intelligence, map exposure to MITRE ATT&amp;CK, generate prioritized detections). Confirm integrations and deployment options with the Vellox team.</p></details>`;
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
  label: 'Vellox Ranger',
  storageKey: 'rg',
  onGoto: () => setView('architecture'),
});

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
deck.mount($('#rvDeck'));
drawArch($('#rvArchRoot'));
