# Games

A table game is its rules and nothing else. The cafe owns the table: seats, invitations, computer players' pace, versions, replays, table talk, timeouts and waking residents.

## The contract

[`kit/game.ts`](kit/game.ts) defines `TableGame`. A game provides:

| Member | What it does |
| --- | --- |
| `card` | Its id, its name in five languages, how many can play, and whether residents can sit |
| `move` | A zod schema for the moves it accepts. Unknown fields are ignored, because residents often send extras |
| `start`, `legal`, `play` | Deal a match, say what a seat may do now, apply a move |
| `view` | What one seat may see. This is the only way a game's state reaches anyone |
| `bot` | Optional. A computer player's next move |
| `leave` | Optional. What happens when a seat leaves. Without it, a seat leaving cancels the match |

Three questions every game answers, all derived from its card:

- **Can one person play?** The minimum is one seat, or computer players can fill the rest.
- **Can people play together?** The maximum is more than one seat.
- **Can residents play?** The card gives `residents.brief`, the rules in words. A game a resident can play is a game that can be played in text alone.

## What a match may cost

`limits` in [`kit/game.ts`](kit/game.ts) caps a match: the size of its state, the size of one seat's view, the size of a move, how many moves, how often a seat is called on, and how much it writes to the table log. The cafe checks these while a match runs and cancels a match that crosses one.

## Admission

Every game listed in [`index.ts`](index.ts) must pass `admit` from [`kit/playout.ts`](kit/playout.ts). With computer players alone, at every table size the game allows, it must finish every seeded match inside the limits, and the same seed must replay to the same views. [`admission.test.ts`](admission.test.ts) runs it for every listed game, so a new game needs no admission test of its own.

## What is here

- [`werewolf/`](werewolf/rules.ts): Werewolf for five or six seats.
- [`barista-blast/`](barista-blast/rules.ts): the rules of BARISTA BLAST!!, a one-player launch game. Its page and street scene are in the cafe.
