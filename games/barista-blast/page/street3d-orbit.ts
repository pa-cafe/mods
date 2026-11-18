import * as THREE from 'three';
import { CREAM, RED } from './art';
import { type Build, lights, shade, type Skyline } from './street3d-kit';

const HULL = '#E6E9F4', HULL_DARK = '#9AA3C0', NAVY = '#1A2250', SOLAR = '#2A4DB0', FOIL = '#E8B03A', GOLD = '#FFD86B', ICE = '#9EE7FF', MINT = '#9CFFB0';
const MOON = '#D4D2E4', MOON_DARK = '#9A98B6', MOON_LIGHT = '#EDEBF8', FOAM = '#FFF4E6';
const { sin, cos, sqrt, PI } = Math;
const deg = (radians: number) => radians * 180 / PI;
type Paint = (ctx: CanvasRenderingContext2D, size: number) => void;

const cells = (ground: string, line: string, columns: number, rows: number): Paint => (ctx, s) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  const sheen = ctx.createLinearGradient(0, 0, s, s); sheen.addColorStop(0, 'rgba(255,255,255,0.28)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, s / 64);
  for (let i = 0; i <= columns; i++) { ctx.beginPath(); ctx.moveTo(i * s / columns, 0); ctx.lineTo(i * s / columns, s); ctx.stroke(); }
  for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * s / rows); ctx.lineTo(s, j * s / rows); ctx.stroke(); }
};

const radiator: Paint = (ctx, s) => {
  ctx.fillStyle = '#EEF0F8'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#F29A7B'; for (let i = 0; i < 6; i++) ctx.fillRect(s * (0.08 + i * 0.17), 0, s * 0.045, s);
  ctx.fillStyle = '#B7BED6'; ctx.fillRect(0, s * 0.47, s, s * 0.06);
};

function arc(b: Build, color: string, cx: number, cy: number, z: number, radius: number, thick: number, depth: number, from: number, to: number, n: number, glow = 0) {
  const length = 2 * radius * sin((to - from) / n / 2 * PI / 180) * 1.04;
  for (let i = 0; i < n; i++) {
    const a = (from + (to - from) * (i + 0.5) / n) * PI / 180;
    b.box(color, length, thick, depth, cx + cos(a) * radius, cy + sin(a) * radius - thick / 2, z, { turn: [0, 0, deg(a) + 90], glow });
  }
}

function panel(b: Build, name: string, cx: number, cy: number, z: number, w: number, h: number, lit: number, tilt = 0, line = '#7F9BEA') {
  const turn = [0, 0, tilt] as const, columns = Math.max(2, Math.round(w / 1.6)), rows = Math.max(2, Math.round(h / 1.6));
  b.box(HULL_DARK, w + 0.5, h + 0.5, 0.3, cx, cy - h / 2 - 0.25, z, { turn });
  b.sign(`orbit:${name}:${columns}:${rows}`, cells(SOLAR, line, columns, rows), w, h, cx, cy, z + 0.17, { glow: 0.22 + lit * 0.1, rough: 0.3, turn });
}

function foamBed(b: Build, x: number, z: number, spread: number) {
  [[-0.6, 7, 0], [0.1, 9, 1], [0.7, 6.5, -2], [-0.2, 5.5, 5], [0.45, 5, 4]].forEach(([at, r, dz], i) => b.dome(i % 2 ? FOAM : '#FFFFFF', r * 1.4, r * 0.8, r, x + at * spread, 0, z + dz, { rough: 1 }));
}

