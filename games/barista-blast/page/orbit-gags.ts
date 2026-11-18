import { blastTokens, type BlastHit } from '../rules.ts';
import { CREAM, hash, INK, RED, type OrbitProps } from './art';
import { ORBIT, sceneAt } from './scenes';

/** What the camera shows at the depth these stand: metres from the middle to the edge of the screen, metres from the ground to its top, and where the run is. */
export type GagFrame = { centre: number; half: number; top: number };

const DRIFT = 0.03;
export const PAD_CYCLE = 18;
const FIRE = 5.5, RELEASE = 6.7, LIFT = 7.5, GONE = 5, BANG = 2.3, BANG_LEN = 4, REARM = 15.5, REARM_LEN = 1.6, CLOSE = 17.2, CLOSE_LEN = 0.8;
export const ROCKET = { r: 1.5, base: 1.2, body: 12, nose: 4 };
export const TOWER_H = 21, ARM_Y = 10.6, ARM_OPEN = 0.66;
const CLIMB = 1.6;

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (t: number) => { const k = clamp(t); return k * k * (3 - 2 * k); };

type PadStage = 'stand' | 'fire' | 'rise' | 'boom' | 'empty' | 'emerge';
/**
 * One pad at one moment. `arms` is 1 with the launch tower's arms closed on the rocket and 0 open; `burn` the engines'
 * strength; `rocket` how much of the rocket is out of the ground (it rises out of a silo to stand again); `lift` how
 * high it has climbed; `smoke` seconds since the engines lit, or -1; `t` seconds into the stage.
 */
type PadState = { stage: PadStage; t: number; lift: number; arms: number; burn: number; rocket: number; smoke: number; cycle: number };

/** Where pad `pad` is in its cycle at wall time `now` (ms). Every pad has its own phase, and each cycle decides afresh whether the rocket makes it. */
export function padAt(pad: number, now: number): PadState {
  const s = now / 1000 + hash(pad, 71) * PAD_CYCLE, cycle = Math.floor(s / PAD_CYCLE), t = s - cycle * PAD_CYCLE;
  const breaks = hash(cycle, pad + 72) < 0.4, smoke = t >= FIRE ? t - FIRE : -1, base = { cycle, smoke };
  if (t < FIRE) return { ...base, stage: 'stand', t, lift: 0, arms: 1, burn: 0, rocket: 1 };
  if (t < LIFT) return { ...base, stage: 'fire', t: t - FIRE, lift: 0, arms: t < RELEASE ? 1 : 1 - ease((t - RELEASE) / (LIFT - RELEASE)), burn: ease((t - FIRE) / (LIFT - FIRE)), rocket: 1 };
  const up = t - LIFT, lift = CLIMB * Math.min(up, breaks ? BANG : GONE) ** 2;
  if (breaks && up >= BANG && up < BANG + BANG_LEN) return { ...base, stage: 'boom', t: up - BANG, lift, arms: 0, burn: 0, rocket: 0 };
  if (up < (breaks ? BANG : GONE)) return { ...base, stage: 'rise', t: up, lift, arms: 0, burn: 1, rocket: 1 };
  if (t < REARM) return { ...base, stage: 'empty', t: t - LIFT, lift: 0, arms: 0, burn: 0, rocket: 0 };
  return { ...base, stage: 'emerge', t: t - REARM, lift: 0, arms: t < CLOSE ? 0 : ease((t - CLOSE) / CLOSE_LEN), burn: 0, rocket: ease((t - REARM) / REARM_LEN) };
}

/** The pads in view: which, and how many metres right of the middle of the screen each stands. */
export function padsIn({ centre, half }: GagFrame) {
  const space = Math.max(36, half * 2.3), at = centre * DRIFT, from = Math.floor((at - half - 8) / space), to = Math.ceil((at + half + 8) / space);
  return Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, u: (from + i) * space - at }));
}
export const padSize = ({ top, half }: GagFrame) => clamp(Math.min(top * 0.62 / 21, half * 2 * 0.3 / 9), 0.45, 1.5);

