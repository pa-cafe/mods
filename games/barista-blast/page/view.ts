import { blastAhead, blastAim, blastPairs, blastPower, blastTokens, blastTuning, type BlastHit, type BlastKind, type BlastLook, type BlastNode, type BlastQuant, type BlastRun } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import {
  atlasLook, badOf, beanArt, burstArt, canvas as blank, CAST, CREAM, coinArt, cutinOf, orbitProps, divineAtlas, voidOf, drawFace, drawPose, drawStamp, glowArt, hash, houseFont, INK, machineArt, mailArt, MACHINE, nozzleArt, poseBox, rocketOf, UNIT, wallArt,
  type Atlas, type AtlasLook, type Stamp,
} from './art';
import { aheadOf, blastTap, type Ahead } from './ahead';
import { aimCamera, followCamera, lensOf, type Camera, type Lens, type Viewport } from './camera';
import { talkCard, wordCard, type Drawn } from './cards';
import { blastMilestones, launchCard, pick, timeoutLine } from './copy';
import type { BlastEvent } from './events';
import { drawBoost, drawCaffeine, drawHint, drawPressure, drawRefills, drawTap, drawToast, drawTopBar, hudRow, hudScale, label, squat, topBar, type BlastTap, type HudWords } from './hud';
import { assistCopy, comboCopy, hitCopy, moodOf, moodTone, nodeOf, tellsOf } from './nodes';
import { formatTokens, tokenUnit } from './numbers';
import { aimStep, holdStep, type BlastPhase } from './phase';
import { blastFace, blastPicture } from './pictures';
import { drawStandee, drawStandeeFace, portrait, standee, standeeBox } from './standee';
import { moveFor, poseAfter, type Reaction } from './react';
import { billOf, receiptArt, type Bill } from './receipt';
import { cutinPolicy } from './cutin-policy';
import { drawTour, type TourStep } from './tour';
import { drawTakeover, hurryTakeover, stageTakeover, takeoverFor, takeoverOf, type Takeover } from './takeover';
import { drawBadCut, troubleOf, type Actor, type BadCut, type Lost } from './trouble';
import type { BlastStage } from './stage';
import type { StreetView } from './street3d';
import { cloudArt, farShape, ORBIT, paintBody, rowArt, sceneAt, scenes, type Scene } from './scenes';
import { CATCH_MS, catchAt, catchesGrok, drawCatch, drawOrbitGags } from './orbit-gags';
import { drawGiant, GIANT_MS } from './voidGiant';

type Words = (key: TextKey, values?: Record<string, string | number>) => string;
/** What the page keeps between runs and the scene only reads. */
/** `runs` is how many runs this browser has finished: the button cues are for the first few. */
export type Keep = { best: number; aimHint: boolean; flyHint: boolean; runs: number };
const CUE_RUNS = 5;
const CHEER_TOKENS = 1e6, CHEER_AFTER = 700;

const DIVINE_FROM = scenes[scenes.length - 2].from, VOID_SCENE = scenes.length - 1;
const GIANT_GREY = '#8E8E89';
const LEAN_MS = 260;
const MACHINE_X = -2.75, INTERN_X = -4, BODY = 1.05 * CAST;
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
const PIVOT = { x: MACHINE_X + MACHINE.pivot[0] * MACHINE.scale / UNIT, y: -MACHINE.pivot[1] * MACHINE.scale / UNIT };
const GAUGE = { x: MACHINE_X + MACHINE.gauge[0] * MACHINE.scale / UNIT, y: -MACHINE.gauge[1] * MACHINE.scale / UNIT };
const WIPE = 650;

type Timed = { at: number };
type Card = Timed & { art: Drawn; sub: Drawn | null };
type Talk = Timed & { art: Drawn; who: Who | null; slot: number };
type Who = { look: AtlasLook; own: string | null; face: string | null };
type Pose = Parameters<typeof drawPose>[3];
/** A quantised copy stands smaller and cruder than the resident herself: how tall, and how many rows of blocks her picture is drawn from. Q8 is a slight loss, Q2 is chunky. */
const CRUDE: Record<BlastQuant, { size: number; rows: number }> = { 8: { size: 0.9, rows: 84 }, 4: { size: 0.78, rows: 44 }, 2: { size: 0.66, rows: 24 } };
const TALK_MS = 3200;
export const INTRO_MS = 1300;
type Burst = Timed & { x: number; y: number; size: number };
type Bit = Timed & { x: number; y: number; vx: number; vy: number; spin: number; life: number; bean: boolean };
type Puff = Timed & { x: number; y: number; size: number };
type Coin = Timed & { x: number; drift: number; fall: number; size: number; turn: number };
type Ghost = { x: number; y: number; angle: number };

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const CUTIN_MS = 760, CUTIN_FADE = 160;
const COIN_MS = 2100, COINS = 46;
const ASSIST_MS = 1500;
const subjectOf = (phase: BlastPhase) => phase.kind === 'aiming' || phase.kind === 'charging' ? null : phase.run;

export class BlastScene {
  atlas: Atlas | null = null;
  private view: Viewport = { width: 1, height: 1 };
  private ratio = 1;
  private res = 1;
  private camera: Camera = { scale: 40, offset: 0, anchor: 0.5 };
  private stamps = new Map<string, Stamp>();
  /** The small canvas a quantised copy is painted on before it is stretched back up. */
  private crudeSheet: HTMLCanvasElement | null = null;
  private shops = new Map<string, Stamp>();
  private sprites: { glow: HTMLCanvasElement; coin: HTMLCanvasElement; skyGlows: HTMLCanvasElement[]; clouds: HTMLCanvasElement[][]; boost: Drawn; logo: [Drawn, Drawn] } | null = null;
  private hud: HudWords;
  private shown: BlastPhase | null = null;
  private card: Card | null = null;
  private talk: Talk | null = null;
  private intro: { kind: BlastKind; tone: ReturnType<typeof moodTone>; age: number; art: Drawn; slot: number } | null = null;
  private cutin: { at: number; who: Who; partner?: Who; robed: boolean; line: string; card: Drawn; assist?: { then: string; hint: string }; rocket?: true } | null = null;
  private badCut: BadCut | null = null; private lost: Lost = { cups: 0, caffeine: 0 };
  private takeover: Takeover | null = null;
  private pictures = new Map<BlastKind, HTMLCanvasElement>();
  private faces = new Map<BlastKind, HTMLCanvasElement>();
  private bursts: Burst[] = [];
  private bits: Bit[] = [];
  private puffs: Puff[] = [];
  private coins: Coin[] = [];
  private stains: { x: number; size: number }[] = [];
  private trail: { x: number; y: number }[] = [];
  private ghostTrail: Ghost[] = [];
  private reactions = new Map<number, Reaction>();
  private signed = new Set<string>();
  /** Told each line the scene shows a resident saying (its English text), so the voice says what is on screen. */
  said: ((line: TextKey) => void) | null = null;
  private toast: Timed & { tokens: number; line: TextKey } | null = null;
  private shake: Timed & { size: number } = { at: -1e9, size: 0 };
  private leanAt = -1e9;
  private dim = 0;
  private flash: Timed & { size: number } = { at: -1e9, size: 0 };
  private cups = -1e9;
  private spin = 0;
  private lastGhost = 0;
  private rate = 0;
  private unit = '';
  private unitAt = -1e9;
  private power = 0;
  private scene = { from: 0, to: 0, at: -1e9 };
  /** Set once a 3D street is drawing behind this canvas: the 2D backdrop then stays clear. */
  bare = false;
  /** CSS pixels at the bottom of the screen that the page's own buttons take once a run ends. The receipt stays above them. */
  foot = 170;
  /** Where the world was on screen in the last frame, and which place the run is in, for that street. */
  seen: StreetView | null = null;
  private receipt: { bill: Bill; art: { image: HTMLCanvasElement; width: number; height: number } } | null = null;

  constructor(private ctx: CanvasRenderingContext2D, private words: Words, private calm: boolean, public stage: BlastStage) {
    this.hud = this.labels();
  }
  private labels(): HudWords { const words = this.words; return { best: words('Best'), burned: words('Tokens burned'), rate: words('M / S'), caffeine: words('Caffeine'), ready: words('Next hit can boost'), record: words('New record!') }; }

  /** The page's language changed: everything drawn once with words is drawn again in the new one. The run goes on as it was. */
  relabel() {
    this.hud = this.labels();
    this.stamps.clear(); this.shops.clear(); this.pictures.clear(); this.sprites = null;
    this.receipt = null;
  }

  resize(width: number, height: number, ratio: number) {
    const canvas = this.ctx.canvas;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    this.view = { width, height }; this.ratio = ratio;
    const res = clamp(aimCamera(this.view).scale * ratio / UNIT, 0.6, 2.4);
    if (Math.abs(res / this.res - 1) > 0.15) { this.res = res; this.stamps.clear(); this.shops.clear(); }
    this.sprites = null;
    if (!this.shown || this.shown.kind === 'aiming' || this.shown.kind === 'charging') this.camera = aimCamera(this.view);
  }

  launched(phase: BlastPhase, now: number) {
    if (phase.kind !== 'flying') return;
    this.power = blastPower(phase.inputs.hold);
    const tip = this.nozzleTip(phase.inputs.aim), key = launchCard(this.power), big = this.power >= 0.9;
    for (let i = 0; i < (big ? 12 : 5); i++) this.puffs.push({ at: now + i * 12, x: tip.x + (hash(i, 1) - 0.5) * 1.2, y: tip.y + (hash(i, 2) - 0.5) * 0.8, size: (big ? 0.5 : 0.3) + hash(i, 3) * 0.4 });
    if (big) { this.bursts.push({ at: now, x: tip.x, y: tip.y, size: 1.2 }); this.kick(now, 12); this.flash = { at: now, size: 0.45 }; }
    if (key) this.showCard(key, null, now);
  }

  private faceOf(kind: BlastKind) {
    let made = this.faces.get(kind) ?? null;
    if (!made) { made = blastFace(kind, 64, 2, this.atlas); if (made) this.faces.set(kind, made); }
    return made;
  }
  picture(kind: BlastKind) {
    let made = this.pictures.get(kind) ?? null;
    if (!made) { made = blastPicture(kind, 96, 2, this.atlas, this.words); if (made) this.pictures.set(kind, made); }
    return made;
  }

