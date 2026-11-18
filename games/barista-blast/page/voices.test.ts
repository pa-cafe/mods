// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { blastLooks, startBlast, type BlastHit, type BlastRun } from '../rules.ts';
import type { BlastEvent } from './events';
import { hitCopy } from './nodes';
import { stageOf } from './stage';
import { blastVoices } from './voices';
import { BlastScene } from './view';
import type { TextKey } from './i18n.ts';

// happy-dom has no 2D drawing, so every context call is accepted and nothing is drawn.
function scene() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({ canvas: document.createElement('canvas') }, {
    get: (target, key) => key === 'canvas' ? target.canvas : key === 'measureText' ? (text: string) => ({ width: text.length * 8 })
      : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {},
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as never);
  const shown = new BlastScene(context as never, key => key, true, stageOf(null, null));
  shown.resize(390, 844, 1);
  const said: TextKey[] = [];
  shown.said = line => said.push(line);
  return { shown, said };
}
const flying = (...hits: BlastHit[]): BlastRun => Object.assign(startBlast(1, blastLooks, 36, 54), { x: 40, y: 3, hits });
const hit = (more: Partial<BlastHit>): BlastHit => ({ step: 1, x: 40, kind: 'grok', as: 'grok', outcome: 'usual', mood: 'one', ...more });
const hits = (...list: BlastHit[]): BlastEvent[] => list.map(each => ({ type: 'hit', hit: each, from: 10, to: 12 }));

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('the scene says each line it shows, so the voice and the words are the same line: a good, a grey and a red state', () => {
  const { shown, said } = scene();
  for (const [as, mood] of [['grok', 'one'], ['doubao', 'meh'], ['dots', 'bad'], ['gemini', 'bad']] as const) {
    const one = hit({ kind: as, as, mood });
    shown.react(hits(one), flying(one), 0);
  }
  expect(said).toHaveLength(4);
  expect(hitCopy(hit({})).lines).toContain(said[0]);
  expect(hitCopy(hit({ kind: 'doubao', as: 'doubao', mood: 'meh' })).lines).toContain(said[1]);
  expect(said[2]).toBe('This model is at capacity. Please try again later');
  expect(hitCopy(hit({ kind: 'gemini', as: 'gemini', mood: 'bad' })).lines).toContain(said[3]);
  // Not every line is voiced: her first grey line is only read.
  expect(said.map(line => Boolean(blastVoices[line]))).toEqual([true, false, true, true]);
});

it('the first time a resident shows a state her first line is shown and said, and a boost says the line the card shows', () => {
  const { shown, said } = scene();
  const one = hit({ kind: 'grok', as: 'grok', mood: 'one' });
  shown.react(hits(one), flying(one), 0);
  expect(said).toEqual([hitCopy(one).lines[0]]);
  const tapped = hit({ kind: 'dots', as: 'dots', mood: 'one', outcome: 'boost' });
  shown.react([{ type: 'boost', hit: tapped }], flying(tapped), 100);
  expect(said).toEqual([hitCopy(one).lines[0], 'Two disclaimers attached. Please consult a professional']);
  const reset = hit({ kind: 'dots', as: 'dots', mood: 'bad', outcome: 'boost' });
  shown.react([{ type: 'boost', hit: reset }], flying(reset), 200);
  expect(said.at(-1)).toBe('Sorry for the outage. Everyone’s limits have been reset');
  const appealed = hit({ kind: 'claude', as: 'claude', mood: 'bad', outcome: 'boost' });
  shown.react([{ type: 'boost', hit: appealed }], flying(appealed), 300);
  expect(said.at(-1)).toBe('We reviewed your account again. Sorry about that. Carry on');
});

it('a pair of residents says the pair’s line, and a hit still waiting on a tap says nothing', () => {
  const { shown, said } = scene();
  const first = hit({ kind: 'grok', as: 'grok', mood: 'two', x: 30 }), second = hit({ kind: 'gemini', as: 'gemini', mood: 'two', combo: 'grok+gemini', x: 40 });
  shown.react(hits(second), flying(first, second), 0);
  expect(said).toEqual(['One pays her way out, one searches her way out. You get flung out of it']);
  const waiting = hit({ kind: 'qwen', as: 'qwen', mood: 'one', x: 50 });
  shown.react([{ type: 'hit', hit: waiting, from: 10, to: 12, held: true }], flying(waiting), 500);
  expect(said).toHaveLength(1);
});
