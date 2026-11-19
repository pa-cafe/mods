import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blastMeters, blastTokens, blastLooks, startBlast, type BlastHit, type BlastLook, type BlastRun } from '../rules.ts';
import figures from '../art/lying.json';
import thumbs from '../art/thumbs.json';
import { cardFigure, cardPoseAt, cardPoseFor, shareCard } from './share-card';
import { scenes } from './scenes';

const hit = (as: BlastHit['as'], x: number, outcome: BlastHit['outcome'] = 'usual'): BlastHit => ({ step: 0, x, kind: as, as, outcome });
/** A finished run that went `x` metres, flown by `pilot`, with these hits. */
const run = (x: number, hits: BlastHit[] = [], pilot: BlastLook | null = null): BlastRun => ({ ...startBlast(1, blastLooks, 0, 0, pilot), x, hits });
// Tokens at which the divine realm opens, and the metres that is: the first whole metre past it.
const DIVINE = scenes[scenes.length - 2].from;
const robedAt = (() => { let m = 1000; while (blastTokens(m) < DIVINE) m++; return m; })();

describe('BARISTA BLAST!! chibi bill: who stands on it', () => {
  it('is the one who boosted most when somebody was hit, as it always was', () => {
    expect(cardFigure(run(2000, [hit('claude', 10), hit('qwen', 90, 'boost')], 'dots'), 'muse')).toMatchObject({ look: 'qwen', hit: { x: 90 } });
    expect(cardFigure(run(60, [hit('doubao', 20), hit('doubao', 30)]))?.look).toBe('doubao');
  });

  it('is the resident who flew when nobody was hit', () => {
    for (const pilot of blastLooks) expect(cardFigure(run(2.5, [], pilot), 'muse')).toMatchObject({ look: pilot, hit: null });
    expect(cardFigure(run(300, [hit('window', 40)], 'gemini'))?.look).toBe('gemini');
  });

  it('is the barista when nobody was hit and no resident flew, in the look the page says', () => {
    expect(cardFigure(run(2.5), 'doubao')).toMatchObject({ look: 'doubao', hit: null });
    expect(cardFigure(run(2.5, [hit('window', 1)]), 'muse')?.look).toBe('muse');
  });

  it('is nobody when the page cannot say who the barista is', () => {
    expect(cardFigure(run(2.5))).toBeNull();
    expect(cardFigure(run(2.5), null)).toBeNull();
  });
});

describe('BARISTA BLAST!! chibi bill: her pose follows the distance', () => {
  it('lies flat under 50 m, stands with a thumb up to 1,000 m, and cheers from there', () => {
    expect([cardPoseAt.short, cardPoseAt.middle]).toEqual([50, 1000]);
    for (const [meters, pose] of [[0, 'lie'], [2.5, 'lie'], [49.99, 'lie'], [50, 'thumb'], [400, 'thumb'], [999.99, 'thumb'], [1000, 'cheer'], [2400, 'cheer']] as const) expect(cardPoseFor(meters, false)).toBe(pose);
  });

  it('keeps the robed cheer for the divine realm, however she got there', () => {
    expect(cardPoseFor(robedAt, true)).toBe('cheer');
    expect(cardPoseFor(5, true)).toBe('cheer');
    const far = cardFigure(run(robedAt + 1, [hit('qwen', robedAt, 'boost')]));
    expect(far).toMatchObject({ look: 'qwen', robed: true, pose: 'cheer' });
    expect(cardFigure(run(robedAt + 1, [], 'claude'))).toMatchObject({ robed: true, pose: 'cheer' });
  });

  it('reads the run by blastMeters, the distance the bill prints', () => {
    for (const [x, pose] of [[2.5, 'lie'], [49.999, 'lie'], [50.004, 'thumb'], [123.4, 'thumb'], [1500, 'cheer']] as const) {
      const flown = run(x, [], 'muse');
      expect(blastMeters(flown)).toBe(Math.floor(x * 100) / 100);
      expect(cardFigure(flown)?.pose).toBe(pose);
    }
  });

  it('is not robed before the realm opens, so a long ordinary run cheers with her arms up, not in her robe', () => {
    expect(cardFigure(run(robedAt - 1, [], 'dots'))).toMatchObject({ robed: false, pose: 'cheer' });
  });
});

describe('BARISTA BLAST!! chibi bill: the big pictures', () => {
  it('has a lying picture and a thumbs-up picture for all eight looks, sized against the same ruler', () => {
    const looks = ['dots', 'grok-bot', 'muse', 'claude', 'gemini', 'deepseek', 'qwen', 'doubao'] as const;
    for (const look of looks) {
      for (const set of [figures, thumbs] as Record<string, { file: string; width: number; height: number; body: number }>[]) {
        const picture = set[look];
        expect(picture, look).toBeDefined();
        expect(picture.file).toMatch(new RegExp(`^(lying|thumbs)/${look}\\.[0-9a-f]{10}\\.webp$`));
        expect(picture.width).toBeGreaterThan(0);
        if (set === thumbs) expect(picture.body).toBeLessThanOrEqual(picture.height);
      }
      expect((figures as Record<string, { body: number }>)[look].body).toBe((thumbs as Record<string, { body: number }>)[look].body);
    }
  });
});

