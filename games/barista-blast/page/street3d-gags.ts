import * as THREE from 'three';
import { CREAM, hash, INK, RED } from './art';
import { ARM_OPEN, ARM_Y, carAt, carSize, padAt, padSize, padsIn, ROCKET, SAT_COUNT, SAT_GAP, satSize, TOWER_H, trainAt, wrapWords, type GagFrame } from './orbit-gags';
import { board, type Build } from './street3d-kit';

const STEEL = '#DDE3EA', STEEL_DARK = '#9AA6B4', ICE = '#9EE7FF', ROCKET_RED = '#E5484D', BEAN = '#8A5A3C', GREY = '#6B7280', FIRE = '#FF8A2B', YELLOW = '#FFD54A', ARM = '#FFC83D';
export const GAG_DEPTH = 50;
const TRAIN_DEPTH = 60;
const rad = (degrees: number) => degrees * Math.PI / 180;
const deg = (radians: number) => radians * 180 / Math.PI;
type Make = (key: string, make: (b: Build) => void) => THREE.Group;

function towerParts(b: Build) {
  if (b.model('orb4_gag_launch_tower' , 0, 0, 0)) return;
  const bays = 10, bay = TOWER_H / bays, z = -3.2, brace = Math.hypot(6.4, bay), lean = deg(Math.atan2(bay, 6.4));
  for (const side of [-1, 1]) for (const face of [-1, 1]) b.box(RED, 0.5, TOWER_H, 0.5, side * 3.2, 0, z + face * 1.2, { rough: 0.6 });
  for (const face of [-1, 1]) for (let i = 0; i <= bays; i++) {
    b.box(RED, 6.4, 0.24, 0.24, 0, i * bay - 0.12, z + face * 1.2, { rough: 0.6 });
    if (i < bays) for (const turn of [lean, -lean]) b.box(RED, brace, 0.2, 0.2, 0, i * bay + bay / 2 - 0.1, z + face * 1.2, { rough: 0.6, turn: [0, 0, turn] });
  }
  b.box(GREY, 8.8, 0.7, 5.6, 0, 0, -1.4);
  b.tube('#EDE6DA', 2.5, ROCKET.base - 0.7, 0, 0.7, 0, { sides: 24, top: 0.9 });
  b.box(GREY, 7.8, 0.5, 4.4, 0, TOWER_H, z);
  b.tube(INK, 0.06, 1.7, 0, TOWER_H + 0.5, z, { sides: 6 });
  b.ball('#FF5C6C', 0.38, 0.38, 0.38, 0, TOWER_H + 2.4, z, { glow: 1.6 });
  for (const side of [-1, 1]) b.box(GREY, 0.7, 0.7, 2.4, side * 4.3, ARM_Y - 0.35, -1.2);
}

function armParts(b: Build, side: number) {
  if (b.model(side < 0 ? 'orb4_gag_arm_left' : 'orb4_gag_arm_right', 0, 0, 0)) return;
  const dir = -side;
  b.box(ARM, 2.8, 1, 1.6, dir * 1.4, -0.5, 0, { rough: 0.5 });
  b.box('#4B5563', 0.6, 2.4, 2.2, dir * 2.5, -1.2, 0);
  b.box(GREY, 1.2, 0.7, 1.2, -dir * 0.5, -0.35, 0);
  b.tube('#9AA6B4', 0.55, 1.4, 0, 0, 0, { turn: [90, 0, 0], sides: 14 });
}

function rocketParts(b: Build) {
  if (b.model('orb4_gag_rocket', 0, 0, 0)) {
    b.sign('rocket-bean', board('bean', BEAN, CREAM), 1.9, 1.9, 0, ROCKET.base + 4.4, ROCKET.r + 0.06, { round: true, sharp: true });
    return;
  }
  const { r, base, body } = ROCKET, top = base + body, steel = { rough: 0.22, glow: 0.3 };
  b.tube(STEEL, r, body, 0, base, 0, { ...steel, sides: 28 });
  b.tube(STEEL, r, 2.2, 0, top, 0, { ...steel, sides: 28, top: 0.62 });
  b.tube(STEEL, r * 0.62, 1.7, 0, top + 2.2, 0, { ...steel, sides: 28, top: 0.2 });
  b.ball(STEEL, 0.28, 0.28, 0.28, 0, top + 3.9, 0, steel);
  for (const y of [base + 3.2, base + 6.2, base + 9.4]) b.tube(STEEL_DARK, r + 0.03, 0.1, 0, y, 0, { sides: 28 });
  b.tube(ROCKET_RED, r + 0.04, 0.6, 0, base + 8.4, 0, { sides: 28, rough: 0.5 });
  b.disc(INK, 0.62, 0, base + 7.4, r + 0.03);
  b.disc(ICE, 0.48, 0, base + 7.4, r + 0.06, { glow: 0.5 });
  b.sign('rocket-bean', board('bean', BEAN, CREAM), 1.9, 1.9, 0, base + 4.4, r + 0.05, { round: true, sharp: true });
  for (const side of [-1, 1]) {
    b.box(STEEL_DARK, 1.6, 2.8, 0.35, side * 2.2, base + 0.2, 0, { turn: [0, 0, side * -10] });
    b.box(STEEL_DARK, 1, 1.5, 0.3, side * 1.95, top - 1.5, 0);
  }
  b.tube('#5B6572', r - 0.1, 1.1, 0, base - 0.9, 0, { sides: 24, top: 0.85 });
  for (const x of [-0.7, 0, 0.7]) b.tube('#2A2F38', 0.4, 0.55, x, base - 1.2, 0, { top: 1.3, sides: 12 });
}

