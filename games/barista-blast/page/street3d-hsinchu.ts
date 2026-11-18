import assembly from '../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/runtime-interfaces.json';
import type { ModelId } from './street3d-models';

import { type Build, shade, type Skyline } from './street3d-kit';

const PALE = '#ECEEEF', GREY = '#BFC6CB', DARK = '#7E8A93', BLUE = '#2F6FBF', GLASS = '#3C6E8F', SKY_GLASS = '#8CC1D8', STEEL = '#C9D3D8', CONCRETE = '#DDD8CC', SAND = '#D8B787', GRASS = '#8DB07A';
const PYLON = '#8E7468', WIRE = '#5A3A30', WARM = '#FFE7A0', STRIPE = '#D8392B', SMOKE = '#C4BEB4', STEAM = '#FFFFFF', LIGHT = '#E0572F', TOWER = '#F4F5F3';
const roll = (a: number, b: number) => { const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return value - Math.floor(value); };


function bar(b: Build, color: string, thick: number, x1: number, y1: number, x2: number, y2: number, z: number, glow = 0) {
  const length = Math.hypot(x2 - x1, y2 - y1), angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  b.box(color, length, thick, thick, (x1 + x2) / 2, (y1 + y2) / 2 - thick / 2, z, { turn: [0, 0, angle], glow });
}


function plume(b: Build, color: string, x: number, y: number, z: number, n: number, start: number, swell: number, lean: number, glow = 0) {
  for (let i = 0; i < n; i++) {
    const r = start + i * swell, at = i * i * lean * 0.18 + i * lean * 0.5;
    const id = color === SMOKE ? 'hsc3_smoke_cluster_unit' : 'hsc3_steam_cluster_unit';
    if (b.model(id, x + at, y + r * 0.6 + i * start * 1.3, z + (i % 2 ? 1 : -1) * r * 0.25, r)) {
      if (i > 1) b.model(id, x + at - r * 0.7, y + r * 0.9 + i * start * 1.3, z + r * 0.45, r * 0.62);
      continue;
    }
    b.ball(color, r, r * 0.88, r, x + at, y + r * 0.6 + i * start * 1.3, z + (i % 2 ? 1 : -1) * r * 0.25, { rough: 1, glow: glow });
    if (i > 1) b.ball(shade(color, 0.96), r * 0.62, r * 0.55, r * 0.62, x + at - r * 0.7, y + r * 0.9 + i * start * 1.3, z + r * 0.45, { rough: 1, glow: glow });
  }
}


function plant(b: Build, kind: keyof typeof assembly.assemblies, x: number, z: number) {
  let available = false;
  for (const part of assembly.assemblies[kind]) {
    const [dx, y, dz] = part.position;
    available = b.model(part.id as ModelId, x + dx, y, z + dz, 'scale' in part ? part.scale : 1, 'rotationZ' in part ? part.rotationZ : 0);
    if (!available) break;
  }
  return available;
}

