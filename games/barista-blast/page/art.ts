import bad from '../art/bad.json';
import cheers from '../art/cheers.json';
import cutins from '../art/cutins.json';
import divineCheers from '../art/divine-cheers.json';
import divineCutins from '../art/divine-cutins.json';
import divine from '../art/divine.json';
import rockets from '../art/rocket.json';
import orbitFiles from '../art/orbit.json';
import voids from '../art/void.json';
import poses from '../art/poses.json';
import type { BlastLook } from '../rules.ts';

export const INK = '#263F35', CREAM = '#FFF8E7', PINK = '#FF5C8A', MINT = '#6BFFD8', RED = '#E0572F';
const GOLD = '#FFC83D', BEAN = '#8A5A3C', ESPRESSO = '#3B2418';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
let font: { lang: string; stack: string } | null = null;
export function houseFont() {
  const lang = document.documentElement.lang;
  if (font?.lang !== lang) font = { lang, stack: getComputedStyle(document.documentElement).getPropertyValue('--house-font').trim() || 'sans-serif' };
  return font.stack;
}

export type AtlasLook = 'dots' | 'grok-bot' | 'muse' | 'claude' | 'gemini' | 'deepseek' | 'qwen' | 'doubao';
type Pose = 'tumble' | 'splat' | 'cheer' | 'stand' | 'help' | 'hurt';
export const atlasLook: Record<BlastLook, AtlasLook> = { muse: 'muse', claude: 'claude', dots: 'dots', grok: 'grok-bot', gemini: 'gemini', deepseek: 'deepseek', qwen: 'qwen', doubao: 'doubao' };
type SheetFile = { file: string; avif: string };
let readsAvif = true;
const sheetUrl = (sheet: SheetFile) => `/art/blast/${readsAvif ? sheet.avif : sheet.file}`;
function showSheet(image: HTMLImageElement, sheet: SheetFile) {
  image.addEventListener('error', () => { if (image.src.endsWith('.avif')) { readsAvif = false; image.src = sheetUrl(sheet); } });
  image.src = sheetUrl(sheet);
}
const frames = poses.frames as Record<`${AtlasLook}/${Pose}`, number[]> as Record<`${AtlasLook}/${Pose}`, [number, number, number, number]>;
export const CAST = 1.4;
const poseSize: Record<Pose, ['height' | 'width', number]> = { stand: ['height', 2.6 * CAST], cheer: ['height', 2.6 * CAST], help: ['height', 2.6 * CAST], hurt: ['height', 2.6 * CAST], tumble: ['height', 2.1 * CAST], splat: ['width', 2.7 * CAST] };
export type Atlas = HTMLImageElement;

let atlasKept: Promise<Atlas> | null = null;
/** Decoded once for the page: the game and each share card draw from the same image. A failed load is tried again. */
export function loadAtlas(): Promise<Atlas> {
  if (atlasKept) return atlasKept;
  const image = new Image();
  image.decoding = 'async';
  image.src = sheetUrl(poses);
  const loading = image.decode().catch(error => {
    if (!image.src.endsWith('.avif')) throw error;
    readsAvif = false; image.src = sheetUrl(poses);
    return image.decode();
  }).then(() => image);
  atlasKept = loading;
  loading.catch(() => { if (atlasKept === loading) atlasKept = null; });
  return loading;
}

type CutinFile = { file: string; width: number; height: number };
const cutinFiles: Record<'own' | 'divine' | 'bad' | 'rocket', Partial<Record<AtlasLook, CutinFile>>> = { own: cutins, divine: divineCutins, bad, rocket: rockets };
const cutinsLoaded = new Map<string, HTMLImageElement>();
/**
 * A look's picture for its special move, or null while it is on its way or when the look has none: in the divine realm
 * (`robed`) the one in her divine clothes. Each is its own file of about 180 KB, so nothing is fetched until a boost is
 * in reach; the first call starts the download.
 */
