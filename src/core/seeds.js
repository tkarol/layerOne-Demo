// Ready-made customers and layouts, added once to whatever store the site runs on
// (the live Durable Object or the local files). Each seed runs a single time:
// after that it's ordinary data, so its owner can edit, copy or delete it and it
// won't come back.
import { validateProfile } from './profiles.js';
import { validateLayout } from './layouts.js';

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

export const SEEDS = [REINVENT];

export async function applySeeds(storage) {
  const done = (await storage.getKV(DONE_KEY)) || [];
  const todo = SEEDS.filter((s) => !done.includes(s.id));
  if (!todo.length) return;
  for (const s of todo) await s.apply(storage);
  await storage.putKV(DONE_KEY, [...done, ...todo.map((s) => s.id)]);
}