/** Something that crosses the sky now and then: `on` while it does, `u` metres right of the middle, `y` metres above the ground, `dir` the way it goes. */
type Pass = { on: boolean; u: number; y: number; tilt: number; dir: 1 | -1 };
const crossing = (now: number, every: number, lasts: number, long: number, seed: number, { half, top }: GagFrame, low: number, spread: number): Pass => {
  const s = now / 1000 + hash(seed, 91) * every, n = Math.floor(s / every), p = (s - n * every) / lasts, dir = hash(n, seed + 92) < 0.5 ? 1 : -1;
  const reach = half + long;
  return { on: p >= 0 && p <= 1, u: dir * (p * 2 - 1) * reach, y: top * (low + spread * hash(n, seed + 93)) + Math.sin(p * 5 + n) * top * 0.02, tilt: Math.sin(p * 3.1 + n) * 7, dir };
};
const CAR_LENGTH = 5.4;
export const SAT_COUNT = 16, SAT_GAP = 3.2;
export const carAt = (now: number, frame: GagFrame) => crossing(now, 56, 34, CAR_LENGTH * carSize(frame), 1, frame, 0.3, 0.2);
export const trainAt = (now: number, frame: GagFrame) => crossing(now, 34, 13, SAT_COUNT * SAT_GAP * satSize(frame) / 2, 2, frame, 0.58, 0.14);
export const carSize = ({ half }: GagFrame) => clamp(half * 0.08, 0.9, 2.6);
export const satSize = (frame: GagFrame) => carSize(frame) * 0.5;


const STEEL = '#DDE3EA', FIRE_ORANGE = '#FF8A2B', FIRE_YELLOW = '#FFD54A', ROCKET_RED = '#E5484D';
type Ctx = CanvasRenderingContext2D;

const inked = (ctx: Ctx, fill: string | CanvasGradient, width = 0.1) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = width; ctx.strokeStyle = INK; ctx.stroke(); };
const disc = (ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient, width = 0.1) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); inked(ctx, fill, width); };
function metres(ctx: Ctx, x: number, ground: number, unit: number, flip: number, draw: () => void) {
  ctx.save(); ctx.translate(x, ground); ctx.scale(unit * flip, -unit); ctx.lineJoin = ctx.lineCap = 'round';
  draw(); ctx.restore();
}

/**
 * A picture standing in metres, as `metres` sets them up (y up): `width` wide, centred on `x`, its foot at `bottom`, as
 * tall as its shape makes it. The pictures are drawn upright, so the y flip is undone for them.
 */
function picture(ctx: Ctx, image: HTMLImageElement, x: number, bottom: number, width: number) {
  const height = width * image.naturalHeight / image.naturalWidth;
  ctx.save(); ctx.translate(x - width / 2, bottom + height); ctx.scale(1, -1); ctx.drawImage(image, 0, 0, width, height); ctx.restore();
}
/** How the pictures sit on the pad, in metres: the tower with its beacon, the rocket from the nozzles up, and an arm from its hinge to its clamp. The rocket stands at the origin and the tower beside it to the left, its arm reaching across to close on the rocket where the booster ends, as the chopsticks do. */
const TOWER_W = 4.3, TOWER_X = -7.5, ROCKET_W = 3.1, ARM_W = 4, ARM_HINGE = 0.07, ARM_AT = 12;
function tower(ctx: Ctx, props: OrbitProps) { picture(ctx, props.tower, TOWER_X, 0, TOWER_W); }
function rocket(ctx: Ctx, props: OrbitProps) { picture(ctx, props.rocket, 0, 0, ROCKET_W); }
/** The tower's catch arm, hinged on its side and reaching right to the rocket, swinging up to let it go. `close` is 1 shut on the rocket, 0 open. */
function arm(ctx: Ctx, props: OrbitProps, close: number) {
  const height = ARM_W * props.arm.naturalHeight / props.arm.naturalWidth;
  ctx.save(); ctx.translate(TOWER_X + TOWER_W / 2 + 0.1, ARM_AT); ctx.rotate((1 - close) * ARM_OPEN);
  ctx.translate(-ARM_W * ARM_HINGE, height / 2); ctx.scale(1, -1); ctx.drawImage(props.arm, 0, 0, ARM_W, height);
  ctx.restore();
}

