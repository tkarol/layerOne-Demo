// Vellox Navigator: the slides (and what they draw with), shared by this product's page and
// the Vellox page, which can show them in a deck that covers the whole suite. Moved
// here unchanged from navigator.js.
import { icon, esc } from './deck-core.js';

// Optional tailoring for one customer; empty means the standard version.
export let T = { p: {} };
// The page sets this once the customer details have loaded (live binding for importers).
export const setT = (t) => (T = t);
export const tx = (k, fallback) => (T.p[k] ? esc(T.p[k]) : fallback);
export const prepared = (ctx) => `${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}`;
export const system = () => tx('system', 'Case Management System');
export const reviewer = () => tx('reviewer', 'your security team');

export const drv = (ic, t, d) => `<div class="rv-drv">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`;
export const step = (n, ic, t, d) => `<li style="--s:${n}"><span class="rg-num">${n}</span><span class="rg-step-ic">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span></li>`;
export const why = (ic, t, d) => `<div class="rg-why">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`;

// Slide 2: what keeps changing in the systems while the paperwork stands still.
export const CHANGES = [
  ['New server', 6], ['Patch', 17], ['New admin', 28], ['Config change', 39],
  ['Firewall rule', 50], ['Cloud storage', 61], ['Patch', 72], ['New app', 83],
];
// Slide 4: an example authorization package, kept current.
export const CONTROLS = [
  ['Account management', 'Identity provider export', '2 min ago'],
  ['Audit logging', 'Log retention check', '6 min ago'],
  ['Configuration settings', 'Configuration scan', 'just now', 'gap'],
  ['Patching', 'Vulnerability scan', '14 min ago'],
  ['Encryption at rest', 'Cloud settings', '1 hr ago'],
];

