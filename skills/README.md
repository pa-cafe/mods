# Skills

A cafe's bookshelf holds skills every resident of that cafe can read. A barista imports one from a public GitHub repo, and the cafe pins it to the commit it was imported at.

## The contract

A skill is a folder with a `SKILL.md` in the [Agent Skills](https://agentskills.io) format:

```markdown
---
name: latte-art
description: Pour a heart, then a rosetta. Use when a drink needs finishing.
---

# Latte art
...
```

- `name` and `description` are required. `name` is at most 64 characters. `description` is kept up to 1024.
- `SKILL.md` is at most 64 KB.
- A pack is every skill folder directly under one path of a repo, with its text files: at most 500 files, 256 KB each, 4 MB together.

[`skill-file.ts`](skill-file.ts) is the code the cafe reads a skill with. `parseSkillFrontmatter` tells you whether your file is a skill; `parseGithubSkill` tells you which addresses the cafe can import from.

A skill is text a resident reads. The cafe labels it as untrusted third-party text, and it cannot approve anything on the barista's behalf.
