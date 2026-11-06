// Storage for the Node server (npm start, Docker): settings in a JSON file, everyone's
// people, decks, customers and history in another, signed-out history as JSON Lines.
// Every save writes a new file and renames it into place, so a crash or a full disk
// mid-save never leaves a half-written file behind.
import fs from 'node:fs';
import path from 'node:path';

const MAX_TRACES = 500; // signed-out history, like the Worker

function writeAtomic(file, text, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
}

export class FileStorage {
  constructor({ settingsFile, tracesFile, kvFile }) {
    this.settingsFile = settingsFile;
    this.tracesFile = tracesFile;
    this.kvFile = kvFile || path.join(path.dirname(settingsFile), 'profiles.json');
    this.kv = fs.existsSync(this.kvFile) ? JSON.parse(fs.readFileSync(this.kvFile, 'utf8') || '{}') : {};
    this.traces = new Map();
    this.chainHead = null;
    if (fs.existsSync(tracesFile)) {
      for (const line of fs.readFileSync(tracesFile, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const t = JSON.parse(line);
          this.traces.set(t.id, t);
        } catch {
          // skip a partially written line
        }
      }
    }
  }

  async getSettings() {
    if (!fs.existsSync(this.settingsFile)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
    } catch {
      return null;
    }
  }
  async saveSettings(settings) {
    writeAtomic(this.settingsFile, JSON.stringify(settings, null, 2));
  }
  async clearSettings() {
    fs.rmSync(this.settingsFile, { force: true });
  }

  async putTrace(trace) {
    this.traces.set(trace.id, trace);
    fs.mkdirSync(path.dirname(this.tracesFile), { recursive: true });
    fs.appendFileSync(this.tracesFile, JSON.stringify(trace) + '\n');
    // Keep the newest MAX_TRACES (rewriting the file once in a while, not on every run).
    if (this.traces.size > MAX_TRACES + 100) {
      const keep = [...this.traces.values()].sort((a, b) => b.id.localeCompare(a.id)).slice(0, MAX_TRACES);
      this.traces = new Map(keep.reverse().map((t) => [t.id, t]));
      writeAtomic(this.tracesFile, [...this.traces.values()].map((t) => JSON.stringify(t) + '\n').join(''));
    }
  }
  async getTrace(id) {
    return this.traces.get(id) ?? null;
  }
  async listTraces(limit = 100) {
    return [...this.traces.values()].sort((a, b) => b.id.localeCompare(a.id)).slice(0, limit);
  }
  async clearTraces() {
    this.traces.clear();
    if (fs.existsSync(this.tracesFile)) fs.writeFileSync(this.tracesFile, '');
  }

  // Small key/value store for customer profiles (white-labeling).
  saveKV() {
    writeAtomic(this.kvFile, JSON.stringify(this.kv));
  }
  async getKV(key) {
    return this.kv[key] ?? null;
  }
  async putKV(key, value) {
    this.kv[key] = value;
    this.saveKV();
  }
  async deleteKV(key) {
    delete this.kv[key];
    this.saveKV();
  }
  async listKV(prefix) {
    return Object.entries(this.kv)
      .filter(([k]) => k.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }

  async getChainHead() {
    return this.chainHead;
  }
  async setChainHead(hash) {
    this.chainHead = hash;
  }
}
