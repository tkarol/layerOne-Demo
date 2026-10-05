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
  const order = profile?.show?.length ? profile.show : APP_IDS;
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
      workflows: workflows.map(({ build, mock, ...w }) => w),
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
  return all.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt })).sort((a, b) => a.name.localeCompare(b.name));
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

  const profile = { id: existingId || `p_${randomHex(6)}`, name, show, apps, steps, updatedAt: new Date().toISOString() };
  return { profile, errors, ok: Object.keys(errors).length === 0 };
}
