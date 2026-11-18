
import { type Build, shade, type Skyline } from './street3d-kit';

const MARBLE = '#FFFDF6', STONE = '#EFE4CC', GILT = '#F2C94C', GILT_DARK = '#B8923A', RACK = '#161A2C', NAVY = '#233472', BLUE = '#3A6FD8', CLOUD = '#FFFFFF';
const LIGHT = '#FFF3B8', CYAN = '#7DF9FF', ROCK = '#DCCBA6', LAWN = '#B9DE98', LEAF = '#8CCB8F', MIST = '#FFF0C0';
const deg = (radians: number) => radians * 180 / Math.PI, rad = (degrees: number) => degrees * Math.PI / 180;


function hoop(b: Build, color: string, r: number, thick: number, depth: number, x: number, y: number, z: number, glow = 0, from = 0, to = 360) {
  const parts = Math.max(6, Math.ceil(r * 2.2 * (to - from) / 360)), length = r * rad(to - from) / parts * 1.08;
  for (let i = 0; i < parts; i++) {
    const a = rad(from + (i + 0.5) * (to - from) / parts);
    b.box(color, length, thick, depth, x + Math.cos(a) * r, y + Math.sin(a) * r - thick / 2, z, { turn: [0, 0, deg(a) + 90], glow });
  }
}


function rays(b: Build, color: string, x: number, y: number, z: number, from: number, to: number, count: number, width: number, opacity: number, start = 0) {
  for (let i = 0; i < count; i++) {
    const a = rad(start + i * 360 / count), mid = (from + to) / 2;
    b.pane(color, width, to - from, x + Math.cos(a) * mid, y + Math.sin(a) * mid, z, { flat: opacity, turn: [0, 0, deg(a) - 90] });
  }
}

const PUFFS = [[0, 0, 0, 1], [-1.1, -0.15, 0.3, 0.75], [1.15, -0.1, 0, 0.8], [0.35, 0.4, 0.4, 0.7], [-0.4, 0.35, -0.3, 0.65], [1.9, -0.3, 0.2, 0.5], [-1.9, -0.3, 0, 0.5]] as const;

function cloud(b: Build, x: number, y: number, z: number, s: number, color = CLOUD) {
  for (const [dx, dy, dz, k] of PUFFS) b.ball(color, 3.2 * s * k, 1.9 * s * k, 2.6 * s * k, x + dx * s * 3, y + dy * s * 2, z + dz * s * 2.6, { rough: 1 });
}


function column(b: Build, x: number, y: number, z: number, h: number, lit: number) {
  b.box(GILT_DARK, 4, 0.6, 4, x, y, z); b.tube(MARBLE, 1.75, 0.7, x, y + 0.6, z, { sides: 24 }); b.tube(GILT, 1.6, 0.35, x, y + 1.3, z, { sides: 24 });
  b.tube(MARBLE, 1.45, h - 3.6, x, y + 1.65, z, { top: 0.92, sides: 16, rough: 0.6 });
  b.pane(LIGHT, 0.22, h - 5.6, x, y + h / 2 - 0.2, z + 1.42, { glow: 0.9 + lit * 0.6 });
  b.tube(GILT, 1.5, 0.4, x, y + h - 1.95, z, { sides: 24 }); b.tube(GILT, 1.4, 0.8, x, y + h - 1.55, z, { top: 1.45, sides: 24, glow: 0.2 });
  b.box(MARBLE, 4.2, 0.75, 4.2, x, y + h - 0.75, z);
}


