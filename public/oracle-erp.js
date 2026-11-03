// Oracle Fusion Cloud ERP for state and local government: a standalone proof-of-concept
// page at /oracle-erp. It has nothing to do with the Booz Allen / Vellox pages:
// nothing links here and it doesn't appear in their product switch. It reuses
// the shared deck engine (deck-core.js) and the page chrome from styles.css.
//
// Product facts are kept general and come from Oracle's public material (see
// SOURCES). Agencies, funds, names and amounts on the slides are made up.
import { createDeck, icon, $, esc } from './deck-core.js';

const card = (ic, t, d, extra = '') => `<div class="erp-card">${icon(ic)}<b>${t}</b><p>${d}</p>${extra}</div>`;

// Slide 2: the patchwork of systems most finance offices run today.
const OLD = [
  ['sheet', 'Budget spreadsheets', 18, 16],
  ['db', 'Mainframe ledger', 74, 14],
  ['landmark', 'Grants database', 84, 56],
  ['file', 'Paper requisitions', 15, 62],
  ['users', 'Separate payroll', 52, 88],
  ['chart', 'Reports built by hand', 47, 44],
];
const OLD_LINKS = [[0, 1], [0, 5], [1, 5], [1, 2], [2, 5], [3, 5], [3, 4], [4, 2], [4, 5]];
const BROKEN = new Set(['1-2', '3-5', '4-5']);

// Slide 3: the modules around one shared foundation.
const MODS = [
  ['ledger', 'Financials', 'General ledger · payables · receivables · fund accounting', 15, 20],
  ['chart', 'Planning & budgeting', 'Budget development · position budgeting · forecasts', 50, 9],
  ['cart', 'Procurement', 'Requisitions · sourcing · contracts · supplier portal', 85, 20],
  ['landmark', 'Grants & projects', 'Federal & state awards · capital projects', 15, 80],
  ['building', 'Assets', 'Capital assets · depreciation · lease accounting', 50, 91],
  ['search', 'Reporting & analytics', 'Budget vs. actual · dashboards · data for the ACFR', 85, 80],
];

// Slide 4: one purchase, budget to report. The dot reaches station i at i/(n-1) of the run.
const STATIONS = [
  ['Budget adopted', 'Council approves the appropriation'],
  ['Requisition', 'Public Works requests $48,000'],
  ['Funds check', 'Is the budget there? Checked instantly'],
  ['Purchase order', 'The $48,000 is encumbered'],
  ['Invoice', 'Matched to the PO and the receipt'],
  ['Payment', 'The supplier is paid'],
  ['Reported', 'Budget vs. actual, data for the ACFR'],
];
const RUN = 78; // % of the loop the dot spends travelling; then it holds and fades
const at = (i) => +((i / (STATIONS.length - 1)) * RUN).toFixed(2);
const stationKeyframes = STATIONS.map((_, i) => `@keyframes erp-st${i} { 0%, ${Math.max(at(i) - 0.5, 0)}% { opacity: .45; border-color: var(--d-line); } ${at(i)}%, 93% { opacity: 1; border-color: rgb(var(--d-acc-rgb) / 70%); } 98%, 100% { opacity: .45; border-color: var(--d-line); } }`).join('\n');
const phaseKeyframes = `
  @keyframes erp-check { 0%, ${at(2) - 0.5}% { opacity: 0; transform: translate(-50%, 0.6cqw) scale(.9); } ${at(2) + 2}%, 93% { opacity: 1; transform: translate(-50%, 0); } 98%, 100% { opacity: 0; } }
  @keyframes erp-enc { 0%, ${at(3) - 0.5}% { width: 0; } ${at(3) + 2}%, 93% { width: 4%; } 98%, 100% { width: 0; } }
  @keyframes erp-enc-fill { 0%, ${at(5) - 0.5}% { background-color: transparent; } ${at(5) + 2}%, 93% { background-color: var(--erp-spent); } 100% { background-color: transparent; } }
  @keyframes erp-avail-a { 0%, ${at(3) - 0.5}% { opacity: 1; } ${at(3)}%, 93% { opacity: 0; } 98%, 100% { opacity: 1; } }
  @keyframes erp-avail-b { 0%, ${at(3) - 0.5}% { opacity: 0; } ${at(3)}%, 93% { opacity: 1; } 98%, 100% { opacity: 0; } }
  @keyframes erp-enc-lbl { 0%, ${at(3) - 0.5}% { opacity: 0; } ${at(3) + 1}%, ${at(5) - 0.5}% { opacity: 1; } ${at(5)}%, 100% { opacity: 0; } }
  @keyframes erp-paid-lbl { 0%, ${at(5) - 0.5}% { opacity: 0; } ${at(5) + 1}%, 93% { opacity: 1; } 98%, 100% { opacity: 0; } }
  @keyframes erp-coin { 0% { left: 0%; opacity: 0; } 2% { opacity: 1; } ${RUN}% { left: 100%; opacity: 1; } 93% { left: 100%; opacity: 1; } 98%, 100% { left: 100%; opacity: 0; } }`;

