import { canvas, CREAM, hash, INK, MINT, paintIt, PINK, RED, round, stamp, type Stamp } from './art';

type Ctx = CanvasRenderingContext2D;
type FarShape = 'roofs' | 'stacks' | 'towers' | 'foam' | 'none';
type Piece = { width: number; height: number; paint(ctx: Ctx, scene: Scene): void };
export type Scene = {
  /** Tokens burned when the run enters it. */
  from: number;
  sky: readonly string[]; glow: string; body: 'sun' | 'moon' | 'bean' | 'none'; bodyAt: number; stars: number; cloud: string;
  /** Colours of the plain shapes that float in the sky instead of clouds: the void has no weather. */
  floaters?: readonly string[];
  far: { color: string; alpha: number; shape: FarShape; lights?: readonly string[] };
  walls: readonly string[]; trim: string; window: string; accents: readonly string[]; row: readonly Piece[];
  walk: string; walkEdge: string; road: string; lane: string; laneShape: 'dash' | 'bean';
};

const COPPER = '#C9794B', STEEL = '#C9D3D8', BURLAP = '#D9B98A', LEAF = '#8FCB9B', ROAST = '#4A2C1C', GOLD = '#FFD86B';


const box = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, edge: string, line = 3) => { round(ctx, x, y, w, h, r); paintIt(ctx, fill, edge, line); };
const disc = (ctx: Ctx, x: number, y: number, r: number, fill: string, edge: string, line = 3) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); paintIt(ctx, fill, edge, line); };
const trace = (ctx: Ctx, points: readonly number[]) => {
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
};
const shape = (ctx: Ctx, points: readonly number[], fill: string, edge: string, line = 3) => { trace(ctx, points); ctx.closePath(); paintIt(ctx, fill, edge, line); };
const line = (ctx: Ctx, points: readonly number[], color: string, width: number) => { trace(ctx, points); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
function cup(ctx: Ctx, x: number, y: number, size: number, fill: string, edge: string, width = 3) {
  ctx.beginPath(); ctx.arc(x + size * 0.52, y - size * 0.45, size * 0.2, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = edge; ctx.lineWidth = width + size * 0.06; ctx.stroke();
  shape(ctx, [x - size / 2, y - size * 0.8, x + size / 2, y - size * 0.8, x + size * 0.36, y, x - size * 0.36, y], fill, edge, width);
}
function bean(ctx: Ctx, x: number, y: number, size: number, angle: number, fill: string, edge: string, width = 3) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.ellipse(0, 0, size / 2, size * 0.36, 0, 0, Math.PI * 2); paintIt(ctx, fill, edge, width);
  ctx.beginPath(); ctx.moveTo(-size * 0.36, 0); ctx.bezierCurveTo(-size * 0.1, -size * 0.2, size * 0.1, size * 0.2, size * 0.36, 0); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.5, width * 0.8); ctx.stroke();
  ctx.restore();
}
function steam(ctx: Ctx, x: number, y: number, height: number, color: string, width = 5) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha *= 0.85;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + side * height * 0.16, y);
    ctx.bezierCurveTo(x + side * height * 0.5, y - height * 0.3, x - side * height * 0.2, y - height * 0.6, x + side * height * 0.22, y - height);
    ctx.stroke();
  }
  ctx.restore();
}
function awning(ctx: Ctx, x: number, y: number, width: number, colors: readonly [string, string], edge: string) {
  const n = Math.max(4, Math.round(width / 22)), w = width / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * w, y); ctx.lineTo(x + (i + 1) * w, y); ctx.lineTo(x + (i + 1) * w, y + 22); ctx.arc(x + i * w + w / 2, y + 22, w / 2, 0, Math.PI); ctx.closePath();
    paintIt(ctx, colors[i % 2], edge, 2);
  }
}
function panes(ctx: Ctx, scene: Scene, x: number, y: number, columns: number, rows: number, w: number, h: number, gap: number, seed: number, dark = 0.25) {
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    box(ctx, x + i * (w + gap), y + j * (h + gap), w, h, 4, hash(seed * 31 + i * 7 + j, 14) > dark ? scene.window : 'rgba(0,0,0,.25)', scene.trim, 2.5);
  }
}
const bricks = (ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) => {
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  for (let i = 0; i < w * h / 900; i++) ctx.fillRect(x + 6 + hash(i, seed) * (w - 30), y + 8 + Math.floor(hash(i, seed + 1) * (h - 16) / 12) * 12, 18, 5);
};
const neon = (ctx: Ctx, color: string, draw: () => void) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); draw(); ctx.stroke(); ctx.stroke(); ctx.restore(); };
const wall = (ctx: Ctx, scene: Scene, color: string, width: number, height: number) => {
  box(ctx, 0, -height, width, height, 6, color, scene.trim);
  box(ctx, -5, -height - 9, width + 10, 14, 5, scene.trim, scene.trim, 0);
};
const door = (ctx: Ctx, scene: Scene, x: number, w: number, h: number) => { box(ctx, x, -h, w, h, 5, scene.trim, scene.trim, 0); box(ctx, x + 8, -h + 10, w - 16, h * 0.36, 3, scene.window, scene.trim, 0); };


