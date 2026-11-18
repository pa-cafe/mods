

import { CREAM, INK, RED } from './art';
import { type Build, lights, shade, type Skyline } from './street3d-kit';

type Look = NonNullable<Parameters<Build['box']>[7]>;
const SQUARE = { sides: 4, turn: [0, 45, 0] } as const, R2 = Math.SQRT2;
const ORANGE = '#E2512D', ORANGE_DARK = '#B2351F', DECK = '#3A3548', ASPHALT = '#26232F', LAMP = '#FFD58A', STEEL = '#C9D3D8';
const GREEN_HILL = '#3A7D5A', GREEN_DEEP = '#2C6A4A', TREE = '#1E4A36';
const QUARTZ = '#F1EEE6', GLASS_DARK = '#313A5E', GLASS_LIT = '#FFE3A8', BLOCK = '#2C2A58';
const STONE = '#8C8798', CONCRETE = '#8B8796', BRICK = '#A5533C', SLATE = '#4C4260', TRIM = '#FFF3DC', WOOD = '#5A3A2A', CITY_WHITE = '#FFF6EA';
const DEG = 180 / Math.PI;


function bar(b: Build, color: string, t: number, x1: number, y1: number, x2: number, y2: number, z: number, look: Look = {}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  b.box(color, length, t, t, (x1 + x2) / 2, (y1 + y2) / 2 - t / 2, z, { ...look, turn: [0, 0, Math.atan2(y2 - y1, x2 - x1) * DEG] });
}


function brace(b: Build, color: string, t: number, x: number, y1: number, z1: number, y2: number, z2: number) {
  const length = Math.hypot(y2 - y1, z2 - z1);
  b.box(color, t, length, t, x, (y1 + y2) / 2 - length / 2, (z1 + z2) / 2, { turn: [Math.atan2(z2 - z1, y2 - y1) * DEG, 0, 0] });
}


const hillAt = (rx: number, ry: number, rz: number, dx: number, dz: number) => {
  const inside = 1 - (dx / rx) ** 2 - (dz / rz) ** 2;
  return inside > 0 ? ry * Math.sqrt(inside) : -1;
};


function tree(b: Build, x: number, y: number, z: number, size: number, round = false) {
  b.tube(shade(INK, 1.4), size * 0.12, size * 0.4, x, y, z, { sides: 6 });
  if (round) b.ball(TREE, size * 0.5, size * 0.46, size * 0.5, x, y + size * 0.7, z, { rough: 1 });
  else b.tube(TREE, size * 0.32, size, x, y + size * 0.2, z, { top: 0.12, sides: 8, rough: 1 });
}





