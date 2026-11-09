// The event story: add-on slides on the Vellox page for a keynote-style talk across the
// whole suite (built for AWS re:Invent 2026). They're never in the official Vellox deck;
// a deck adds them in the slide editor (they show as "add-on"). Each product's "how it
// works" slide is borrowed from its own page, unchanged, so it stays in step with it.
//
// Facts, and where they come from (talk tracks name the source for every figure):
// - Product taglines, statuses and lines in quotes: Booz Allen's Vellox page
//   (boozallen.com/expertise/products/vellox.html, read November 2026). "SI" is
//   Booz Allen's term there: "Super Intelligence, previously referred to as AI".
// - Reverser on AWS: Booz Allen's AWS case study and the Reverser page (Amazon Bedrock
//   models power its agents). Partner status: Booz Allen's AWS Marketplace listing.
// - Threat figures: CrowdStrike 2026 Global Threat Report, Verizon 2026 DBIR, Mandiant
//   M-Trends 2026, IBM Cost of a Data Breach 2026, Lightspeed's 2026 CISO survey.
// - Incidents: CISA (Shai-Hulud, Sept 23, 2025), Anthropic (GTG-1002, Nov 2025),
//   Sysdig (JadePuffer, Jul 2026).
// The products are separate today and don't exchange data, so nothing here shows one
// feeding another: in the replay they work side by side.
import { icon, esc } from './deck-core.js';
import * as RV from './reverser-slides.js';
import * as RG from './ranger-slides.js';
import * as NV from './navigator-slides.js';
import * as L1 from './layerone-slides.js';

const GROUP = 'event story';

// Official wording from the Vellox page.
const OFFICIAL = {
  reverser: { logo: 'brand/vellox-reverser.png', head: 'Malware Analysis at SI Speed', desc: 'A malware reverse engineering and threat intelligence product. It performs exhaustive malware analysis in minutes so your team can respond faster.' },
  ranger: { logo: 'brand/vellox-ranger.png', head: 'Adaptive Defense at SI Speed', desc: 'An SI-powered detection engineering product that autonomously maps your environment to surface and stop adversary activity, reducing dwell time and cutting false positives.' },
  navigator: { logo: 'brand/vellox-navigator.svg', head: 'Compliance that keeps up', desc: 'The live cyber compliance command layer that autonomously interprets and controls enterprise security in real time.' },
  layerone: { logo: 'brand/vellox-layerone.png', head: 'Automate without adding risk', desc: 'The mission-grade compliance gateway for SI agents that enables high-stakes teams to automate without adding risk.' },
};

// What leaders ask (slide 4), answered product by product (slides 5 to 13).
const ASKS = {
  reverser: { q: 'When something new hits, how fast can we understand it?', stat: '4 min', fact: 'from initial access to data theft, in one intrusion', src: 'CrowdStrike 2026 Global Threat Report' },
  ranger: { q: 'Is someone already inside, and would we see them?', stat: '14 days', fact: 'median time attackers stayed unseen, up from 11', src: 'Mandiant M-Trends 2026' },
  navigator: { q: 'Can we prove we’re secure today, not just at the last audit?', stat: '43 days', fact: 'median time to fix a known vulnerability', src: 'Verizon 2026 DBIR' },
  layerone: { q: 'What are our AI agents doing, and who said they could?', stat: '1 in 5', fact: 'companies running AI agents has a full inventory of them', src: 'Lightspeed CISO survey, 2026' },
};

const PROOF = {
  reverser: [
    ['monitor', 'Runs it and reads it', 'Detonates the sample in a sandbox and has AI agents analyze every function of its code'],
    ['zap', 'Minutes, not weeks', 'Exhaustive analysis in minutes (vendor-reported)'],
    ['shieldPlus', 'Defenses out', 'YARA rules, indicators, MITRE ATT&amp;CK mapping and reports'],
  ],
  ranger: [
    ['radar', 'Maps your environment', 'Assets, connections, vulnerabilities and telemetry'],
    ['route', 'Follows the attacker’s path', 'Finds the routes that would really work against you'],
    ['gitPr', 'Writes detections for it', 'Ranked by real attack paths; your engineers approve every rule'],
  ],
  navigator: [
    ['inbox', 'Evidence, collected', 'Straight from the systems and tools you already run'],
    ['link', 'Mapped to your controls', 'So you can see exactly what proves what'],
    ['file', 'Package always current', 'Gaps flagged as they appear; every status traces to evidence'],
  ],
  layerone: [
    ['shield', 'One gateway', 'Every request your AI agents make passes through it'],
    ['eyeOff', 'Checked both ways', 'Personal data, hidden instructions and risky answers caught'],
    ['ledger', 'Recorded', 'A defensible audit record of every decision'],
  ],
};

