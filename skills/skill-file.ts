// What the cafe accepts as a skill, and as a pack of skills, when a barista imports one from a public GitHub repo.
//
// A skill is a folder holding SKILL.md, in the Agent Skills format: a `---` front matter block with `name` and
// `description`, then Markdown. A pack is every skill folder directly under one base path of a repo, with its text
// files. The cafe pins what it imports to a commit, so a skill never changes under a resident without a new import.

/** SKILL.md is read up to this many bytes. A larger file is turned away. */
export const LIBRARY_SKILL_MAX = 64 * 1024;
/** A pack is turned away when its text files add up to more than this, */
export const PACK_MAX_BYTES = 4 * 1024 * 1024;
/** when any one file is larger than this (a larger SKILL.md fails the import; other large files are skipped), */
export const PACK_FILE_MAX = 256 * 1024;
/** or when it holds more files than this. */
export const PACK_FILES_MAX = 500;

/** Reads `owner/name`, or a github.com link to a repo, a folder or a SKILL.md, into the repo, folder and ref to import. */
export function parseGithubSkill(repo: string, path: string, ref?: string): { owner: string; name: string; path: string; ref: string | undefined } {
  let owner: string, name: string, treePath = '', treeRef: string | undefined;
  const text = repo.trim();
  if (/^https?:\/\//i.test(text)) {
    let url: URL; try { url = new URL(text); } catch { throw new Error('That is not a GitHub address'); }
    if (url.protocol !== 'https:' || !/^(www\.)?github\.com$/i.test(url.hostname)) throw new Error('Only github.com repos can be imported');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error('Use owner/name or a link to a repo');
    [owner, name] = parts; name = name.replace(/\.git$/, '');
    if ((parts[2] === 'tree' || parts[2] === 'blob') && parts.length > 3) { treeRef = parts[3]; treePath = parts.slice(4).join('/'); }
  } else {
    const parts = text.replace(/\.git$/, '').split('/');
    if (parts.length !== 2) throw new Error('Use owner/name or a link to a repo');
    [owner, name] = parts;
  }
  const segment = /^[A-Za-z0-9_.-]{1,100}$/;
  if (!segment.test(owner) || !segment.test(name) || owner === '.' || owner === '..' || name === '.' || name === '..') throw new Error('That repo name has characters GitHub does not allow');
  const folder = (path || treePath).split('/').filter(Boolean);
  if (folder.at(-1)?.toLowerCase() === 'skill.md') folder.pop();
  if (folder.some(part => part === '.' || part === '..' || /[\\\p{Cc}]/u.test(part))) throw new Error('The skill folder path is not valid');
  return { owner, name, path: folder.join('/'), ref: ref ?? treeRef };
}

/** The front matter of a SKILL.md. `fields` holds every key the block gave, as text. */
export interface SkillFrontmatter { name: string; description: string; fields: Record<string, string> }
/**
 * Reads the front matter block. Null when there is none, when `name` or `description` is missing, or when `name` is
 * longer than 64 characters or holds control characters. A description is kept up to 1024 characters.
 */
export function parseSkillFrontmatter(raw: string): SkillFrontmatter | null {
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const fields: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const head = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(lines[i]);
    if (!head) continue;
    let value = head[2].trim();
    const block = /^([>|])[+-]?$/.exec(value);
    const more: string[] = [];
    while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) more.push(lines[++i].trim());
    if (block) value = more.join(block[1] === '|' ? '\n' : ' ');
    else if (more.length && value) value = [value, ...more].join(' ');
    else if (more.length) { fields[head[1]] = ''; continue; }
    const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
    fields[head[1]] = (quoted ? quoted[2] : value).trim();
  }
  const name = fields.name, description = fields.description;
  if (!name || !description || name.length > 64 || /\p{Cc}/u.test(name)) return null;
  return { name, description: description.slice(0, 1024), fields };
}
