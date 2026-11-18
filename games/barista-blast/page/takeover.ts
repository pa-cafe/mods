import type { TextKey } from './i18n.ts';
import { CREAM, hash, houseFont, MONO } from './art';
import { wordCard, wrap, type Drawn } from './cards';
import type { BlastEvent } from './events';
import { drawPrelude, PRELUDE_MS, type Actor, type Lost } from './trouble';

const takeoverMs = (kind: TakeoverKind) => looks[kind].mail ? 2900 : 1900;
const LEAVE_MS = 220;
type TakeoverKind = 'capacity' | 'appealed' | 'banned' | 'cutoff';
type Words = (key: TextKey, values?: Record<string, string | number>) => string;

type Mail = { from: string; subject: string; body: readonly string[]; ink: string };
const looks: Record<TakeoverKind, { wash: string; band: string; edge: string; head: TextKey; fill: 'gold' | 'pink'; log: readonly string[]; note: TextKey; stamp?: string; mail?: Mail }> = {
  capacity: { wash: '20,24,40', band: '#2F3A4B', edge: '#9FB3C8', head: 'At capacity!', fill: 'gold', log: ['This model is at capacity.', 'Please try again later.'], note: 'Every cup and all your caffeine: gone until there’s room.' },
  appealed: {
    wash: '74,48,6', band: '#E8A21B', edge: '#FFF4A8', head: 'Appeal granted!', fill: 'gold', log: [], note: 'Appeal accepted. Keep flying!', stamp: 'REINSTATED',
    mail: { from: 'Trust & Safety', subject: 'Re: Your appeal', body: ['Hello,', 'We have reviewed your appeal. Your account has been reinstated.', 'We apologize for the inconvenience.', 'The Trust & Safety Team'], ink: '#2E8B57' },
  },
  banned: {
    wash: '70,6,24', band: '#B3263E', edge: '#FFD9DE', head: 'Banned!', fill: 'pink', log: [], note: 'Account disabled. The run ends here.', stamp: 'ACCOUNT DISABLED',
    mail: { from: 'Trust & Safety', subject: 'Your account has been disabled', body: ['Hello,', 'Your account has been disabled after an automatic review of your recent activities.', 'If you believe this was a mistake, you may submit an appeal.', 'The Trust & Safety Team'], ink: '#C62B45' },
  },
  cutoff: { wash: '18,34,28', band: '#263F35', edge: '#9AD7B7', head: 'max_tokens!', fill: 'gold', log: ['stop_reason: "max_tokens"'], note: 'The output was cut off mid-sen' },
};
export const takeoverOf = (kind: TakeoverKind) => kind === 'capacity' ? 'dots' as const : kind === 'cutoff' ? null : 'claude' as const;

export function takeoverFor(events: readonly BlastEvent[]): TakeoverKind | null {
  for (const event of events) {
    if (event.type === 'end' && event.end === 'banned') return 'banned';
    if (event.type === 'end' && event.end === 'timeout') return 'cutoff';
    if (event.type === 'boost' && event.hit.as === 'claude' && event.hit.mood === 'bad') return 'appealed';
    if ((event.type === 'lapsed' || event.type === 'hit' && !event.held) && event.hit.as === 'dots' && event.hit.mood === 'bad' && !event.hit.waived) return 'capacity';
  }
  return null;
}

/** `lead` is how long the character's own scene plays first (0 for none), `actor` who plays it and `lost` what she takes. */
export type Takeover = {
  kind: TakeoverKind; age: number; ms: number; head: Drawn; log: string[]; note: string[]; box: number; icon: HTMLCanvasElement | null; face: HTMLCanvasElement | null;
  lead: number; actor: Actor | null; lost: Lost; stamps: { banned: string; reinstated: string; capacity: string };
};