export function cutinOf(look: AtlasLook, robed = false): HTMLImageElement | null { return pictureOf(cutinFiles[robed ? 'divine' : 'own'][look]); }
/** A look's picture for the moment her trouble lands, fetched on the first call the same way; null until then and while she has none. */
export const badOf = (look: AtlasLook) => pictureOf(cutinFiles.bad[look]);
/** A look's picture for the special move it has in orbit, where a rocket comes for it; only Grok has one. Fetched on the first call, null until it arrives and for every other look. */
export const rocketOf = (look: AtlasLook) => pictureOf(cutinFiles.rocket[look]);
export type OrbitProps = Record<keyof typeof orbitFiles, HTMLImageElement>;
/** The pictures orbit's set dressing is drawn with on the flat street, or null until every one has arrived. The first call fetches them, about 190 KB in all. */
export function orbitProps(): OrbitProps | null {
  const props = Object.fromEntries(Object.entries(orbitFiles).map(([name, file]) => [name, pictureOf(file)]));
  return Object.values(props).every(Boolean) ? props as OrbitProps : null;
}
function pictureOf(known: CutinFile | undefined): HTMLImageElement | null {
  if (!known || typeof Image === 'undefined') return null;
  let image = cutinsLoaded.get(known.file);
  if (!image) { image = new Image(); image.src = `/art/blast/${known.file}`; cutinsLoaded.set(known.file, image); }
  return image.complete && image.naturalWidth > 0 ? image : null;
}
const cheerFiles: Record<'own' | 'divine', Partial<Record<AtlasLook, CutinFile>>> = { own: cheers, divine: divineCheers };
/**
 * A look's victory pose at the size a share card stands her, about 740 pixels tall, with its sticker edge drawn at that
 * size: the atlas frame scaled up blurs and shows a ragged edge. It fills the same box as the frame. Null when it fails.
 */
export function cheerReady(look: AtlasLook, robed = false): Promise<HTMLImageElement | null> {
  const known = cheerFiles[robed ? 'divine' : 'own'][look];
  if (!known || typeof Image === 'undefined') return Promise.resolve(null);
  const image = new Image(); image.src = `/art/blast/${known.file}`;
  return image.decode().then(() => image, () => null);
}
/** The same picture once it has arrived, for a share card drawn after the run; null when the look has none or it fails to load. */
export function cutinReady(look: AtlasLook, robed = false): Promise<HTMLImageElement | null> {
  if (!cutinFiles[robed ? 'divine' : 'own'][look]) return Promise.resolve(null);
  const ready = cutinOf(look, robed);
  if (ready) return Promise.resolve(ready);
  const image = cutinsLoaded.get(cutinFiles[robed ? 'divine' : 'own'][look]!.file);
  return image ? image.decode().then(() => image, () => null) : Promise.resolve(null);
}
type Sheet = { frames: Record<string, number[] | undefined>; bodies: Record<string, number | undefined> };
const sheets: Record<'own' | 'divine', Sheet> = { own: poses, divine };
const sheetOf = (look: AtlasLook, pose: Pose, robed: boolean) => robed && sheets.divine.frames[`${look}/${pose}`] ? sheets.divine : sheets.own;

/**
 * Size of a pose on screen at `scale` pixels per metre. An upright figure is sized by her body, soles to the top of the
 * hair, so a halo, horns or a crown stick out above her height instead of shrinking her. `robed` is the divine costume.
 */
export function poseBox(look: AtlasLook, pose: Pose, scale: number, robed = false) {
  const sheet = sheetOf(look, pose, robed), [, , w, h] = sheet.frames[`${look}/${pose}`] as [number, number, number, number], [side, meters] = poseSize[pose];
  const k = meters * scale / (side === 'height' ? sheet.bodies[`${look}/${pose}`] ?? h : w);
  return { width: w * k, height: h * k };
}

