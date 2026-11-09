// Ready-made customers and layouts, added once to whatever store the site runs on
// (the live Durable Object or the local files). Each seed runs a single time:
// after that it's ordinary data, so its owner can edit, copy or delete it and it
// won't come back.
import { validateProfile } from './profiles.js';
import { validateLayout, keepVersion } from './layouts.js';

const DONE_KEY = 'seeds:applied';

// Tyler's AWS re:Invent webinar: the Vellox suite deck, retold for a large
// virtual audience (polls and chat prompts instead of discovery questions,
// timing cues, a single call to action). Product facts match the Vellox page;
// the AWS line comes from AWS's public Booz Allen case study.
const REINVENT = {
  id: 'reinvent-webinar-2026',
  customer: {
    id: 'p_a75e1e2026',
    owner: 'tyler',
    name: 'AWS re:Invent',
    color: '#ff9900',
    pitch: { vellox: { next: 'book a 30-minute working session, and pilot the product that fits your biggest bottleneck on your own data.' } },
  },
  layout: {
    id: 'l_a75e1e2026',
    owner: 'tyler',
    deck: 'vellox',
    name: 'AWS re:Invent webinar',
    titles: { start: 'Where to start after today' },
    talk: {
      title: {
        key: 'Welcome, everyone joining for re:Invent. In the next 20 minutes: Vellox, Booz Allen’s four AI-native cyber products, and how to pick where to start.',
        points: [
          '**Open warm, then frame it:** thank the host, introduce yourself in one line, and say what they’ll leave with: a map of the four products and one clear next step.',
          '**Speak to this audience:** re:Invent attendees build and run on AWS. Vellox Reverser is itself built on AWS as a serverless product (AWS’s Booz Allen case study). Check what’s approved to say about the other products before claiming more.',
          '**Housekeeping:** questions go in the Q&A box and we’ll take them at the end; confirm with the host whether the recording and slides go out afterwards.',
        ],
        ask: '**Poll:** What’s your biggest bottleneck today: malware analysis, detections that fit your environment, compliance paperwork, or governing AI agents?',
        next: 'First, why this matters now.',
        notes: 'About 2 min. Launch the poll here and leave it open through slide 2; read the results out before slide 3. Present full screen; keep these notes on your other screen.',
      },
      shift: {
        key: 'AI made attacking faster and cheaper, and defense still runs on a few experts and manual work. That gap is what this session is about.',
        points: [
          '**The chart is a picture, not data:** say so. Attacker capability climbs with AI; defense grows slowly.',
          '**Read the poll results** and tie them to the four rows on the right: “Most of you said compliance, that’s this one.”',
          '**Keep it general:** there’s no single customer in the room, so cite one public threat report instead of anyone’s numbers. Pick it before the session.',
        ],
        ask: '**Chat prompt:** Which of these four are you feeling most? Drop it in the chat.',
        next: 'Here’s the suite that answers those four.',
        notes: 'About 3 min. Close the poll and share the results before moving on.',
      },
      suite: {
        key: 'Four products, each aimed at one bottleneck, all built the same way: AI agents do the volume, people make the decisions.',
        points: [
          '**Reverser** (generally available): AI agents reverse engineer malware and produce detections, indicators and reports in minutes instead of days or weeks (vendor-reported). Built on AWS.',
          '**Ranger** (generally available): models the environment, finds the paths an attacker would take, and writes detections ranked for those paths.',
          '**Navigator** (generally available): collects evidence, maps it to controls and keeps the authorization package current.',
          '**LayerOne** (limited preview): a governance gateway for AI agents; every request is checked against policy and logged before it reaches a model.',
          '**On a webinar, mention the product pages, don’t open them:** each has its own deep dive for follow-up meetings.',
        ],
        ask: '**Q&A cue:** Already using something for one of these? Tell us in the Q&A and we’ll compare at the end.',
        objection: '“Is this only for government?” It’s built for mission-critical environments; Booz Allen describes Reverser as supporting both public- and private-sector teams. Confirm deployment options with the Vellox team.',
        next: 'Here’s what each one does when a new threat lands.',
        notes: 'About 4 min. Check product statuses with the Vellox team the week of the session.',
      },
      together: {
        key: 'When a new threat lands, Ranger and Reverser go to work at the same time, and Navigator and LayerOne run in the background.',
        points: [
          '**Let it play before you talk** (about 8 seconds) and keep your cursor still: screen sharing compresses motion.',
          '**Narrate:** new malware arrives. Ranger’s detections flag it on the systems that matter while Reverser takes the sample apart. Your analysts decide with both answers in hand. Navigator keeps compliance current and LayerOne governs the AI throughout.',
          '**Be precise:** the products are separate today and don’t pass data to each other. Don’t promise integrations.',
        ],
        ask: '**Poll:** Today, how long from a new malware sample to knowing what it does: hours, days or weeks?',
        objection: '“Do they work together?” Separate products today, each useful on its own, which is also why it’s easy to start with one.',
        next: 'Why Booz Allen built it this way.',
        notes: 'About 4 min. Run the second poll while you narrate; read the result before slide 5.',
      },
      why: {
        key: 'Vellox comes from Booz Allen’s cyber mission work: people who think like attackers built the defense.',
        points: [
          '**Adversary tradecraft:** the products start from how attackers actually work: the paths they take and the code they write.',
          '**Humans make the calls:** webinar audiences ask about trusting AI. Nothing here takes people out of the loop: detections are reviewed, compliance changes need approval, AI requests are governed.',
          '**Mission-grade:** built for the environments Booz Allen serves. Leave deployment specifics (environment, data handling, classification) to the follow-up.',
        ],
        ask: '**Q&A cue:** What would you need to see to trust AI agents with this work? Add it to the Q&A.',
        next: 'So where should you start?',
        notes: 'About 2 min.',
      },
      start: {
        key: 'Don’t try to adopt four products at once. Pick the bottleneck that hurts most and pilot that one on your own data.',
        points: [
          '**One call to action:** a 30-minute working session to scope a pilot. Paste the booking link in the chat now.',
          '**Stay in the deck:** the rows link to each product page, but on a webinar just mention them; they’re for follow-up.',
          '**Then Q&A:** take the most-upvoted questions first. Park pricing, integrations and deployment details for the follow-up with the Vellox team.',
        ],
        ask: 'Want a working session? Use the link in the chat, or say so in the Q&A and we’ll follow up after the session.',
        next: 'Open it up for questions.',
        notes: 'About 3 min, then Q&A. Have ready to paste in the chat: the booking link, the product page links, and the AWS case study link.',
      },
    },
  },
  async apply(storage) {
    const c = this.customer;
    if (!(await storage.getKV(`profile:${c.id}`))) {
      const { profile, ok } = validateProfile(c, c.id);
      if (ok) await storage.putKV(`profile:${c.id}`, { ...profile, owner: c.owner });
    }
    const l = this.layout;
    if (!(await storage.getKV(`layout:${l.id}`))) {
      const { layout, ok } = validateLayout({ ...l, customer: c.id });
      if (ok) await storage.putKV(`layout:${l.id}`, { ...layout, id: l.id, owner: l.owner });
    }
  },
};