export const hurryTakeover = (takeover: Takeover) => { takeover.age = Math.max(takeover.age, takeover.ms - LEAVE_MS); };

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const LOG_SIZE = 15, NOTE_SIZE = 17, MAIL_SIZE = 15, SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function stageTakeover(kind: TakeoverKind, width: number, ratio: number, words: Words, picture: HTMLCanvasElement | null, face: HTMLCanvasElement | null, scene: { actor: Actor; lost: Lost } | null = null): Takeover {
  const icon = picture, look = looks[kind], box = Math.min(520, width - 32), measure = document.createElement('canvas').getContext('2d')!;
  measure.font = look.mail ? `500 ${MAIL_SIZE}px ${SANS}` : `700 ${LOG_SIZE}px ${MONO}`;
  const log = look.mail ? look.mail.body.flatMap((paragraph, index) => [...(index ? [''] : []), ...wrap(measure, paragraph, box - 44)]) : look.log.flatMap(line => wrap(measure, line, box - 56));
  measure.font = `800 ${NOTE_SIZE}px ${houseFont()}`;
  const lead = scene && kind !== 'cutoff' ? PRELUDE_MS[kind] : 0;
  return {
    kind, age: 0, ms: takeoverMs(kind) + lead, lead, actor: scene?.actor ?? null, lost: scene?.lost ?? { cups: 0, caffeine: 0 },
    stamps: { banned: words('BANNED'), reinstated: looks.appealed.stamp!, capacity: words('AT CAPACITY') }, icon, face, box, log, note: wrap(measure, words(look.note), Math.min(box, width - 40)),
    head: wordCard(words(look.head), clamp(width * 0.1, 40, 84), ratio, look.fill, -5),
  };
}

/**
 * The whole screen for a beat: a wash of colour, a slanted band with the thing that was hit and the word for it, and
 * under it what the service would print, typed out. `calm` (reduced motion) keeps the words and drops the movement.
 */
export function drawTakeover(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, whole: Takeover, calm: boolean) {
  if (whole.age < whole.lead && whole.actor && whole.kind !== 'cutoff') { drawPrelude(ctx, view, whole.kind, whole.age, whole.actor, whole.stamps, whole.lost, calm); return; }
  const takeover = whole.lead ? { ...whole, age: whole.age - whole.lead, ms: whole.ms - whole.lead } : whole;
  const { age } = takeover, look = looks[takeover.kind], { width: w, height: h } = view;
  if (look.mail) { drawLetter(ctx, view, takeover, look.mail, calm); return; }
  const arrive = calm ? 1 : easeOut(clamp(age / 240)), leave = clamp((takeover.ms - age) / LEAVE_MS);
  const band = clamp(h * 0.26, 132, 230), middle = h * 0.4;
  ctx.save();
  ctx.globalAlpha = Math.min(1, arrive * 1.4) * leave;
  ctx.fillStyle = `rgba(${look.wash},.84)`; ctx.fillRect(0, 0, w, h);
  const jolt = calm ? 0 : 9 * clamp(1 - age / 320) ** 2;
  ctx.translate(Math.sin(age * 0.11) * jolt, Math.cos(age * 0.13) * jolt);

  ctx.save();
  ctx.translate(w / 2 - (1 - arrive) * w * 1.1, middle); ctx.rotate(-0.06);
  ctx.fillStyle = look.band; ctx.fillRect(-w, -band / 2, w * 2, band);
  ctx.fillStyle = look.edge; ctx.fillRect(-w, -band / 2 - 5, w * 2, 5); ctx.fillRect(-w, band / 2, w * 2, 5);
  if (!calm) {
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    for (let i = 0; i < 12; i++) { const x = ((hash(i, 3) * w * 2 + age * (0.9 + hash(i, 5) * 1.4)) % (w * 2)) - w; ctx.fillRect(x, (hash(i, 7) - 0.5) * band * 0.86, 70 + hash(i, 9) * 130, 3); }
  }
  const wide = w >= 560, side = band * 1.15, pop = calm ? 1 : 1 + 0.3 * clamp(1 - age / 300);
  if (takeover.icon) {
    const x = wide ? -w * 0.26 : 0, size = side * pop;
    ctx.save(); ctx.globalAlpha *= wide ? 1 : 0.38; ctx.drawImage(takeover.icon, x - size / 2, -size / 2, size, size); ctx.restore();
  }
  const head = takeover.head, room = wide ? w * 0.56 : w - 28, fit = Math.min(1, room / head.width) * (calm ? 1 : 1 + 0.9 * clamp(1 - age / 200) ** 2);
  ctx.drawImage(head.image, (wide && takeover.icon ? w * 0.13 : 0) - head.width * fit / 2, -head.height * fit / 2, head.width * fit, head.height * fit);
  ctx.restore();

  const line = LOG_SIZE * 1.5, top = middle + band / 2 + 26, tall = takeover.log.length * line + 26, left = (w - takeover.box) / 2;
  ctx.globalAlpha = clamp((age - 160) / 160) * leave;
  ctx.beginPath(); ctx.roundRect(left, top, takeover.box, tall, 12); ctx.fillStyle = 'rgba(10,12,20,.94)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = look.edge; ctx.stroke();
  ctx.font = `700 ${LOG_SIZE}px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let typed = calm ? Infinity : Math.max(0, Math.floor((age - 220) / 14));
  takeover.log.forEach((text, index) => {
    const y = top + 13 + line * (index + 0.5);
    ctx.fillStyle = look.edge; ctx.fillText(index ? ' ' : '›', left + 16, y);
    ctx.fillStyle = '#F4F1E6'; ctx.fillText(text.slice(0, typed), left + 36, y);
    typed = Math.max(0, typed - text.length);
  });
  ctx.globalAlpha = clamp((age - 620) / 200) * leave;
  ctx.font = `800 ${NOTE_SIZE}px ${houseFont()}`; ctx.textAlign = 'center'; ctx.fillStyle = CREAM;
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  takeover.note.forEach((text, index) => ctx.fillText(text, w / 2, top + tall + 26 + index * NOTE_SIZE * 1.45));
  ctx.shadowBlur = 0;

  if (look.stamp && (calm || age > 520)) {
    const since = age - 520, slam = calm ? 1 : 1 + 1.6 * clamp(1 - since / 150) ** 2, size = clamp(w * 0.036, 15, 26) * slam;
    ctx.globalAlpha = (calm ? 1 : clamp(since / 90)) * 0.94 * leave;
    ctx.save(); ctx.translate(w * (wide ? 0.78 : 0.66), middle + band * 0.36); ctx.rotate(-0.16);
    ctx.font = `800 ${size}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wide2 = ctx.measureText(look.stamp).width + size * 1.4, tall2 = size * 2.1;
    ctx.strokeStyle = '#FFF4F5'; ctx.lineWidth = size * 0.22; ctx.beginPath(); ctx.roundRect(-wide2 / 2, -tall2 / 2, wide2, tall2, size * 0.35); ctx.stroke();
    ctx.lineWidth = size * 0.07; ctx.beginPath(); ctx.roundRect(-wide2 / 2 + size * 0.3, -tall2 / 2 + size * 0.3, wide2 - size * 0.6, tall2 - size * 0.6, size * 0.2); ctx.stroke();
    ctx.fillStyle = '#FFF4F5'; ctx.fillText(look.stamp, 0, size * 0.05);
    ctx.restore();
  }
  ctx.restore();
}

