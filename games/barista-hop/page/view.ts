// Draws one moment of a climb on a canvas. Everything here is read from the run and the clock it is handed: it keeps
// no state of the game, only what makes it pretty (the camera, puffs, the words that float up).
import poses from '../../barista-blast/art/poses.json';
import { hopCloudX, hopSpotX, hopTuning as T, type HopEvent, type HopLook, type HopRun, type HopSpot } from '../rules.ts';
import { hopHost } from './host.ts';
import { t, type TextKey } from './i18n.ts';
import { Scenery } from './scenery.ts';

const INK = '#263F35', CREAM = '#FFF8E7', PINK = '#FF5C8A', MINT = '#6BFFD8', RED = '#E0572F', GOLD = '#FFC83D', BEAN = '#8A5A3C', ESPRESSO = '#3B2418';
type Pose = 'tumble' | 'splat' | 'cheer' | 'help' | 'hurt' | 'stand';
/** The name each look goes by on BARISTA BLAST!!'s sheet of poses. */
const sheetLook: Record<HopLook, string> = { muse: 'muse', claude: 'claude', dots: 'dots', grok: 'grok-bot', gemini: 'gemini', deepseek: 'deepseek', qwen: 'qwen', doubao: 'doubao' };
const frames = poses.frames as unknown as Record<string, [number, number, number, number]>, bodies = poses.bodies as Record<string, number>;

/** BARISTA BLAST!!'s sheet of poses, or null until it has loaded. A failed load is tried again on the next call. */
let sheet: HTMLImageElement | null = null, loading: Promise<void> | null = null;
export function loadPoses(): Promise<void> {
  if (loading) return loading;
  const image = new Image();
  image.decoding = 'async';
  image.src = hopHost().art(poses.file);
  const wait = image.decode().then(() => { sheet = image; });
  loading = wait;
  wait.catch(() => { if (loading === wait) loading = null; });
  return wait;
}

function font() { return getComputedStyle(document.documentElement).getPropertyValue('--house-font').trim() || 'system-ui, sans-serif'; }
const noise = (index: number, salt = 0) => { let value = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35); value ^= value >>> 15; value = Math.imul(value, 0x2c1b3c6d); value ^= value >>> 12; return (value >>> 0) / 4_294_967_296; };

/** The bottom of the screen before the climb: a little under the floor, so the counter she starts on is in view. */
const START = -1.6;

type Puff = { x: number; y: number; born: number; tone: string };
type Word = { x: number; y: number; born: number; key: TextKey; tone: string };
const wordOf: Partial<Record<HopEvent, [TextKey, string]>> = { toss: ['Toss!', MINT], rocket: ['Rocket!', GOLD], weak: ['Rate limited…', RED], refill: ['Refill!', PINK], pop: ['Pop!', CREAM] };

export type HopOver = { meters: number; record: boolean; reason: TextKey; hops: number; tosses: number; rockets: number; cups: number };
/** What the screen shows besides the climb. `touch` puts the cup button on screen; `over` is the card of a finished run. */
export type HopFrame = { run: HopRun; look: HopLook; lean: number; now: number; best: number; phase: 'ready' | 'climbing' | 'over'; touch: boolean; over: HopOver | null };

