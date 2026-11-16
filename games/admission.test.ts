/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { parseSkillFrontmatter } from '../skills/skill-file.ts';
import { simulate } from '../bin/simulate.ts';
import { gameCards, tableGames } from './index.ts';
import type { GameCard } from './kit/game.ts';
import { playInput, playLimits, rescore } from './kit/play.ts';
import { admit } from './kit/playout.ts';

it.each(Object.values(tableGames))('$card.id passes the admission check at every table size it allows', (game) => {
  const { min, max } = game.card.players;
  expect(admit(game).matches).toBe((max - min + 1) * 100);
});

// What each game folder carries, read as text without running any of it.
const files = import.meta.glob(['./*/README.md', './*/skill.md', './*/examples/bot.js', './*/tools/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const has = (path: string) => typeof files[path] === 'string' && files[path].trim().length > 0;
const cards: GameCard[] = Object.values(gameCards);

describe.each(cards)('$id brings what every game brings', (card) => {
  const folder = `./${card.id}`;

  it('has a README.md saying how to play it', () => {
    expect(has(`${folder}/README.md`)).toBe(true);
    expect(Number.isInteger(card.version) && card.version > 0).toBe(true);
  });

  it.runIf(card.residents !== false)('has a skill.md a resident can import', () => {
    expect(has(`${folder}/skill.md`)).toBe(true);
    expect(parseSkillFrontmatter(files[`${folder}/skill.md`])?.name).toBe(card.id);
  });

  it.runIf(Boolean(card.play))('can be played as code: a sample bot, tools, and its own version among those it replays', () => {
    expect(has(`${folder}/examples/bot.js`)).toBe(true);
    expect(has(`${folder}/tools/verify.ts`)).toBe(true);
    expect(has(`${folder}/tools/replay.ts`)).toBe(true);
    expect(card.play!.versions[card.version]).toBeDefined();
  });
});

const playable = cards.filter((card) => card.play);
type Bot = (input: unknown, rules: unknown) => unknown;
const seeds = [1, 2, 3, 20261116];

describe.each(playable)('$id sample bot', (card) => {
  const bot = new URL(`./${card.id}/examples/bot.js`, import.meta.url).pathname;

  it('finishes within the limits on every seed, and the same seed gives the same answer and score', async () => {
    const first = await simulate({ game: card.id, bot, seed: seeds[0], runs: seeds.length });
    const again = await simulate({ game: card.id, bot, seed: seeds[0], runs: seeds.length });
    for (const [index, run] of first.entries()) {
      expect(run, `seed ${run.seed}: ${run.message}`).toMatchObject({ ok: true });
      expect(run.cpuMs).toBeLessThanOrEqual(playLimits.cpuMs);
      expect(again[index]).toMatchObject({ score: run.score, why: run.why, detail: run.detail });
    }
  }, 30_000);

  it('plays under every version it replays, twice to the same score', async () => {
    const play = card.play!;
    const loaded = await import(/* @vite-ignore */ bot) as { play?: Bot; default?: Bot };
    const answer = (loaded.play ?? loaded.default)!;
    for (const version of Object.keys(play.versions).map(Number)) {
      const rules: unknown = await import(/* @vite-ignore */ `./${play.rules[version]}`);
      const cast = play.cast.values.slice(0, play.cast.max), input = playInput(card.id, version, 7, cast);
      const sent = JSON.parse(JSON.stringify(await answer(input, rules)));
      const once = rescore(play, version, 7, cast, sent), twice = rescore(play, version, 7, cast, sent);
      expect(once.ok, once.ok ? '' : once.message).toBe(true);
      expect(twice).toEqual(once);
    }
  });
});
