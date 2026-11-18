import { canvas, CAST } from './art';

type Standee = { image: HTMLCanvasElement; width: number; height: number };
type Pose = 'tumble' | 'splat' | 'cheer' | 'stand' | 'help' | 'hurt';

const TALL = 360, EDGE = 5;
const loaded = new Map<string, Standee | null>();

function sticker(picture: HTMLImageElement): Standee | null {
  const k = Math.min(1, TALL / picture.naturalHeight), w = Math.round(picture.naturalWidth * k), h = Math.round(picture.naturalHeight * k);
  const small = canvas(w, h), ink = small.getContext('2d')!;
  ink.drawImage(picture, 0, 0, w, h);
  const alpha = ink.getImageData(0, 0, w, h).data;
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[(y * w + x) * 4 + 3] > 24) { if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y; }
  if (right < left) return null;
  const width = right - left + 1 + EDGE * 2, height = bottom - top + 1 + EDGE * 2;
  const white = canvas(w, h), paint = white.getContext('2d')!;
  paint.drawImage(small, 0, 0); paint.globalCompositeOperation = 'source-in'; paint.fillStyle = '#fff'; paint.fillRect(0, 0, w, h);
  const image = canvas(width, height), ctx = image.getContext('2d')!;
  for (let turn = 0; turn < 16; turn++) ctx.drawImage(white, EDGE - left + Math.cos(turn * Math.PI / 8) * EDGE, EDGE - top + Math.sin(turn * Math.PI / 8) * EDGE);
  ctx.drawImage(small, EDGE - left, EDGE - top);
  return { image, width, height };
}

/** The picture at `src`, once it has loaded. Null until then, and for good when it cannot be read: the built-in character is drawn instead. */
export function standee(src: string | null | undefined): Standee | null {
  if (!src) return null;
  const kept = loaded.get(src);
  if (kept !== undefined) return kept;
  loaded.set(src, null);
  const picture = new Image();
  picture.decoding = 'async'; picture.src = src;
  picture.decode().then(() => { loaded.set(src, sticker(picture)); }, () => undefined);
  return null;
}

/** Size on screen at `scale` pixels per metre: as tall as the built-in figure standing, a little smaller in the air, and on its side once it has landed. */
export function standeeBox(own: Standee, pose: Pose, scale: number) {
  const tall = (pose === 'tumble' ? 2.1 : 2.6) * CAST * scale, wide = tall * own.width / own.height;
  return pose === 'splat' ? { width: tall, height: wide } : { width: wide, height: tall };
}

/** Draws the picture with its centre at (x, y), or its soles there when `standing`. Landed, it lies on its side. */
export function drawStandee(ctx: CanvasRenderingContext2D, own: Standee, pose: Pose, x: number, y: number, scale: number, standing = false) {
  const box = standeeBox(own, pose, scale);
  if (pose !== 'splat') { ctx.drawImage(own.image, x - box.width / 2, standing ? y - box.height : y - box.height / 2, box.width, box.height); return; }
  ctx.save(); ctx.translate(x, standing ? y - box.height / 2 : y); ctx.rotate(Math.PI / 2);
  ctx.drawImage(own.image, -box.height / 2, -box.width / 2, box.height, box.width);
  ctx.restore();
}

const portraits = new Map<string, HTMLImageElement | null>();
/** The portrait at `src`, once it has loaded. Null until then, and for good when it cannot be read. */
export function portrait(src: string | null | undefined): HTMLImageElement | null {
  if (!src) return null;
  const kept = portraits.get(src);
  if (kept !== undefined) return kept;
  portraits.set(src, null);
  const picture = new Image();
  picture.decoding = 'async'; picture.src = src;
  picture.decode().then(() => { portraits.set(src, picture); }, () => undefined);
  return null;
}

const HEAD = { middle: 0.21, radius: 0.2 };
/** Draws the head of an uploaded full-body picture to fill a round frame of radius `r` centred on (x, y). The caller clips. */
export function drawStandeeFace(ctx: CanvasRenderingContext2D, own: Standee, x: number, y: number, r: number) {
  const tall = r / HEAD.radius, wide = tall * own.width / own.height;
  ctx.drawImage(own.image, x - wide / 2, y - HEAD.middle * tall, wide, tall);
}