const STATS = [
  ['29 min', 'average time for criminals to move beyond their first foothold. Fastest: 27 seconds.', 'CrowdStrike 2026 GTR'],
  ['31%', 'of breaches started with an exploited vulnerability, now the top way in', 'Verizon 2026 DBIR'],
  ['14 days', 'median time attackers stayed inside before anyone found them', 'Mandiant M-Trends 2026'],
  ['$4.99M', 'average cost of a breach, a record high', 'IBM Cost of a Data Breach 2026'],
];
const INCIDENTS = [
  ['Sep 2025', 'Shai-Hulud', 'A self-replicating worm spread through 500+ npm packages, stealing developers’ GitHub tokens and cloud keys.', 'CISA'],
  ['Nov 2025', 'GTG-1002', 'The first reported AI-orchestrated espionage campaign: about 30 targets, with AI agents doing most of the hands-on work.', 'Anthropic'],
  ['Jul 2026', 'JadePuffer', 'An AI agent ran an extortion intrusion end to end, from an exposed AI app server to the production database.', 'Sysdig'],
];

// A product's "how it works" slide from its own page, shown here unchanged.
function borrow(mod, id, newId, scope) {
  const s = mod.SLIDES.find((x) => x.id === id);
  return { ...s, id: newId, as: id, scope, optional: true, group: GROUP };
}

