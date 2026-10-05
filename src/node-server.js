// Local Node server, for running the demo on your own machine (`npm start`)
// and for tests. On Cloudflare the same app runs from src/worker.js instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createApp } from './core/app.js';
import { FileStorage } from './storage/file.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

// Minimal .env loader so the demo runs with zero dependencies.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

export function createServer({ env = process.env } = {}) {
  const storage = new FileStorage({
    settingsFile: env.SETTINGS_FILE || path.join(ROOT, 'data', 'settings.json'),
    tracesFile: env.TRACE_FILE || path.join(ROOT, 'data', 'traces.jsonl'),
    kvFile: env.PROFILES_FILE || path.join(ROOT, 'data', 'profiles.json'),
  });
  const handle = createApp({ env, storage });

  return http.createServer(async (req, res) => {
    try {
      const url = `http://${req.headers.host || 'localhost'}${req.url}`;
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const request = new Request(url, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? 'half' : undefined,
      });
      const response = await handle(request);
      if (!response) return serveStatic(new URL(url).pathname, res);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (!response.body) return res.end();
      // Stream the body through so live trace updates reach the browser as they happen.
      for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch (err) {
      console.error('[server]', err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnvFile(path.join(ROOT, '.env'));
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => {
    console.log(`\n  LayerOne Demo → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log('  Change Dry run / Live and the LayerOne endpoint from ⚙ Settings in the page.\n');
  });
}
