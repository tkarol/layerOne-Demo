import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, publicConfig, ROOT } from './config.js';
import { SCENARIOS } from './scenarios.js';
import { TraceStore } from './store.js';
import { createTrace, runWorkflow } from './workflow.js';
import { handleMockChat } from './mock-layerone.js';
import { handleMockModel } from './mock-model.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, data, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return json(res, 403, { error: 'Forbidden' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    json(res, 404, { error: 'Not found' });
  }
}

export function createApp(store = new TraceStore(config.dataFile)) {
  const sseClients = new Set();
  store.subscribe((trace) => {
    const msg = `event: trace\ndata: ${JSON.stringify(trace)}\n\n`;
    for (const c of sseClients) c.write(msg);
  });

  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'POST' && pathname.startsWith('/mock/layerone/')) {
        if (config.mode !== 'mock') return json(res, 404, { error: 'Mock gateway disabled in live mode' });
        return handleMockChat(req, res, await readBody(req));
      }
      if (req.method === 'POST' && pathname.startsWith('/mock/model/')) {
        if (config.mode !== 'mock') return json(res, 404, { error: 'Mock model disabled in live mode' });
        return handleMockModel(req, res, await readBody(req));
      }

      if (pathname === '/api/health') return json(res, 200, { ok: true });
      if (pathname === '/api/config') return json(res, 200, publicConfig());
      if (pathname === '/api/scenarios') return json(res, 200, SCENARIOS);

      if (pathname === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(': connected\n\n');
        sseClients.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => {
          clearInterval(ping);
          sseClients.delete(res);
        });
        return;
      }

      if (pathname === '/api/run' && req.method === 'POST') {
        const { prompt, scenario } = JSON.parse((await readBody(req)) || '{}');
        if (!prompt || typeof prompt !== 'string') return json(res, 400, { error: 'prompt is required' });
        const trace = createTrace({ prompt: prompt.slice(0, 20000), scenario });
        store.update(structuredClone(trace));
        runWorkflow(trace, store).catch((err) => console.error('[workflow]', err));
        return json(res, 202, { id: trace.id });
      }

      if (pathname === '/api/traces' && req.method === 'GET') return json(res, 200, store.list());
      if (pathname === '/api/traces' && req.method === 'DELETE') {
        store.clear();
        return json(res, 200, { ok: true });
      }

      const m = pathname.match(/^\/api\/traces\/([\w-]+)(\/export)?$/);
      if (m && req.method === 'GET') {
        const trace = store.get(m[1]);
        if (!trace) return json(res, 404, { error: 'Trace not found' });
        const extra = m[2] ? { 'Content-Disposition': `attachment; filename="${trace.id}.json"` } : {};
        return json(res, 200, trace, extra);
      }

      if (req.method === 'GET') return serveStatic(req, res, pathname);
      json(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('[server]', err);
      if (!res.headersSent) json(res, 500, { error: err.message });
    }
  });

  return server;
}

export function start({ port = config.port, host = config.host, store } = {}) {
  const server = createApp(store);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      config.port = server.address().port;
      resolve(server);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await start();
  const { mode, endpoint } = publicConfig();
  const { address, port } = server.address();
  console.log(`\n  LayerOne Demo Console → http://${address === '0.0.0.0' ? 'localhost' : address}:${port}`);
  console.log(`  Mode: ${mode.toUpperCase()}${mode === 'mock' ? ' (simulated gateway — not the real LayerOne)' : ''}`);
  console.log(`  Endpoint: ${endpoint.method} ${endpoint.url || '(LAYERONE_BASE_URL not set)'}\n`);
}