function flame(ctx: Ctx, strength: number, now: number) {
  if (strength <= 0.02) return;
  const long = (2.5 + 6.5 * strength) * (0.88 + 0.12 * Math.sin(now / 45)), wide = 1.3 * (0.4 + 0.6 * strength);
  for (const [k, color] of [[1, FIRE_ORANGE], [0.66, FIRE_YELLOW], [0.34, '#FFFFFF']] as const) {
    ctx.beginPath(); ctx.moveTo(-wide * k, 0); ctx.quadraticCurveTo(-wide * k * 1.15, -long * k * 0.5, 0, -long * k); ctx.quadraticCurveTo(wide * k * 1.15, -long * k * 0.5, wide * k, 0); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); if (k === 1) { ctx.lineWidth = 0.1; ctx.strokeStyle = INK; ctx.stroke(); }
  }
}

function padSmoke(ctx: Ctx, age: number) {
  if (age < 0 || age > 9) return;
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1, ring = i >> 1, k = clamp(age / 3), alpha = 0.9 * clamp(1 - (age - 3.5) / 5.5) * (age > 0.15 ? 1 : age / 0.15);
    ctx.globalAlpha = alpha * 0.8; ctx.beginPath();
    ctx.arc(side * (1.3 + ring * 1.7 + k * (1.5 + ring * 0.9)), 0.9 + ring * 0.35 + clamp(age / 8) * (1 + ring * 0.6), 1 + ring * 0.25 + k * (1.2 + ring * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = '#F4EFF8'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function breakup(ctx: Ctx, age: number, lift: number) {
  const y = ARM_AT + lift, fade = clamp(1 - (age - 2.6) / 1.4);
  ctx.globalAlpha = fade;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + hash(i, 5), reach = (1.6 + hash(i, 6) * 2) * (1.5 + age * 1.4);
    disc(ctx, Math.cos(a) * reach * 0.8, y + Math.sin(a) * reach * 0.7, (1.4 + hash(i, 7) * 1.2) * (0.6 + Math.min(age, 1.6) * 0.9), '#fff', 0.1);
  }
  ctx.globalAlpha = clamp(1 - age / 0.8);
  if (age < 0.8) { disc(ctx, 0, y, 2 + age * 9, FIRE_YELLOW, 0.12); disc(ctx, 0, y, 1 + age * 5.5, FIRE_ORANGE, 0.1); }
  ctx.globalAlpha = fade;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + hash(i, 8) * 0.6, speed = 5 + hash(i, 9) * 6, spin = (hash(i, 10) - 0.5) * 14 * age;
    ctx.save(); ctx.translate(Math.cos(a) * speed * age, y + Math.sin(a) * speed * age - 4.9 * age * age); ctx.rotate(spin);
    ctx.beginPath(); ctx.rect(-0.6, -0.35, 1.2 + hash(i, 11), 0.7); inked(ctx, i % 3 ? STEEL : ROCKET_RED, 0.09);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function wrapWords(words: string) {
  if (words.length <= 14) return [words];
  const spaces = [...words].flatMap((char, index) => char === ' ' ? [index] : []);
  if (!spaces.length) return [words];
  const at = spaces.reduce((best, each) => Math.abs(each - words.length / 2) < Math.abs(best - words.length / 2) ? each : best);
  return [words.slice(0, at), words.slice(at + 1)];
}

function disassembly(ctx: Ctx, words: string, x: number, y: number, unit: number, age: number, font: string) {
  if (age < 0.25 || age > 4) return;
  const lines = wrapWords(words), pop = ease((age - 0.25) / 0.3), size = Math.max(14, unit * (lines.length > 1 ? 1.3 : 1.5)), alpha = clamp((4 - age) / 0.6);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - unit * (1 + (age - 0.25) * 0.9)); ctx.rotate(-0.06); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
  ctx.font = `900 ${size}px ${font}`;
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + size * 1.6, tall = size * (0.9 + lines.length * 1.15), round = Math.min(tall / 2, size * 1.2);
  ctx.beginPath(); ctx.roundRect(-width / 2, -tall / 2, width, tall, round); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, index) => ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * size * 1.15 + size * 0.04, width - size));
  ctx.restore();
}