function fab(b: Build, x: number, z: number, lit: number) {
  if (plant(b, 'fab', x, z)) return;
  if (b.model('hsinchu_wafer_fab_v2', x - 12, 0, z, 0.78)) {
    b.model('hsinchu_office_v2', x + 27, 0, z - 2, 0.66);
    return;
  }
  const hallX = x - 13, w = 58, d = 16, base = 5, h = 24, top = base + h, roof = top + 0.9, front = z + d / 2;
  b.box(DARK, w + 4, base, d + 3, hallX, 0, z); b.box(shade(DARK, 1.12), w + 4.4, 0.4, d + 3.4, hallX, base - 0.4, z);
  b.box(PALE, w, h, d, hallX, base, z);
  for (let i = 0; i < 20; i++) {
    const at = hallX - w / 2 + 1.5 + i * (w - 3) / 19;
    b.box(GREY, 0.5, 11, 0.5, at, base, front + 0.2); b.box(GREY, 0.5, 6.4, 0.5, at, base + 17.6, front + 0.2);
  }
  b.box(BLUE, w + 0.3, 5.2, d + 0.3, hallX, base + 11.8, z, { glow: lit * 0.25 });
  for (const y of [base + 12.6, base + 14.2, base + 15.8]) b.box(shade(BLUE, 1.5), w + 0.4, 0.2, d + 0.4, hallX, y, z, { glow: lit * 0.25 });
  b.box(shade(PALE, 0.9), w + 0.5, 0.5, d + 0.5, hallX, base + 11.4, z); b.box(shade(PALE, 0.9), w + 0.5, 0.5, d + 0.5, hallX, base + 17, z);
  b.pane('#5E7A8C', w - 3, 1.1, hallX, top - 2.4, front + 0.3, { rough: 0.3, glow: lit * 0.4 });
  for (let i = 0; i < 6; i++) { const at = hallX - w / 2 + 6 + i * 9.6; b.box(GREY, 5.4, 4.6, 0.2, at, base + 0.2, front + 0.15); for (let k = 0; k < 4; k++) b.box(DARK, 5.2, 0.12, 0.1, at, base + 1.2 + k, front + 0.28); }
  b.box(GREY, w + 1.4, 0.9, d + 1.4, hallX, top, z); b.box(PALE, w + 0.4, 0.8, d + 0.4, hallX, roof, z);

  b.box(PALE, w - 12, 5, 11, hallX - 2, roof + 0.8, z - 1.5); b.box(GREY, w - 11.4, 0.5, 11.6, hallX - 2, roof + 5.8, z - 1.5);
  for (let i = 0; i < 8; i++) b.pane(DARK, 4.2, 2.6, hallX - w / 2 + 9 + i * 5.7, roof + 3, z + 4.05, { rough: 0.4 });
  for (const [y, r] of [[roof + 7.2, 1.3], [roof + 9.6, 1]] as const) {
    b.box(STEEL, w - 22, r * 2, r * 2, hallX - 6, y, z + 2); for (let i = 0; i < 7; i++) b.box(DARK, 0.5, r * 2.5, r * 2.5, hallX - 24 + i * 6, y, z + 2);
  }
  for (let i = 0; i < 5; i++) {
    const at = hallX - 22 + i * 10;
    b.tube(STEEL, 0.9, 7, at, roof + 6, z + 2, { sides: 14 }); b.box(DARK, 1.6, 0.5, 1.6, at, roof + 13, z + 2);
    b.box(GREY, 3.4, 2.4, 3, at + 4, roof + 6, z - 2); b.tube(DARK, 1.3, 0.2, at + 4, roof + 8.4, z - 2, { sides: 14 });
  }
  for (const [at, height] of [[-28, 20], [-18, 26], [-4, 20]] as const) {
    const sx = x + at, sy = roof + 6;
    b.tube(TOWER, 2.3, height, sx, sy, z - 5, { top: 0.9 }); b.tube(BLUE, 2.35, 1, sx, sy + height * 0.45, z - 5, { top: 1 }); b.tube(BLUE, 2.1, 0.8, sx, sy + height * 0.85, z - 5, { top: 1 });
    b.dome(GREY, 2.2, 1.6, 2.2, sx, sy + height, z - 5); b.tube(STEEL, 0.35, 2, sx, sy + height + 1.4, z - 5);
    b.pipe(STEEL, 0.6, 7, sx, sy + 5, z - 1.5, 'z'); b.tube(DARK, 2.5, 0.5, sx, sy + 0.2, z - 5);
  }
  for (const at of [x - 34, x - 30]) {
    b.tube(PALE, 1.1, 34, at, roof + 6, z - 7.5, { top: 0.75, sides: 14 }); b.tube(BLUE, 1.12, 1.4, at, roof + 33, z - 7.5, { top: 0.8, sides: 14 }); b.tube(BLUE, 0.9, 1.2, at, roof + 22, z - 7.5, { top: 0.9, sides: 14 });
    b.ball(LIGHT, 0.4, 0.4, 0.4, at, roof + 40.6, z - 7.5, { glow: 3 });
  }
  b.box(GREY, 3, 11, 3, hallX - w / 2 - 1.5, base, z + d / 2 - 2); b.box(DARK, 3.2, 0.4, 3.2, hallX - w / 2 - 1.5, base + 11, z + d / 2 - 2);

  const ox = x + 32, bridge = x + 19.5, floors = 14, step = 3.3, officeH = floors * step;
  b.box(DARK, 21, base, 17, ox, 0, z + 1);
  b.box(GLASS, 18, officeH, 14, ox, base, z + 1, { rough: 0.3 });
  for (let f = 0; f <= floors; f++) b.box(PALE, 18.5, 0.5, 14.5, ox, base + f * step - 0.25, z + 1);
  for (let c = 0; c <= 8; c++) b.box(GREY, 0.26, officeH, 0.26, ox - 9 + c * 2.25, base, z + 8.15);
  for (let f = 3; f < floors; f++) for (let c = 0; c < 8; c++) {
    const lamp = lit && roll(f * 8 + c, 4) > 0.45;
    b.pane(lamp ? WARM : (f * 7 + c * 3) % 5 === 0 ? shade(SKY_GLASS, 0.72) : SKY_GLASS, 1.8, 2.5, ox - 7.875 + c * 2.25, base + f * step + 1.5, z + 8.22, lamp ? { glow: lit * 0.9 } : { rough: 0.2 });
  }
  b.box(BLUE, 1.2, officeH + 1, 0.6, ox - 9.4, base, z + 8.3, { glow: lit * 0.25 }); b.box(BLUE, 1.2, officeH + 1, 0.6, ox + 9.4, base, z + 8.3, { glow: lit * 0.25 });
  b.box(PALE, 18.6, 1, 14.6, ox, base + officeH, z + 1); b.box(GREY, 10, 4, 8, ox - 2, base + officeH + 1, z + 1); b.box(shade(PALE, 0.9), 10.4, 0.5, 8.4, ox - 2, base + officeH + 5, z + 1);
  b.tube(STEEL, 0.28, 10, ox + 5, base + officeH + 1, z + 1, { top: 0.6, sides: 8 }); b.ball(LIGHT, 0.35, 0.35, 0.35, ox + 5, base + officeH + 11.2, z + 1, { glow: 3 });
  b.box(PALE, 5, 3.6, 5, bridge, base + 10.6, z + 1); b.pane(lit ? WARM : SKY_GLASS, 4.2, 1.8, bridge, base + 12.4, z + 3.55, lit ? { glow: lit * 0.8 } : { rough: 0.2 });
}


