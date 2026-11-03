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
const PARTS = {
  users: ['Who uses it', 'Finance and budget staff do the accounting; department staff request purchases and check their budgets; suppliers use the supplier portal; auditors get read access.'],
  fin: ['Financials', 'The general ledger, payables, receivables and cash management, with funds, departments and programs built into the chart of accounts.'],
  epm: ['Planning & budgeting', 'Budget development, position (workforce) budgeting and forecasts. The adopted budget becomes the control budget the ledger checks against.'],
  proc: ['Procurement', 'Requisitions, purchase orders, sourcing events, contracts and a supplier portal, all checked against the budget.'],
  grants: ['Grants & projects', 'Federal and state awards, capital projects and the costs charged to them, for grant reporting and single audits.'],
  assets: ['Assets', 'Capital assets and depreciation, for infrastructure, vehicles and buildings.'],
  core: ['Shared foundation', 'One set of data, role-based security, approval workflows and an audit trail shared by every module. Budgetary control checks requisitions, purchase orders and invoices against available funds.'],
  oci: ['Oracle Cloud', 'Oracle runs the software as a service on its own cloud infrastructure and ships updates every quarter. Confirm current compliance authorizations with Oracle.'],
  int: ['Oracle Integration', 'Connects the ERP to the systems that stay: tax and revenue, utility billing, permitting, payroll, banks and state or federal portals, with prebuilt adapters and APIs.'],
  ext: ['Systems that stay', 'Most governments keep specialized systems for revenue, utilities or permits. They post to the ERP through integrations instead of re-keying.'],
  rep: ['Reporting & analytics', 'Built-in reports and dashboards, and an analytics layer for deeper analysis: budget vs. actual, data for the annual financial report (ACFR), and open data for transparency portals.'],
};
const SOURCES = [
  ['Oracle: Fusion Cloud ERP', 'https://www.oracle.com/erp/'],
  ['Oracle documentation: Budgetary Control inquiry and reporting', 'https://docs.oracle.com/en/cloud/saas/financials/25c/faups/overview-of-budgetary-control-inquiry-and-reporting.html'],
  ['Oracle: Government and state & local', 'https://www.oracle.com/government/'],
  ['ExecutiveBiz: Oracle Cloud Applications gain FedRAMP Moderate authorization (2020)', 'https://executivebiz.com/2020/02/oracle-cloud-applications-gains-fedramp-moderate-authorization-extending-agency-access-to-erp-hcm-cx-tamara-greenspan-quoted'],
];
const st = { part: 'core' };

function drawArch(el) {
  const on = (k) => (st.part === k ? 'on' : '');
  const mod = (k, ic, t) => `<button type="button" class="ea-mod ${on(k)}" data-part="${k}">${icon(ic)}<b>${t}</b></button>`;
  el.innerHTML = `
    <div class="rva-head"><h2>How it fits together</h2><span class="muted">Click any part</span></div>
    <div class="ea">
      <button type="button" class="ea-side ea-users ${on('users')}" data-part="users">
        <span class="ea-side-h">${icon('users')}<b>People</b></span>
        <span class="ea-chip">Finance &amp; budget office</span><span class="ea-chip">Department staff</span><span class="ea-chip">Suppliers</span><span class="ea-chip">Auditors</span>
      </button>
      <div class="ea-flow" aria-hidden="true"><i></i></div>

      <div class="ea-box">
        <div class="ea-box-h">${icon('layers')}<b>Oracle Fusion Cloud ERP</b></div>
        <div class="ea-mods">
          ${mod('fin', 'ledger', 'Financials')}
          ${mod('epm', 'chart', 'Planning &amp; budgeting')}
          ${mod('proc', 'cart', 'Procurement')}
          ${mod('grants', 'landmark', 'Grants &amp; projects')}
          ${mod('assets', 'building', 'Assets')}
        </div>
        <button type="button" class="ea-core ${on('core')}" data-part="core">
          <b>Shared foundation</b>
          <span>One set of data · role-based security · approval workflow · audit trail · budgetary control</span>
        </button>
        <button type="button" class="ea-oci ${on('oci')}" data-part="oci"><b>Oracle Cloud Infrastructure</b> · software as a service · quarterly updates</button>
      </div>

      <div class="ea-flow both" aria-hidden="true"><i></i></div>
      <div class="ea-right">
        <button type="button" class="ea-int ${on('int')}" data-part="int">${icon('route')}<b>Oracle Integration</b><small>Adapters &amp; APIs</small></button>
        <button type="button" class="ea-side ea-ext ${on('ext')}" data-part="ext">
          <span class="ea-side-h">${icon('db')}<b>Systems that stay</b></span>
          <span class="ea-chip">Tax &amp; revenue</span><span class="ea-chip">Utility billing</span><span class="ea-chip">Permits &amp; licensing</span><span class="ea-chip">Payroll</span><span class="ea-chip">Banks &amp; treasury</span><span class="ea-chip">State &amp; federal portals</span>
        </button>
      </div>
    </div>
    <button type="button" class="ea-rep ${on('rep')}" data-part="rep">
      <span class="ea-rep-h">${icon('search')}<b>Reporting &amp; analytics</b></span>
      <span class="ea-chip">Budget vs. actual</span><span class="ea-chip">Dashboards</span><span class="ea-chip">Data for the ACFR</span><span class="ea-chip">Grant reports</span><span class="ea-chip">Open data portal</span>
    </button>
    <p class="rva-tip"><b>${esc(PARTS[st.part][0])}:</b> ${esc(PARTS[st.part][1])}</p>
    <details class="rv-sources"><summary>Sources</summary><ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="muted small">A simplified view. Module names follow Oracle’s public material; which modules, integrations and compliance authorizations apply depends on the agency and the contract. Confirm scope, licensing and current authorizations (FedRAMP, GovRAMP/StateRAMP, CJIS) with Oracle.</p></details>`;
  el.querySelectorAll('[data-part]').forEach((b) => (b.onclick = () => ((st.part = b.dataset.part), drawArch(el))));
}

// ---------- page ----------
function setView(v) {
  const view = v === 'architecture' ? 'architecture' : 'overview';
  $('#erpOverview').hidden = view !== 'overview';
  $('#erpArch').hidden = view !== 'architecture';
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
