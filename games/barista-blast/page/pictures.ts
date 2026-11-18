import type { BlastKind } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import { atlasLook, canvas, drawFace, drawPose, poseBox, type Atlas } from './art';
import { nodeOf } from './nodes';

/** A square picture `size` CSS pixels wide. A resident and the ghost come from the atlas: null until it has loaded. */
export function blastPicture(kind: BlastKind, size: number, ratio: number, atlas: Atlas | null, words: (key: TextKey) => string) {
  const art = nodeOf(kind).art, side = size * ratio, image = canvas(side, side), ctx = image.getContext('2d')!;
  const fit = (source: HTMLCanvasElement) => {
    const k = Math.min(side / source.width, side / source.height), w = source.width * k, h = source.height * k;
    ctx.drawImage(source, (side - w) / 2, side - h, w, h);
  };
  if ('prop' in art) { fit(art.prop(1, words).image); return image; }
  if (!atlas) return null;
  const look = atlasLook[art.look];
  drawPose(ctx, atlas, look, 'stand', side / 2, side, side / poseBox(look, 'stand', 1).height, true);
  return image;
}

/** A resident's face as a square picture `size` CSS pixels wide: the head fills it. Null for anything that is not a resident, and until the atlas has loaded. */
export function blastFace(kind: BlastKind, size: number, ratio: number, atlas: Atlas | null) {
  const art = nodeOf(kind).art;
  if (!atlas || !('look' in art)) return null;
  const side = size * ratio, image = canvas(side, side);
  drawFace(image.getContext('2d')!, atlas, atlasLook[art.look], side / 2, side / 2, side / 2);
  return image;
}