function coolingTower(b: Build, x: number, y: number, z: number, size: number) {
  if (b.model('hsinchu_cooling_tower_v2', x, y, z, size * 46 / 43.1)) return;
  const foot = 15.5 * size, throat = 10 * size, mouth = 10.8 * size, height = 46 * size, waist = 33 * size, n = 23, step = height / n;
  const radius = (at: number) => at <= waist ? Math.hypot(throat, Math.sqrt(foot * foot - throat * throat) * (waist - at) / waist) : Math.hypot(throat, Math.sqrt(mouth * mouth - throat * throat) * (at - waist) / (height - waist));
  for (let i = 0; i < n; i++) {
    const r = radius(i * step), next = radius((i + 1) * step);
    b.tube(i < 2 ? '#77736A' : shade(CONCRETE, i % 2 ? 0.95 : 1), r, step, x, y + i * step, z, { top: next / r, sides: 40 });
  }
  b.tube(shade(CONCRETE, 0.8), mouth * 1.03, 0.9, x, y + height - 0.1, z, { sides: 40 }); b.tube(DARK, mouth * 1.08, 0.3, x, y + height - 2.4, z, { sides: 40 });
  for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.33; b.box(DARK, 0.5, height * 0.55, 0.4, x + Math.sin(a) * radius(height * 0.35) * 1.001, y + height * 0.12, z + Math.cos(a) * radius(height * 0.35)); }
}


function cooling(b: Build, x: number, z: number, lit: number) {
  if (plant(b, 'cooling', x, z)) {
    assembly.anchors['cooling.steam'].forEach(([dx, y, dz], i) => plume(b, STEAM, x + dx, y, z + dz, 5, i ? 3.6 : 4, 1.4, i ? 3.4 : 3.6, 0.3));
    return;
  }
  const deck = 10;
  b.box('#B8B2A6', 88, deck, 34, x, 0, z); b.box('#CFC9BC', 89, 0.8, 35, x, deck, z);
  for (let i = 0; i < 17; i++) b.box('#C6C0B3', 1.2, deck - 1, 0.5, x - 42 + i * 5.25, 0.2, z + 17.2);
  for (let i = 0; i <= 22; i++) b.box(STEEL, 0.14, 1, 0.14, x - 44 + i * 4, deck + 0.8, z + 17.2);
  b.box(STEEL, 88, 0.14, 0.14, x, deck + 1.7, z + 17.2);
  b.pipe(STEEL, 1.1, 24, x, deck + 3.2, z + 12, 'x'); for (const at of [-7, 0, 7]) b.box(DARK, 0.7, 1.2, 2.6, x + at, deck + 3.2 - 0.6, z + 12);
  b.box('#B5B0A4', 10, 5, 7, x, deck + 0.8, z + 6); b.pane(lit ? WARM : '#6E8794', 7, 1.6, x, deck + 3, z + 9.55, lit ? { glow: lit * 0.8 } : { rough: 0.3 });
  coolingTower(b, x - 21, deck + 0.8, z - 1, 1); coolingTower(b, x + 22, deck + 0.8, z - 7, 0.93);
  plume(b, STEAM, x - 21, deck + 0.8 + 46, z - 1, 5, 4, 1.4, 3.6, 0.3);
  plume(b, shade(STEAM, 0.97), x + 22, deck + 0.8 + 43, z - 7, 5, 3.6, 1.4, 3.4, 0.3);
}


