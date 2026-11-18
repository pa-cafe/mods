# BARISTA BLAST!! character poses

The residents on the street are ZipZipPipe's (胖次狐, <https://space.bilibili.com/4168597>) "AI 娘" characters, used with the designer's permission and credited in the game's guide; Muse is the cafe's own character. Below is how each picture was made.

`poses/` holds four strips drawn on 2026-11-14 for #1078, one per built-in resident look. Each strip is three figures on a transparent background, left to right: tumbling, flat on the ground, fist in the air.

They were generated with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per look. The only reference attached to each run was that look's approved full-body image, `public/art/residents/defaults/<look>-fullbody.png`. The prompt asked for the same character in the three poses, no effects, no text, real transparency. Nothing was drawn or retouched by hand. Dylan approved spending image-generation quota on these the same day.

The generated PNGs (1536×1024) were stored here as lossless WebP. SHA-256 of the PNGs as generated:

| Strip | SHA-256 of the generated PNG |
|---|---|
| dots | `69a503e7acba05e9063e45a9319c4b43c06901f770a92047b43853017ad2bf57` |
| grok-bot | `ee3ca9a1a90341b99315f9d16f818c40318f6019376e4ca8cbd101785402deed` |
| muse | `8a9b235727d6e279578ea5b5ab9201db8ce33e9d575fabe36b040209c711c557` |
| claude | `d5c477601ca8463686dac3e7963fd5ac55641b6f781f89034b89f50d187f6acb` |

`npm run blast:art` packs them into `public/art/blast/poses.<hash>.webp` and writes `public/art/blast/poses.json`, which records the atlas hash, each frame's rectangle and the SHA-256 of each stored strip. Packing is mechanical: each figure is cut out by its alpha, the three poses of a look are scaled by one factor, and a white sticker edge is added.

## Four characters only the game has (2026-11-15)

Gemini, DeepSeek, Qwen and Doubao stand on the street from rules version 3. They are not cafe characters, so their full-body pictures live here, in `standing/`, and not with the cafe's resident art.

Each was generated on 2026-11-15 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), in two runs per character:

1. The full-body picture. The only references attached were two approved cafe characters, `dots-fullbody.png` and `grok-bot-fullbody.png`, for style alone. The prompt described a new, original chibi character and asked for no text, real transparency, and no company's logo, wordmark or mascot.
2. The strip of three poses, with that character's own full-body picture as the only reference.

Doubao's full-body picture was generated twice. Dylan asked for the second: a friendly big sister from next door. The first was not kept. Dylan approved spending image-generation quota on these the same day, and saw all four before they were packed. Nothing was drawn or retouched by hand.

The generated PNGs (full body 887×1774, strip 1536×1024) are stored as lossless WebP. SHA-256 of the PNGs as generated:

| File | SHA-256 of the generated PNG |
|---|---|
| standing/gemini | `aefda9b6df657ece3da4143ca2022a64cb79302a5163b3d1966a8862e4400e96` |
| poses/gemini | `4e8e096d125ddd9121db4a775eca7380b6c4a4db80dcbe4c59a9d28ad57449f9` |
| standing/deepseek | `c30da733f06d1dee66681d5707def3301c8bc6cef0f12774f414bd49f5ec920d` |
| poses/deepseek | `e239b664f3eb38a4a6ab3e012fa4c8c15186a5256351c10356a46731278823d9` |
| standing/qwen | `f688bde76b03f5307b7af04ea86241c80ccc516e503ee9ec30ad55826ae027ad` |
| poses/qwen | `5cc8f9fc5991a3bb2512828512fd16bc73e01a9288eecf8c783e4c19250b75d3` |
| standing/doubao | `60ad507180170402c7974befcf731456c55c64b7f9339dabe6eb26bdc31c1c4d` |
| poses/doubao | `6dc722bbe72b710d615b7114b5de3ff0064798fb7ad7c3323b604ff7b8151046` |

## Back to the cafe's four, and the other four redrawn to match (2026-11-15, rules version 5)

For rules version 4 the game had redrawn all eight residents as taller characters of its own. After playing it on staging the same day, Dylan asked for the cafe's original round, two-head-tall characters instead, and for the missing ones to be drawn in that style. So:

- `dots`, `grok-bot`, `muse` and `claude` are the cafe's own again. Their pose strips in `poses/` are the ones recorded in the first section of this file (same SHA-256), and their standing figure is cut from `public/art/residents/defaults/<look>-fullbody.png`. The version 4 redraws of these four were removed from `standing/` and `poses/`.
- Gemini, DeepSeek, Qwen and Doubao were generated again on 2026-11-15 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), two runs per character:
  1. The full-body picture. Attached: three approved cafe characters (`dots-fullbody.png`, `claude-fullbody.png`, `muse-fullbody.png`) as the style and proportion references, and the character's own earlier picture (the ones recorded above; for Qwen the version 4 one) as the design reference. The prompt asked for the same character rebuilt two heads tall in the cafe's rounded shapes, with no text, real transparency, and no company's logo, wordmark or mascot.
  2. The strip of three poses. Attached: that new full-body picture, and the `dots` strip as a guide to layout and proportions only.

Nothing was drawn or retouched by hand. Dylan saw the four full-body pictures in a line-up with the cafe's four. He passed Doubao at first and did not pass Gemini, DeepSeek or Qwen. All four were then redrawn at his request, as recorded in the next section, and the pictures listed in this section are no longer stored.