function flameParts(b: Build) {
  if (b.model('orb4_gag_flame' , 0, 0, 0)) return;
  for (const [r, h, color, glow] of [[1.3, 7, FIRE, 1.4], [0.86, 4.6, YELLOW, 2], [0.45, 2.4, '#FFFFFF', 2.4]] as const) b.tube(color, r, h, 0, -h, 0, { top: 0.001, turn: [180, 0, 0], glow, sides: 14 });
}

function dummyFace(b: Build, dir: number) {
  b.sign('dummy-face', (ctx, s) => {
    ctx.fillStyle = '#F2B134'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, s / 2, s / 2); ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s / 2, s * 0.52, s * 0.28, 0.35, Math.PI - 0.35); ctx.stroke();
  }, 0.9, 0.9, -0.45 * dir, 3.0, 0.52, { round: true });
}

function carParts(b: Build, dir: number) {
  if (b.model(dir < 0 ? 'orb4_gag_roadster_left' : 'orb4_gag_roadster_right', 0, 0, 0)) {
    dummyFace(b, dir);
    return;
  }
  const x = (value: number) => value * dir, flip = (turn: number) => turn * dir, shine = { rough: 0.25 };
  b.box('#E8353F', 5.4, 0.8, 2.3, 0, 0.35, 0, shine);
  b.box('#E8353F', 1.7, 0.45, 2.15, x(1.85), 1.1, 0, { ...shine, turn: [0, 0, flip(-9)] });
  b.box('#E8353F', 1.4, 0.6, 2.15, x(-2.0), 1.1, 0, shine);
  b.box('#FFC83D', 5.3, 0.12, 2.34, 0, 0.7, 0);
  b.box('#2A2F38', 0.4, 1.5, 1.8, x(-1.5), 1.0, 0);
  b.box('#2A2F38', 1.2, 0.35, 1.6, x(-0.7), 1.05, 0);
  b.box('#B3202B', 0.18, 0.55, 2.3, x(-2.8), 1.5, 0);
  b.box('#B3202B', 0.4, 0.18, 2.3, x(-2.85), 2.0, 0);
  b.box('#F2B134', 0.8, 1.1, 1.1, x(-0.55), 1.4, 0);
  b.ball('#F2B134', 0.52, 0.52, 0.52, x(-0.45), 3.0, 0, { rough: 0.4 });
  dummyFace(b, dir);
  b.box('#9EE7FF', 0.1, 1.1, 2.1, x(0.95), 1.15, 0, { glow: 0.4, turn: [0, 0, flip(-38)] });
  b.box('#F2B134', 1.1, 0.28, 0.3, x(0.15), 1.9, 0.55, { turn: [0, 0, flip(14)] });
  for (const wheel of [-1.8, 1.8]) for (const z of [-1.25, 1.25]) {
    b.pipe('#2A2F38', 0.66, 0.55, x(wheel), 0.66, z, 'z');
    if (z > 0) b.disc('#E6E9F4', 0.34, x(wheel), 0.66, z + 0.29);
  }
  b.ball('#FFE9A0', 0.22, 0.22, 0.22, x(2.72), 0.95, 0.7, { glow: 1.4 });
  b.ball('#FF5C6C', 0.18, 0.18, 0.18, x(-2.75), 0.95, 0.7, { glow: 1.4 });
}

function trainParts(b: Build) {
  for (let i = 0; i < SAT_COUNT; i++) {
    const x = (i - (SAT_COUNT - 1) / 2) * SAT_GAP, y = -0.012 * x * x;
    if (b.model('orb4_gag_train_satellite', x, y, 0)) continue;
    b.box('#DDE3EA', 1.1, 0.8, 0.8, x, y - 0.4, 0, { rough: 0.3, glow: 0.3 });
    b.box('#E8B03A', 1.14, 0.16, 0.84, x, y - 0.08, 0, { glow: 0.3 });
    for (const side of [-1, 1]) b.pane('#2A4DB0', 0.9, 0.6, x + side * 1.05, y, 0.1, { glow: 0.4 });
    b.ball('#E6E9F4', 0.16, 0.16, 0.16, x, y + 0.55, 0, { glow: 0.8 });
  }
}