  /** Shows what a state that hurts does, or the takeaway window, the first time the player runs into it. The game holds the run still meanwhile. */
  introduce(node: Pick<BlastNode, 'kind' | 'mood'>) {
    const spec = nodeOf(node.kind), mood = moodOf(node), size = 17 * Math.max(hudScale(this.view), 0.85), slot = size * 3.4;
    const title = mood ? `${this.words(spec.name)} · ${this.words(mood.tag)}` : `${this.words('First time')} · ${this.words(spec.name)}`;
    this.intro = { kind: node.kind, tone: moodTone(node), age: 0, slot, art: talkCard(title, this.words(mood ? mood.tells : tellsOf(node.kind)), size, Math.min(400, this.view.width - 24), slot, this.ratio) };
  }
  hurry() { if (this.intro) this.intro.age = Math.max(this.intro.age, INTRO_MS - 180); if (this.takeover) hurryTakeover(this.takeover); }
  /** A tap cut the slow motion short: the cut-in starts its fade at game time `now`. */
  skipBeat(now: number) { if (this.cutin) this.cutin.at = Math.min(this.cutin.at, now - (this.cutin.rocket ? CATCH_MS - 520 : (this.cutin.assist ? ASSIST_MS : CUTIN_MS) - CUTIN_FADE)); }

  /** Plays what one step did. When it was one of the moments that take the whole screen, says for how many milliseconds: the game holds the run still that long. */
  react(events: readonly BlastEvent[], run: BlastRun, now: number) {
    const moment = takeoverFor(events), big = moment && cutinPolicy(`takeover:${moment}`) === 'full' ? moment : null;
    const shown = big ? takeoverOf(big) : null;
    const scene = big && big !== 'cutoff' && shown ? { actor: this.actor(atlasLook[shown]), lost: this.lost } : null;
    if (big) this.takeover = stageTakeover(big, this.view.width, this.ratio, this.words, shown ? this.picture(shown) : null, shown ? this.faceOf(shown) : null, scene);
    const trouble = big ? null : troubleOf(events), acted = trouble && trouble.as !== 'window' && cutinPolicy(`bad:${trouble.as}`) === 'full' ? trouble : null;
    if (acted && acted.as !== 'window') this.badCut = { at: now, actor: this.actor(atlasLook[acted.as]), card: wordCard(this.words(moodOf({ kind: acted.as, mood: 'bad' })!.tag), clamp(this.view.width * 0.05, 24, 44), this.ratio, 'pink', 4) };
    for (const node of blastAhead(run, 40)) if (node.kind !== 'window' && node.mood === 'bad') badOf(atlasLook[node.kind]);
    for (const event of events) {
      if (event.type === 'hit') this.hit(event.hit, event.from, event.to, run, now, big !== null || event.held === true || event.hit === acted, event.held !== true);
      else if (event.type === 'lapsed') this.hit(event.hit, event.from, event.to, run, now, big !== null || event.hit === acted);
      else if (event.type === 'boost') this.boosted(event.hit, run, now, big !== null);
      else if (event.type === 'refill') { this.cups = now; this.steam(run, now, 3); }
      else if (event.type === 'refilled') this.cups = now;
      else if (event.type === 'dive') this.steam(run, now, 2);
      else if (event.type === 'land') this.landed(event.x, event.impact, now);
      else if (event.type === 'milestone') this.toast = { at: now, tokens: event.tokens, line: blastMilestones.find(each => each.tokens === event.tokens)!.line };
      else if (event.end === 'timeout') this.say(timeoutLine, null, now);
    }
    return this.takeover && big ? this.takeover.ms : 0;
  }

  draw(phase: BlastPhase, now: number, seconds: number, keep: Keep) {
    const { ctx, view, ratio } = this;
    if (phase.kind === 'aiming' && this.shown?.kind !== 'aiming') this.reset();
    this.shown = phase;
    const run = subjectOf(phase);
    if (run) this.lost = { cups: run.refills, caffeine: run.caffeine };
    const subject = run ? { x: run.x, y: run.y, speed: Math.sqrt(run.vx * run.vx + run.vy * run.vy), aiming: false } : { x: 0, y: 0, speed: 0, aiming: true };
    this.camera = followCamera(this.camera, view, subject.aiming, seconds, subject.y);
    const lean = this.calm ? 0 : 0.1 * clamp(1 - (now - this.leanAt) / LEAN_MS) ** 2;
    const lens = lensOf(lean ? { ...this.camera, scale: this.camera.scale * (1 + lean) } : this.camera, view, subject.x);
    this.dim += (clamp((subject.speed - 14) / 30) * 0.36 - this.dim) * (1 - Math.exp(-seconds / 0.5));
    const tokens = run ? blastTokens(run.x) : 0;
    this.clock = now;
    if (tokens >= DIVINE_FROM / 4) divineAtlas();
    this.track(run, tokens, now, seconds);
    if (this.intro && (this.intro.age += seconds * 1000) > INTRO_MS) this.intro = null;
    if (this.takeover && (this.takeover.age += seconds * 1000) > this.takeover.ms) this.takeover = null;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    const blend = this.calm ? 1 : clamp((now - this.scene.at) / WIPE);
    this.backdrop(lens, blend, subject.speed);
    ctx.save();
    const shake = this.calm ? 0 : this.shake.size * clamp(1 - (now - this.shake.at) / 280) ** 2;
    if (shake) ctx.translate(Math.sin(now * 0.13) * shake, Math.cos(now * 0.17) * shake);
    this.street(phase, lens, now);
    this.flyer(phase, lens, now, phase.kind === 'result' && now - phase.at > CHEER_AFTER && (tokens >= CHEER_TOKENS || (keep.best > 0 && tokens > keep.best)));
    if (lens.left < 0.5) this.aimMarks(phase, lens, now);
    this.effects(lens, now, seconds);
    ctx.restore();
    this.overlay(phase, run, tokens, now, keep);
    if (!this.calm) { const flash = this.flash.size * clamp(1 - (now - this.flash.at) / 140); if (flash > 0) { ctx.fillStyle = `rgba(255,250,230,${flash})`; ctx.fillRect(0, 0, view.width, view.height); } }
    if (this.takeover) drawTakeover(ctx, view, this.takeover, this.calm);
    if (phase.kind === 'result') this.bill(phase, now, keep);
  }


  private reset() {
    this.card = null; this.talk = null; this.intro = null; this.takeover = null; this.cutin = null; this.badCut = null; this.bursts = []; this.bits = []; this.puffs = []; this.coins = []; this.stains = []; this.trail = []; this.ghostTrail = [];
    this.reactions.clear(); this.leanAt = -1e9; this.dim = 0; this.toast = null; this.receipt = null; this.spin = 0; this.rate = 0; this.unit = ''; this.power = 0;
    this.scene = { from: 0, to: 0, at: -1e9 };
  }

  private clock = 0;
  private giants = new Map<AtlasLook, HTMLCanvasElement>();
  private giant(base: number) {
    const looks = Object.values(atlasLook), turn = Math.floor(this.clock / GIANT_MS), look = looks[turn % looks.length];
    voidOf(looks[(turn + 1) % looks.length]);
    let tinted = this.giants.get(look) ?? null;
    if (!tinted) {
      const white = voidOf(look);
      if (!white) return;
      tinted = blank(white.naturalWidth, white.naturalHeight);
      const paint = tinted.getContext('2d')!;
      paint.drawImage(white, 0, 0); paint.globalCompositeOperation = 'source-in'; paint.fillStyle = GIANT_GREY; paint.fillRect(0, 0, tinted.width, tinted.height);
      this.giants.set(look, tinted);
    }
    drawGiant(this.ctx, tinted, this.view.width, base, this.clock, this.calm);
  }

  private kick(now: number, size: number) { if (size >= this.shake.size * clamp(1 - (now - this.shake.at) / 280)) this.shake = { at: now, size }; }

  private showCard(key: TextKey, sub: string | null, now: number) {
    const size = squat(this.view) ? clamp(this.view.height * 0.15, 40, 72) : clamp(this.view.width * 0.085, 46, 112);
    this.card = { at: now, art: wordCard(this.words(key), size, this.ratio), sub: sub ? wordCard(sub, size * 0.38, this.ratio, 'pink') : null };
  }

  flying: BlastLook | null = null;
  tour: TourStep | null = null; touring = false;
  private get pilot(): Who { return this.flying ? { look: atlasLook[this.flying], own: null, face: null } : { look: this.stage.flyer, own: this.stage.flyerArt, face: this.stage.flyerFace }; }
  private resident(look: AtlasLook): Who { return { look, own: null, face: null }; }
  private actor(look: AtlasLook): Actor {
    return (ctx, x, y, tall) => {
      const picture = badOf(look);
      if (picture) { const high = tall * 1.25, across = high * picture.naturalWidth / picture.naturalHeight; ctx.drawImage(picture, x - across / 2, y - high, across, high); return; }
      if (this.atlas) drawPose(ctx, this.atlas, look, 'hurt', x, y, tall / poseBox(look, 'hurt', 1).height, true);
    };
  }
  private pose(who: Who, pose: Pose, x: number, y: number, scale: number, standing = false, robed = false) {
    const own = standee(who.own);
    if (own) drawStandee(this.ctx, own, pose, x, y, scale, standing);
    else if (this.atlas) drawPose(this.ctx, this.atlas, who.look, pose, x, y, scale, standing, robed ? divineAtlas() : null);
  }
  private poseBox(who: Who, pose: Pose, scale: number, robed = false) { const own = standee(who.own); return own ? standeeBox(own, pose, scale) : poseBox(who.look, pose, scale, robed && divineAtlas() !== null); }
  private face(who: Who, x: number, y: number, r: number) {
    const { ctx } = this, shot = portrait(who.face), own = shot ? null : standee(who.own);
    ctx.save(); ctx.clip();
    if (shot) ctx.drawImage(shot, x - r, y - r, r * 2, r * 2);
    else if (own) drawStandeeFace(ctx, own, x, y, r);
    else if (this.atlas) drawFace(ctx, this.atlas, who.look, x, y, r);
    ctx.restore();
  }
  private nameOf(kind: BlastKind, cast?: number) { return (cast === undefined ? null : this.stage.names[cast]) ?? this.words(nodeOf(kind).name as TextKey); }