let divineImage: HTMLImageElement | null = null;
/** The divine realm's sheet, or null while it is on its way. It is its own download, fetched when a run gets near that stage: the first call starts it. */
export function divineAtlas(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!divineImage) { divineImage = new Image(); showSheet(divineImage, divine); }
  return divineImage.complete && divineImage.naturalWidth > 0 ? divineImage : null;
}

/** The divine sheet once it has arrived, for a share card drawn after the run; null when it fails to load. */
export function divineReady(): Promise<HTMLImageElement | null> {
  const ready = divineAtlas();
  if (ready || !divineImage) return Promise.resolve(ready);
  const image = divineImage;
  return image.decode().then(() => image, () => null);
}

const voidFiles: Partial<Record<AtlasLook, { file: string }>> = voids;
const voidsLoaded = new Map<AtlasLook, HTMLImageElement>();
/** A look's figure for the void, white on nothing, or null while it is on its way. Fetched one by one, as the void shows them. */
export function voidOf(look: AtlasLook): HTMLImageElement | null {
  const known = voidFiles[look];
  if (!known || typeof Image === 'undefined') return null;
  let image = voidsLoaded.get(look);
  if (!image) { image = new Image(); image.src = `/art/blast/${known.file}`; voidsLoaded.set(look, image); }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

const faces: Record<AtlasLook, readonly [number, number, number]> = {
  dots: [0.5, 0.35, 0.2], 'grok-bot': [0.5, 0.36, 0.2], muse: [0.5, 0.32, 0.2], claude: [0.5, 0.33, 0.2],
  gemini: [0.5, 0.36, 0.2], deepseek: [0.5, 0.36, 0.2], qwen: [0.5, 0.36, 0.2], doubao: [0.5, 0.31, 0.2],
};
/** Draws a look's face to fill a round frame of radius `r` centred on (x, y). The caller clips to the frame. */
export function drawFace(ctx: CanvasRenderingContext2D, atlas: Atlas, look: AtlasLook, x: number, y: number, r: number) {
  const [sx, sy, w, h] = frames[`${look}/stand`], [fx, fy, fr] = faces[look], tall = r / fr, wide = tall * w / h;
  ctx.drawImage(atlas, sx, sy, w, h, x - fx * wide, y - fy * tall, wide, tall);
}

/**
 * Where to put the whole atlas, as an image, inside a round frame `size` pixels across so that a look's face fills it:
 * for a list in the page, which has no canvas to draw on.
 */
export function faceCrop(look: AtlasLook, size: number) {
  const [sx, sy, w, h] = frames[`${look}/stand`], [fx, fy, fr] = faces[look], k = size / 2 / (fr * h);
  return { src: sheetUrl(poses), fallback: `/art/blast/${poses.file}`, scale: k, left: size / 2 - (sx + fx * w) * k, top: size / 2 - (sy + fy * h) * k };
}

/** Draws a pose with its centre at (x, y), or its soles there when `standing`. */
export function drawPose(ctx: CanvasRenderingContext2D, atlas: Atlas, look: AtlasLook, pose: Pose, x: number, y: number, scale: number, standing = false, robed: Atlas | null = null) {
  const sheet = sheetOf(look, pose, robed !== null), [sx, sy, w, h] = sheet.frames[`${look}/${pose}`] as [number, number, number, number], box = poseBox(look, pose, scale, robed !== null);
  atlas = sheet === sheets.divine && robed ? robed : atlas;
  ctx.drawImage(atlas, sx, sy, w, h, x - box.width / 2, standing ? y - box.height : y - box.height / 2, box.width, box.height);
}

export function canvas(width: number, height: number) {
  const made = document.createElement('canvas');
  made.width = Math.max(1, Math.ceil(width)); made.height = Math.max(1, Math.ceil(height));
  return made;
}

/** A picture drawn once at `res` pixels per board unit and stamped every frame; `x`, `y` are where its origin sits in it. */
export type Stamp = { image: HTMLCanvasElement; x: number; y: number; res: number };
/** Board units: the art board was drawn at 80 per metre, so its shapes are copied in its own numbers. */
export const UNIT = 80;
type Box = { left: number; top: number; width: number; height: number };
export function stamp(box: Box, res: number, paint: (ctx: CanvasRenderingContext2D) => void): Stamp {
  const image = canvas(box.width * res, box.height * res), ctx = image.getContext('2d')!;
  ctx.scale(res, res); ctx.translate(-box.left, -box.top);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  paint(ctx);
  return { image, x: -box.left * res, y: -box.top * res, res };
}
/** Draws a stamp with its origin at (x, y), at `scale` pixels per metre. */
export function drawStamp(ctx: CanvasRenderingContext2D, art: Stamp, x: number, y: number, scale: number) {
  const k = scale / UNIT / art.res;
  ctx.drawImage(art.image, x - art.x * k, y - art.y * k, art.image.width * k, art.image.height * k);
}

export const round = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
export const paintIt = (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke = INK, width = 3.5) => { ctx.fillStyle = fill; ctx.fill(); if (width) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); } };
const vertical = (ctx: CanvasRenderingContext2D, top: number, bottom: number, stops: readonly string[]) => {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach((color, index) => gradient.addColorStop(index / (stops.length - 1), color));
  return gradient;
};
export const goldFill = (ctx: CanvasRenderingContext2D, top: number, bottom: number) => vertical(ctx, top, bottom, ['#FFF4A8', GOLD, '#FF8A2B']);
export const pinkFill = (ctx: CanvasRenderingContext2D, top: number, bottom: number) => vertical(ctx, top, bottom, ['#FFD1E0', PINK, '#D62E6B']);
const chrome = (ctx: CanvasRenderingContext2D, top: number, bottom: number) => vertical(ctx, top, bottom, ['#FFFFFF', '#DCE6EA', '#9FB2BA', '#EEF4F6']);
const shadowed = (ctx: CanvasRenderingContext2D, draw: () => void) => { ctx.save(); ctx.shadowColor = 'rgba(42,27,58,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5; draw(); ctx.restore(); };

export const hash = (index: number, salt = 0) => { let value = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35); value ^= value >>> 15; value = Math.imul(value, 0x2c1b3c6d); value ^= value >>> 12; return (value >>> 0) / 4_294_967_296; };


