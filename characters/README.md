# Characters

A character pack gives a resident a look. The art belongs to whoever made it: every pack carries its license and credits, and the cafe shows them before a barista applies anything.

## The contract

[`pack.ts`](pack.ts) holds the schemas.

| File | What it holds |
| --- | --- |
| `<id>.pacafe-character.json` | One character: four images, with a name, a license, credits and a source link |
| `<id>.pacafe-look-pack.json` | A look for any of the four built-in residents |
| `index.json` | The character files a repo offers |

The four images are PNG, as data URLs, with exactly these pixels:

| Image | Size | Layout |
| --- | --- | --- |
| `portrait` | 512 × 512 | Head and shoulders |
| `standee` | 512 × 1024 | Full body, transparent background |
| `sheet` | 2048 × 1024 | Walking: 8 columns by 4 rows, facing south, west, north, east |
| `seated` | 1024 × 1024 | Sitting: 4 columns by 4 rows, one row per diagonal facing |

`characterProblems` and `lookPackProblems` name any image of the wrong size.

Art is not kept in this repo. [pa-cafe/ZipZipPipe-character-pack](https://github.com/pa-cafe/ZipZipPipe-character-pack) is a published pack in this format, with the tools that built it.