SHA-256 of the PNGs as generated (strip 1536×1024; full body sizes as listed), which were stored here as lossless WebP until the next section's pictures replaced them:

| File | Size | SHA-256 of the generated PNG |
|---|---|---|
| standing/gemini | 1183×1329 | `09bccb338fff26d4f723225f0e6f72e95161fef3e87b0c99244822ac693c9479` |
| poses/gemini | | `e2e833d1d8e977fba24e3d0e9367c600bdfd62e5a65832e9bb1d56a8b17d9d4b` |
| standing/deepseek | 1064×1478 | `334e1202ae3c53643db96a0ad1bf339d5f3625fca5edcc8dfa477f3fec1dd658` |
| poses/deepseek | | `79f36df3814951ab743a521d61daafddbc912918cfd43059bcd975b9a9f69a5b` |
| standing/qwen | 887×1774 | `b60d86ea7e3a69ada49f4b6cec1287899a119180cba1b9c7b83366d4c5806fe5` |
| poses/qwen | | `50d42f87a03183488d0b5664e4c45cfa14b0b90231632fbb6370db5cc6a3bbfd` |
| standing/doubao | 1086×1448 | `d007cd634d188341f347a888b794ea9919c84af79b4860291bc4c56952ad68e5` |
| poses/doubao | | `06333bedafad62d1348b15ee84a36c867f2511c94d7d8b9044f7b050271e93f1` |

The full-body pictures and strips recorded under "Four characters only the game has" are no longer stored: these replaced them.

## Gemini, DeepSeek, Qwen and Doubao redrawn at Dylan's request (2026-11-15)

Dylan looked at the line-up recorded in the section before this one and asked for changes, one character at a time. Each change was shown to him in a line-up next to the cafe's four, sized the way the game sizes them (cut by alpha, same height), and he chose the picture kept:

