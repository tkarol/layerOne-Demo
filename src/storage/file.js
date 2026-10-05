// Local storage for the Node server: settings in a JSON file, history as JSON Lines.
import fs from 'node:fs';
import path from 'node:path';

export class FileStorage {
  constructor({ settingsFile, tracesFile }) {
    this.settingsFile = settingsFile;
    this.tracesFile = tracesFile;
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
    fs.mkdirSync(path.dirname(this.settingsFile), { recursive: true });
    fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
  }
  async clearSettings() {
    if (fs.existsSync(this.settingsFile)) fs.rmSync(this.settingsFile);
  }

  async putTrace(trace) {
    this.traces.set(trace.id, trace);
    fs.mkdirSync(path.dirname(this.tracesFile), { recursive: true });
    fs.appendFileSync(this.tracesFile, JSON.stringify(trace) + '\n');
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

  async getChainHead() {
    return this.chainHead;
  }
  async setChainHead(hash) {
    this.chainHead = hash;
  }
}