const pill = (lines: readonly string[], w: number, h: number) => (ctx: CanvasRenderingContext2D, s: number) => {
  const W = w * 100, H = h * 100, size = H / (lines.length + 0.9);
  ctx.scale(s / W, s / H);
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = H * 0.05; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(H * 0.025, H * 0.025, W - H * 0.05, H * 0.95, Math.min(H / 2, size * 1.2)); ctx.stroke();
  ctx.fillStyle = RED; ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, index) => ctx.fillText(line, W / 2, H / 2 + (index - (lines.length - 1) / 2) * size * 1.15 + size * 0.04, W - size));
};
const pillSize = (lines: readonly string[]) => {
  const size = 1.7, units = Math.max(...lines.map(line => [...line].reduce((width, char) => width + (char.charCodeAt(0) > 0x2e80 ? 1 : 0.56), 0)));
  return { w: Math.max(8, units * size + size * 1.6), h: size * (lines.length + 0.9) * 1.1 };
};

type Rig = { root: THREE.Group; rocket: THREE.Group; flame: THREE.Group; arms: readonly [THREE.Group, THREE.Group]; puffs: THREE.Group[]; fire: THREE.Group; flash: THREE.Group; shards: THREE.Group[]; words: THREE.Group };

export class OrbitGags {
  readonly group = new THREE.Group();
  private pads = new Map<number, Rig>();
  private cars = new Map<number, THREE.Group>();
  private train: THREE.Group | null = null;
  private said = '';
  constructor(private make: Make) { this.group.visible = false; }

  private rig(words: string): Rig {
    const { make } = this, root = new THREE.Group(), rocket = new THREE.Group(), flames = make('gag:flame', flameParts), at = (group: THREE.Group, x: number, y: number, z: number) => { group.position.set(x, y, z); return group; };
    root.add(make('gag:tower', towerParts));
    rocket.add(make('gag:rocket', rocketParts), at(flames, 0, ROCKET.base - 1.2, 0));
    const left = at(make('gag:arm:-1', b => armParts(b, -1)), -4.3, ARM_Y, -0.2), right = at(make('gag:arm:1', b => armParts(b, 1)), 4.3, ARM_Y, -0.2);
    const puffs = Array.from({ length: 14 }, () => make('gag:puff', b => b.model('orb4_gag_puff', 0, 0, 0) || b.ball('#FFFFFF', 1, 1, 1, 0, 0, 0, { rough: 1, glow: 0.4 }))), shards = Array.from({ length: 9 }, (_, i) => make(`gag:shard:${i % 3 ? 0 : 1}`, b => b.model(i % 3 ? 'orb4_gag_shard_ivory' : 'orb4_gag_shard_rose', 0, 0, 0) || b.box(i % 3 ? STEEL : ROCKET_RED, 1.3, 0.7, 0.5, 0, -0.35, 0, { rough: 0.4 })));
    const fire = make('gag:fire', b => b.model('orb4_gag_fire', 0, 0, 0) || b.ball(FIRE, 1, 1, 1, 0, 0, 0, { glow: 2 })), flash = make('gag:flash', b => b.model('orb4_gag_flash', 0, 0, 0) || b.ball(YELLOW, 1, 1, 1, 0, 0, 0, { glow: 2.6 }));
    const lines = wrapWords(words), { w, h } = pillSize(lines), sign = make(`gag:words:${words}`, b => b.sign(`gag-words:${words}`, pill(lines, w, h), w, h, 0, 0, 0, { sharp: true, glow: 1 }));
    root.add(rocket, left, right, ...puffs, ...shards, fire, flash, sign);
    return { root, rocket, flame: flames, arms: [left, right], puffs, fire, flash, shards, words: sign };
  }