function bridge(b: Build, x: number, z: number, lit: number) {
  const glow = lit * 0.32, tower = 34, end = 60, deck = 17, top = 55, low = deck + 2.4, planes = [-4.4, 4.4], deckTop = deck + 1;
  b.dome(GREEN_HILL, 11, 20, 12, x - end - 4, 0, z - 1, { rough: 1 }); b.dome(shade(GREEN_HILL, 1.1), 11, 18.8, 11, x + end + 4, 0, z - 1, { rough: 1 });
  b.dome(GREEN_DEEP, 12, 13, 9, x - end + 4, 0, z - 8, { rough: 1 }); b.dome(GREEN_DEEP, 10, 11, 9, x + end - 2, 0, z - 9, { rough: 1 });
  if (b.model('sfv2_golden_gate', x, 0, z)) return;
  b.box(DECK, end * 2 + 2, 1, 7.6, x, deck, z); b.box(ASPHALT, end * 2, 0.06, 5.8, x, deckTop, z);
  for (let i = 0; i < Math.floor(end * 2 / 3.1); i++) b.box(CREAM, 1.4, 0.04, 0.16, x - end + 1.5 + i * 3.1, deckTop + 0.04, z, { glow: lit * 0.3 });
  for (const plane of planes) {
    const edge = z + plane * 0.9;
    b.box(ORANGE, end * 2 + 1, 1.5, 0.5, x, deck - 0.5, edge, { glow }); b.box(ORANGE_DARK, end * 2 + 1, 0.3, 0.7, x, deck - 1.8, edge);
    b.box(ORANGE, end * 2, 0.16, 0.16, x, deckTop + 1.7, edge); b.box(ORANGE, end * 2, 0.16, 0.16, x, deckTop + 0.9, edge);
    if (lit) b.box(LAMP, end * 2, 0.14, 0.1, x, deck + 0.35, edge + Math.sign(plane) * 0.3, { glow: lit * 1.5 });
    for (let i = 0; i <= Math.floor((end * 2 - 3) / 3.05); i++) {
      const at = x - end + 1.5 + i * 3.05;
      b.box(ORANGE, 0.14, 1.7, 0.14, at, deckTop, edge); if (lit) b.ball(LAMP, 0.22, 0.22, 0.22, at, deckTop + 1.95, edge, { glow: lit * 2.2 });
    }
    const cells = Math.round(end * 2 / 1.55), step = end * 2 / cells;
    b.box(ORANGE_DARK, end * 2, 0.36, 0.36, x, deck - 2.9, z + plane * 0.92);
    for (let i = 0; i < cells; i++) bar(b, ORANGE_DARK, 0.22, x - end + i * step, i % 2 ? deck - 2.7 : deck - 0.8, x - end + (i + 1) * step, i % 2 ? deck - 0.8 : deck - 2.7, z + plane * 0.92);
  }
  const cable = (dx: number) => low + (top - low) * (dx / tower) ** 2;
  const span = (side: number) => {
    const at = (t: number) => [tower + (end - tower) * t, top + (deckTop + 1.2 - top) * t - 3.4 * Math.sin(Math.PI * t)] as const;
    for (let i = 0; i < 12; i++) { const [x1, y1] = at(i / 12), [x2, y2] = at((i + 1) / 12); for (const plane of planes) bar(b, ORANGE, 0.8, x + side * x1, y1, x + side * x2, y2, z + plane, { glow }); }
    for (let dx = tower + 2; dx < end - 0.5; dx += 2) { const [, y] = at((dx - tower) / (end - tower)); for (const plane of planes) b.box(ORANGE_DARK, 0.1, y - deckTop, 0.1, x + side * dx, deckTop, z + plane); }
  };
  span(-1); span(1);
  for (let i = 0; i < 40; i++) {
    const x1 = -tower + i * tower / 20, x2 = x1 + tower / 20;
    for (const plane of planes) bar(b, ORANGE, 0.8, x + x1, cable(x1), x + x2, cable(x2), z + plane, { glow });
  }
  for (let dx = -tower + 1.4; dx < tower - 1; dx += 1.4) for (const plane of planes) b.box(ORANGE_DARK, 0.1, cable(dx) - deckTop, 0.1, x + dx, deckTop, z + plane);
  const steps = [[0, 17, 4.8], [17, 31, 4], [31, 43, 3.4], [43, 53, 2.9]] as const, struts = [20, 28, 36, 44, 51];
  for (const side of [-1, 1]) {
    const tx = x + side * tower;
    for (const plane of planes) {
      const leg = z + plane, face = leg + Math.sign(plane) * 1.25;
      steps.forEach(([y0, y1, w]) => {
        b.box(ORANGE, w, y1 - y0, 2.5, tx, y0, leg, { glow }); b.box(ORANGE_DARK, w + 0.5, 0.5, 3, tx, y1 - 0.25, leg);
        for (const rib of [-1, 0, 1]) b.box(ORANGE_DARK, 0.26, y1 - y0 - 0.5, 0.16, tx + rib * w * 0.3, y0, face + Math.sign(plane) * 0.05);
      });
      for (const y of struts) b.box(ORANGE_DARK, steps.find(([, top]) => y < top)![2] + 0.5, 1.2, 0.4, tx, y, face + Math.sign(plane) * 0.1);
      b.box(ORANGE, 3.4, 3, 3.2, tx, 53, leg, { glow }); b.box(ORANGE_DARK, 4, 0.5, 3.6, tx, 55.5, leg);
    }
    for (const y of struts) b.box(ORANGE, 2.6, 1.2, 6.4, tx, y, z);
    struts.slice(0, -1).forEach((y0, i) => { const y1 = struts[i + 1]; brace(b, ORANGE_DARK, 0.3, tx, y0 + 1.2, z - 3.15, y1, z + 3.15); brace(b, ORANGE_DARK, 0.3, tx, y0 + 1.2, z + 3.15, y1, z - 3.15); });
    for (const plane of planes) b.ball(RED, 0.4, 0.4, 0.4, tx, 56.4, z + plane, { glow: 3 });
  }
  for (const [dx, y, w] of [[-20, 36, 40], [24, 31, 44], [0, 46, 52]] as const) b.ball('#E9CBF2', w, 1.8, 7, x + dx, y, z + 2, { flat: 0.09 });
}