const PHASES = [
  ['search', 'Plan', 'Map today’s systems and processes; design the chart of accounts with funds built in.'],
  ['ledger', 'Core finance', 'Financials and procurement go live first: the ledger, payables and purchasing.'],
  ['layers', 'Expand', 'Add budgeting, grants and projects, and HR and payroll when you’re ready.'],
  ['sparkle', 'Keep improving', 'Quarterly updates bring new features without an upgrade project.'],
];

const SLIDES = [
  {
    id: 'title',
    html: () => `
      <div class="d-title">
        <div class="d-kicker"><span class="d-dot"></span>State &amp; Local Government</div>
        <h1>Oracle Fusion<br />Cloud ERP</h1>
        <p class="d-lead">Run the public’s money on one modern system, <span>from budget to audit.</span></p>
      </div>
      <div class="d-orbit" aria-hidden="true"><div><i class="orb-dot"></i></div><div><i class="orb-dot"></i><i class="orb-dot b"></i></div><div></div></div>`,
    talk: {
      key: 'Every dollar a government spends was appropriated, approved, tracked and reported. Oracle Fusion Cloud ERP keeps that whole trail in one system.',
      points: [
        'Open with their world: “Walk me through what happens between the council adopting the budget and the auditor signing off. How many systems does that touch?”',
        'Oracle Fusion Cloud ERP in one sentence: financials, budgeting, procurement, grants, projects and assets on one cloud platform, with one set of data and one audit trail.',
        'Keep the focus on outcomes they’re accountable for: a faster close, clean audits, budget control and transparency to the public.',
      ],
      ask: 'What’s driving the conversation now: an aging system, an audit finding, staff retiring, or new reporting requirements?',
      next: 'Let’s start with where most finance offices are today.',
    },
  },
  {
    id: 'legacy',
    title: 'Aging, disconnected systems',
    html: () => `
      <div class="erp-legacy">
        <figure class="erp-tangle" aria-label="Illustration: six disconnected systems linked by manual hand-offs, some of them broken">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${OLD_LINKS.map(([a, b]) => `<line x1="${OLD[a][2]}" y1="${OLD[a][3]}" x2="${OLD[b][2]}" y2="${OLD[b][3]}" class="${BROKEN.has(`${a}-${b}`) ? 'broken' : ''}"/>`).join('')}
          </svg>
          ${OLD.map(([ic, t, x, y], i) => `<div class="erp-node" style="left:${x}%;top:${y}%;--k:${i}">${icon(ic)}<span>${t}</span></div>`).join('')}
          <span class="erp-rekey" style="left:31%;top:30%">⟳ re-keyed</span>
          <span class="erp-rekey" style="left:66%;top:69%">⟳ emailed</span>
          <span class="erp-rekey" style="left:28%;top:76%">⟳ re-keyed</span>
        </figure>
        <div class="erp-symptoms">
          <div class="rv-drv">${icon('clock')}<span><b>Weeks to close the books</b><small>Reconciling between systems by hand</small></span></div>
          <div class="rv-drv">${icon('alert')}<span><b>Budget checked after the fact</b><small>Overspending found at month-end, not at purchase</small></span></div>
          <div class="rv-drv">${icon('landmark')}<span><b>Grant reporting by spreadsheet</b><small>Federal dollars hard to trace, audits get harder</small></span></div>
          <div class="rv-drv">${icon('users')}<span><b>Knowledge retiring</b><small>The few people who understand the old system</small></span></div>
        </div>
      </div>`,
    talk: {
      key: 'The problem isn’t any one system. It’s the hand-offs between them, where data is re-keyed, delayed or lost.',
      points: [
        '<b>Read the picture:</b> budgets in spreadsheets, a ledger on an aging platform, grants tracked in their own database, requisitions on paper, payroll separate, and reports assembled by hand. The dashed lines are the manual hand-offs; the red ones are where things break.',
        '<b>Make it theirs:</b> ask which of these boxes they recognize. Most offices have at least three.',
        '<b>The four symptoms</b> are what leadership feels: a slow close, overspending found too late, grant reporting that strains every audit, and dependence on a few long-tenured staff.',
        '<b>Federal money raises the stakes:</b> large federal programs brought reporting requirements that spreadsheets struggle to meet, and single audits follow the money.',
      ],
      ask: 'How long does your month-end and year-end close take today? What was your last audit finding about?',
      objection: '“Our system works.” It may, for now. Ask what happens when the two people who maintain it retire, and how long it takes to answer a council member’s question about one program’s spending.',
      next: 'Here’s what one platform looks like instead.',
    },
  },
  {
    id: 'platform',
    title: 'One platform, one foundation',
    html: () => `
      <div class="erp-hub">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${MODS.map(([, , , x, y], i) => `<line x1="50" y1="50" x2="${x}" y2="${y}" style="--k:${i}"/>`).join('')}
        </svg>
        <div class="erp-core"><b>One foundation</b><span>One set of data · one security model · one approval workflow · one audit trail</span></div>
        ${MODS.map(([ic, t, d, x, y], i) => `<div class="erp-mod" style="left:${x}%;top:${y}%;--k:${i}">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></div>`).join('')}
      </div>
      <div class="erp-strip">
        <span>${icon('sparkle')}AI built into the applications</span>
        <span>${icon('clock')}Updated every quarter</span>
        <span>${icon('shield')}Runs on Oracle Cloud Infrastructure</span>
      </div>`,
    talk: {
      key: 'Six modules, one foundation. A transaction entered once flows everywhere it needs to go.',
      points: [
        '<b>Go around the circle:</b> Financials (the ledger, payables, receivables, with funds built into the chart of accounts), Planning and budgeting, Procurement (including a supplier portal), Grants and projects, Assets, and Reporting.',
        '<b>The center is the point:</b> one set of data, one security model, one approval workflow, one audit trail. No re-keying between budget and ledger, or between purchasing and payables.',
        '<b>Start where they hurt:</b> they don’t need every module on day one. Most governments start with core financials and procurement.',
        '<b>Along the bottom:</b> Oracle has been building AI assistants and agents directly into the applications, the software is updated quarterly instead of through big upgrade projects, and it runs on Oracle’s cloud. Confirm the specific AI features and current compliance authorizations (FedRAMP, GovRAMP/StateRAMP, CJIS if relevant) with Oracle before quoting them.',
      ],
      ask: 'Which of these six areas causes the most pain today?',
      objection: '“We tried an ERP before and it went badly.” Ask what went wrong: usually scope, customization or change management. A phased plan and staying close to standard processes address all three (see the last slide).',
      next: 'The best way to see the difference is to follow one dollar through it.',
    },
  },
  {
    id: 'dollar',
    title: 'Follow one dollar',
    html: () => `
      <style>${stationKeyframes}${phaseKeyframes}</style>
      <div class="erp-dollar">
        <div class="erp-po"><span class="erp-po-tag">Example</span><b>Pothole repair contract</b><small>Public Works · Fund 220, Streets &amp; Roads · $48,000</small></div>
        <div class="erp-track">
          <div class="erp-rail"><i class="erp-coin">$</i></div>
          ${STATIONS.map(([t, d], i) => `<div class="erp-st" style="animation-name:erp-st${i}"><span class="erp-st-n">${i + 1}</span><b>${t}</b><small>${d}</small></div>`).join('')}
          <div class="erp-check" style="left:${((2 + 0.5) / STATIONS.length) * 100}%">✓ Funds available</div>
        </div>
        <div class="erp-budget">
          <div class="erp-budget-h"><b>Fund 220 · Streets &amp; Roads</b><span>FY budget $1,200,000</span></div>
          <div class="erp-bar"><i class="spent" style="width:54%"></i><i class="enc"></i></div>
          <div class="erp-legend">
            <span><i class="spent"></i>Spent $648,000</span>
            <span class="erp-swap"><span class="enc-lbl"><i class="enc"></i>Encumbered $48,000</span><span class="paid-lbl"><i class="spent"></i>Paid $48,000</span></span>
            <span class="erp-swap"><span class="a">Available $552,000</span><span class="b">Available $504,000</span></span>
          </div>
        </div>
      </div>`,
    talk: {
      key: 'Budget control happens before the money is committed, not after it’s spent.',
      points: [
        '<b>Let it play once, then narrate.</b> The council adopts the budget. Public Works requests a $48,000 pothole repair contract. Before anything else happens, the system checks the requisition against what’s left in Fund 220. The green check is that moment.',
        '<b>Encumbrance is the key word for finance staff:</b> when the purchase order is issued, the $48,000 is set aside. Watch “Available” drop from $552,000 to $504,000 before a dollar is paid, so nobody can spend it twice.',
        '<b>Then it flows on its own:</b> the invoice is matched to the PO and the receipt, the supplier is paid, the encumbrance becomes spending, and budget-versus-actual is current the same day.',
        '<b>Why it matters:</b> overspending is stopped at the request, not discovered at month-end. Oracle’s budgetary control checks requisitions, purchase orders and invoices against available budget.',
        'The fund, amounts and contract are made-up examples.',
      ],
      ask: 'Today, at what point do you find out a department is over budget?',
      next: 'One trail for every dollar also means you can show your work.',
    },
  },
  {
    id: 'trust',
    title: 'Accountability you can show',
    html: () => `
      <div class="erp-cards">
        ${card('chart', 'Budget vs. actual, today', 'Every department’s spending against its budget, current every day, not at month-end.', `<div class="erp-mini-bars">${[72, 54, 88, 41].map((h, i) => `<i style="--h:${h}%;--k:${i}"></i>`).join('')}</div>`)}
        ${card('landmark', 'Every grant dollar traced', 'Federal and state awards tracked from award to project to expense, ready for reporting and single audits.', '<div class="erp-chain"><span>Award</span><i>→</i><span>Project</span><i>→</i><span>Expense</span></div>')}
        ${card('fingerprint', 'A complete audit trail', 'Who requested, who approved and who paid, with dates, on every transaction.', '<ul class="erp-log"><li><b>Requested</b> Public Works</li><li><b>Approved</b> Budget office</li><li><b>Paid</b> Treasury</li></ul>')}
        ${card('globe', 'Open to the public', 'The same data can feed dashboards for leadership and transparency portals for residents.', '<div class="erp-open">$ → 🏛️ → 👥</div>')}
      </div>`,
    talk: {
      key: 'Transparency stops being a project when the data is already in one place.',
      points: [
        '<b>Budget vs. actual:</b> department heads see where they stand today. No waiting for the month-end report.',
        '<b>Grants:</b> awards are tracked through projects to individual expenses, which is what grant reporting and single audits ask for. Mention the federal Uniform Guidance (2 CFR 200) if they manage federal awards.',
        '<b>Audit trail:</b> every approval is recorded with who and when. Auditors pull it themselves instead of asking staff to dig.',
        '<b>Public transparency:</b> many governments publish spending data to residents. With one source of truth, that becomes an export, not a manual project.',
      ],
      ask: 'How much staff time goes into preparing for your annual audit and your financial report?',
      next: 'So how do you get there without a risky big-bang project?',
    },
  },
  {
    id: 'path',
    title: 'A practical path to modernization',
    html: () => `
      <ol class="erp-path">
        ${PHASES.map(([ic, t, d], i) => `<li style="--k:${i}"><span class="erp-ph-n">${i + 1}</span>${icon(ic)}<b>${t}</b><p>${d}</p></li>`).join('')}
      </ol>
      <div class="rv-next">${icon('arrow')}<span><b>Next step:</b> a discovery workshop to map your current systems and pick the first phase.</span></div>`,
    talk: {
      key: 'Phased, close to standard, and never “done”: that’s how public-sector ERP projects succeed.',
      points: [
        '<b>Plan:</b> map today’s systems and processes, and design the chart of accounts with funds, departments and programs built in. This is where most of the long-term value is decided.',
        '<b>Core finance first:</b> the ledger, payables and purchasing. Fiscal-year timing matters; most governments avoid going live mid-year.',
        '<b>Expand:</b> budgeting, grants and projects, then HR and payroll if they’re part of the plan.',
        '<b>Keep improving:</b> because it’s cloud software, updates arrive quarterly; there’s no upgrade project every few years.',
        '<b>Close on the workshop:</b> it’s low commitment and gives them a picture of their own path. Procurement vehicle and timing questions are for the account team; don’t guess at contract vehicles or pricing.',
      ],
      ask: 'When does your fiscal year start, and is there a date you’re working toward?',
      next: 'Open the Architecture tab to see how it connects to their other systems, or take questions.',
    },
  },
];

