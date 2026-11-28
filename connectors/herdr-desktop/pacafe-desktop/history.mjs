// Only terminal identifiers and opaque cursors cross the local command line.
import { randomUUID } from 'node:crypto';
import { historyCursor } from './history-protocol.js';

const lifetime = 180_000;
const maxSnapshots = 4;
const pageSize = 16_000;
export const historyLines = 10_000;
export const historyOutputLimit = 512 * 1024;

function page(snapshot, end) {
  let start = Math.max(0, end - pageSize);
  // Prefer complete lines, but don't make a long line unpageable.
  if (start > 0) {
    const line = snapshot.text.indexOf('\n', start);
    if (line >= 0 && line + 1 < end && line - start < 1000) start = line + 1;
    else if (/[\uDC00-\uDFFF]/u.test(snapshot.text[start])) start++;
  }
  return {
    state: 'ready', text: snapshot.text.slice(start, end),
    before: start > 0 ? `${snapshot.generation}_${start}` : null,
    ...(snapshot.truncated && { truncated: true }),
  };
}

export class TerminalHistory {
  entries = new Map();

  async page(key, cursor, capture, now = Date.now()) {
    for (const [id, item] of this.entries) if (item.expires <= now) this.entries.delete(id);
    let item = this.entries.get(key);
    if (cursor !== null) {
      if (!item || !historyCursor(cursor)) return { state: 'unavailable' };
      const [generation, offset] = cursor.split('_');
      const end = Number(offset);
      if (generation !== item.generation || !item.valid.has(end)) return { state: 'unavailable' };
      const result = page(item, end);
      if (result.before) item.valid.add(Number(result.before.split('_')[1]));
      return result;
    }
    if (!item) {
      const reading = await capture();
      if (!reading || typeof reading.text !== 'string') return { state: 'unavailable' };
      // Another concurrent reader for this generation is already authoritative.
      item = this.entries.get(key);
      if (!item) {
        item = { ...reading, generation: randomUUID(), expires: Date.now() + lifetime, valid: new Set() };
        if (this.entries.size >= maxSnapshots) this.entries.delete(this.entries.keys().next().value);
        this.entries.set(key, item);
      }
    }
    const result = page(item, item.text.length);
    if (result.before) item.valid.add(Number(result.before.split('_')[1]));
    return result;
  }
}
