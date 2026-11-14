import { expect, it } from 'vitest';
import { tableGames } from './index.ts';
import { admit } from './kit/playout.ts';

it.each(Object.values(tableGames))('$card.id passes the admission check at every table size it allows', (game) => {
  const { min, max } = game.card.players;
  expect(admit(game).matches).toBe((max - min + 1) * 100);
});