// ---------- architecture ----------
// Who uses it → the ERP (the budget-to-report cycle on one foundation, on Oracle's
// cloud) ↔ Oracle Integration ↔ the systems agencies keep, with reporting below.
// "Follow a transaction" lights up one real-world path through it, step by step.
const PEOPLE = [
  ['finance', 'users', 'Finance & budget office', 'Accounting, budgets, the close'],
  ['dept', 'building', 'Department staff', 'Requests, approvals, budget checks'],
  ['supplier', 'cart', 'Suppliers', 'Supplier portal: bids, invoices, payments'],
  ['audit', 'search', 'Auditors & the public', 'Read-only reports, open data'],
];
const CYCLE = [
  ['plan', 'chart', 'Plan & budget', 'Budget development · position budgeting'],
  ['proc', 'cart', 'Procure', 'Requisitions · sourcing · contracts'],
  ['pay', 'file', 'Pay', 'Invoices · matching · payments'],
  ['gl', 'ledger', 'Account', 'General ledger by fund · the close'],
  ['rep', 'search', 'Report', 'Budget vs. actual · ACFR data'],
];
const ALONGSIDE = [
  ['grants', 'landmark', 'Grants & projects'],
  ['assets', 'building', 'Assets'],
  ['bc', 'shield', 'Budgetary control'],
];
const EXT = [
  ['tax', 'landmark', 'Tax & revenue'],
  ['util', 'zap', 'Utility billing'],
  ['permit', 'file', 'Permits & licensing'],
  ['payroll', 'users', 'HR & payroll'],
  ['bank', 'db', 'Banks & treasury'],
  ['portal', 'globe', 'State & federal portals'],
];
const OUTPUTS = ['Budget vs. actual dashboards', 'Data for the ACFR', 'Grant & single-audit reports', 'Open data portal'];

