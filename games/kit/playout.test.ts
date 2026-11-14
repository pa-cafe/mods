import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { limits, OverLimit, type AnyTableGame, type TableGame } from './game.ts';
import { admit, playout } from './playout.ts';
import { pick, seeded, shuffle } from './random.ts';

interface ToyState {
  stage: string;
  n: number;
  junk: string[];
}
const toyMove = z.strictObject({ action: z.literal('tick'), pad: z.string().optional() });
type Toy = TableGame<ToyState, z.infer<typeof toyMove>, unknown>;
const title = { 'zh-TW': '玩具', 'zh-CN': '玩具', ja: 'おもちゃ', ko: '장난감', en: 'Toy' };
const done = { summary: 'done', counted: true };

/** A twenty-move game with nothing wrong with it. Each case below breaks one thing. */
const toy = (broken: Partial<Toy> = {}): AnyTableGame => ({
  card: { id: 'toy', title, players: { min: 1, max: 2 }, residents: false },
  move: toyMove,
  start: () => ({ stage: 'only', n: 0, junk: [] }),
  legal: () => ['tick'],
  play: (s) => (++s.n >= 20 ? done : undefined),
  view: (s) => ({ n: s.n }),
  bot: () => ({ action: 'tick' }),
  ...broken,
} satisfies Toy);

const limitHit = (game: AnyTableGame) => {
  try {
    admit(game, 1);
  } catch (error) {
    if (error instanceof OverLimit) return error.limit;
    throw error;
  }
};

describe('the admission check', () => {
  it('admits a game that ends inside every limit and reports what it ran', () => {
    expect(admit(toy(), 3)).toEqual({ matches: 6, moves: 120 });
  });

  it.each<[string, keyof typeof limits, Partial<Toy>]>([
    ['never ends', 'movesPerMatch', { play: () => undefined }],
    ['grows its state on every move', 'stateBytes', { play: (s) => void s.junk.push('x'.repeat(1000)) }],
    ['shows a seat its whole state', 'viewBytes', { play: (s) => (s.junk.push('x'.repeat(1000)), ++s.n >= 20 ? done : undefined), view: (s) => s }],
    ['sends an oversized move', 'moveBytes', { bot: () => ({ action: 'tick', pad: 'x'.repeat(3000) }) }],
    ['floods the table log', 'linesPerMove', { play: (s, _seat, _move, ctx) => { for (let i = 0; i <= limits.linesPerMove; i++) ctx.say(`line ${i}`); return ++s.n >= 20 ? done : undefined; } }],
    ['writes an overlong log line', 'lineChars', { play: (s, _seat, _move, ctx) => (ctx.say('x'.repeat(limits.lineChars + 1)), ++s.n >= 20 ? done : undefined) }],
    ['calls on a seat with every move', 'turnsPerSeat', { play: (s) => ((s.stage = `stage-${++s.n}`), s.n >= 200 ? done : undefined) }],
    ['spends too long on every move', 'msPerMove', { play: (s) => { let x = 0; for (let i = 0; i < 4e7; i++) x += i % 7; s.junk = [String(x)]; return ++s.n >= 4 ? done : undefined; } }],
  ])('turns away a game that %s', (_what, limit, broken) => {
    expect(limitHit(toy(broken))).toBe(limit);
  });

  it('turns away a game whose matches differ between two runs of one seed', () => {
    let runs = 0;
    const drifting = toy({ start: () => ({ stage: 'only', n: runs++, junk: [] }) });
    expect(() => admit(drifting, 1)).toThrow('does not replay to the same match');
  });

  it('turns away a game that stalls with no seat able to move and no ending', () => {
    expect(() => admit(toy({ legal: (s) => (s.n < 3 ? ['tick'] : []), play: (s) => void s.n++ }), 1)).toThrow('no seat can move');
  });

  it('turns away a computer player that plays a move the rules do not allow', () => {
    const cheating: TableGame<ToyState, { action: 'tick' | 'jump' }, unknown> = {
      ...(toy() as Toy),
      move: z.strictObject({ action: z.enum(['tick', 'jump']) }),
      legal: () => ['tick'],
      bot: () => ({ action: 'jump' }),
    };
    expect(() => admit(cheating, 1)).toThrow('bot played jump, which is not legal');
  });

  it('turns away a move the game’s own schema rejects', () => {
    expect(() => admit(toy({ bot: () => ({ action: 'tick', extra: true }) as never }), 1)).toThrow();
  });

  it('accepts a score inside the declared range and turns away one outside it or one that was never declared', () => {
    const score = { label: title, best: 'highest' as const, max: 100, share: false };
    const ending = (value: number) => ({ play: (s: ToyState) => (++s.n >= 20 ? { ...done, scores: { s0: value } } : undefined) });
    expect(playout({ ...toy(ending(100)), card: { ...toy().card, score } }, 1, 1).ending.scores).toEqual({ s0: 100 });
    expect(() => playout({ ...toy(ending(101)), card: { ...toy().card, score } }, 1, 1)).toThrow('outside 0–100');
    expect(() => playout({ ...toy(ending(1.5)), card: { ...toy().card, score } }, 1, 1)).toThrow('outside 0–100');
    expect(() => playout(toy(ending(5)), 1, 1)).toThrow('declares none');
  });

  it('needs a computer player to run', () => {
    expect(() => playout(toy({ bot: undefined }), 1, 1)).toThrow('needs bot()');
  });
});

describe('seeded randomness', () => {
  it('repeats for one seed and differs between seeds', () => {
    const draw = (seed: number) => { const rng = seeded(seed); return Array.from({ length: 8 }, rng); };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
    expect(draw(7).every((n) => Number.isInteger(n) && n >= 0 && n < 2 ** 32)).toBe(true);
  });

  it('shuffles without losing or inventing items and picks only from what it is given', () => {
    const rng = seeded(3);
    expect(shuffle(rng, [1, 2, 3, 4, 5, 6]).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(Array.from({ length: 200 }, () => pick(rng, ['a', 'b', 'c'])))).toEqual(new Set(['a', 'b', 'c']));
  });
});