// November 2026: Tyler's re:Invent deck becomes the 15-slide event story: the Vellox
// cover, then the event slides (public/vellox-event.js, add-ons on the Vellox page) with
// each product's own how-it-works slide. Runs once; the deck's previous version stays in
// its history (Deck settings → Earlier versions), and a deck its owner deleted stays gone.
const EVENT_ORDER = ['title', 'ev-welcome', 'ev-threat', 'ev-leaders', 'ev-why', 'ev-reverser', 'ev-reverser-how', 'ev-ranger', 'ev-ranger-how', 'ev-navigator', 'ev-navigator-how', 'ev-layerone', 'ev-layerone-how', 'ev-practice', 'ev-close'];
const min = (m) => `About ${m} min.`;
const REINVENT_EVENT = {
  id: 'reinvent-event-story-2026',
  part: {
    order: EVENT_ORDER,
    hidden: ['shift', 'suite', 'together', 'why', 'start'], // the official Vellox slides this story replaces
    talk: {
      title: {
        key: 'Welcome to re:Invent. In the next 25 minutes: how AI changed the threat, what security leaders tell us keeps them up, and how Vellox answers it.',
        points: [
          '**Introduce yourself** and Booz Allen in one line.',
          '**Set expectations:** four products, one story, and a real attack replayed near the end. Live demos at the booth afterwards.',
          '**Present full screen** (F) and open the presenter view (P) on your laptop: these notes, the next slide and a timer.',
        ],
        ask: '',
        next: 'First, why we’re at re:Invent at all.',
        notes: `${min(1)} Before the event: add the booth in ✎ Customer → Booth (it shows on slides 2 and 15), and check product status with the Vellox team that week.`,
      },
      'ev-welcome': { notes: `${min(1.5)} Get the show of hands; it sets up everything after.` },
      'ev-threat': { notes: `${min(2.5)} Read two numbers (29 minutes, 14 days), then the four headlines. Sources are on the slide and in the points.` },
      'ev-leaders': { notes: `${min(2)} Run the poll (or show of hands) here and remember the answer for slide 15.` },
      'ev-why': { notes: `${min(2)} Explain “SI” once, then move on.` },
      'ev-reverser': { notes: `${min(1.5)} The AWS line lands well here: Reverser is built on AWS.` },
      'ev-reverser-how': { next: 'Second question: is someone already inside, and would you see them?', notes: `${min(1.5)} Let the animation run, then narrate.` },
      'ev-ranger': { notes: min(1.5) },
      'ev-ranger-how': { next: 'Third question: can you prove you’re secure today, not just at the last audit?', notes: `${min(1.5)} Read the rings from the middle out.` },
      'ev-navigator': { notes: min(1.5) },
      'ev-navigator-how': { next: 'Fourth question: what are your AI agents doing, and who said they could?', notes: min(1.5) },
      'ev-layerone': { notes: `${min(1.5)} Say “limited preview” plainly.` },
      'ev-layerone-how': { next: 'Now let’s put all four against a real attack.', notes: `${min(1.5)} Let the traffic play once.` },
      'ev-practice': { notes: `${min(3)} Walk the top row left to right, then the four bars. Close with “side by side, not integrated”.` },
      'ev-close': { notes: `${min(1.5)} Then questions. Point back to the poll result, and end on the booth.` },
    },
  },
  async apply(storage) {
    const id = REINVENT.layout.id;
    const deck = await storage.getKV(`layout:${id}`);
    if (!deck) return;
    const { layout, ok } = validateLayout({ name: 'AWS re:Invent 2026', products: { vellox: this.part } }, deck);
    if (!ok) return;
    await keepVersion(storage, deck);
    await storage.putKV(`layout:${id}`, { ...layout, id, owner: deck.owner, updatedBy: deck.owner });
  },
};

// Guests (people who look around without signing in) can open the re:Invent deck,
// read-only. Its owner can switch this off in Deck settings.
const REINVENT_GUESTS = {
  id: 'reinvent-guests-2026',
  async apply(storage) {
    const deck = await storage.getKV(`layout:${REINVENT.layout.id}`);
    if (deck && !deck.guests) await storage.putKV(`layout:${deck.id}`, { ...deck, guests: true });
  },
};

export const SEEDS = [REINVENT, REINVENT_EVENT, REINVENT_GUESTS];

export async function applySeeds(storage) {
  const done = (await storage.getKV(DONE_KEY)) || [];
  const todo = SEEDS.filter((s) => !done.includes(s.id));
  if (!todo.length) return;
  for (const s of todo) await s.apply(storage);
  await storage.putKV(DONE_KEY, [...done, ...todo.map((s) => s.id)]);
}