const PARTS = {
  finance: ['Finance & budget office', 'Accountants, budget analysts and the controller: they run the ledger, manage budgets and close the books.'],
  dept: ['Department staff', 'Public Works, Parks, Police and every other department: they request purchases, approve them and check their own budgets.'],
  supplier: ['Suppliers', 'Vendors use a supplier portal to respond to bids, submit invoices and check payment status, instead of calling the finance office.'],
  audit: ['Auditors & the public', 'External auditors get read-only access to reports and the audit trail; residents see published spending data.'],
  plan: ['Plan & budget', 'Budget development, position (workforce) budgeting and forecasts. The adopted budget becomes the control budget everything else is checked against.'],
  proc: ['Procure', 'Requisitions, sourcing events, contracts and purchase orders, each checked against the budget before it is approved.'],
  pay: ['Pay', 'Supplier invoices are matched to the purchase order and the receipt, then scheduled for payment.'],
  gl: ['Account', 'The general ledger, with funds, departments and programs built into the chart of accounts, so every transaction lands in the right fund.'],
  rep: ['Report', 'Budget vs. actual, financial statements and the data behind the annual financial report (ACFR).'],
  grants: ['Grants & projects', 'Federal and state awards and capital projects, with their own budgets and rules, and the costs charged to them.'],
  assets: ['Assets', 'Capital assets and depreciation: roads, vehicles, buildings and equipment.'],
  bc: ['Budgetary control', 'Checks requisitions, purchase orders and invoices against available funds before they go through, and encumbers the money when a PO is issued.'],
  found: ['Shared foundation', 'One set of data, role-based security, approval workflows and an audit trail shared by every module, plus AI assistance built into the applications.'],
  oci: ['Oracle Cloud Infrastructure', 'Oracle runs the software as a service on its own cloud and ships updates every quarter. Confirm current compliance authorizations with Oracle.'],
  oic: ['Oracle Integration', 'The connection point for systems that stay: prebuilt adapters and APIs move data in and out on a schedule or in real time, instead of re-keying.'],
  tax: ['Tax & revenue', 'Property, sales and other tax systems usually stay; collections post to the ledger through integration.'],
  util: ['Utility billing', 'Water and utility billing systems post billed and collected amounts to the right enterprise funds.'],
  permit: ['Permits & licensing', 'Fees collected for permits and licenses flow to the ledger with the right fund and department.'],
  payroll: ['HR & payroll', 'Payroll can be Oracle’s own HR and payroll, or an existing system that posts payroll costs by fund and position.'],
  bank: ['Banks & treasury', 'Payment files go to the bank, and bank statements come back for automatic reconciliation.'],
  portal: ['State & federal portals', 'Grant award information comes in; draw-down requests and required reports go out to the funding agency’s systems.'],
  an: ['Reporting & analytics', 'Built-in reports and dashboards, and an analytics layer for deeper analysis across modules.'],
};