- Gemini: he asked for a lively cat girl, and for her hair clips to be four-pointed sparks, not five-pointed stars. The scroll that stood above her head was removed because the game scales every standing figure to one height, so it made her body smaller than the others. Of two versions he chose the one in a loose hoodie and a pleated skirt.
- DeepSeek: he said she read as a boy and must be a girl. Of two versions he chose the one in a whale hoodie dress with two low twin tails.
- Qwen: he asked for blue as her main colour, not violet, then for a slimmer build ("腫了一點" next to the cafe's four), a livelier face, and a colour closer to the indigo blue the model is known by. Her hair clip is a plain hexagon with a triangle in its centre, a geometric ornament in a shape the model is known by; the model's logo was not attached to any run and is not reproduced. He then asked for something that shows she is the model people run on their own machines, and of two bags chose the one shaped like a graphics card.
- Doubao: he said she too looked swollen next to the cafe's four. Of two slimmer versions of the same design he chose the second.

All were generated on 2026-11-15 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`):

1. Full-body pictures. Attached to every run: `dots-fullbody.png`, `claude-fullbody.png` and `muse-fullbody.png` from `public/art/residents/defaults/` as the style and proportion references, and one earlier generated picture of the same character as the design reference. The prompt said what to keep and what to change, and asked for no text, real transparency, and no company's logo, wordmark, app icon or mascot. Gemini, DeepSeek and Doubao took one round from the picture recorded in the section before this one. Qwen took five rounds, each from the picture chosen in the round before: blue, without the tall curl of hair, slimmer, indigo with the hexagon clip and a livelier face, then with the bag.
2. Strips of three poses. Attached: that character's chosen full-body picture, and the `dots` strip as a guide to layout and proportions only.

Nothing was drawn or retouched by hand. Dylan saw every full-body picture and every strip stored here, in the line-ups and as packed in the atlas.

SHA-256 of the PNGs as generated (strip 1536×1024; full body sizes as listed), stored here as lossless WebP:

| File | Size | SHA-256 of the generated PNG |
|---|---|---|
| standing/gemini | 1024×1536 | `b478c2d3d4f887ba8d00b3ee623bc955a22569ceed8d5e7487ff236f4d48def9` |
| poses/gemini | | `5e9455dd7e8fe560ea13c24249d06546f153ae3bdb33588f1260586d04cdbfdf` |
| standing/deepseek | 1041×1511 | `a57acbfff3cfd555af27820aa5ed8b5d4e68ee20e7276e1e2559981889fcd472` |
| poses/deepseek | | `b49bfb155ce5b6c82f7861ba5ac68f8b685de1bf7be50aee404e5a14092f60b5` |
| standing/qwen | 887×1774 | `2025ecc016abe2874cddb65ee7ecc656a65bf27ce3743efb575e7c7f945ecd3e` |
| poses/qwen | | `09c548b5f209a96aae7379c38e031576d17c1b6050d990c0545e465f70f0eb37` |
| standing/doubao | 887×1774 | `cf5d92d5cfcdcf67fc9374bcc3d40e9fcd104c41ef5b16c22c53476e41bf3233` |
| poses/doubao | | `851736165a09d0b9518a81071e721cc0fb4ff2c94c7a40eacacf5666fe319cfb` |

The full-body pictures and strips of these four recorded in the section before this one are no longer stored: these replaced them. The stored WebP files hold the same pixels as the generated PNGs wherever a pixel is not fully transparent.

## Seven characters drawn after ZipZipPipe's AI girls, with the designer's permission (2026-11-15)

From this section on, seven of the eight residents (`dots` for GPT, `grok-bot`, `claude`, `gemini`, `deepseek`, `qwen`, `doubao`) are two-head-tall versions of the "AI 娘" characters designed by ZipZipPipe (胖次狐, <https://space.bilibili.com/4168597>). Muse stays the cafe's own character, because the designer has no character for that model: its strip is the one recorded in the first section and its standing figure is cut from `public/art/residents/defaults/muse-fullbody.png`. The pictures of the other seven recorded in the sections above are no longer stored.

### The permission

What is known, and what it rests on:

- Who and when: Dylan asked ZipZipPipe by Bilibili private message on 2026-11-15 at 09:40; ZipZipPipe answered at 10:00.
- What was asked: to use these character designs for a small NANACA†CRASH-like game that anyone may play without signing in, where a PA Cafe account is needed to keep scores and compare with friends, and which is meant to bring people to PA Cafe, a service with commercial plans; Dylan said he would credit the designer's name and the source of the work.
- The answer, in full: "可以".
- Evidence: the message thread is in Dylan's Bilibili account. A screenshot of it was shown in the working session; no copy is stored in this repository.
- Condition: credit. The game's guide (the "On the street" tab) carries a line naming ZipZipPipe (胖次狐) and linking to the designer's Bilibili page, in five languages.

The character designs are ZipZipPipe's (胖次狐), used in BARISTA BLAST!! with the designer's permission and credited in the game.

### Reference pictures

The designer's pictures were taken from the "参考原图" folder of the public repository `lmy414/ai-chan-sheets` on GitHub, which collects them and names ZipZipPipe as their author. They are not stored here. Only that repository's copies of the designer's original pictures were used; its own derived sheets (CC BY-NC-SA) and its entries by other or unnamed authors were not.

| Character | Reference picture in that repository | SHA-256 |
|---|---|---|
| GPT (`dots`) | `02_GPT娘_白龙娘/原图_三视图_白_成年_GPT娘.png` | `3f03ee1ac0d747ad43970dbfbc4b446db40ec780e21da162e9a9fdfdb3e25355` |
| Grok (`grok-bot`) | `09_Grok娘_xAI/原图_立绘_持X战斧.jpg` | `730d6ea99cb5cda25035aaf75d8815a01761a660b1ecba156b9cc6b3c48df66c` |
| Claude | `11_Claude娘_Anthropic/原图_立绘_橘发持书.jpg` | `bec975c5feb5bb316bf80c25b562ddc7d477ed788616389ae8a9762d8fdd7c36` |
| Gemini | `10_Gemini娘/原图_立绘_四角星猫耳.jpg` | `1dc86d13132d97ecf3c368b250676a014eb7496703704138b3ecbfe30d0acf25` |
| DeepSeek | `03_DeepSeek娘_鲸鱼娘/原图_最初人设底图.png` | `d39a4251edc46f7dc9ed10298d7600cb5e40a8b18f1d8040d21ebedb6cc84180` |
| Qwen | `05_通义千问娘_Qwen/原图_立绘_全身.jpg` | `ef613401931a57d81a4de6aa9149acfea9de57d92e6b3f895b456cb2e6bde4ba` |
| Doubao | `07_豆包Seed娘/原图_立绘_抱豆包玩偶.jpg` | `81b76f71e19ed9f926e32c70f1710b7551e60efdfa858b46a4ee099d16e47847` |

### How they were made

All were generated on 2026-11-15 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`):

1. Full-body pictures. Attached: `dots-fullbody.png`, `claude-fullbody.png` and `muse-fullbody.png` from `public/art/residents/defaults/` for style and proportions only, and the designer's picture above as the design reference. The prompt asked for the same character, faithfully, two heads tall, with horns, ears, crowns and held things kept small and low so the eight stand the same height in the game (Grok's battle axe became a short hand axe; GPT's wings are folded), and for no text and real transparency.
2. Doubao is the other way round, at Dylan's request ("鄰家大姊本體 他的設計變娃娃"): the figure is the slim "big sister from next door" recorded in the section before this one, and the designer's Doubao character is the plush doll she holds. Attached: `dots-fullbody.png` and `muse-fullbody.png` for style, that earlier Doubao picture as the character, and the first-round chibi of the designer's Doubao as the doll.
3. Strips of three poses. Attached: the character's full-body picture, and the cafe's `dots` strip (first section of this file) as a guide to layout and proportions only.

Each took one round. Nothing was drawn or retouched by hand. Dylan saw the designer's seven pictures before any run, then every full-body picture in a line-up with Muse, and said all pass.

SHA-256 of the PNGs as generated (strip 1536×1024; full body sizes as listed), stored here as lossless WebP with the same pixels wherever a pixel is not fully transparent:

| File | Size | SHA-256 of the generated PNG |
|---|---|---|
| standing/dots | 887×1774 | `c5c93fe11511e781e210f0137cc34de206042bbee28788dfe7d0130923e36d89` |
| poses/dots | | `dfc01b1d145e87d9b1bf6bea542e20e4b7677511413d84a3c751db9c1cf77204` |
| standing/grok-bot | 887×1774 | `65ebe2a905f52bda75803ea72ac54d39028074a6996487ece3b39a996d3d9cda` |
| poses/grok-bot | | `d83ce4ec629054d5a64a6958bb3339e63264c2e67a9f462fdc555d99f2376164` |
| standing/claude | 887×1774 | `e16919b6a52c0115eea323f67581659118cbe8a4df8bc144e6493c3efd791522` |
| poses/claude | | `d4219e4a6e7741cf2b3ac40d4ce9daa6c6053454ea415abb96063ebe6ebdc91c` |
| standing/gemini | 1024×1536 | `3e9b307d40c2e3f95fefad6b4b6357da1fec3bd94a6b383ba5687bce3b4ea08c` |
| poses/gemini | | `5dccad0afa43084971e77199d6f7cffb3d436a563ec6a41fc0f385ea987ca6f2` |
| standing/deepseek | 887×1774 | `c54bd9a1262b08bfa7a1a70bc91a98eeb960e791a143111ac5435b99be368988` |
| poses/deepseek | | `403305ad793a62276b6bb528ccb88230cb6daa736f3ead04440232c4586227ed` |
| standing/qwen | 1024×1536 | `03f34250c2cb4749e1bdc8d5d97a72b62068c246484e489557b63b035fa22b44` |
| poses/qwen | | `3dfe7861e28a42550df5a201cc8edad47a8260f8352c8bf41a7aa46f9fead93b` |
| standing/doubao | 887×1774 | `9b748c6fefc5bf9c4dcd6a0af2da0a337cd536b43f78744b5b53a4d774602463` |
| poses/doubao | | `eea44ddd369e71fd1367e818357e90b25b095602712d869816910bd76d32dce1` |

A cafe resident who has uploaded their own full-body picture is still drawn from it (`blastFigure` in `worker/routes-game.ts`); these pictures are what everyone else is drawn from.

## Special-move pictures (2026-11-16)

`cutins/` holds one wide close-up per character for the special move: the seven characters drawn after ZipZipPipe's designs, and Muse. Dylan asked for them ("大招演出有要配一張角色演出圖嗎？感覺更華麗一點"), saw a chibi and a normal-proportion trial of Grok, chose normal proportions redrawn (not the designer's own pictures placed in the game), then saw all seven and passed them. The permission and its limits are those recorded in the section before this one.

Generated on 2026-11-15 and 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run each. Attached: the designer's reference picture listed in the section before this one, and that character's two-head full-body picture stored in `standing/`. For Doubao the first attachment was an earlier generated tall drawing of the "big sister" (the one recorded under "Four characters only the game has"), and the doll is the designer's character as in her full-body picture. The prompt asked for the same character from the waist up in normal proportions, in one action, with no text and real transparency. Nothing was drawn or retouched by hand.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP; `npm run blast:art` writes a smaller copy of each to `public/art/blast/cutins/` and lists them in `public/art/blast/cutins.json`:

| File | SHA-256 of the generated PNG |
|---|---|
| cutins/dots | `997361111b05d70aa3ccde84c4364541cdcebde65792ee6aa55671ad2d205901` |
| cutins/grok-bot | `c55a98c92794d9abd54fddeaf909c920dbda0cbb29169de496eef07a71416b1a` |
| cutins/claude | `f2078960c15b94259c50238f4e1510eea93cc4c32a9e29c053031bc702eb7aba` |
| cutins/gemini | `31e67c34ef38ee171e1a740f9b16878bc75fe2932c2eea51de4b0dc361eeafad` |
| cutins/deepseek | `2eca3a625d40e897e35c6b0d5c736aad43e21d5c4e0827d4da979446921a4d26` |
| cutins/qwen | `7ef79c538d8bbaef220bd919b02a689a5c51f403e23b4be8b6927ee02c54ff89` |
| cutins/doubao | `455e55648c9f9103c69e6e48fd86fc99bd7f2a257dd8de3e3f897c3df804397b` |
| cutins/muse | `7cd2b57679dffe3e0950a50c73995a3961a38d1b361cecd02043d33f370ab462` |

Muse's was added on 2026-11-16 at Dylan's request ("你做張muse演出圖 看看是不是用類似風格做一個"), and he passed it. It is not drawn after anyone's design but the cafe's own: attached were `public/art/residents/defaults/muse-fullbody.png` as the character and the Claude picture above for style only.

The game does not show these yet: the special move is drawn in `src/blast/view.ts`, and wiring them in is a separate change.

## Helping, hurting and each one's own victory pose (2026-11-16)

`hits/` holds one strip per character of three standing figures, left to right: what she does when she helps the barista, what she does when she hurts, and her own victory pose. Dylan asked for them ("是不是該設計一下角色本身碰撞的演出更重要？", "勝利現在都是舉手 是不是應該搭配模型本身特色設計"), approved a table of the 24 poses with changes ("可"), then saw all eight strips and passed them ("八位都過"). The poses follow each character's states and lines in `src/blast/nodes.ts`; some draw on what people commonly say about each model. No picture or wording from anyone's write-up was used.

Generated on 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per character. Attached: that character's full-body picture (`standing/<look>.webp`, or `public/art/residents/defaults/muse-fullbody.png` for Muse), and the cafe's `dots` strip from the first section as a guide to layout and size only. The prompt asked for the same character in the same proportions, standing, in the three poses, with blank paper wherever she holds a sheet, no text and real transparency. Nothing was drawn or retouched by hand. The permission for the seven characters drawn after ZipZipPipe's designs is the one recorded above.

