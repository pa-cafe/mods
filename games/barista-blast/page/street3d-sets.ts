


/** A furniture model's id in the cafe's catalogue; the cafe checks every one placed here is in it. */
export type FurnitureAssetId = string;
import { CREAM, INK, MINT, PINK, RED } from './art';
import { type Scene, scenes } from './scenes';
import { board, type Build, lights, mark, markShape, neon, shade, type Skyline } from './street3d-kit';
import type { ModelId } from './street3d-models';
import { bay } from './street3d-bay';
import { blank } from './street3d-blank';
import { hsinchu } from './street3d-hsinchu';
import { orbit } from './street3d-orbit';
import { bicycle, crossing, plaque, scooter, taipei } from './street3d-taipei';
import { temple } from './street3d-temple';

export const TILE = 7, FACE = -6.5, FAR_TILE = 14;
const F = FACE, MID = TILE / 2;
const COPPER = '#C9794B', STEEL = '#C9D3D8', BURLAP = '#D9B98A', LEAF = '#7FC28C', MOSS = '#4F9A6B', ROAST = '#4A2C1C', GOLD = '#FFD86B', WOOD = '#A8703F', SKYBLUE = '#6BD8FF', WHITE = '#FFFFFF';

/** What a piece is built with: the place, this copy's wall and accent colours, how hard its windows glow, and 0–3 for small differences between copies. */
export type Tint = { s: Scene; wall: string; accent: string; other: string; glow: number; v: number };
/** A furniture model on the pavement: metres along the piece, metres back from the kerb, degrees turned, size. */
type Placed = readonly [id: FurnitureAssetId, x: number, z: number, turn: number, size?: number];
type Piece = { build(b: Build, c: Tint): void; models?: readonly Placed[] };

const roll = (a: number, b: number) => { const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return value - Math.floor(value); };



function walls(b: Build, c: Tint, w: number, h: number, x = MID, depth = 5) {
  b.box(c.wall, w, h, depth, x, 0, F - depth / 2);
  b.box(c.s.trim, w + 0.12, 0.45, depth + 0.12, x, 0, F - depth / 2);
  b.box(c.s.trim, w + 0.4, 0.3, depth + 0.4, x, h, F - depth / 2);
  b.box(shade(c.wall, 0.8), w - 0.3, 0.25, depth - 0.3, x, h + 0.3, F - depth / 2);
}
function pane(b: Build, c: Tint, x: number, y: number, w: number, h: number, lit = true, cross = true) {
  b.box(c.s.trim, w + 0.24, h + 0.24, 0.12, x, y - 0.12, F + 0.04);
  b.pane(lit ? c.s.window : shade(c.s.trim, 1.5), w, h, x, y + h / 2, F + 0.11, lit ? { glow: c.glow, rough: 0.3 } : { rough: 0.35 });
  if (cross) { b.box(c.s.trim, 0.07, h, 0.04, x, y, F + 0.12); b.box(c.s.trim, w, 0.07, 0.04, x, y + h * 0.55, F + 0.12); }
  b.box(c.s.trim, w + 0.4, 0.1, 0.3, x, y - 0.22, F + 0.15);
}
function door(b: Build, c: Tint, x: number, w = 1.3, h = 2.9, lit = true) {
  b.box(c.s.trim, w + 0.3, h + 0.15, 0.14, x, 0, F + 0.05);
  b.box(c.accent, w, h, 0.08, x, 0, F + 0.12);
  b.pane(lit ? c.s.window : shade(c.s.trim, 1.5), w * 0.6, h * 0.34, x, h * 0.7, F + 0.17, lit ? { glow: c.glow, rough: 0.3 } : {});
  b.ball(GOLD, 0.07, 0.07, 0.07, x + w * 0.34, h * 0.45, F + 0.2, { rough: 0.3 });
  b.box(shade(c.s.walk, 0.85), w + 0.7, 0.14, 0.7, x, 0, F + 0.35);
}

function awning(b: Build, x: number, y: number, w: number, colors: readonly [string, string], reach = 1.4) {
  const n = Math.max(4, Math.round(w / 0.6)), slat = w / n;
  for (let i = 0; i < n; i++) {
    const at = x - w / 2 + slat * (i + 0.5), color = colors[i % 2];
    b.box(color, slat, 0.08, reach, at, y, F + reach / 2 - 0.05, { turn: [20, 0, 0] });
    b.box(color, slat, 0.3, 0.05, at, y - reach * 0.17 - 0.3, F + reach * 0.94);
  }
}
function flowers(b: Build, c: Tint, x: number, y: number, w: number) {
  b.box(c.s.trim, w, 0.26, 0.32, x, y, F + 0.3);
  for (let i = 0; i < 4; i++) b.ball(i % 2 ? PINK : LEAF, 0.17, 0.16, 0.17, x - w / 2 + w * (i + 0.5) / 4, y + 0.34, F + 0.3);
}
function lamp(b: Build, c: Tint, x: number, z: number, h = 4.6) {
  b.tube(INK, 0.09, h, x, 0, z); b.tube(INK, 0.2, 0.3, x, 0, z);
  b.box(INK, 0.9, 0.08, 0.08, x + 0.4, h - 0.1, z);
  b.dome(INK, 0.34, 0.24, 0.34, x + 0.8, h - 0.36, z);
  b.ball(c.s.window, 0.2, 0.2, 0.2, x + 0.8, h - 0.4, z, { glow: 0.6 + c.glow * 1.4 });
  if (c.glow > 1) b.disc(c.s.window, 2.4, x + 0.8, 0.03, z, { turn: [-90, 0, 0], flat: 0.16 });
}
function tree(b: Build, x: number, z: number, h = 4.4, leaf = LEAF) {
  b.tube(WOOD, 0.16, h * 0.55, x, 0, z, { top: 0.7 });
  b.ball(leaf, h * 0.26, h * 0.24, h * 0.26, x, h * 0.66, z);
  b.ball(shade(leaf, 0.9), h * 0.2, h * 0.19, h * 0.2, x - h * 0.17, h * 0.55, z + 0.2);
  b.ball(shade(leaf, 1.08), h * 0.18, h * 0.17, h * 0.18, x + h * 0.16, h * 0.8, z - 0.1);
}
function puffs(b: Build, x: number, y: number, z: number, color: string, drift = 0.6, n = 4) {
  for (let i = 0; i < n; i++) { const r = 0.32 + i * 0.16; if (b.model('tpe5_steam_puff', x + i * drift, y + i * 0.75, z, r)) continue; b.ball(color, r, r * 0.9, r, x + i * drift, y + i * 0.75, z, { rough: 1 }); }
}

function cup(b: Build, x: number, y: number, z: number, r: number, h: number, color: string, band: string) {
  b.tube(color, r * 0.72, h, x, y, z, { top: 1.38, sides: 24 });
  b.tube(band, r * 0.915, h * 0.18, x, y + h * 0.62, z, { top: 1.075, sides: 24 });
  b.tube(ROAST, r * 0.93, 0.06, x, y + h - 0.04, z, { sides: 24 });
  b.ring(color, h * 0.26, r * 0.22, x + r * 1.05, y + h * 0.55, z);
}