// Real-world paths through the system, told one step at a time.
const SCENARIOS = {
  purchase: {
    label: 'A purchase',
    icon: 'cart',
    steps: [
      ['dept', 'Public Works requests a $48,000 pothole repair contract.'],
      ['proc', 'The request becomes a requisition in Procurement.'],
      ['bc', 'Budgetary control checks Fund 220 (Streets & Roads): funds available. The $48,000 is encumbered when the PO is issued.'],
      ['supplier', 'The contractor does the work and submits the invoice through the supplier portal.'],
      ['pay', 'The invoice is matched to the PO and the receipt, then paid.'],
      ['bank', 'The payment goes to the bank through Oracle Integration.'],
      ['gl', 'The expense posts to the ledger in Fund 220, and the encumbrance is released.'],
      ['rep', 'Budget vs. actual for Streets & Roads is current the same day.'],
    ],
  },
  grant: {
    label: 'A federal grant',
    icon: 'landmark',
    steps: [
      ['portal', 'A federal award for a bridge project arrives from the funding agency.'],
      ['grants', 'The award is set up with its own budget, dates and allowable costs.'],
      ['dept', 'Engineering staff charge contractor costs and their time to the project.'],
      ['bc', 'Each charge is checked against the grant’s budget, not just the department’s.'],
      ['gl', 'Costs post to the ledger with the grant and fund attached.'],
      ['grants', 'Draw-down requests and progress reports are prepared from the same records.'],
      ['portal', 'They’re sent to the funding agency’s system.'],
      ['audit', 'At the single audit, every dollar traces from award to expense.'],
    ],
  },
  revenue: {
    label: 'A tax payment',
    icon: 'landmark',
    steps: [
      ['tax', 'Residents pay property taxes; the county’s tax system stays as it is.'],
      ['oic', 'Each day’s collections are sent to the ERP through Oracle Integration.'],
      ['gl', 'Revenue posts to the right funds: general fund, schools, debt service.'],
      ['bank', 'The bank statement comes back and is reconciled automatically.'],
      ['rep', 'Revenue vs. forecast is visible to the finance office the next morning.'],
      ['plan', 'And it feeds next year’s revenue forecast in budgeting.'],
    ],
  },
};
const STEP_MS = 4200;