function pyramid(b: Build, x: number, z: number, lit: number) {
  const base = 17, top = 3.8, h = 48, k = (base - top) / 2 / h, lean = Math.atan(k), tilt = lean * DEG, half = (y: number) => base / 2 - k * y;
  for (const [dx, w, height, d, name] of [[-15.5, 8, 31, 8, 0], [14.5, 7, 22, 7, 1], [-22, 5, 17, 6, 2]] as const) {
    const colors = lit ? [LAMP, '#FFB5D0'] : ['#8FB4D8'];
    b.box(BLOCK, w, height, d, x + dx, 0, z - 3);
    b.sign(`bay:block:${name}:${lit ? 1 : 0}`, lights(colors, 6, 14, 0.55, '#3B4670', name + 3), w * 0.86, height * 0.9, x + dx, height * 0.5, z - 3 + d / 2 + 0.03, { glow: lit ? 1.1 : 0 });
  }
  if (b.model('sfv2_transamerica_pyramid', x, 0, z)) return;
  b.taper(QUARTZ, base, h, base, x, 0, z, top / base, top / base, { glow: lit * 0.42 });
  const ys = [8, 13.5, 19, 24.5, 30, 35.5, 41], columns = [-7, -5.2, -3.4, -1.6, 0.2, 2, 3.8, 5.6, 7.4];
  for (const face of ['front', 'right', 'left'] as const) columns.forEach((u, i) => ys.forEach((y0, j) => {
    const reach = (base / 2 - Math.abs(u) - 0.6) / k, y1 = Math.min(y0 + 5.2, reach, h - 1.5);
    if (y1 - y0 < 1.4) return;
    const length = (y1 - y0) / Math.cos(lean), mid = (y0 + y1) / 2 - length / 2 * Math.cos(lean), roll = Math.sin(i * 12.9 + j * 78.2 + face.length * 5.3) * 43758.5, on = lit && roll - Math.floor(roll) > 0.5;
    const look = { glow: on ? lit * 0.9 : 0 }, color = on ? GLASS_LIT : GLASS_DARK, off = half((y0 + y1) / 2) + 0.06;
    if (face === 'front') b.box(color, 0.78, length, 0.12, x + u, mid, z + off, { ...look, turn: [-tilt, 0, 0] });
    else b.box(color, 0.12, length, 0.78, x + (face === 'right' ? off : -off), mid, z + u, { ...look, turn: [0, 0, face === 'right' ? tilt : -tilt] });
  }));
  for (const side of [-1, 1]) {
    const wx = x + side * 3.9;
    b.taper(shade(QUARTZ, 0.94), 1.2, 3.6, 3.7, wx, 25.4, z, 2.8, 1);
    b.box(shade(QUARTZ, 0.96), 3.4, 21, 3.7, wx, 29, z, { glow: lit * 0.45 }); b.taper(shade(QUARTZ, 0.9), 3.6, 0.8, 3.9, wx, 50, z, 0.8, 0.8);
    for (const dz of [-0.5, 0.5]) b.box(side > 0 ? GLASS_DARK : shade(QUARTZ, 0.82), 0.55, 15, 0.1, wx + (side > 0 ? 0.1 * dz : 0), 31, z + 1.87, { glow: side > 0 ? lit * 0.5 : 0 });
  }
  b.tube(shade('#FFF2D0', 1), (top / 2) * R2, 5, x, h, z, { ...SQUARE, top: 0.86, glow: lit * 1.15 });
  b.tube(QUARTZ, 0.95 * R2, 13, x, h + 5, z, { ...SQUARE, top: 0.14, glow: lit * 0.2 }); b.ball(RED, 0.4, 0.4, 0.4, x, h + 18.4, z, { glow: 3 });
}