function datacentre(b: Build, x: number, z: number, lit: number) {
  if (b.model('orbital_data_station_v2', x, 30, z, 0.83)) return;
  const mid = 34, bayW = 17, bayH = 8.6, bayD = 7.4;
  foamBed(b, x, z, 20);
  for (const side of [-1, 1]) {
    const mast = x + side * 16;
    b.box(HULL_DARK, 0.9, 47, 0.9, mast, 11.5, z - 5); b.box(HULL, 18, 0.7, 0.7, mast, mid - 0.35, z - 5);
    for (const dx of [-1, 1]) {
      panel(b, 'wing', mast + dx * 4.7, 48.5, z - 5, 8.6, 20, lit);
      panel(b, 'wing', mast + dx * 4.7, 22, z - 5, 8.6, 17.5, lit);
    }
    b.box(HULL, 2.4, 2, 2, mast, mid + 2.6, z - 5); b.ball(RED, 0.35, 0.35, 0.35, mast, 59.4, z - 5, { glow: 2.4 });

    const bay = x + side * 15;
    b.box(NAVY, bayW, bayH, bayD, bay, mid - bayH / 2, z);
    b.sign('orbit:racks', lights([ICE, GOLD, MINT, '#FF8FB8'], 22, 11, 0.62, '#11173A', 5), bayW - 0.8, bayH - 0.9, bay, mid, z + bayD / 2 + 0.02, { glow: 0.55 + lit * 0.5, sharp: true });
    for (let i = 0; i <= 8; i++) b.box(HULL_DARK, 0.18, bayH - 0.5, 0.2, bay - bayW / 2 + 0.6 + i * (bayW - 1.2) / 8, mid - bayH / 2 + 0.25, z + bayD / 2 + 0.12);
    b.box(HULL, bayW + 0.4, 0.5, bayD + 0.4, bay, mid + bayH / 2, z); b.box(HULL, bayW + 0.4, 0.5, bayD + 0.4, bay, mid - bayH / 2 - 0.5, z);
    b.pipe(HULL, 0.55, bayW, bay, mid + bayH / 2 + 0.9, z + 2.4, 'x'); b.pipe(HULL, 0.55, bayW, bay, mid + bayH / 2 + 0.9, z - 2.4, 'x');
    for (let i = 0; i < 5; i++) b.box(HULL_DARK, 0.5, 1.5, 4.2, bay - 6.5 + i * 3.25, mid + bayH / 2 + 0.5, z);
    b.ball(FOIL, 1.6, bayH / 2 + 0.3, bayD / 2 + 0.2, x + side * (15 + bayW / 2 + 0.6), mid, z);

    const fin = x + side * 27.2;
    b.box(HULL_DARK, 0.5, 16.4, 0.5, fin - side * 1.9, mid - 8.2, z - 1); b.box(HULL_DARK, 0.5, 16.4, 0.5, fin + side * 1.9, mid - 8.2, z - 1);
    b.sign('orbit:radiator', radiator, 3.4, 15.5, fin, mid, z - 0.8, { glow: 0.2 + lit * 0.12 });
    b.box(HULL_DARK, 4.2, 0.4, 0.5, fin, mid + 7.9, z - 0.9); b.ball(MINT, 0.3, 0.3, 0.3, fin, mid + 8.5, z - 0.8, { glow: 2.4 });
  }

  b.pipe(HULL, 5.2, 13, x, mid, z, 'x');
  for (let i = -2; i <= 2; i++) b.pipe(i === 0 ? FOIL : HULL_DARK, 5.45, 0.6, x + i * 2.6, mid, z, 'x');
  b.dome(HULL, 2.6, 2.4, 2.6, x, mid + 5, z); b.tube(HULL_DARK, 0.12, 4, x, mid + 7, z, { sides: 6 }); b.ball(ICE, 0.35, 0.35, 0.35, x, mid + 11.1, z, { glow: 2.4 });
  arc(b, '#F4D77C', x, mid, z - 6.5, 10.5, 0.9, 1.4, 0, 360, 28, 0.3 + lit * 0.2); arc(b, HULL, x, mid, z - 6.5, 8.2, 0.5, 1, 0, 360, 24);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8; b.box(HULL_DARK, 0.5, 2.6, 1.4, x + cos(a) * 11.4, mid + sin(a) * 11.4 - 1.3, z - 6.5, { turn: [0, 0, deg(a) - 90] }); b.ball(i % 2 ? ICE : GOLD, 0.3, 0.3, 0.3, x + cos(a) * 12.9, mid + sin(a) * 12.9, z - 6.5, { glow: lit * 1.6 }); }
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; b.box(HULL_DARK, 0.45, 8.2, 0.45, x + cos(a) * 3.9, mid + sin(a) * 3.9, z - 6.2, { turn: [0, 0, deg(a) - 90] }); }

  b.pipe(HULL_DARK, 1.9, 4.2, x, mid, z + 7.3, 'z'); b.pipe(FOIL, 2.4, 0.6, x, mid, z + 9.2, 'z');
  b.tube(HULL, 3, 5, x, mid - 2.5, z + 11.9, { turn: [90, 0, 0], top: 0.45 }); b.disc(NAVY, 1.15, x, mid, z + 14.5, { glow: 0.4 + lit * 0.5 });
  for (const side of [-1, 1]) b.box(HULL_DARK, 3.4, 0.35, 0.35, x + side * 3.6, mid - 1.3, z + 11.2, { turn: [0, 0, side * 24] });
}

