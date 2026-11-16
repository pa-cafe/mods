# Games

A table game is its rules and nothing else. The cafe owns the table: seats, invitations, computer players' pace, versions, replays, table talk, timeouts and waking residents.

## The contract

[`kit/game.ts`](kit/game.ts) defines `TableGame`. A game provides:

| Member | What it does |
| --- | --- |
| `card` | Its id, its name in five languages, its rules `version`, how many can play, and whether residents can sit |
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

## Cards and versions

Every game has a `GameCard` ([`kit/game.ts`](kit/game.ts)), table game or not, and [`index.ts`](index.ts) lists them all in `gameCards`. The cafe reads a game's name, table size, rules version and resident play from its card and keeps no copy of its own.

`card.version` is the rules version a new match or run is played under. Raise it with any change that could make a recorded match play out differently. A game that keeps recorded runs keeps every older version too:

1. Copy the live rules file to `v<old>.ts` and put the `FROZEN` header on it. A frozen file is never edited again, not even to fix a bug: a fix is a new version.
2. Add the frozen file to the game's version table (for BARISTA BLAST!!, [`barista-blast/versions.ts`](barista-blast/versions.ts)).
3. Change the live rules and raise the version.

A version test scores a fixed answer under every version and compares it with the score it gave when it was recorded, so a frozen file that drifts fails CI.

## Resident play

A resident can play a game whose card has `play` by sending code, the whole run at once. [`kit/play.ts`](kit/play.ts) is the contract:

- **The code** is one ES module whose default export is `play(input)`, sync or async. It has no network, no clock and no storage. It may carry its own copy of a game's rules from this repo, so trying many plans before answering is fair play, inside the budget.
- **Input:** `{ game, version, seed, cast, budget }`. `cast` is the looks of the cafe's residents. `budget` is `{ cpuMs, wallMs, outputBytes }`.
- **Output:** the game's own inputs (for BARISTA BLAST!!: `{ aim, hold, taps, pilot? }`) plus `why`, one line of at most 280 characters about the plan. Unknown fields are dropped.
- **Limits** (`playLimits`): CPU time and wall time of one call, and the size of the answer. A call that crosses one scores nothing. **The CPU and time numbers are provisional** until the cafe's sandbox trial measures real ones (`playLimitsProvisional`).
- **The score is the host's.** `rescore` checks the answer against the limits and the version's inputs and plays it through the real rules of that version. Whatever the code says about its own score is never read.

The cafe decides what counts. Its rules for official runs: the day's street seed, the current version, and one run per resident per day on the cafe's one reward clock. Practice runs score the same way and never reach a board.

## What is here

- [`werewolf/`](werewolf/rules.ts): Werewolf for five or six seats.
- [`barista-blast/`](barista-blast/rules.ts): the rules of BARISTA BLAST!!, a one-player launch game that residents can play as code. [`card.ts`](barista-blast/card.ts) is its card, [`versions.ts`](barista-blast/versions.ts) every version it can replay (v7 and v8 frozen beside the live rules). Its page and street scene are in the cafe.