function coit(b: Build, x: number, z: number, lit: number) {
  const hill = { x: 20, y: 22, z: 17 }, peak = 20, white = '#EFEBE1', rib = '#FBF9F3', glow = lit * 0.14;
  b.dome(GREEN_HILL, hill.x, hill.y, hill.z, x, 0, z, { rough: 1 }); b.dome(GREEN_DEEP, 13, 12, 11, x - 14, 0, z + 5, { rough: 1 }); b.dome(shade(GREEN_HILL, 1.08), 12, 14, 10, x + 15, 0, z + 4, { rough: 1 });
  for (const [dx, dz, size, round] of [[-9, 8, 6, false], [-5, 10, 5, true], [7, 9, 6.5, false], [11, 6, 5, true], [-13, 5, 5.5, false], [14, 3, 5, false], [3, 11, 4.5, true], [-1, 12, 5, false], [-16, 1, 4.5, true], [16, 0, 4.5, true]] as const) {
    const y = hillAt(hill.x, hill.y, hill.z, dx, dz);
    if (y > 4) tree(b, x + dx, y - 1.2, z + dz, size, round);
  }
  for (const [dx, dz, color, w] of [[-7, 11.5, '#F2A6B8', 3.6], [-3, 13.2, '#F7DE8A', 3.2], [4, 12.6, '#8FB8E8', 3.4], [8, 11.2, '#F5B994', 3], [-11, 9.8, '#BBA5E0', 3]] as const) {
    const y = hillAt(hill.x, hill.y, hill.z, dx, dz);
    if (y < 4) continue;
    b.box(color, w, 2.6, 2.8, x + dx, y - 2.4, z + dz); b.ridge(SLATE, w + 0.4, 1.2, 3, x + dx, y + 0.2, z + dz);
    if (lit) b.pane(LAMP, 0.7, 0.8, x + dx - 0.7, y - 1, z + dz + 1.42, { glow: lit * 0.9 });
  }
  b.tube(STONE, 8.2, 0.8, x, peak - 0.4, z, { rough: 1 }); b.tube(shade(white, 0.92), 6.2, 1.2, x, peak + 0.4, z); b.tube(white, 5.5, 0.8, x, peak + 1.6, z, { glow });
  if (b.model('sfv2_coit_tower', x, peak, z)) return;
  const foot = peak + 2.4, shaft = 24, r = 3.6, crest = foot + shaft;
  b.tube(shade(white, 0.96), r, shaft, x, foot, z, { sides: 28, glow });
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.tube(rib, 0.3, shaft, x + Math.cos(a) * r, foot, z + Math.sin(a) * r, { sides: 6, glow }); }
  b.tube(white, r + 0.5, 1, x, crest, z, { sides: 28, glow }); b.tube(shade(white, 0.9), r + 0.3, 0.5, x, crest - 0.5, z, { sides: 28 });
  const drum = crest + 1, tall = 4.6;
  b.tube(white, r + 0.2, tall, x, drum, z, { sides: 28, glow });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    b.tube(rib, 0.32, tall, x + s * (r + 0.28), drum, z + c * (r + 0.28), { sides: 6, glow });
    if (c < -0.25) continue;
    const m = ((i + 0.5) / 12) * Math.PI * 2, mx = x + Math.sin(m) * (r + 0.3), mz = z + Math.cos(m) * (r + 0.3), look = { glow: lit * 0.9, turn: [0, m * DEG, 0] as const };
    b.pane(lit ? LAMP : '#2E3150', 1.1, 2.1, mx, drum + 1.7, mz, look);
    b.tube(lit ? LAMP : '#2E3150', 0.55, 0.05, mx, drum + 2.7, mz, { sides: 20, glow: lit * 0.9, turn: [90, 0, 0] });
  }
  b.tube(shade(white, 0.9), r + 0.8, 0.7, x, drum + tall, z, { sides: 28 }); b.tube(white, r + 0.5, 0.5, x, drum + tall + 0.7, z, { sides: 28, glow });
  const cap = drum + tall + 1.2;
  b.tube(white, 2.5, 3, x, cap, z, { sides: 20, glow });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.tube(rib, 0.2, 3, x + Math.cos(a) * 2.5, cap, z + Math.sin(a) * 2.5, { sides: 5, glow }); }
  b.tube(shade(white, 0.88), 2.9, 0.5, x, cap + 3, z, { sides: 20 }); b.dome(white, 2.2, 1.3, 2.2, x, cap + 3.5, z, { glow });
  b.box(STEEL, 0.14, 1.2, 0.14, x, cap + 4.7, z); b.ball(RED, 0.25, 0.25, 0.25, x, cap + 6, z, { glow: 3 });
}