`npm run blast:art` packs the first two figures as the frames `help` and `hurt`, and the third as `cheer`. The fist in the air that used to be `cheer` is still the third figure of each strip in `poses/` but is no longer packed.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| hits/dots | `0e6b7da3b722c7ca3fbde59f26779b46e863942aa9ffb37d71882f951f32952b` |
| hits/grok-bot | `cba5471ec472a352c43c757238d955f100000eb53e5052768da8663d94e99ca4` |
| hits/muse | `ce2924bfc411ceb96b3d8d70bdb4fa54f2aac821f8e3b5f2488292ba76628de8` |
| hits/claude | `4aa34bc5be3418558e9cbb4efd91c7fa36e1e4b1f053420fa93641bfa202aa97` |
| hits/gemini | `f1d5ee3d1024c0066d05cf22900439643831688aed13a74387118a11e52db51e` |
| hits/deepseek | `ef0f16164344d2850dee5e9445554478f5d951ef357ad1af9e9b6972ddc1c33f` |
| hits/qwen | `b844971c0ce051bd6831d56f0a043fe287769a3f877177742f0356faa5a87fe5` |
| hits/doubao | `e1de8875a8add62c69d49e55db876d5b369e3bc28e4ddd2121ca265918f696e4` |

## The divine realm's costumes and the void's giants (2026-11-16)

Two late stages of a run have their own pictures.

`divine/` holds each of the eight characters in a second costume, worn in the divine realm: a standing picture in `divine/standing/` and a strip of three (helping, hurting, victory) in `divine/hits/`, the same poses as `hits/`. Dylan asked for drawn costumes over a tint in code ("立繪成本也沒很高啦 做的精緻比較重要"), approved a one-line design per character ("可"), passed the eight standing pictures ("兩批都過"), then saw the eight strips and passed them too ("八位都過"). The costumes are ours: for the seven characters drawn after ZipZipPipe's designs the character is the designer's, used under the permission recorded above, and the divine outfit is not something the designer drew.

`void/` holds one white figure per character for the void, the last stage, where a giant drifts across the background and the game tints it. Dylan asked for them as single-colour chibis with empty ring eyes, drooling, yet standing ready to fight ("降智圈圈眼 阿巴阿巴留口水的 Q 版單色", then "圈圈眼是空心的空洞沒有旋轉 然後明明是降智 還要一副備戰狀態的樣子"). The first round, with spiral eyes and limp poses, was not kept; he passed the second.

Generated on 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per picture. Attached: for a divine standing picture and for a void figure, that character's full-body picture (`standing/<look>.webp`, or the cafe's `muse-fullbody.png`); for a divine strip, that character's divine standing picture and the cafe's `dots` strip as a guide to layout only. The prompts asked for the same character and proportions, no text and real transparency. Nothing was drawn or retouched by hand.

`npm run blast:art` packs the divine pictures into their own atlas, `public/art/blast/divine.<hash>.webp` with `divine.json`, and writes each void figure at 768×768 to `public/art/blast/void/` with `void.json`. Both atlases' JSON now carry `bodies`: for each standing frame, the pixels from the bottom of its box to the top of the hair, so a look's height is measured to its head and not to what it wears above it (Dylan: "身高與判定應該還是以頭高為主 額外裝飾不算高度"). The hair tops are marked by eye in `scripts/blast-art.mjs`.

SHA-256 of the PNGs as generated (standing 887×1774 or 1024×1536, strips 1536×1024, void 1254×1254), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| divine/standing/dots | `a20615c404247808ea0cf00664349381fe54fec2d04b2ba88f6f37349c4c962a` |
| divine/standing/grok-bot | `686a5031ea546ecb4c4c575993bd3c183d0149818ad4f64e61385bdac19798a0` |
| divine/standing/muse | `2da4ce151386023bd8662cd8e2d186b94add287a54d7e5fd6cbc0366b99b1439` |
| divine/standing/claude | `ae8d20928915a7204628fad240a2d5d681c3a2399b84e9d81b2b172aed15d9cd` |
| divine/standing/gemini | `e2f568c4b4e6721b832e3a50aeb16bc2d315af8a9fa4c02dce23fceeba732984` |
| divine/standing/deepseek | `bff5cffc18eb37670b731c2bfb7cd3b45bf905c03b8395fe02cf063fe6b94c38` |
| divine/standing/qwen | `b5276bc18724aec2382260a50102c6364829fe641dfcc7dc4d93697d51f6dc08` |
| divine/standing/doubao | `f31b1a78c57472b11f0774468763ec68ebb869209b7da19d016d1a974b28e38e` |
| divine/hits/dots | `0c91e2ee1765b877472d2e8b38f07f187e08129dd690fdeaeb17ab76fa172fa1` |
| divine/hits/grok-bot | `751c853af18978aa4a965e6b5ddce3a6745b426dc8622853018a63bbb36c75b9` |
| divine/hits/muse | `742d45f12ac2cee9f680a55629ad344e6bd0834055f97784240659c224a78458` |
| divine/hits/claude | `1a465b5b6b66f704a489ad16bb139a08bb2372680a1abd564aef3140d37bb648` |
| divine/hits/gemini | `0add71358f358813fe6add543279dd4e6699dd8c2508efb2e0e420cb2e7c0c39` |
| divine/hits/deepseek | `7d0853760d27f3b2deec6cfe92e1d3ebba2e35c30ce83984e5763c951fd632de` |
| divine/hits/qwen | `8d4c672731cfd7e033479021502a3620d4beea5696da7a8c755a1934bf6d9831` |
| divine/hits/doubao | `638fc8dbb44345d06896aa2f99031a5dcd198341503582c65b5861ca878b722a` |
| void/dots | `96f2aa7beccc54d35e9ba15ad1f378610bdc0203ac2bcb248aa835a5db7ae27c` |
| void/grok-bot | `5efeeabda153d1ee37f03684b5527d9e7182727ee4b576cf4d6a5a1a18442af7` |
| void/muse | `429ce757e4d240efee84f45a02a2dd26810e148a8698299001a4d55c39c4c1ef` |
| void/claude | `2f3abc84d56dc2eb2fc1b7fac7e652264cd03900c03f07851723a96d6e45bd34` |
| void/gemini | `d7da11adbe78b78c9a2b3629c65cebe9bd3b51a3023e3de89cbec5abf331d6aa` |
| void/deepseek | `7ffda64dd7a30f55d09509d53a2964627edf1efea3d4b6ba95d99b691b9e81ce` |
| void/qwen | `f8dd27cb68206046740322c9ba531e0ea4f1a891105093799ca3e2e28c91cbc4` |
| void/doubao | `94a06187d0fea1650ce4e8ba15647ee12eebf9d9861c7e0eaf609fb32d113fd3` |