export function wallArt(res: number, sign: string, reset = false) {
  const rows = 19;
  return stamp({ left: -86, top: -rows * 22 - 50, width: 172, height: rows * 22 + 56 }, res, ctx => shadowed(ctx, () => {
    for (let i = 0; i < rows; i++) {
      const y = -(i + 1) * 22;
      round(ctx, -60, y, 120, 20, 5); paintIt(ctx, i % 2 ? '#3A4658' : '#2F3A4B', INK, 3);
      for (let vent = 0; vent < 5; vent++) { round(ctx, -50 + vent * 13, y + 7, 8, 6, 2); paintIt(ctx, '#1B2330', INK, 0); }
      for (let light = 0; light < 3; light++) { ctx.beginPath(); ctx.arc(28 + light * 10, y + 10, 3, 0, Math.PI * 2); ctx.fillStyle = hash(i, light) < 0.12 ? GOLD : reset ? '#5CFF9A' : '#FF5C6C'; ctx.fill(); }
    }
    const top = -rows * 22 - 40;
    ctx.font = `900 15px ${houseFont()}`;
    const width = Math.min(168, Math.max(120, ctx.measureText(sign).width + 28));
    round(ctx, -width / 2, top, width, 32, 10); paintIt(ctx, reset ? '#2F9E6B' : RED);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sign, 0, top + 17, width - 16);
  }));
}