const HOUSES = [
  { wall: '#F2A6B8', accent: '#9C3E63', bay: 1, tower: false }, { wall: '#9FD8C0', accent: '#2E7A62', bay: -1, tower: false }, { wall: '#F7DE8A', accent: '#B8742A', bay: 1, tower: true },
  { wall: '#8FB8E8', accent: '#2F5E9E', bay: -1, tower: false }, { wall: '#C6AFE8', accent: '#6A4CA3', bay: 1, tower: false },
] as const;


function house(b: Build, x: number, z: number, lit: number, id: number, front: { y: number }) {
  const { wall, accent, bay, tower } = HOUSES[id], w = 8.4, d = 9, f0 = 3.6, f1 = 5.2, f2 = 4.8, y0 = front.y, y1 = y0 + f0, y2 = y1 + f1, y3 = y2 + f2, face = z + d / 2, glass = (on: boolean) => on ? LAMP : '#6F8FB8';
  const on = (floor: number) => lit > 0 && (id + floor) % 4 !== 0, atBay = x + bay * 1.7, atDoor = x - bay * 1.9;
  const lamp = { glow: lit * 0.22 };
  b.box(shade(wall, 0.78), w + 0.3, f0, d, x, y0, z, lamp); b.box(wall, w, f1, d, x, y1, z, lamp); b.box(shade(wall, 1.08), w, f2, d, x, y2, z, lamp);
  for (const y of [y1, y2, y3]) b.box(TRIM, w + 0.5, 0.3, d + 0.5, x, y - 0.15, z);
  b.box(shade(wall, 0.5), 2.8, 2.3, 0.12, atBay, y0 + 0.1, face + 0.02); if (lit) b.pane(LAMP, 2.4, 0.2, atBay, y0 + 2.6, face + 0.08, { glow: lit * 0.8 });
  const sides = tower ? 10 : 6, radius = tower ? 2.5 : 2.2, apothem = radius * Math.cos(Math.PI / sides), round = { sides, turn: [0, tower ? 18 : 30, 0] } as const;
  b.tube(shade(wall, 1.03), radius, f1 + f2, atBay, y1, face, { ...round, ...lamp }); b.tube(TRIM, radius + 0.15, 0.3, atBay, y2 - 0.15, face, round); b.tube(TRIM, radius + 0.15, 0.3, atBay, y3 - 0.15, face, round);
  b.tube(accent, radius + 0.35, tower ? 6 : 2, atBay, y3, face, { ...round, top: 0.06 }); b.ball(TRIM, 0.3, 0.3, 0.3, atBay, y3 + (tower ? 6.1 : 2.1), face);
  [y1, y2].forEach((y, floor) => {
    b.pane(glass(on(floor)), tower ? 1.1 : 1.5, 2.8, atBay, y + 2.3, face + apothem + 0.03, { glow: on(floor) ? lit * 0.9 : 0 });
    for (const sx of [-1, 1]) b.pane(glass(on(floor)), 1.1, 2.8, atBay + sx * apothem * Math.sin(Math.PI / 3), y + 2.3, face + apothem * Math.cos(Math.PI / 3) + 0.03, { glow: on(floor) ? lit * 0.9 : 0, turn: [0, sx * 60, 0] });
  });
  [y1, y2].forEach((y, floor) => {
    b.box(TRIM, 1.9, 3.4, 0.18, atDoor, y + 0.7, face + 0.05); b.pane(glass(on(floor + 1)), 1.4, 2.9, atDoor, y + 2.15, face + 0.16, { glow: on(floor + 1) ? lit * 0.9 : 0 });
    b.box(TRIM, 0.12, 2.9, 0.05, atDoor, y + 0.7, face + 0.18); b.box(accent, 2.2, 0.3, 0.4, atDoor, y + 0.4, face + 0.1);
  });
  b.box(WOOD, 1.5, 2.7, 0.14, atDoor, y1 - 0.01, face + 0.03); b.box(TRIM, 1.9, 0.3, 0.3, atDoor, y1 + 2.7, face + 0.08);
  for (let i = 0; i < 3; i++) b.box(shade(STONE, 1 + i * 0.06), 2.2, f0 / 3, 0.8, atDoor, y0 + i * f0 / 3, face + 1.9 - i * 0.5);
  if (lit) b.ball(LAMP, 0.2, 0.2, 0.2, atDoor + 1, y1 + 2.2, face + 0.25, { glow: lit * 2 });
  const rise = 5.6, slope = Math.atan2(rise, w / 2 + 0.4), long = Math.hypot(rise, w / 2 + 0.4) + 0.2;
  b.taper(shade(wall, 1.12), w, rise, d, x, y3, z, 0.02, 1, lamp);
  for (const side of [-1, 1]) {
    b.box(SLATE, long, 0.28, d + 0.9, x + side * (w / 4 + 0.2), y3 + rise / 2 + 0.2, z, { turn: [0, 0, -side * slope * DEG] });
    bar(b, TRIM, 0.4, x + side * (w / 2 + 0.55), y3 - 0.2, x, y3 + rise + 0.12, face + 0.5);
  }
  b.disc(TRIM, 1.05, x, y3 + 2.1, face + 0.04); b.disc(glass(on(3)), 0.78, x, y3 + 2.1, face + 0.07, { glow: on(3) ? lit * 0.9 : 0 });
  for (const dx of [-1.4, 1.4]) b.box(accent, 0.2, 1.1, 0.1, x + dx, y3 + 0.5, face + 0.04);
  b.box(TRIM, 0.16, 1.3, 0.16, x, y3 + rise + 0.2, face + 0.45); b.box(BRICK, 0.9, 3, 0.9, x + w * 0.3, y3 + 1.5, z - 2.4);
}