function pot(b: Build, x: number, y: number, z: number, size: number, color: string) {
  const dark = shade(color, 0.72);
  b.tube(color, size, size * 1.1, x, y, z, { top: 0.68, sides: 8, rough: 0.4 });
  b.tube(dark, size * 0.72, size * 0.16, x, y + size * 1.1, z, { sides: 8 });
  b.tube(color, size * 0.68, size * 1.05, x, y + size * 1.26, z, { top: 1.4, sides: 8, rough: 0.4 });
  b.tube(dark, size * 0.96, size * 0.34, x, y + size * 2.31, z, { top: 0.25, sides: 8 });
  b.ball(INK, size * 0.14, size * 0.14, size * 0.14, x, y + size * 2.74, z);
  b.box(color, size * 0.5, size * 0.16, size * 0.3, x - size * 0.95, y + size * 2.1, z, { turn: [0, 0, 22] });
  b.box(INK, size * 0.16, size * 0.95, size * 0.2, x + size * 1.12, y + size * 1.3, z);
  b.box(INK, size * 0.4, size * 0.14, size * 0.2, x + size * 0.95, y + size * 2.15, z);
}
function bean(b: Build, x: number, y: number, z: number, size: number, turn: number, color = '#9C6A45') {
  b.ball(color, size, size * 0.68, size * 0.5, x, y, z, { turn: [0, 0, turn], rough: 0.5 });
  b.ball(shade(color, 0.5), size * 0.86, size * 0.07, size * 0.5, x, y, z + size * 0.06, { turn: [0, 0, turn + 8] });
}
function bricks(b: Build, c: Tint, x: number, w: number, h: number, seed: number) {
  const dark = shade(c.wall, 0.8);
  for (let i = 0; i < 14; i++) b.box(dark, 0.6, 0.18, 0.04, x - w / 2 + 0.5 + roll(i, seed) * (w - 1), 0.6 + Math.floor(roll(i, seed + 1) * (h - 1.2) / 0.3) * 0.3, F + 0.01);
}
function sackPile(b: Build, x: number, z: number) {
  [[0, 0], [1.05, 0], [2.1, 0], [0.5, 0.62], [1.6, 0.62], [1.05, 1.24]].forEach(([dx, dy], i) => {
    b.ball(i % 3 ? BURLAP : shade(BURLAP, 0.9), 0.6, 0.36, 0.46, x + dx, 0.36 + dy, z, { rough: 1 });
    b.box(ROAST, 0.36, 0.2, 0.02, x + dx, 0.3 + dy, z + 0.45);
  });
}
function barrel(b: Build, x: number, z: number, h = 1.3) {
  b.tube('#8A5A3A', 0.5, h, x, 0, z);
  for (const at of [0.2, h / 2, h - 0.2]) b.tube(ROAST, 0.53, 0.08, x, at - 0.04, z);
}
function ladder(b: Build, x: number, y: number, h: number, z: number) {
  for (const side of [-0.22, 0.22]) b.box(INK, 0.05, h, 0.05, x + side, y, z);
  for (let at = 0.3; at < h; at += 0.45) b.box(INK, 0.44, 0.04, 0.04, x, y + at, z);
}

function poster(b: Build, name: string, paint: Parameters<Build['sign']>[1], size: number, x: number, y: number, z: number, frame: string, glow = 0) {
  b.box(frame, size + 0.3, size + 0.3, 0.16, x, y - size / 2 - 0.15, z - 0.1);
  b.sign(name, paint, size, size, x, y, z + 0.01, glow ? { glow } : {});
}
const foamBank = (b: Build, seed: number) => {
  for (let i = 0; i < 4; i++) { const r = 1.6 + roll(i, seed) * 1.6; b.dome(i % 2 ? WHITE : '#FFF4E6', r * 1.3, r * 0.6, r, i * 2 + roll(i, seed + 2), 0, F - 1 - roll(i, seed + 4) * 3, { rough: 1 }); }
};