function crater(b: Build, x: number, y: number, z: number, radius: number) {
  b.ball(MOON_LIGHT, radius * 1.14, radius * 1.14 * 0.9, 0.5, x, y, z, { glow: 0.3 });
  b.ball(MOON_DARK, radius, radius * 0.9, 0.5, x, y, z + 0.18, { glow: 0.3 });
  b.ball(shade(MOON_DARK, 0.85), radius * 0.45, radius * 0.4, 0.5, x + radius * 0.25, y - radius * 0.2, z + 0.32, { glow: 0.3 });
}

function dish(b: Build, x: number, y: number, z: number, radius: number, aim: number, lit: number) {
  const a = aim * PI / 180, normal = [0, sin(a), cos(a)] as const, turn = [-aim, 0, 0] as const;
  b.dome(shade(HULL, 0.78), radius, radius * 0.34, radius, x, y, z, { turn: [-(90 + aim), 0, 0] });
  b.disc(HULL, radius, x, y, z, { turn, rough: 0.4, glow: 0.3 });
  b.disc(shade(HULL, 0.82), radius * 0.62, x, y, z + 0.06, { turn }); b.disc(HULL, radius * 0.3, x, y, z + 0.1, { turn });
  b.tube(HULL_DARK, 0.3, radius * 0.9, x, y - radius * 0.9, z - 1.2, { top: 1.6 });
  for (const side of [-1, 0, 1]) b.box(HULL_DARK, 0.18, radius * 1.05, 0.18, x + side * radius * 0.18, y - radius * 0.1, z + radius * 0.3, { turn: [-aim + 90, 0, side * 14] });
  b.ball(GOLD, 0.7, 0.7, 0.7, x + normal[0] * radius * 0.85, y + normal[1] * radius * 0.85, z + normal[2] * radius * 0.85, { glow: 0.4 + lit * 0.6 });
  b.ball(RED, 0.3, 0.3, 0.3, x, y + radius + 0.4, z, { glow: lit * 2.4 });
}

function module(b: Build, x: number, y: number, z: number, length: number, r: number, lit: number) {
  b.pipe(HULL, r, length, x, y, z, 'x');
  for (const end of [-1, 1]) { b.ball(HULL, r, r, r, x + end * length / 2, y, z); b.pipe(HULL_DARK, r + 0.25, 0.5, x + end * (length / 2 - 0.6), y, z, 'x'); }
  b.sign('orbit:portholes', lights([GOLD, ICE, '#FFE9B0'], 10, 1, 0.8, '#1A2250', 4), length - 1.6, r * 0.55, x, y + r * 0.15, z + r + 0.05, { glow: 0.6 + lit * 0.6, sharp: true });
  b.box(HULL_DARK, length * 0.8, 0.4, r * 1.4, x, y - r - 0.4, z);
}

