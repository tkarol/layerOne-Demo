// Trace store: in-memory for live updates, JSON Lines on disk for history.
import fs from 'node:fs';
import path from 'node:path';

export class TraceStore {
  constructor(file) {
    this.file = file;
    this.traces = new Map();
    this.listeners = new Set();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const t = JSON.parse(line);
        this.traces.set(t.id, t);
      } catch {
        // skip a partially written line
      }
    }
  }

  get(id) {
    return this.traces.get(id);
  }

  list() {
    return [...this.traces.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        status: t.status,
        mode: t.mode,
        scenario: t.scenario,
        prompt: t.prompt.slice(0, 140),
        decision: t.governance?.decision ?? null,
        httpStatus: t.response?.status ?? null,
        totalMs: t.totalMs ?? null,
      }));
  }

  // Broadcast every update; persist only once the trace is finished.
  update(trace, { persist = false } = {}) {
    this.traces.set(trace.id, trace);
    for (const fn of this.listeners) fn(trace);
    if (persist) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.appendFileSync(this.file, JSON.stringify(trace) + '\n');
    }
  }

  clear() {
    this.traces.clear();
    if (fs.existsSync(this.file)) fs.writeFileSync(this.file, '');
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