const street: readonly Piece[] = [
  {
    build(b, c) {
      const h = 7.6 + c.v * 0.5;
      const cafe = b.model('tpe3_corner_cafe_7m', MID, 0, -8);
      if (!cafe) {
        walls(b, c, 6.2, h);
        pane(b, c, 2.5, 0.9, 3.3, 2.1); door(b, c, 5.4);
        awning(b, 3.5, 3.35, 5.9, [c.accent, CREAM]);
        for (const x of [1.6, 5.4]) { pane(b, c, x, 4.9, 1.2, 1.6, roll(x, c.v) > 0.3); flowers(b, c, x, 4.5, 1.5); }
      }
      const badgeZ = cafe ? F + 0.48 : F + 0.12, roof = cafe ? 9.21 : h;
      b.tube(INK, 0.96, 0.14, 3.5, 5.75 - 0.07, badgeZ, { turn: [90, 0, 0], sides: 48 }); b.sign('badge:round', mark('badge', INK, board('cup', INK, CREAM, c.accent), 0), 1.8, 1.8, 3.5, 5.75, badgeZ + 0.08, { sharp: true, round: true });
      if (!b.model('tpe5_roof_chimney', 5.2, roof, F - 3)) b.box(c.s.trim, 0.7, 0.9, 0.7, 5.2, roof + 0.3, F - 3); puffs(b, 5.3, roof + 1.6, F - 3, WHITE, 0.3, 3);
    },
    models: [['signal__cafe_table', 2.2, -3, 0], ['signal__cafe_chair', 1.1, -3, 90], ['signal__cafe_chair', 3.3, -3, -90], ['signal__potPlant', 6.3, -5.6, 0, 1.3]],
  },
  {
    build(b, c) {
      if (b.model('tpe5_bubble_tea_shop_7m', MID, 0, -8)) {
        b.model('tpe5_roof_bubble_tea', MID, 10.22, -8.4);
        b.sign(`plaque:珍奶:${c.other}`, plaque('珍奶', CREAM, c.other, 0.8, 2.4), 0.8, 2.4, MID + 2.9, 5.7, -6.07, { glow: c.glow * 0.4 });
        b.model('tpe5_heritage_lamp', 6.3, 0, -2.2);
        b.model('tpe5_street_tree_4p4m', 0.6, 0, -5.4, 3.6 / 4.4);
        return;
      }
      if (!b.model('tpe3_tea_balcony_7m', MID, 0, -8)) {
        const h = 9 + c.v * 0.6;
        walls(b, c, 4.6, h);
        pane(b, c, 3.5, 1.5, 2.8, 1.5, true, false); b.box(c.s.trim, 3.3, 0.14, 0.8, 3.5, 1.2, F + 0.4);
        for (const x of [2.7, 3.5, 4.3]) b.tube(CREAM, 0.13, 0.3, x, 1.34, F + 0.5, { top: 1.3 });
        awning(b, 3.5, 3.4, 4.2, [c.accent, CREAM], 1.1);
        for (const y of [4.6, 6.8]) for (const x of [2.5, 4.5]) pane(b, c, x, y, 1.1, 1.4, roll(x + y, c.v) > 0.35);
        cup(b, 3.5, h + 0.5, F - 2.4, 1.2, 2, CREAM, c.accent); b.dome(WHITE, 1.16, 0.5, 1.16, 3.5, h + 2.5, F - 2.4); b.tube(PINK, 0.13, 2.2, 3.8, h + 1.9, F - 2.4, { turn: [0, 0, -12] });
        for (let i = 0; i < 7; i++) b.ball(ROAST, 0.14, 0.14, 0.1, 2.9 + (i % 4) * 0.4, h + 0.75 + Math.floor(i / 4) * 0.28, F - 1.5);
      }
      b.box(c.other, 0.2, 2.6, 1, 5.6, 4.4, F + 0.7); b.sign(`plaque:珍奶:${c.other}`, plaque('珍奶', CREAM, c.other, 0.8, 2.4), 0.8, 2.4, 5.6, 5.7, F + 1.21, { glow: c.glow * 0.4 });
      lamp(b, c, 6.3, -2.2); tree(b, 0.6, -5.4, 3.6);
    },
    models: [['signal__menuBoard', 1.2, -4.2, 20, 1.2]],
  },
  {
    build(b, c) {
      if (b.model('tpe5_coffee_cart', 2.6, 0, -3.6)) {
        b.model('tpe5_hedge_7m', MID, 0, F + 0.3);
        b.model('tpe5_cafe_parasol', 5.6, 0, -3.8);
        b.model('tpe5_street_tree_4p4m', 5.9, 0, -5.6, 5 / 4.4);
        b.model('tpe5_parked_scooter', 4.6, 0, -1.8);
        b.model('tpe5_parked_scooter', 6.4, 0, -1.8);
        b.sign(`mascot:${c.accent}`, mark('mascot', c.accent, board('cup', INK, c.accent, CREAM)), 0.9 * markShape.mascot, 0.9, 2.6, 1.1, -2.82, { sharp: true });
        return;
      }
      b.box(MOSS, 6.6, 1.2, 0.9, MID, 0, F + 0.3); for (let i = 0; i < 6; i++) b.ball(i % 2 ? LEAF : MOSS, 0.7, 0.5, 0.6, 0.8 + i * 1.1, 1.25, F + 0.3);
      b.box(c.accent, 2.6, 1.1, 1.3, 2.6, 0.55, -3.6); b.box(CREAM, 2.9, 0.12, 1.5, 2.6, 1.65, -3.6);
      for (const x of [1.7, 3.5]) { b.pipe(INK, 0.5, 0.16, x, 0.5, -2.9, 'z'); b.pipe(CREAM, 0.2, 0.18, x, 0.5, -2.9, 'z'); }
      for (const x of [1.4, 3.8]) b.box(INK, 0.08, 1.6, 0.08, x, 1.7, -3.6);
      for (let i = 0; i < 5; i++) b.box(i % 2 ? CREAM : c.accent, 0.6, 0.1, 1.9, 1.4 + i * 0.6, 3.3, -3.6, { turn: [0, 0, 0] });
      for (const x of [2, 2.4, 3.1]) b.tube(CREAM, 0.12, 0.3, x, 1.77, -3.4, { top: 1.3 });
      b.sign(`mascot:${c.accent}`, mark('mascot', c.accent, board('cup', INK, c.accent, CREAM)), 0.9 * markShape.mascot, 0.9, 2.6, 1.1, -2.94, { sharp: true });
      b.tube(INK, 0.06, 3, 5.6, 0, -3.8); b.tube(c.other, 1.5, 0.7, 5.6, 2.7, -3.8, { top: 0.05, sides: 10 });
      tree(b, 5.9, -5.6, 5, MOSS);
      scooter(b, 4.6, -1.8, RED); scooter(b, 6.4, -1.8, c.other);
    },
    models: [['signal__cafe_chair', 5, -3.2, -40], ['signal__crate_single', 0.7, -3.6, 15, 1.2]],
  },
  {
    build(b, c) {
      const arcade = b.model('tpe3_arcade_apartment_7m', MID, 0, -8);
      if (!arcade) {
        const h = 10.8 + c.v * 0.6, dim = shade(c.wall, 0.62);
        b.box(c.wall, 6.2, h - 3.6, 5, MID, 3.6, F - 2.5); b.box(dim, 6.2, 3.6, 3, MID, 0, F - 3.5); b.box(shade(c.s.walk, 0.9), 6.2, 0.06, 2, MID, 0, F - 1);
        for (const x of [0.65, 3.5, 6.35]) b.box(c.wall, 0.5, 3.6, 0.5, x, 0, F - 0.25);
        b.box(c.s.trim, 6.5, 0.3, 5.3, MID, h, F - 2.5);
        b.pane(c.s.window, 2.2, 2.4, 2.1, 1.5, F - 1.98, { glow: c.glow + 0.25, rough: 0.3 }); b.box(c.accent, 2.4, 0.5, 0.1, 2.1, 2.9, F - 1.95);
        b.box(STEEL, 2.2, 2.9, 0.08, 5, 0, F - 1.96, { rough: 0.4 }); for (let y = 0.3; y < 2.8; y += 0.3) b.box(shade(STEEL, 0.75), 2.2, 0.04, 0.04, 5, y, F - 1.9);
        for (let floor = 0; floor * 2.3 + 7.6 < h; floor++) for (const x of [1.6, 3.5, 5.4]) {
          const y = 5.2 + floor * 2.3, on = roll(x * 3 + floor, c.v) > 0.3;
          pane(b, c, x, y, 1.1, 1.3, on, false);
          for (const bar of [-0.36, 0, 0.36]) b.box(INK, 0.04, 1.3, 0.04, x + bar, y, F + 0.3); b.box(INK, 1.2, 0.04, 0.04, x, y + 0.65, F + 0.3);
          if (roll(x + floor * 7, c.v + 2) > 0.5) b.box('#E8E8E0', 0.8, 0.5, 0.45, x, y - 0.85, F + 0.28);
        }
        b.box('#5FA8A0', 3.2, 2, 3.2, 2.2, h + 0.3, F - 2.6); b.ridge('#4B8F88', 3.6, 0.7, 3.6, 2.2, h + 2.3, F - 2.6);
        for (const [x, z] of [[4.4, -1.6], [5.6, -1.6], [4.4, -2.8], [5.6, -2.8]]) b.box(INK, 0.1, 1, 0.1, x, h + 0.3, F + z);
        b.tube(STEEL, 0.85, 1.5, 5, h + 1.3, F - 2.2, { rough: 0.2 }); b.dome(STEEL, 0.85, 0.3, 0.85, 5, h + 2.8, F - 2.2, { rough: 0.2 });
      }
      if (arcade) {
        b.model('tpe5_roof_water_tank', 5, 10.7, -9.3, 0.8);
        b.model('tpe5_air_conditioner', 4.4, 7.1, -6.3);
      }
      const words = [['咖啡', '早餐'], ['豆花', '麵'], ['茶', '書店'], ['冰', '咖啡']][c.v];
      const front = arcade ? F + 0.7 : F;
      if (!b.model('tpe5_runtime_plaque_wide', MID, 4.15, front + 0.1)) b.box(c.other, 5.6, 0.9, 0.16, MID, 3.7, front + 0.1); b.sign(`plaque:${words[0]}:${c.other}:wide`, plaque(words[0] + '・' + words[1], CREAM, c.other, 5.3, 0.8), 5.3, 0.8, MID, 4.15, front + 0.19);
      [[0.5, c.accent, words[0]], [6.5, RED, words[1]]].forEach(([x, color, word], i) => {
        const tall = 2.4 + i * 0.6;
        if (!b.model('tpe5_runtime_plaque_tall', x as number, 5 + tall / 2, front + 0.75)) b.box(color as string, 0.2, tall + 0.2, 1.1, x as number, 4.9, front + 0.75); b.sign(`plaque:${word}:${color}:${tall}`, plaque(word as string, CREAM, color as string, 0.9, tall), 0.9, tall, (x as number) + (i ? -0.11 : 0.11), 5 + tall / 2, front + 0.75, { turn: [0, i ? -90 : 90, 0], glow: c.glow * 0.4 });
        b.sign(`plaque:${word}:${color}:${tall}:f`, plaque(word as string, CREAM, color as string, 0.9, tall), 0.9, tall, x as number, 5 + tall / 2, front + 1.31, { glow: c.glow * 0.4 });
      });
      scooter(b, 1.5, -1.9, c.accent); scooter(b, 3.9, -1.9, WHITE);
    },
    models: [['signal__plant', 0.5, -5.4, 0, 1.3]],
  },
  {
    build(b, c) {
      if (b.model('tpe5_park_fence_7m', MID, 0, F + 0.4)) {
        b.model('tpe5_street_tree_4p4m', 1.6, 0, -5, 6 / 4.4);
        b.model('tpe5_street_tree_4p4m', 5.6, 0, -5.6, 4.8 / 4.4);
        b.model('tpe5_menu_board', 3.6, 0, -2.6);
        b.sign('mascot:board', mark('mascot', CREAM, board('cup', INK, CREAM, c.accent)), 0.9, 0.9, 3.6, 0.85, -2.32, { sharp: true });
        b.model('tpe5_heritage_lamp', 0.4, 0, -2.2);
        b.model('tpe5_crossing_signal', 6.6, 0, -1.5);
        b.model('tpe5_parked_bicycle', 1.4, 0, -2);
        b.model('tpe5_parked_bicycle', 1.4, 0, -1.3);
        return;
      }
      for (let i = 0; i < 8; i++) b.box(CREAM, 0.12, 1.1, 0.12, 0.4 + i * 0.9, 0, F + 0.4);
      for (const y of [0.45, 0.95]) b.box(CREAM, 6.6, 0.1, 0.06, MID, y, F + 0.4);
      tree(b, 1.6, -5, 6, LEAF); tree(b, 5.6, -5.6, 4.8, MOSS);
      for (let i = 0; i < 7; i++) b.ball([PINK, GOLD, RED][i % 3], 0.2, 0.18, 0.2, 2.7 + i * 0.35, 0.2, F + 0.9);
      b.box(c.s.trim, 1.1, 1.5, 0.08, 3.6, 0, -2.6, { turn: [-12, 0, 0] }); b.sign('mascot:board', mark('mascot', CREAM, board('cup', INK, CREAM, c.accent)), 0.9, 0.9, 3.6, 0.85, -2.42, { turn: [-12, 0, 0], sharp: true });
      lamp(b, c, 0.4, -2.2); crossing(b, 6.6, -1.5, c.glow);
      bicycle(b, 1.4, -2); bicycle(b, 1.4, -1.3);
    },
    models: [['signal__bench', 4.6, -4.2, 0, 1.2]],
  },
  {
    build(b, c) {
      if (b.model('tpe5_gabled_cafe_7m', MID, 0, -8)) {
        b.model('tpe5_roof_chimney', 5.4, 5.75, -8.5);
        puffs(b, 5.4, 7.9, -8.5, WHITE, 0.35);
        b.model('tpe5_flower_planter', 2.4, 0, F + 0.3);
        for (let i = 0; i < 4; i++) b.model('tpe5_bakery_loaf', 1.5 + i * 0.6, 1.08, F + 0.3);
        return;
      }
      if (b.model('tpe3_low_market_7m', MID, 0, -8)) return;
      const roof = shade(c.accent, 0.85);
      walls(b, c, 5.8, 4.6);
      b.ridge(roof, 6.3, 2.2, 5.6, MID, 4.9, F - 2.5); b.box(c.s.trim, 0.8, 2.6, 0.8, 5.3, 4.9, F - 3.2); puffs(b, 5.4, 7.9, F - 3.2, WHITE, 0.35);
      b.box(c.s.trim, 2.7, 1.9, 0.12, 2.4, 0.75, F + 0.04); b.disc(c.s.trim, 1.35, 2.4, 2.65, F + 0.1);
      b.pane(c.s.window, 2.4, 1.7, 2.4, 1.75, F + 0.12, { glow: c.glow, rough: 0.3 }); b.disc(c.s.window, 1.2, 2.4, 2.6, F + 0.13, { glow: c.glow, rough: 0.3 });
      b.box(c.s.trim, 0.07, 2.9, 0.04, 2.4, 0.9, F + 0.15); b.box(c.s.trim, 2.4, 0.07, 0.04, 2.4, 2.56, F + 0.15);
      for (let i = 0; i < 4; i++) b.ball('#D9A066', 0.26, 0.16, 0.16, 1.5 + i * 0.6, 1.08, F + 0.3);
      door(b, c, 5); awning(b, 5, 3.3, 2, [c.accent, CREAM], 1);
      flowers(b, c, 2.4, 0.5, 2.8);
    },
    models: [['signal__crate_stack', 0.5, -4.6, 10, 1.1], ['signal__signboard', 6.2, -3, -20, 1.2]],
  },
];