export function eventSlides({ P, chip, tx }) {
  const booth = () => tx('booth', '');
  const intro = (k) => {
    const p = P[k];
    const o = OFFICIAL[k];
    const a = ASKS[k];
    return {
      id: `ev-${k}`,
      optional: true,
      group: GROUP,
      title: `Vellox ${p.name}`,
      titleHidden: true, // the official logo is the title
      html: () => `
        <div class="ev-intro">
          <div class="ev-intro-l">
            <img class="ev-intro-logo ${k}" src="${o.logo}" alt="Vellox ${p.name}, a Booz Allen product" />
            <div class="ev-intro-meta"><span class="vx-status ${p.status}">${p.status === 'ga' ? 'Available now' : 'Limited preview'}</span><span class="ev-role">${icon(p.icon)}${esc(p.role)}</span></div>
            <h2 class="ev-intro-h">${esc(o.head)}</h2>
            <p class="ev-intro-d">${esc(o.desc)}</p>
            ${k === 'reverser' ? `<div class="ev-aws">${icon('sparkle')}<span><b>Built on AWS</b> · Amazon Bedrock models power its AI agents</span></div>` : ''}
          </div>
          <div class="ev-intro-r">
            <div class="ev-ask"><span>The question it answers</span><b>“${esc(a.q)}”</b></div>
            ${PROOF[k].map(([ic, t, d], i) => `<div class="ev-proof" style="--i:${i}"><span class="d-ic">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('')}
          </div>
        </div>`,
      talk: INTRO_TALK[k],
    };
  };

  return [
    {
      id: 'ev-welcome',
      optional: true,
      group: GROUP,
      title: 'Why we’re at re:Invent',
      html: () => `
        <div class="ev-welcome">
          <div class="ev-why3">
            ${[
              ['sparkle', 'You’re building with AI on AWS', 'Agents, copilots and automated pipelines are moving into production.'],
              ['alert', 'So are attackers', 'AI-run intrusions aren’t a forecast anymore. They’re documented, and they’re fast.'],
              ['landmark', 'Booz Allen and AWS', 'AWS Premier Tier Services Partner · AWS Federal Government Partner of the Year, 2024 and 2025 · Vellox Reverser is built on AWS.'],
            ]
              .map(([ic, t, d], i) => `<div class="ev-card" style="--i:${i}"><span class="d-ic">${icon(ic)}</span><b>${t}</b><p>${d}</p></div>`)
              .join('')}
          </div>
          <div class="ev-agenda">
            <span class="ev-agenda-h">${icon('clock')}Our time today</span>
            ${['The threat, by the numbers', 'What leaders tell us', 'Vellox, product by product', 'Vellox in practice', 'See it live'].map((t, i) => `<span class="ev-step" style="--i:${i}"><i>${i + 1}</i>${t}</span>`).join('')}
          </div>
          ${booth() ? `<div class="ev-booth">${icon('users')}<span>Find us at <b>${booth()}</b></span></div>` : ''}
        </div>`,
      talk: {
        key: 'Everyone here is building with AI on AWS. Attackers are too. That’s why we’re here.',
        points: [
          '<b>Open with the room:</b> “Show of hands: who has an AI agent or copilot in production, or about to be?” Most hands go up. That’s the point of this talk.',
          '<b>Then the turn:</b> attackers have the same tools. AI-run intrusions are now documented in public reports, and you’ll see four in a minute.',
          '<b>Why Booz Allen, why here:</b> Booz Allen is an AWS Premier Tier Services Partner and was AWS’s Federal Government Partner of the Year in 2024 and 2025 (Booz Allen’s AWS Marketplace listing). Vellox Reverser itself is built on AWS: Amazon Bedrock models power its AI agents (AWS case study and the Reverser page).',
          '<b>Set the agenda:</b> the threat in numbers, what security leaders tell us keeps them up, the four Vellox products, a real attack replayed, and where to see it live.',
          'Add your booth or room in <b>✎ Customer</b> (Booth field) and it shows on this slide and the last one.',
        ],
        ask: 'Who here has an AI agent in production today, or will by spring?',
        next: 'Let’s start with what we’re up against.',
      },
    },
    {
      id: 'ev-threat',
      optional: true,
      group: GROUP,
      title: 'The threat, by the numbers',
      html: () => `
        <div class="ev-threat">
          <div class="ev-stats">
            ${STATS.map(([n, t, s], i) => `<div class="ev-stat" style="--i:${i}"><b>${n}</b><p>${t}</p><small>${s}</small></div>`).join('')}
          </div>
          <div class="ev-tl">
            <span class="ev-tl-h">Recent headlines</span>
            <div class="ev-tl-items">
              ${INCIDENTS.map(([d, n, t, s], i) => `<div class="ev-inc" style="--i:${i}"><span class="ev-inc-dot"></span><em>${d}</em><b>${n}</b><p>${t}</p><small>${s}</small></div>`).join('')}
            </div>
          </div>
        </div>`,
      talk: {
        key: 'Attackers got faster, and AI is now doing some of the work. Defense still runs at human speed.',
        points: [
          '<b>Top row, read two numbers, not four:</b> 29 minutes is the average time a criminal needs to move beyond the first machine they compromise, and the fastest seen was 27 seconds (CrowdStrike 2026 Global Threat Report, covering 2025). Then 14 days: the median time attackers stayed inside before anyone found them, up from 11 (Mandiant M-Trends 2026). Fast in, slow to be found.',
          '<b>The other two:</b> exploited vulnerabilities passed stolen credentials as the top way in, at 31% of breaches, a first in the report’s 19 years (Verizon 2026 DBIR). The average breach now costs $4.99M, a record (IBM Cost of a Data Breach 2026).',
          '<b>Bottom row, the pattern:</b> a self-spreading software supply chain attack (Shai-Hulud, in npm) and two attacks run largely by AI agents (GTG-1002, reported by Anthropic, and JadePuffer, reported by Sysdig).',
          '<b>Be precise if asked:</b> Anthropic’s estimate that AI did most of GTG-1002’s hands-on work has been questioned by some researchers. Sysdig calls JadePuffer the first end-to-end agentic ransomware operation; others describe it more cautiously.',
        ],
        ask: 'Which of these four would have hit you hardest?',
        objection: '“These are vendor numbers.” They are, and they agree with each other: different companies, different data, same direction.',
        next: 'So what does that do to the people responsible for stopping it?',
      },
    },
    {
      id: 'ev-leaders',
      optional: true,
      group: GROUP,
      title: 'What keeps security leaders up at night',
      html: () => `
        <div class="ev-leaders">
          ${['reverser', 'ranger', 'navigator', 'layerone']
            .map((k, i) => {
              const a = ASKS[k];
              return `<div class="ev-q" style="--i:${i}"><b class="ev-q-t">“${esc(a.q)}”</b><div class="ev-q-s"><strong>${a.stat}</strong><span>${esc(a.fact)}</span></div><small>${esc(a.src)}</small></div>`;
            })
            .join('')}
        </div>
        <p class="ev-poll">${icon('chat')}Which one is yours?</p>`,
      talk: {
        key: 'Four questions come up in nearly every conversation we have with security leaders.',
        points: [
          '<b>Read the questions, not the numbers.</b> Let each land for a second; the numbers are there to show it isn’t just a feeling.',
          '<b>Speed:</b> in one intrusion CrowdStrike tracked, data theft began within four minutes of initial access (2026 Global Threat Report).',
          '<b>Visibility:</b> attackers stayed unseen for a median 14 days in 2025 (Mandiant M-Trends 2026).',
          '<b>Proof:</b> the median time to fix a known vulnerability is 43 days (Verizon 2026 DBIR), so the system you certified isn’t the one running today.',
          '<b>AI agents:</b> in Lightspeed’s 2026 CISO survey, only one in five companies using AI agents had a full inventory of them.',
        ],
        ask: '<b>Poll or show of hands:</b> which of these four keeps you up?',
        next: 'Those four questions are exactly why we built Vellox.',
        notes: 'Note the poll result: you can point back to it on the matching product slide.',
      },
    },
    {
      id: 'ev-why',
      optional: true,
      group: GROUP,
      title: 'Fight SI with SI: why we built Vellox',
      html: () => `
        <div class="ev-why">
          <div class="ev-why-l">
            <blockquote class="ev-quote">“We haven’t just studied the SI-powered adversary. We built it, to defeat it.”</blockquote>
            ${[
              ['target', 'Military-grade models', 'Agentic SI models trained on real adversary behaviors'],
              ['landmark', 'Experience built in', '30+ years of cyber expertise, tradecraft and insight'],
              ['layers', 'System compatible', 'Designed to work within your existing tech stack'],
            ]
              .map(([ic, t, d], i) => `<div class="ev-pillar" style="--i:${i}">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`)
              .join('')}
          </div>
          <div class="ev-map">
            ${['reverser', 'ranger', 'navigator', 'layerone']
              .map((k, i) => `<div class="ev-map-row" style="--i:${i}"><span class="ev-map-q">${esc(ASKS[k].q)}</span><span class="ev-map-arrow">${icon('arrow')}</span><span class="ev-map-p">${icon(P[k].icon)}<b>${P[k].name}</b></span></div>`)
              .join('')}
          </div>
        </div>`,
      talk: {
        key: 'Attackers now build with AI. Booz Allen built Vellox so defenders can, too: “Fight SI with SI.”',
        points: [
          '<b>Explain SI once:</b> it’s Booz Allen’s term on the Vellox page, Super Intelligence, “previously referred to as AI”. After that, just say AI agents if it reads better for the room.',
          '<b>The quote is Booz Allen’s:</b> its cyber operators work the offensive side, so the products start from how real adversaries operate.',
          '<b>Three pillars, from the Vellox page:</b> models trained on real adversary behavior, 30+ years of Booz Allen cyber experience, and built to fit the tools teams already run.',
          '<b>Right side, the map:</b> each question from the last slide has a product. That’s the structure of the next eight slides: what it is, then how it works.',
          '<b>People stay in charge:</b> AI agents do the volume; analysts and engineers approve what matters.',
        ],
        ask: 'Which of these do you want to see first? (If the room is clear, you can reorder.)',
        next: 'First question: when something new hits, how fast can you understand it?',
      },
    },
    intro('reverser'),
    borrow(RV, 'how', 'ev-reverser-how', 'rv-reverser'),
    intro('ranger'),
    borrow(RG, 'inside', 'ev-ranger-how', ''),
    intro('navigator'),
    borrow(NV, 'loop', 'ev-navigator-how', ''),
    intro('layerone'),
    borrow(L1, 'how', 'ev-layerone-how', ''),
    {
      id: 'ev-practice',
      optional: true,
      group: GROUP,
      title: 'Vellox in practice: a real worm, replayed',
      html: () => `
        <div class="ev-replay">
          <div class="ev-attack">
            <span class="ev-lane-h bad">${icon('alert')}The attack · Shai-Hulud</span>
            ${[
              ['A poisoned package', 'Trojanized versions published with stolen maintainer credentials'],
              ['Your build installs it', 'The install script runs on build servers and developer laptops'],
              ['It harvests secrets', 'GitHub tokens, AWS and other cloud keys'],
              ['It sends them out', 'Pushed to attacker-visible GitHub repositories'],
              ['It spreads', 'Republishes itself into more packages'],
            ]
              .map(([t, d], i) => `<div class="ev-atk" style="--i:${i}"><em>${i + 1}</em><b>${t}</b><small>${d}</small></div>`)
              .join('')}
          </div>
          <div class="ev-defense">
            <span class="ev-lane-h">${icon('shield')}With Vellox, side by side</span>
            ${[
              // [product, what it does, first and last attack step it covers]
              ['ranger', 'Flags the install script on the build servers and laptops that hold your cloud keys', 2, 4],
              ['reverser', 'Payload taken apart in minutes: what it steals, where it sends it', 2, 3],
              ['navigator', 'Which systems ran it, keys rotated, package current', 4, 5],
              ['layerone', 'AI coding agents now choose and install packages: every request they make is checked and logged', 1, 5],
            ]
              .map(([k, d, a, b], i) => `<div class="ev-def" style="--i:${i}"><span class="ev-def-p">${icon(P[k].icon)}<b>${P[k].name}</b></span><span class="ev-def-bar" style="grid-column:${a + 1} / ${b + 2}">${d}</span></div>`)
              .join('')}
          </div>
          <p class="ev-replay-note">Illustrative replay of a real incident (CISA alert, Sept 23, 2025; a second wave followed in November). The products work side by side and don’t exchange data today.</p>
        </div>`,
      talk: {
        key: 'Same attack, two outcomes: found by luck weeks later, or understood and caught in the first hours.',
        points: [
          '<b>Top row, the real attack:</b> in September 2025 CISA warned that a self-replicating worm, Shai-Hulud, had compromised more than 500 npm packages. Installing an affected package ran its script, which searched for credentials (GitHub tokens, cloud keys) and used stolen access to spread further. A second wave followed in November.',
          '<b>Why it fits this room:</b> the stolen keys included AWS keys, taken from developer laptops and build servers.',
          '<b>Ranger:</b> its detections are written for their environment, so the systems that hold cloud keys and lead to production are where it watches hardest.',
          '<b>Reverser, at the same time:</b> the payload is taken apart in minutes, producing YARA rules and indicators to sweep every other system.',
          '<b>Navigator, afterwards:</b> the question from the board is “were we affected, and did we fix it?” Navigator keeps the evidence and the authorization package current, so the answer is ready.',
          '<b>LayerOne, going forward:</b> AI coding agents now choose and install packages. LayerOne checks and logs every request they make. Don’t claim it would have blocked this worm.',
          '<b>Be precise:</b> this is an illustrative replay. The products run side by side and don’t pass data to each other today.',
        ],
        ask: 'If this had landed in your build pipeline, how long until you knew which keys to rotate?',
        objection: '“Our software composition analysis tool would catch it.” Maybe, once the package is known to be bad. The first hours are the gap: understanding a new payload and spotting it running on your systems.',
        next: 'So what does all this mean for you?',
      },
    },
    {
      id: 'ev-close',
      optional: true,
      group: GROUP,
      title: 'What Vellox means for you',
      html: () => `
        <div class="ev-close">
          <div class="ev-four">
            ${[
              ['ranger', 'Know', 'your environment'],
              ['reverser', 'Defend', 'your environment'],
              ['navigator', 'Assure', 'your environment'],
              ['layerone', 'Trust', 'your environment'],
            ]
              .map(([k, v, r], i) => `<div class="ev-verb" style="--i:${i}"><b>${v}</b><span>${r}</span><small>${icon(P[k].icon)}${P[k].name}</small></div>`)
              .join('')}
            <div class="ev-trust" style="--i:4"><b>Trust Vellox.</b></div>
          </div>
          <div class="ev-cta">
            <div class="ev-cta-h">${icon('users')}<b>${booth() ? `Come see it live at ${booth()}` : 'Come see it live'}</b></div>
            <ul>
              <li>${icon('bug')}Watch Reverser take apart a live sample</li>
              <li>${icon('shield')}Watch LayerOne catch a risky AI request</li>
              <li>${icon('chat')}Bring the question that keeps you up</li>
            </ul>
            <p class="ev-cta-link">${tx('cta', 'boozallen.com/expertise/products/vellox')}</p>
          </div>
        </div>`,
      talk: {
        key: 'Know your environment. Defend it. Assure it. Trust it. That’s Vellox.',
        points: [
          '<b>The four words come from Booz Allen’s Vellox film:</b> Know (Ranger maps your environment and adapts detection), Defend (Reverser exposes what malware does), Assure (Navigator keeps compliance true), Trust (LayerOne validates what AI agents do).',
          '<b>Go back to the poll:</b> “Most of you said X keeps you up. That’s the one to see at the booth.”',
          '<b>One clear ask:</b> come to the booth. Two demos run there: Reverser on a live sample and LayerOne catching a risky AI request.',
          '<b>Status, if asked:</b> Reverser, Ranger and Navigator are available now; LayerOne is in limited preview (Booz Allen’s Vellox page). Confirm with the Vellox team the week of the event.',
        ],
        ask: 'What would you want to see on your own data?',
        next: 'Questions.',
        notes: 'Set the booth (✎ Customer → Booth) and the line under the demos (✎ Customer → Closing line) before the event.',
      },
    },
  ];
}

const INTRO_TALK = {
  reverser: {
    key: 'Reverser answers the first question: when something new hits, you understand it in minutes, not weeks.',
    points: [
      '<b>Read the headline as written:</b> “Malware Analysis at SI Speed” is Booz Allen’s own line. Reverser takes a suspicious file apart and explains what it does.',
      '<b>Three things to say:</b> it runs the sample and reads its code; the analysis takes minutes rather than days or weeks (vendor-reported); and what comes out is defense you can deploy, not just a report.',
      '<b>For this audience:</b> Reverser is built on AWS. Amazon Bedrock models power its AI agents, with one orchestrator directing more than 20 subagents that cross-check each other (Reverser page; AWS case study).',
      '<b>Status:</b> available now.',
    ],
    ask: 'How long does a new sample wait in your queue today?',
    next: 'Here’s what happens inside those minutes.',
  },
  ranger: {
    key: 'Ranger answers the second question: is someone inside, and would we see them?',
    points: [
      '<b>Official line:</b> “Adaptive Defense at SI Speed.” Ranger maps their environment and writes the detections that fit it.',
      '<b>The difference:</b> most detection content is written for a generic network. Ranger starts from theirs: what they run, how it connects, and the paths an attacker would actually take.',
      '<b>People stay in charge:</b> new detections arrive as reviewable changes for their engineers to approve.',
      '<b>Status:</b> available now; it became generally available in July 2026.',
    ],
    ask: 'How many of your detections were written for your environment, rather than shipped with a tool?',
    next: 'Here’s how it works, from the inside out.',
  },
  navigator: {
    key: 'Navigator answers the third question: can we prove we’re secure today, not just at the last audit?',
    points: [
      '<b>Booz Allen’s description:</b> “the live cyber compliance command layer.” Compliance stops being a document rebuilt every year and becomes a live view of the system.',
      '<b>Why it matters:</b> systems change every day; authorization packages describe the system as it was. Navigator closes that gap continuously.',
      '<b>Trust:</b> every status traces back to evidence and a human decision.',
      '<b>Status:</b> available now.',
    ],
    ask: 'How many people-weeks does your next assessment cost you?',
    next: 'Here’s the loop that keeps it current.',
  },
  layerone: {
    key: 'LayerOne answers the fourth question: what are our AI agents doing, and who said they could?',
    points: [
      '<b>Booz Allen’s description:</b> “the mission-grade compliance gateway for SI agents that enables high-stakes teams to automate without adding risk.”',
      '<b>For this room:</b> every team here is wiring agents into real systems. LayerOne puts one checkpoint in front of every AI request, so the rules are set once instead of rebuilt in every app.',
      '<b>Three words:</b> gateway, checked, recorded.',
      '<b>Status:</b> limited preview. Say so plainly, and offer a preview conversation at the booth.',
    ],
    ask: 'How many different AI tools or agents are your teams using today?',
    next: 'Here’s what that gateway does, live.',
  },
};
