// Cloudflare Worker entry point. Serves the page from /public (static assets)
// and runs the backend (/api/*, /mock/*). Settings and request history are kept
// in a Durable Object, which `wrangler deploy` creates automatically.
import { DurableObject } from 'cloudflare:workers';
import { createApp } from './core/app.js';

const MAX_TRACES = 500;
const TRACE = 'trace:';

export class DemoStore extends DurableObject {
  async getSettings() {
    return (await this.ctx.storage.get('settings')) ?? null;
  }
  async saveSettings(settings) {
    await this.ctx.storage.put('settings', settings);
  }
  async clearSettings() {
    await this.ctx.storage.delete('settings');
  }

  async putTrace(trace) {
    const storage = this.ctx.storage;
    await storage.put(`${TRACE}${trace.id}`, trace);
    // Keep the newest MAX_TRACES runs. Trace ids start with a timestamp, so keys sort by time.
    const count = ((await storage.get('traceCount')) ?? 0) + 1;
    if (count > MAX_TRACES) {
      const oldest = await storage.list({ prefix: TRACE, limit: count - MAX_TRACES });
      await storage.delete([...oldest.keys()]);
      await storage.put('traceCount', MAX_TRACES);
    } else {
      await storage.put('traceCount', count);
    }
  }
  async getTrace(id) {
    return (await this.ctx.storage.get(`${TRACE}${id}`)) ?? null;
  }
  async listTraces(limit = 100) {
    const rows = await this.ctx.storage.list({ prefix: TRACE, reverse: true, limit });
    return [...rows.values()];
  }
  async clearTraces() {
    for (;;) {
      const keys = [...(await this.ctx.storage.list({ prefix: TRACE, limit: 128 })).keys()];
      if (!keys.length) break;
      await this.ctx.storage.delete(keys);
    }
    await this.ctx.storage.put('traceCount', 0);
  }

  async getChainHead() {
    return (await this.ctx.storage.get('chainHead')) ?? null;
  }
  async setChainHead(hash) {
    await this.ctx.storage.put('chainHead', hash);
  }
}

export default {
  async fetch(request, env, ctx) {
    const storage = env.STORE.get(env.STORE.idFromName('layerone-demo'));
    const handle = createApp({ env, storage });
    const response = await handle(request, { waitUntil: (p) => ctx.waitUntil(p) });
    return response ?? env.ASSETS.fetch(request);
  },
};
