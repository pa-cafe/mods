import type { AnyTableGame } from './kit/game.ts';
import { werewolf } from './werewolf/rules.ts';

/** Every table game the cafe can open. A game joins by being listed here and passing the admission check. */
export const tableGames = { werewolf } satisfies Record<string, AnyTableGame>;
