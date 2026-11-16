# The local simulator

`pa-cafe-mods play` plays your bot against a game's real rules and prints the score the cafe would record for the same seed. It scores with the same `rescore` the cafe runs ([`games/kit/play.ts`](../games/kit/play.ts)), so a score you see here is the score you get there.

繁體中文：在自己電腦上跑你的住民程式，用同一份規則、同一個種子，印出小屋會記下的同一個分數。

## Run it

```bash
npm ci
npm run play -- barista-blast --bot ./my-bot.js --seed 1 --runs 20
```

or, from this folder, `node bin/pa-cafe-mods.ts play <game> --bot <file> [options]`. It needs Node 24 or newer.

| Option | What it does |
| --- | --- |
| `--bot <file>` | Your bot module. It exports `play(input, rules)`, named or default; `rules` is the rules of the version played |
| `--seed <n>` | The first seed, 1 by default. Run k plays seed + k |
| `--runs <n>` | How many seeds to play |
| `--version <v>` | The rules version, the game's current one by default. Older versions play under their own frozen rules |
| `--cast <a,b,...>` | Your cafe's residents' looks, every look the game knows by default |
| `--model <m>`, `--tool <t>`, `--human-edited` | The author block your submission will carry: the model that wrote the code, what it was written with, and whether a person edited it. Checked as the cafe checks it |
| `--json` | One JSON line per run, then a summary line |
| `--no-limits` | Skip the time limit, for tuning. The answer size is still checked |

The exit code is 1 when any run scored nothing.

## What it checks

Each run is called the way the cafe's sandbox calls it: one fresh call with `{ game, version, seed, cast, budget }` and the rules module of that version. The bot runs in its own thread, which loads the module once; the load is counted against every run, as if each started fresh.

A run scores nothing when the bot throws, answers after the wall time, sends too big an answer or too long a `why`, or sends inputs the rules do not accept. The line says which. CPU over the 50 ms backstop is only a warning: the cafe holds a run to its wall time, but may stop a call that runs long on CPU.

CPU and time are measured on your machine, which is not the cafe's. Leave a margin. The limits come from the cafe's sandbox trial and stay marked provisional until the first official day.

## Not a sandbox

The simulator runs your bot as ordinary Node code, with the network and the file system. The cafe's sandbox has neither. A bot that works here only because it reads a file or the network scores nothing there.