const SOURCES = [
  ['Oracle: Fusion Cloud ERP', 'https://www.oracle.com/erp/'],
  ['Oracle documentation: Budgetary Control inquiry and reporting', 'https://docs.oracle.com/en/cloud/saas/financials/25c/faups/overview-of-budgetary-control-inquiry-and-reporting.html'],
  ['Oracle: Government and state & local', 'https://www.oracle.com/government/'],
  ['ExecutiveBiz: Oracle Cloud Applications gain FedRAMP Moderate authorization (2020)', 'https://executivebiz.com/2020/02/oracle-cloud-applications-gains-fedramp-moderate-authorization-extending-agency-access-to-erp-hcm-cx-tamara-greenspan-quoted'],
];

const st = { part: 'bc', scen: null, i: 0, playing: false, timer: null };
let archEl;

const partBtn = (k, ic, t, sub, cls = '') => `<button type="button" class="ea-part ${cls}" data-part="${k}">${icon(ic)}<span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;

function drawArch(el) {
  archEl = el;
  el.innerHTML = `
    <div class="ea2-head">
      <div><h2>How it fits together</h2><p class="muted">Click any part, or follow a transaction through the system.</p></div>
      <div class="ea2-modes" role="group" aria-label="Mode">
        <button type="button" data-scen="">${icon('search')}Explore</button>
        ${Object.entries(SCENARIOS).map(([k, s]) => `<button type="button" data-scen="${k}">${icon(s.icon)}Follow ${s.label.toLowerCase()}</button>`).join('')}
      </div>
    </div>
    <div class="ea2-panel" id="ea2Panel" aria-live="polite"></div>

    <div class="ea2">
      <section class="ea2-col ea2-people">
        <h3>People</h3>
        ${PEOPLE.map(([k, ic, t, sub]) => partBtn(k, ic, t, sub, 'ea2-person')).join('')}
      </section>
      <div class="ea2-link" aria-hidden="true"><i></i></div>

      <section class="ea2-core">
        <div class="ea2-box">
          <div class="ea2-box-h">${icon('layers')}<b>Oracle Fusion Cloud ERP</b></div>
          <div class="ea2-cycle-h">The financial cycle</div>
          <div class="ea2-cycle">
            ${CYCLE.map(([k, ic, t, sub], i) => `${i ? '<span class="ea2-arr" aria-hidden="true"></span>' : ''}${partBtn(k, ic, t, sub, 'ea2-step')}`).join('')}
            <i class="ea2-coin" aria-hidden="true">$</i>
          </div>
          <div class="ea2-along">${ALONGSIDE.map(([k, ic, t]) => partBtn(k, ic, t, '', `ea2-chip ${k === 'bc' ? 'key' : ''}`)).join('')}</div>
          <button type="button" class="ea-part ea2-found" data-part="found">
            <b>Shared foundation</b>
            <span>One set of data</span><span>Role-based security</span><span>Approval workflow</span><span>Audit trail</span><span>Built-in AI</span>
          </button>
        </div>
        <button type="button" class="ea-part ea2-oci" data-part="oci"><b>Oracle Cloud Infrastructure</b> · run by Oracle as a service · updated quarterly</button>
        <div class="ea2-down" aria-hidden="true"><i></i></div>
        <div class="ea2-out">
          ${partBtn('an', 'chart', 'Reporting & analytics', '', 'ea2-an')}
          <div class="ea2-outs">${OUTPUTS.map((o) => `<span>${o}</span>`).join('')}</div>
        </div>
      </section>

      <div class="ea2-link both" aria-hidden="true"><i></i></div>
      <section class="ea2-col ea2-ext">
        ${partBtn('oic', 'route', 'Oracle Integration', 'Adapters & APIs', 'ea2-oic')}
        <h3>Systems that stay</h3>
        <div class="ea2-bus">${EXT.map(([k, ic, t]) => partBtn(k, ic, t, '', 'ea2-sys')).join('')}</div>
      </section>
    </div>

    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">A simplified view. Module names follow Oracle’s public material; which modules, integrations and compliance authorizations apply depends on the agency and the contract. The transactions are made-up examples. Confirm scope, licensing and current authorizations (FedRAMP, GovRAMP/StateRAMP, CJIS) with Oracle.</p></details>`;

  el.querySelectorAll('[data-part]').forEach((b) =>
    (b.onclick = () => {
      stopScenario();
      st.part = b.dataset.part;
      paint();
    }),
  );
  el.querySelectorAll('[data-scen]').forEach((b) => (b.onclick = () => (b.dataset.scen ? startScenario(b.dataset.scen) : (stopScenario(), paint()))));
  paint();
}