const roastery: readonly Piece[] = [
  {
    build(b, c) {
      if (b.model('hsc3_sawtooth_roastery_7m', MID, 0, -8)) {
        const h = 7 + c.v * 0.4;
        puffs(b, 6, h + 6.2, F - 3.4, '#FFE2B0', 0.5);
        return;
      }
      const h = 7 + c.v * 0.4;
      walls(b, c, 6.6, h); bricks(b, c, MID, 6.6, h, c.v + 3);
      for (let i = 0; i < 3; i++) { b.ridge(shade(c.wall, 0.7), 2.2, 1.7, 5, 1.3 + i * 2.2, h + 0.3, F - 2.5, 1); b.pane(c.s.window, 0.9, 0.9, 1.9 + i * 2.2, h + 1, F + 0.02, { glow: c.glow }); }
      b.box(c.s.trim, 3.3, 3.7, 0.14, 2.4, 0, F + 0.05); b.box(shade(c.accent, 1.1), 3, 3.5, 0.08, 2.4, 0, F + 0.12);
      for (let y = 0.5; y < 3.4; y += 0.5) b.box(c.s.trim, 3, 0.05, 0.04, 2.4, y, F + 0.17);
      for (const x of [1, 2.4, 3.8, 5.6]) pane(b, c, x, 4.6, 0.9, 1, roll(x, c.v) > 0.3);
      door(b, c, 5.6, 1.1, 2.7);
      b.tube(shade(c.wall, 0.75), 0.5, 5.6, 5.9, h, F - 3.4, { top: 0.8 }); for (const y of [h + 2, h + 4]) b.tube(c.s.trim, 0.5, 0.2, 5.9, y, F - 3.4);
      puffs(b, 6, h + 6.2, F - 3.4, '#FFE2B0', 0.5);
    },
    models: [['signal__crate_stack', 5.2, -4.4, 12, 1.2]],
  },
  {
    build(b, c) {
      if (b.model('hsc3_drum_roaster_7m', MID, 0, -8)) {
        puffs(b, 3.7, 8.6, -4.4, '#FFE2B0', 0.4, 3);
        return;
      }
      for (const x of [0.6, 6.4]) for (const z of [-2.4, -5.8]) b.box(STEEL, 0.16, 6, 0.16, x, 0, z);
      b.box(shade(c.wall, 0.8), 6.6, 0.18, 4.4, MID, 6, -4.1, { turn: [0, 0, 5] });
      b.pipe(COPPER, 1.35, 2.8, 2.8, 2.7, -4.4, 'x', { rough: 0.35 });
      for (const x of [1.38, 4.22]) b.pipe(shade(COPPER, 0.7), 1.45, 0.14, x, 2.7, -4.4);
      b.pipe(INK, 0.5, 0.2, 2.8, 2.7, -3, 'z'); b.pipe(c.s.window, 0.34, 0.22, 2.8, 2.7, -2.98, 'z', { glow: 0.6 + c.glow });
      for (const x of [1.7, 3.9]) for (const z of [-3.6, -5.2]) b.box(INK, 0.16, 1.5, 0.16, x, 0, z);
      b.tube(STEEL, 0.34, 1.2, 2, 4, -4.4, { top: 2.2 }); b.tube(STEEL, 0.24, 4.4, 3.6, 3.9, -4.4); puffs(b, 3.7, 8.6, -4.4, '#FFE2B0', 0.4, 3);
      b.tube(STEEL, 1.25, 0.34, 5.4, 0.9, -3.4, { rough: 0.4 }); b.tube(ROAST, 1.12, 0.06, 5.4, 1.22, -3.4); for (const x of [4.7, 6.1]) b.box(INK, 0.1, 0.9, 0.1, x, 0, -3.4);
      b.box(c.accent, 0.8, 1.5, 0.5, 0.9, 0, -3.2); b.pane(c.s.window, 0.5, 0.36, 0.9, 1.1, -2.94, { glow: 0.8 + c.glow });
    },
  },
  {
    build(b, c) {
      if (b.model('hsc3_low_loading_yard_7m', MID, 0, -8)) {
        poster(b, `bean:${c.accent}`, board('bean', ROAST, CREAM, '#9C6A45'), 1.2, 5.6, 1.5, F + 0.3, c.s.trim);
        b.model('tpe5_street_tree_4p4m', 3.6, 0, F - 2, 6 / 4.4);
        return;
      }
      b.box(c.wall, 6.8, 2.6, 0.5, MID, 0, F); b.box(c.s.trim, 7, 0.2, 0.7, MID, 2.6, F); bricks(b, c, MID, 6.4, 2.6, c.v + 8);
      poster(b, `bean:${c.accent}`, board('bean', ROAST, CREAM, '#9C6A45'), 1.2, 5.6, 1.5, F + 0.3, c.s.trim);
      b.box(WOOD, 3.2, 0.16, 1.4, 1.9, 0, -4.2); sackPile(b, 0.85, -4.2);
      barrel(b, 4.6, -4.4); barrel(b, 5.7, -3.9, 1.1); b.tube(ROAST, 0.44, 0.05, 4.6, 1.3, -4.4);
      b.box(INK, 0.1, 1.5, 0.1, 6.5, 0, -2.6); b.box(INK, 0.9, 0.1, 0.5, 6.2, 0.1, -2.6); b.ball(BURLAP, 0.4, 0.3, 0.3, 6.1, 0.5, -2.6, { rough: 1 });
      tree(b, 3.6, F - 2, 6, MOSS);
    },
    models: [['signal__crate_stack', 3.2, -5.4, -8, 1.2], ['signal__crate_single', 2.6, -2.6, 30, 1.1]],
  },
  {
    build(b, c) {
      if (b.model('hsc3_kettle_gantry_7m', MID, 0, -8)) {
        b.model('tpe5_heritage_lamp', 0.5, 0, -2.2);
        return;
      }
      for (const [x, z] of [[2.2, -3.6], [4.8, -3.6], [2.2, -5.8], [4.8, -5.8]]) b.box(STEEL, 0.18, 5, 0.18, x, 0, z);
      for (const y of [1.6, 3.4]) { b.box(STEEL, 2.8, 0.1, 0.1, MID, y, -3.6); b.box(STEEL, 2.8, 0.1, 0.1, MID, y, -5.8); }
      b.box(shade(STEEL, 0.8), 3.4, 0.2, 3, MID, 5, -4.7);
      pot(b, MID, 5.2, -4.7, 1.45, c.v % 2 ? COPPER : STEEL);
      ladder(b, 2.2, 0, 5, -3.5);
      barrel(b, 6.2, -5.4); lamp(b, c, 0.5, -2.2);
    },
    models: [['signal__potPlant', 5.8, -3, 0, 1.2]],
  },
  {
    build(b, c) {
      if (b.model('hsc3_shift_canteen_7m', MID, 0, -8)) {
        poster(b, 'badge:roof', mark('badge', CREAM, board('bean', ROAST, CREAM, '#9C6A45'), 0.03), 2.2, MID, 7.8, F - 1.4, c.s.trim);
        return;
      }
      walls(b, c, 5.8, 5.2); bricks(b, c, MID, 5.8, 5.2, c.v + 5);
      pane(b, c, 2.4, 0.9, 3, 2.1); door(b, c, 5.2);
      awning(b, MID, 3.4, 5.5, [GOLD, ROAST]);
      pane(b, c, 2.2, 3.9, 1, 0.9, true, false); pane(b, c, 4.8, 3.9, 1, 0.9, roll(4, c.v) > 0.4, false);
      for (const x of [1.7, 5.3]) b.box(INK, 0.12, 1.9, 0.12, x, 5.5, F - 1.5);
      poster(b, 'badge:roof', mark('badge', CREAM, board('bean', ROAST, CREAM, '#9C6A45'), 0.03), 2.2, MID, 7.8, F - 1.4, c.s.trim);
      barrel(b, 0.7, -5.2, 1); b.ball(MOSS, 0.6, 0.5, 0.6, 0.7, 1.4, -5.2);
    },
    models: [['signal__cafe_table', 2.6, -3, 0], ['signal__cafe_chair', 1.5, -3, 90], ['signal__cafe_chair', 3.7, -3, -90]],
  },
  {
    build(b, c) {
      if (b.model('hsc3_silo_pair_7m', MID, 0, -8)) {
        poster(b, 'mascot:silo', mark('mascot', CREAM, board('cup', ROAST, CREAM, c.accent)), 1.3, 5.1, 3.4, F + 0.57, c.s.trim);
        return;
      }
      [[1.9, 8.4], [5.1, 7]].forEach(([x, h]) => {
        b.box(shade(c.wall, 0.75), 3, 0.5, 3, x, 0, F - 0.8);
        b.tube(STEEL, 1.35, h, x, 0.5, F - 0.8, { rough: 0.4, sides: 24 }); b.tube(shade(STEEL, 0.8), 1.4, 1.1, x, h + 0.5, F - 0.8, { top: 0.12, sides: 24 });
        for (let y = 2; y < h; y += 2) b.tube(shade(STEEL, 0.75), 1.38, 0.12, x, y, F - 0.8, { sides: 24 });
        b.tube(INK, 0.14, 0.5, x, h + 1.55, F - 0.8);
      });
      b.pipe(COPPER, 0.2, 3.2, 3.5, 5.6, F - 0.8); b.pipe(COPPER, 0.2, 2.4, 3.5, 2.2, F + 0.5); b.tube(COPPER, 0.2, 2.2, 2.3, 0, F + 0.5); b.ring(RED, 0.3, 0.1, 4.7, 2.2, F + 0.75);
      ladder(b, 1.9, 0.5, 8.4, F + 0.58);
      poster(b, 'mascot:silo', mark('mascot', CREAM, board('cup', ROAST, CREAM, c.accent)), 1.3, 5.1, 3.4, F + 0.57, c.s.trim);
    },
    models: [['signal__crate_single', 6.2, -3.4, 25, 1.2]],
  },
];