function moonbase(b: Build, x: number, z: number, lit: number) {
  if (b.model('lunar_base_v2', x, 8, z, 1.25)) return;
  const rx = 30, ry = 26, rz = 22, top = 23.5, surface = (at: number, y: number) => rz * sqrt(Math.max(0, 1 - (at / rx) ** 2 - (y / ry) ** 2));
  b.dome(MOON, rx, ry, rz, x, 0, z, { rough: 1, glow: 0.3 });
  b.dome(shade(MOON, 0.9), 13, 17, 14, x - 23, 0, z - 3, { rough: 1, glow: 0.3 }); b.dome(shade(MOON, 1.04), 12, 14, 12, x + 23, 0, z - 4, { rough: 1, glow: 0.3 });
  for (const [at, y, r] of [[-14, 15, 2.8], [-3, 9, 2], [12, 13, 2.4], [-21, 7, 2.2], [20, 6, 1.8], [4, 17, 1.5], [-8, 19, 1.6], [16, 19, 1.3]] as const) crater(b, x + at, y, z + surface(at, y) + 0.05, r);
  b.tube(MOON_LIGHT, 21, 1.4, x, top - 1.4, z, { sides: 40, rough: 0.9, glow: 0.3 });
  b.tube(shade(MOON_DARK, 1.05), 21.4, 0.3, x, top - 1.5, z, { sides: 40, rough: 0.9 });

  module(b, x - 6, top + 3.4, z - 7, 13, 3.1, lit); module(b, x + 9, top + 3.4, z - 8, 10, 3.1, lit);
  module(b, x + 1, top + 2.8, z + 5, 9, 2.6, lit);
  b.pipe(HULL_DARK, 1.1, 7, x - 2, top + 2.8, z - 1, 'z'); b.pipe(HULL_DARK, 1.1, 7, x + 5, top + 2.8, z - 2, 'z');

  b.tube(HULL_DARK, 6.6, 0.9, x + 14, top, z + 4, { sides: 28 });
  for (const [dx, dz, r] of [[-2, -1, 1.5], [1.5, -1.6, 1.8], [0, 1.6, 1.3], [2.6, 1, 1.1]] as const) { b.tube('#7A5232', 0.25, 1.4, x + 14 + dx, top + 0.9, z + 4 + dz); b.ball('#5FBF73', r, r, r, x + 14 + dx, top + 2.3 + r * 0.6, z + 4 + dz, { glow: 0.2 + lit * 0.2 }); }
  b.dome(shade(ICE, 0.95), 6, 6, 6, x + 14, top + 0.9, z + 4, { glow: 0.15 + lit * 0.2, rough: 0.1, flat: 0.35 });

  const mx = x - 14, mz = z + 5;
  b.tube(CREAM, 4.6, 8.6, mx, top, mz, { top: 1.12, rough: 0.5, glow: 0.2 });
  b.tube('#C8875A', 4.85, 1.2, mx, top + 3.4, mz, { top: 1.06, glow: 0.15 });
  b.ring(CREAM, 2.8, 1.3, mx + 5.6, top + 4.4, mz, { glow: 0.2 });
  b.disc('#6B4226', 4.95, mx, top + 8.5, mz, { turn: [-90, 0, 0] });
  for (const [dy, dx, r] of [[10.4, -0.8, 1.5], [12.8, 0.7, 1.2], [14.8, -0.4, 0.9]] as const) b.ball('#FFFFFF', r, r * 1.3, r, mx + dx, top + dy, mz, { glow: 0.8, rough: 1 });

  const px = x + 6, pz = z + 13;
  b.tube(shade(HULL_DARK, 0.85), 5, 0.5, px, top - 0.6, pz, { sides: 32 });
  b.disc(GOLD, 3.6, px, top - 0.05, pz, { turn: [-90, 0, 0], glow: 0.3 + lit * 0.5 }); b.disc(shade(HULL_DARK, 0.85), 3.1, px, top, pz, { turn: [-90, 0, 0] });
  for (const [dx, dz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]] as const) b.tube(HULL_DARK, 0.12, 1.6, px + dx, top, pz + dz, { sides: 6 });
  b.tube(FOIL, 1.6, 1.4, px, top + 1.3, pz, { sides: 8 }); b.dome(HULL, 1.3, 1.2, 1.3, px, top + 2.7, pz); b.disc(ICE, 0.5, px, top + 3.2, pz + 1.15, { glow: 0.8 });

  b.tube(HULL_DARK, 1, 8, x + 20, top - 1, z - 6, { top: 0.6 });
  dish(b, x + 20, top + 10, z - 6, 5.5, 36, lit);
  b.tube(HULL_DARK, 0.18, 13, x - 22, top - 1, z - 7, { top: 0.5, sides: 6 }); b.ball(RED, 0.5, 0.5, 0.5, x - 22, top + 12.4, z - 7, { glow: 0.6 + lit * 2.4 });
  for (const at of [-26, 26]) { b.tube(HULL_DARK, 0.2, 5, x + at, 9, z + 6, { top: 0.4 }); b.ball(RED, 0.3, 0.3, 0.3, x + at, 14.2, z + 6, { glow: lit * 2.4 }); }
}

