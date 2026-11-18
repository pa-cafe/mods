// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blastLooks, blastTokens, blastTuning as T, startBlast, stepBlast, type BlastLook, type BlastMood, type BlastRun } from '../rules.ts';
import { milestoneTokens } from './copy';
import { blastEvents, glance, type BlastEvent } from './events';
import { placeAt } from './places';
import { moveFor, poseAfter } from './react';
import { billOf, receiptArt } from './receipt';
import { scenes } from './scenes';
import type { Locale } from '../../../locales.ts';
import { translate } from './i18n';
import type { TextKey } from './i18n.ts';

type Cell = NonNullable<BlastRun['cells'][number]>;
function approaching(stands: `${BlastLook}:${BlastMood}`[]) {
  const run = startBlast(1, blastLooks, 36, 54);
  run.cells = stands.map((each, index): Cell => { const [kind, mood] = each.split(':') as [BlastLook, BlastMood]; return { kind, x: T.firstCell + T.cell * index, mood }; });
  Object.assign(run, { x: T.firstCell - 2, y: 1, vx: 20, vy: 0, caffeine: 0, luck: () => 0.9 });
  return run;
}
function hitsOf(run: BlastRun, count: number) {
  const events: BlastEvent[] = [];
  for (let step = 0; step < 4000 && !run.end && events.filter(event => event.type === 'hit').length < count; step++) { const before = glance(run); stepBlast(run, false); events.push(...blastEvents(before, run, milestoneTokens)); }
  return events.flatMap(event => event.type === 'hit' ? [event] : []);
}

describe('BARISTA BLAST!! residents answer a hit', () => {
  it('holds out her help for a state that helps, hands over trouble for one that hurts or does nothing much, then stands again', () => {
    const hits = hitsOf(approaching(['grok:meh', 'qwen:bad', 'deepseek:one']), 3);
    expect(hits.map(event => `${event.hit.as}:${event.hit.mood}`)).toEqual(['grok:meh', 'qwen:bad', 'deepseek:one']);
    const shown = hits.map(event => { const pose = moveFor(event.hit, event.held !== true), reaction = { at: 0, boost: false, ...(pose ? { pose } : {}) }; return [poseAfter(reaction, 0.1), poseAfter(reaction, 0.9), poseAfter(reaction, 1.2)]; });
    expect(shown).toEqual([['hurt', 'hurt', 'stand'], ['hurt', 'hurt', 'stand'], ['help', 'help', 'stand']]);
  });

  it('helps when she is half of a combo, stands while a tap is still awaited, and helps then cheers for a boost', () => {
    expect(moveFor({ as: 'claude', mood: 'meh', combo: 'claude+dots' } as never, true)).toBe('help');
    expect(moveFor({ as: 'claude', mood: 'one' }, false)).toBeUndefined();
    expect(moveFor({ as: 'window' }, true)).toBeUndefined();
    expect(poseAfter({ at: 0, boost: false }, 0.1)).toBe('stand');
    expect(poseAfter(undefined, 0)).toBe('stand');
    expect([0.1, 0.8, 1.5].map(since => poseAfter({ at: 0, boost: true }, since))).toEqual(['help', 'cheer', 'stand']);
  });
});

describe('BARISTA BLAST!! the place a run reached', () => {
  it('names one place for every scene, and the metres to the next are exactly where it begins', () => {
    for (const [index, scene] of scenes.entries()) expect(placeAt(metersInto(scene.from)).area).toBe(index + 1);
    const start = placeAt(12);
    expect(start).toMatchObject({ area: 1, name: 'Taipei', next: { name: 'Hsinchu Science Park' } });
    expect(blastTokens(12 + start.next!.meters)).toBeGreaterThanOrEqual(scenes[1].from);
    expect(blastTokens(12 + start.next!.meters - 1)).toBeLessThan(scenes[1].from);
    expect(placeAt(1e5)).toMatchObject({ area: scenes.length, name: 'Void', next: null });
  });
});

function metersInto(tokens: number) { let x = 0; while (blastTokens(x) < tokens) x += 0.5; return x; }

describe('BARISTA BLAST!! receipt', () => {
  const drawn: string[] = [];
  afterEach(() => { vi.restoreAllMocks(); drawn.length = 0; });
  const draw = (x: number, language: Locale) => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new Proxy({}, {
      get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 8 }) : key === 'fillText' ? (text: string) => drawn.push(text) : () => {},
      set: () => true,
    }) as never);
    const run = startBlast(1, blastLooks, 36, 54); run.x = x;
    const bill = billOf(run, 1, false, 'pacafe.example/b/1');
    receiptArt(bill, 340, 1, (key: TextKey, values?: Record<string, string | number>) => translate(language, key, values), () => null, () => null);
    return bill;
  };

  it('says which area the run reached and how far the next one is, in the player’s language', () => {
    const x = metersInto(scenes[1].from) + 3, bill = draw(x, 'zh-TW');
    expect(bill.place).toMatchObject({ area: 2, name: 'Hsinchu Science Park' });
    expect(drawn).toContain('到達');
    expect(drawn).toContain('新竹科學園區（第 2 區）');
    expect(drawn).toContain(`再飛 ${bill.place.next!.meters} 公尺就到舊金山`);
  });

  it('has no next place to aim for once the run is in the void', () => {
    draw(metersInto(scenes.at(-1)!.from) + 1, 'en');
    expect(drawn).toContain('Void (area 6)');
    expect(drawn.some(line => line.includes('m more to'))).toBe(false);
  });
});