const street: readonly Piece[] = [
  { width: 220, height: 245, paint(ctx, s) {
    wall(ctx, s, s.walls[0], 220, 230);
    panes(ctx, s, 18, -212, 3, 1, 52, 44, 14, 1, 0);
    for (let i = 0; i < 3; i++) { box(ctx, 14 + i * 66, -166, 60, 9, 3, s.accents[0], s.trim, 2); for (let j = 0; j < 3; j++) disc(ctx, 26 + i * 66 + j * 18, -170, 6, j % 2 ? PINK : LEAF, s.trim, 1.5); }
    disc(ctx, 110, -130, 20, CREAM, s.trim); cup(ctx, 107, -120, 20, s.accents[0], s.trim, 2);
    awning(ctx, 0, -104, 220, [s.accents[0], CREAM], s.trim);
    box(ctx, 16, -72, 118, 58, 5, s.window, s.trim, 2.5); cup(ctx, 70, -22, 30, 'rgba(122,75,58,.35)', 'rgba(122,75,58,.5)', 2);
    door(ctx, s, 150, 52, 78);
  } },
  { width: 170, height: 285, paint(ctx, s) {
    wall(ctx, s, s.walls[1], 170, 130);
    awning(ctx, 0, -92, 170, [s.accents[1], CREAM], s.trim);
    box(ctx, 14, -62, 84, 48, 5, s.window, s.trim, 2.5); door(ctx, s, 112, 42, 68);
    cup(ctx, 82, -139, 88, CREAM, s.trim); box(ctx, 48, -186, 68, 14, 3, s.accents[0], s.trim, 2);
    steam(ctx, 82, -218, 56, '#fff', 6);
  } },
  { width: 150, height: 160, paint(ctx, s) {
    line(ctx, [75, -150, 75, -60], s.trim, 5);
    ctx.beginPath(); ctx.ellipse(75, -112, 72, 40, 0, Math.PI, 0); ctx.closePath(); paintIt(ctx, s.accents[2], s.trim, 3);
    for (const x of [39, 75, 111]) { ctx.beginPath(); ctx.ellipse(x, -112, 18, 8, 0, 0, Math.PI); paintIt(ctx, CREAM, s.trim, 2); }
    disc(ctx, 48, -13, 12, s.walls[4], s.trim); disc(ctx, 104, -13, 12, s.walls[4], s.trim);
    box(ctx, 30, -62, 92, 44, 6, s.accents[1], s.trim); bean(ctx, 76, -40, 26, -0.4, CREAM, s.trim, 2);
    box(ctx, 24, -70, 104, 10, 4, s.trim, s.trim, 0); cup(ctx, 50, -70, 16, CREAM, s.trim, 2); cup(ctx, 104, -70, 16, CREAM, s.trim, 2);
  } },
  { width: 150, height: 350, paint(ctx, s) {
    for (const x of [92, 126]) line(ctx, [x, -305, x, -322], s.trim, 4);
    box(ctx, 84, -352, 50, 34, 6, s.walls[4], s.trim);
    wall(ctx, s, s.walls[3], 150, 300);
    panes(ctx, s, 18, -280, 2, 3, 50, 44, 14, 4);
    awning(ctx, 0, -98, 150, [s.accents[3], CREAM], s.trim);
    box(ctx, 14, -66, 62, 50, 5, s.window, s.trim, 2.5); door(ctx, s, 92, 44, 72);
  } },
  { width: 140, height: 215, paint(ctx, s) {
    box(ctx, 62, -96, 14, 96, 3, s.trim, s.trim, 0);
    for (const [x, y, r] of [[40, -128, 34], [98, -124, 34], [69, -160, 46]]) disc(ctx, x, y, r, LEAF, s.trim);
    for (const [x, y] of [[52, -150], [88, -172], [96, -132]]) disc(ctx, x, y, 5, '#C7E8C4', s.trim, 0);
    shape(ctx, [6, 0, 18, -58, 46, -58, 54, 0], ROAST, s.trim); cup(ctx, 30, -18, 18, CREAM, CREAM, 0); steam(ctx, 30, -36, 14, CREAM, 2);
  } },
  { width: 200, height: 215, paint(ctx, s) {
    wall(ctx, s, s.walls[2], 200, 200);
    ctx.beginPath(); ctx.moveTo(20, -16); ctx.lineTo(20, -76); ctx.arc(70, -76, 50, Math.PI, 0); ctx.lineTo(120, -16); ctx.closePath(); paintIt(ctx, s.window, s.trim, 2.5);
    line(ctx, [70, -126, 70, -16], s.trim, 2.5); line(ctx, [20, -76, 120, -76], s.trim, 2.5);
    door(ctx, s, 138, 46, 76);
    disc(ctx, 160, -128, 22, CREAM, s.trim); bean(ctx, 160, -128, 26, -0.5, s.walls[4], s.trim, 2);
    panes(ctx, s, 22, -184, 2, 1, 46, 34, 12, 6, 0);
  } },
];