// Update highlights and the caption without redrawing (keeps the motion smooth).
function paint() {
  const el = archEl;
  if (!el) return;
  const scen = st.scen && SCENARIOS[st.scen];
  el.querySelector('.ea2').classList.toggle('playing', !!scen);
  el.querySelectorAll('[data-scen]').forEach((b) => b.classList.toggle('on', (b.dataset.scen || null) === st.scen));
  const done = new Set(scen ? scen.steps.slice(0, st.i).map(([k]) => k) : []);
  const lit = scen ? scen.steps[st.i][0] : st.part;
  el.querySelectorAll('.ea-part').forEach((b) => {
    const k = b.dataset.part;
    b.classList.toggle('lit', k === lit);
    b.classList.toggle('done', done.has(k) && k !== lit);
  });
  const panel = el.querySelector('#ea2Panel');
  if (!scen) {
    const [t, d] = PARTS[st.part];
    panel.innerHTML = `<p class="ea2-tip"><b>${esc(t)}:</b> ${esc(d)}</p>`;
    return;
  }
  const [k, text] = scen.steps[st.i];
  panel.innerHTML = `
    <div class="ea2-story">
      <div class="ea2-story-top">
        <span class="ea2-step-n">Step ${st.i + 1} of ${scen.steps.length}</span>
        <span class="ea2-where">${esc(PARTS[k][0])}</span>
        <span class="ea2-ctrl">
          <button type="button" data-go="-1" aria-label="Previous step" ${st.i === 0 ? 'disabled' : ''}>‹</button>
          <button type="button" data-go="play" aria-label="${st.playing ? 'Pause' : 'Play'}">${st.playing ? '❚❚' : '▶'}</button>
          <button type="button" data-go="1" aria-label="Next step" ${st.i === scen.steps.length - 1 ? 'disabled' : ''}>›</button>
        </span>
      </div>
      <p>${esc(text)}</p>
      <div class="ea2-dots">${scen.steps.map((_, i) => `<i class="${i < st.i ? 'done' : i === st.i ? 'on' : ''}" ${i === st.i && st.playing ? `style="--ms:${STEP_MS}ms"` : ''}></i>`).join('')}</div>
    </div>`;
  panel.querySelectorAll('[data-go]').forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.go === 'play') {
          if (st.playing) pause();
          else {
            if (st.i === scen.steps.length - 1) st.i = 0;
            play();
          }
          return;
        }
        pause();
        st.i = Math.max(0, Math.min(scen.steps.length - 1, st.i + Number(b.dataset.go)));
        paint();
      }),
  );
}

