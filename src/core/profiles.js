// Customer profiles: white-label the sample apps for a specific customer.
// A profile renames each app (organization, product, employee), rebrands it
// (color, logo), chooses which industries to show, and can rewrite any step.
// Profiles are stored in the app's key/value storage; one can be active.
import { SAMPLE_APPS, APP_IDS } from './sample-apps.js';
import { randomHex } from './util.js';

const STEP_FIELDS = ['title', 'story', 'from', 'subject', 'body', 'hidden', 'message', 'docTitle'];
const APP_FIELDS = ['org', 'product', 'personName', 'personRole', 'color', 'logo'];
const LIMITS = { name: 80, org: 80, product: 60, personName: 60, personRole: 60, title: 120, story: 600, from: 160, subject: 160, body: 4000, hidden: 1000, message: 2000, docTitle: 160 };
const MAX_LOGO = 200_000; // characters of a data: URL (~150 KB image)

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const initials = (name) => String(name || '').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// Replace default names with the profile's names in every string (not functions).
function rename(value, pairs) {
  if (typeof value === 'string') {
    // Two passes through placeholders, so a new name that contains an old one is not renamed twice.
    const active = pairs.filter(([from, to]) => from && to && from !== to);
    const marked = active.reduce((s, [from], i) => s.split(from).join(`\u0000${i}\u0000`), value);
    return active.reduce((s, [, to], i) => s.split(`\u0000${i}\u0000`).join(to), marked);
  }
  if (Array.isArray(value)) return value.map((v) => rename(v, pairs));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'function' ? v : rename(v, pairs)]));
  return value;
}

// The sample apps as this profile presents them (or the defaults with no profile).
export function resolveApps(profile) {
  // Apps a profile names that no longer exist are skipped; with none left, show them all.
  const known = (profile?.show || []).filter((id) => APP_IDS.includes(id));
  const order = known.length ? known : APP_IDS;
  return order
    .map((id) => SAMPLE_APPS.find((a) => a.id === id))
    .filter(Boolean)
    .map((base) => {
      const p = profile?.apps?.[base.id] || {};
      const pairs = [
        [base.org, p.org],
        [base.product, p.product],
        [base.person.name, p.personName],
        [base.person.role, p.personRole],
        [firstName(base.person.name), firstName(p.personName)],
      ];
      const app = rename(base, pairs);
      app.person = { ...app.person, initials: initials(app.person.name) };
      app.brand = { color: p.color || base.color, logo: p.logo || null };
      app.workflows = app.workflows.map((w) => {
        const edit = profile?.steps?.[`${base.id}:${w.id}`];
        if (!edit) return w;
        const screen = { ...w.screen };
        for (const k of ['from', 'subject', 'body', 'hidden', 'message']) if (edit[k] != null && k in screen) screen[k] = edit[k];
        if (edit.docTitle != null && screen.type === 'document') screen.title = edit.docTitle;
        return {
          ...w,
          title: edit.title ?? w.title,
          story: edit.story ?? w.story,
          screen,
          edited: true,
          customHidden: edit.hidden != null && edit.hidden !== w.screen.hidden,
        };
      });
      return app;
    });
}

// What the browser needs to draw the apps (no request builders, stand-in answers or full documents).
export function publicApps(profile) {
  return {
    customer: profile ? { id: profile.id, name: profile.name } : null,
    apps: resolveApps(profile).map(({ workflows, system, ...app }) => ({
      ...app,
      workflows: workflows.map(({ build, mock, fullText, ...w }) => w),
    })),
  };
}

export function findWorkflow(appId, workflowId, profile) {
  // Look in all apps, not just the shown ones, so traces and stand-ins always resolve.
  const all = resolveApps(profile ? { ...profile, show: APP_IDS } : null);
  const app = all.find((a) => a.id === appId);
  const workflow = app?.workflows.find((w) => w.id === workflowId);
  return app && workflow ? { app, workflow } : null;
}

// ----- storage -----
export async function getActiveProfile(storage) {
  const id = await storage.getKV('profile:active');
  return id ? await storage.getKV(`profile:${id}`) : null;
}

export async function listProfiles(storage) {
  const all = (await storage.listKV('profile:p_')).filter(Boolean);
  return all.map((p) => ({ id: p.id, name: p.name, owner: p.owner || null, color: p.color || null, updatedAt: p.updatedAt })).sort((a, b) => a.name.localeCompare(b.name));
}

// ----- tailoring the Vellox Reverser, Ranger and Navigator pages (all optional) -----
// profile.pitch = { logo, hidePrepared, reverser: {...}, ranger: {...} }. Anything
// left out keeps the standard slide; an empty pitch changes nothing.
export const PITCH_SLIDES = {
  reverser: ['title', 'gap', 'speed', 'outputs', 'addons', 'team'],
  ranger: ['title', 'noise', 'inside', 'caught', 'control'],
  navigator: ['title', 'drift', 'loop', 'live', 'lineage'],
  vellox: ['title', 'shift', 'suite', 'together', 'why', 'start'],
};
const PITCH_FIELDS = {
  reverser: { lead: 120, callout: 140, file: 60, tools: 120, next: 200 },
  ranger: { lead: 120, jewel: 40, tools: 120, review: 10, next: 200 },
  navigator: { lead: 120, system: 50, baseline: 60, reviewer: 40, next: 200 },
  vellox: { lead: 120, next: 200 },
};