const roastery: readonly Piece[] = [
  { width: 240, height: 370, paint(ctx, s) {
    box(ctx, 194, -296, 28, 130, 3, s.walls[1], s.trim); box(ctx, 190, -304, 36, 12, 3, s.trim, s.trim, 0);
    ctx.save(); ctx.globalAlpha = 0.8; for (const [x, y, r] of [[212, -318, 12], [224, -338, 16], [206, -352, 11]]) disc(ctx, x, y, r, CREAM, s.trim, 0); ctx.restore();
    shape(ctx, [0, 0, 0, -170, 60, -214, 60, -170, 120, -214, 120, -170, 180, -214, 180, -170, 240, -170, 240, 0], s.walls[0], s.trim);
    bricks(ctx, 0, -168, 240, 168, 71);
    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(24, -70); ctx.arc(72, -70, 48, Math.PI, 0); ctx.lineTo(120, 0); ctx.closePath(); paintIt(ctx, ROAST, s.trim);
    box(ctx, 40, -34, 44, 34, 9, BURLAP, s.trim, 2.5); box(ctx, 70, -30, 40, 30, 9, BURLAP, s.trim, 2.5); bean(ctx, 62, -17, 16, -0.4, ROAST, ROAST, 0);
    panes(ctx, s, 140, -140, 2, 2, 36, 34, 10, 7);
  } },
  { width: 200, height: 250, paint(ctx, s) {
    line(ctx, [150, -150, 178, -150, 178, -240], s.trim, 16); line(ctx, [150, -150, 178, -150, 178, -240], STEEL, 10);
    shape(ctx, [44, -214, 136, -214, 112, -166, 68, -166], COPPER, s.trim);
    for (let i = 0; i < 5; i++) bean(ctx, 60 + i * 15, -220 - (i % 2) * 6, 14, i, ROAST, s.trim, 1.5);
    box(ctx, 26, -40, 16, 40, 3, s.trim, s.trim, 0); box(ctx, 138, -40, 16, 40, 3, s.trim, s.trim, 0);
    disc(ctx, 90, -104, 66, COPPER, s.trim); disc(ctx, 90, -104, 40, ROAST, s.trim);
    for (let i = 0; i < 6; i++) bean(ctx, 90 + Math.cos(i * 1.05) * 22, -104 + Math.sin(i * 1.05) * 22, 14, i * 0.8, '#8A5A3C', ROAST, 1.5);
    for (let i = 0; i < 8; i++) disc(ctx, 90 + Math.cos(i * Math.PI / 4) * 54, -104 + Math.sin(i * Math.PI / 4) * 54, 3.5, GOLD, s.trim, 1);
    ctx.beginPath(); ctx.ellipse(104, -22, 82, 16, 0, 0, Math.PI * 2); paintIt(ctx, STEEL, s.trim);
    ctx.beginPath(); ctx.ellipse(104, -25, 68, 10, 0, 0, Math.PI * 2); paintIt(ctx, '#8A5A3C', s.trim, 2);
  } },
  { width: 180, height: 120, paint(ctx, s) {
    for (const [x, y] of [[4, -40], [60, -40], [32, -78]]) { box(ctx, x, y, 58, 40, 13, BURLAP, s.trim); bean(ctx, x + 29, y + 20, 20, -0.4, ROAST, ROAST, 0); line(ctx, [x + 8, y + 6, x + 50, y + 6], 'rgba(0,0,0,.18)', 2); }
    box(ctx, 126, -74, 48, 74, 12, COPPER, s.trim); for (const y of [-58, -20]) line(ctx, [126, y, 174, y], s.trim, 4);
  } },
  { width: 150, height: 335, paint(ctx, s) {
    for (const x of [34, 106]) line(ctx, [x, 0, 70 + (x - 70) * 0.6, -150], s.trim, 6);
    line(ctx, [38, -40, 102, -110], s.trim, 3); line(ctx, [102, -40, 38, -110], s.trim, 3);
    ctx.beginPath(); ctx.arc(118, -230, 24, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = s.trim; ctx.lineWidth = 9; ctx.stroke();
    shape(ctx, [28, -150, 112, -150, 96, -222, 44, -222], STEEL, s.trim);
    box(ctx, 40, -234, 60, 14, 4, RED, s.trim);
    shape(ctx, [44, -234, 96, -234, 108, -300, 20, -300, 32, -280], '#E4EBEE', s.trim);
    shape(ctx, [24, -300, 104, -300, 64, -318], STEEL, s.trim); disc(ctx, 64, -322, 7, RED, s.trim, 2.5);
  } },
  { width: 200, height: 235, paint(ctx, s) {
    wall(ctx, s, s.walls[2], 200, 220); bricks(ctx, 0, -218, 200, 110, 73);
    disc(ctx, 60, -160, 34, s.window, s.trim); line(ctx, [26, -160, 94, -160], s.trim, 2.5); line(ctx, [60, -194, 60, -126], s.trim, 2.5);
    disc(ctx, 150, -160, 24, CREAM, s.trim); bean(ctx, 150, -160, 30, -0.5, ROAST, s.trim, 2);
    awning(ctx, 0, -100, 200, [ROAST, CREAM], s.trim);
    box(ctx, 14, -68, 100, 54, 5, s.window, s.trim, 2.5); door(ctx, s, 132, 50, 76);
    box(ctx, 20, -22, 34, 22, 3, BURLAP, s.trim, 2.5); box(ctx, 58, -26, 30, 26, 3, COPPER, s.trim, 2.5);
  } },
  { width: 170, height: 290, paint(ctx, s) {
    line(ctx, [50, -250, 50, -274, 120, -274, 120, -200], s.trim, 14); line(ctx, [50, -250, 50, -274, 120, -274, 120, -200], COPPER, 8);
    box(ctx, 10, -250, 76, 250, 24, STEEL, s.trim); box(ctx, 92, -200, 66, 200, 22, '#E4EBEE', s.trim);
    for (const y of [-190, -120, -50]) { line(ctx, [10, y, 86, y], s.trim, 3); line(ctx, [92, y + 20, 158, y + 20], s.trim, 3); }
    bean(ctx, 48, -86, 34, -0.5, ROAST, s.trim, 2.5);
    for (let y = -16; y > -150; y -= 16) line(ctx, [134, y, 150, y], s.trim, 2.5);
  } },
];


const night: readonly Piece[] = [
  { width: 170, height: 350, paint(ctx, s) {
    wall(ctx, s, s.walls[0], 170, 340);
    panes(ctx, s, 16, -238, 4, 4, 26, 30, 10, 11, 0.45);
    neon(ctx, PINK, () => { ctx.moveTo(52, -312); ctx.lineTo(108, -312); ctx.lineTo(100, -264); ctx.lineTo(60, -264); ctx.closePath(); ctx.moveTo(108, -302); ctx.arc(108, -290, 12, -Math.PI / 2, Math.PI / 2); });
    neon(ctx, MINT, () => { ctx.moveTo(70, -318); ctx.quadraticCurveTo(62, -326, 72, -334); ctx.moveTo(90, -318); ctx.quadraticCurveTo(82, -326, 92, -334); });
    box(ctx, 16, -64, 90, 48, 5, s.window, s.trim, 2.5); door(ctx, s, 118, 40, 70);
  } },
  { width: 240, height: 205, paint(ctx, s) {
    wall(ctx, s, s.walls[1], 240, 160);
    const glass = ctx.createLinearGradient(0, -130, 0, -14); glass.addColorStop(0, '#FFE9A8'); glass.addColorStop(1, '#FFB35C');
    ctx.save(); ctx.shadowColor = '#FFC86B'; ctx.shadowBlur = 22; box(ctx, 14, -130, 164, 116, 6, glass, s.trim, 2.5); ctx.restore();
    for (const x of [40, 84, 128]) { line(ctx, [x, -14, x, -44], s.trim, 4); box(ctx, x - 12, -50, 24, 7, 3, s.trim, s.trim, 0); }
    box(ctx, 22, -74, 148, 7, 3, s.trim, s.trim, 0); cup(ctx, 62, -74, 16, s.trim, s.trim, 0); cup(ctx, 118, -74, 16, s.trim, s.trim, 0);
    door(ctx, s, 190, 38, 78);
    neon(ctx, MINT, () => ctx.roundRect(40, -196, 160, 28, 10));
    neon(ctx, GOLD, () => { for (let i = 0; i < 5; i++) { ctx.moveTo(66 + i * 27, -182); ctx.arc(60 + i * 27, -182, 6, 0, Math.PI * 2); } });
  } },
  { width: 200, height: 285, paint(ctx, s) {
    for (const x of [34, 100, 166]) { disc(ctx, x, -266, 15, s.walls[4], s.trim); line(ctx, [x - 10, -266, x + 10, -266], s.trim, 2.5); line(ctx, [x, -276, x, -256], s.trim, 2.5); }
    wall(ctx, s, s.walls[2], 200, 250);
    for (let i = 0; i < 3; i++) {
      box(ctx, 14 + i * 60, -234, 52, 190, 5, '#141033', s.trim, 2.5);
      for (let j = 0; j < 11; j++) {
        line(ctx, [20 + i * 60, -222 + j * 16, 60 + i * 60, -222 + j * 16], 'rgba(255,255,255,.14)', 5);
        for (let k = 0; k < 3; k++) { const pick = hash(i * 40 + j * 3 + k, 81); if (pick > 0.3) { ctx.fillStyle = pick > 0.75 ? PINK : pick > 0.5 ? GOLD : MINT; ctx.fillRect(22 + i * 60 + k * 9, -224 + j * 16, 5, 4); } }
      }
    }
    line(ctx, [14, -30, 186, -30], MINT, 3);
  } },
  { width: 150, height: 240, paint(ctx, s) {
    line(ctx, [128, 0, 128, -214, 96, -226], s.trim, 6); disc(ctx, 92, -226, 9, '#FFE9A8', s.trim, 2.5);
    ctx.save(); ctx.globalAlpha = 0.16; shape(ctx, [92, -220, 40, 0, 144, 0], '#FFE9A8', s.trim, 0); ctx.restore();
    for (const [x, color] of [[6, '#FF8FB8'], [62, '#6BD8FF']] as const) {
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 14; box(ctx, x, -124, 52, 124, 6, s.walls[3], s.trim); ctx.restore();
      box(ctx, x + 6, -116, 40, 62, 3, color, s.trim, 2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(ctx, x + 10 + i * 12, -110 + j * 28, 8, 20, 2, j ? ROAST : CREAM, s.trim, 1.5);
      box(ctx, x + 10, -34, 32, 14, 3, '#141033', s.trim, 2);
    }
  } },
  { width: 210, height: 300, paint(ctx, s) {
    for (const x of [50, 160]) line(ctx, [x, 0, x, -150], s.trim, 8);
    line(ctx, [50, -40, 160, -120], s.trim, 3); line(ctx, [160, -40, 50, -120], s.trim, 3);
    box(ctx, 6, -290, 198, 142, 8, '#141033', s.trim);
    neon(ctx, GOLD, () => ctx.ellipse(105, -219, 56, 38, -0.4, 0, Math.PI * 2));
    neon(ctx, PINK, () => { ctx.moveTo(66, -202); ctx.bezierCurveTo(92, -236, 116, -200, 146, -238); });
    for (let i = 0; i < 9; i++) disc(ctx, 20 + i * 21.5, -160, 3, i % 2 ? MINT : PINK, s.trim, 0);
  } },
  { width: 130, height: 405, paint(ctx, s) {
    line(ctx, [65, -330, 65, -392], s.trim, 4); ctx.save(); ctx.shadowColor = '#FF4D6D'; ctx.shadowBlur = 12; disc(ctx, 65, -394, 5, '#FF4D6D', s.trim, 0); ctx.restore();
    line(ctx, [46, -356, 84, -356], s.trim, 3); line(ctx, [52, -372, 78, -372], s.trim, 3);
    wall(ctx, s, s.walls[3], 130, 326);
    panes(ctx, s, 16, -306, 3, 6, 26, 28, 10, 13, 0.5);
    door(ctx, s, 46, 38, 56);
  } },
];


const foam: readonly Piece[] = [
  { width: 240, height: 250, paint(ctx, s) {
    ctx.beginPath(); ctx.ellipse(120, -10, 112, 14, 0, 0, Math.PI * 2); paintIt(ctx, '#fff', s.trim);
    ctx.beginPath(); ctx.arc(196, -92, 34, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = s.trim; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 13; ctx.stroke();
    shape(ctx, [34, -160, 206, -160, 176, -14, 64, -14], '#fff', s.trim);
    shape(ctx, [39, -134, 201, -134, 196, -110, 44, -110], s.accents[0], s.trim, 2.5);
    ctx.beginPath(); ctx.ellipse(120, -160, 86, 13, 0, 0, Math.PI * 2); paintIt(ctx, '#C89468', s.trim);
    line(ctx, [96, -162, 120, -154, 144, -162], CREAM, 4);
    steam(ctx, 120, -180, 60, '#fff', 7);
  } },
  { width: 180, height: 165, paint(ctx, s) {
    for (const [x, y, tilt] of [[8, -64, 0], [78, -66, 0.06], [44, -126, -0.1]]) {
      ctx.save(); ctx.translate(x + 32, y + 32); ctx.rotate(tilt);
      box(ctx, -32, -32, 64, 64, 8, '#fff', s.trim, 0); box(ctx, -32, 6, 64, 26, 8, '#DDE8F5', s.trim, 0);
      round(ctx, -32, -32, 64, 64, 8); ctx.strokeStyle = s.trim; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#C5D6EA'; for (let i = 0; i < 5; i++) ctx.fillRect(-22 + hash(i, x) * 44, -24 + hash(i, x + 1) * 26, 4, 4);
      ctx.restore();
    }
  } },
  { width: 120, height: 325, paint(ctx, s) {
    ctx.save(); ctx.translate(50, 0); ctx.rotate(0.14);
    line(ctx, [0, 0, 0, -220], s.trim, 18); line(ctx, [0, 0, 0, -220], STEEL, 12);
    ctx.beginPath(); ctx.ellipse(0, -262, 34, 48, 0, 0, Math.PI * 2); paintIt(ctx, STEEL, s.trim);
    ctx.beginPath(); ctx.ellipse(-6, -268, 18, 30, 0, 0, Math.PI * 2); paintIt(ctx, '#EEF4F6', s.trim, 0);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(50, -2, 40, 9, 0, 0, Math.PI * 2); paintIt(ctx, '#fff', s.trim, 2.5);
  } },
  { width: 190, height: 280, paint(ctx, s) {
    ctx.save(); ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.ellipse(95, -4, 60, 8, 0, 0, Math.PI * 2); paintIt(ctx, ROAST, ROAST, 0); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(95, -170, 88, 26, -0.3, 0, Math.PI * 2); ctx.strokeStyle = CREAM; ctx.lineWidth = 3; ctx.setLineDash([3, 9]); ctx.stroke(); ctx.restore();
    bean(ctx, 95, -170, 120, -0.5, '#8A5A3C', s.trim, 3.5);
    bean(ctx, 24, -140, 26, 0.6, '#A8724B', s.trim, 2); bean(ctx, 168, -206, 22, -1, '#A8724B', s.trim, 2); bean(ctx, 150, -108, 16, 0.2, '#A8724B', s.trim, 2);
  } },
  { width: 150, height: 310, paint(ctx, s) {
    shape(ctx, [28, -40, 6, 0, 40, -22], RED, s.trim); shape(ctx, [122, -40, 144, 0, 110, -22], RED, s.trim);
    shape(ctx, [56, -24, 94, -24, 75, 0], GOLD, s.trim, 2.5);
    shape(ctx, [34, -24, 116, -24, 104, -120, 46, -120], STEEL, s.trim);
    box(ctx, 42, -134, 66, 16, 4, RED, s.trim);
    ctx.beginPath(); ctx.arc(124, -196, 26, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = s.trim; ctx.lineWidth = 9; ctx.stroke();
    shape(ctx, [46, -134, 104, -134, 116, -232, 22, -232, 34, -210], '#E4EBEE', s.trim);
    shape(ctx, [26, -232, 112, -232, 69, -292], STEEL, s.trim); disc(ctx, 69, -296, 8, RED, s.trim, 2.5);
    disc(ctx, 75, -178, 20, s.window, s.trim); disc(ctx, 69, -184, 6, '#fff', s.trim, 0);
  } },
  { width: 250, height: 110, paint(ctx, s) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(30, -130, 220, -130, 250, 0); ctx.closePath(); paintIt(ctx, '#fff', s.trim);
    ctx.save(); ctx.translate(125, -50); ctx.fillStyle = '#C89468';
    ctx.beginPath(); ctx.moveTo(0, 26); ctx.bezierCurveTo(-52, -8, -28, -44, 0, -18); ctx.bezierCurveTo(28, -44, 52, -8, 0, 26); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-26, -6, -14, -24, 0, -8); ctx.bezierCurveTo(14, -24, 26, -6, 0, 12); ctx.fill();
    ctx.restore();
  } },
];

const heaven: readonly Piece[] = [
  { width: 220, height: 260, paint(ctx, s) {
    for (const x of [30, 150]) { box(ctx, x, -220, 40, 220, 6, '#FFFDF6', s.trim); box(ctx, x - 8, -232, 56, 16, 4, GOLD, s.trim); box(ctx, x - 8, -14, 56, 14, 4, GOLD, s.trim); }
    box(ctx, 14, -258, 192, 28, 6, '#FFFDF6', s.trim);
  } },
  { width: 240, height: 120, paint(ctx, s) { for (const [x, r] of [[50, 46], [110, 62], [180, 50]] as const) disc(ctx, x, -r * 0.6, r, '#FFFFFF', s.trim); } },
];
const nothing: readonly Piece[] = [{ width: 240, height: 1, paint() {} }];

export const scenes: readonly Scene[] = [
  {
    from: 0, sky: ['#6E93E6', '#C9A0DC', '#FFB999', '#FFE3A3'], glow: '#FFF2C2', body: 'sun', bodyAt: 0.62, stars: 0, cloud: '#FFF6E0',
    far: { color: '#B58FC4', alpha: 0.55, shape: 'roofs' },
    walls: ['#F7C7A3', '#B9DCCB', '#F8E6C8', '#DDB2CB', '#EAD7A8'], trim: '#7A4B3A', window: '#FFF0B0', accents: [RED, '#2F6B55', PINK, '#3D6BD0'], row: street,
    walk: '#EBCBA2', walkEdge: '#C99E74', road: '#5E5068', lane: '#FFE9B8', laneShape: 'dash',
  },
  {
    from: 1e6, sky: ['#D9683C', '#F09A52', '#FFC878', '#FFE9B5'], glow: '#FFF3C4', body: 'sun', bodyAt: 0.82, stars: 0, cloud: '#FFE2B0',
    far: { color: '#A8563A', alpha: 0.6, shape: 'stacks' },
    walls: ['#C96A4A', '#B5573C', '#D98A5E', '#8A4A3A', '#E0A070'], trim: '#4A2418', window: '#FFE7A0', accents: [ROAST, '#2F6B55', GOLD, RED], row: roastery,
    walk: '#D9A877', walkEdge: '#A8703F', road: '#5A3B30', lane: '#FFD9A0', laneShape: 'dash',
  },
  {
    from: 3e7, sky: ['#1B1746', '#4A2A86', '#B4418E', '#FF8A6B'], glow: '#FFB48A', body: 'moon', bodyAt: 0.3, stars: 0.5, cloud: '#FF8FB8',
    far: { color: '#2A1F5C', alpha: 0.9, shape: 'towers', lights: [GOLD, '#FF8FB8'] },
    walls: ['#3A2C78', '#472E86', '#2E3A80', '#33306E', '#4B3A92'], trim: '#16123A', window: GOLD, accents: [PINK, MINT, GOLD, '#6BD8FF'], row: night,
    walk: '#3B3168', walkEdge: '#221C48', road: '#1A1636', lane: PINK, laneShape: 'dash',
  },
  {
    from: 1e9, sky: ['#0B1030', '#1F2A6B', '#5A4AA8', '#F2B8C6'], glow: '#FFE9C9', body: 'bean', bodyAt: 0.4, stars: 0.9, cloud: '#FFFFFF',
    far: { color: '#FFF4E6', alpha: 0.75, shape: 'foam' },
    walls: ['#fff'], trim: INK, window: '#9EE7FF', accents: [PINK, MINT, GOLD, RED], row: foam,
    walk: '#FFF8EC', walkEdge: '#E6C9A8', road: '#EBD3B4', lane: '#B98A5E', laneShape: 'bean',
  },
  {
    from: 1e11, sky: ['#7FB6FF', '#BFE0FF', '#FFE9B0', '#FFF8DC'], glow: '#FFF3B8', body: 'sun', bodyAt: 0.2, stars: 0, cloud: '#FFFFFF',
    far: { color: '#FFFDF4', alpha: 0.85, shape: 'foam' },
    walls: ['#FFFDF6', '#F6EEDD', '#FFF6E0'], trim: '#B8923A', window: '#FFE9A0', accents: [GOLD, '#FFFFFF', '#8FC7FF', '#F2C94C'], row: heaven,
    walk: '#FFFDF4', walkEdge: '#E9D8A6', road: '#F3EAD2', lane: GOLD, laneShape: 'dash',
  },
  {
    from: 1e12, sky: ['#D6D6D3', '#E2E2DF', '#EDEDEA', '#F6F6F4'], glow: '#FFFFFF', body: 'none', bodyAt: 0.3, stars: 0, cloud: '#F6F6F4', floaters: ['#8E8E89', '#B4B4AF', '#3A3A40', '#FFFFFF'],
    far: { color: '#FFFFFF', alpha: 0, shape: 'none' },
    walls: ['#F6F6F4'], trim: '#C8C8C4', window: '#E2E2DF', accents: ['#C8C8C4', '#B4B4AF', '#DADAD6', '#F6F6F4'], row: nothing,
    walk: '#F2F2EF', walkEdge: '#C8C8C4', road: '#E8E8E5', lane: '#9A9A95', laneShape: 'dash',
  },
];

export const ORBIT = scenes.findIndex(scene => scene.body === 'bean');

/** The scene a run is in after burning this many tokens. */
export const sceneAt = (tokens: number) => scenes.findLastIndex(scene => tokens >= scene.from);

export function rowArt(scene: Scene, kind: number, res: number): Stamp {
  const piece = scene.row[kind];
  return stamp({ left: -34, top: -piece.height - 14, width: piece.width + 68, height: piece.height + 34 }, res, ctx => piece.paint(ctx, scene));
}

export function cloudArt(scene: Scene): HTMLCanvasElement[] {
  if (!scene.floaters) {
    const image = canvas(220, 80), ctx = image.getContext('2d')!;
    ctx.fillStyle = scene.cloud;
    round(ctx, 0, 30, 150, 34, 17); ctx.fill(); round(ctx, 28, 10, 86, 40, 20); ctx.fill(); round(ctx, 70, 40, 130, 30, 15); ctx.fill();
    return [image];
  }
  return scene.floaters.map((color, kind) => {
    const image = canvas(90, 90), ctx = image.getContext('2d')!;
    ctx.fillStyle = ctx.strokeStyle = color; ctx.lineWidth = 9;
    if (kind === 0) { trace(ctx, [45, 8, 84, 76, 6, 76]); ctx.closePath(); ctx.fill(); }
    else if (kind === 1) { trace(ctx, [45, 6, 84, 45, 45, 84, 6, 45]); ctx.closePath(); ctx.fill(); }
    else if (kind === 2) { ctx.beginPath(); ctx.arc(45, 45, 32, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(45, 45, 26, 0, Math.PI * 2); ctx.fill(); }
    return image;
  });
}

/** The sun, the moon or the bean that hangs over a scene, `r` pixels to its edge. */
export function paintBody(ctx: Ctx, scene: Scene, x: number, y: number, r: number) {
  if (scene.body === 'none') return;
  if (scene.body === 'sun') { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = scene.glow; ctx.fill(); return; }
  if (scene.body === 'moon') {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 0.45, y - r * 0.25, r * 0.85, 0, Math.PI * 2, true); ctx.fillStyle = '#FFF1D0'; ctx.fill('evenodd');
    ctx.restore(); return;
  }
  bean(ctx, x, y, r * 3.4, -0.5, '#9C6A45', '#5A3520', Math.max(2, r * 0.12));
}

/** Adds the i-th far-off shape to the path: `x` is its left edge, `base` the horizon, `s` pixels per metre. */
export function farShape(ctx: Ctx, kind: FarShape, i: number, x: number, base: number, s: number) {
  if (kind === 'none') return;
  const w = (0.6 + hash(i, 51) * 0.8) * s, tall = hash(i, 52);
  if (kind === 'foam') { const rx = w * 1.3, ry = (0.5 + tall * 0.9) * s; ctx.moveTo(x - rx * 0.3, base + 1); ctx.ellipse(x + rx * 0.7, base + 1, rx, ry, 0, Math.PI, 0); return; }
  const h = (kind === 'towers' ? 1.6 + tall * 2.6 : 0.9 + tall * 1.9) * s, top = base - h;
  ctx.rect(x, top, w, h + 1);
  if (kind === 'roofs') {
    if (hash(i, 53) > 0.45) { ctx.moveTo(x - 0.05 * s, top); ctx.lineTo(x + w / 2, top - 0.32 * s); ctx.lineTo(x + w + 0.05 * s, top); ctx.closePath(); } else ctx.rect(x + w * 0.6, top - 0.25 * s, 0.14 * s, 0.25 * s);
  } else if (kind === 'stacks') {
    if (hash(i, 53) > 0.5) {
      const cx = x + w * 0.3, tip = top - (0.7 + hash(i, 54)) * s;
      ctx.rect(cx, tip, 0.16 * s, top - tip);
      for (let k = 0; k < 3; k++) { const r = (0.14 + k * 0.06) * s, px = cx + (0.1 + k * 0.2) * s, py = tip - (0.15 + k * 0.22) * s; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2); }
    } else { ctx.moveTo(x, top); ctx.lineTo(x + w * 0.5, top - 0.3 * s); ctx.lineTo(x + w * 0.5, top); ctx.lineTo(x + w, top - 0.3 * s); ctx.lineTo(x + w, top); ctx.closePath(); }
  } else if (hash(i, 53) > 0.6) ctx.rect(x + w * 0.4, top - 0.28 * s, 0.07 * s, 0.28 * s);
}
