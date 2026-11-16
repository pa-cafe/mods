import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { blastCard } from '../games/barista-blast/card.ts';
import { rescore } from '../games/kit/play.ts';
import { simulate, summarize } from './simulate.ts';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}.js`, import.meta.url));

it('prints the score the cafe would compute for the same seed and answer', async () => {
  const runs = await simulate({ game: 'barista-blast', bot: fixture('steady'), seed: 1, runs: 3, cast: ['claude'] });
  expect(runs.map((run) => run.seed)).toEqual([1, 2, 3]);
  for (const run of runs) {
    const cafe = rescore(blastCard.play, blastCard.version, run.seed, ['claude'], { aim: 31, hold: 51, taps: Array.from({ length: 60 }, (_, i) => i * 50 + 30), pilot: 'grok', why: '' });
    expect(run.ok && cafe.ok).toBe(true);
    expect(run.score).toBe(cafe.ok ? cafe.result.score : -1);
    expect(run.why).toBe(`seed ${run.seed}: tap every 50 steps`);
  }
  expect(runs[0].score).toBe(6_193_377_535);
  expect(summarize(runs).best).toBe(Math.max(...runs.map((run) => run.score)));
});

it('plays an older version under its own rules', async () => {
  const [run] = await simulate({ game: 'barista-blast', bot: fixture('steady'), seed: 1, version: 8, cast: ['claude'] });
  expect(run.score).toBe(29_918_777_287);
});

it('scores nothing for a bot that runs out of time or throws', async () => {
  const [late] = await simulate({ game: 'barista-blast', bot: fixture('spin') });
  expect(late).toMatchObject({ ok: false, score: 0, reason: 'wall' });
  const [thrown] = await simulate({ game: 'barista-blast', bot: fixture('broken') });
  expect(thrown).toMatchObject({ ok: false, score: 0, reason: 'error', message: 'no plan' });
}, 10_000);

it('refuses a game that cannot be played as code, or a version it does not have', async () => {
  await expect(simulate({ game: 'werewolf', bot: fixture('steady') })).rejects.toThrow('cannot be played as code');
  await expect(simulate({ game: 'barista-blast', bot: fixture('steady'), version: 3 })).rejects.toThrow('no rules version 3');
});
