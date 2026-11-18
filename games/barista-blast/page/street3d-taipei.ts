

import { CREAM, INK, PINK, RED } from './art';
import { type Build, mark, shade, type Skyline } from './street3d-kit';

const GLASS = '#4FA39B', GOLD = '#FFD86B', STEEL = '#C9D3D8', HILL = '#7FB08E', CONCRETE = '#D9D4C8', WHITE = '#F4F1EA', BLUE = '#2B4FA8';
const SQUARE = { sides: 4, turn: [0, 45, 0] } as const, R2 = Math.SQRT2;


export const plaque = (text: string, ink: string, ground: string, w: number, h: number) => (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  ctx.scale(s / (w * 100), s / (h * 100));
  const letters = [...text], upright = h > w, size = upright ? Math.min(w * 78, h * 92 / letters.length) : Math.min(h * 76, w * 92 / letters.length);
  ctx.fillStyle = ink; ctx.font = `900 ${size}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  letters.forEach((letter, i) => { const along = (i + 0.5) / letters.length; ctx.fillText(letter, upright ? w * 50 : w * 100 * along, upright ? h * 100 * along : h * 52); });
};


function coin(b: Build, r: number, x: number, y: number, z: number, lit: number) {
  b.tube(GOLD, r, 0.5, x, y, z, { turn: [90, 0, 0], sides: 32, glow: lit * 0.5, rough: 0.35 });
  b.ring(shade(GOLD, 0.8), r * 0.92, 0.3, x, y, z + 0.28);
  b.pane(shade(GLASS, 0.5), r * 0.62, r * 0.62, x, y, z + 0.3);
}


function tower(b: Build, x: number, z: number, lit: number) {
  const dark = shade(GLASS, 0.7), frame = shade(GLASS, 0.55), mall = '#D9D2C2';
  b.box(mall, 34, 5, 20, x, 0, z + 2); b.box(shade(mall, 0.9), 35, 0.6, 21, x, 5, z + 2);
  for (let i = 0; i < 7; i++) b.pane(lit ? GOLD : '#7FB3B5', 3.2, 3, x - 13.5 + i * 4.5, 2.4, z + 12.02, { glow: lit * 0.6 });
  b.box(dark, 18, 7, 13, x, 5.6, z);
  b.tube(GLASS, 5.6 * R2, 16, x, 12.6, z, { ...SQUARE, top: 0.8, rough: 0.35 });
  for (let k = 1; k < 5; k++) b.box(frame, 15.4 - k * 0.55, 0.22, 0.2, x, 12.6 + k * 3.2, z + 5.55 - k * 0.27);
  coin(b, 1.7, x, 21, z + 4.75, lit);
  for (let tier = 0; tier < 8; tier++) {
    const y = 28.6 + tier * 5.5;
    b.tube(GLASS, 4.3 * R2, 5.2, x, y, z, { ...SQUARE, top: 1.2, rough: 0.35 }); b.tube(frame, 5.3 * R2, 0.32, x, y + 5.2, z, SQUARE);
    for (let k = 1; k < 4; k++) b.box(frame, 8.6 + k * 0.42, 0.14, 0.12, x, y + k * 1.3, z + 4.3 + k * 0.21);
    for (const side of [-1, 1]) { b.ball(GOLD, 0.45, 0.6, 0.3, x + side * 4.6, y + 0.9, z + 4.4, { glow: lit * 0.6, rough: 0.4 }); b.box(frame, 0.22, 5.2, 0.22, x + side * 2.2, y, z + 4.6 + 0.4, { turn: [-5, 0, 0] }); }
    b.disc(GOLD, 0.7, x, y + 1.3, z + 4.52, { glow: lit * 0.6 });
    if (lit) b.pane(tier % 2 ? '#9EE7FF' : GOLD, 7.4, 0.35, x, y + 3.6, z + 4.95, { glow: lit });
  }
  b.tube(GLASS, 3.4 * R2, 4, x, 72.6, z, { ...SQUARE, top: 0.8 }); b.tube(dark, 2 * R2, 3.4, x, 76.6, z, { ...SQUARE, top: 0.7 });
  b.tube(frame, 2.4 * R2, 0.4, x, 76.4, z, SQUARE);
  b.tube(STEEL, 0.55, 13, x, 80, z, { top: 0.2, sides: 8 }); for (let k = 0; k < 3; k++) b.tube(STEEL, 0.75 - k * 0.12, 0.3, x, 82 + k * 3, z, { sides: 8 });
  b.ball(RED, 0.5, 0.5, 0.5, x, 93.2, z, { glow: 3 });
}


function swallow(b: Build, w: number, d: number, x: number, y: number, z: number, lit: number) {
  const tile = '#B5462E', ridge = '#E9C46A', green = '#3E8E6B';
  b.taper(shade(tile, 0.85), w + 3, 0.6, d + 3, x, y, z, 0.96, 0.9);
  b.taper(tile, w + 1.6, 3.2, d + 1.6, x, y + 0.6, z, 0.86, 0.16);
  b.box(ridge, w * 0.8, 0.7, 0.8, x, y + 3.8, z);
  for (const side of [-1, 1]) {
    b.box(ridge, 2.4, 0.6, 0.7, x + side * (w * 0.4 + 0.9), y + 4.1, z, { turn: [0, 0, side * 22] });
    b.box(ridge, 1.8, 0.5, 0.6, x + side * (w * 0.4 + 2.5), y + 4.9, z, { turn: [0, 0, side * 48] });
    b.ball(green, 1.1, 0.5, 0.4, x + side * w * 0.22, y + 4.75, z, { turn: [0, 0, side * -10] });
  }
  b.ball(GOLD, 0.6, 0.6, 0.6, x, y + 5.1, z, { glow: lit * 0.8, rough: 0.3 });
}


function temple(b: Build, x: number, z: number, lit: number) {
  const red = '#B8322A', column = '#D2463A', stone = '#CFC6B4', foot = 14, lantern = '#FF5A3C';
  b.dome(HILL, 30, foot + 2, 22, x, 0, z - 6, { rough: 1 }); b.dome(shade(HILL, 0.9), 12, 10, 10, x - 20, 0, z + 4, { rough: 1 });
  b.box(stone, 30, 1.2, 16, x, foot, z);
  for (let i = 0; i < 6; i++) b.box(shade(stone, 0.94 - i * 0.02), 8, 1, 2.2, x, foot - 1 - i, z + 9 + i * 1.6);
  b.box(red, 22, 7, 10, x, foot + 1.2, z);
  for (let i = 0; i <= 8; i++) b.tube(column, 0.4, 7, x - 10.6 + i * 2.65, foot + 1.2, z + 5.6, { sides: 10 });
  for (const dx of [-5, 0, 5]) { b.pane('#5A1E18', 3, 4.6, x + dx, foot + 3.6, z + 5.06); b.pane(GOLD, 3.2, 0.3, x + dx, foot + 6.1, z + 5.07, { glow: lit * 0.4 }); }
  for (let i = 0; i < 7; i++) b.ball(lantern, 0.55, 0.7, 0.55, x - 9 + i * 3, foot + 7.4, z + 6.3, { glow: 0.4 + lit });
  b.tube('#6B5A3A', 1.4, 1.2, x, foot + 1.2, z + 11, { sides: 8, top: 0.8 }); b.tube('#6B5A3A', 1.1, 1.8, x, foot + 2.4, z + 11, { sides: 8, top: 1.2 });
  swallow(b, 24, 12, x, foot + 8.2, z, lit);
  b.box(red, 13, 3.4, 6.4, x, foot + 13.6, z);
  for (let i = 0; i <= 4; i++) b.tube(column, 0.32, 3.4, x - 6 + i * 3, foot + 13.6, z + 3.4, { sides: 10 });
  b.sign('temple:name', plaque('龍山寺', GOLD, '#1E3A6E', 5, 1.6), 5, 1.6, x, foot + 15.3, z + 3.25, { glow: lit * 0.5, sharp: true });
  swallow(b, 14, 7, x, foot + 17, z, lit);
}





function eaves(b: Build, color: string, w: number, d: number, h: number, x: number, y: number, z: number, ridge: number) {
  b.taper(shade(color, 0.86), w + 5, 0.9, d + 4, x, y, z, 0.9, 0.82);
  b.taper(color, w + 0.6, h, d + 0.4, x, y + 0.9, z, ridge / (w + 0.6), 0.06);
  for (const side of [-1, 1]) b.box(shade(color, 0.86), 3.4, 0.7, 0.9, x + side * (w / 2 + 2.6), y + 0.75, z + d / 2 + 1.6, { turn: [0, 0, side * 24] });
}


function hotel(b: Build, x: number, z: number, lit: number) {
  const red = '#C02A22', column = '#E8503C', roof = '#F2B632', top = 12, w = 30, floors = 7, h = floors * 2;
  b.dome(HILL, 26, top + 1.5, 20, x, 0, z - 4, { rough: 1 }); b.dome(shade(HILL, 0.9), 11, 9, 10, x - 15, 0, z + 5, { rough: 1 }); b.dome(shade(HILL, 0.94), 10, 8, 10, x + 16, 0, z + 4, { rough: 1 });
  b.box(WHITE, w + 4, 1.2, 13, x, top, z);
  b.box(red, w, h, 10, x, top + 1.2, z);
  for (let i = 0; i <= 16; i++) b.box(column, 0.7, h, 0.6, x - w / 2 + 0.35 + i * (w - 0.7) / 16, top + 1.2, z + 5.1);
  for (let floor = 0; floor < floors; floor++) {
    const y = top + 1.2 + floor * 2;
    b.box(WHITE, w + 0.4, 0.34, 10.9, x, y, z);
    if (lit) b.pane(GOLD, w - 1.4, 0.7, x, y + 1.2, z + 5.02, { glow: lit });
  }
  const eave = top + 1.2 + h;
  eaves(b, roof, w, 10, 2.6, x, eave, z, w * 0.74);
  b.box(red, w * 0.62, 2.6, 6.4, x, eave + 3.2, z); for (let i = 0; i <= 8; i++) b.box(column, 0.6, 2.6, 0.5, x - w * 0.3 + i * w * 0.075, eave + 3.2, z + 3.3);
  eaves(b, roof, w * 0.64, 6.6, 3.6, x, eave + 5.8, z, w * 0.4);
  b.box(shade(roof, 0.78), w * 0.42, 0.6, 0.7, x, eave + 10.1, z); for (const side of [-1, 1]) b.box(shade(roof, 0.78), 1.6, 0.6, 0.7, x + side * w * 0.22, eave + 10.5, z, { turn: [0, 0, side * 32] });
}


function hall(b: Build, x: number, z: number, lit: number) {
  const eight = { sides: 8, turn: [0, 22.5, 0], rough: 0.5 } as const, stone = shade(WHITE, 0.95), foot = 7.8, h = 14, eave = foot + h;
  [[36, 0], [31, 2.6], [26, 5.2]].forEach(([w, y]) => b.box(stone, w, 2.6, 24, x, y, z));
  b.taper(WHITE, 22, h, 20, x, foot, z, 0.93, 0.93);
  for (const side of [-1, 1]) b.box(stone, 1.3, h, 0.7, x + side * 9.6, foot, z + 9.7, { turn: [0, 0, side * 3] });
  b.pane(BLUE, 5.8, 8, x, foot + 4.6, z + 10.06, { glow: lit * 0.4 }); b.disc(BLUE, 2.9, x, foot + 8.6, z + 10.06, { glow: lit * 0.4 });
  b.box(shade(WHITE, 0.82), 20.6, 0.9, 18.8, x, eave - 0.9, z);
  b.tube(shade(BLUE, 0.86), 15.6, 0.9, x, eave, z, { ...eight, top: 0.9 }); b.tube(BLUE, 14, 2.4, x, eave + 0.9, z, { ...eight, top: 0.76 });
  b.tube(WHITE, 10.2, 2, x, eave + 3.3, z, eight);
  b.tube(shade(BLUE, 0.86), 13.8, 0.9, x, eave + 5.3, z, { ...eight, top: 0.88 }); b.tube(BLUE, 12.1, 4.2, x, eave + 6.2, z, { ...eight, top: 0.5 }); b.tube(BLUE, 6.05, 4.8, x, eave + 10.4, z, { ...eight, top: 0.12 });
  b.tube(GOLD, 0.5, 1.4, x, eave + 15.2, z, { sides: 8, glow: lit * 0.6 }); b.ball(GOLD, 1, 1.3, 1, x, eave + 17.2, z, { glow: lit, rough: 0.3 });
}


function wheel(b: Build, x: number, z: number, lit: number) {
  const r = 13, roof = 17, hub = roof + r + 0.6, at = z + 1, colors = [RED, GOLD, PINK, '#6BD8FF', '#6BD49A', CREAM], wall = '#EFE4D4', glass = '#6FB3C4';
  b.box(wall, 28, roof, 13, x + 2, 0, z); b.box(shade(wall, 0.9), 29, 0.8, 13.6, x + 2, roof, z);
  b.box(shade(wall, 0.86), 8, roof + 3, 13.4, x - 12, 0, z);
  for (let i = 0; i < 5; i++) b.pane(glass, 3.2, 9, x - 4.4 + i * 4.2, 9.6, z + 6.52, { glow: lit * 0.5 });
  b.pane(PINK, 20.4, 1.5, x + 4, 15.4, z + 6.53, { glow: 0.3 + lit });
  b.tube(INK, 3.3, 0.3, x - 12, 15.4, z + 6.75, { turn: [90, 0, 0], sides: 48 }); b.sign('badge:mall', mark('badge', INK, plaque('咖啡', CREAM, INK, 6, 6), 0), 6, 6, x - 12, 15.4, z + 6.95, { glow: lit * 0.5, sharp: true, round: true });
  for (const side of [-1, 1]) for (const dz of [-1.6, 1.6]) b.box(WHITE, 0.7, 14.6, 0.7, x + side * 4, roof, at + dz, { turn: [0, 0, side * 16] });
  const rim = (radius: number, thick: number, color: string, glow: number) => {
    const parts = 40, length = 2 * Math.PI * radius / parts * 1.04;
    for (let i = 0; i < parts; i++) { const a = i / parts * Math.PI * 2; b.box(color, length, thick, thick, x + Math.cos(a) * radius, hub + Math.sin(a) * radius - thick / 2, at, { turn: [0, 0, i * 360 / parts + 90], glow }); }
  };
  rim(r, 0.6, lit ? PINK : WHITE, lit); rim(r - 1.7, 0.36, lit ? '#6BD8FF' : WHITE, lit);
  for (let i = 0; i < 9; i++) b.box(lit ? CREAM : STEEL, r * 2, 0.2, 0.2, x, hub - 0.1, at, { turn: [0, 0, i * 20], glow: lit * 0.4 });
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; b.ball(colors[i % colors.length], 1, 0.9, 0.8, x + Math.cos(a) * (r + 0.2), hub + Math.sin(a) * (r + 0.2) - 1.1, at + 0.3, { glow: lit * 0.5 }); }
  b.ball(WHITE, 1.5, 1.5, 0.9, x, hub, at + 0.3); b.ball(RED, 0.7, 0.7, 0.5, x, hub, at + 1, { glow: lit });
}


export const taipei: Skyline = {
  sights: [
    { reach: 17, build: (b, x, z, lit) => tower(b, x, z - 8, lit) },
    { reach: 18, build: (b, x, z, lit) => hall(b, x, z + 4, lit) },
    { reach: 30, build: temple },
    { reach: 26, build: hotel },
    { reach: 16, build: wheel },
  ],
  behind: (b, length, train, lit) => viaduct(b, length, train, lit),
};


function viaduct(b: Build, length: number, train: boolean, lit: number) {
  b.box(CONCRETE, length, 1, 3.2, length / 2, 8.4, -19); b.box(shade(CONCRETE, 0.9), length, 0.7, 0.2, length / 2, 9.4, -17.5);
  for (const x of [length * 0.25, length * 0.75]) { b.box(shade(CONCRETE, 0.92), 1.8, 8.4, 1.8, x, 0, -19); b.box(CONCRETE, 3.4, 0.8, 3, x, 7.6, -19); }
  b.dome(shade(HILL, 0.95), 26, 15, 12, length / 2, 0, -128, { rough: 1 });
  if (!train) return;
  for (const x of [length * 0.27, length * 0.77]) {
    b.box('#F2F2F2', length * 0.46, 2.5, 2.5, x, 9.5, -19); b.box('#2E6FD8', length * 0.46, 0.4, 0.04, x, 9.9, -17.73);
    for (let i = 0; i < 4; i++) b.pane(lit ? GOLD : '#3D4A66', 1.1, 0.9, x - length * 0.17 + i * length * 0.115, 11.1, -17.73, lit ? { glow: lit } : {});
  }
}


export function scooter(b: Build, x: number, z: number, color: string) {
  for (const dx of [-0.8, 0.8]) { b.pipe(INK, 0.4, 0.2, x + dx, 0.4, z, 'z'); b.pipe(STEEL, 0.16, 0.22, x + dx, 0.4, z, 'z'); }
  b.box(color, 1.4, 0.4, 0.5, x - 0.1, 0.45, z); b.box(INK, 0.95, 0.16, 0.46, x - 0.3, 1.02, z); b.box(color, 0.8, 0.22, 0.5, x - 0.4, 0.82, z);
  b.box(color, 0.18, 1.1, 0.56, x + 0.72, 0.5, z, { turn: [0, 0, -14] }); b.box(INK, 0.08, 0.08, 0.9, x + 0.86, 1.62, z); b.ball(CREAM, 0.14, 0.14, 0.1, x + 0.98, 1.3, z, { glow: 0.3 });
  b.box(INK, 0.5, 0.4, 0.46, x - 0.95, 1.1, z);
}


export function bicycle(b: Build, x: number, z: number) {
  for (const dx of [-0.75, 0.75]) b.ring(INK, 0.5, 0.1, x + dx, 0.55, z);
  b.box(GOLD, 1.3, 0.1, 0.1, x - 0.05, 0.9, z, { turn: [0, 0, 12] }); b.box(GOLD, 1, 0.1, 0.1, x - 0.3, 0.6, z, { turn: [0, 0, -40] }); b.box(WHITE, 0.9, 0.1, 0.1, x + 0.3, 0.75, z, { turn: [0, 0, 55] });
  b.box(INK, 0.5, 0.12, 0.26, x - 0.55, 1.28, z); b.box(INK, 0.08, 0.08, 0.7, x + 0.6, 1.5, z); b.box(STEEL, 0.5, 0.36, 0.4, x + 0.95, 1, z);
  b.box(STEEL, 0.2, 1.1, 0.2, x + 1.35, 0, z);
}


export function crossing(b: Build, x: number, z: number, lit: number) {
  b.tube(INK, 0.08, 4.2, x, 0, z); b.box(INK, 0.6, 1.3, 0.4, x, 3.2, z);
  b.pane('#5A2A2A', 0.4, 0.4, x, 4.15, z + 0.21); b.pane('#6BD49A', 0.4, 0.4, x, 3.55, z + 0.21, { glow: 1 + lit });
}