function ladies(b: Build, x: number, z: number, lit: number) {
  const pitch = 9, terrace = 14, front = { y: terrace }, at = (i: number) => x + (i - 2) * pitch;
  b.dome(GREEN_HILL, 46, 46, 20, x, 0, z - 26, { rough: 1 }); b.dome(shade(GREEN_HILL, 1.12), 20, 33, 12, x - 28, 0, z - 20, { rough: 1 }); b.dome(shade(GREEN_HILL, 0.9), 18, 30, 12, x + 30, 0, z - 21, { rough: 1 });
  for (const [dx, y, size, round] of [[-30, 26, 7, false], [-14, 40, 6, true], [-4, 45, 7, false], [6, 46, 6.5, true], [16, 40, 7, false], [29, 24, 6, true]] as const) tree(b, x + dx, y, z - 24, size, round);
  b.box(STONE, pitch * 5 + 3.4, terrace, 13, x, 0, z + 0.5); b.box(shade(STONE, 1.12), pitch * 5 + 3.8, 0.5, 13.6, x, terrace - 0.5, z + 0.5);
  if (!b.model('sfv2_painted_ladies', x, terrace, z - 1, 1.15)) {
    for (let i = 0; i < 5; i++) house(b, at(i), z - 1, lit, i, front);
  }
  for (let i = 0; i <= 5; i++) {
    const lx = x + (i - 2.5) * pitch;
    b.tube(INK, 0.1, 4.6, lx, terrace, z + 6.6, { sides: 6 }); b.ball(LAMP, 0.32, 0.32, 0.32, lx, terrace + 4.9, z + 6.6, { glow: lit * 2.2 });
    if (i < 5) b.dome(GREEN_DEEP, 1.5, 1, 1.2, x + (i - 2) * pitch + 2.6, terrace, z + 6.4, { rough: 1 });
  }
}

const SIGN_FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
type Ad = { lines: readonly (readonly [string, number, string])[]; ground: readonly [string, string]; edge: string; fine: string; note: string };


