import { blastLooks, blastTuning, type BlastInputs, type BlastLook } from '../rules.ts';
import { blastPagePath, BLAST_CAST_MAX } from './contract.ts';

export type BlastReplay = { version: number; seed: number; cast: BlastLook[]; inputs: BlastInputs };

const PARAM = 'replay';
const FORMAT = 1;
const MAX_CODE = 8000;

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text: string) => { try { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)); } catch { return null; } };

/**
 * The run as a short code for an address: whole numbers as base-128 digits, each tap as the steps since the one before.
 * A run of a hundred taps fits in about two hundred characters.
 */
export function encodeReplay(replay: BlastReplay): string {
  const bytes: number[] = [];
  const whole = (value: number) => { let left = Math.max(0, Math.floor(value)); do { bytes.push((left & 0x7f) | (left > 0x7f ? 0x80 : 0)); left = Math.floor(left / 128); } while (left > 0); };
  whole(FORMAT); whole(replay.version);
  const seed = replay.seed >>> 0;
  bytes.push(seed >>> 24, (seed >>> 16) & 0xff, (seed >>> 8) & 0xff, seed & 0xff);
  whole(replay.cast.length);
  for (const look of replay.cast) whole(blastLooks.indexOf(look));
  whole(replay.inputs.pilot ? blastLooks.indexOf(replay.inputs.pilot) + 1 : 0);
  whole(replay.inputs.aim); whole(replay.inputs.hold); whole(replay.inputs.taps.length);
  let last = -1;
  for (const tap of replay.inputs.taps) { whole(tap - last - 1); last = tap; }
  return toBase64Url(Uint8Array.from(bytes));
}

/** The run a code stands for, or null for a code that was cut short, altered, or made under another layout. */
export function decodeReplay(code: string): BlastReplay | null {
  if (!code || code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  const bytes = fromBase64Url(code);
  if (!bytes) return null;
  let at = 0;
  const whole = () => {
    let value = 0, scale = 1;
    for (let digit = 0; digit < 6; digit++) {
      if (at >= bytes.length) return null;
      const byte = bytes[at++];
      value += (byte & 0x7f) * scale; scale *= 128;
      if (!(byte & 0x80)) return value;
    }
    return null;
  };
  if (whole() !== FORMAT) return null;
  const version = whole();
  if (version === null || at + 4 > bytes.length) return null;
  const seed = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  at += 4;
  const castLength = whole();
  if (castLength === null || castLength > BLAST_CAST_MAX) return null;
  const cast: BlastLook[] = [];
  for (let index = 0; index < castLength; index++) { const look = whole(); if (look === null || !blastLooks[look]) return null; cast.push(blastLooks[look]); }
  const pilot = whole(), aim = whole(), hold = whole(), count = whole();
  if (pilot === null || pilot > blastLooks.length || aim === null || hold === null || count === null || count > blastTuning.maxSteps) return null;
  const taps: number[] = [];
  let last = -1;
  for (let index = 0; index < count; index++) { const gap = whole(); if (gap === null) return null; last += gap + 1; taps.push(last); }
  if (at !== bytes.length || last > blastTuning.maxSteps) return null;
  return { version, seed, cast, inputs: { aim, hold, taps, ...(pilot ? { pilot: blastLooks[pilot - 1] } : {}) } };
}

export const replayLink = (origin: string, handle: string, replay: BlastReplay) => `${origin}${blastPagePath(handle)}&${PARAM}=${encodeReplay(replay)}`;

export const replayIn = (search: string) => { const code = new URLSearchParams(search).get(PARAM); return code ? decodeReplay(code) : null; };