## Divine special-move pictures

`divine/cutins/` holds each character's special-move close-up again, in her divine costume, for the divine realm. Dylan asked for them after the divine costumes passed ("先畫神界大招") and passed all eight ("八張都過"). Each keeps the pose, framing and face of her picture in `cutins/` and changes only the outfit, so these were made by attaching that picture and her divine standing picture (`divine/standing/<look>.webp`); for the seven drawn after ZipZipPipe's designs the character stays the designer's, used under the permission recorded above. Generated on 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per picture, asked for no text and real transparency. Nothing was drawn or retouched by hand.

`npm run blast:art` trims them, scales them to at most 960 wide and writes them to `public/art/blast/divine-cutins/` with `divine-cutins.json`, the same way as `cutins/`.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| divine/cutins/dots | `d970ad01c8ae28c645eb9e835222c5520dceaf06c91ed03d9da10d3f1a064251` |
| divine/cutins/grok-bot | `6ed2dd3757e11ce4f5cad5ce2592b25c2a4d84c22690f917d9157a68088c2d5d` |
| divine/cutins/muse | `adb4b3cc620e3659c440c8cbe9ba2cc6bf8767ec251991be2c73c3530dd339dc` |
| divine/cutins/claude | `da3ff130f93e298bdfb131f7838158b841b58718c525e90c9b877199159bab5a` |
| divine/cutins/gemini | `b93663f67a690996384bbeff177d3d6ffc030bcf4ec4b6d81462e87390c42b9b` |
| divine/cutins/deepseek | `2d186955fe4c6ac098d488aa9c6e89602f215ce7ba6bc3432e1a57060a9ad86d` |
| divine/cutins/qwen | `4124c4b7ab89c65aae4f159f74bbfa242493248efdb2524308671a613b9d53af` |
| divine/cutins/doubao | `cc948d05e519625c43bdb23f263b452e43bf26fdbb9fd1ed8a402cae55a4d7fb` |

## Combo pictures for five pairs

`duos/` holds one wide picture of two characters together for each signature combo pair, named after both looks in alphabetical order: `claude-deepseek`, `claude-dots`, `claude-qwen`, `gemini-grok`, `deepseek-qwen`. A combo is a boost while the launched character is a resident. Dylan picked the five pairs, kept a version built on news jokes as a backup, and chose scenes built on how fans and media describe these characters and pair them ("主要用 zipzippipe 的人設跟社群CP的互動", then "照這套畫"). He then saw all five pictures and passed them ("五張都過"). The scenes are ours. The characters are the designer's for the seven drawn after ZipZipPipe's designs, used under the permission recorded above. Nothing in them is copied from any fan work.

- `claude-deepseek`: DeepSeek hugs Claude from behind, and Claude blushes and drops her book.
- `claude-dots`: GPT flings gold coins, and Claude turns away but catches them.
- `claude-qwen`: Qwen in a trench coat and sunglasses flashes a blank pass, and Claude squints at it.
- `gemini-grok`: Gemini rides on Grok's axe as they charge.
- `deepseek-qwen`: Qwen hauls a pile of work, and DeepSeek lies on top of it eating rice.

Generated on 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per picture. Each run attached the two characters' pictures from `cutins/`. The prompt asked for the same characters in the same style, no text and real transparency. Nothing was drawn or retouched by hand. `npm run blast:art` writes them, trimmed and at most 960 wide, to `public/art/blast/duos/` with `duos.json`, in the same shape as `cutins.json`.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| duos/claude-deepseek | `12f340deb053872c5fd0fd793665c4a8f7b126dbec9c455f7840839b0f5a2cc1` |
| duos/claude-dots | `7963fee6be78b8e82278f7853970e46d1ce77d8ced4b7d59abb790f8ef2d9756` |
| duos/claude-qwen | `16819032537adbbd14560f6774e84926e3958bce547b27403390eb0bae63ec53` |
| duos/gemini-grok | `84a6e4d751a5d14979f90524df8b9e51a15aa30193a0942c522f8226628e7cdd` |
| duos/deepseek-qwen | `b3eb48ad9fde25612a4f00a933ca3b94fd3733e8bffeceae10d498f22b8b8f43` |