export function mailArt(res: number, sign: string) {
  return stamp({ left: -92, top: -470, width: 184, height: 476 }, res, ctx => {
    const top = -420, bottom = -306;
    const beam = ctx.createLinearGradient(0, bottom, 0, 0);
    beam.addColorStop(0, 'rgba(255,236,190,.55)'); beam.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(-58, bottom); ctx.lineTo(58, bottom); ctx.lineTo(70, 0); ctx.lineTo(-70, 0); ctx.closePath(); ctx.fill();
    ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(214,74,52,.45)'; ctx.lineWidth = 3;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 58, bottom + 8); ctx.lineTo(side * 70, -6); ctx.stroke(); }
    ctx.setLineDash([]);
    shadowed(ctx, () => {
      round(ctx, -80, top, 160, bottom - top, 10); paintIt(ctx, '#F3E2B8');
      round(ctx, 28, top + 14, 38, 46, 3); paintIt(ctx, '#fff', INK, 2.5);
      round(ctx, 33, top + 19, 28, 36, 2); paintIt(ctx, '#E8825A', INK, 0);
      for (const [w, y] of [[72, 76], [52, 92]] as const) { round(ctx, -50, top + y, w, 7, 3.5); paintIt(ctx, '#D9C49A', INK, 0); }
      ctx.save(); ctx.translate(26, top + 40); ctx.rotate(-0.12); ctx.strokeStyle = RED; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      for (let wave = 0; wave < 3; wave++) { ctx.beginPath(); for (let i = 0; i <= 9; i++) ctx.lineTo(-26 - i * 5, -12 + wave * 11 + Math.sin(i * 1.4) * 3); ctx.stroke(); }
      ctx.restore();
    });
    const tag = -464;
    shadowed(ctx, () => {
      ctx.font = `900 15px ${houseFont()}`;
      const width = Math.min(176, Math.max(120, ctx.measureText(sign).width + 28));
      round(ctx, -width / 2, tag, width, 32, 10); paintIt(ctx, RED);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sign, 0, tag + 17, width - 16);
    });
  });
}

export function windowArt(res: number) {
  return stamp({ left: -116, top: -232, width: 232, height: 238 }, res, ctx => shadowed(ctx, () => {
    round(ctx, -96, -190, 192, 190, 10); paintIt(ctx, '#B9DCCB');
    round(ctx, -74, -150, 148, 72, 8); paintIt(ctx, '#3B3168');
    ctx.fillStyle = '#FFE9B8'; ctx.globalAlpha = 0.35; ctx.fillRect(-70, -146, 140, 20); ctx.globalAlpha = 1;
    const n = 8, w = 216 / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(-108 + i * w, -212); ctx.lineTo(-108 + (i + 1) * w, -212); ctx.lineTo(-108 + (i + 1) * w, -190); ctx.arc(-108 + i * w + w / 2, -190, w / 2, 0, Math.PI); ctx.closePath();
      paintIt(ctx, i % 2 ? CREAM : '#2F6B55', '#7A4B3A', 2);
    }
    round(ctx, -112, -224, 224, 14, 6); paintIt(ctx, '#7A4B3A');
    round(ctx, -104, -80, 208, 18, 6); paintIt(ctx, '#E9B872');
    ctx.beginPath(); ctx.moveTo(14, -122); ctx.lineTo(50, -122); ctx.lineTo(45, -84); ctx.lineTo(19, -84); ctx.closePath(); paintIt(ctx, '#fff');
    round(ctx, 13, -110, 38, 10, 3); paintIt(ctx, '#2F6B55', INK, 2);
    ctx.beginPath(); ctx.moveTo(26, -130); ctx.quadraticCurveTo(20, -138, 26, -146); ctx.moveTo(38, -130); ctx.quadraticCurveTo(32, -138, 38, -146); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    round(ctx, -56, -62, 112, 62, 6); paintIt(ctx, '#7A4B3A');
  }));
}