function power(b: Build, x: number, z: number, lit: number) {
  if (plant(b, 'power', x, z)) {
    const [dx, y, dz] = assembly.anchors['power.steam'][0];
    plume(b, STEAM, x + dx, y, z + dz, 3, 1.1, 0.7, 2.4);
    assembly.anchors['power.smoke'].forEach(([sx, sy, sz], i) => plume(b, SMOKE, x + sx, sy, z + sz, i ? 4 : 5, i ? 1.7 : 2.4, i ? 0.9 : 1, i ? 3.6 : 4.4));
    return;
  }
  const hallX = x - 16, hallW = 38, hallH = 21, boilerX = x + 6, boilerH = 42, chimX = x + 36, rows = 9;
  b.box('#C5CDD2', hallW, hallH, 22, hallX, 0, z + 2);
  for (let i = 0; i < 4; i++) b.box(shade('#C5CDD2', 0.9), hallW + 0.3, 0.25, 22.3, hallX, 3 + i * 3.6, z + 2);
  for (let i = 0; i < 12; i++) b.box(GREY, 0.45, hallH - 1, 0.4, hallX - hallW / 2 + 1.7 + i * 3.4, 0.4, z + 13.2);
  b.pane(lit ? WARM : '#6E8794', hallW - 4, 2.6, hallX, hallH - 3, z + 13.1, lit ? { glow: lit } : { rough: 0.3 });
  b.box(GREY, hallW + 1, 0.8, 23, hallX, hallH, z + 2); b.ridge('#A9B3B9', hallW, 4.2, 22.4, hallX, hallH + 0.8, z + 2); b.box(DARK, hallW - 4, 0.7, 0.4, hallX, hallH + 4.8, z + 2);
  for (const at of [-12, 0, 12]) b.tube(STEEL, 0.8, 4, hallX + at, hallH + 3.2, z + 5, { top: 0.8, sides: 12 });

  b.box(STEEL, 22, 3, 18, boilerX, 0, z); b.box(shade(STEEL, 0.9), 22, 1, 18.4, boilerX, 3, z);
  b.box('#7E8B94', 15, boilerH - 4, 11, boilerX, 4, z - 1.5, { rough: 0.6 });
  for (let i = 0; i < rows; i++) b.box(shade('#7E8B94', i % 2 ? 0.82 : 1.1), 15.4, 0.6, 11.4, boilerX, 6 + i * 4, z - 1.5);
  for (let i = 0; i < 4; i++) b.tube('#B35B3C', 1.2, 22, boilerX - 4.5 + i * 3, 9, z + 4.6, { sides: 12 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(STEEL, 1, boilerH, 1, boilerX + sx * 10.7, 0, z + sz * 8.5);
  for (const sx of [-1, 0, 1]) b.box(STEEL, 0.7, boilerH - 3, 0.7, boilerX + sx * 5.4, 3, z + 8.6);
  for (let i = 0; i <= 5; i++) { const y = 3 + i * 8; b.box(DARK, 22.4, 0.6, 0.6, boilerX, y, z + 8.6); b.box(DARK, 0.6, 0.6, 17.6, boilerX - 10.7, y, z); b.box(DARK, 0.6, 0.6, 17.6, boilerX + 10.7, y, z); }
  for (let i = 0; i < 5; i++) for (let p = 0; p < 4; p++) {
    if ((i + p) % 2) continue;
    const left = boilerX - 10.7 + p * 5.35, right = left + 5.35, low = 3.3 + i * 8, high = low + 7.6;
    bar(b, shade(STEEL, 0.92), 0.28, left, low, right, high, z + 8.75); bar(b, shade(STEEL, 0.92), 0.28, left, high, right, low, z + 8.75);
  }
  b.box(PALE, 24, 4, 20, boilerX, boilerH, z - 0.5); b.box(GREY, 24.6, 0.8, 20.6, boilerX, boilerH + 4, z - 0.5);
  for (let i = 0; i < 4; i++) b.tube(STEEL, 0.5, 4.2 + i * 0.5, boilerX - 7 + i * 4.6, boilerH + 4.8, z - 3, { top: 0.8, sides: 10 });
  plume(b, STEAM, boilerX + 4.6, boilerH + 9.4, z - 3, 3, 1.1, 0.7, 2.4);

  const flueY = 24, esp = x + 22;
  b.pipe(DARK, 2.1, 6.5, boilerX + 14, flueY, z - 2, 'x'); b.box('#9AA4AB', 9, 18, 10, esp, 6, z - 2); b.box(DARK, 9.4, 0.7, 10.4, esp, 24, z - 2);
  for (let i = 0; i < 4; i++) b.box(shade('#9AA4AB', 0.85), 0.3, 16, 10.2, esp - 3 + i * 2, 6.5, z - 2);
  b.pipe(DARK, 2.1, 10, esp + 9, 27, z - 2, 'x'); b.box(STEEL, 1.2, 4, 1.2, esp + 8, 23, z - 2);

  const height = 68, bands = 10, band = height / bands, foot = 4.6, mouth = 2.9, at = (i: number) => foot + (mouth - foot) * i / bands;
  b.box('#B8B2A6', 12, 5, 12, chimX, 0, z - 2);
  for (let i = 0; i < bands; i++) b.tube(i % 2 ? STRIPE : TOWER, at(i), band, chimX, 5 + i * band - i * 0.07, z - 2, { top: at(i + 1) / at(i), sides: 28 });
  for (const i of [4, 7, 10]) b.tube(DARK, at(i) * 1.3, 0.5, chimX, 5 + i * band - 0.2, z - 2, { sides: 28 });
  b.tube('#5E6A72', mouth * 1.12, 0.7, chimX, 5 + height - 0.4, z - 2, { sides: 28 }); b.ball(LIGHT, 0.5, 0.5, 0.5, chimX, 5 + height + 1, z - 2, { glow: 3 });
  plume(b, SMOKE, chimX, 5 + height, z - 2, 5, 2.4, 1, 4.4);

  const stack = x - 38;
  b.tube('#A5B0B7', 1.7, 42, stack, 0, z - 4, { top: 0.6, sides: 16 }); b.tube(STRIPE, 1.2, 3, stack, 36, z - 4, { top: 0.82, sides: 16 }); b.tube(DARK, 0.9, 0.4, stack, 42, z - 4, { sides: 16 });
  plume(b, SMOKE, stack, 42.4, z - 4, 4, 1.7, 0.9, 3.6);
  if (b.model('hsinchu_substation_v2', x - 46, 0, z + 7, 0.53)) return;
  for (const [at, depth] of [[-56, 8], [-46, 14]] as const) {
    for (const side of [0, 11]) b.tube(DARK, 0.28, 17, x + at + side, 0, z + depth);
    b.box(DARK, 11.6, 0.4, 0.4, x + at + 5.5, 17, z + depth);
    for (const side of [1.5, 5.5, 9.5]) { b.tube(PALE, 0.28, 1.6, x + at + side, 15.4, z + depth, { sides: 8 }); b.tube(DARK, 0.1, 5, x + at + side, 17.4, z + depth, { sides: 6 }); }
  }
  b.box('#8C969D', 4, 3.4, 3, x - 48, 0.6, z + 10); b.box(DARK, 4.2, 0.3, 3.2, x - 48, 4, z + 10); for (let i = 0; i < 5; i++) b.box(STEEL, 0.2, 2.6, 0.2, x - 49.5 + i * 0.75, 4.3, z + 10);
}


function turbine(b: Build, x: number, y: number, z: number, hub: number, blade: number, turn: number) {
  if (b.model('hsinchu_wind_turbine_v2', x, y, z, (hub + blade) / 91)) return;
  b.tube('#EDEFEC', 1.9, hub - 1, x, y, z, { top: 0.55, sides: 24 }); b.tube('#C8CCC9', 2, 0.5, x, y, z, { sides: 24 });
  b.box('#E3E6E3', 2.8, 2.8, 8, x, y + hub - 1.6, z - 1.2); b.box('#F8F9F7', 2.4, 0.5, 6, x, y + hub + 1.2, z - 1.2); b.ball(LIGHT, 0.3, 0.3, 0.3, x, y + hub + 1.9, z - 3.2, { glow: 3 });
  b.tube('#F2F3F0', 1.7, 2.4, x, y + hub - 1.2, z + 3, { top: 0.35, sides: 18, turn: [90, 0, 0] });
  b.ball('#F2F3F0', 1.7, 1.7, 1.5, x, y + hub, z + 3);
  for (let i = 0; i < 3; i++) {
    const angle = turn + i * 120, a = angle * Math.PI / 180, dx = -Math.sin(a), dy = Math.cos(a), root = 1.5, main = blade * 0.86, tip = blade * 0.14;
    b.taper('#F6F7F5', 3.2, main, 0.5, x + dx * (root + main / 2), y + hub + dy * (root + main / 2) - main / 2, z + 3.4, 0.4, 0.5, { turn: [0, 0, angle] });
    b.taper(STRIPE, 3.2 * 0.4, tip, 0.5, x + dx * (root + main + tip / 2), y + hub + dy * (root + main + tip / 2) - tip / 2, z + 3.4, 0.5, 0.5, { turn: [0, 0, angle] });
  }
  b.ball('#E9ECE9', 0.9, 0.9, 0.7, x, y + hub, z + 4.4);
}


function wind(b: Build, x: number, z: number) {
  if (plant(b, 'wind', x, z)) return;
  b.dome(SAND, 34, 7, 20, x - 6, 0, z + 2, { rough: 1 }); b.dome(shade(SAND, 0.94), 22, 5, 14, x + 24, 0, z + 6, { rough: 1 }); b.dome(shade(SAND, 1.05), 16, 4, 12, x - 32, 0, z + 8, { rough: 1 });
  for (const [dx, dz, r] of [[-12, 12, 5], [6, 14, 6], [20, 10, 4.4], [-26, 14, 4]] as const) b.dome(GRASS, r, 1.2, r * 0.6, x + dx, 0, z + dz, { rough: 1 });
  turbine(b, x - 24, 4.6, z + 6, 31, 19, 14); turbine(b, x, 6.4, z - 2, 35, 23, 62); turbine(b, x + 26, 4, z + 9, 28, 17, 100);
  b.box('#D8D3C6', 3, 2.2, 3.4, x - 10, 0.4, z + 15); b.box('#8C969D', 3.2, 0.3, 3.6, x - 10, 2.6, z + 15);
}


export const hsinchu: Skyline = {
  sights: [
    { reach: 45, build: fab },
    { reach: 46, build: cooling },
    { reach: 59, build: power },
    { reach: 48, build: wind },
  ],
  behind: (b, length, _train, lit) => pylons(b, length, lit),
};


function pylons(b: Build, length: number, lit: number) {
  if (b.model('hsc3_pylon_14m', length / 2, 0, -24)) {
    b.model('hsc3_cable_span_14m', length, 0, -24);
    return;
  }
  const x = length / 2, z = -24, height = 17, spread = 1.5, arms = [[9.5, 3.8], [12.5, 3.2], [15.5, 2.6]] as const, lean = (y: number) => spread * (1 - y / height * 0.74);
  for (const side of [-1, 1]) for (const depth of [-1, 1]) bar(b, PYLON, 0.3, x + side * spread, 0, x + side * lean(height), height, z + depth * 1.2);
  for (let i = 0; i < 5; i++) {
    const low = i * height / 5, high = (i + 1) * height / 5;
    for (const depth of [-1, 1]) { bar(b, PYLON, 0.14, x - lean(low), low, x + lean(high), high, z + depth * 1.2); bar(b, PYLON, 0.14, x + lean(low), low, x - lean(high), high, z + depth * 1.2); }
    for (const side of [-1, 1]) b.box(PYLON, 0.14, 0.14, 2.4, x + side * lean(low), low, z);
  }
  b.tube(PYLON, 0.2, 2.2, x, height, z, { top: 0.6, sides: 8 });
  for (const [y, half] of arms) {
    b.box(PYLON, 0.3, 0.3, half * 2, x, y, z);
    for (const side of [-1, 1]) b.tube('#E8E8E0', 0.16, 1, x, y - 1, z + side * half, { sides: 8 });
  }
  const wire = (y: number, at: number) => {
    const sag = 0.8, steps = 8, drop = (t: number) => sag * (1 - (2 * t - 1) ** 2);
    for (let i = 0; i < steps; i++) bar(b, WIRE, 0.1, x + i / steps * length, y - 1 - sag + drop(i / steps), x + (i + 1) / steps * length, y - 1 - sag + drop((i + 1) / steps), at);
  };
  for (const [y, half] of arms) for (const side of [-1, 1]) wire(y, z + side * half);
  if (lit) b.ball(LIGHT, 0.3, 0.3, 0.3, x, height + 2.4, z, { glow: lit });
}