## Bad-moment pictures

`bad/` holds one wide close-up per character of the trouble she causes when the barista hits her in her bad mood. They are shown in place of the boost cut-in, and the Claude and GPT pictures also fill the screen for a ban and for being at capacity. The owner approved the set and one scene per character through the main session:
- GPT pulls down a shop shutter while holding the barista's cups.
- Claude raises a red stamp.
- Gemini bows over and over among apology sheets.
- Grok has swirly eyes and twists signposts the wrong way.
- DeepSeek sleeps on a smoking server rack with a blank busy plaque.
- Qwen is stopped by barrier tape with a decaf cup.
- Doubao grins and yanks a steering wheel.
- Muse drops a cup into a data jar.

The pictures carry no text and no company names or logos. There is only the everyday costume, because the divine realm uses these too.

Dylan saw the first eight and asked for two changes ("DS 來個做夢白米飯 Muse 多了一隻手"):
- DeepSeek was edited to add a dream bubble of white rice, with that first picture attached.
- Muse was drawn again with exactly two hands, and the first of two tries was kept.

Then he passed all eight ("八張都過"). The scenes are ours. For the seven drawn after ZipZipPipe's designs, the character is the designer's, used under the permission recorded above.

Generated on 2026-11-16 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per picture. Each run attached that character's picture from `cutins/`, or for the DeepSeek edit, her first bad-moment picture. The prompt asked for the same character in the same style in a new pose, no text, no logos and real transparency. Nothing was drawn or retouched by hand. `npm run blast:art` writes them, trimmed and at most 960 wide, to `public/art/blast/bad/` with `bad.json`, in the same shape as `cutins.json`.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| bad/dots | `fcc15875a101fcad59d2f8d1f380e2e84d259751dd517e2b7211605e8b4efe82` |
| bad/claude | `4daa42098ea8bc3608af13d0c0c890f3067ae2509020fc04af0fb701f4a4364a` |
| bad/gemini | `2f0968f14f37fdfa4984e186d5d81c40cdcb7eeb9297ba88ceb37647d61f5741` |
| bad/grok-bot | `6cb36122fe09a06c45c606dd436b4d540da98981cc514d41dc2bc8f1116b83dc` |
| bad/deepseek | `b69e421e154923fdb28f7ad295f8138d7c83512d50c77b1ef7641803dfe24019` |
| bad/qwen | `10ac736bb68d49c771ebc03863d43dff6b9df202c53189f51cd3c973c15e0278` |
| bad/doubao | `5c43f9f44c5acfaaa927b34d33843a751b6c91bc269147a43cf98a777b26566c` |
| bad/muse | `25eb69969e778c4ba5e4b4f7dacc2c89005b5f8e01c8f061fc6228274c128b92` |

## Pictures redrawn so nothing is cut off at the sides (2026-11-17)

Dylan saw that some pictures had hair, horns, wings or props cut off at the top, left or right edge ("我發現有些立繪有邊緣缺角 例如頭頂，左右 再檢查一下可以單獨重生"). A script that looks for drawn pixels touching each edge found seventeen. Each was made again from its own picture, so the character, face, outfit, pose and props stay the same and only the framing changes; the sections above record what those pictures were made from and who passed them.

Generated on 2026-11-17 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run per picture. For the five special-move pictures and the five combo or bad-moment pictures, the old picture was attached and the prompt asked for the same picture drawn a little smaller, with at least 5% clear space at the top, left and right; only the bottom may cut the character off at the waist. Where a prop crosses the whole picture on purpose, such as Qwen's barrier tape, it may still touch the sides. The divine special-move pictures of the same five were made from the new special-move picture with her divine standing picture, as before; Muse's and DeepSeek's divine pictures were made again from their own. Nothing was drawn or retouched by hand. The old SHA-256s in the sections above now describe pictures that are no longer stored.