const night: readonly Piece[] = [
  {
    build(b, c) {
      if (b.model('sf3_highrise_shop_7m', MID, 0, -8)) {
        const h = 15 + c.v;
        poster(b, `neon-mascot:${c.accent}`, mark('mascot', '#0E0B24', neon('cup', c.accent)), 2.8, MID, h + 2.7, F - 1.1, INK, 1.1);
        return;
      }
      const h = 15 + c.v;
      walls(b, c, 5.6, h);
      b.pane(c.s.window, 4.6, 2.2, MID, 1.6, F + 0.06, { glow: c.glow * 0.8, rough: 0.3 }); b.box(c.s.trim, 0.08, 2.2, 0.06, MID, 0.5, F + 0.08); b.box(c.accent, 5, 0.25, 0.9, MID, 2.9, F + 0.4);
      for (let floor = 0; floor * 1.7 + 6 < h; floor++) {
        b.box(c.s.trim, 5.6, 0.1, 0.08, MID, 3.9 + floor * 1.7, F + 0.03);
        for (let i = 0; i < 4; i++) { const on = roll(i + floor * 5, c.v + 2); if (on > 0.4) b.pane(on > 0.75 ? '#9EE7FF' : c.s.window, 0.9, 1, 1.55 + i * 1.3, 4.8 + floor * 1.7, F + 0.05, { glow: c.glow, rough: 0.3 }); else b.pane(shade(c.wall, 0.6), 0.9, 1, 1.55 + i * 1.3, 4.8 + floor * 1.7, F + 0.05); }
      }
      for (const x of [2.3, 4.7]) b.box(INK, 0.12, 1, 0.12, x, h + 0.3, F - 1.2);
      poster(b, `neon-mascot:${c.accent}`, mark('mascot', '#0E0B24', neon('cup', c.accent)), 2.8, MID, h + 2.7, F - 1.1, INK, 1.1);
    },
  },
  {
    build(b, c) {
      if (b.model('sf3_neon_cafe_7m', MID, 0, -8)) {
        b.sign('badge:glass', mark('badge', c.s.window, board('cup', INK, c.s.window, c.accent), 0.04), 1.2, 1.2, 3.6, 2.3, F + 0.13, { glow: c.glow * 0.8, sharp: true });
        poster(b, `neon-open:${c.other}`, neon('OPEN', c.other), 1.1, 5.5, 3.75, F + 0.5, INK, 2.4);
        for (let i = 0; i < 4; i++) b.sign(`neon-${'CAFE'[i]}:${c.accent}`, neon('CAFE'[i], c.accent), 1.1, 1.1, 1.7 + i * 1.2, 6.35, F - 1.28, { glow: 2.2 });
        return;
      }
      walls(b, c, 6.4, 4.4);
      b.box(c.s.trim, 4.2, 2.7, 0.12, 2.6, 0.6, F + 0.04); b.pane(c.s.window, 3.9, 2.4, 2.6, 1.95, F + 0.11, { glow: c.glow * 1.5, rough: 0.3 });
      for (const x of [1.3, 3.9]) b.box(c.s.trim, 0.07, 2.4, 0.04, x, 0.75, F + 0.13);
      b.box(c.s.trim, 4, 0.9, 0.5, 2.6, 0.75, F - 0.4); for (const x of [1.4, 2.2, 3.4]) b.ball(INK, 0.26, 0.3, 0.2, x, 2, F - 0.5);
      b.sign('badge:glass', mark('badge', c.s.window, board('cup', INK, c.s.window, c.accent), 0.04), 1.2, 1.2, 3.6, 2.3, F + 0.13, { glow: c.glow * 0.8, sharp: true });
      door(b, c, 5.5); awning(b, MID, 3.5, 6.1, [c.accent, INK], 1.2);
      poster(b, `neon-open:${c.other}`, neon('OPEN', c.other), 1.1, 5.5, 3.75, F + 0.5, INK, 2.4);
      for (const x of [1.4, 5.6]) b.box(INK, 0.1, 1.2, 0.1, x, 4.7, F - 1.4);
      b.box(INK, 5, 1.5, 0.2, MID, 5.6, F - 1.4); for (let i = 0; i < 4; i++) b.sign(`neon-${'CAFE'[i]}:${c.accent}`, neon('CAFE'[i], c.accent), 1.1, 1.1, 1.7 + i * 1.2, 6.35, F - 1.28, { glow: 2.2 });
      b.disc(c.s.window, 3, 2.8, 0.03, -4.2, { turn: [-90, 0, 0], flat: 0.2 });
    },
    models: [['signal__cafe_table', 1.6, -3.4, 0], ['signal__cafe_chair', 2.7, -3.4, -90]],
  },
  {
    build(b, c) {
      if (b.model('sf3_server_exchange_7m', MID, 0, -8)) {
        const h = 9 + c.v * 0.5;
        b.sign(`racks:${c.v}`, lights([MINT, GOLD, PINK, SKYBLUE], 16, 18, 0.55, '#0E0B24', c.v + 1), 5, h - 3.6, MID, (h + 3.2) / 2, F + 0.05, { glow: 1.6 });
        return;
      }
      const h = 9 + c.v * 0.5;
      walls(b, c, 5.8, h);
      b.sign(`racks:${c.v}`, lights([MINT, GOLD, PINK, SKYBLUE], 16, 18, 0.55, '#0E0B24', c.v + 1), 5, h - 3.6, MID, (h + 3.2) / 2, F + 0.05, { glow: 1.6 });
      for (const x of [1.4, 3.1]) { b.box(INK, 1.3, 1.6, 0.12, x, 0.6, F + 0.05); for (let y = 0.8; y < 2.1; y += 0.25) b.box(shade(c.wall, 1.4), 1.1, 0.06, 0.05, x, y, F + 0.13); }
      b.box(shade(STEEL, 0.5), 1.3, 2.8, 0.1, 5.2, 0, F + 0.06); b.ball(RED, 0.08, 0.08, 0.08, 5.6, 2.2, F + 0.14, { glow: 2.5 });
      for (const x of [1.6, 3.6]) { b.box(shade(STEEL, 0.55), 1.5, 1, 1.3, x, h + 0.3, F - 2); b.disc(INK, 0.4, x, h + 0.8, F - 1.34); }
      b.pipe(shade(STEEL, 0.5), 0.14, 3.4, 3.4, h + 0.9, F - 3.4); b.tube(shade(STEEL, 0.5), 0.14, 2, 5.2, h + 0.3, F - 3.4);
    },
  },
  {
    build(b, c) {
      if (b.model('sf3_vending_alley_7m', MID, 0, -8)) {
        poster(b, `neon-bean:${c.other}`, neon('bean', c.other), 1.6, 5.4, 1.9, F + 0.3, INK, 1.8);
        return;
      }
      b.box(c.wall, 6.8, 3.2, 0.5, MID, 0, F); b.box(c.s.trim, 7, 0.2, 0.7, MID, 3.2, F);
      poster(b, `neon-bean:${c.other}`, neon('bean', c.other), 1.6, 5.4, 1.9, F + 0.3, INK, 1.8);
      [[1.5, c.accent], [3, SKYBLUE]].forEach(([x, color], i) => {
        b.box(color as string, 1.3, 2.5, 0.9, x as number, 0, F + 0.75); b.pane(WHITE, 1, 1.3, x as number, 1.65, F + 1.21, { glow: 1.2 });
        for (let row = 0; row < 3; row++) for (let can = 0; can < 4; can++) b.box([RED, GOLD, MINT, PINK][(can + row + i) % 4], 0.14, 0.26, 0.04, (x as number) - 0.36 + can * 0.24, 1.15 + row * 0.4, F + 1.23, { glow: 0.5 });
        b.box(INK, 0.9, 0.24, 0.04, x as number, 0.35, F + 1.21);
      });
      lamp(b, c, 4.1, -3.4, 5.2);
      b.tube(shade(STEEL, 0.5), 0.36, 0.9, 6.2, 0, -4.6, { top: 1.15 });
    },
    models: [['signal__bench', 5.2, -2.6, 0, 1.1]],
  },
  {
    build(b, c) {
      if (b.model('sf3_billboard_garage_7m', MID, 0, -8)) {
        b.sign('logo:billboard', mark('logo', CREAM, board('bean', '#5A3520', CREAM, '#C98A55'), 0.02), 1.5 * markShape.logo, 1.5, MID, 7.9, F - 1.27, { glow: 0.7, sharp: true });
        return;
      }
      walls(b, c, 6, 3.4); b.box(shade(STEEL, 0.45), 3, 2.6, 0.1, 2.3, 0, F + 0.06); for (let y = 0.3; y < 2.5; y += 0.3) b.box(INK, 3, 0.04, 0.04, 2.3, y, F + 0.12);
      door(b, c, 5.2, 1.1, 2.6, false);
      for (const x of [1.6, 5.4]) b.tube(INK, 0.14, 2.6, x, 3.7, F - 1.5);
      b.box(INK, 6, 3.6, 0.3, MID, 6.1, F - 1.5); b.box(shade(c.wall, 1.3), 5.6, 3.2, 0.06, MID, 6.3, F - 1.33);
      b.pane(CREAM, 5.6, 3.2, MID, 7.9, F - 1.29, { glow: 0.5 }); b.sign('logo:billboard', mark('logo', CREAM, board('bean', '#5A3520', CREAM, '#C98A55'), 0.02), 1.5 * markShape.logo, 1.5, MID, 7.9, F - 1.27, { glow: 0.7, sharp: true });
      for (const x of [1.6, 3.5, 5.4]) { b.box(INK, 0.06, 0.06, 0.9, x, 9.8, F - 1); b.ball(c.s.window, 0.16, 0.16, 0.16, x, 9.75, F - 0.55, { glow: 2.4 }); }
    },
  },
  {
    build(b, c) {
      if (b.model('sf3_communications_hut_7m', MID, 0, -8)) {
        return;
      }
      b.box(c.wall, 3, 2.6, 3, MID, 0, F - 1.5); b.box(c.s.trim, 3.3, 0.2, 3.3, MID, 2.6, F - 1.5); b.pane(c.s.window, 0.8, 0.8, 2.9, 1.5, F + 0.02, { glow: c.glow });
      b.tube(shade(STEEL, 0.4), 1.5, 16, MID, 2.8, F - 1.5, { top: 0.12, sides: 4 });
      for (let y = 5; y < 18; y += 2.6) { const r = 1.5 * (1 - (y - 2.8) / 18); b.tube(shade(STEEL, 0.7), r * 1.05, 0.14, MID, y, F - 1.5, { sides: 4 }); }
      for (const [y, side] of [[10, -1], [12.4, 1], [14.5, -1]]) { b.ball(STEEL, 0.75, 0.75, 0.22, MID + side * 0.9, y, F - 0.9, { turn: [0, side * 30, 0] }); b.ball(INK, 0.1, 0.1, 0.3, MID + side * 0.95, y, F - 0.7); }
      for (const y of [8, 13, 18.9]) b.ball(RED, 0.18, 0.18, 0.18, MID, y, F - 0.4 - (18.9 - y) * 0.06, { glow: 3 });
      b.tube(INK, 0.05, 2.4, MID, 18.8, F - 1.5);
      for (let i = 0; i < 7; i++) b.box(INK, 0.06, 1.8, 0.06, 0.3 + i, 0, F + 0.6); b.box(INK, 6.6, 0.06, 0.06, MID, 1.7, F + 0.6);
    },
  },
];