export class HopView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0; private height = 0; private scale = 1; private left = 0;
  /** The height at the bottom of the screen, which only ever goes up within a run. */
  private floor = START;
  private puffs: Puff[] = []; private words: Word[] = [];
  private landed = -1e9; private facing = 1;
  private readonly scenery = new Scenery(); private ratio = 1;
  /** The height of every counter this run has laid: its street stays in view after the rules have let go of its row. */
  private streets = new Set<number>();
  /** Set while the shaft is drawn in 3D on a canvas behind this one: this canvas then stays clear but for who and what is written on it. */
  bare = false;

  constructor(private readonly canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  /** Fits the canvas to its box. The shaft is a column in the middle, never wider than it is 0.62 of the height. */
  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2), box = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, box.width); this.height = Math.max(1, box.height);
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0); this.ratio = ratio;
    const shaft = Math.min(this.width, this.height * 0.62);
    this.scale = shaft / T.width; this.left = (this.width - shaft) / 2;
  }
  reset() { this.floor = START; this.streets.clear(); this.puffs = []; this.words = []; this.landed = -1e9; }

  /** Where the cup button is, for the page's pointer to hit: its middle and radius in CSS pixels. */
  cupButton() { const r = Math.min(44, this.width * 0.11); return { x: this.width / 2, y: this.height - r - 18, r }; }

  /** What a step did, so the screen can answer it. */
  feel(run: HopRun, now: number) {
    const event = run.event;
    if (!event) return;
    if (event !== 'cup' && event !== 'pop') this.landed = now;
    this.puffs.push({ x: run.x, y: run.y, born: now, tone: event === 'cup' ? BEAN : CREAM });
    const word = wordOf[event];
    if (word) this.words.push({ x: run.x, y: run.y + 2, born: now, key: word[0], tone: word[1] });
  }

  /** Where the climb was on screen in the last frame, for the 3D shaft behind: the height at the bottom edge, and pixels to the metre. */
  lens() { return { floor: this.floor, scale: this.scale }; }

  private sx(x: number) { return this.left + x * this.scale; }
  private sy(y: number) { return this.height - (y - this.floor) * this.scale; }

  draw(frame: HopFrame) {
    const { ctx, width, height, scale } = this, { run, now } = frame, shaft = T.width * scale, seen = height / scale;
    // She may fall `drop` metres before the run ends, so that much stays in view under her highest point where the screen is tall enough.
    this.floor = Math.max(this.floor, run.top - Math.min(T.drop, seen * 0.5));
    if (frame.lean) this.facing = frame.lean;

    const back = { width, height, scale, ratio: this.ratio, floor: this.floor, now, look: frame.look };
    if (this.bare) ctx.clearRect(0, 0, width, height);
    else {
      this.scenery.sky(ctx, back);
      for (const row of run.rows) if (row.spots[0]?.kind === 'counter') this.streets.add(row.y);
      for (const y of this.streets) this.scenery.street(ctx, back, y);
    }

    // Outside the shaft the place goes on, dimmed, so a wide screen is not two blank bars.
    ctx.fillStyle = this.bare ? 'rgba(38,63,53,0.14)' : 'rgba(38,63,53,0.22)';
    ctx.fillRect(0, 0, this.left, height); ctx.fillRect(this.left + shaft, 0, width - this.left - shaft, height);

    ctx.save();
    ctx.beginPath(); ctx.rect(this.left, 0, shaft, height); ctx.clip();
    this.marks(frame.best, seen);
    for (const row of run.rows) {
      if (row.y < this.floor - 3 || row.y > this.floor + seen + 3) continue;
      for (const spot of row.spots) if (!spot.gone) this.wrapped(hopSpotX(spot, run.step), spot.width / 2 + 1, x => this.spot(spot, x, row.y, now));
      if (row.cloud && !row.cloud.gone) { const cloud = row.cloud; this.wrapped(hopCloudX(cloud, run.step), 1.6, x => this.cloud(x, cloud.y, now)); }
    }
    for (const puff of this.puffs) this.wrapped(puff.x, 1.5, x => this.puff(puff, x, now));
    this.wrapped(run.x, 1.5, x => this.barista(frame, x));
    this.puffs = this.puffs.filter(puff => now - puff.born < 450);
    ctx.restore();

    ctx.strokeStyle = 'rgba(38,63,53,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.left, 0); ctx.lineTo(this.left, height); ctx.moveTo(this.left + shaft, 0); ctx.lineTo(this.left + shaft, height); ctx.stroke();

    for (const word of this.words) this.word(word, now);
    this.words = this.words.filter(word => now - word.born < 900);
    this.hud(frame);
    if (frame.phase === 'ready') this.title(frame);
    if (frame.over) this.card(frame.over, now);
  }

  /** Draws something at `x`, and again a shaft to the left or right where it hangs over an edge. */
  private wrapped(x: number, reach: number, paint: (x: number) => void) {
    paint(x);
    if (x < reach) paint(x + T.width);
    if (x > T.width - reach) paint(x - T.width);
  }

  /** A tick every ten metres up the left wall, and a dashed line where the best run so far ended. */
  private marks(best: number, seen: number) {
    const { ctx, scale } = this, shaft = T.width * scale, tone = this.scenery.dark(this.floor + seen / 2) ? '255,248,231' : '38,63,53';
    ctx.font = `600 ${Math.max(10, scale * 0.42)}px ${font()}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let mark = Math.max(10, Math.ceil(this.floor / 10) * 10); mark < this.floor + seen; mark += 10) {
      const y = this.sy(mark);
      ctx.fillStyle = `rgba(${tone},0.3)`; ctx.fillRect(this.left, y - 1, scale * 0.5, 2);
      ctx.fillStyle = `rgba(${tone},0.55)`; ctx.fillText(String(mark), this.left + scale * 0.65, y);
    }
    if (best > 0 && best > this.floor && best < this.floor + seen) {
      const y = this.sy(best);
      ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(this.left, y); ctx.lineTo(this.left + shaft, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = PINK; ctx.textAlign = 'right'; ctx.fillText(t('Best'), this.left + shaft - 8, y - scale * 0.35);
    }
  }

  /** Whoever stands on a saucer, under the sign of what she does. The saucer itself is drawn here only where the shaft is flat. */
  private spot(spot: HopSpot, x: number, y: number, now: number) {
    const { ctx, scale } = this, cx = this.sx(x), top = this.sy(y), who = spot.who;
    if (!this.bare) this.shape(spot, x, y);
    if (!who) return;
    ctx.lineWidth = Math.max(2, scale * 0.07); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    const tall = 1.55 * scale, pose: Pose = who.deed === 'weak' ? 'hurt' : who.met ? 'cheer' : 'stand';
    this.figure(who.look, pose, cx, top, tall, 1);
    // Her sign says what landing here does, before anyone lands.
    const [label, tone] = who.deed === 'toss' ? ['▲▲', MINT] : who.deed === 'rocket' ? ['▲▲▲', GOLD] : ['429', RED];
    const bob = Math.sin(now / 260 + x) * scale * 0.06, size = scale * 0.46, sign = top - tall - size * 1.1 + bob;
    ctx.font = `800 ${size}px ${font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wide = ctx.measureText(label).width + size * 0.8;
    ctx.fillStyle = tone; ctx.beginPath(); ctx.roundRect(cx - wide / 2, sign - size * 0.7, wide, size * 1.4, size * 0.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = who.deed === 'weak' ? CREAM : INK; ctx.fillText(label, cx, sign + size * 0.04);
  }

  private shape(spot: HopSpot, x: number, y: number) {
    const { ctx, scale } = this, cx = this.sx(x), top = this.sy(y), half = spot.width / 2 * scale, thick = 0.3 * scale;
    ctx.lineWidth = Math.max(2, scale * 0.07); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    if (spot.kind === 'counter') {
      // A takeaway counter: a striped awning over a wooden bar, right across the shaft.
      const bar = 0.55 * scale;
      ctx.fillStyle = BEAN; ctx.fillRect(cx - half, top, half * 2, bar); ctx.strokeRect(cx - half, top, half * 2, bar);
      ctx.fillStyle = ESPRESSO; ctx.fillRect(cx - half, top + bar * 0.68, half * 2, bar * 0.32);
      const stripe = scale * 0.5;
      for (let at = 0; at * stripe < half * 2; at++) { ctx.fillStyle = at % 2 ? CREAM : PINK; ctx.fillRect(cx - half + at * stripe, top - thick * 0.55, stripe + 1, thick * 0.55); }
      ctx.strokeRect(cx - half, top - thick * 0.55, half * 2, thick * 0.55);
      ctx.fillStyle = CREAM; ctx.font = `700 ${bar * 0.5}px ${font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t('TAKEAWAY'), cx, top + bar * 0.36);
      return;
    }
    if (spot.kind === 'foam') {
      // Milk foam: a dollop with latte art on it, gone after one step. Its dark edge tells it from the clouds behind.
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (const [dx, r] of [[-0.62, 0.3], [-0.2, 0.4], [0.25, 0.36], [0.64, 0.28]]) { ctx.moveTo(cx + dx * half + r * half, top + thick * 0.6); ctx.arc(cx + dx * half, top + thick * 0.6, r * half, 0, Math.PI * 2); }
      ctx.stroke(); ctx.fill();
      ctx.strokeStyle = BEAN; ctx.lineWidth = Math.max(1.5, scale * 0.05);
      ctx.beginPath(); ctx.arc(cx - half * 0.12, top + thick * 0.55, half * 0.16, 0.3, Math.PI * 1.7); ctx.stroke();
      return;
    }
    if (spot.kind === 'cart') {
      ctx.fillStyle = INK;
      for (const side of [-0.6, 0.6]) { ctx.beginPath(); ctx.arc(cx + side * half, top + thick * 1.25, thick * 0.42, 0, Math.PI * 2); ctx.fill(); }
    }
    // A saucer, seen a little from above: a rim and a darker foot.
    ctx.fillStyle = spot.kind === 'cart' ? MINT : CREAM;
    ctx.beginPath(); ctx.roundRect(cx - half, top, half * 2, thick, thick / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = spot.kind === 'cart' ? '#3FCFAE' : '#E9D9B8';
    ctx.beginPath(); ctx.roundRect(cx - half * 0.5, top + thick, half, thick * 0.45, thick * 0.2); ctx.fill(); ctx.stroke();
  }

  /** One pose of one look, feet at (x, y), `tall` pixels from soles to hair. A plain shape stands in until the sheet has loaded. */
  private figure(look: HopLook, pose: Pose, x: number, y: number, tall: number, facing: number, squash = 1) {
    const { ctx } = this, key = `${sheetLook[look]}/${pose}`, frame = frames[key];
    ctx.save(); ctx.translate(x, y); ctx.scale(facing, squash);
    if (sheet && frame) {
      const [sx, sy, w, h] = frame, k = pose === 'splat' ? tall * 1.3 / w : tall / (bodies[key] ?? h);
      ctx.drawImage(sheet, sx, sy, w, h, -w * k / 2, -h * k, w * k, h * k);
    } else {
      ctx.fillStyle = PINK; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-tall * 0.22, -tall, tall * 0.44, tall, tall * 0.2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  private barista(frame: HopFrame, x: number) {
    const { ctx, scale } = this, { run, now } = frame, cx = this.sx(x), feet = this.sy(run.y), tall = 1.7 * scale;
    if (run.rocket > 0) {
      // The rocket's flame, flickering under her feet.
      const flick = 0.8 + 0.4 * noise(Math.floor(now / 40));
      for (const [wide, long, tone] of [[0.42, 1.5, RED], [0.28, 1.05, GOLD], [0.14, 0.6, CREAM]] as const) {
        ctx.fillStyle = tone; ctx.beginPath(); ctx.moveTo(cx - wide * scale, feet); ctx.lineTo(cx + wide * scale, feet); ctx.lineTo(cx, feet + long * scale * flick); ctx.closePath(); ctx.fill();
      }
    }
    if (run.end === 'fell') { this.figure(frame.look, 'tumble', cx, Math.min(feet, this.height - tall * 0.2), tall * 0.85, this.facing); return; }
    // A beat of squash as she lands, then she stretches into the hop.
    const since = now - this.landed, squash = since < 140 ? 0.82 + 0.18 * since / 140 : 1;
    const pose: Pose = run.end === 'limited' ? 'hurt' : run.rocket > 0 || run.vy > 4 ? 'cheer' : run.vy < -6 ? 'help' : 'stand';
    this.figure(frame.look, pose, cx, feet, tall, this.facing, squash);
  }

  private cloud(x: number, y: number, now: number) {
    const { ctx, scale } = this, cx = this.sx(x), cy = this.sy(y), wide = T.cloudWide * scale, tall = T.cloudTall * scale;
    if (!this.bare) {
      ctx.fillStyle = '#5B5670'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, scale * 0.07);
      ctx.beginPath();
      for (const [dx, dy, r] of [[-0.55, 0.15, 0.55], [0, -0.25, 0.75], [0.55, 0.1, 0.6], [0, 0.35, 0.6]]) { ctx.moveTo(cx + dx * wide + r * tall * 1.5, cy + dy * tall); ctx.arc(cx + dx * wide, cy + dy * tall, r * tall * 1.5, 0, Math.PI * 2); }
      ctx.stroke(); ctx.fill();
    }
    ctx.fillStyle = Math.floor(now / 300) % 2 ? RED : GOLD; ctx.font = `800 ${tall * 1.1}px ${font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('429', cx, cy + tall * 0.1);
  }

  private puff(puff: Puff, x: number, now: number) {
    const { ctx, scale } = this, age = (now - puff.born) / 450;
    if (age >= 1) return;
    ctx.fillStyle = puff.tone; ctx.globalAlpha = 0.75 * (1 - age);
    for (const side of [-1, 0, 1]) { ctx.beginPath(); ctx.arc(this.sx(x) + side * (0.3 + age * 0.7) * scale, this.sy(puff.y) - age * 0.25 * scale * (side ? 1 : 1.6), (0.16 + age * 0.14) * scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  private word(word: Word, now: number) {
    const { ctx, scale } = this, age = (now - word.born) / 900;
    if (age >= 1) return;
    const cx = this.sx(word.x), y = this.sy(word.y) - age * scale * 1.4;
    ctx.globalAlpha = 1 - age * age; ctx.font = `800 ${scale * 0.7}px ${font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = scale * 0.16; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    const text = t(word.key), wide = ctx.measureText(text).width / 2 + 8, at = Math.min(this.width - wide, Math.max(wide, cx));
    ctx.strokeText(text, at, y); ctx.fillStyle = word.tone; ctx.fillText(text, at, y);
    ctx.globalAlpha = 1;
  }

  private outlined(text: string, x: number, y: number, size: number, tone: string, weight = 800) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${font()}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y); ctx.fillStyle = tone; ctx.fillText(text, x, y);
  }

  private cup(x: number, y: number, size: number, full: boolean) {
    const { ctx } = this;
    ctx.lineWidth = Math.max(2, size * 0.1); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(x + size * 0.48, y + size * 0.05, size * 0.2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = full ? CREAM : 'rgba(255,248,231,0.25)';
    ctx.beginPath(); ctx.moveTo(x - size * 0.42, y - size * 0.36); ctx.lineTo(x + size * 0.42, y - size * 0.36); ctx.lineTo(x + size * 0.3, y + size * 0.4); ctx.lineTo(x - size * 0.3, y + size * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (full) { ctx.fillStyle = BEAN; ctx.fillRect(x - size * 0.36, y - size * 0.3, size * 0.72, size * 0.16); }
  }

  private hud(frame: HopFrame) {
    const { ctx, width } = this, { run } = frame, pad = Math.max(12, this.left + 12), size = Math.min(40, width * 0.09);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    this.outlined(t('{meters} m', { meters: Math.floor(run.top) }), pad, 14, size, CREAM);
    if (frame.best > 0) this.outlined(t('Best {meters} m', { meters: frame.best }), pad, 18 + size, size * 0.42, GOLD, 700);
    const right = width - pad, cupSize = size * 0.8;
    for (let at = 0; at < T.cups; at++) this.cup(right - cupSize * 0.7 - at * cupSize * 1.25, 14 + cupSize * 0.5, cupSize, at < run.cups);
    if (frame.touch && frame.phase === 'climbing') {
      const button = this.cupButton(), ready = run.cups > 0;
      ctx.globalAlpha = ready ? 0.92 : 0.4;
      ctx.fillStyle = PINK; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(button.x, button.y, button.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      this.cup(button.x - button.r * 0.08, button.y, button.r * 0.9, ready);
      ctx.globalAlpha = 1;
    }
  }

  private title(frame: HopFrame) {
    const { ctx, width, height } = this, size = Math.min(54, width * 0.11), bob = Math.sin(frame.now / 400) * 4;
    ctx.fillStyle = 'rgba(38,63,53,0.55)'; ctx.beginPath(); ctx.roundRect(width / 2 - Math.min(width - 24, size * 8.4) / 2, height * 0.24 - size * 0.9, Math.min(width - 24, size * 8.4), size * 4.2, 20); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.outlined(t('BARISTA HOP!!'), width / 2, height * 0.24 + bob, size, PINK);
    this.outlined(t('She hops by herself. You lean her left or right.'), width / 2, height * 0.24 + size * 1.1, size * 0.34, CREAM, 700);
    this.outlined(t(frame.touch ? 'Hold a side to lean · Press the cup to drink' : '← → to lean · Space to drink a cup'), width / 2, height * 0.24 + size * 1.75, size * 0.34, CREAM, 700);
    if (Math.floor(frame.now / 600) % 2) this.outlined(t('Tap or press a key to start'), width / 2, height * 0.24 + size * 2.7, size * 0.4, GOLD);
  }

  /** The card of a finished run: how high, how it ended, and what it met on the way. */
  private card(over: HopOver, now: number) {
    const { ctx, width, height } = this, wide = Math.min(340, width - 32), tall = 300, x = (width - wide) / 2, y = (height - tall) / 2;
    ctx.fillStyle = 'rgba(38,63,53,0.45)'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, wide, tall, 22); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.font = `700 15px ${font()}`; ctx.fillText(t(over.reason), width / 2, y + 30);
    ctx.font = `600 14px ${font()}`; ctx.fillStyle = BEAN; ctx.fillText(t('You climbed'), width / 2, y + 62);
    this.outlined(t('{meters} m', { meters: over.meters }), width / 2, y + 104, 50, PINK);
    if (over.record) this.outlined(t('New record!'), width / 2, y + 146, 18, GOLD);
    const rows: [TextKey, number][] = [['Hops', over.hops], ['Tosses', over.tosses], ['Rockets', over.rockets], ['Cups drunk', over.cups]];
    ctx.font = `600 14px ${font()}`;
    rows.forEach(([key, value], at) => {
      const line = y + 176 + at * 22;
      ctx.textAlign = 'left'; ctx.fillStyle = BEAN; ctx.fillText(t(key), x + 36, line);
      ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.fillText(String(value), x + wide - 36, line);
    });
    ctx.textAlign = 'center';
    if (Math.floor(now / 600) % 2) { ctx.font = `700 15px ${font()}`; ctx.fillStyle = PINK; ctx.fillText(t('Tap to climb again'), width / 2, y + tall - 24); }
  }
}