function drawPad(ctx: Ctx, props: OrbitProps, x: number, ground: number, unit: number, pad: PadState, now: number, words: string, font: string) {
  metres(ctx, x, ground, unit, 1, () => {
    tower(ctx, props);
    if (pad.rocket > 0) {
      const down = (1 - pad.rocket) * 20;
      ctx.save(); ctx.translate(0, pad.lift - down);
      if (pad.rocket > 0.01) { flame(ctx, pad.burn, now); rocket(ctx, props); }
      ctx.restore();
    }
    arm(ctx, props, pad.arms);
    padSmoke(ctx, pad.smoke);
    if (pad.stage === 'boom') breakup(ctx, pad.t, pad.lift);
  });
  if (pad.stage === 'boom') disassembly(ctx, words, x, ground - (ARM_AT + pad.lift) * unit, unit, pad.t, font);
}

/**
 * The whole of orbit's set dressing on the flat street, behind the shops: every pad in view, the car and the train of
 * satellites. `unit` is pixels to the metre at the depth they stand; (x, ground) is the middle of the screen's foot.
 */
export function drawOrbitGags(ctx: Ctx, props: OrbitProps, frame: GagFrame, now: number, middle: number, ground: number, unit: number, words: string, font: string, calm: boolean) {
  const clock = calm ? 0 : now, size = padSize(frame);
  for (const { id, u } of padsIn(frame)) drawPad(ctx, props, middle + u * unit, ground, unit * size, padAt(id, clock), clock, words, font);
  const driver = carAt(clock, frame), train = trainAt(clock, frame), big = carSize(frame), small = satSize(frame);
  if (train.on) for (let i = 0; i < SAT_COUNT; i++) {
    const along = (i - (SAT_COUNT - 1) / 2) * SAT_GAP * small * train.dir, sag = 0.012 * (along / small) ** 2 * small;
    metres(ctx, middle + (train.u + along) * unit, ground - (train.y - sag) * unit, unit * small, 1, () => picture(ctx, props.satellite, 0, -0.75, 3));
  }
  if (driver.on) {
    ctx.save(); ctx.translate(middle + driver.u * unit, ground - driver.y * unit); ctx.rotate(-driver.tilt * Math.PI / 180 * driver.dir);
    metres(ctx, 0, 0, unit * big, driver.dir, () => picture(ctx, props.car, 0, 0, 6));
    ctx.restore();
  }
}


export const CATCH_MS = 1500;
export const catchesGrok = (hit: Pick<BlastHit, 'as' | 'assist' | 'x'>) => hit.as === 'grok' && !hit.assist && sceneAt(blastTokens(hit.x)) === ORBIT;
/** Where each part of the catch is at progress `p` (0 to 1): the rocket's height above its seat, the arms, the engines, the climb, how far she has been flung (0 to 1), the clang as the arms close. */
export function catchAt(p: number) {
  const drop = p < 0.28 ? (1 - ease(p / 0.28)) * 22 : 0;
  const arms = p < 0.28 ? 0 : p < 0.4 ? ease((p - 0.28) / 0.12) : p < 0.58 ? 1 : 1 - ease((p - 0.58) / 0.1);
  const burn = p < 0.28 ? 0.5 * (1 - p / 0.28) : p < 0.45 ? 0 : p < 0.58 ? ease((p - 0.45) / 0.13) : 1;
  const lift = p > 0.62 ? ((p - 0.62) / 0.38) ** 2 * 70 : 0;
  const fling = p > 0.58 ? clamp((p - 0.58) / 0.3) ** 1.7 : 0;
  return { drop, arms, burn, lift, fling, clang: clamp(1 - Math.abs(p - 0.4) / 0.06) };
}

/**
 * The tower and its rocket for the catch, the rocket standing at (x, ground), `unit` pixels to the metre. The rocket drops in
 * beside the tower, the arm shuts on it, it lights, the arm lets go and it climbs away.
 */
export function drawCatch(ctx: Ctx, props: OrbitProps, p: number, x: number, ground: number, unit: number, now: number) {
  const at = catchAt(p);
  metres(ctx, x, ground, unit, 1, () => {
    tower(ctx, props);
    ctx.save(); ctx.translate(0, at.drop + at.lift); flame(ctx, at.burn, now); rocket(ctx, props); ctx.restore();
    arm(ctx, props, at.arms);
    if (p > 0.45 && p < 0.9) padSmoke(ctx, (p - 0.45) * 7);
    if (at.clang > 0) {
      ctx.save(); ctx.globalAlpha = at.clang; ctx.translate(0, ARM_AT);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 1.6 : 3.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); inked(ctx, FIRE_YELLOW, 0.14);
      ctx.restore();
    }
  });
}