const orbitVariants = ['orb4_near_variant_0', 'orb4_near_variant_1', 'orb4_near_variant_2', 'orb4_near_variant_3'] as const;

const foam: readonly Piece[] = [
  {
    build(b, c) {
      if (b.model('orb3_cup_eyes_station_7m', MID, 0, -4.4)) {
        puffs(b, 3, 6.2, -4.4, WHITE, 0.3, 3);
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      foamBank(b, c.v);
      b.tube(CREAM, 3.3, 0.24, MID, 0, -4.4, { sides: 28 });
      b.tube('#FFC740', 1.8, 3.4, MID, 0.24, -4.4, { top: 1.38, sides: 28, rough: 0.5 }); b.ring('#FFC740', 1, 0.5, MID + 2.7, 2.1, -4.4);
      b.tube(INK, 2.5, 0.1, MID, 3.6, -4.4, { sides: 28 }); b.dome('#17130F', 2.44, 2.2, 2.44, MID, 3.66, -4.4, { rough: 0.6 });
      for (const side of [-0.75, 0.75]) b.ball(WHITE, 0.26, 0.42, 0.14, MID + side, 4.75, -2.25, { glow: c.glow * 0.6 });
      puffs(b, 3, 6.2, -4.4, WHITE, 0.3, 3);
      b.box(INK, 1.3, 2, 0.5, 2.9, 0.24, -2.72); b.box(CREAM, 1.1, 1.9, 0.5, 2.9, 0.24, -2.68); b.ball(INK, 0.07, 0.07, 0.07, 3.25, 1.2, -2.4);
    },
  },
  {
    build(b, c) {
      if (b.model('orb3_sugar_constellation_7m', MID, 0, -4.4)) {
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      foamBank(b, c.v + 1);
      const cubes: readonly [number, number, number, number, number][] = [[1.2, 0, -4.4, 12, 1.2], [2.6, 0, -4, -8, 1.2], [1.9, 1.2, -4.2, 30, 1.1], [4.4, 0, -4.8, 20, 1.3], [5.6, 0.1, -3.6, 0, 1], [4.6, 1.3, -4.7, -15, 1]];
      cubes.forEach(([x, y, z, turn, size], i) => { b.box(i === 4 ? PINK : WHITE, size, size, size, x, y, z, { turn: [i === 4 ? 18 : 0, turn, i === 4 ? 14 : 0], rough: 1 }); });
      for (let i = 0; i < 6; i++) b.ball(WHITE, 0.12, 0.12, 0.12, 0.8 + i * 1.1, 0.12, -2.6 - roll(i, 3) * 0.8);
    },
  },
  {
    build(b, c) {
      if (b.model('orb3_spoon_bean_garden_7m', MID, 0, -4.4)) {
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      foamBank(b, c.v + 2);
      b.dome(WHITE, 1.7, 0.8, 1.3, 3.2, 0, -4.4, { rough: 1 });
      b.box(STEEL, 0.3, 6, 0.14, 3.6, 0.3, -4.4, { turn: [0, 0, -10], rough: 0.25 });
      b.ball(STEEL, 0.85, 1.2, 0.28, 4.2, 7, -4.4, { turn: [0, 0, -10], rough: 0.25 }); b.ball(shade(STEEL, 0.85), 0.6, 0.9, 0.12, 4.2, 7, -4.2, { turn: [0, 0, -10], rough: 0.25 });
      bean(b, 1.2, 0.5, -3, 0.5, 20); bean(b, 5.8, 0.4, -3.4, 0.4, -30);
    },
  },
  {
    build(b, c) {
      if (b.model('orb3_drifting_bean_cluster_7m', MID, 0, -4.4)) {
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      foamBank(b, c.v + 3);
      bean(b, 2.4, 5, -5, 1.5, 25); bean(b, 4.6, 3.6, -4.6, 0.7, -15); bean(b, 5.6, 2.7, -4.3, 0.5, 30); bean(b, 6.3, 2, -4.1, 0.34, -5);
      for (const [x, y] of [[2.2, 3.2], [3, 3], [4.6, 2.4]]) b.ball(WHITE, 0.5, 0.3, 0.4, x, y, -5, { rough: 1 });
      b.dome('#FFF4E6', 1.4, 0.6, 1, 5.4, 0, -3.6, { rough: 1 });
    },
  },
  {
    build(b, c) {
      if (b.model('orb3_tripod_moka_robot_7m', MID, 0, -4.4)) {
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      foamBank(b, c.v + 4);
      for (const [x, z] of [[2.5, -3.8], [4.5, -3.8], [3.5, -5.4]]) b.box(INK, 0.16, 1.5, 0.16, x, 0, z, { turn: [0, 0, (x - 3.5) * 12] });
      pot(b, MID, 1.3, -4.6, 1.5, c.v % 2 ? PINK : STEEL);
      for (const [x, y] of [[3, 2.2], [4, 2.2], [3.5, 4]]) { b.disc(c.s.window, 0.3, x, y, -3.3 - (y > 3 ? 0.1 : 0), { glow: c.glow * 1.4 }); b.ring(INK, 0.32, 0.1, x, y, -3.3 - (y > 3 ? 0.1 : 0)); }
      b.tube(INK, 0.04, 1.4, 3.5, 5.4, -4.6); b.ball(RED, 0.16, 0.16, 0.16, 3.5, 6.9, -4.6, { glow: 2.5 });
      for (const side of [-1, 1]) b.ridge(c.accent, 0.2, 1.6, 1.2, MID + side * 1.7, 1.2, -4.6, side);
    },
  },
  {
    build(b, c) {
      if (b.model('orb3_latte_heart_hill_7m', MID, 0, -4.4)) {
        b.model(orbitVariants[c.v], MID, 0, -4.4);
        return;
      }
      b.dome(WHITE, 3.3, 1.7, 2.4, MID, 0, -4.6, { rough: 1 }); b.dome('#FFF4E6', 1.6, 0.9, 1.4, 0.9, 0, -5.4, { rough: 1 }); b.dome('#FFF4E6', 1.8, 1, 1.4, 6.2, 0, -5.2, { rough: 1 });
      const latte = '#C98A55';
      for (const side of [-0.42, 0.42]) b.ball(latte, 0.56, 0.56, 0.2, MID + side, 1.25, -2.75, { turn: [-38, 0, 0] });
      b.box(latte, 0.86, 0.86, 0.2, MID, 0.36, -2.36, { turn: [-38, 0, 45] });
      bean(b, 5.9, 0.4, -2.8, 0.4, 20);
    },
  },
];



const MARBLE = '#FFFDF6', GILT = '#F2C94C';
function column(b: Build, x: number, z: number, h: number) {
  b.box(GILT, 1.1, 0.3, 1.1, x, 0, z); b.tube(MARBLE, 0.4, h, x, 0.3, z, { sides: 16, rough: 0.5 }); b.box(GILT, 1.2, 0.35, 1.2, x, h + 0.3, z);
}
const heaven: readonly Piece[] = [
  { build(b, c) { if (b.model('div3_near_00_7m', MID, 0, -6.5)) return; foamBank(b, c.v); column(b, MID - 2, F - 1.5, 6); column(b, MID + 2, F - 1.5, 6); b.box(MARBLE, 6, 0.8, 1.6, MID, 6.65, F - 1.5); b.box(GILT, 6.4, 0.2, 1.9, MID, 7.45, F - 1.5); } },
  { build(b, c) { if (b.model('div3_near_01_7m', MID, 0, -6.5)) return; foamBank(b, c.v + 3); column(b, MID, F - 2, 8.5); b.ball(GILT, 0.7, 0.7, 0.7, MID, 9.9, F - 2, { glow: 1.2, rough: 0.3 }); } },
  { build(b, c) { if (b.model('div3_near_02_7m', MID, 0, -6.5)) return; foamBank(b, c.v + 5); foamBank(b, c.v + 9); } },
  { build(b, c) { if (b.model('div3_near_03_7m', MID, 0, -6.5)) return; foamBank(b, c.v + 1); for (const [x, h] of [[MID - 2.4, 4.5], [MID, 7], [MID + 2.4, 4.5]] as const) column(b, x, F - 2.2, h); } },
  { build(b, c) { if (b.model('div3_near_04_7m', MID, 0, -6.5)) return; foamBank(b, c.v + 7); b.ring(GILT, 2.2, 0.22, MID, 4.4, F - 2.5, { glow: 0.8, rough: 0.3 }); column(b, MID, F - 2.5, 2); } },
  { build(b, c) { if (b.model('div3_near_05_7m', MID, 0, -6.5)) return; foamBank(b, c.v + 2); column(b, MID - 1.2, F - 1.2, 3.2); column(b, MID + 1.6, F - 3, 5.4); } },
];

const nothing: readonly Piece[] = Array.from({ length: 6 }, () => ({ build() {} }));

export const pieces: readonly (readonly Piece[])[] = [street, roastery, night, foam, heaven, nothing];

export const skylines: readonly Skyline[] = [taipei, hsinchu, bay, orbit, temple, blank];


const SIGHT = { size: 0.62, lift: 5 };

export const SIGHT_MARGIN = 1 + Math.ceil(Math.max(...skylines.flatMap(({ sights }) => sights.map(sight => sight.reach))) * SIGHT.size / FAR_TILE);


export function sightOn(b: Build, place: number, which: number) {
  b.scaled(SIGHT.size, FAR_TILE / 2, -66, SIGHT.lift, () => skylines[place].sights[which].build(b, FAR_TILE / 2, -66, scenes[place].stars ? 1.4 : 0));
}

// A second row behind the existing shops. Leave a gap in front of each landmark,
// and keep the void empty. Scales fit these metre-sized modules to a 14 m tile.
const middleRows: readonly (readonly (readonly [ModelId, number])[])[] = [
  [['tpe3_corner_cafe_7m', 0.78], ['tpe5_bubble_tea_shop_7m', 0.74], ['tpe5_gabled_cafe_7m', 0.76], ['tpe3_arcade_apartment_7m', 0.74]],
  [['hsinchu_tank_pair_v2', 0.28], ['hsinchu_pipe_gantry_v2', 0.21], ['hsinchu_utility_hall_v2', 0.22]],
  [['sf3_highrise_shop_7m', 0.66], ['sf3_neon_cafe_7m', 0.8]],
  [['orb3_cup_eyes_station_7m', 0.8], ['orb3_tripod_moka_robot_7m', 0.82], ['orb3_foam_bank', 0.9]],
  [['div3_near_00_7m', 0.8]],
  [],
];

/**
 * One 14 m stretch of the skyline of place `place`. `sight` is the landmark that stands on it (-1 for none), `near`
 * the ones standing on other stretches close enough to reach this one, as [stretches away, which landmark].
 */
export function skyline(b: Build, place: number, v: number, sight: number, train: boolean, near: readonly (readonly [number, number])[] = []) {
  const s = scenes[place], color = s.far.color, shape = s.far.shape, lit = s.stars ? 1.4 : 0, { sights, behind } = skylines[place];
  if (sight >= 0) sightOn(b, place, sight);
  if (shape === 'none') return;

  const taken = [...near, ...sight >= 0 ? [[0, sight] as const] : []].map(([away, which]) => [(away + 0.5) * FAR_TILE - sights[which].reach * SIGHT.size, (away + 0.5) * FAR_TILE + sights[which].reach * SIGHT.size] as const);
  behind?.(b, FAR_TILE, train, lit);
  const row = middleRows[place];
  if (row.length && !taken.some(([a, b]) => a < FAR_TILE && b > 0)) {
    const [id, size] = row[v % row.length];
    if (v !== 3 || place === 0) b.model(id, FAR_TILE / 2, 0, -29, size);
    if (v === 2 && (place === 0 || place === 2)) {
      if (place === 0) {
        b.model('tpe5_distant_hill', FAR_TILE / 2, 0, -108, 0.7);
        b.model('tpe5_skyline_block', FAR_TILE / 2, 0, -99, 0.6);
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const back = i % 2, x = i * 2.4 + roll(i, v) * 1.2, z = -40 - back * 30 - roll(i, v + 1) * 10, w = 4 + roll(i, v + 2) * 3.4, tone = shade(color, back ? 1.06 : 0.94);
    if (taken.some(([from, to]) => x + w / 2 > from && x - w / 2 < to)) continue;
    if (shape === 'foam') { const r = 6 + roll(i, v + 3) * 6 + back * 6;
      if (b.model(place === 3 ? 'orb4_far_foam_dome' : 'div3_cloud_bank', x, 0, z, r / 5)) continue;
      b.dome(back ? '#F3E3D3' : color, r * 1.3, r * 0.75, r, x, 0, z, { rough: 1 }); continue; }
    const h = (shape === 'towers' ? 12 + roll(i, v + 3) * 16 : 8 + roll(i, v + 3) * 14) * (1 + back * 0.6);
    if (place === 0 && b.model((['tpe5_far_tower_0', 'tpe5_far_tower_1', 'tpe5_far_tower_2'] as const)[i % 3], x, 0, z, [w / 5, h / 20, 1])) continue;
    if (place === 2 && b.model((['sf4_far_block_0', 'sf4_far_block_1', 'sf4_far_block_2'] as const)[i % 3], x, 0, z, [w / (5 + i % 3), h / [18, 28, 37][i % 3], 1])) continue;
    b.box(tone, w, h, 6, x, 0, z);
    if (shape === 'towers') {
      b.sign(`far-lights:${i % 3}`, lights(s.far.lights ?? [GOLD], 6, 16, 0.4, tone, i % 3 + 7), w * 0.84, h * 0.9, x, h * 0.5, z + 3.02, { glow: 1.3 });
      if (roll(i, v + 5) > 0.5) { b.tube(tone, 0.14, 4, x, h, z); b.ball(RED, 0.3, 0.3, 0.3, x, h + 4, z, { glow: 3 }); }
    } else if (shape === 'roofs') {
      if (roll(i, v + 5) > 0.45) b.ridge(tone, w + 0.4, 2.4, 6.2, x, h, z); else b.box(tone, 0.9, 2, 0.9, x + w * 0.2, h, z);
      for (let k = 0; k < 3; k++) if (roll(i * 3 + k, v + 6) > 0.4) b.pane(s.window, 0.7, 0.9, x - w * 0.28 + k * w * 0.28, h * 0.55, z + 3.02, { glow: 0.3 });
    } else if (roll(i, v + 5) > 0.5) {
      const tip = 5 + roll(i, v + 6) * 6; b.tube(tone, 0.6, tip, x + w * 0.2, h, z, { top: 0.7 }); puffs(b, x + w * 0.2, h + tip + 0.8, z, '#FFD9A8', 0.8, 3);
    } else for (let k = 0; k < 2; k++) b.ridge(tone, w / 2, 1.8, 6, x - w / 4 + k * w / 2, h, z, 1);
  }
}


export function groundMarks(b: Build, s: Scene) {
  const place = scenes.indexOf(s);
  if (place === 2 && b.model('sf4_ground_7m', 0, 0, 0)) return;
  if (place === 3 && b.model('orb4_ground_7m', MID, 0, 0)) return;
  if (place === 4 && b.model('div3_causeway_7m', MID, 0, 0)) return;
  if (place === 5 && b.model('void3_ground_7m', MID, 0, 0)) return;
  const joint = shade(s.walk, 0.88);
  if (s.laneShape === 'bean') {
    for (const x of [1.4, 4.9]) { b.ball(s.lane, 0.5, 0.02, 0.3, x, -0.17, 5); b.ball(shade(s.lane, 0.6), 0.42, 0.025, 0.04, x, -0.17, 5); }
    for (let i = 0; i < 5; i++) b.dome(WHITE, 0.5 + roll(i, 2) * 0.5, 0.16, 0.5, 0.6 + i * 1.4, 0, -1.4 - roll(i, 5) * 4, { rough: 1 });
    return;
  }
  for (const x of [0, 3.5]) b.box(joint, 0.06, 0.02, -F - 0.8, x, 0, (F - 0.6) / 2);
  b.box(joint, TILE, 0.02, 0.06, MID, 0, -3.4);
  b.box(s.lane, 3, 0.02, 0.32, 2, -0.18, 5, { glow: s.stars ? 0.5 : 0 });
  b.box(shade(s.road, 0.7), 0.9, 0.02, 0.5, 5.6, -0.18, 0.2);
}