export function machineArt(res: number) {
  return stamp({ left: -14, top: -280, width: 268, height: 286 }, res, ctx => shadowed(ctx, () => {
    round(ctx, -10, -22, 250, 22, 8); paintIt(ctx, '#55665D', INK, 4);
    round(ctx, 0, -210, 230, 190, 26); paintIt(ctx, CREAM, INK, 4);
    ctx.save(); round(ctx, 0, -210, 230, 190, 26); ctx.clip(); ctx.fillStyle = '#2F6B55'; ctx.fillRect(0, -210, 230, 56); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -154); ctx.lineTo(230, -154); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    round(ctx, 0, -210, 230, 190, 26); ctx.stroke();
    ctx.save(); ctx.translate(115, -180); ctx.transform(1, 0, -0.2, 1, 0, 0); ctx.fillStyle = CREAM; ctx.font = `italic 900 22px ${houseFont()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PA CAFE', 0, 0); ctx.restore();
    round(ctx, 22, -250, 186, 42, 10); paintIt(ctx, chrome(ctx, -250, -208), INK, 4);
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(40 + i * 42, -250);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, 0); ctx.lineTo(26, -26); ctx.lineTo(4, -26); ctx.closePath(); paintIt(ctx, '#fff', INK, 4);
      ctx.restore();
    }
    ctx.save(); ctx.translate(62, -92);
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); paintIt(ctx, '#fff', INK, 5);
    const arc = (from: number, to: number, color: string) => { ctx.beginPath(); ctx.arc(0, 0, 38, from, to); ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'butt'; ctx.stroke(); };
    const deg = (value: number) => value * Math.PI / 180;
    arc(deg(150), deg(390), '#DCE6EA'); arc(deg(150), deg(240), '#6BD49A'); arc(deg(240), deg(320), GOLD); arc(deg(320), deg(390), RED);
    ctx.fillStyle = INK; ctx.font = `800 13px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BAR', 0, 30);
    ctx.restore();
    round(ctx, 124, -132, 84, 26, 8); paintIt(ctx, chrome(ctx, -132, -106), INK, 4);
    round(ctx, 136, -106, 60, 16, 5); paintIt(ctx, '#8FA0A8', INK, 4);
    round(ctx, 124, -66, 84, 40, 8); paintIt(ctx, '#DCE6EA', INK, 4);
    ctx.beginPath(); ctx.moveTo(134, -52); ctx.lineTo(198, -52); ctx.moveTo(134, -42); ctx.lineTo(198, -42); ctx.strokeStyle = '#8FA0A8'; ctx.lineWidth = 3; ctx.stroke();
  }));
}
/** Where on the machine the nozzle turns and the gauge sits, in board units from the machine's origin. */
export const MACHINE = { scale: 0.66, pivot: [232, -150], gauge: [62, -92], width: 230 } as const;

/** The steam wand, origin at its pivot, pointing along +x. */
export function nozzleArt(res: number) {
  return stamp({ left: -26, top: -26, width: 182, height: 52 }, res, ctx => {
    round(ctx, -10, -16, 150, 32, 16); paintIt(ctx, chrome(ctx, -16, 16), INK, 4);
    round(ctx, 118, -22, 34, 44, 10); paintIt(ctx, '#8FA0A8', INK, 4);
    ctx.beginPath(); ctx.arc(-4, 0, 20, 0, Math.PI * 2); paintIt(ctx, '#55665D', INK, 4);
  });
}