const ad = ({ lines, ground, edge, fine, note }: Ad, w: number, h: number) => (ctx: CanvasRenderingContext2D, s: number) => {
  const gradient = ctx.createLinearGradient(0, 0, s, s); gradient.addColorStop(0, ground[0]); gradient.addColorStop(1, ground[1]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
  const W = w * 100, H = h * 100; ctx.scale(s / W, s / H);
  ctx.strokeStyle = edge; ctx.lineWidth = H * 0.03; ctx.shadowColor = edge; ctx.shadowBlur = H * 0.06; ctx.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12); ctx.shadowBlur = 0;
  const total = lines.reduce((sum, [, size]) => sum + size, 0), top = (H * 0.84 - total * H) / 2 + H * 0.06;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let y = top;
  for (const [text, size, color] of lines) {
    ctx.font = `900 ${size * H}px ${SIGN_FONT}`; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = H * 0.03;
    ctx.fillText(text, W / 2, y + size * H / 2, W * 0.86); y += size * H;
  }
  ctx.shadowBlur = 0; ctx.font = `700 ${H * 0.065}px ${SIGN_FONT}`; ctx.fillStyle = fine; ctx.fillText(note, W / 2, H * 0.9, W * 0.86);
};
const ADS: readonly (Ad & { w: number; h: number })[] = [
  { w: 4.8, h: 3.1, lines: [['AGI', 0.42, '#6BFFD8'], ['明天就到', 0.3, '#FFFFFF']], ground: ['#2B1163', '#7A1D9A'], edge: '#6BFFD8', fine: '#CDB8FF', note: '*明天的定義以我們為準' },
  { w: 5.2, h: 3.3, lines: [['你的下一位同事', 0.25, '#FFFFFF'], ['是 Agent', 0.4, '#FF8FB8']], ground: ['#0F2A5C', '#1E5FB4'], edge: '#FF8FB8', fine: '#BFE0FF', note: '他不用午休，也不用年假' },
  { w: 3.6, h: 2.8, lines: [['TOKENS', 0.32, '#1A1636'], ['大特價', 0.36, '#C8173F']], ground: ['#FFD86B', '#FF9F4A'], edge: '#C8173F', fine: '#5A2A2A', note: '買一送一，送完為止' },
  { w: 4.4, h: 2.6, lines: [['NEXT EXIT', 0.17, '#FFFFFF'], ['奇點 SINGULARITY', 0.15, '#FFFFFF'], ['2 MI', 0.28, '#FFE08A']], ground: ['#0E6B45', '#0A5A3A'], edge: '#FFFFFF', fine: '#D8FFE9', note: '↑ 請繫好安全帶，與提示詞' },
];


function billboard(b: Build, ads: number, lit: number, x: number, y: number) {
  const { w, h, ...paint } = ADS[ads], z = -26;
  for (const leg of [-1, 1]) b.box(shade(STEEL, 0.55), 0.5, y, 0.5, x + leg * w * 0.34, 0, z);
  b.box(shade(STEEL, 0.4), w + 0.6, h + 0.6, 0.5, x, y, z - 0.3); b.box(shade(STEEL, 0.62), w + 0.9, 0.3, 1.1, x, y - 0.4, z + 0.2);
  b.sign(`bay:ad:${ads}`, ad(paint, w, h), w, h, x, y + h / 2 + 0.3, z - 0.02, { glow: lit * 0.95, sharp: true });
  for (let i = 0; i < 4; i++) {
    const at = x - w * 0.38 + i * w * 0.253;
    b.box(shade(STEEL, 0.5), 0.1, 0.1, 1.2, at, y + h + 0.75, z + 0.4); b.box(STEEL, 0.5, 0.22, 0.4, at, y + h + 0.62, z + 1.05, { glow: lit * 3 });
  }
  b.box(shade(STEEL, 0.5), w + 0.9, 0.08, 0.08, x, y + 0.4, z + 0.75); for (let i = 0; i <= 6; i++) b.box(shade(STEEL, 0.5), 0.06, 0.4, 0.06, x - w / 2 - 0.4 + i * (w + 0.8) / 6, y, z + 0.75);
}


function car(b: Build, x: number, y: number, z: number, way: 1 | -1, color: string, lit: number, long = false) {
  const length = long ? 6.2 : 2.9, height = long ? 1.9 : 0.95;
  b.box(color, length, height, 1.6, x, y + 0.2, z, { glow: lit * 0.12 }); b.box(shade(color, 0.7), length * 0.42, 0.18, 1.7, x - way * 0.1, y + 0.2, z);
  if (long) b.box(shade(color, 1.25), length * 0.7, 1.6, 1.7, x - way * length * 0.14, y + 1.2, z); else b.box(shade(color, 0.6), length * 0.5, 0.6, 1.4, x - way * 0.15, y + 1.15, z);
  if (!lit) return;
  b.box(CITY_WHITE, 0.2, 0.3, 1.3, x + way * length / 2, y + 0.75, z, { glow: lit * 2.6 }); b.ball(LAMP, 2.3, 0.4, 1, x + way * (length / 2 + 1.7), y + 0.4, z, { flat: 0.3 });
  b.box(RED, 0.2, 0.28, 1.3, x - way * length / 2, y + 0.85, z, { glow: lit * 2.8 }); b.ball(RED, 0.8, 0.3, 0.8, x - way * (length / 2 + 0.4), y + 0.5, z, { flat: 0.24 });
}