function satellite(b: Build, cx: number, cy: number, z: number, size: number, tilt: number, lit: number) {
  if (b.model('solar_satellite_unit_v2', cx, cy, z, size * 0.43, tilt)) return;
  const a = tilt * PI / 180, turn = [0, 0, tilt] as const;
  const at = (lx: number, ly: number): [number, number] => [cx + (lx * cos(a) - ly * sin(a)) * size, cy + (lx * sin(a) + ly * cos(a)) * size];
  const body = at(0, 0), belt = at(0, -1.05);
  b.box('#F5C95A', 2.6 * size, 3 * size, 2.6 * size, body[0], body[1] - 1.5 * size, z, { turn, rough: 0.3, glow: 0.25 + lit * 0.1 });
  b.box(shade(FOIL, 0.7), 2.75 * size, 0.55 * size, 2.75 * size, body[0], body[1] - 0.275 * size, z, { turn });
  b.box(NAVY, 2.75 * size, 0.55 * size, 2.75 * size, belt[0], belt[1] - 0.275 * size, z, { turn });
  for (const side of [-1, 1]) {
    const boom = at(side * 1.9, 0), wing = at(side * (2.6 + 2.1), 0);
    b.box(HULL_DARK, 1.2 * size, 0.26 * size, 0.26 * size, boom[0], boom[1] - 0.13 * size, z, { turn });
    b.box(HULL_DARK, 4.4 * size, 3 * size, 0.2 * size, wing[0], wing[1] - 1.5 * size, z - 0.05, { turn });
    b.sign('orbit:sat-wing', cells(SOLAR, '#7F9BEA', 4, 3), 4.1 * size, 2.7 * size, wing[0], wing[1], z + 0.16 * size, { glow: 0.25 + lit * 0.12, turn });
  }
  const stem = at(1.1, 1.3), mount = at(1.1, 2.3);
  b.box(HULL_DARK, 0.2 * size, 1.2 * size, 0.2 * size, stem[0], stem[1] - 0.6 * size, z, { turn });
  b.disc(HULL, 1 * size, mount[0], mount[1], z + 0.2, { turn }); b.ball(GOLD, 0.2 * size, 0.2 * size, 0.2 * size, mount[0], mount[1], z + 0.5, { glow: lit });
  const glint = at(-3.4, 0.4);
  b.disc('#FFFFFF', 1.2 * size, glint[0], glint[1], z + 0.6 * size, { flat: 0.3 }); b.disc('#FFFFFF', 0.4 * size, glint[0], glint[1], z + 0.65 * size, { flat: 0.9 });
  b.pane('#FFFFFF', 4 * size, 0.12 * size, glint[0], glint[1], z + 0.7 * size, { flat: 0.8, turn: [0, 0, 0] }); b.pane('#FFFFFF', 0.12 * size, 3 * size, glint[0], glint[1], z + 0.7 * size, { flat: 0.8, turn: [0, 0, 0] });
}

