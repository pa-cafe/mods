import { CREAM, INK, RED } from './art';
import type { Build } from './street3d-kit';
import { lights } from './street3d-kit';

/** One thing to stand on the street this frame: where (metres along it), how squashed by a hit (1 is not at all), and the word on its sign. A wall `reset` has been broken by a boost: its lights are green and its sign says so. */
export type StreetProp = { kind: 'window' | 'wall' | 'mail'; x: number; squash: number; sign?: string; reset?: boolean };

const MINT = '#B9DCCB', NIGHT = '#3B3168', WOOD = '#7A4B3A', COUNTER = '#E9B872', GREEN = '#2F6B55', PAPER = '#F3E2B8';
const RACK = ['#3A4658', '#2F3A4B'] as const, OK = '#2F9E6B';

const tag = (word: string, w: number, h: number, color = RED) => (ctx: CanvasRenderingContext2D, s: number) => {
  const W = w * 100, H = h * 100;
  ctx.scale(s / W, s / H);
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(0, 0, W, H, H * 0.32); ctx.fill();
  ctx.lineWidth = H * 0.08; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H * 0.92, H * 0.3); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `900 ${H * 0.5}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(word, W / 2, H * 0.54, W * 0.88);
};
const tagWidth = (word: string, most: number) => Math.min(most, Math.max(1.5, 0.22 * [...word].reduce((width, char) => width + (char.charCodeAt(0) > 0x2e80 ? 1.6 : 0.85), 0) + 0.4));

const envelope = (ctx: CanvasRenderingContext2D, s: number) => {
  const W = 200, H = 143;
  ctx.scale(s / W, s / H);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(122,75,58,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W / 2, H * 0.52); ctx.lineTo(W, 0); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(135, 14, 46, 56, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E8825A'; ctx.fillRect(141, 20, 34, 44);
  ctx.fillStyle = '#D9C49A'; ctx.beginPath(); ctx.roundRect(36, 92, 90, 9, 4.5); ctx.roundRect(36, 112, 64, 9, 4.5); ctx.fill();
  ctx.save(); ctx.translate(132, 48); ctx.rotate(-0.12); ctx.strokeStyle = RED; ctx.lineWidth = 4.4;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
  for (let wave = 0; wave < 3; wave++) { ctx.beginPath(); for (let i = 0; i <= 9; i++) ctx.lineTo(-32 - i * 6, -14 + wave * 14 + Math.sin(i * 1.4) * 4); ctx.stroke(); }
  ctx.restore();
};

function takeaway(b: Build) {
  const front = -0.15, deep = 1.3, back = front - deep;
  b.box(MINT, 2.4, 2.38, deep, 0, 0, front - deep / 2, { rough: 0.6 });
  b.box(INK, 2.44, 0.06, deep + 0.04, 0, 2.38, front - deep / 2);
  b.box(WOOD, 1.95, 1, 0.08, 0, 0.98, front + 0.01);
  b.pane(NIGHT, 1.83, 0.88, 0, 1.47, front + 0.06, { glow: 0.25 });
  b.pane('#FFE9B8', 1.75, 0.24, 0, 1.75, front + 0.07, { glow: 0.5 });
  b.box(COUNTER, 2.6, 0.2, 0.55, 0, 0.98, front + 0.15, { rough: 0.5 });
  b.box(WOOD, 1.4, 0.78, 0.06, 0, 0, front + 0.03);
  for (let i = 0; i < 8; i++) b.box(i % 2 ? CREAM : GREEN, 2.7 / 8, 0.06, 0.95, -1.35 + 2.7 / 8 * (i + 0.5), 2.48, front + 0.25, { rough: 0.7, turn: [-14, 0, 0] });
  b.box(WOOD, 2.8, 0.17, 0.2, 0, 2.62, back + deep - 0.05);
  b.tube('#fff', 0.22, 0.48, 0.42, 1.18, front + 0.2, { top: 1.25 });
  b.tube(GREEN, 0.25, 0.12, 0.42, 1.36, front + 0.2, { top: 1.05 });
  b.tube(INK, 0.29, 0.05, 0.42, 1.66, front + 0.2);
  for (const [x, y, r] of [[0.36, 1.86, 0.08], [0.5, 2.02, 0.07], [0.4, 2.16, 0.06]] as const) b.ball('#fff', r, r, r, x, y, front + 0.2, { glow: 0.6, rough: 1 });
}

function serverWall(b: Build, word: string, reset: boolean) {
  const front = -0.2, deep = 1, mid = front - deep / 2, units = 4, tall = 5.2 / units;
  for (let i = 0; i < units; i++) {
    b.box(RACK[i % 2], 1.5, tall - 0.04, deep, 0, i * tall, mid, { rough: 0.5 });
    b.sign(`rack:${reset ? 'ok:' : ''}${i}`, lights(reset ? ['#5CFF9A', '#5CFF9A', '#5CFF9A', '#5CFF9A', '#FFC83D'] : ['#FF5C6C', '#FF5C6C', '#FF5C6C', '#FF5C6C', '#FFC83D'], 4, 6, 0.75, '#1B2330', i + 3), 1.36, tall - 0.18, 0, i * tall + tall / 2, front + 0.01, { glow: 1.1 });
  }
  b.box(INK, 1.58, 0.08, deep + 0.08, 0, 5.2, mid);
  const w = tagWidth(word, 2.1);
  b.box(INK, 0.08, 0.3, 0.08, 0, 5.28, mid);
  b.box(reset ? OK : RED, w, 0.42, 0.1, 0, 5.52, mid);
  b.sign(`tag:${word}:${w}:${reset}`, tag(word, w, 0.42, reset ? OK : RED), w, 0.42, 0, 5.73, mid + 0.06, { sharp: true, glow: 0.35 });
}

function banLetter(b: Build, word: string) {
  const z = -0.6;
  b.tube('#FFD98A', 0.82, 3.8, 0, 0, z, { top: 0.72, sides: 28, flat: 0.09 });
  b.disc('#FFD98A', 1, 0, 0.02, z, { turn: [-90, 0, 0], flat: 0.12 });
  const tilt = [0, 0, -4] as const;
  b.box(PAPER, 2, 1.43, 0.08, 0, 3.8, z, { rough: 0.8, turn: tilt });
  b.sign('ban-envelope', envelope, 2, 1.43, -0.05, 3.8 + 1.43 / 2, z + 0.05, { sharp: true, glow: 0.15, turn: tilt });
  const w = tagWidth(word, 2.2);
  b.box(RED, w, 0.42, 0.1, 0, 5.38, z);
  b.sign(`tag:${word}:${w}`, tag(word, w, 0.42), w, 0.42, 0, 5.59, z + 0.06, { sharp: true, glow: 0.35 });
}

// Only the enamel and structural trim vary. The seal, paper, status LEDs, brass and lit counter
// retain their authored materials and the two quota states use exactly the same cabinet paint.
const finishes = [
  { window: '#B45C44', wall: '#627789', mail: '#874C49', trim: '#574B44' },
  { window: '#458580', wall: '#647782', mail: '#A1634B', trim: '#464D50' },
  { window: '#B86E77', wall: '#8297B2', mail: '#BA796C', trim: '#575268' },
  { window: '#BE8965', wall: '#7F92A4', mail: '#A46C83', trim: '#55536A' },
  { window: '#B59C64', wall: '#808D99', mail: '#AB7672', trim: '#736353' },
  { window: '#8E8986', wall: '#737981', mail: '#9B696B', trim: '#545257' },
] as const;

export function buildProp(b: Build, prop: StreetProp, place: number) {
  const palette = finishes[place];
  b.finishes = { 'common-sage': palette[prop.kind], 'common-dark-timber': palette.trim };
  const model = prop.kind === 'window' ? 'common_takeaway_window' : prop.kind === 'mail' ? 'common_ban_letter'
    : prop.reset ? 'common_quota_wall_reset' : 'common_quota_wall_blocked';
  if (b.model(model, 0, 0, 0)) {
    if (prop.kind === 'mail' && place === 4) {
      // A dark mount separates the ivory envelope from the pale columns and cloud banks.
      b.box('#68404B', 2.24, 1.67, 0.08, 0, 3.68, -0.68);
    }
    if (prop.kind !== 'window') {
      const mail = prop.kind === 'mail', word = prop.sign ?? '';
      const width = tagWidth(word, mail ? 2.2 : 2.1);
      b.sign(`engraved:${word}`, (ctx, size) => {
        ctx.fillStyle = '#FFF2D8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${size * 0.82}px system-ui, sans-serif`;
        ctx.fillText(word, size / 2, size / 2, size * 0.96);
      }, width, 0.28, 0, mail ? 5.59 : 5.73, mail ? -0.51 : -0.61, { sharp: true, glow: 0.3, cutout: true });
    }
    return;
  }
  if (prop.kind === 'window') takeaway(b);
  else if (prop.kind === 'wall') serverWall(b, prop.sign ?? '', prop.reset === true);
  else banLetter(b, prop.sign ?? '');
}
/** The key a built prop is shared under: one per kind and word. */
export const propKey = (prop: StreetProp) => `prop:${prop.kind}:${prop.reset ? 'reset:' : ''}${prop.sign ?? ''}`;
