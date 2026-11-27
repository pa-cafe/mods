import { blastCard } from './barista-blast/card.ts';
import { hopCard } from './barista-hop/card.ts';
import type { AnyTableGame, GameCard } from './kit/game.ts';
import { werewolf } from './werewolf/rules.ts';

/** Every table game the cafe can open. A game joins by being listed here and passing the admission check. */
export const tableGames = { werewolf } satisfies Record<string, AnyTableGame>;

/** Every game's card, table games and the rest, by id. The cafe reads names, sizes, versions and resident play from here. */
export const gameCards = { werewolf: werewolf.card, 'barista-blast': blastCard, 'barista-hop': hopCard } satisfies Record<string, GameCard>;