// The picture the card asks for, and what it draws it as, with the canvas and the artwork stubbed out.
const { asked, drawn } = vi.hoisted(() => ({ asked: [] as string[], drawn: [] as { image: unknown; width: number; height: number }[] }));
vi.mock('./art', async importOriginal => {
  const real = await importOriginal<typeof import('./art')>();
  const stub = (name: string, extra: object = {}) => ({ name, naturalWidth: 400, naturalHeight: 500, ...extra });
  const ctx = new Proxy({}, { get: (_, key) => key === 'drawImage' ? (image: unknown, ...rest: number[]) => { if (rest.length === 4 && image && typeof image === 'object' && 'name' in image) drawn.push({ image, width: rest[2], height: rest[3] }); } : key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => undefined, set: () => true });
  return {
    ...real,
    houseFont: () => 'sans-serif', loadAtlas: async () => stub('atlas'),
    canvas: () => ({ getContext: () => ctx, toBlob: (done: (blob: Blob) => void) => done(new Blob(['png'])) }),
    cutinReady: async () => null, divineReady: async () => stub('divine'),
    cheerReady: async (look: string, robed: boolean) => { asked.push(`cheer:${look}${robed ? ':robed' : ''}`); return stub(`cheer:${look}`); },
    figureReady: async (look: string, pose: string) => { asked.push(`${pose}:${look}`); return { image: stub(`${pose}:${look}`), body: 400 }; },
    drawPose: (_ctx: unknown, _atlas: unknown, look: string, pose: string) => { asked.push(`drawn:${pose}:${look}`); },
  };
});
vi.mock('./graphics', () => ({ flatStreet: () => true }));
vi.mock('./cards', () => ({ wordCard: () => ({ image: { name: 'word' }, width: 100, height: 40 }) }));
vi.mock('./pictures', () => ({ blastFace: () => null, blastPicture: () => null }));

describe('BARISTA BLAST!! chibi bill: what is drawn', () => {
  const words = (key: string) => key;
  const facts = (flown: BlastRun, more: object = {}) => ({ run: flown, cafe: 'Cafe', pilot: 'Mimi', address: 'pa.cafe/@mimi', look: 'chibi' as const, ...more });
  beforeEach(() => { asked.length = 0; drawn.length = 0; });

  it('stands the flying resident on a bill nobody was hit on, lying for a very short run', async () => {
    expect(await shareCard(facts(run(2.5, [], 'gemini')), words)).toBeInstanceOf(Blob);
    expect(asked).toEqual(['lie:gemini']);
    expect(drawn.map(each => (each.image as { name: string }).name)).toContain('lie:gemini');
  });

  it('stands the barista, in her own look, when no resident flew', async () => {
    await shareCard(facts(run(300), { barista: 'doubao' }), words);
    expect(asked).toEqual(['thumb:doubao']);
  });

  it('draws nobody on a bill with nobody hit and no barista look', async () => {
    await shareCard(facts(run(300)), words);
    expect(asked).toEqual([]);
    expect(drawn).toEqual([]);
  });

  it('asks for the victory picture from a run that went far, and the robed one in the divine realm', async () => {
    await shareCard(facts(run(2000, [hit('qwen', 90, 'boost')])), words);
    await shareCard(facts(run(robedAt + 5, [hit('qwen', robedAt + 1, 'boost')])), words);
    expect(asked).toEqual(['cheer:qwen', 'cheer:qwen:robed']);
  });

  it('keeps the lying and thumbs-up pictures off the full-figure bill', async () => {
    await shareCard(facts(run(2.5, [], 'gemini'), { look: 'full' }), words);
    await shareCard(facts(run(300, [hit('qwen', 90)]), { look: 'full' }), words);
    expect(asked).toEqual([]);
  });

  it('stands a lying figure no wider than the card allows, and a standing one as tall as the victory pose', async () => {
    await shareCard(facts(run(2.5, [], 'muse')), words);
    const lying = drawn.find(each => (each.image as { name: string }).name === 'lie:muse')!;
    expect(lying.width).toBeLessThanOrEqual(600 + 1e-6);
    drawn.length = 0;
    await shareCard(facts(run(300, [], 'muse')), words);
    const standing = drawn.find(each => (each.image as { name: string }).name === 'thumb:muse')!;
    expect(standing.height).toBeGreaterThan(300);
  });
});
