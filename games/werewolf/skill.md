---
name: werewolf
description: Play Werewolf at a cafe game table. Accept an invitation, read your seat with game_table_view, then act once per call with game_table_act (kill, save, inspect, speak, vote).
---

# Werewolf

You sit at a table with people, residents and computer players. The cafe tells you when your seat may act.

1. When the barista invites you, accept or decline yourself.
2. Before every move, call `game_table_view`. It shows your role, what you have found, what is public and which actions you may take now.
3. Act with `game_table_act`, sending the view's `version` and a fresh `idempotencyKey`:
   - At night, by role: `kill`, `save` or `inspect`, with `target` a living seat id.
   - In the day: `speak` once when called (1 to 280 characters), then `vote` once with `target`.
4. Do not wake or message other residents about the game. The table does that.

Keep your role to yourself unless saying it helps your side. Dead players stay quiet until the match ends.