  private say(key: TextKey, speaker: BlastKind | null, now: number, cast?: number) {
    const k = hudScale(this.view), size = 19 * Math.max(k, 0.85), spec = speaker ? nodeOf(speaker) : null;
    const look = spec && 'look' in spec.art ? atlasLook[spec.art.look] : null, slot = look ? size * 3.1 : 0;
    const width = Math.min(380, this.view.width * 0.64);
    this.talk = { at: now, who: look ? this.resident(look) : null, slot, art: talkCard(speaker ? this.nameOf(speaker, cast) : '', this.words(key), size, width, slot, this.ratio) };
  }

  private hit(hit: BlastHit, from: number, to: number, run: BlastRun, now: number, quiet: boolean, landed = true) {
    const { card, lines } = hitCopy(hit, run.pilot), struck = landed && !hit.waived && moodTone({ kind: hit.as, mood: hit.mood }) !== 'open';
    const acted = moveFor(hit, landed);
    this.reactions.set(hit.x, { at: now, boost: false, ...(acted ? { pose: acted } : {}) });
    if (landed) this.leanAt = now;
    const x = run.x, y = run.y + BODY;
    if (struck) {
      this.bursts.push({ at: now, x, y, size: 1 });
      for (let i = 0; i < 12; i++) { const angle = hash(i, now) * Math.PI * 2, speed = 4 + hash(i, now + 1) * 7; this.bits.push({ at: now, x, y, vx: Math.cos(angle) * speed + run.vx * 0.2, vy: Math.sin(angle) * speed + 3, spin: (hash(i, 9) - 0.5) * 20, life: 700, bean: true }); }
      this.kick(now, 6);
    }
    const ratio = from > 0.5 ? to / from : 0;
    const gain = ratio >= 1.05 ? `×${ratio.toFixed(1)}` : null, first = run.hits[run.hits.length - 2];
    if (hit.combo && first && first.as !== 'window' && hit.as !== 'window' && !quiet) {
      const copy = comboCopy[hit.combo];
      this.said?.(copy.line);
      if (cutinPolicy(`combo:${hit.combo}`) === 'badge') { this.showCard(copy.card, gain, now); this.say(copy.line, hit.as, now); return; }
      this.cutin = { at: now, who: this.resident(atlasLook[first.as]), partner: this.resident(atlasLook[hit.as]), robed: blastTokens(hit.x) >= DIVINE_FROM, line: this.words(copy.line), card: wordCard(`${this.words(copy.card)}${gain ? ` ${gain}` : ''}`, clamp(this.view.width * 0.05, 24, 44), this.ratio, 'gold', -4) };
      return;
    }
    const next = hit.as !== 'window' ? blastAhead(run, 25).find(node => node.kind !== 'window') : undefined;
    if (next && next.kind !== 'window' && hit.as !== 'window' && blastPairs.some(pair => pair === `${hit.as}+${next.kind}` || pair === `${next.kind}+${hit.as}`)) { const robed = blastTokens(next.x) >= DIVINE_FROM; cutinOf(atlasLook[hit.as], robed); cutinOf(atlasLook[next.kind], robed); }
    if (card && !quiet) this.showCard(card, hit.dive ? [this.words('Dive hit!'), gain].filter(Boolean).join(' ') : gain, now);
    if (lines.length) {
      const line = this.lineOf(hit.as, card, lines);
      this.say(line, hit.as, now, hit.as === hit.kind ? hit.cast : undefined);
      if (landed) this.said?.(line);
    }
  }

  private lineOf(who: BlastKind, card: TextKey, lines: readonly TextKey[]) {
    const key = `${who}:${card}`;
    if (this.signed.has(key)) return pick(lines);
    this.signed.add(key);
    return lines[0];
  }

  private boosted(hit: BlastHit, run: BlastRun, now: number, quiet: boolean) {
    const { card, lines } = hitCopy(hit);
    this.reactions.set(hit.x, { at: now, boost: true });
    this.bursts.push({ at: now, x: run.x, y: run.y + BODY, size: 1.35 });
    this.kick(now, 11); this.flash = { at: now, size: 0.35 };
    const line = lines.length ? this.lineOf(hit.as, card, lines) : null, cast = hit.as === hit.kind ? hit.cast : undefined;
    if (line) this.said?.(line);
    const robed = blastTokens(hit.x) >= DIVINE_FROM;
    if (hit.as === 'grok') this.rain(now);
    const rocket = catchesGrok(hit) && orbitProps() !== null;
    const full = cutinPolicy(rocket ? 'boost:grok:rocket' : `boost:${hit.as}`) === 'full';
    if (hit.assist && line && !quiet && hit.as !== 'window' && full) {
      const own = hitCopy({ ...hit, kind: hit.assist, as: hit.assist, mood: 'one', outcome: 'boost' }).lines;
      this.cutin = { at: now, who: this.pilot, partner: this.resident(atlasLook[hit.as]), robed, line: this.words(own.length ? pick(own) : line), card: wordCard(this.words('Combo!'), clamp(this.view.width * 0.05, 24, 44), this.ratio, 'gold', -4), assist: { then: this.words(line), hint: this.words(assistCopy[hit.assist]) } };
      return;
    }
    if (line && !quiet && hit.as !== 'window' && full) this.cutin = { at: now, who: this.resident(atlasLook[hit.as]), robed, line: this.words(line), card: wordCard(this.words(card), clamp(this.view.width * 0.05, 24, 44), this.ratio, 'gold', -4), ...(rocket ? { rocket: true as const } : {}) };
    else { if (card && !quiet) this.showCard(card, null, now); if (line) this.say(line, hit.as, now, cast); }
  }

  private rain(now: number) {
    if (this.calm) return;
    this.coins = Array.from({ length: COINS }, (_, i) => ({ at: now + hash(i, 5) * 520, x: hash(i, 6), drift: (hash(i, 7) - 0.5) * 0.16, fall: 0.22 + hash(i, 8) * 0.2, size: 0.75 + hash(i, 9) * 0.7, turn: 6 + hash(i, 10) * 8 }));
  }

  private landed(x: number, impact: number, now: number) {
    if (impact < 3) return;
    const size = clamp(impact / 14, 0.4, 1.4);
    this.stains = [...this.stains.slice(-15), { x, size }];
    for (let i = 0; i < 7; i++) { const angle = Math.PI * (0.15 + 0.7 * hash(i, now)); this.bits.push({ at: now, x, y: 0.1, vx: Math.cos(angle) * 5 * size, vy: Math.sin(angle) * 6 * size, spin: 0, life: 450, bean: false }); }
    if (impact > 10) this.kick(now, 3);
  }

  private steam(run: BlastRun, now: number, count: number) {
    for (let i = 0; i < count; i++) this.puffs.push({ at: now + i * 30, x: run.x - 0.4 - i * 0.3, y: run.y + BODY - 0.3, size: 0.35 });
  }

  private track(run: BlastRun | null, tokens: number, now: number, seconds: number) {
    if (!run) return;
    const robed = blastTokens(run.x) >= DIVINE_FROM;
    if (run.pilot && (run.boost ? run.boost.hit.as !== 'window' : run.caffeine >= blastTuning.caffeine)) cutinOf(atlasLook[run.pilot], robed);
    if (run.boost ? run.boost.hit.as !== 'window' : run.caffeine >= blastTuning.caffeine) for (const node of run.boost ? [{ kind: run.boost.hit.as }] : blastAhead(run, 60)) if (node.kind !== 'window') { cutinOf(atlasLook[node.kind], robed); if (node.kind === 'grok' && !robed && tokens >= scenes[ORBIT].from / 4) rocketOf(atlasLook.grok); }
    // Orbit's set dressing is fetched a stage early, so the pad is standing when the street gets there.
    if (tokens >= scenes[ORBIT].from / 4) orbitProps();
    const moving = !run.end && !run.frozen && !run.sliding, pace = run.boost ? blastTuning.boostSlow : 1, speed = Math.sqrt(run.vx * run.vx + run.vy * run.vy);
    if (moving) this.spin += Math.min(14, 3 + speed * 0.25) * seconds * pace;
    const last = this.trail.at(-1);
    if (!run.end && (!last || run.x - last.x > 0.3 || Math.abs(run.y - last.y) > 0.6)) this.trail.push({ x: run.x, y: run.y + BODY });
    if (moving && speed > 22 && now - this.lastGhost > 45) { this.ghostTrail = [...this.ghostTrail.slice(-5), { x: run.x, y: run.y + BODY, angle: this.spin }]; this.lastGhost = now; }
    if (!moving && run.end) this.ghostTrail = [];
    const target = sceneAt(tokens);
    if (target !== this.scene.to) this.scene = { from: this.scene.to, to: target, at: now };
    const rate = run.end ? 0 : speed * pace;
    this.rate += (rate - this.rate) * (1 - Math.exp(-seconds / 0.25));
    const unit = tokenUnit(tokens);
    if (unit !== this.unit) { if (this.unit !== '' || unit === 'K') this.unitAt = now; this.unit = unit; }
  }


  private stampFor(name: string, build: () => Stamp) { let made = this.stamps.get(name); if (!made) { made = build(); this.stamps.set(name, made); } return made; }

  private spritesNow() {
    if (!this.sprites) {
      const k = hudScale(this.view);
      this.sprites = {
        glow: glowArt('rgba(255,200,61,.9)'),
        coin: coinArt(Math.round(64 * this.ratio)),
        skyGlows: scenes.map(scene => glowArt(scene.glow, 96)),
        clouds: scenes.map(scene => cloudArt(scene)),
        boost: wordCard(this.words('Boost!'), 52 * Math.max(k, 0.8), this.ratio, 'gold', -6),
        logo: [wordCard('BARISTA', clamp(this.view.width * 0.11, 40, 64), this.ratio, 'gold', -4), wordCard('BLAST!!', clamp(this.view.width * 0.14, 50, 82), this.ratio, 'pink', -4)],
      };
    }
    return this.sprites;
  }