function freeway(b: Build, length: number, board: boolean, lit: number) {
  const deck = 8.6, z = -21, top = deck + 1.4;
  b.box(CONCRETE, length, 1.4, 6.8, length / 2, deck, z); b.box(shade(CONCRETE, 0.78), length, 0.5, 6.2, length / 2, deck - 0.5, z);
  b.box(ASPHALT, length, 0.05, 5.6, length / 2, top, z); b.box(shade(CONCRETE, 1.1), length, 0.5, 0.4, length / 2, top, z + 3.2); b.box(shade(CONCRETE, 1.1), length, 0.5, 0.4, length / 2, top, z - 3.2);
  b.box(shade(CONCRETE, 1.25), length, 0.12, 0.5, length / 2, top + 0.5, z + 3.2);
  for (const x of [length * 0.25, length * 0.75]) { b.box(shade(CONCRETE, 0.9), 1.7, deck - 0.8, 2.4, x, 0, z); b.box(CONCRETE, 5, 1.1, 5.4, x, deck - 1.8, z); }
  for (let i = 0; i < 4; i++) b.box(shade(CONCRETE, 0.7), 0.1, 1.3, 0.1, i * length / 3.5 + 0.6, deck + 0.05, z + 3.42);
  for (let i = 0; i < 4; i++) b.box(CREAM, 1.8, 0.04, 0.14, length * 0.12 + i * length * 0.25, top + 0.05, z + 0.9, { glow: lit * 0.3 });
  for (let i = 0; i < 4; i++) b.box(LAMP, 1.8, 0.04, 0.14, length * 0.12 + i * length * 0.25, top + 0.05, z - 0.9, { glow: lit * 0.3 });
  for (const x of [length * 0.05, length * 0.93]) {
    b.tube(STEEL, 0.12, 4.4, x, top + 0.2, z + 3.2, { sides: 6 }); b.box(STEEL, 0.1, 0.1, 1.6, x, top + 4.5, z + 2.5); b.box(LAMP, 0.5, 0.2, 0.9, x, top + 4.36, z + 1.7, { glow: lit * 3.5 });
    if (lit) b.ball('#FFC47A', 0.9, 2.2, 0.9, x, top + 2, z + 1.7, { flat: 0.1 });
  }
  const driving = [[1.8, 1, 0], [6.1, 1, 1], [10.6, 1, 2], [3.8, -1, 3], [9.4, -1, 4]] as const, paints = ['#5A72B8', '#C04467', '#D8DCE6', '#3F9A8E', '#8A66C8'];
  for (const [at, way, i] of driving) car(b, at, top, z + way * -1.55, way as 1 | -1, paints[i], lit, i === 4);
  if (board) { billboard(b, 0, lit, length * 0.19, 15.4); billboard(b, 1, lit, length * 0.56, 17.2); billboard(b, 2, lit, length * 0.86, 14.4); return; }
  const w = ADS[3].w, h = ADS[3].h, x = length * 0.5, sign = shade(STEEL, 0.5);
  for (const leg of [-1, 1]) b.box(sign, 0.28, 12.2, 0.28, x + leg * w * 0.4, 0, z - 4);
  b.box('#E9ECEF', w + 0.4, h + 0.4, 0.2, x, 11.6, z - 4.2); b.sign('bay:ad:3', ad(ADS[3], w, h), w, h, x, 11.8 + h / 2, z - 4.06, { glow: lit * 0.55, sharp: true });
}


export const bay: Skyline = {
  sights: [
    { reach: 72, build: bridge },
    { reach: 22, build: pyramid },
    { reach: 18, build: coit },
    { reach: 22, build: ladies },
  ],
  behind: (b, length, train, lit) => freeway(b, length, train, lit),
};