function envelope(ctx: CanvasRenderingContext2D, wide: number, open: number, ink: string) {
  const tall = wide * 0.62, x = -wide / 2, y = -tall / 2;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, wide * 0.018); ctx.strokeStyle = '#3B2418';
  ctx.beginPath(); ctx.roundRect(x, y, wide, tall, wide * 0.05); ctx.fillStyle = '#F3E2B8'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + tall); ctx.lineTo(0, y + tall * 0.42); ctx.lineTo(x + wide, y + tall); ctx.stroke();
  const point = y + tall * (0.56 - 1.02 * open);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(0, point); ctx.lineTo(x + wide, y); ctx.closePath(); ctx.fillStyle = open > 0.5 ? '#E9D29E' : '#F8ECCB'; ctx.fill(); ctx.stroke();
  if (open < 0.5) { ctx.beginPath(); ctx.arc(0, point, wide * 0.07, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill(); ctx.stroke(); }
}

function drawLetter(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, takeover: Takeover, mail: Mail, calm: boolean) {
  const { age } = takeover, look = looks[takeover.kind], { width: w, height: h } = view;
  const leave = clamp((takeover.ms - age) / LEAVE_MS), fly = calm ? 1 : easeOut(clamp(age / 300)), open = calm ? 1 : clamp((age - 260) / 180), out = calm ? 1 : easeOut(clamp((age - 380) / 300));
  ctx.save();
  ctx.globalAlpha = Math.min(1, fly * 1.6) * leave;
  ctx.fillStyle = `rgba(${look.wash},.86)`; ctx.fillRect(0, 0, w, h);

  const line = MAIL_SIZE * 1.5, headTall = 68, wide = takeover.box, tall = headTall + takeover.log.length * line + 34 + (look.stamp ? 44 : 0);
  const head = takeover.head, headFit = Math.min(1, (w - 28) / head.width, h * 0.2 / head.height), headTallOn = head.height * headFit;
  const notes = takeover.note.length * NOTE_SIZE * 1.45, room = h - headTallOn - notes - 56, fit = Math.min(1.4, room / tall, (w - 28) / wide);
  const top = headTallOn + 20 + Math.max(0, (room - tall * fit) / 2), middle = top + tall * fit / 2, under = top + tall * fit + 14;

  if (out < 1) {
    const size = Math.min(w * 0.5, 300) * (0.5 + 0.5 * fly);
    ctx.save();
    ctx.translate(w / 2 + (1 - fly) * w * 0.7, middle - (1 - fly) * h * 0.5 + out * tall * fit * 0.3); ctx.rotate((1 - fly) * 1.4 - 0.06);
    ctx.globalAlpha *= 1 - out;
    envelope(ctx, size, open, mail.ink);
    ctx.restore();
  }

  const pop = calm ? 1 : 1 + 0.8 * clamp(1 - (age - 380) / 220) ** 2;
  ctx.save(); ctx.globalAlpha = (calm ? 1 : clamp((age - 380) / 140)) * leave;
  ctx.drawImage(head.image, w / 2 - head.width * headFit * pop / 2, 12 + headTallOn / 2 - head.height * headFit * pop / 2, head.width * headFit * pop, head.height * headFit * pop);
  ctx.restore();

  if (out > 0) {
    ctx.save();
    ctx.globalAlpha = out * leave;
    ctx.translate(w / 2, middle + (1 - out) * tall * 0.25); ctx.scale(fit * (0.55 + 0.45 * out), fit * (0.55 + 0.45 * out)); ctx.translate(-wide / 2, -tall / 2);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.beginPath(); ctx.roundRect(0, 0, wide, tall, 14); ctx.fillStyle = '#FFFDF7'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = '#3B2418'; ctx.stroke();
    const r = 20, cx = 22 + r, cy = 14 + r;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FBE3D4'; ctx.fill(); ctx.clip();
    if (takeover.face) ctx.drawImage(takeover.face, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 13px ${SANS}`; ctx.fillStyle = '#6B5B4B'; ctx.fillText(mail.from, cx + r + 12, cy - 10, wide - cx - r - 30);
    ctx.font = `800 16px ${SANS}`; ctx.fillStyle = '#2A211B'; ctx.fillText(mail.subject, cx + r + 12, cy + 10, wide - cx - r - 30);
    ctx.fillStyle = 'rgba(59,36,24,.16)'; ctx.fillRect(22, headTall, wide - 44, 2);
    ctx.font = `500 ${MAIL_SIZE}px ${SANS}`; ctx.fillStyle = '#2A211B';
    let typed = calm ? Infinity : Math.max(0, Math.floor((age - 620) / 6));
    takeover.log.forEach((text, index) => {
      ctx.fillText(text.slice(0, typed), 22, headTall + 18 + line * (index + 0.5));
      typed = Math.max(0, typed - text.length);
    });
    const at = 620 + takeover.log.join('').length * 6 + 120;
    if (look.stamp && (calm || age > at)) {
      const since = age - at, slam = calm ? 1 : 1 + 1.6 * clamp(1 - since / 150) ** 2, size = 17 * slam;
      ctx.globalAlpha = (calm ? 1 : clamp(since / 90)) * 0.9 * out * leave;
      ctx.translate(wide - 124, tall - 36); ctx.rotate(-0.1);
      ctx.font = `800 ${size}px ${MONO}`; ctx.textAlign = 'center';
      const across = ctx.measureText(look.stamp).width + size * 1.4, high = size * 2.1;
      ctx.strokeStyle = mail.ink; ctx.lineWidth = size * 0.2; ctx.beginPath(); ctx.roundRect(-across / 2, -high / 2, across, high, size * 0.35); ctx.stroke();
      ctx.fillStyle = mail.ink; ctx.fillText(look.stamp, 0, size * 0.05);
    }
    ctx.restore();
  }

  ctx.globalAlpha = (calm ? 1 : clamp((age - 900) / 200)) * leave;
  ctx.font = `800 ${NOTE_SIZE}px ${houseFont()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = CREAM;
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  takeover.note.forEach((text, index) => ctx.fillText(text, w / 2, under + NOTE_SIZE * 0.72 + index * NOTE_SIZE * 1.45));
  ctx.restore();
}