function serverTemple(b: Build, x: number, z: number, lit: number) {
  const tiers = 7, rise = 1.4, base = tiers * rise, cols = 8, gap = 5.4, span = gap * (cols - 1), front = z + 10, h = 24, floor = base + 0.5;
  for (let i = 0; i < tiers; i++) {
    const w = 58 - i * 1.9, d = 40 - i * 1.9, y = i * rise;
    b.box(i % 2 ? shade(MARBLE, 0.96) : MARBLE, w, rise, d, x, y, z); b.box(GILT, w + 0.1, 0.14, d + 0.1, x, y + rise - 0.14, z);
  }
  b.box(shade(STONE, 0.97), 30, h + 0.8, 14, x, base, z - 1.4);
  for (const side of [-1, 1]) b.box(GILT, 0.4, h * 0.6, 0.5, x + side * 4.6, base + 0.6, z + 5.7);
  b.box(GILT, 9.6, 0.5, 0.5, x, base + 0.6 + h * 0.6, z + 5.7);
  b.pane(LIGHT, 8.8, h * 0.6, x, base + 0.6 + h * 0.3, z + 5.62, { glow: 1.5 + lit * 0.5 });
  for (let i = 0; i < cols; i++) column(b, x - span / 2 + i * gap, floor, front, h, lit);
  for (const side of [-1, 1]) for (let k = 1; k <= 4; k++) column(b, x + side * span / 2, floor, front - k * 5, h, lit);
  const top = floor + h, wide = span + 7;
  b.box(MARBLE, wide, 2.4, 26.4, x, top, z); b.box(GILT, wide + 0.6, 0.3, 27, x, top + 2.4, z);
  b.box(shade(MARBLE, 0.97), wide - 0.6, 2.6, 26, x, top + 2.7, z);
  for (let i = 0; i < 12; i++) b.disc(GILT, 0.55, x - wide / 2 + 1.6 + (i + 0.5) * (wide - 3.2) / 12, top + 4, z + 13.02, { glow: 0.3 });
  b.box(MARBLE, wide + 1.6, 0.9, 27.6, x, top + 5.3, z); b.box(GILT, wide + 2.2, 0.35, 28.2, x, top + 6.2, z);
  const roof = top + 6.55, span2 = wide + 1.6;
  b.ridge(MARBLE, 26, 8.6, span2, x, roof, z, 0, { turn: [0, 90, 0] });
  b.ridge(GILT, 26.8, 8.6, span2 - 0.2, x, roof, z, 0, { turn: [0, 90, 0] }); b.ridge(shade(STONE, 1.02), 27.4, 7, span2 - 3.6, x, roof + 0.4, z, 0, { turn: [0, 90, 0] });
  const sun = roof + 3;
  b.disc(GILT, 2.6, x, sun, z + 13.9, { glow: 0.8 + lit * 0.4, rough: 0.3 }); hoop(b, GILT, 3.4, 0.35, 0.3, x, sun, z + 13.85, 0.5);
  rays(b, GILT, x, sun, z + 13.8, 3.9, 5.2, 12, 0.35, 0.6);
  for (const side of [-1, 1]) { b.ball(GILT, 1.1, 1.4, 1.1, x + side * (span2 / 2 - 0.6), roof + 0.9, z + 12.4, { glow: 0.5, rough: 0.3 }); b.box(MARBLE, 3.4, 1.2, 3.4, x + side * (span2 / 2 - 1.2), roof - 0.1, z + 12.4); }
  b.ball(GILT, 1.3, 1.8, 1.3, x, roof + 9.6, z + 12.6, { glow: 0.7 + lit * 0.4, rough: 0.3 });
  const halo = roof + 11, ahead = z - 3;
  rays(b, GILT, x, halo, ahead, 14, 22, 16, 1.2, 0.3);
  hoop(b, GILT, 12.5, 0.8, 0.8, x, halo, ahead, 0.7 + lit * 0.4); hoop(b, LIGHT, 10.8, 0.35, 0.5, x, halo, ahead, 1.2 + lit * 0.4);
  cloud(b, x - 28, 2.4, z + 8, 2); cloud(b, x + 27, 3.2, z + 6, 2.2); cloud(b, x - 10, 0.6, z + 23, 3); cloud(b, x + 12, 0.4, z + 24, 3.2); cloud(b, x - 31, 5, z - 6, 1.6); cloud(b, x + 31, 6, z - 8, 1.6); cloud(b, x, 3, z - 22, 3.4);
}