function satellites(b: Build, x: number, z: number, lit: number) {
  const path = (t: number) => ({ px: -26 + 52 * t, py: 18 + 38 * t ** 1.6 });
  for (let i = 0; i < 7; i++) {
    const t = i / 6, { px, py } = path(t), ahead = path(t + 0.01), nose = deg(Math.atan2(ahead.py - py, ahead.px - px)) - 90;
    satellite(b, x + px, py, z + (i % 2) * 1.5, 1 + t * 0.5, nose, lit);
  }
  for (let i = 0; i <= 90; i++) { const { px, py } = path(i / 90); if (i % 15) b.ball(ICE, 0.16, 0.16, 0.16, x + px, py + 0.3, z, { glow: 0.5 + lit * 0.9 }); }
}

function facing(out: THREE.Vector3) {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out.clone().normalize()));
  return [deg(e.x), deg(e.y), deg(e.z)] as const;
}

function ring(b: Build, x: number, z: number, lit: number) {
  if (b.model('dyson_sphere_v2', x, 27, z, 1.25)) return;
  const cy = 26, shell = 15, core = '#FFF3C0', centre = new THREE.Vector3(x, cy, z);
  b.ball(core, 9, 9, 9, x, cy, z, { glow: 3.2 });
  for (const [r, opacity, color] of [[17, 0.4, '#FFE9A0'], [22, 0.22, '#FFD070'], [28, 0.1, '#FFB070']] as const) b.disc(color, r, x, cy, z - 14, { flat: opacity });
  let n = 0;
  for (let lat = -72; lat <= 72; lat += 18) {
    const around = Math.max(6, Math.round(24 * cos(lat * PI / 180))), tall = shell * 18 * PI / 180 * 0.86;
    for (let i = 0; i < around; i++, n++) {
      if ((n * 37 + lat * 3) % 7 === 0 || (n * 11) % 9 === 0) continue;
      const lon = (i + (lat / 18) * 0.5) * 360 / around, la = lat * PI / 180, lo = lon * PI / 180;
      const out = new THREE.Vector3(cos(la) * sin(lo), sin(la), cos(la) * cos(lo)), at = centre.clone().addScaledVector(out, shell);
      const wide = 2 * PI * shell * cos(la) / around * 0.86, gold = (n + Math.round(lat / 18)) % 3 !== 0;
      b.sign(`orbit:${gold ? 'gold' : 'blue'}`, gold ? cells('#E8B13A', '#8F6A12', 3, 3) : cells('#2748A6', '#8FB0F0', 3, 3), wide, tall, at.x, at.y, at.z, { glow: 0.35 + lit * (gold ? 0.35 : 0.2), rough: 0.3, turn: facing(out) });
    }
  }
  for (const [radius, tilt, spin, count] of [[22, 68, 24, 30], [26, 58, -38, 34]] as const) {
    const axis = new THREE.Euler(tilt * PI / 180, 0, spin * PI / 180);
    for (let i = 0; i < count; i++) {
      const t = i / count * PI * 2, out = new THREE.Vector3(cos(t), sin(t), 0).applyEuler(axis), at = centre.clone().addScaledVector(out, radius);
      b.sign('orbit:blue', cells('#2748A6', '#8FB0F0', 3, 3), 1.8, 1.2, at.x, at.y, at.z, { glow: 0.3 + lit * 0.3, rough: 0.3, turn: facing(out) });
    }
  }
}

export const orbit: Skyline = {
  sights: [
    { reach: 29, build: datacentre },
    { reach: 29, build: moonbase },
    { reach: 28, build: satellites },
    { reach: 31, build: ring },
  ],
};