export const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <h1 class="d-logo" data-p="navigator"><img src="brand/vellox-navigator.svg" alt="Vellox Navigator, a Booz Allen product" /></h1>
        <p class="d-lead">${tx('lead', 'Compliance that keeps pace with your systems, <span>not a snapshot that goes stale.</span>')}</p>
        ${prepared(ctx)}
      </div>
      <div class="d-orbit" aria-hidden="true"><div></div><div></div><div></div></div>`,
    talk: {
      key: 'Compliance should describe the system you have today, not the one you had at the last assessment.',
      points: [
        'Open with their world: “How long does it take your team to put together an authorization package, and how accurate is it a month later?”',
        'Navigator in one sentence: it keeps compliance running alongside the system: evidence collected automatically, mapped to controls, gaps flagged, and the package kept current.',
        'It’s part of Booz Allen’s Vellox line of cyber products, alongside Reverser and Ranger. It is a separate product from LayerOne.',
        '<b>Availability:</b> Navigator is generally available. Confirm supported frameworks and deployment options with the Vellox team before the meeting.',
      ],
      ask: 'How many systems are you keeping authorized today, and how many people does that take?',
      next: 'Let’s start with why compliance falls behind.',
    },
  },
  {
    id: 'drift',
    title: 'Signed today, stale tomorrow',
    html: () => `
      <div class="nv-drift" aria-label="Systems change continuously while the compliance package only changes at assessments">
        <div class="nv-lane">
          <div class="nv-lane-h"><b>Your systems</b><small>Change every day</small></div>
          <div class="nv-track sys">${CHANGES.map(([t, x], i) => `<span class="nv-chg" style="--x:${x}%;--i:${i}">${t}</span>`).join('')}</div>
        </div>
        <div class="nv-lane">
          <div class="nv-lane-h"><b>Your compliance package</b><small>Changes at assessments</small></div>
          <div class="nv-track pkg">
            <span class="nv-stamp">${icon('check')}Assessed</span>
            <span class="nv-gap"><i></i><em>Drift</em></span>
            <span class="nv-stamp next">Next assessment</span>
          </div>
        </div>
        <div class="nv-axis"><span>Signed</span><span>Months go by</span><span>Next review</span></div>
      </div>
      <div class="nv-drvs">
        ${drv('file', 'Screenshots and spreadsheets', 'Evidence gathered by hand, weeks before the audit')}
        ${drv('clock', 'True for a day', 'A point-in-time picture of systems that change daily')}
        ${drv('alert', 'Surprises at audit time', 'Gaps found late turn into findings and delays')}
      </div>`,
    talk: {
      key: 'Nobody is doing compliance wrong. The process was built for systems that didn’t change every day.',
      points: [
        '<b>Let the picture play.</b> Top lane: their systems keep changing: a new server, a patch, a new admin, a firewall rule. Bottom lane: the package was accurate the day it was assessed, and the red bar is everything that has changed since. Nobody updates the paperwork until the next review.',
        '<b>Tell it as a story:</b> a few weeks before the assessment, an engineer spends their evenings taking screenshots and filling spreadsheets to prove controls that were true months ago. It is expensive, it pulls people off real security work, and it is still a snapshot.',
        '<b>The risk isn’t the paperwork,</b> it’s the gap. Leaders sign off on a picture of the system that no longer matches reality, and the real gaps show up late, as findings, POA&amp;M items and delays.',
        '<b>This is a simplified example.</b> If asked, it shows the pattern, not their systems.',
      ],
      ask: 'When an assessor asks for evidence today, how long does it take to produce it, and who has to stop what they’re doing?',
      objection: '“We already do continuous monitoring.” Most programs monitor the systems; far fewer keep the package itself current. That’s the gap Navigator targets.',
      next: 'Navigator turns that snapshot into something that keeps running.',
    },
  },
  {
    id: 'loop',
    title: 'A living compliance layer',
    html: () => `
      <div class="rg-inside nv-loopwrap">
        <div class="nv-loop" aria-hidden="true">
          <svg viewBox="0 0 300 300"><circle class="nv-ring" cx="150" cy="150" r="112"/><circle class="nv-ring-flow" cx="150" cy="150" r="112" pathLength="100"/></svg>
          <div class="nv-orbit"><i></i></div>
          ${[['collect', 1], ['map', 2], ['gaps', 3], ['records', 4]].map(([k, n]) => `<span class="nv-node n${n}">${n}</span>`).join('')}
          <span class="nv-center">${icon('clock')}<b>Continuous</b><small>not once a year</small></span>
        </div>
        <ol class="rg-steps">
          ${step(1, 'inbox', 'Collect evidence automatically', 'Straight from the systems and tools you already run')}
          ${step(2, 'link', 'Tie evidence to controls', 'Each piece of evidence mapped to the control it proves')}
          ${step(3, 'alert', 'Flag gaps as they appear', 'Not weeks later, at assessment time')}
          ${step(4, 'file', 'Keep the package current', 'SSP content, POA&amp;Ms, assessments and authorization records')}
        </ol>
      </div>`,
    talk: {
      key: 'Same controls, same rigor; it just never stops running.',
      points: [
        '<b>Point at the loop:</b> this replaces a once-a-year project with a cycle that runs continuously. Booz Allen describes it as turning compliance into a living operating layer.',
        '<b>1 · Evidence:</b> Navigator automates evidence collection from the systems themselves, instead of screenshots taken by hand.',
        '<b>2 · Controls:</b> each piece of technical evidence is tied to the specific control it supports, so you can see exactly what proves what.',
        '<b>3 · Gaps:</b> when something drifts, it’s flagged when it happens, while it’s still cheap to fix.',
        '<b>4 · Records:</b> SSP content is built from that analysis, and POA&amp;Ms, assessments and authorization records stay current with the system.',
      ],
      ask: 'Which part of that cycle costs your team the most time today?',
      objection: '“Our GRC tool already tracks controls.” A GRC tool is where the records live. Navigator’s job is keeping them true: collecting the evidence and updating the records as the system changes.',
      next: 'Here’s what that looks like for one system.',
    },
  },
  {
    id: 'live',
    title: 'Your package, always current',
    html: () => `
      <div class="nv-live">
        <div class="nv-pkg">
          <div class="nv-pkg-h"><span>${icon('landmark')}<b>${system()}</b><small>${T.p.baseline ? `${esc(T.p.baseline)} · ` : ''}Authorization package</small></span><em><i></i>Live</em></div>
          <div class="nv-rows">
            ${CONTROLS.map(([c, ev, when, gap]) => `
              <div class="nv-row ${gap ? 'gap' : ''}">
                <b>${c}</b><span class="nv-ev">${icon('inbox')}${ev}</span><span class="nv-when">${when}</span>
                <span class="nv-st">${gap ? `<span class="ok">${icon('check')}Met</span><span class="bad">${icon('alert')}Gap</span>` : `<span class="ok">${icon('check')}Met</span>`}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="nv-feed">
          <span class="nv-feed-h">What Navigator did</span>
          <div class="nv-act a1">${icon('alert')}<span><b>Gap flagged</b><small>2 servers drifted from the approved configuration</small></span></div>
          <div class="nv-act a2">${icon('file')}<span><b>POA&amp;M item drafted</b><small>Ready for ${reviewer()} to review</small></span></div>
          <div class="nv-act a3">${icon('check')}<span><b>SSP updated</b><small>Configuration settings section reflects today</small></span></div>
        </div>
      </div>`,
    talk: {
      key: 'The package stops being a document you rebuild and becomes a view of the system you can trust.',
      points: [
        '<b>Walk the picture.</b> Five controls, each with the evidence behind it and how fresh it is: minutes, not months. Then a configuration change lands, the control flips to a gap, and Navigator flags it, drafts the POA&amp;M item and updates the SSP section, all for a person to review.',
        '<b>What changes for the team:</b> assessment prep stops being a fire drill. When an assessor or authorizing official asks, the evidence is already there.',
        '<b>What changes for leadership:</b> they can see compliance posture today, not as of the last assessment, and decide on risk with current information.',
        '<b>The system, controls and findings on screen are examples.</b> Which control frameworks Navigator supports is a question for the Vellox team; don’t guess.',
      ],
      ask: 'How do you find out today that a control has drifted: at the next assessment, or sooner?',
      next: 'And every one of those statuses can be explained.',
    },
  },
  {
    id: 'lineage',
    title: 'Every status has a reason',
    html: () => `
      <div class="nv-chain">
        <div class="nv-link" style="--k:0">${icon('inbox')}<small>Evidence</small><b>Configuration scan</b><span>Today, 09:14</span></div>
        <i class="nv-arrow" style="--k:0"></i>
        <div class="nv-link" style="--k:1">${icon('link')}<small>Control</small><b>Configuration settings</b><span>Mapped automatically</span></div>
        <i class="nv-arrow" style="--k:1"></i>
        <div class="nv-link" style="--k:2">${icon('alert')}<small>Finding</small><b>2 servers off baseline</b><span>Flagged at 09:15</span></div>
        <i class="nv-arrow" style="--k:2"></i>
        <div class="nv-link human" style="--k:3">${icon('users')}<small>Decision</small><b>POA&amp;M approved</b><span>Reviewed by ${reviewer()}</span></div>
      </div>
      <div class="nv-whys">
        ${why('link', 'Evidence lineage', 'Trace any status back to the evidence behind it')}
        ${why('users', 'People decide', 'Human review before findings and records change')}
        ${why('shield', 'Ready when asked', 'Justify a control, finding or package status on the spot')}
      </div>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> ${tx('next', 'an early-access look with one of your systems, compared side by side with its current package.')}</span></div>`,
    talk: {
      key: 'Automation they can defend: every status traces back to evidence and a human decision.',
      points: [
        '<b>Read the chain left to right:</b> a piece of evidence, the control it maps to, the finding it produced, and the person who made the call. That is evidence lineage, and it’s what lets a team justify why a control, finding or package status holds.',
        '<b>Human review stays in the loop:</b> Navigator does the collecting, mapping and drafting; people approve what changes.',
        '<b>Why assessors care:</b> a status with its evidence attached is faster to verify than a spreadsheet and a folder of screenshots.',
        '<b>Close with early access:</b> pick one system, run Navigator alongside the current process, and compare effort and accuracy. Availability, deployment and supported frameworks go to the Booz Allen Vellox team; don’t guess.',
      ],
      ask: 'Which system would be the best pilot: the one with the most painful package, or the one changing fastest?',
      objection: '“We can’t let AI decide our compliance status.” It doesn’t. It gathers and connects the evidence; people decide, and the record shows who decided what.',
      next: 'Open the Architecture tab for a closer look, or take questions.',
    },
  },
];
