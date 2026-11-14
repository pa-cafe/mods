import { describe, expect, it } from 'vitest';
import { parseGithubSkill, parseSkillFrontmatter } from './skill-file.ts';

describe('where a skill is imported from', () => {
  it('reads owner/name and a folder', () => {
    expect(parseGithubSkill('acme/skills', 'brew/latte')).toEqual({ owner: 'acme', name: 'skills', path: 'brew/latte', ref: undefined });
    expect(parseGithubSkill(' acme/skills.git ', '', 'v2')).toEqual({ owner: 'acme', name: 'skills', path: '', ref: 'v2' });
  });

  it('reads a github.com link to a repo, a folder or a SKILL.md, taking the ref and folder from the link', () => {
    expect(parseGithubSkill('https://github.com/acme/skills', '')).toEqual({ owner: 'acme', name: 'skills', path: '', ref: undefined });
    expect(parseGithubSkill('https://github.com/acme/skills/tree/main/brew/latte', '')).toEqual({ owner: 'acme', name: 'skills', path: 'brew/latte', ref: 'main' });
    expect(parseGithubSkill('https://www.github.com/acme/skills/blob/v1/brew/latte/SKILL.md', '')).toEqual({ owner: 'acme', name: 'skills', path: 'brew/latte', ref: 'v1' });
  });

  it('lets an explicit folder and ref win over the ones in a link', () => {
    expect(parseGithubSkill('https://github.com/acme/skills/tree/main/brew', 'tea/SKILL.md', 'abc123')).toEqual({ owner: 'acme', name: 'skills', path: 'tea', ref: 'abc123' });
  });

  it.each([
    ['http://github.com/acme/skills', 'Only github.com repos'],
    ['https://gitlab.com/acme/skills', 'Only github.com repos'],
    ['https://github.com/acme', 'owner/name'],
    ['acme', 'owner/name'],
    ['acme/skills/extra', 'owner/name'],
    ['ac me/skills', 'characters GitHub does not allow'],
    ['../skills', 'characters GitHub does not allow'],
  ])('turns away %s', (repo, why) => {
    expect(() => parseGithubSkill(repo, '')).toThrow(why);
  });

  it('turns away a folder that climbs out of the repo', () => {
    expect(() => parseGithubSkill('acme/skills', 'brew/../../secrets')).toThrow('skill folder path is not valid');
  });
});

describe('the front matter of a SKILL.md', () => {
  it('reads name, description and every other field as text', () => {
    expect(parseSkillFrontmatter('---\nname: latte-art\ndescription: Pour a heart.\nlicense: MIT\n---\n# Latte art\n')).toEqual({
      name: 'latte-art', description: 'Pour a heart.', fields: { name: 'latte-art', description: 'Pour a heart.', license: 'MIT' },
    });
  });

  it('reads quoted values, folded and literal blocks, and continued lines', () => {
    const skill = parseSkillFrontmatter('---\nname: "latte-art"\ndescription: >\n  Pour a heart,\n  then a rosetta.\nnotes: |\n  one\n  two\nwhen: use it\n  for milk drinks\n---\n');
    expect(skill).toMatchObject({ name: 'latte-art', description: 'Pour a heart, then a rosetta.', fields: { notes: 'one\ntwo', when: 'use it for milk drinks' } });
  });

  it('reads a file that starts with a byte order mark or uses Windows line endings', () => {
    expect(parseSkillFrontmatter('﻿---\r\nname: a\r\ndescription: b\r\n---\r\nbody')).toMatchObject({ name: 'a', description: 'b' });
  });

  it('keeps a description up to 1024 characters', () => {
    expect(parseSkillFrontmatter(`---\nname: a\ndescription: ${'x'.repeat(2000)}\n---\n`)!.description).toHaveLength(1024);
  });

  it.each([
    ['no front matter block', '# Latte art\nname: a\ndescription: b\n'],
    ['a block that never closes', '---\nname: a\ndescription: b\n'],
    ['no name', '---\ndescription: b\n---\n'],
    ['no description', '---\nname: a\n---\n'],
    ['an empty description', '---\nname: a\ndescription:\n---\n'],
    ['a name longer than 64 characters', `---\nname: ${'a'.repeat(65)}\ndescription: b\n---\n`],
  ])('is not a skill with %s', (_what, text) => {
    expect(parseSkillFrontmatter(text)).toBeNull();
  });
});