const slope = (rise: number, run: number, y0: number, z0: number) => (s: number, up = 0): [number, number] => {
  const len = Math.hypot(rise, run);
  return [y0 + rise + s * rise + up * run / len, z0 - s * run + up * rise / len];
};


function stairway(b: Build, x: number, z: number, lit: number) {
  const width = 16, steps = 36, rise = 1.1, run = 0.95, y0 = 1, front = z + 19, on = slope(rise, run, y0, front);
  const angle = deg(Math.atan2(rise, run)), hyp = Math.hypot(rise, run), length = steps * hyp, [midY, midZ] = on(steps / 2, -4.6);
  for (let i = 0; i < steps; i++) {
    const top = y0 + (i + 1) * rise, zc = front - (i + 0.5) * run;
    b.box(i % 2 ? shade(MARBLE, 0.9) : MARBLE, width, rise, run + 0.1, x, top - rise, zc);
    b.box(GILT, 5.2, 0.12, run + 0.14, x, top, zc); b.box(BLUE, 4.2, 0.2, run + 0.06, x, top, zc);
  }
  b.box(shade(MARBLE, 0.9), width, 7, length + 6, x, midY - 3.5, midZ, { turn: [angle, 0, 0] });
  for (const side of [-1, 1]) {
    const px = x + side * (width / 2 + 0.7), [wy, wz] = on(steps / 2, 0.5), [ry, rz] = on(steps / 2, 2.4);
    b.box(shade(MARBLE, 0.97), 1.4, 1.2, length + 1.4, px, wy - 0.6, wz, { turn: [angle, 0, 0] });
    b.box(GILT, 0.5, 0.35, length + 1.4, px, ry - 0.2, rz, { turn: [angle, 0, 0] });
    for (let s = 1; s < steps; s += 2) { const [by, bz] = on(s, 0); b.tube(GILT, 0.13, 1.9, px, by + 0.2, bz, { sides: 8 }); }
    for (let s = 0; s <= steps; s += 9) {
      const [ny, nz] = on(s, 0);
      b.box(MARBLE, 1.4, 2.8, 1.4, px, ny - 0.2, nz); b.box(GILT, 1.7, 0.4, 1.7, px, ny + 2.6, nz); b.ball(LIGHT, 0.55, 0.55, 0.55, px, ny + 3.5, nz, { glow: 1.2 + lit * 0.5 });
    }
  }
  for (const s of [9, 21]) {
    const [ay, az] = on(s, 0), gap = width / 2 + 0.7;
    for (const side of [-1, 1]) { b.tube(GILT, 0.4, 10, x + side * gap, ay - 0.3, az, { sides: 12 }); b.box(GILT_DARK, 1.4, 0.5, 1.4, x + side * gap, ay - 0.3, az); }
    b.box(GILT, width + 3, 0.8, 0.9, x, ay + 9.7, az); b.box(GILT_DARK, width + 4, 0.4, 1.2, x, ay + 10.5, az);
    b.box(GILT, width * 0.55, 0.5, 0.7, x, ay + 11.4, az); b.ball(LIGHT, 0.6, 0.6, 0.6, x, ay + 12.3, az, { glow: 1.4 + lit * 0.5 });
    hoop(b, GILT, 3.2, 0.3, 0.3, x, ay + 9.7, az + 0.2, 0.4, 0, 180);
  }
  const [gateY, gateZ] = on(steps, 0), baseY = gateY - rise, gz = gateZ - 5.2;
  b.box(shade(MARBLE, 0.97), width + 10, 1.4, 13, x, baseY - 0.2, gateZ - 5.2 + 0.6); b.box(GILT, width + 10.4, 0.3, 13.4, x, baseY + 1.2, gz + 0.6);
  const gy = baseY + 1.5;
  rays(b, LIGHT, x, gy + 11, gz - 3, 12, 28, 18, 1.8, 0.35, 10);
  hoop(b, GILT, 13, 1, 0.8, x, gy + 11, gz - 3, 0.7 + lit * 0.4); hoop(b, LIGHT, 11.4, 0.4, 0.5, x, gy + 11, gz - 3, 1.5 + lit * 0.4);
  b.box(LIGHT, 11.4, 15, 1, x, gy, gz - 0.4, { glow: 1.8 + lit * 0.5 }); b.box(GILT, 0.3, 15, 0.4, x, gy, gz + 0.2); b.box(GILT_DARK, 11.8, 0.4, 0.5, x, gy + 14.8, gz + 0.2);
  for (const side of [-1, 1]) {
    const gx = x + side * 8;
    b.box(MARBLE, 4.6, 19, 4.4, gx, gy, gz); b.box(GILT, 5, 0.6, 4.8, gx, gy, gz); b.box(GILT, 5, 0.4, 4.8, gx, gy + 6.5, gz); b.box(GILT, 5, 0.4, 4.8, gx, gy + 13, gz);
    b.box(GILT, 5.6, 1.2, 5.4, gx, gy + 19, gz); b.box(MARBLE, 4.6, 1, 4.6, gx, gy + 20.2, gz); b.ball(LIGHT, 1.2, 1.5, 1.2, gx, gy + 22.2, gz, { glow: 1.6 + lit * 0.5 });
    b.box(GILT_DARK, 0.5, 16, 0.4, gx + side * 1.4, gy + 1.5, gz + 2.3); b.box(GILT_DARK, 0.5, 16, 0.4, gx - side * 1.4, gy + 1.5, gz + 2.3);
  }
  b.box(MARBLE, 21.4, 3.6, 4.6, x, gy + 15, gz); b.box(GILT, 22, 0.5, 5, x, gy + 18.6, gz); b.box(GILT, 22, 0.4, 5, x, gy + 15, gz);
  b.ridge(STONE, 4.4, 3.8, 19, x, gy + 19.1, gz, 0, { turn: [0, 90, 0] }); b.ridge(GILT, 4.8, 4.2, 19.6, x, gy + 19, gz - 0.1, 0, { turn: [0, 90, 0] }); b.ridge(MARBLE, 4.5, 3.4, 17, x, gy + 19.3, gz + 0.25, 0, { turn: [0, 90, 0] });
  b.ball(LIGHT, 1.8, 1.8, 1, x, gy + 21.4, gz + 0.9, { glow: 2 + lit * 0.5 });
  const clouds: readonly (readonly [number, number, number, number])[] = [[-17, 6, 14, 1.9], [18, 9, 10, 1.9], [-19, 18, 2, 2], [20, 22, -4, 2], [-16, 31, -10, 1.8], [17, 36, -14, 1.9], [0, 3, 25, 2.4], [-9, 2, 24, 2], [10, 3, 26, 1.8], [-15, 46, -22, 1.9], [16, 48, -24, 1.8], [0, 36, -30, 2.2]];
  for (const [dx, y, dz, s] of clouds) cloud(b, x + dx, y, z + dz, s);
}