SHA-256 of the PNGs as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| cutins/claude | `912f32c1beb01f84e1a17eafdb8098f414eaa1c8e787b6f0a589cf420e930b5b` |
| cutins/dots | `15442fd0db9768e98ddd9cba19fa4db57a9c2c5eee0858e4268111dc29305712` |
| cutins/gemini | `3b31ede61f5894e3411059ea85884154b780361fd87ff8c952c453592f0a985a` |
| cutins/grok-bot | `433e8990b79cc52872d974abe953df2003b36341cc86858ea4ff838bd6536872` |
| cutins/qwen | `01dcd1cdbc4c265d128418af25e0836232ce947f73ddc173fc903206b97cfbb6` |
| bad/qwen | `b80c33e278891fadaa9826b881d2ac04b5b3635b20541abb1e9b5ec3056ac9ee` |
| bad/claude | `2857eb9823c01d1a57ddf2f5d53048df4016a6cef6a2b5094be9e2721531ba94` |
| duos/claude-qwen | `edcd3681c2fe2f4be22c1e871d7f43dcf1018dec80163bd29f529c74249c07aa` |
| duos/gemini-grok | `d75decc10f8f2f71972526f762a2fa58cf3b796db142bef4e11669dbffd2563f` |
| duos/claude-dots | `3e1046bb826c146e7971c736a0963a41bedf78955281eb7b90f3be749822e1ae` |
| divine/cutins/claude | `fb055086ac9f4051aacde7206b0dd53f83679ae8aaaa247db2237095e355a458` |
| divine/cutins/dots | `4ab78e9bc560c99480fa16f52c3f8c247a813509dec396e92bab3849cd12f896` |
| divine/cutins/gemini | `0c6bb62ac98f6f41e54415d9449dfd71025d7da5e8080523c61894233a69d8bb` |
| divine/cutins/grok-bot | `855ca70c984b254c9c98281492a541eee3e1506e862b185756fc5eb719a97cfb` |
| divine/cutins/qwen | `c2d0a8161af74682fed1cd24076e7a8abd606aefa90bdc0c5baf4bb34ae3035f` |
| divine/cutins/muse | `77c6374b6545b68b94bd663cb4adae0e97018cdf64673625e3cf64df58fccaa9` |
| divine/cutins/deepseek | `47b9a1728617a51c231aa36ba2f18bb99be243ef7b8223d02929d8b6ee22110f` |

## Grok's catch in orbit (2026-11-17)

`rocket/` holds one wide close-up of Grok for her special move in the orbit stage, where the game draws a launch tower with two big arms catch a rocket and the rocket throws her off ahead of it. The owner asked for the gag through the main session ("成本不計，主要是遊戲體驗跟梗有到位"); the picture is only Grok, and the tower, the rocket, the arms and the flame are drawn in code in `src/blast/orbit-gags.ts`. The character is the designer's, used under the permission recorded in "Seven characters drawn after ZipZipPipe's designs".

Generated on 2026-11-17 with the codex CLI built-in image generation (`codex exec`, model `gpt-6.1-sol`), one run, one try. Attached: her special-move picture (`cutins/grok-bot`, as redrawn on 2026-11-17) for the character and the style, and her full-body picture in `standing/`. The prompt asked for the same character from the waist up in normal proportions, leaning to the right, looking up and pointing, her hair blown back, with no rocket, tower, effects or text, real transparency, and at least 5% clear space at the top, left and right. A script that looks for drawn pixels touching each edge found none: the picture's drawn area is 9% clear on the left, 10% at the top and 11% on the right. Nothing was drawn or retouched by hand.

`npm run blast:art` writes it, trimmed and at most 960 wide, to `public/art/blast/rocket/` with `rocket.json`, in the same shape as `cutins.json`.

SHA-256 of the PNG as generated (1536×1024), stored here as lossless WebP:

| File | SHA-256 of the generated PNG |
|---|---|
| rocket/grok-bot | `99b373265d393ffd92d2a190dd857f6c3b30d615949572c829bf51d8eee63ddd` |

## Orbit's set dressing on the flat street (2026-11-17)

`orbit/` holds the five pieces the flat (2D) street draws in the orbit stage: the rocket, its launch tower, the tower's catch arm, the red car with a crash-test dummy, and one satellite (drawn many times as a train). The owner found the shapes first drawn in code ugly, while the 3D street's were fine, and asked for generated pictures instead. The car and the satellite are invented. The rocket, the tower and the arm follow the shape of the real Starship and its "chopsticks" catch tower, which the owner asked for so the gag is recognised (「星艦長相總沒有商標吧」); they carry no letters, names, logos or flags, and the rocket wears the cafe's bean.

Generated on 2026-11-17 with the codex CLI built-in image generation (`codex exec`), one prompt for all five. The first try came out as flat clip art with thick outlines and strong primaries; the owner asked whether it matched the anime style, and it did not. The second try, kept here, attached a strip of the real game with its existing props and two characters, the 3D street's rocket and tower, and one character's standing picture, and asked for soft pastel colours, soft anime shading and thin warm brown line art, with real transparency and clear space on every side. Nothing was drawn or retouched by hand.

The rocket, the tower and the arm were then generated again the same day, in a third run with the same style references and the second try's three pictures attached, asking for the shapes of Starship on its booster, a dark steel lattice tower and one chopstick catch arm, and again forbidding any text or logo. Those three are the ones kept; the car and the satellite are from the second try.

`npm run blast:art` writes them, trimmed and at most 960 wide, to `public/art/blast/orbit/` with `orbit.json`.

| Stored source | SHA-256 |
| --- | --- |
| orbit/rocket | `abe7782bfa5103d853c54dcedc32870d7b6d7efaacc821ed2cc25edc2d28016f` |
| orbit/tower | `1244f67fd9bdfb06cac63e253ae955231b83e69fe83a2a879a2d5b0a165775f9` |
| orbit/arm | `1fbd98423ef13004ebba464c691f917a01bcef056a7d41306cc970d0fef5e63f` |
| orbit/car | `d8f80f4c7fbc767ed996fb65e8f323304d2b72c1c96ecf45a31ae21aadc1b374` |
| orbit/satellite | `cdcf587734d5667258e3e567b7ccca3dda484bf43ef28adce244983bd52b3aa3` |