export function burstArt(res: number) {
  const R = 150;
  return stamp({ left: -R - 30, top: -R - 30, width: R * 2 + 60, height: R * 2 + 60 }, res, ctx => {
    ctx.beginPath();
    for (let i = 0; i < 28; i++) { const a = i * Math.PI / 14, r = i % 2 ? R * (0.52 + hash(i, 3) * 0.1) : R * (0.88 + hash(i, 4) * 0.24); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = pinkFill(ctx, -R, R); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let y = -R * 1.3; y < R * 1.3; y += 12) for (let x = -R * 1.3; x < R * 1.3; x += 12) { ctx.beginPath(); ctx.arc(x + (y / 12 % 2 ? 6 : 0), y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
    glow.addColorStop(0, '#fff'); glow.addColorStop(0.35, '#FFF2A8'); glow.addColorStop(1, 'rgba(255,200,61,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2); ctx.fill();
  });
}

export function glowArt(color: string, size = 64) {
  const image = canvas(size * 2, size * 2), ctx = image.getContext('2d')!, glow = ctx.createRadialGradient(size, size, 0, size, size, size);
  glow.addColorStop(0, color); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, size * 2, size * 2);
  return image;
}

export function coinArt(size: number) {
  const image = canvas(size, size), ctx = image.getContext('2d')!, c = size / 2, line = Math.max(2, size * 0.06);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(c, c, c - line, 0, Math.PI * 2); ctx.fillStyle = goldFill(ctx, 0, size); ctx.fill(); ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, c * 0.68, 0, Math.PI * 2); ctx.lineWidth = line * 0.7; ctx.strokeStyle = '#C98A12'; ctx.stroke();
  ctx.save(); ctx.translate(c, c); ctx.rotate(-0.5);
  ctx.beginPath(); ctx.ellipse(0, 0, c * 0.3, c * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#C98A12'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-c * 0.22, 0); ctx.quadraticCurveTo(0, -c * 0.1, c * 0.22, 0); ctx.lineWidth = line * 0.6; ctx.strokeStyle = '#FFF4A8'; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(c, c, c * 0.8, Math.PI * 1.05, Math.PI * 1.4); ctx.lineWidth = line * 0.9; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  return image;
}

export function beanArt(res: number) {
  return stamp({ left: -12, top: -10, width: 24, height: 20 }, res, ctx => {
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2); paintIt(ctx, BEAN, INK, 2.5);
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, -4, 6, 0); ctx.strokeStyle = ESPRESSO; ctx.lineWidth = 2; ctx.stroke();
  });
}



const glyphs: Record<string, readonly number[]> = {
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  K: [17, 18, 20, 24, 20, 18, 17], M: [17, 27, 21, 21, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], '.': [0, 0, 0, 0, 0, 0, 4],
};
const advance = (char: string) => char === '.' ? 3 : 6;
const dotWidth = (text: string) => [...text].reduce((sum, char) => sum + advance(char), -1);
const glyphCache = new Map<string, HTMLCanvasElement>();
function glyph(char: string, dot: number, color: string) {
  const key = `${char}|${dot}|${color}`, kept = glyphCache.get(key);
  if (kept) return kept;
  const bits = glyphs[char] ?? glyphs['.'], pad = dot, image = canvas(advance(char) * dot + pad * 2, 7 * dot + pad * 2), ctx = image.getContext('2d')!;
  const dots = (lit: boolean) => {
    ctx.beginPath();
    for (let row = 0; row < 7; row++) for (let column = 0; column < 5; column++) {
      if (Boolean(bits[row] & (16 >> column)) !== lit) continue;
      const x = pad + (char === '.' ? column - 2 : column) * dot + dot / 2;
      if (x < pad) continue;
      ctx.moveTo(x + dot * 0.4, pad + row * dot + dot / 2); ctx.arc(x, pad + row * dot + dot / 2, dot * 0.4, 0, Math.PI * 2);
    }
  };
  if (char !== '.') { dots(false); ctx.fillStyle = 'rgba(255,200,61,.07)'; ctx.fill(); }
  ctx.shadowColor = color; ctx.shadowBlur = dot * 0.9; dots(true); ctx.fillStyle = color; ctx.fill();
  glyphCache.set(key, image);
  return image;
}
/** Draws `text` centred on x with its dot rows from y to y + 7 dots. `dot` is in CSS pixels. */
export function drawDots(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dot: number, color: string, ratio: number, align: 'left' | 'center' | 'right' = 'center') {
  const pitch = Math.max(1, Math.round(dot * ratio)), width = dotWidth(text) * pitch / ratio;
  let at = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  for (const char of text) {
    const image = glyph(char, pitch, color);
    ctx.drawImage(image, at - pitch / ratio, y - pitch / ratio, image.width / ratio, image.height / ratio);
    at += advance(char) * pitch / ratio;
  }
}