function fan(b: Build, x: number, y: number, z: number, r: number, lit: number) {
  b.disc(RACK, r, x, y, z); b.disc(shade(NAVY, 0.7), r * 0.5, x, y, z + 0.03);
  hoop(b, GILT, r + 0.3, 0.7, 0.9, x, y, z + 0.2); hoop(b, CYAN, r - 0.4, 0.3, 0.4, x, y, z + 0.4, 1.8 + lit * 0.4);
  for (let i = 0; i < 11; i++) {
    const a = rad(i * 360 / 11);
    b.ball(i % 2 ? '#E9F1FF' : '#BFD6FF', r * 0.46, r * 0.14, 0.18, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, z + 0.55, { turn: [0, 0, deg(a) + 32], rough: 0.5 });
  }
  b.disc(GILT, r * 0.26, x, y, z + 0.7, { rough: 0.3 }); b.dome(GILT_DARK, r * 0.2, 0.7, r * 0.2, x, y, z + 0.8, { turn: [90, 0, 0], rough: 0.3 });
}


function graphicsCard(b: Build, x: number, z: number, lit: number) {
  const length = 56, h = 22, thick = 5, y0 = 17, front = z + thick / 2, centre = y0 + h / 2;
  b.box('#1E2748', length, h, thick, x, y0, z);
  b.box('#2C3C72', length - 1.4, h - 1.4, 0.5, x, y0 + 0.7, front + 0.05);
  for (const edge of [0.35, h - 0.35]) b.box(GILT, length, 0.7, thick + 0.4, x, y0 + edge - 0.35, z);
  for (const side of [-1, 1]) b.box(GILT, 0.7, h, thick + 0.4, x + side * (length / 2 - 0.35), y0, z);
  for (const edge of [1.9, h - 1.9]) b.box(CYAN, length - 3, 0.5, 0.3, x, y0 + edge - 0.25, front + 0.35, { glow: 2 + lit * 0.4 });
  for (const side of [-1, 1]) b.box(CYAN, 0.5, h - 3.6, 0.3, x + side * (length / 2 - 1.9), y0 + 1.8, front + 0.35, { glow: 2 + lit * 0.4 });
  for (const dx of [-18.5, 0, 18.5]) fan(b, x + dx, centre, front + 0.3, 7.6, lit);
  for (const dx of [-9.25, 9.25]) { b.box(GILT, 1, h - 5, 0.5, x + dx, y0 + 2.5, front + 0.4); b.box(GILT_DARK, 0.4, h - 5.8, 0.3, x + dx, y0 + 2.9, front + 0.7); }
  for (let i = 0; i < 4; i++) { b.box('#E9F1FF', 5 - i * 0.5, 0.3, 0.3, x - 24 + (5 - i * 0.5) / 2 - 0.5, y0 + h - 3.4 - i * 0.7, front + 0.4); b.pane(i % 2 ? CYAN : LIGHT, 0.5, 0.5, x + 22.5, y0 + 3 + i * 0.9, front + 0.5, { glow: 2 }); }
  const fins = 56;
  for (let i = 0; i < fins; i++) b.box(i % 2 ? GILT : shade(GILT, 0.92), 0.42, 5.6, thick - 0.8, x - length / 2 + 1.5 + i * (length - 3) / (fins - 1), y0 + h, z, { rough: 0.35 });
  for (const py of [1.3, 2.9, 4.5]) { b.pipe('#E08A3C', 0.5, length + 1.6, x, y0 + h + py, z, 'x', { rough: 0.3 }); }
  b.box(GILT_DARK, length - 0.4, 0.6, thick - 0.4, x, y0 + h + 5.6, z); b.box(GILT, length - 3, 0.4, thick - 1.4, x, y0 + h + 6.2, z);
  b.box(CYAN, length - 4, 0.4, 0.3, x, y0 + h + 5.9, front - 0.1, { glow: 2 + lit * 0.4 });
  b.box('#E8E2D2', 0.9, h + 4, thick + 3, x - length / 2 - 0.5, y0 - 2, z - 0.5); for (let i = 0; i < 3; i++) b.box(RACK, 0.4, 2.6, 2.4, x - length / 2 - 1, y0 + 1.5 + i * 5.5, z - 0.5);
  b.box(GILT, 16, 2.4, 0.9, x - 6, y0 - 2.4, z); for (let i = 0; i < 13; i++) b.box(RACK, 0.22, 1.7, 0.2, x - 12 + i * 1.2, y0 - 2.2, z + 0.5);
  b.box('#2C3C72', 6, 3, 3.2, x + 17, y0 + h + 0.2, z - 0.4); b.box(CYAN, 5, 0.5, 0.2, x + 17, y0 + h + 3, z + 1.3, { glow: 2 });
  const halo = y0 + h + 15.5, behind = z - 3.4;
  rays(b, GILT, x, halo, behind, 10.5, 17, 14, 1.2, 0.4);
  hoop(b, GILT, 9.4, 0.9, 0.8, x, halo, behind, 0.7 + lit * 0.4); hoop(b, CYAN, 7.9, 0.35, 0.5, x, halo, behind, 1.5 + lit * 0.4);
  for (const [dx, y, dz, s] of [[-24, 11, 4, 2.2], [-9, 8, 7, 2.6], [8, 10, 6, 2.4], [24, 12, 3, 2.2], [0, 6, 12, 3], [-33, 15, 0, 1.4], [34, 16, 0, 1.4], [-16, 9, -6, 2.4], [16, 9, -8, 2.4]]) cloud(b, x + dx, y, z + dz, s);
  for (const [dx, y, dz] of [[-30, 33, 3], [31, 40, 2], [-26, 46, 2], [27, 29, 3], [-35, 24, 1], [36, 36, 2]]) b.ball(LIGHT, 0.45, 0.45, 0.45, x + dx, y, z + dz, { glow: 2 });
}


