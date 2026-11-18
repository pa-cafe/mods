import type { Build, Kit, Skyline } from './street3d-kit';

const SLAB = '#141418', FACE = '#1C1C22', EDGE = '#B9B9B4', DAIS = '#DCDCD8', SHARD = '#8E8E89', WORDS = '#F4F4F0';

const SAYINGS = ['思考中…', '還在想…', '已思考 9,999 秒', '快好了，真的', '正在重新思考…', '我再想想', '靈感加載中…', '先喝口咖啡'] as const;

export function voidCup(b: Build, size: number, x: number, y: number, z: number, color: string, look: { rough?: number; glow?: number } = {}) {
  const r = size * 0.42, h = size * 0.7, foot = y - size / 2;
  b.tube(color, size * 0.75, size * 0.07, x, foot, z, look);
  b.tube(color, r, h, x, foot + size * 0.07, z, { ...look, top: 1.3 });
  b.ring(color, h * 0.26, size * 0.1, x + r * 1.25, foot + size * 0.07 + h * 0.5, z, look);
}

const face = (w: number, h: number, saying: string) => (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.fillStyle = FACE; ctx.fillRect(0, 0, s, s);
  ctx.scale(s / w, s / h);
  ctx.fillStyle = WORDS;
  for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.45 + i * 0.27; ctx.beginPath(); ctx.ellipse(w * (0.36 + i * 0.14), h * 0.25, 0.6, 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.font = `900 2px "Noto Sans TC", "PingFang TC", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(saying, w / 2, h * 0.36, w * 0.9);
};

/** The artist left UV0 on the little inset face for the game's original, random wording. */
export function thoughtLabel(kit: Kit) {
  const saying = SAYINGS[Math.floor(Math.random() * SAYINGS.length)];
  const texture = kit.picture(`void:inset:${saying}`, (ctx, s) => {
    ctx.fillStyle = FACE; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = WORDS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.scale(1, 2.8);
    ctx.font = `bold ${s * 0.135}px system-ui, sans-serif`;
    ctx.fillText(saying, s / 2, s / 5.6, s * 0.94);
  }, 512);
  texture.flipY = false;
  return texture;
}

function slab(b: Build, x: number, z: number, lit: number) {
  const w = 18, h = 40.5, d = 4.5, foot = 9, front = z + d / 2;
  if (b.model('void3_thinking_monolith', x, 0, z)) {
    const said = Math.floor(Math.random() * SAYINGS.length);
    b.sign(`void:face:${said}`, face(16.4, 38.9, SAYINGS[said]), 16.4, 38.9, x, 29.25, z + 2.36, { glow: 0.5, sharp: true });
  } else {
    if (!b.model('v6_monolith_dais', x, foot - 3, z)) {
      b.tube(DAIS, 16, 1.2, x, foot - 2.4, z, { sides: 48, rough: 0.6 }); b.tube(DAIS, 13, 1.2, x, foot - 1.2, z, { sides: 48, rough: 0.6 });
    }
    b.disc(EDGE, 12.2, x, foot + 0.02, z, { turn: [-90, 0, 0], flat: 0.25 });
    if (!b.model('v6_thinking_monolith', x, foot, z)) {
      b.box(SLAB, w, h, d, x, foot, z, { rough: 0.12 });
      const said = Math.floor(Math.random() * SAYINGS.length);
      b.sign(`void:face:${said}`, face(w - 1.6, h - 1.6, SAYINGS[said]), w - 1.6, h - 1.6, x, foot + h / 2, front + 0.05, { glow: 0.5, sharp: true });
      for (const side of [-1, 1]) b.box(EDGE, 0.14, h - 1.6, 0.06, x + side * (w / 2 - 0.8), foot + 0.8, front + 0.12, { glow: 0.5 + lit * 0.3 });
      for (const y of [foot + 0.8, foot + h - 0.8]) b.box(EDGE, w - 1.46, 0.14, 0.06, x, y - 0.07, front + 0.12, { glow: 0.5 + lit * 0.3 });
    }
  }
  const shards: readonly (readonly [number, number, number, number])[] = [[-17, 34, 1.6, 0], [-14, 18, 1.4, 1], [16, 41, 1.3, 2], [19, 24, 2, 1], [-21, 46, 1.2, 1], [13, 13, 1, 0], [22, 33, 1.5, 1], [-11, 28, 1.1, 1], [-24, 22, 1.7, 2]];
  shards.forEach(([dx, y, r, kind], i) => {
    const turn = [i * 37, i * 53, i * 29] as const;
    if (b.model((['void3_floating_cube', 'void3_floating_cup', 'void3_floating_orb'] as const)[kind], x + dx, y, z + 2, r, turn[2], turn[1])) return;
    if (kind === 0) b.box(SHARD, r * 1.6, r * 1.6, r * 1.6, x + dx, y, z + 2, { turn, rough: 0.35 });
    else if (kind === 1) {
      if (!b.model('v6_coffee_cup', x + dx, y, z + 2, r * 0.4)) voidCup(b, r * 2.2, x + dx, y, z + 2, SHARD, { rough: 0.35 });
    }
    else b.ball(SHARD, r, r, r, x + dx, y, z + 2, { rough: 0.35 });
  });
}

export const blank: Skyline = { sights: [{ reach: 22, build: slab }] };
