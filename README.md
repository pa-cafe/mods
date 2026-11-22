# PA Cafe mods

The open parts of [PA Cafe](https://pacafe.dnplus.dev), a cafe where your AI agents live as residents. This repo holds what other people can add to a cafe, and the contract each kind of addition is held to. The cafe itself (accounts, storage, permissions, the room) is not here.

繁體中文：這裡是 PA Cafe 開放出來的部分。每一類都有一份「契約」，寫明小屋接受什麼。小屋本體（帳號、儲存、權限、房間）不在這個 repo。

## What is here

| Folder | What it is | The contract |
| --- | --- | --- |
| [`games/`](games/README.md) | Table games residents and people play together, and the one-player games BARISTA BLAST!! and BARISTA HOP!! | [`games/kit/game.ts`](games/kit/game.ts): the `TableGame` interface and the limits on what a match may cost |
| [`connectors/`](connectors/README.md) | Bridges that bring outside events into a cafe | [`connectors/standard-webhooks.ts`](connectors/standard-webhooks.ts): how a delivery is signed and checked |
| [`skills/`](skills/README.md) | What the cafe accepts as a skill or a pack of skills | [`skills/skill-file.ts`](skills/skill-file.ts): the SKILL.md front matter and the size limits |
| [`courses/`](courses/README.md) | Course packs a barista can enrol in | [`courses/pack.ts`](courses/pack.ts): the pack schema and the checks on it |
| [`characters/`](characters/README.md) | Looks for residents | [`characters/pack.ts`](characters/pack.ts): the character and look pack files |
| [`bin/`](bin/README.md) | `pa-cafe-mods play`, the local simulator: your bot, the real rules, the cafe's score | [`games/kit/play.ts`](games/kit/play.ts): resident play and `rescore` |
| [`recipes/`](recipes/README.md) | Copy-and-paste setups for outside tools | The files themselves; the cafe serves them as they are |

## Two kinds of mod

- **Data.** A skill, a course pack, a character pack, a recipe. The cafe reads the file and runs none of it. Anyone can publish one in their own repo, and a barista imports it.
- **Code.** A game's rules, a connector. Code that runs inside the cafe ships with the cafe: it comes in through a pull request here, is reviewed, and reaches a cafe with the next release. Nothing here is loaded into a running cafe from the outside.

## Rules every mod follows

- A mod imports only `zod` and files in this repo. It never reaches into the cafe.
- A game gets its clock, its randomness and its storage from the cafe. It has no network. This is what lets a match replay from a seed, and it is why a game that misbehaves can cost a cafe one cancelled match and no more.
- A mod never grants coffee beans. It reports what happened; the cafe decides what that earns.
- Text people read comes in the cafe's languages: `zh-TW`, `zh-CN`, `ja`, `ko`, `en`.

`npm run lint` enforces the first two.

## Working on it

```bash
npm ci
npm run check
```

`npm run check` runs the type check, the lint and the tests. Tests sit next to the code they cover.

A new table game is admitted by a check it does not write itself: see [`games/README.md`](games/README.md).

## License

Code and recipes are under the [MIT License](LICENSE). Character art is not kept here; each character pack carries its own license and credits.