function validatePitch(input, errors) {
  if (!input || typeof input !== 'object') return undefined;
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const out = {};
  const logo = str(input.logo);
  if (logo) {
    if (!isLogo(logo)) errors['pitch.logo'] = 'Use an https image URL, or a PNG/JPEG/SVG/WebP under 150 KB';
    out.logo = logo;
  }
  if (input.hidePrepared === true) out.hidePrepared = true;
  for (const [product, fields] of Object.entries(PITCH_FIELDS)) {
    const src = input[product];
    if (!src || typeof src !== 'object') continue;
    const slides = PITCH_SLIDES[product];
    const p = {};
    for (const [k, max] of Object.entries(fields)) {
      const v = str(src[k]);
      if (!v) continue;
      if (k === 'review' && !['github', 'gitlab'].includes(v)) continue;
      if (v.length > max) errors[`pitch.${product}.${k}`] = 'Too long';
      p[k] = v;
    }
    const hide = Array.isArray(src.hide) ? [...new Set(src.hide.filter((id) => slides.includes(id)))] : [];
    if (hide.length && hide.length < slides.length) p.hide = hide;
    for (const [key, max] of [['titles', 120], ['notes', 2000]]) {
      const m = {};
      for (const id of slides) {
        const v = str(src[key]?.[id]);
        if (!v) continue;
        if (v.length > max) errors[`pitch.${product}.${key}.${id}`] = 'Too long';
        m[id] = v;
      }
      if (Object.keys(m).length) p[key] = m;
    }
    if (Object.keys(p).length) out[product] = p;
  }
  return Object.keys(out).length ? out : undefined;
}

// What the Reverser and Ranger pages need: the active customer and its tailoring.
export function publicPitch(profile) {
  return { customer: profile ? { id: profile.id, name: profile.name, color: profile.color || null } : null, pitch: profile?.pitch || {} };
}

// ----- validation -----
function isLogo(s) {
  if (!s) return true;
  if (/^https:\/\/[^\s"'<>]{1,490}$/.test(s)) return true;
  return s.length <= MAX_LOGO && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s);
}

export function validateProfile(input, existingId) {
  const errors = {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const name = str(input.name);
  if (!name) errors.name = 'Enter the customer name';
  else if (name.length > LIMITS.name) errors.name = 'Too long';

  const show = Array.isArray(input.show) ? input.show.filter((id) => APP_IDS.includes(id)) : APP_IDS;
  if (!show.length) errors.show = 'Show at least one sample app';

  const apps = {};
  for (const id of APP_IDS) {
    const a = input.apps?.[id];
    if (!a || typeof a !== 'object') continue;
    const out = {};
    for (const k of APP_FIELDS) {
      const v = str(a[k]);
      if (!v) continue;
      if (k === 'color') {
        if (!/^#[0-9a-f]{6}$/i.test(v)) errors[`${id}.color`] = 'Use a color like #1d4ed8';
      } else if (k === 'logo') {
        if (!isLogo(v)) errors[`${id}.logo`] = 'Use an https image URL, or a PNG/JPEG/SVG/WebP under 150 KB';
      } else if (v.length > LIMITS[k]) errors[`${id}.${k}`] = 'Too long';
      out[k] = v;
    }
    if (Object.keys(out).length) apps[id] = out;
  }

  const steps = {};
  for (const [key, edit] of Object.entries(input.steps || {})) {
    const [appId, wfId] = key.split(':');
    const app = SAMPLE_APPS.find((a) => a.id === appId);
    if (!app?.workflows.some((w) => w.id === wfId) || !edit || typeof edit !== 'object') continue;
    const out = {};
    for (const k of STEP_FIELDS) {
      if (typeof edit[k] !== 'string') continue;
      if (edit[k].length > LIMITS[k]) errors[`${key}.${k}`] = 'Too long';
      out[k] = edit[k];
    }
    if (Object.keys(out).length) steps[key] = out;
  }

  const pitch = validatePitch(input.pitch, errors);

  // The customer's brand color: an accent on the decks ("Prepared for", title slide).
  const color = str(input.color);
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) errors.color = 'Use a color like #1d4ed8';

  const profile = { id: existingId || `p_${randomHex(6)}`, name, show, apps, steps, ...(pitch ? { pitch } : {}), ...(color ? { color } : {}), updatedAt: new Date().toISOString() };
  return { profile, errors, ok: Object.keys(errors).length === 0 };
}