  update(scene: THREE.Scene, frame: GagFrame, now: number, words: string, on: boolean) {
    this.group.visible = on;
    if (!on) return;
    if (!this.group.parent) scene.add(this.group);
    if (words !== this.said) { for (const rig of this.pads.values()) this.group.remove(rig.root); this.pads.clear(); this.said = words; }
    const size = padSize(frame), seen = new Set<number>();
    for (const { id, u } of padsIn(frame)) {
      seen.add(id);
      let rig = this.pads.get(id);
      if (!rig) { rig = this.rig(words); this.pads.set(id, rig); this.group.add(rig.root); }
      this.pose(rig, padAt(id, now), now);
      rig.root.position.set(frame.centre + u, -0.2, -GAG_DEPTH); rig.root.scale.setScalar(size);
    }
    for (const [id, rig] of this.pads) if (!seen.has(id)) { this.group.remove(rig.root); this.pads.delete(id); }

    const big = carSize(frame), small = satSize(frame), driver = carAt(now, frame), row = trainAt(now, frame);
    for (const [dir, group] of this.cars) group.visible = driver.on && driver.dir === dir;
    if (driver.on) {
      let found = this.cars.get(driver.dir);
      if (!found) { found = this.make(`gag:car:${driver.dir}`, b => carParts(b, driver.dir)); this.cars.set(driver.dir, found); this.group.add(found); }
      found.position.set(frame.centre + driver.u, driver.y, -GAG_DEPTH - 4); found.scale.setScalar(big); found.rotation.set(0, 0, rad(driver.tilt) * driver.dir);
    }
    if (row.on && !this.train) { this.train = this.make('gag:train', trainParts); this.group.add(this.train); }
    if (this.train) { this.train.visible = row.on; this.train.position.set(frame.centre + row.u, row.y, -TRAIN_DEPTH); this.train.scale.setScalar(small); }
  }

  private pose(rig: Rig, pad: ReturnType<typeof padAt>, now: number) {
    const open = (1 - pad.arms) * ARM_OPEN;
    rig.arms[0].rotation.z = open; rig.arms[1].rotation.z = -open;
    rig.rocket.visible = pad.rocket > 0.01 && pad.stage !== 'boom';
    rig.rocket.position.y = pad.lift - (1 - pad.rocket) * 20;
    const burn = pad.burn * (0.88 + 0.12 * Math.sin(now / 45));
    rig.flame.visible = pad.burn > 0.02;
    rig.flame.scale.set(0.4 + 0.6 * pad.burn, Math.max(0.01, burn), 0.4 + 0.6 * pad.burn);
    const age = pad.smoke, k = Math.min(1, age / 3), fade = age < 0 || age > 9 ? 0 : Math.min(1, age / 0.4) * Math.max(0, 1 - (age - 3.5) / 5.5);
    rig.puffs.forEach((puff, i) => {
      const side = i % 2 ? 1 : -1, ring = (i >> 1) % 4, boom = pad.stage === 'boom';
      if (i < 8) { puff.visible = fade > 0.02; puff.position.set(side * (1.3 + ring * 1.7 + k * (1.5 + ring * 0.9)), 0.9 + ring * 0.35 + Math.min(1, age / 8) * (1 + ring * 0.6), (ring - 1.5) * 0.9); puff.scale.setScalar(Math.max(0.01, (1 + ring * 0.25 + k * (1.2 + ring * 0.3)) * fade)); return; }
      const a = i / 6 * Math.PI * 2 + hash(i, 5), reach = (1.6 + hash(i, 6) * 2) * (1.5 + pad.t * 1.4), grow = (1.4 + hash(i, 7) * 1.2) * (0.6 + Math.min(pad.t, 1.6) * 0.9);
      puff.visible = boom; if (boom) { puff.position.set(Math.cos(a) * reach * 0.8, ROCKET.base + 8 + pad.lift + Math.sin(a) * reach * 0.7, 0.5); puff.scale.setScalar(Math.max(0.01, grow * Math.min(1, (4 - pad.t) / 1.4))); }
    });
    const bang = pad.stage === 'boom', y = ROCKET.base + 8 + pad.lift;
    rig.flash.visible = bang && pad.t < 0.8; rig.flash.position.set(0, y, 0.5); rig.flash.scale.setScalar(2 + pad.t * 9);
    rig.fire.visible = bang && pad.t < 1.2; rig.fire.position.set(0, y, 0.4); rig.fire.scale.setScalar(Math.max(0.01, 1 + pad.t * 5.5));
    rig.shards.forEach((shard, i) => {
      shard.visible = bang && pad.t < 4;
      if (!shard.visible) return;
      const a = i / 9 * Math.PI * 2 + hash(i, 8) * 0.6, speed = 5 + hash(i, 9) * 6;
      shard.position.set(Math.cos(a) * speed * pad.t, y + Math.sin(a) * speed * pad.t - 4.9 * pad.t * pad.t, 0.6);
      shard.rotation.z = (hash(i, 10) - 0.5) * 14 * pad.t;
    });
    const say = bang && pad.t > 0.25 && pad.t < 4, pop = Math.min(1, (pad.t - 0.25) / 0.3), fadeOut = Math.min(1, (4 - pad.t) / 0.6);
    rig.words.visible = say;
    if (say) { rig.words.position.set(0, y + 1 + (pad.t - 0.25) * 0.9, 7); rig.words.rotation.z = 0.06; rig.words.scale.setScalar(Math.max(0.01, (0.6 + 0.4 * pop) * Math.min(1, fadeOut + 0.001))); }
  }
}