function startScenario(key) {
  stopScenario();
  st.scen = key;
  st.i = 0;
  play();
}
function play() {
  clearTimeout(st.timer);
  st.playing = true;
  paint();
  const tick = () => {
    const scen = SCENARIOS[st.scen];
    if (!scen || !st.playing) return;
    if (st.i >= scen.steps.length - 1) {
      st.playing = false;
      paint();
      return;
    }
    st.i++;
    paint();
    st.timer = setTimeout(tick, STEP_MS);
  };
  st.timer = setTimeout(tick, STEP_MS);
}
function pause() {
  clearTimeout(st.timer);
  st.playing = false;
  paint();
}
function stopScenario() {
  clearTimeout(st.timer);
  Object.assign(st, { scen: null, i: 0, playing: false });
}

// ---------- page ----------
function setView(v) {
  const view = v === 'architecture' ? 'architecture' : 'overview';
  $('#erpOverview').hidden = view !== 'overview';
  $('#erpArch').hidden = view !== 'architecture';
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

const deck = createDeck({ slides: SLIDES, label: 'Oracle Fusion Cloud ERP · State & Local', storageKey: 'erp', onGoto: () => setView('architecture') });

initTheme();
document.querySelectorAll('.view-tabs button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
setView(location.hash.slice(1));
await deck.mount($('#erpDeck'));
drawArch($('#erpArchRoot'));
