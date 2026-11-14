import { describe, expect, it } from 'vitest';
import { characterImages, characterIndexSchema, characterProblems, characterSchema, lookPackProblems, lookPackSchema, pngSize, type CharacterImage } from './pack.ts';

/** A PNG data URL that is only a header: enough to declare a size, which is all the format checks. */
function png(width: number, height: number) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
}
const images = (change: Partial<Record<CharacterImage, string>> = {}) => ({
  ...Object.fromEntries((Object.keys(characterImages) as CharacterImage[]).map((kind) => [kind, png(characterImages[kind].width, characterImages[kind].height)])) as Record<CharacterImage, string>,
  ...change,
});
const provenance = {
  license: { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  credits: [{ name: 'ZipZipPipe', role: 'Original character design', url: 'https://www.pixiv.net/artworks/148186519' }, { name: 'PA Cafe', role: 'Chibi adaptation' }],
  source: 'https://github.com/pa-cafe/ZipZipPipe-character-pack',
};
const character = () => ({ format: 'pa-cafe-character', version: 1, id: 'zipzippipe-claude', name: 'Claude 娘', role: 'Claude girl', ...provenance, files: images() });
const lookPack = () => ({ format: 'pa-cafe-look-pack', version: 1, id: 'zipzippipe-ai-girls', name: 'ZipZipPipe AI娘化', ...provenance, characters: { gpt: { name: 'ChatGPT 娘', files: images() }, claude: { name: 'Claude 娘', files: images() } } });

describe('a character file', () => {
  it('parses in the shape the published packs use, with nothing to fix', () => {
    const pack = characterSchema.parse(character());
    expect(pack).toEqual(character());
    expect(characterProblems(pack)).toEqual([]);
  });

  it.each<[string, (raw: Record<string, unknown>) => void]>([
    ['no license', (raw) => { delete raw.license; }],
    ['no credits', (raw) => { raw.credits = []; }],
    ['a source that is not an https link', (raw) => { raw.source = 'http://example.com/pack'; }],
    ['an id that is not a slug', (raw) => { raw.id = 'Claude Girl'; }],
    ['a newer format version', (raw) => { raw.version = 2; }],
    ['a missing image', (raw) => { delete (raw.files as Record<string, unknown>).seated; }],
    ['an image that is not a PNG data URL', (raw) => { (raw.files as Record<string, unknown>).portrait = 'https://example.com/a.png'; }],
    ['a field the format does not have', (raw) => { raw.script = 'alert(1)'; }],
  ])('does not parse with %s', (_what, change) => {
    const raw: Record<string, unknown> = character();
    change(raw);
    expect(characterSchema.safeParse(raw).success).toBe(false);
  });

  it('names an image of the wrong size, and one that only claims to be a PNG', () => {
    const pack = characterSchema.parse({ ...character(), files: images({ sheet: png(1024, 1024), portrait: 'data:image/png;base64,AAAA' }) });
    expect(characterProblems(pack)).toEqual(['zipzippipe-claude portrait is not a PNG', 'zipzippipe-claude sheet is 1024×1024, not 2048×1024']);
  });
});

describe('a look pack file', () => {
  it('dresses any of the built-in residents and no one else', () => {
    expect(lookPackProblems(lookPackSchema.parse(lookPack()))).toEqual([]);
    expect(lookPackSchema.safeParse({ ...lookPack(), characters: {} }).success).toBe(false);
    expect(lookPackSchema.safeParse({ ...lookPack(), characters: { hermes: { name: 'Hermes', files: images() } } }).success).toBe(false);
  });

  it('names which resident’s image is wrong', () => {
    const pack = lookPackSchema.parse({ ...lookPack(), characters: { grok: { name: 'Grok 娘', files: images({ standee: png(512, 512) }) } } });
    expect(lookPackProblems(pack)).toEqual(['zipzippipe-ai-girls/grok standee is 512×512, not 512×1024']);
  });
});

describe('a character index', () => {
  it('lists the character files a repo offers', () => {
    const index = { format: 'pa-cafe-character-index', version: 1, characters: [{ id: 'claude', name: 'Claude 娘', nameEn: 'Claude girl', page: 2, file: 'packs/claude.pacafe-character.json', bytes: 4704142 }] };
    expect(characterIndexSchema.parse(index)).toEqual(index);
    expect(characterIndexSchema.safeParse({ ...index, characters: [{ ...index.characters[0], file: '../../etc/passwd' }] }).success).toBe(false);
  });
});

describe('reading a PNG size', () => {
  it('reads the declared pixels and refuses anything that is not a PNG', () => {
    expect(pngSize(png(512, 1024))).toEqual({ width: 512, height: 1024 });
    for (const not of ['', 'data:image/png;base64,', 'data:image/png;base64,***', `data:image/png;base64,${btoa('GIF89a' + 'x'.repeat(30))}`]) expect(pngSize(not)).toBeNull();
  });
});