function island(b: Build, x: number, z: number, top: number) {
  b.tube(ROCK, 3.5, 15, x, top - 16, z, { top: 4.7, sides: 32 });
  for (const [dx, dz, r, len] of [[0, 0, 0.3, 10], [-6, 2, 0.3, 6.5], [5.5, 3, 0.3, 7], [-3, -6, 0.3, 6], [6, -4, 0.3, 5.5], [-9, -2, 0.3, 4]]) b.tube(shade(ROCK, 0.92), r, len, x + dx, top - 15 - len + 1.5, z + dz, { top: 11, sides: 10 });
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 + 10), run = 11 + (i % 3) * 1.6, y = top - 3.5 - (i % 4) * 2.2;
    b.ball(i % 2 ? ROCK : shade(ROCK, 0.92), 3.2, 2.2, 3, x + Math.cos(a) * run, y, z + Math.sin(a) * run, { rough: 1 });
  }
  b.tube(STONE, 17, 0.9, x, top - 1, z, { sides: 36 }); b.tube(GILT_DARK, 17.2, 0.2, x, top - 0.2, z, { sides: 36 });
  b.tube(LAWN, 16.4, 0.5, x, top - 0.1, z, { sides: 36, rough: 1 });
}


function tree(b: Build, x: number, y: number, z: number, tall: boolean) {
  b.tube('#B58B5A', 0.3, tall ? 1.2 : 2, x, y, z, { sides: 8 });
  if (tall) b.tube(shade(LEAF, 0.85), 1.5, 6, x, y + 1, z, { top: 0.1, sides: 10, rough: 1 }); else b.ball(LEAF, 2, 1.9, 2, x, y + 3.4, z, { rough: 1 });
}


