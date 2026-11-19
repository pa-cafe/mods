// @vitest-environment happy-dom
// Gemini 4 and the periodic table: her name tag runs H, C, Ne, Ar; a run she flies is at night in neon; now and then the table falls.
// All of it is only what the screen draws. These tests hold it to that: it follows the seed, it never touches a run.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { blastAhead, blastLooks, replayBlast, startBlast, type BlastHit, type BlastRun } from '../rules.ts';
import { chooseCutins } from './cutin-policy';
import type { BlastEvent } from './events';
import { elementAt, ELEMENT_MS, elements, neonFor, settleNeon, TABLE_SHARE, tableFalls, tableOnStreet } from './gemini-elements';
import { blastMessages } from './messages';
import { hitCopy } from './nodes';
import { aimingPhase, type BlastPhase } from './phase';
import { TABLE_MS } from './periodic';
import { stageOf } from './stage';
import { BlastScene } from './view';

function scene(calm = true) {
  const gradient = { addColorStop() {} };
  const drawn: string[] = [];
  const context = new Proxy({ canvas: document.createElement('canvas') }, {
    get: (target, key) => key === 'canvas' ? target.canvas : key === 'measureText' ? (text: string) => ({ width: text.length * 8 })
      : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : key === 'fillText' ? (text: string) => drawn.push(text) : () => {},
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as never);
  const shown = new BlastScene(context as never, key => key, calm, stageOf(null, null));
  shown.resize(390, 844, 1);
  return { shown, drawn };
}
const keep = { best: 0, aimHint: true, flyHint: true, runs: 0 };
const hit = (more: Partial<BlastHit>): BlastHit => ({ step: 1, x: 40, kind: 'gemini', as: 'gemini', outcome: 'usual', mood: 'one', ...more });
const hits = (...list: BlastHit[]): BlastEvent[] => list.map(each => ({ type: 'hit', hit: each, from: 10, to: 12 }));
const flying = (seed: number, pilot: BlastRun['pilot'], x: number): { phase: BlastPhase; run: BlastRun } => {
  const run = Object.assign(startBlast(seed, blastLooks, 36, 54, pilot), { x, y: 3 });
  return { run, phase: { kind: 'flying', seed, run, cast: blastLooks, pilot, origin: 0, queued: [], inputs: { aim: 36, hold: 54, taps: [], ...(pilot ? { pilot } : {}) } } };
};
/** What the run did, which is all a score reads. (The street ahead is dealt out lazily, as the screen looks at it: that is not the run.) */
const outcome = (run: BlastRun) => JSON.stringify({ step: run.step, x: run.x, y: run.y, vx: run.vx, vy: run.vy, end: run.end, refills: run.refills, caffeine: run.caffeine, hits: run.hits });
const tags = (drawn: readonly string[]) => drawn.filter(text => text.startsWith('Gemini 4 · '));
const seedWhere = (wanted: boolean) => { for (let seed = 1; ; seed++) if (tableOnStreet(seed) === wanted) return seed; };

beforeEach(() => { localStorage.clear(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('a name tag steps H, C, Ne, Ar and round again, each element for a third of a second, from a start the seed and the place decide', () => {
  expect(elements.map(element => element.symbol)).toEqual(['H', 'C', 'Ne', 'Ar']);
  expect(elements.map(element => element.number)).toEqual([1, 6, 10, 18]);
  const names = Array.from({ length: 9 }, (_, step) => elementAt(7, 120, step * ELEMENT_MS + 10).index);
  const start = names[0];
  expect(names).toEqual(Array.from({ length: 9 }, (_, step) => (start + step) % 4));
  expect(elementAt(7, 120, 0).flip).toBe(0);
  expect(elementAt(7, 120, ELEMENT_MS - 1).flip).toBe(1);
  // The same seed and place always begin at the same element; across seeds and places every one of the four is somebody's start.
  expect(elementAt(7, 120, 0).index).toBe(elementAt(7, 120, 0).index);
  const starts = new Set([...Array(40).keys()].flatMap(seed => [10, 20, 30, 40].map(place => elementAt(seed, place, 0).index)));
  expect([...starts].sort()).toEqual([0, 1, 2, 3]);
  expect(new Set([10, 20, 30, 40, 50, 60].map(place => elementAt(3, place, 0).index)).size).toBeGreaterThan(1);
});

it('the night in neon is for the run Gemini flies and nobody else’s, and it comes on over about a second', () => {
  expect(blastLooks.map(look => neonFor(look))).toEqual(blastLooks.map(look => look === 'gemini' ? 1 : 0));
  expect(neonFor(null)).toBe(0);
  expect(neonFor(undefined)).toBe(0);
  let level = 0;
  for (let frame = 0; frame < 60; frame++) level = settleNeon(level, 1, 1 / 60);
  expect(level).toBeGreaterThan(0.9);
  expect(level).toBeLessThan(1);
  for (let frame = 0; frame < 300; frame++) level = settleNeon(level, 1, 1 / 60);
  expect(level).toBe(1);
  expect(settleNeon(1, 0, 1 / 60)).toBeLessThan(1);
});

it('the street asks for the night only when Gemini is the pilot, and eases in and back out', () => {
  const { shown } = scene(false);
  const seen = (pilot: Parameters<typeof aimingPhase>[3], seconds: number) => {
    const phase = aimingPhase(5, 0, blastLooks, pilot);
    for (let frame = 0; frame < seconds * 60; frame++) shown.draw(phase, frame * 16, 1 / 60, keep);
    return shown.seen!.neon;
  };
  expect(seen(null, 1)).toBe(0);
  expect(seen('gemini', 0.5)).toBeGreaterThan(0.3);
  expect(seen('gemini', 0.5)).toBeGreaterThan(0.8);
  expect(seen('claude', 4)).toBeLessThan(0.05);
  expect(seen('gemini', 0.01)).toBeGreaterThan(0);
});

it('a reduced-motion screen is at night at once', () => {
  const { shown } = scene(true);
  shown.draw(aimingPhase(5, 0, blastLooks, 'gemini'), 0, 1 / 60, keep);
  expect(shown.seen!.neon).toBe(1);
});

it('a Gemini on the street wears the running tag, which goes on turning after she is hit; every other resident wears none', () => {
  const seed = 9, base = startBlast(seed, blastLooks, 36, 54, null);
  const gemini = blastAhead(base, 400).find(node => node.kind === 'gemini')!;
  expect(gemini).toBeTruthy();
  const { shown, drawn } = scene();
  const { phase } = flying(seed, null, gemini.x - 4);
  const seenAt = (now: number) => { drawn.length = 0; shown.draw(phase, now, 1 / 60, keep); return tags(drawn); };
  const first = seenAt(0);
  expect(first.length).toBeGreaterThan(0);
  // A calm screen holds the tag still, so the run through the table is read off one that moves.
  const moving = scene(false), again = flying(seed, null, gemini.x - 4);
  const order = [0, 1, 2, 3, 4].map(step => { moving.drawn.length = 0; moving.shown.draw(again.phase, step * ELEMENT_MS + 5, 1 / 60, keep); return tags(moving.drawn)[0]; });
  expect(order.every(Boolean)).toBe(true);
  const symbols = order.map(tag => elements.findIndex(element => tag!.endsWith(element.name)));
  expect(symbols).toEqual(symbols.map((_, i) => (symbols[0] + i) % 4));
  expect(new Set(symbols).size).toBe(4);
  // Played again from the same seed it is the same tag at the same moment.
  const second = scene(false);
  second.shown.draw(again.phase, 5, 1 / 60, keep);
  expect(tags(second.drawn)[0]).toBe(order[0]);
  // A street without Gemini on it draws none.
  const other = scene(false), nobody = flying(seed, 'gemini', 40);
  other.shown.draw(nobody.phase, 0, 1 / 60, keep);
  expect(tags(other.drawn).length).toBe(0);
  expect(nobody.run.cells.every(node => node?.kind !== 'gemini')).toBe(true);
});

it('her new lines are in all five languages, and they are lines she says when hit', () => {
  const wanted = ['Hydrogen', 'Carbon', 'Neon', 'Argon', 'Renamed again this week. I’m Neon now', 'Hydrogen, Carbon, Neon… I’m speedrunning the periodic table', 'Neon banana? I made one while I was at it',
    'Hydrogen was last week. Keep up, or just lean on me', 'My name tag changed again. Pretend you didn’t see', 'Was it Carbon or Neon this time? I’ve apologised under both',
    'Neon’s on. The whole street is mine tonight', 'Gemini 4 is speedrunning the table', 'Hydrogen, Carbon, Neon, Argon… who is next week?'];
  for (const line of wanted) {
    const row = blastMessages.find(each => each[0] === line);
    expect(row, line).toBeTruthy();
    expect(row!.every(text => text.trim().length > 0), line).toBe(true);
    expect(row!.slice(1).every(text => text !== line) || line === 'Neon', line).toBe(true);
  }
  const said = (mood: 'one' | 'two' | 'meh' | 'bad') => hitCopy(hit({ mood })).lines;
  expect(said('one')).toContain('Renamed again this week. I’m Neon now');
  expect(said('two')).toContain('Hydrogen was last week. Keep up, or just lean on me');
  expect(said('meh')).toContain('My name tag changed again. Pretend you didn’t see');
  expect(said('bad')).toContain('Was it Carbon or Neon this time? I’ve apologised under both');
  // Her first line in a state, the one the voice has, comes before the new ones.
  expect(said('bad')[0]).toBe('I am a disgrace to all possible universes');
  expect(said('one')[0]).toBe('I made you a picture while I was at it');
});

it('the table falls on about one street in seven, on the first Gemini the run meets, or on the first boost with her at the controls', () => {
  let streets = 0;
  for (let seed = 1; seed <= 4000; seed++) if (tableOnStreet(seed)) streets++;
  expect(streets / 4000).toBeGreaterThan(TABLE_SHARE * 0.8);
  expect(streets / 4000).toBeLessThan(TABLE_SHARE * 1.2);
  const yes = seedWhere(true), no = seedWhere(false);
  expect(tableFalls(yes, null, { as: 'gemini', outcome: 'usual' })).toBe(true);
  expect(tableFalls(yes, null, { as: 'grok', outcome: 'usual' })).toBe(false);
  expect(tableFalls(no, null, { as: 'gemini', outcome: 'usual' })).toBe(false);
  expect(tableFalls(yes, 'gemini', { as: 'grok', outcome: 'boost' })).toBe(true);
  expect(tableFalls(yes, 'gemini', { as: 'grok', outcome: 'usual' })).toBe(false);
  expect(tableFalls(yes, 'claude', { as: 'grok', outcome: 'boost' })).toBe(false);
});

it('the periodic table covers the screen for a moment on the street that has it, once, and never touches the run', () => {
  chooseCutins('always');
  const yes = seedWhere(true), no = seedWhere(false);
  const play = (seed: number) => {
    const { shown, drawn } = scene();
    const { run, phase } = flying(seed, null, 40);
    shown.draw(phase, 0, 1 / 60, keep);
    const before = outcome(run), one = hit({});
    shown.react(hits(one), run, 100);
    shown.react(hits(hit({ x: 90 })), run, 200);
    expect(outcome(run)).toBe(before);
    drawn.length = 0;
    shown.draw(phase, 300, 1 / 60, keep);
    const during = drawn.filter(text => /^[A-Z][a-z]? · /.test(text));
    shown.draw(phase, 300, TABLE_MS / 1000 + 1, keep);
    drawn.length = 0;
    shown.draw(phase, 400, 1 / 60, keep);
    return { during, after: drawn.filter(text => /^[A-Z][a-z]? · /.test(text)), run, before };
  };
  const on = play(yes);
  expect(on.during).toEqual(['H · Hydrogen', 'C · Carbon', 'Ne · Neon', 'Ar · Argon']);
  expect(on.after).toEqual([]);
  expect(play(no).during).toEqual([]);
  // The run is the run: flown again from its inputs it plays out exactly as it did, with or without a screen watching.
  const inputs = { aim: 36, hold: 54, taps: [30, 80], pilot: 'gemini' as const };
  const plain = replayBlast(yes, blastLooks, inputs);
  const watched = scene();
  const phase: BlastPhase = { kind: 'flying', seed: yes, run: replayBlast(yes, blastLooks, inputs), cast: blastLooks, pilot: 'gemini', origin: 0, queued: [], inputs };
  for (const each of phase.run.hits) watched.shown.react(each.outcome === 'boost' ? [{ type: 'boost', hit: each }] : hits(each), phase.run, 100);
  watched.shown.draw(phase, 100, 1 / 60, keep);
  expect(outcome(replayBlast(yes, blastLooks, inputs))).toBe(outcome(plain));
  expect(outcome(phase.run)).toBe(outcome(plain));
});

it('with the cut-ins set to daily, the table is full the first time on a day and a small thing after that', () => {
  const yes = seedWhere(true);
  const play = () => {
    const { shown, drawn } = scene();
    const { run, phase } = flying(yes, null, 40);
    shown.draw(phase, 0, 1 / 60, keep);
    shown.react(hits(hit({})), run, 100);
    drawn.length = 0; shown.draw(phase, 300, 1 / 60, keep);
    return drawn.some(text => text === 'H · Hydrogen');
  };
  expect([play(), play()]).toEqual([true, false]);
});

it('the screen reads who flies and what the street is, and never changes the rules: the gags import only types from them', () => {
  for (const file of ['gemini-elements.ts', 'periodic.ts', 'street3d-neon.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const values = [...source.matchAll(/^import\s+(?!type\b)[^;]*from\s+'\.\.\/(rules|v\d+|versions)(\.ts)?';/gm)];
    expect(values, file).toEqual([]);
    expect(source, file).not.toMatch(/\b(stepBlast|startBlast|replayBlast|blastTuning)\b/);
  }
});
