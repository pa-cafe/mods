// What a character pack file is. A fan or an artist publishes these, and a barista imports one to give a resident, or
// every built-in resident at once, a new look. The art in a pack belongs to its makers: `license` and `credits` travel
// with the file so the cafe can show them before anything is applied.
//
//   <id>.pacafe-character.json   one character: portrait, standee, walking sheet and seated sheet
//   <id>.pacafe-look-pack.json   a look for each built-in resident
//   index.json                   the characters a repo offers, for browsing

import { z } from 'zod';

/** What each image must be: PNG, with exactly these pixels. */
export const characterImages = {
  /** Square head-and-shoulders, for cards and chat. */
  portrait: { width: 512, height: 512 },
  /** Full body, standing still, on a transparent background. */
  standee: { width: 512, height: 1024 },
  /** Walking: 8 columns by 4 rows of 256-pixel cells, rows facing south, west, north, east. */
  sheet: { width: 2048, height: 1024 },
  /** Sitting: 4 columns by 4 rows of 256-pixel cells, one row per diagonal facing. */
  seated: { width: 1024, height: 1024 },
} as const;
export type CharacterImage = keyof typeof characterImages;

/** The built-in residents a look pack can dress. */
const lookSlots = ['gpt', 'grok', 'gemini', 'claude'] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const link = z.string().url().max(500).refine((url) => url.startsWith('https://'), 'must be an https link');
const png = z.string().startsWith('data:image/png;base64,', 'must be a PNG data URL');
const files = z.strictObject({ portrait: png, standee: png, sheet: png, seated: png });
const provenance = {
  id: z.string().regex(/^[a-z0-9-]{1,64}$/, 'must be a slug'),
  name: text(60),
  license: z.strictObject({ name: text(80), url: link }),
  credits: z.array(z.strictObject({ name: text(80), role: text(120), url: link.optional() })).min(1).max(12),
  source: link,
};

export const characterSchema = z.strictObject({ format: z.literal('pa-cafe-character'), version: z.literal(1), ...provenance, role: text(120), files });
type CharacterPack = z.infer<typeof characterSchema>;

export const lookPackSchema = z.strictObject({
  format: z.literal('pa-cafe-look-pack'), version: z.literal(1), ...provenance,
  characters: z.partialRecord(z.enum(lookSlots), z.strictObject({ name: text(60), files })).refine((looks) => Object.keys(looks).length > 0, 'must dress at least one resident'),
});
type LookPack = z.infer<typeof lookPackSchema>;

export const characterIndexSchema = z.strictObject({
  format: z.literal('pa-cafe-character-index'), version: z.literal(1),
  characters: z.array(z.strictObject({ id: provenance.id, name: text(60), nameEn: text(60).optional(), page: z.number().int().nonnegative().optional(), file: z.string().regex(/^[\w./-]+\.pacafe-character\.json$/), bytes: z.number().int().positive() })),
});

/** The pixel size a PNG data URL declares in its header, or null when it is not a PNG. */
export function pngSize(dataUrl: string): { width: number; height: number } | null {
  const head = dataUrl.slice('data:image/png;base64,'.length, 'data:image/png;base64,'.length + 32);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(head), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  if (bytes.length < 24 || signature.some((byte, at) => bytes[at] !== byte)) return null;
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** What is wrong with a set of images, in words. Empty when each is a PNG of the right size. */
function imageProblems(label: string, images: Record<CharacterImage, string>): string[] {
  return (Object.keys(characterImages) as CharacterImage[]).flatMap((kind) => {
    const size = pngSize(images[kind]), want = characterImages[kind];
    if (!size) return [`${label} ${kind} is not a PNG`];
    return size.width === want.width && size.height === want.height ? [] : [`${label} ${kind} is ${size.width}×${size.height}, not ${want.width}×${want.height}`];
  });
}
export const characterProblems = (pack: CharacterPack) => imageProblems(pack.id, pack.files);
export const lookPackProblems = (pack: LookPack) => Object.entries(pack.characters).flatMap(([slot, look]) => imageProblems(`${pack.id}/${slot}`, look.files));