function cloudIsland(b: Build, x: number, z: number, lit: number) {
  const top = 30, rx = x - 2, rz = z - 2, ground = top + 0.4, floor = ground + 1.1, ring = 7.6, pillar = 9.2;
  island(b, x, z, top);
  for (const [dx, y, dz, s] of [[-15, 13, 8, 1.8], [8, 11, 12, 1.9], [19, 15, 2, 1.7], [-3, 8, 16, 2], [-18, 12, -4, 1.7], [2, 12, -14, 1.9], [13, 11, -10, 1.7], [-8, 5, 4, 1.8], [-5, 2, 24, 2.2]]) cloud(b, x + dx, y, z + dz, s);
  for (const [dx, dz, s] of [[-15, 9, 0.8], [15, -9, 0.7], [-16, -6, 0.7], [5, 15.6, 0.6]]) cloud(b, x + dx, top - 0.6, z + dz, s);
  b.tube(MARBLE, 10.4, 0.55, rx, ground, rz, { sides: 40 }); b.tube(shade(MARBLE, 0.95), 9.6, 0.55, rx, ground + 0.55, rz, { sides: 40 });
  b.box(MARBLE, 12.6, 0.55, 3, rx, ground, rz + 11.8); b.box(shade(MARBLE, 0.95), 11.6, 0.55, 2.4, rx, ground + 0.55, rz + 10.4);
  b.tube(STONE, 5.9, pillar, rx, floor, rz, { sides: 24 }); b.tube(shade(STONE, 0.86), 6, 0.4, rx, floor, rz, { sides: 24 });
  b.pane('#3A2C66', 2.8, 5.6, rx, floor + 2.9, rz + 5.95, { glow: 0.3 }); b.pane(LIGHT, 2, 4.6, rx, floor + 2.7, rz + 5.97, { glow: 1.2 + lit * 0.5 }); b.ball(LIGHT, 0.25, 0.25, 0.25, rx, floor + 5.4, rz + 6, { glow: 1.5 });
  const colour = (i: number) => (i % 2 ? MARBLE : shade(MARBLE, 0.97));
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 + 15), cx = rx + Math.cos(a) * ring, cz = rz + Math.sin(a) * ring;
    if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.6) continue;
    b.tube(GILT, 0.8, 0.4, cx, floor, cz, { sides: 12 }); b.tube(colour(i), 0.55, pillar - 0.4, cx, floor + 0.4, cz, { top: 0.85, sides: 14, rough: 0.5 }); b.tube(GILT, 0.95, 0.5, cx, floor + pillar - 0.5, cz, { top: 1.2, sides: 12 });
  }
  for (const dx of [-4.2, -1.4, 1.4, 4.2]) {
    b.tube(GILT, 0.8, 0.4, rx + dx, floor, rz + 11, { sides: 12 }); b.tube(MARBLE, 0.58, pillar - 0.4, rx + dx, floor + 0.4, rz + 11, { top: 0.85, sides: 14, rough: 0.5 }); b.tube(GILT, 0.95, 0.5, rx + dx, floor + pillar - 0.5, rz + 11, { top: 1.2, sides: 12 });
  }
  const eave = floor + pillar;
  b.box(MARBLE, 12, 1.1, 6.6, rx, eave, rz + 8.6); b.box(GILT, 12.5, 0.35, 7.2, rx, eave + 1.1, rz + 8.6);
  b.ridge(STONE, 6.2, 3, 12, rx, eave + 1.45, rz + 8.6, 0, { turn: [0, 90, 0] }); b.ridge(GILT, 6.5, 3.3, 12.4, rx, eave + 1.4, rz + 8.5, 0, { turn: [0, 90, 0] }); b.ridge(BLUE, 6.4, 2.4, 11.4, rx, eave + 1.8, rz + 8.8, 0, { turn: [0, 90, 0] });
  b.ball(GILT, 0.7, 0.7, 0.4, rx, eave + 3.1, rz + 9.1, { glow: 1.4 + lit * 0.5 });
  b.tube(MARBLE, 9, 1.2, rx, eave, rz, { sides: 40 }); b.tube(GILT, 9.25, 0.35, rx, eave + 1.2, rz, { sides: 40 }); b.tube(shade(MARBLE, 0.96), 8.5, 0.5, rx, eave + 1.55, rz, { sides: 40 });
  const drum = eave + 2.05;
  b.tube(MARBLE, 7, 2.8, rx, drum, rz, { sides: 32 }); b.tube(GILT, 7.3, 0.35, rx, drum + 2.8, rz, { sides: 32 }); b.tube(GILT, 7.3, 0.3, rx, drum, rz, { sides: 32 });
  for (let i = 0; i < 5; i++) { const a = rad(90 + (i - 2) * 26); b.pane(BLUE, 1.2, 1.7, rx + Math.cos(a) * 7.03, drum + 1.4, rz + Math.sin(a) * 7.03, { turn: [0, -deg(a) + 90, 0], glow: 0.5 }); }
  b.dome(GILT, 7.2, 6.6, 7.2, rx, drum + 3.15, rz, { rough: 0.3 }); b.dome(shade(GILT, 1.08), 7.05, 6.7, 7.05, rx, drum + 3.15, rz, { rough: 0.25 });
  const crown = drum + 3.15 + 6.6;
  b.tube(MARBLE, 1.2, 2.2, rx, crown - 0.4, rz, { top: 0.9, sides: 16 }); b.dome(GILT, 1.5, 1.2, 1.5, rx, crown + 1.8, rz, { rough: 0.3 }); b.tube(GILT, 0.14, 3, rx, crown + 2.8, rz, { top: 0.4, sides: 8 }); b.ball(LIGHT, 0.45, 0.45, 0.45, rx, crown + 6, rz, { glow: 2 + lit * 0.5 });
  b.box('#F6EBD0', 3.2, 0.12, 5.6, rx, ground, rz + 14.4); b.box('#F6EBD0', 3.2, 0.12, 1.2, rx, ground, z + 14.8);
  for (const side of [-1, 1]) { b.tube(GILT, 0.1, 2.6, rx + side * 2.4, ground, z + 14, { sides: 8 }); b.ball(LIGHT, 0.32, 0.32, 0.32, rx + side * 2.4, ground + 2.7, z + 14, { glow: 1.4 + lit * 0.5 }); }
  for (const [dx, dz, tall] of [[-12, 5, false], [-10, -8, true], [9, -9, false], [-5, -13, false], [-13, 11, true], [3, -14, true], [11, 9, false]] as const) tree(b, x + dx, ground, z + dz, tall);
  const edge = x + 17.6;
  b.box(MIST, 12, 0.12, 2.6, x + 10.5, ground, z + 4, { glow: 1.1 });
  b.box(ROCK, 4.4, 1.1, 6.4, edge - 1.6, top - 1.3, z + 4, { rough: 1 });
  b.box('#FFD86B', 6.4, 29, 1, edge, 1.5, z + 4, { glow: 1.3 + lit * 0.4 }); b.box(LIGHT, 4, 29, 1.2, edge, 1.5, z + 4.1, { glow: 1.8 + lit * 0.4 }); b.box('#FFFFFF', 1.8, 29, 1.3, edge, 1.5, z + 4.2, { glow: 2.2 + lit * 0.4 });
  for (const [dx, w] of [[-2.4, 0.3], [2.3, 0.25], [-1.2, 0.2], [1.3, 0.2]]) b.box(GILT, w, 29, 1.2, edge + dx, 1.5, z + 4.2, { glow: 1.6 });
  b.box(MIST, 6.4, 0.8, 1.6, edge, top - 0.3, z + 4, { glow: 1.6 });
  cloud(b, edge, 2, z + 4, 1.6, MIST); cloud(b, edge - 5, 0.5, z + 7, 1.5); cloud(b, edge + 5, 0.5, z + 2, 1.4, MIST);
  for (const [dx, y, dz] of [[-4.4, 12, 1], [4.6, 8, 1], [-3.6, 4, 2.5], [5, 15, 0], [4, 21, 2.4], [-4.2, 18, 3]]) b.ball(LIGHT, 0.28, 0.28, 0.28, edge + dx, y, z + 4 + dz, { glow: 2.5 });
}


export const temple: Skyline = {
  sights: [
    { reach: 26, build: serverTemple },
    { reach: 17, build: stairway },
    { reach: 28, build: graphicsCard },
    { reach: 21, build: cloudIsland },
  ],
};
