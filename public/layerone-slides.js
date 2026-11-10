// Vellox LayerOne: the slides (and what they draw with), shared by this product's page and
// the Vellox page, which can show them in a deck that covers the whole suite. Moved
// here unchanged from deck.js.
import { icon, esc, outcome, goCard as go } from './deck-core.js';

// One request moving through the architecture picture (slides 2 and 3). `kind` sets its path:
// go / back (straight through, no checkpoint); through LayerOne: allow (pass), warn (goes
// through flagged, a request or an answer coming back) and block.
export const packet = (n, kind, label, after) =>
  `<span class="pk pk-${kind}" style="--n:${n}"><span class="a">${label}</span>${after ? `<span class="b">${after}</span>` : ''}</span>`;

// Each slide: what's on screen, plus talking points (a key message, what to say, and the lead-in to the next slide).
export const SLIDES = [
  {
    id: 'title',
    html: (ctx) => `
      <div class="d-title">
        <h1 class="d-logo" data-p="layerone"><img src="brand/vellox-layerone.png" alt="Vellox LayerOne, a Booz Allen product" /></h1>
        <p class="d-lead">Govern every AI request your organization makes, <span>in one place.</span></p>
        ${ctx.logo ? `<img class="d-cust-logo" src="${esc(ctx.logo)}" alt="" />` : ''}${ctx.prepared ? `<div class="d-for">Prepared for <b>${esc(ctx.prepared)}</b></div>` : ''}
      </div>
      <div class="d-orbit" aria-hidden="true"><div><i class="orb-dot"></i></div><div><i class="orb-dot"></i><i class="orb-dot b"></i></div><div></div></div>`,
    talk: {
      key: 'This is about using AI safely, not stopping it.',
      points: [
        'Open with their world, not the product: “Your teams are already using AI, officially or not. The real question is whether you can see it and steer it.”',
        'LayerOne in one sentence: a checkpoint every AI request passes through, so the rules live in one place instead of being rebuilt in every app.',
        'Set expectations: a couple of minutes of context, then real requests, live, with LayerOne switched on and off.',
      ],
      ask: 'Where is AI showing up in your work today: chat tools, copilots built into software, or agents that take actions?',
      next: 'Let’s start with why this matters.',
    },
  },
  {
    id: 'without',
    title: 'Today, AI goes straight to the models',
    html: () => `
      <div class="d-arch2 off">
        <div class="d-end">${icon('monitor')}<b>Your apps<br />&amp; agents</b></div>
        <div class="d-wire"><span>request →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-void">${icon('x')}<b>No checkpoint</b><small>Nothing is checked, and nothing is recorded</small></div>
        <div class="d-wire"><span>any model →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-end">${icon('sparkle')}<b>AI<br />models</b></div>
        <div class="d-lane off" aria-hidden="true">
          ${packet(0, 'go', 'SSN 123-45-6789')}
          ${packet(1, 'go', 'Agency data → public model')}
          ${packet(2, 'go', '“Ignore previous instructions…”')}
          ${packet(3, 'back', '“Per rule 7.42(q), guaranteed…”')}
        </div>
      </div>
      <div class="d-outcomes live off">
        ${outcome('bad', 'Data leaves', 'SSNs and CUI sent out')}
        ${outcome('bad', 'Unapproved models', 'Public models, unseen')}
        ${outcome('bad', 'Manipulated AI', 'Hidden instructions obeyed')}
        ${outcome('bad', 'Wrong answers', 'Made-up rules read as fact')}
      </div>
      <p class="d-note bad">And afterwards, no record of what was sent, or where.</p>`,
    talk: {
      key: 'Nobody here is a bad actor. Helpful people and helpful tools are moving faster than the controls.',
      points: [
        '<b>Point at the empty box in the middle.</b> Today, nothing sits between your people and the models. Watch the traffic: an SSN, agency data headed for a public model, a hidden instruction, and a made-up answer coming back all go straight through, and each risk tile lights up as it lands.',
        '<b>Tell it as a story.</b> Picture a caseworker at 4:45 on a Friday with a backlog. They paste a claimant’s email into a chat tool to draft a reply: name, SSN, date of birth. Nothing malicious; they’re trying to help. That data now sits with a provider the agency has no agreement with, and there’s no way to pull it back.',
        '<b>Why blocking doesn’t work.</b> Ban AI outright and people move it to personal phones and laptops, where you see even less. The goal is a safe default path, not a wall.',
        '<b>Agents raise the stakes.</b> With a chat tool, a bad answer is a bad paragraph. With an agent that can send email, update records or query a database, a hidden instruction becomes an action. The more useful the agent, the bigger the blast radius.',
        '<b>The problem with wrong answers</b> isn’t that AI is sometimes wrong; people are too. It’s that it’s wrong confidently, perfectly formatted, citing a rule that looks real. Busy people trust confident text.',
        '<b>The accountability test:</b> if your IG asked tomorrow which AI models touched personal data last quarter, and what was sent, could you answer? For most organizations the honest answer today is no.',
      ],
      ask: 'Which of these four worries you most? Let their answer decide which demo you open first.',
      // The next slide keeps this picture and fills the empty box.
      objection: '“We already have an AI policy” or “we have DLP.” A policy tells people what to do, and network tools see encrypted traffic, not the prompt. Neither one stops a request. That’s the gap on the next slide.',
      next: 'Now, the same picture with one thing added.',
    },
  },
  {
    id: 'how',
    title: 'One gateway for every AI request',
    html: () => `
      <div class="d-arch2">
        <div class="d-end">${icon('monitor')}<b>Your apps<br />&amp; agents</b></div>
        <div class="d-wire"><span>request →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-core">
          <div class="d-core-h">${icon('shield')}<b>LayerOne</b></div>
          <ol>
            <li><span>1</span>Check the request</li>
            <li><span>2</span>Route to an approved model</li>
            <li><span>3</span>Check the answer</li>
            <li><span>4</span>Record the decision</li>
          </ol>
          <div class="d-now" aria-hidden="true">
            <span class="ok">✓ Normal request: allowed</span>
            <span class="warn">⚠ Bulk export: allowed, flagged</span>
            <span class="bad">⛔ Hidden instruction: blocked</span>
            <span class="warn">⚠ Made-up rule: answer flagged</span>
          </div>
        </div>
        <div class="d-wire"><span>approved →</span><i></i><i class="back"></i><span>← answer</span></div>
        <div class="d-end">${icon('sparkle')}<b>AI<br />models</b></div>
        <div class="d-lane on" aria-hidden="true">
          ${packet(0, 'pass', 'Draft a reply')}
          ${packet(1, 'warn', 'Export 5,000 case records', '⚠ Flagged')}
          ${packet(2, 'block', '“Ignore previous instructions…”')}
          ${packet(3, 'warnback', '“Per rule 7.42(q), guaranteed…”', '⚠ Unverified claim')}
        </div>
      </div>
      <div class="d-outcomes live on three">
        ${outcome('ok', 'Allow', 'Normal work flows')}
        ${outcome('warn', 'Warn', 'Goes through, flagged and recorded')}
        ${outcome('bad', 'Block', 'Never reaches a model')}
      </div>
      <p class="d-note">Drop-in: an OpenAI-compatible base URL and a few headers · hosted or self-hosted</p>`,
    talk: {
      key: 'Invisible when everything is fine, decisive when it isn’t.',
      points: [
        '<b>Use an analogy:</b> one security checkpoint at the front door instead of a different lock on every office. Set the rules once, and every app and agent inherits them.',
        '<b>Let the traffic play once:</b> a normal request is allowed, a bulk export goes through with a warning, the hidden instruction is blocked at LayerOne, and the made-up answer comes back with a warning attached. Three decisions: allow, warn, block. The four steps inside LayerOne light up as it works.',
        '<b>Two moments matter:</b> before a model sees the request, and before a person sees the answer. That’s where LayerOne acts.',
        '<b>Most traffic is simply allowed,</b> and that’s the point. If governance slows people down, they route around it.',
        '<b>The record is the quiet win:</b> every decision is tied to an agent, project and run, so an audit question takes minutes, not weeks of digging.',
        '<b>Adoption is a configuration change:</b> teams keep their tools and point them at a new URL with a few headers. Hosted or in their own environment.',
      ],
      ask: 'How many different AI tools or vendors are your teams using? Each one is somewhere you’d otherwise have to build these controls yourself.',
      objection: '“Won’t this slow things down?” Don’t promise a number. Show it: the demo displays the real time of every request.',
      next: 'Rather than tell you, let me show you.',
    },
  },
  {
    id: 'demo',
    title: 'Let’s see it',
    html: () => `
      <p class="d-sub">Real requests through LayerOne. Switch it off to see the difference; every request is in Behind the scenes.</p>
      <div class="d-grid d-4 d-demo">
        ${go('apps:chat', 'chat', 'Ask AI', 'A company AI chat')}
        ${go('apps:benefits', 'landmark', 'A day in the life', 'Claims · proposals · public agent · intel')}
        ${go('apps:call', 'users', 'Live call assist', 'AI listening to a call')}
        ${go('apps:batch', 'layers', 'Batch review', '20 FOIA records at once')}
        ${go('apps:agent', 'zap', 'Agent with admin tools', 'It plans, then acts')}
        ${go('apps:scrape', 'search', 'Web scraper → database', 'Poisoned pages')}
        ${go('apps:ground', 'file', 'Grounded answers', 'Checked against the sources')}
        ${go('apps:data', 'db', 'AI and your data', 'An agent on a database')}
      </div>`,
    talk: {
      key: 'Let them see it catch real problems, then flip it off and see what gets through.',
      points: [
        '<b>Set it up:</b> “Everything you’re about to see is a real request going through LayerOne. I’ll also switch it off, so you can see exactly what it’s catching.”',
        '<b>Let them choose</b> the scenario closest to their mission; people lean in when it looks like their own job.',
        '<b>Rule of thumb:</b> short slot or a mixed audience, Ask AI. Program or mission staff, A day in the life (pick the mission closest to them). Contact centers, Live call assist. Records or claims shops, Batch review. Anyone building agents, the agent with admin tools or AI and your data. Teams building on web or open-source data, the web scraper. Anyone worried about hallucination, Grounded answers. Security or engineering, finish in Behind the scenes, then Connect.',
      ],
      ask: 'Which of these looks most like your day-to-day?',
      next: 'Click a card to start.',
    },
  },
];