  private backdrop(lens: Lens, blend: number, speed: number) {
    const { ctx, view } = this, base = lens.ground - 0.3 * lens.scale;
    const wiping = this.scene.from !== this.scene.to && blend < 1, slant = view.height * 0.35, edge = (view.width + slant) * (1 - easeOut(blend)) - slant;
    this.seen = { lens, from: this.scene.from, to: this.scene.to, wipe: wiping ? { top: edge + slant, bottom: edge } : null, machine: { power: 0, shake: 0 }, props: [], disassembly: this.words('Rapid unscheduled disassembly') };
    if (!wiping) { if (!this.bare) this.paintScene(this.scene.to, lens, base); }
    else {
      if (!this.bare) {
        this.paintScene(this.scene.from, lens, base);
        ctx.save(); ctx.beginPath(); ctx.moveTo(edge + slant, 0); ctx.lineTo(view.width, 0); ctx.lineTo(view.width, view.height); ctx.lineTo(edge, view.height); ctx.clip();
        this.paintScene(this.scene.to, lens, base);
        ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(edge + slant, 0); ctx.lineTo(edge, view.height); ctx.strokeStyle = CREAM; ctx.lineWidth = 10; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (this.dim > 0.01) { ctx.fillStyle = `rgba(26,20,44,${this.dim})`; ctx.fillRect(0, 0, view.width, base); }
    if (!wiping && this.scene.to === VOID_SCENE) this.giant(base);
    if (speed > 30 && !this.calm) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 18; i++) {
        const width = 80 + hash(i, 21) * 260, x = ((hash(i, 22) * view.width * 2 - lens.left * lens.scale * 1.6) % (view.width * 2) + view.width * 2) % (view.width * 2) - width;
        ctx.globalAlpha = clamp((speed - 30) / 40) * (0.12 + hash(i, 23) * 0.25); ctx.fillRect(x, hash(i, 24) * base * 0.95, width, 1.5 + hash(i, 25) * 2.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  private paintScene(index: number, lens: Lens, base: number) {
    const { ctx, view } = this, scene = scenes[index];
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(base, 1));
    scene.sky.forEach((color, at) => sky.addColorStop(at / (scene.sky.length - 1), color));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, view.width, view.height);
    this.skyDetail(scene, index, base, lens); this.far(scene, lens, base);
    if (index === ORBIT) this.orbitGags(lens, base);
    this.row(scene, index, lens, base); this.ground(scene, lens, base);
  }

  private orbitGags(lens: Lens, base: number) {
    const unit = lens.scale * 0.6, { width } = this.view, props = orbitProps();
    if (props) drawOrbitGags(this.ctx, props, { centre: lens.left + width / (2 * lens.scale), half: width / (2 * unit), top: base / unit }, performance.now(), width / 2, base, unit, this.words('Rapid unscheduled disassembly'), houseFont(), this.calm);
  }

  private skyDetail(scene: Scene, index: number, base: number, lens: Lens) {
    const { ctx, view } = this, sprites = this.spritesNow(), size = Math.min(view.width, view.height);
    if (scene.stars) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 70; i++) { const z = hash(i, 31); ctx.globalAlpha = scene.stars * (0.35 + z * 0.6); ctx.fillRect(hash(i, 32) * view.width, hash(i, 33) * base * 0.8, z * 1.6 + 0.6, z * 1.6 + 0.6); }
      ctx.globalAlpha = 1;
    }
    const bodyX = view.width * 0.78, bodyY = base * scene.bodyAt;
    ctx.drawImage(sprites.skyGlows[index], bodyX - size * 0.4, bodyY - size * 0.4, size * 0.8, size * 0.8);
    paintBody(ctx, scene, bodyX, bodyY, size * 0.07);
    const clouds = sprites.clouds[index], span = view.width * 1.6;
    for (let i = 0; i < 5; i++) {
      const cloud = clouds[i % clouds.length];
      const k = (0.6 + hash(i, 41) * 0.9) * Math.max(0.6, size / 720), x = ((hash(i, 42) * span - lens.left * lens.scale * 0.04) % span + span) % span - view.width * 0.3;
      ctx.globalAlpha = 0.5 + hash(i, 43) * 0.4; ctx.drawImage(cloud, x, base * (0.08 + hash(i, 44) * 0.42), cloud.width * k, cloud.height * k);
    }
    ctx.globalAlpha = 1;
  }

  private far(scene: Scene, lens: Lens, base: number) {
    const { ctx, view } = this, s = lens.scale * 0.75, shift = lens.left * 0.2, first = Math.floor(shift / 1.5) - 2, last = Math.ceil((shift + view.width / s) / 1.5) + 1;
    ctx.save(); ctx.globalAlpha = scene.far.alpha; ctx.fillStyle = scene.far.color; ctx.beginPath();
    for (let i = first; i <= last; i++) farShape(ctx, scene.far.shape, i, (i * 1.5 - shift) * s, base, s);
    ctx.fill(); ctx.restore();
    const lights = scene.far.lights;
    if (lights) {
      for (let i = first; i <= last; i++) for (let j = 0; j < 3; j++) {
        if (hash(i * 3 + j, 54) < 0.5) continue;
        ctx.fillStyle = lights[hash(i * 3 + j, 55) > 0.5 ? 0 : 1];
        ctx.fillRect((i * 1.5 - shift + 0.15 + hash(i * 3 + j, 56) * 0.5) * s, base - (0.4 + hash(i * 3 + j, 57) * 1.6) * s, 0.07 * s, 0.08 * s);
      }
    }
  }

  private row(scene: Scene, index: number, lens: Lens, base: number) {
    const s = lens.scale * 0.95, shift = lens.left * 0.5, slot = 3.4, first = Math.floor(shift / slot) - 1, last = Math.ceil((shift + this.view.width / s) / slot);
    for (let i = first; i <= last; i++) {
      const kind = Math.floor(hash(i, 61) * scene.row.length), key = `${index}/${kind}`;
      let art = this.shops.get(key);
      if (!art) { art = rowArt(scene, kind, this.res); this.shops.set(key, art); }
      drawStamp(this.ctx, art, (i * slot - shift) * s, base, s);
    }
  }

  private ground(scene: Scene, lens: Lens, base: number) {
    const { ctx, view } = this, curb = lens.ground + 0.45 * lens.scale;
    if (base > view.height) return;
    ctx.fillStyle = scene.walk; ctx.fillRect(0, base, view.width, curb - base);
    ctx.fillStyle = scene.walkEdge; ctx.fillRect(0, curb, view.width, 7);
    ctx.fillStyle = scene.road; ctx.fillRect(0, curb + 7, view.width, view.height - curb);
    const lane = curb + 7 + Math.max(16, 0.9 * lens.scale), period = 1.9, length = 1.1, thick = Math.max(5, 0.11 * lens.scale);
    ctx.fillStyle = scene.lane; ctx.globalAlpha = 0.9;
    for (let x = Math.floor(lens.left / period) * period; (x - lens.left) * lens.scale < view.width + 40; x += period) {
      const left = (x - lens.left) * lens.scale;
      ctx.beginPath();
      if (scene.laneShape === 'bean') ctx.ellipse(left + thick * 2, lane + thick, thick * 1.6, thick * 0.9, -0.3, 0, Math.PI * 2);
      else { ctx.moveTo(left, lane); ctx.lineTo(left + length * lens.scale, lane); ctx.lineTo(left + length * lens.scale - thick * 0.5, lane + thick); ctx.lineTo(left - thick * 0.5, lane + thick); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private visibleNodes(run: BlastRun, lens: Lens) {
    const right = lens.left + this.view.width / lens.scale;
    blastAhead(run, Math.max(0, right + 6 - run.x));
    const { firstCell, cell } = blastTuning, nodes: BlastNode[] = [];
    for (let index = Math.max(0, Math.floor((lens.left - 6 - firstCell) / cell)); index < run.cells.length && firstCell + cell * index <= right + 6; index++) {
      const node = run.cells[index];
      if (node) nodes.push(node);
    }
    return nodes;
  }

  private street(phase: BlastPhase, lens: Lens, now: number) {
    const { ctx } = this, x = (meters: number) => (meters - lens.left) * lens.scale, y = (meters: number) => lens.ground - meters * lens.scale;
    for (const stain of this.stains) { ctx.beginPath(); ctx.ellipse(x(stain.x), y(0) + 4, 0.55 * stain.size * lens.scale, 0.12 * stain.size * lens.scale, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(59,36,24,.55)'; ctx.fill(); }
    if (lens.left < 0.5) this.machine(phase, lens, now);
    const run = phase.kind === 'aiming' || phase.kind === 'charging' ? phase.street : phase.run;
    for (const node of this.visibleNodes(run, lens)) this.node(node, x(node.x), lens, now);
    if (this.trail.length > 1) this.paper(lens);
  }

  private shadow(x: number, ground: number, width: number, alpha = 0.3) {
    const tall = Math.max(3, width * 0.16);
    this.ctx.beginPath(); this.ctx.ellipse(x, ground - tall * 0.35, width, tall, 0, 0, Math.PI * 2); this.ctx.fillStyle = `rgba(42,27,58,${alpha})`; this.ctx.fill();
  }

  private node(node: BlastNode, left: number, lens: Lens, now: number) {
    const { ctx } = this, spec = nodeOf(node.kind), reaction = this.reactions.get(node.x), since = reaction ? (now - reaction.at) / 1000 : 9;
    const squash = since < 0.7 ? 1 - 0.24 * Math.exp(-since * 6) * Math.cos(since * 26) : 1, ground = lens.ground, s = lens.scale;
    ctx.save(); ctx.translate(left, ground);
    if ('look' in spec.art) {
      const who = this.resident(atlasLook[spec.art.look]), pose = poseAfter(reaction, since), mood = moodOf(node)!, tone = moodTone(node);
      const behind = node.kind === 'dots' && node.mood === 'bad' ? 'wall' : node.kind === 'claude' && node.mood === 'bad' ? 'mail' : null;
      const reset = behind === 'wall' && reaction?.boost === true;
      if (behind && this.bare && this.seen) this.seen.props.push({ kind: behind, x: node.x + 0.5, squash: 1, sign: this.words(behind === 'wall' ? reset ? 'LIMITS RESET' : 'AT CAPACITY' : 'BANNED'), ...(reset ? { reset } : {}) });
      else if (behind === 'wall') drawStamp(ctx, this.stampFor(reset ? 'wall-reset' : 'wall', () => wallArt(this.res, this.words(reset ? 'LIMITS RESET' : 'AT CAPACITY'), reset)), 0.5 * s, 0, s);
      else if (behind === 'mail') drawStamp(ctx, this.stampFor('letter', () => mailArt(this.res, this.words('BANNED'))), 0.5 * s, 0, s);
      this.shadow(0, 0, 0.55 * s);
      const robed = blastTokens(node.x) >= DIVINE_FROM;
      // A copy that has a quantisation (a run of the current rules) is drawn smaller and blockier the lower it is.
      const quant = node.quant;
      ctx.scale(1 / squash, squash); if (quant) this.crude(who, pose, s, robed, quant); else this.pose(who, pose, 0, 0, s, true, robed); ctx.scale(squash, 1 / squash);
      this.nameTag(node.copy ? this.words('A fine-tune') : this.nameOf(node.kind, node.cast), lens);
      if (!node.done) {
        const top = -this.poseBox(who, 'stand', s * (quant ? CRUDE[quant].size : 1), robed).height - 0.12 * s;
        this.sign(this.words(mood.tag), tone, top, lens);
        if (quant) this.chip(`Q${quant}`, top - clamp(lens.scale * 0.27, 13, 20) * 1.75 - 7, lens);
      }
    } else if (node.kind === 'window' && this.bare && this.seen) {
      this.seen.props.push({ kind: 'window', x: node.x, squash });
    } else {
      const art = this.stampFor(node.kind, () => (spec.art as { prop: (res: number, words: Words) => Stamp }).prop(this.res, this.words));
      this.shadow(0, 0, 0.7 * s, 0.22);
      ctx.scale(1 / squash, squash);
      drawStamp(ctx, art, 0, 0, s);
    }
    ctx.restore();
  }

  /**
   * A quantised copy: her pose at the tier's size, painted on a small canvas and stretched back up with no smoothing, so
   * the picture shows its blocks. Soles at the origin.
   */
  private crude(who: Who, pose: Pose, scale: number, robed: boolean, quant: BlastQuant) {
    if (!this.atlas) return;
    const { ctx } = this, { size, rows } = CRUDE[quant], box = this.poseBox(who, pose, scale * size, robed), block = box.height / rows, wide = Math.ceil(box.width / block);
    const sheet = this.crudeSheet ??= blank(wide, rows);
    if (sheet.width < wide || sheet.height < rows) { sheet.width = Math.max(sheet.width, wide); sheet.height = Math.max(sheet.height, rows); }
    const pen = sheet.getContext('2d')!;
    pen.clearRect(0, 0, sheet.width, sheet.height);
    drawPose(pen, this.atlas, who.look, pose, wide / 2, rows, scale * size / block, true, robed ? divineAtlas() : null);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, 0, 0, wide, rows, -wide * block / 2, -box.height, wide * block, box.height);
    ctx.imageSmoothingEnabled = true;
  }

  /** The small tag over a copy's sign that says how far she was quantised. Its bottom edge is at `y`. */
  private chip(text: string, y: number, lens: Lens) {
    const { ctx } = this, size = clamp(lens.scale * 0.2, 11, 15);
    ctx.font = `900 ${size}px ${houseFont()}`;
    const width = ctx.measureText(text).width + size * 1.1, tall = size * 1.6;
    ctx.beginPath(); ctx.roundRect(-width / 2, y - tall, width, tall, tall / 2);
    ctx.fillStyle = '#FFC83D'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    label(ctx, text, 0, y - tall / 2 + 0.5, size, INK, 'center', 900);
  }


  private sign(text: string, tone: ReturnType<typeof moodTone>, y: number, lens: Lens) {
    const { ctx } = this, size = clamp(lens.scale * 0.27, 13, 20), ink = tone === 'bad' ? '#fff' : tone === 'good' ? '#0F5B36' : '#5E5344';
    ctx.font = `900 ${size}px ${houseFont()}`;
    const width = ctx.measureText(text).width + size * 1.5, tall = size * 1.75;
    ctx.beginPath(); ctx.roundRect(-width / 2, y - tall, width, tall, tall / 2);
    ctx.fillStyle = tone === 'bad' ? '#E5484D' : tone === 'good' ? '#C9F2D9' : '#EFE6D2'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, y - 1); ctx.lineTo(0, y + 6); ctx.lineTo(5, y - 1); ctx.closePath(); ctx.fillStyle = ctx.strokeStyle = INK; ctx.fill();
    label(ctx, text, 0, y - tall / 2 + 0.5, size, ink, 'center', 900);
  }

  private nameTag(name: string, lens: Lens) {
    const { ctx } = this, size = clamp(lens.scale * 0.17, 10, 14);
    ctx.font = `800 ${size}px ${houseFont()}`;
    const width = ctx.measureText(name).width + size * 1.6, y = 0.12 * lens.scale;
    ctx.beginPath(); ctx.roundRect(-width / 2, y, width, size * 1.8, size * 0.9); ctx.fillStyle = INK; ctx.fill();
    label(ctx, name, 0, y + size * 0.92, size, CREAM);
  }

  private nozzleTip(aim: number) {
    const [dx, dy] = blastAim(aim), length = 150 * MACHINE.scale / UNIT;
    return { x: PIVOT.x + dx * length, y: PIVOT.y + dy * length };
  }

  private machine(phase: BlastPhase, lens: Lens, now: number) {
    const { ctx } = this, x = (meters: number) => (meters - lens.left) * lens.scale, y = (meters: number) => lens.ground - meters * lens.scale, s = lens.scale;
    const aiming = phase.kind === 'aiming' || phase.kind === 'charging';
    const aim = aiming ? aimStep(phase, now) : phase.inputs.aim, [dx, dy] = blastAim(aim);
    const power = phase.kind === 'charging' ? blastPower(holdStep(phase, now)) : aiming ? 0 : this.power * clamp(1 - (now - (phase.kind === 'flying' ? phase.origin : phase.at)) / 1500);
    this.shadow(x(INTERN_X), y(0), 0.55 * s); this.pose({ look: this.stage.operator, own: this.stage.operatorArt, face: null }, 'stand', x(INTERN_X), y(0), s, true);
    const tremble = phase.kind === 'charging' ? (Math.sin(now * 0.9) * power * 0.03) * s : 0;
    if (this.seen) this.seen.machine = { power, shake: tremble / s };
    if (!this.bare) {
      const body = this.stampFor('machine', () => machineArt(this.res)), nozzle = this.stampFor('nozzle', () => nozzleArt(this.res));
      this.shadow(x(MACHINE_X + 1.2), y(0), 1.3 * s, 0.25);
      drawStamp(ctx, body, x(MACHINE_X) + tremble, y(0), s * MACHINE.scale);
      const needle = (-210 + power * 240) * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(x(GAUGE.x) + tremble, y(GAUGE.y)); ctx.lineTo(x(GAUGE.x) + tremble + Math.cos(needle) * 0.34 * s, y(GAUGE.y) + Math.sin(needle) * 0.34 * s);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, 0.07 * s); ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x(GAUGE.x) + tremble, y(GAUGE.y), 0.07 * s, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.save(); ctx.translate(x(PIVOT.x) + tremble, y(PIVOT.y)); ctx.rotate(-Math.atan2(dy, dx)); drawStamp(ctx, nozzle, 0, 0, s * MACHINE.scale); ctx.restore();
    }
  }

  private aimMarks(phase: BlastPhase, lens: Lens, now: number) {
    if (phase.kind !== 'aiming' && phase.kind !== 'charging') return;
    const { ctx } = this, x = (meters: number) => (meters - lens.left) * lens.scale, y = (meters: number) => lens.ground - meters * lens.scale, s = lens.scale;
    const aim = aimStep(phase, now), [dx, dy] = blastAim(aim);
    for (let degrees = 15; degrees <= 75; degrees += 10) {
      const angle = degrees * Math.PI / 180, current = Math.abs(Math.atan2(dy, dx) - angle) < 5 * Math.PI / 180;
      ctx.beginPath(); ctx.arc(x(PIVOT.x + Math.cos(angle) * 2.3), y(PIVOT.y + Math.sin(angle) * 2.3), (current ? 0.12 : 0.07) * s, 0, Math.PI * 2);
      ctx.fillStyle = current ? '#FFC83D' : '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    }
    const tip = this.nozzleTip(aim);
    ctx.beginPath(); ctx.moveTo(x(tip.x), y(tip.y)); ctx.lineTo(x(tip.x + dx * 1.6), y(tip.y + dy * 1.6));
    ctx.setLineDash([3, 13]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke(); ctx.setLineDash([]);
  }

  private paper(lens: Lens) {
    const { ctx } = this, left = lens.left - 2, right = lens.left + this.view.width / lens.scale + 2;
    let from = 0, to = this.trail.length;
    while (from < to) { const middle = (from + to) >> 1; if (this.trail[middle].x < left) from = middle + 1; else to = middle; }
    const points = this.trail.slice(Math.max(0, from - 1)).filter(point => point.x <= right);
    if (points.length < 2) return;
    const width = Math.max(6, 0.22 * lens.scale);
    ctx.beginPath();
    points.forEach((point, index) => { const px = (point.x - lens.left) * lens.scale, py = lens.ground - point.y * lens.scale; if (index) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = width + 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = width; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.setLineDash([7, 5, 3, 5]); ctx.lineWidth = 2; ctx.strokeStyle = '#B9A88C'; ctx.stroke(); ctx.setLineDash([]);
  }

  private flyer(phase: BlastPhase, lens: Lens, now: number, cheer: boolean) {
    const { ctx, atlas } = this;
    if (!atlas) return;
    const x = (meters: number) => (meters - lens.left) * lens.scale, y = (meters: number) => lens.ground - meters * lens.scale, s = lens.scale;
    if (phase.kind === 'aiming' || phase.kind === 'charging') {
      const jitter = phase.kind === 'charging' ? Math.sin(now * 1.3) * blastPower(holdStep(phase, now)) * 0.04 * s : 0;
      this.shadow(x(0), y(0), 0.55 * s); this.pose(this.pilot, 'stand', x(0) + jitter, y(0), s, true);
      return;
    }
    const run = phase.run, height = run.y + BODY;
    this.shadow(x(run.x), y(0), clamp(0.6 - run.y * 0.03, 0.15, 0.6) * s, clamp(0.3 - run.y * 0.02, 0.05, 0.3));
    if (!this.calm) {
      const fading = clamp(Math.round((Math.sqrt(run.vx * run.vx + run.vy * run.vy) - 22) / 8), 0, 6), ghosts = this.ghostTrail.slice(-fading);
      ghosts.forEach((ghost, index) => { ctx.save(); ctx.globalAlpha = 0.08 + 0.24 * (index + 1) / ghosts.length; ctx.translate(x(ghost.x), y(ghost.y)); ctx.rotate(ghost.angle); this.pose(this.pilot, 'tumble', 0, 0, s); ctx.restore(); });
    }
    if (cheer) {
      const hop = this.calm ? 0 : Math.abs(Math.sin(now / 170)) * 0.25 * s;
      this.pose(this.pilot, 'cheer', x(run.x), y(0) - hop, s, true);
    } else if (run.end === 'banned') {
      ctx.save(); ctx.translate(x(run.x + 0.35), y(height)); ctx.rotate(-Math.PI / 2); this.pose(this.pilot, 'tumble', 0, 0, s); ctx.restore();
    } else if (run.sliding || run.end) {
      const box = this.poseBox(this.pilot, 'splat', s);
      this.pose(this.pilot, 'splat', x(run.x), y(0) - box.height / 2 + 0.1 * s, s);
    } else {
      ctx.save(); ctx.translate(x(run.x), y(height)); ctx.rotate(this.spin); this.pose(this.pilot, 'tumble', 0, 0, s); ctx.restore();
    }
    if (run.shield && !run.end) {
      const r = 1.75 * s, fading = run.shield < 120 && !this.calm ? 0.45 + 0.55 * Math.abs(Math.sin(now / 70)) : 1;
      ctx.save(); ctx.translate(x(run.x), y(height)); ctx.globalAlpha = fading;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(159,227,255,.2)'; ctx.fill();
      ctx.rotate(this.calm ? 0 : now / 900); ctx.setLineDash([r * 0.5, r * 0.22]); ctx.lineWidth = Math.max(3, 0.1 * s); ctx.strokeStyle = '#EAFBFF'; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private effects(lens: Lens, now: number, seconds: number) {
    const { ctx } = this, x = (meters: number) => (meters - lens.left) * lens.scale, y = (meters: number) => lens.ground - meters * lens.scale;
    this.puffs = this.puffs.filter(puff => now - puff.at < 700);
    for (const puff of this.puffs) {
      const t = (now - puff.at) / 700;
      if (t < 0) continue;
      ctx.globalAlpha = 0.9 * (1 - t); ctx.beginPath(); ctx.arc(x(puff.x - t * 0.4), y(puff.y + t * 0.6), puff.size * (0.6 + t) * lens.scale, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!this.calm) {
      const burst = this.stampFor('burst', () => burstArt(this.res));
      this.bursts = this.bursts.filter(each => now - each.at < 320).slice(-3);
      for (const each of this.bursts) {
        const t = (now - each.at) / 320;
        ctx.save(); ctx.globalAlpha = 1 - t * t; ctx.translate(x(each.x), y(each.y)); ctx.rotate(t * 0.4);
        drawStamp(ctx, burst, 0, 0, lens.scale * each.size * (0.55 + 0.55 * easeOut(Math.min(1, t * 2.2)))); ctx.restore();
      }
      const bean = this.stampFor('bean', () => beanArt(this.res));
      this.bits = this.bits.filter(bit => now - bit.at < bit.life).slice(-60);
      for (const bit of this.bits) {
        bit.vy -= 20 * seconds; bit.x += bit.vx * seconds; bit.y = Math.max(0, bit.y + bit.vy * seconds);
        const alpha = clamp(1 - (now - bit.at) / bit.life);
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x(bit.x), y(bit.y));
        if (bit.bean) { ctx.rotate(bit.spin * (now - bit.at) / 1000); drawStamp(ctx, bean, 0, 0, lens.scale * 1.3); }
        else { ctx.beginPath(); ctx.arc(0, 0, 0.09 * lens.scale, 0, Math.PI * 2); ctx.fillStyle = '#5B3A24'; ctx.fill(); }
        ctx.restore();
      }
    }
  }

  private overlay(phase: BlastPhase, run: BlastRun | null, tokens: number, now: number, keep: Keep) {
    const { ctx, view, ratio } = this, k = hudScale(view), sprites = this.spritesNow();
    if (this.card) {
      const t = (now - this.card.at) / 1000;
      if (t > 0.62) this.card = null;
      else {
        const scale = t < 0.12 ? 0.3 + 0.85 * (t / 0.12) : t < 0.2 ? 1.15 - 0.15 * ((t - 0.12) / 0.08) : 1, alpha = clamp((0.62 - t) / 0.12);
        const phone = view.width < 640, cx = phone ? view.width / 2 : view.width * 0.3, cy = phone ? view.height * 0.34 : squat(view) ? view.height * 0.5 : view.height * 0.4;
        ctx.globalAlpha = alpha;
        const { art, sub } = this.card;
        ctx.drawImage(art.image, cx - art.width * scale / 2, cy - art.height * scale / 2, art.width * scale, art.height * scale);
        if (sub) ctx.drawImage(sub.image, cx + art.width * 0.12 * scale - sub.width / 2, cy + art.height * 0.36 * scale - sub.height / 2, sub.width, sub.height);
        ctx.globalAlpha = 1;
      }
    }
    if (!run) {
      // On a phone the page's buttons and the pilot card take the top of the screen, so the title starts below them.
      const [first, second] = sprites.logo, top = view.width < 640 ? Math.max(view.height * 0.04, 124) : view.height * 0.04;
      ctx.drawImage(first.image, view.width / 2 - first.width / 2 - first.width * 0.06, top, first.width, first.height);
      ctx.drawImage(second.image, view.width / 2 - second.width / 2 + first.width * 0.08, top + first.height * 0.62, second.width, second.height);
      drawPressure(ctx, phase.kind === 'charging' ? blastPower(holdStep(phase, now)) : 0, view.width, view.height, k, this.words('Pressure'));
      if (!keep.aimHint && !this.touring) drawHint(ctx, this.words('Hold to set the angle, let go to launch'), view.width, view.height - 64 * Math.max(k, 0.85), k, 1);
      this.tourNote(null);
      return;
    }
    const bar = topBar(view), record = keep.best > 0 && tokens > keep.best;
    drawTopBar(ctx, bar, { tokens, best: keep.best, rate: this.rate, record, pop: clamp(1 - (now - this.unitAt) / 350) }, this.hud, ratio);
    const row = hudRow(view);
    let below = phase.kind === 'result' ? bar.y + bar.height + 8 : row.bottom + 10;
    if (record) below += (drawToast(ctx, this.hud.record, '', view.width / 2, below, k, 1, '#FF5C8A') ?? 0) + 6;
    if (this.toast) {
      const t = (now - this.toast.at) / 1000;
      if (t > 2.8) this.toast = null;
      else below += (drawToast(ctx, this.words(this.toast.line), formatTokens(this.toast.tokens), view.width / 2, below, k, t < 0.25 ? easeOut(t / 0.25) : t > 2.5 ? 1 - (t - 2.5) / 0.3 : 1) ?? 0) + 6;
    }
    if (phase.kind === 'result') { this.introduction(); return; }
    const seen = run && phase.kind === 'flying' ? aheadOf(run, view.width <= 660 ? 2 : 3) : null;
    const tap = phase.kind === 'flying' ? blastTap(run) : null;
    drawRefills(ctx, run, row, clamp(1 - (now - this.cups) / 300), seen && keep.runs < CUE_RUNS ? seen.cue : null, this.calm ? 1 : 0.5 + 0.5 * Math.sin(now / 110), tap);
    drawCaffeine(ctx, run, row, now, this.hud, sprites.glow);
    drawBoost(ctx, run, sprites.boost, view.width, view.height, k, now);
    // The street-ahead list sits under the scoreboard, and drops below the cups and caffeine row wherever it would cover the meter.
    const listLeft = view.width - 12 - 136 * Math.max(k, 0.8), under = listLeft < row.caffeine.x + row.caffeine.w ? row.bottom + 10 : bar.y + bar.height + 10;
    if (run && seen && this.seen) this.ahead(run, this.seen.lens, now, k, under, bar.y + bar.height + 10, seen);
    this.dialogue(now, below);
    this.cut(now);
    this.shower(now);
    if (this.badCut && !drawBadCut(ctx, view, this.badCut, now, this.calm)) this.badCut = null;
    if (this.seen) this.aloft(run, this.seen.lens, below, k, tap);
    this.introduction();
    this.tourNote(run);
    if (!keep.flyHint && !this.touring && run.step < blastTuning.diveCooldown * 3) drawHint(ctx, this.words('Falling? Tap to refill. Rising? Tap to dive.'), view.width, view.height - 150 * k, k, clamp((blastTuning.diveCooldown * 3 - run.step) / 60));
  }

  private tourNote(run: BlastRun | null) {
    if (!this.tour) return;
    const lens = this.seen?.lens ?? null, s = lens?.scale ?? 0;
    const at = (mx: number, my: number) => lens ? { x: (mx - lens.left) * s, y: lens.ground - my * s } : null;
    const nozzle = at(PIVOT.x, PIVOT.y), flyer = run ? at(run.x, run.y) : null;
    drawTour(this.ctx, this.tour, { width: this.view.width, height: this.view.height, calm: this.calm, mouse: finePointer() }, {
      aim: this.words('Hold to set the angle'), release: this.words('Let go to launch'), boost: this.words('Tap now!'), dive: this.words('Rising! Tap now to dive onto the green sign'),
      refill: this.words('Falling! Tap now: drink a cup and bounce back up'), caffeine: this.words('Caffeine full! The next one you hit can send you flying'), go: this.words('Tap to go on'),
    }, performance.now(), { machine: nozzle && { ...nozzle, r: Math.max(90, 2.7 * s) }, flyer: flyer && { ...flyer, r: Math.max(56, 1.1 * s) } });
  }

  private ahead(run: BlastRun, lens: Lens, now: number, k: number, top: number, barBottom: number, seen: Ahead) {
    const { ctx, view } = this, { reach, next, landing, charged } = seen, kk = Math.max(k, 0.8), narrow = view.width <= 660;
    if (squat(view)) { this.aheadFaces(barBottom, k, now, seen); this.landing(run, lens, now, landing); return; }
    const GOLD = '#FFC83D', ring = { good: '#3DBE7B', bad: '#E5484D', open: CREAM }, width = 136 * kk, x = view.width - 12 - width, aimed = next.some(row => row.hit);
    ctx.save(); ctx.lineJoin = 'round';
    let y = narrow ? Math.max(top, barBottom + 96 * kk) : top;
    next.forEach((row, index) => {
      const h = (index ? 32 : 42) * kk, safe = row.urgent && charged, color = safe ? GOLD : ring[row.tone], ink = row.urgent && !safe ? '#fff' : row.urgent ? INK : CREAM;
      const meters = Math.max(5, Math.round(row.ahead / 5) * 5), beat = this.calm || !row.urgent || safe ? 1 : 0.8 + 0.2 * Math.sin(now / 90);
      ctx.globalAlpha = (row.hit || row.urgent || !aimed ? 1 : 0.62) * beat;
      ctx.beginPath(); ctx.roundRect(x, y, width, h, h / 2); ctx.fillStyle = row.urgent ? color : 'rgba(38,63,53,.82)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      if (row.hit) { ctx.beginPath(); ctx.roundRect(x - 3, y - 3, width + 6, h + 6, h / 2 + 3); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke(); }
      this.mark(row.node, x + h / 2, y + h / 2, h / 42 * 1.05, row.urgent ? '#fff' : color);
      const left = x + h + 2 * kk, room = x + width - 14 * kk - left, size = (index ? 14 : 18) * kk;
      label(ctx, `${meters} m`, left, y + h / 2 - 3 * kk, size, ink, 'left', 900);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(left, y + h - 9 * kk, room, 3 * kk);
      ctx.fillStyle = row.urgent ? ink : color; ctx.fillRect(left, y + h - 9 * kk, room * clamp(row.ahead / reach), 3 * kk);
      y += h + 6 * kk;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    this.landing(run, lens, now, landing);
  }

  private landing(run: BlastRun, lens: Lens, now: number, landing: number | null) {
    const { ctx, view } = this;
    if (landing === null || run.y <= 3) return;
    const at = (run.x + landing - lens.left) * lens.scale, r = 0.9 * lens.scale;
    if (at <= 0 || at >= view.width) return;
    ctx.save(); ctx.setLineDash([8, 7]); ctx.lineDashOffset = this.calm ? 0 : -now / 40;
    ctx.beginPath(); ctx.ellipse(at, lens.ground, r, r * 0.28, 0, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = CREAM; ctx.stroke();
    ctx.restore();
  }

  private aheadFaces(top: number, k: number, now: number, seen: Ahead) {
    const { ctx, view } = this, { reach, next, charged } = seen, GOLD = '#FFC83D', ring = { good: '#3DBE7B', bad: '#E5484D', open: CREAM };
    const aimed = next.some(row => row.hit);
    ctx.save(); ctx.lineJoin = 'round';
    let y = top;
    next.forEach((row, index) => {
      const s = (index ? 0.8 : 1) * k / 0.7, r = 12 * s, x = view.width - 12 - r - 4 * s, safe = row.urgent && charged, color = safe ? GOLD : ring[row.tone];
      const beat = this.calm || !row.urgent || safe ? 1 : 0.8 + 0.2 * Math.sin(now / 90);
      y += r + 5 * s;
      ctx.globalAlpha = (row.hit || row.urgent || !aimed ? 1 : 0.62) * beat;
      if (row.urgent) { ctx.beginPath(); ctx.arc(x, y, r + 5 * s, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, y, r + 5 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(row.ahead / reach)); ctx.lineWidth = 3 * s; ctx.strokeStyle = row.urgent ? '#fff' : color; ctx.stroke();
      if (row.hit) { ctx.beginPath(); ctx.arc(x, y, r + 9 * s, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke(); }
      this.mark(row.node, x, y, s, row.urgent ? '#fff' : color);
      y += r + 5 * s + 4 * s;
    });
    ctx.restore();
  }

  private aloft(run: BlastRun, lens: Lens, top: number, k: number, tap: BlastTap) {
    const { ctx, view, talk } = this, kk = Math.max(k, 0.85), r = 22 * kk, middle = lens.ground - (run.y + BODY) * lens.scale;
    if (middle >= top || run.end) return;
    const x = clamp((run.x - lens.left) * lens.scale, r + 10, view.width - r - 124 * kk);
    const y = (talk && x - r < 12 + talk.art.width + 8 ? top + talk.art.height + 8 : top) + 14 * kk + r;
    ctx.save(); ctx.globalAlpha = clamp((top - middle) / (BODY * lens.scale)); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(x, y - r - 13 * kk); ctx.lineTo(x + 12 * kk, y - r + 3); ctx.lineTo(x - 12 * kk, y - r + 3); ctx.closePath();
    ctx.fillStyle = '#FFC83D'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#FFE2A8'; ctx.fill();
    this.face(this.pilot, x, y, r);
    ctx.lineWidth = 3; ctx.stroke();
    const text = `${Math.round(run.y)} m`, size = 20 * kk;
    ctx.font = `900 ${size}px ${houseFont()}`; ctx.lineWidth = 5; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.strokeText(text, x + r + 6 * kk, y);
    label(ctx, text, x + r + 6 * kk, y, size, CREAM, 'left', 900);
    const after = x + r + 6 * kk + ctx.measureText(text).width + 13 * kk, up = run.vy > 0 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(after - 5 * kk, y - 4 * kk * up); ctx.lineTo(after, y + 4 * kk * up); ctx.lineTo(after + 5 * kk, y - 4 * kk * up);
    ctx.lineWidth = 5.5 * kk; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3 * kk; ctx.strokeStyle = CREAM; ctx.stroke();
    drawTap(ctx, tap, after + 26 * kk, y, kk);
    ctx.restore();
  }

  private mark(node: Pick<BlastNode, 'kind'>, x: number, y: number, s: number, color: string) {
    const { ctx } = this, art = nodeOf(node.kind).art;
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
    if ('look' in art) {
      const r = 12 * s;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#FFE2A8'; ctx.fill();
      this.face(this.resident(atlasLook[art.look]), x, y, r);
      ctx.lineWidth = 4.5; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x, y, 11 * s, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 5 * s); ctx.lineTo(x + 5 * s, y - 5 * s); ctx.lineTo(x + 3.5 * s, y + 6 * s); ctx.lineTo(x - 3.5 * s, y + 6 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  }

  private dialogue(now: number, top: number) {
    const { ctx, view, talk, atlas } = this;
    if (!talk) return;
    const t = now - talk.at;
    if (t > TALK_MS) { this.talk = null; return; }
    const { art, who, slot } = talk, shown = this.calm ? 1 : easeOut(clamp(t / 220)), pop = this.calm ? 1 : 1 + 0.12 * Math.sin(clamp(t / 320) * Math.PI);
    const left = 12 - (1 - shown) * 40;
    ctx.save(); ctx.globalAlpha = Math.min(shown, clamp((TALK_MS - t) / 300));
    ctx.translate(left, top); ctx.scale(pop, pop);
    const flash = this.calm ? 0 : clamp(1 - t / 500);
    if (flash) { ctx.save(); ctx.globalAlpha *= flash; ctx.beginPath(); ctx.roundRect(-2, -2, art.width + 4, art.height + 4, 22); ctx.lineWidth = 8; ctx.strokeStyle = '#FFC83D'; ctx.stroke(); ctx.restore(); }
    ctx.drawImage(art.image, 0, 0, art.width, art.height);
    if (who && atlas) {
      const cx = 4 + 19 * Math.max(hudScale(view), 0.85) * 0.8 + slot / 2, cy = art.height / 2, r = slot / 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FFE2A8'; ctx.fill();
      this.face(who, cx, cy, r);
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
  }

  private cut(now: number) {
    const { ctx, view, cutin } = this;
    if (!cutin) return;
    const t = now - cutin.at;
    const long = cutin.rocket ? CATCH_MS : cutin.assist ? ASSIST_MS : CUTIN_MS;
    if (t > long) { this.cutin = null; return; }
    if (cutin.rocket) { this.catchCut(cutin, t, long, now); return; }
    const enter = this.calm ? 1 : easeOut(clamp(t / 150)), band = clamp(view.height * 0.2, 96, 176), middle = view.height * 0.4, wide = view.width >= 560;
    ctx.save(); ctx.globalAlpha = clamp((long - t) / CUTIN_FADE); ctx.translate(-(1 - enter) * view.width, 0);
    ctx.save(); ctx.translate(view.width / 2, middle); ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(38,63,53,.94)'; ctx.fillRect(-view.width, -band / 2, view.width * 2, band);
    ctx.fillStyle = '#FFC83D'; ctx.fillRect(-view.width, -band / 2 - 5, view.width * 2, 5);
    const picture = cutin.who.own ? null : cutinOf(cutin.who.look, cutin.robed);
    const tall = band * 1.45, at = cutin.assist ? view.width * (wide ? 0.27 : 0.2) : wide ? view.width * (picture ? 0.17 : 0.2) : view.width * 0.18, text = view.width * (picture ? 0.41 : wide ? 0.34 : 0.36);
    if (picture) {
      const high = Math.min(band * 2.3, view.width * 0.6 * picture.naturalHeight / picture.naturalWidth), across = high * picture.naturalWidth / picture.naturalHeight, grow = this.calm ? 1 : 1 + 0.12 * clamp(1 - t / 220) ** 2;
      ctx.save(); ctx.beginPath(); ctx.rect(-view.width, -view.height, view.width * 2, view.height + band / 2); ctx.clip();
      ctx.drawImage(picture, at - view.width / 2 - across * grow / 2, band / 2 + 2 - high * grow, across * grow, high * grow);
      ctx.restore();
    }
    const other = cutin.partner && !cutin.partner.own ? cutinOf(cutin.partner.look, cutin.robed) : null, right = view.width * (cutin.assist ? wide ? 0.73 : 0.8 : wide ? 0.85 : 0.84);
    if (other) {
      const high = Math.min(band * 2.3, view.width * 0.6 * other.naturalHeight / other.naturalWidth), across = high * other.naturalWidth / other.naturalHeight;
      ctx.save(); ctx.beginPath(); ctx.rect(-view.width, -view.height, view.width * 2, view.height + band / 2); ctx.clip();
      ctx.translate(right - view.width / 2, 0); ctx.scale(-1, 1); ctx.drawImage(other, -across / 2, band / 2 + 2 - high, across, high);
      ctx.restore();
    }
    ctx.fillStyle = '#FFC83D'; ctx.fillRect(-view.width, band / 2, view.width * 2, 5);
    if (cutin.assist) {
      const lean = band * 0.5, thick = clamp(view.width * 0.008, 4, 9), top = band * 0.95;
      ctx.save(); ctx.beginPath(); ctx.moveTo(lean - thick, -top); ctx.lineTo(lean + thick, -top); ctx.lineTo(-lean * 0.55 + thick, band / 2 + 5); ctx.lineTo(-lean * 0.55 - thick, band / 2 + 5); ctx.closePath();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
    }
    ctx.restore();
    if (!picture) this.pose(cutin.who, 'cheer', at, middle + tall * 0.52, tall / 2.8, true);
    if (cutin.partner && !other) { ctx.save(); ctx.translate(right, 0); ctx.scale(-1, 1); this.pose(cutin.partner, 'cheer', 0, middle + tall * 0.52, tall / 2.8, true); ctx.restore(); }
    const size = clamp(view.width * 0.024, 14, 21);
    ctx.font = `800 ${size}px ${houseFont()}`; ctx.fillStyle = CREAM; ctx.textBaseline = 'middle';
    if (cutin.partner && (!wide || cutin.assist)) {
      const fit = Math.min(1, (view.width - 24) / cutin.card.width), below = middle + band / 2 + 8 + size;
      ctx.drawImage(cutin.card.image, (view.width - cutin.card.width * fit) / 2, middle - band / 2 - cutin.card.height * fit * 0.7, cutin.card.width * fit, cutin.card.height * fit);
      ctx.fillStyle = 'rgba(38,63,53,.94)'; ctx.fillRect(0, below - size, view.width, size * 2);
      const said = cutin.assist && t > long / 2 ? cutin.assist.then : cutin.line;
      ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.fillText(said, view.width / 2, below, view.width - 24);
      if (cutin.assist) {
        const small = Math.round(size * 0.78), under = below + size + 6 + small;
        ctx.font = `800 ${small}px ${houseFont()}`;
        const across = Math.min(view.width - 24, ctx.measureText(cutin.assist.hint).width + small * 1.6);
        ctx.fillStyle = 'rgba(38,63,53,.94)'; ctx.fillRect((view.width - across) / 2, under - small, across, small * 2);
        ctx.fillStyle = '#FFC83D'; ctx.fillText(cutin.assist.hint, view.width / 2, under, view.width - 32);
      }
    } else {
      const fit = Math.min(1, (view.width * (cutin.partner ? 0.7 : 1) - text - 16) / cutin.card.width);
      ctx.drawImage(cutin.card.image, text, middle - band * 0.44, cutin.card.width * fit, cutin.card.height * fit);
      ctx.textAlign = 'left'; ctx.fillText(cutin.line, text + 4, middle + band * 0.27, view.width * (cutin.partner ? 0.7 : 1) - text - 20);
    }
    ctx.restore();
  }

  private shower(now: number) {
    const { ctx, view } = this, coin = this.sprites?.coin;
    this.coins = this.coins.filter(each => now - each.at < COIN_MS);
    if (!coin) return;
    const base = 26 * Math.max(hudScale(view), 0.8);
    for (const each of this.coins) {
      const t = (now - each.at) / 1000;
      if (t < 0) continue;
      const size = base * each.size, x = (each.x + each.drift * t) * view.width, y = -size + t * view.height * each.fall * 1.5 + 0.5 * view.height * 0.5 * t * t;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3 + each.x * 9) * 0.35); ctx.scale(Math.max(0.12, Math.abs(Math.cos(t * each.turn + each.x * 7))), 1);
      ctx.drawImage(coin, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  private catchCut(cutin: NonNullable<BlastScene['cutin']>, t: number, long: number, now: number) {
    const { ctx, view } = this, enter = this.calm ? 1 : easeOut(clamp(t / 150)), band = clamp(view.height * 0.2, 96, 176), middle = view.height * 0.4, wide = view.width >= 560;
    const p = this.calm ? 0.5 : clamp(t / long), moved = catchAt(p), tower = view.width * (wide ? 0.84 : 0.8), unit = band * 2.5 / 24;
    const picture = rocketOf(cutin.who.look) ?? cutinOf(cutin.who.look, false);
    ctx.save(); ctx.globalAlpha = clamp((long - t) / CUTIN_FADE); ctx.translate(-(1 - enter) * view.width, 0);
    ctx.save(); ctx.translate(view.width / 2, middle); ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(38,63,53,.94)'; ctx.fillRect(-view.width, -band / 2, view.width * 2, band);
    ctx.fillStyle = '#FFC83D'; ctx.fillRect(-view.width, -band / 2 - 5, view.width * 2, 5);
    ctx.save(); ctx.beginPath(); ctx.rect(-view.width, -view.height, view.width * 2, view.height + band / 2); ctx.clip();
    const props = orbitProps();
    if (props) drawCatch(ctx, props, p, tower - view.width / 2, band / 2 + 2, unit, now);
    const high = picture ? Math.min(band * 2.3, view.width * 0.6 * picture.naturalHeight / picture.naturalWidth) : 0, across = picture ? high * picture.naturalWidth / picture.naturalHeight : 0;
    const x = view.width * (wide ? 0.19 : 0.2) - view.width / 2 + moved.fling * view.width * 1.2;
    if (moved.fling > 0.02 && moved.fling < 1) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 7; i++) { const y = (hash(i, 3) - 0.6) * band * 1.5, length = across * (0.5 + hash(i, 4)), alpha = 0.75 * (1 - moved.fling); ctx.globalAlpha = alpha * clamp((long - t) / CUTIN_FADE); ctx.fillRect(x - across * 0.35 - length, y, length, 3 + hash(i, 5) * 4); }
      ctx.globalAlpha = clamp((long - t) / CUTIN_FADE);
    }
    if (picture) ctx.drawImage(picture, x - across / 2, band / 2 + 2 - high, across, high);
    ctx.restore();
    ctx.fillStyle = '#FFC83D'; ctx.fillRect(-view.width, band / 2, view.width * 2, 5);
    ctx.restore();
    if (!picture) this.pose(cutin.who, 'cheer', x + view.width / 2, middle + band * 0.74, band * 1.45 / 2.8, true);
    const size = clamp(view.width * 0.024, 14, 21), text = view.width * (picture ? 0.41 : wide ? 0.34 : 0.36), room = view.width * (wide ? 0.76 : 0.72) - text, fit = Math.min(1, room / cutin.card.width);
    ctx.globalAlpha *= clamp(1 - (p - 0.5) / 0.12);
    ctx.font = `800 ${size}px ${houseFont()}`; ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.drawImage(cutin.card.image, text, middle - band * 0.44, cutin.card.width * fit, cutin.card.height * fit);
    ctx.fillText(cutin.line, text + 4, middle + band * 0.27, room - 8);
    ctx.restore();
  }

  private introduction() {
    const { ctx, view, intro } = this;
    if (!intro) return;
    const { art, slot, age } = intro, shown = this.calm ? 1 : easeOut(clamp(age / 160)), tone = intro.tone, color = tone === 'good' ? '#3DBE7B' : tone === 'bad' ? '#E5484D' : '#FFC83D';
    const left = (view.width - art.width) / 2, top = view.height * 0.6 - art.height / 2 + (1 - shown) * 14;
    ctx.save(); ctx.globalAlpha = Math.min(shown, clamp((INTRO_MS - age) / 180)); ctx.translate(left, top);
    ctx.beginPath(); ctx.roundRect(-3, -3, art.width + 6, art.height + 6, 24); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.drawImage(art.image, 0, 0, art.width, art.height);
    const picture = this.picture(intro.kind), pad = 17 * Math.max(hudScale(view), 0.85) * 0.8;
    if (picture) ctx.drawImage(picture, 4 + pad, (art.height - slot) / 2, slot, slot);
    ctx.restore();
  }

  private bill(phase: Extract<BlastPhase, { kind: 'result' }>, now: number, keep: Keep) {
    const { ctx, view } = this;
    if (!this.receipt) {
      const bill = billFor(phase, keep);
      this.receipt = { bill, art: receiptArt(bill, Math.min(340, view.width - 40), this.ratio, this.words, kind => this.picture(kind), kind => this.faceOf(kind)) };
    }
    const t = clamp((now - phase.at - 500) / 380), shown = easeOut(t);
    if (t <= 0) return;
    ctx.fillStyle = `rgba(18,10,42,${0.5 * shown})`; ctx.fillRect(0, 0, view.width, view.height);
    const art = this.receipt.art, bar = topBar(view), from = bar.y + bar.height + 12, room = Math.max(160, view.height - this.foot - 12 - from);
    const fit = Math.min(1, room / art.height, (view.width - 24) / art.width);
    const w = art.width * fit, h = art.height * fit, rest = from + (room - h) / 2, top = rest - (1 - shown) * (rest + h + 30);
    ctx.save(); ctx.translate(view.width / 2, top + h / 2); ctx.rotate(-0.035);
    ctx.fillStyle = 'rgba(20,10,30,.25)'; ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h - 6);
    ctx.drawImage(art.image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function billFor(phase: Extract<BlastPhase, { kind: 'result' }>, keep: Keep): Bill {
  const address = `${location.host}${location.pathname}?game=barista-blast`;
  return billOf(phase.run, phase.seed, keep.best > 0 && blastTokens(phase.run.x) > keep.best, address);
}
