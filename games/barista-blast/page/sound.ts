// BARISTA BLAST!! (#1078): the game's sound. Every effect is made here with Web Audio, from oscillators and a little noise,
// so there is no file to fetch. The music is files made with ACE-Step (docs/design/barista-blast-audio.md) and listed in
// `blastTracks`; a track not listed is simply not played, and nothing is fetched for it. No AudioContext is made until the
// player's first press, as browsers ask.
import type { BlastHit } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import type { BlastEvent } from './events';
import { hitCopy } from './nodes';
import { blastVoices, tongueFor } from './voices';

/** What this browser chose to hear. All three are on until the player turns one off. `voice` is the residents' spoken lines. */
export type SoundChoice = { effects: boolean; music: boolean; voice: boolean };
const KEY = 'pa-cafe-blast-sound';
const HEARD: SoundChoice = { effects: true, music: true, voice: true };
let kept: SoundChoice | null = null;
let writeFailed = false;
const listeners = new Set<(choice: SoundChoice) => void>();

export function storedSound(): SoundChoice {
  // Readable storage may still contain an older choice when its quota blocks writes.
  if (writeFailed && kept) return kept;
  let raw: string | null;
  try { raw = localStorage.getItem(KEY); } catch { return kept ?? HEARD; }
  let saved: unknown = null;
  try { saved = raw ? JSON.parse(raw) : null; } catch {   }
  const own = (name: keyof SoundChoice) => !(saved && typeof saved === 'object' && (saved as Record<string, unknown>)[name] === false);
  return { effects: own('effects'), music: own('music'), voice: own('voice') };
}
export function chooseSound(next: SoundChoice) {
  kept = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); writeFailed = false; }
  catch { writeFailed = true; /* the choice holds for this visit until a write succeeds */ }
  for (const listen of listeners) listen(next);
}

/** The game's moments that make a sound. `one` to `bad` are a resident's four moods, from the best to the worst. */
export type BlastCue = 'press' | 'launch' | 'one' | 'two' | 'meh' | 'bad' | 'boost' | 'combo' | 'refill' | 'full' | 'dive' | 'land' | 'print' | 'record';
const familyOf = (cue: BlastCue) => cue === 'one' || cue === 'two' || cue === 'meh' || cue === 'bad' || cue === 'combo' ? 'hit' : cue;
const limits: Record<string, { max: number; ms: number }> = {
  hit: { max: 3, ms: 420 }, land: { max: 2, ms: 300 }, print: { max: 1, ms: 45 }, refill: { max: 2, ms: 300 }, boost: { max: 1, ms: 250 },
};
const usual = { max: 2, ms: 250 };

/** Whether one more of a family may start at `now` (milliseconds), given when the last ones started. Keeps `log` to the window. */
export function allowCue(log: number[], now: number, cue: BlastCue): boolean {
  const { max, ms } = limits[familyOf(cue)] ?? usual;
  while (log.length && now - log[0] >= ms) log.shift();
  if (log.length >= max) return false;
  log.push(now);
  return true;
}

/** The sound a moment of the run makes, if any. A hit waiting on a tap makes its sound when the wait runs out. */
export function cueOf(event: BlastEvent): BlastCue | null {
  const hitCue = (hit: BlastHit): BlastCue => hit.combo ? 'combo' : hit.waived ? 'meh' : hit.mood ?? 'two';
  switch (event.type) {
    case 'hit': return event.held ? null : hitCue(event.hit);
    case 'lapsed': return hitCue(event.hit);
    case 'boost': return 'boost';
    case 'refill': return 'refill';
    case 'dive': return 'dive';
    case 'land': return event.impact >= 3 ? 'land' : null;
    default: return null;
  }
}

type BlastTrack = 'theme' | 'taipei' | 'hsinchu' | 'sf' | 'orbit' | 'receipt';
type Format = 'ogg' | 'm4a';
/** `formats` are the files there are, best first. `loop` is where the seamless loop starts and ends, in seconds, when it is not the whole file. */
type TrackFile = { formats: readonly Format[]; loop?: readonly [number, number] };
export type BlastTracks = Partial<Record<BlastTrack, TrackFile>>;
/**
 * The tracks there are files for in public/audio/blast/, named `<track>.<format>` (theme.ogg, theme.m4a, …); a track
 * without a row is silence. Each loop file has 0.1 s of its own tail before it and of its head after it, so a decoder
 * that adds a little silence at either end still loops inside the music: `loop` is [0.1, 0.1 + the loop's length].
 */
const blastTracks: BlastTracks = {
  theme: { formats: ['ogg', 'm4a'], loop: [0.1, 37.0231] },
  taipei: { formats: ['ogg', 'm4a'], loop: [0.1, 31.0678] },
  hsinchu: { formats: ['ogg', 'm4a'], loop: [0.1, 29.1909] },
  sf: { formats: ['ogg', 'm4a'], loop: [0.1, 27.5286] },
  orbit: { formats: ['ogg', 'm4a'], loop: [0.1, 25.7] },
  receipt: { formats: ['ogg', 'm4a'] },
};
const mime: Record<Format, string> = { ogg: 'audio/ogg; codecs=opus', m4a: 'audio/mp4; codecs=mp4a.40.2' };
export const sceneTrack = (scene: number): BlastTrack | null => (['taipei', 'hsinchu', 'sf', 'orbit', 'orbit'] as const)[scene] ?? null;
const FADE = 1.2, MUSIC = 0.32, EFFECTS = 0.7, SPEECH = 0.95;
const UNDER = 0.35;
const LATE_MS = 900;

const pageLanguage = () => typeof document !== 'undefined' ? document.documentElement.lang : 'en';

type Voice = { type?: OscillatorType; from: number; to?: number; at?: number; dur: number; vol?: number };
type Hiss = { at?: number; dur: number; vol?: number; filter: BiquadFilterType; from: number; to?: number; q?: number };
type Playing = { track: BlastTrack; gain: GainNode; source: AudioBufferSourceNode | null };

const N = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093, E7: 2637 };

/**
 * The game's speaker. `make` builds the AudioContext (a test passes its own); `tracks` the music there are files for.
 * Every call is safe before `wake`, after `close` and in a browser without Web Audio: it does nothing.
 */
export class BlastAudio {
  private ctx: AudioContext | null = null;
  private effects: GainNode | null = null; private music: GainNode | null = null; private speech: GainNode | null = null;
  private speaking: AudioBufferSourceNode | null = null;
  private choice = storedSound();
  private log = new Map<string, number[]>();
  private noise: AudioBuffer | null = null;
  private hum: { osc: OscillatorNode; buzz: OscillatorNode; gain: GainNode } | null = null;
  private wanted: BlastTrack | null = null; private playing: Playing | null = null;
  private loads = new Map<string, Promise<AudioBuffer | null>>();
  private listen = (choice: SoundChoice) => this.set(choice);
  private closed = false;

  constructor(private make: () => AudioContext | null = defaultContext, private tracks: BlastTracks = blastTracks) { listeners.add(this.listen); }

  /** The player's press: the first one opens the speaker, and a speaker the browser put to sleep is woken. */
  wake() {
    if (this.closed) return;
    if (!this.ctx) {
      try { this.ctx = this.make(); } catch { this.ctx = null; }
      const a = this.ctx;
      if (!a) return;
      try {
        const squeeze = a.createDynamicsCompressor(); squeeze.threshold.value = -14; squeeze.ratio.value = 4; squeeze.connect(a.destination);
        this.effects = a.createGain(); this.effects.gain.value = this.choice.effects ? EFFECTS : 0; this.effects.connect(squeeze);
        this.music = a.createGain(); this.music.gain.value = this.choice.music ? MUSIC : 0; this.music.connect(squeeze);
        this.speech = a.createGain(); this.speech.gain.value = this.choice.voice ? SPEECH : 0; this.speech.connect(squeeze);
      } catch { this.ctx = null; return; }
      this.track(this.wanted, true);
    }
    const awake = this.ctx;
    if (awake?.state === 'suspended') void awake.resume().catch(() => {});
  }

  /** A choice made in the settings: what was turned off goes quiet at once. */
  set(choice: SoundChoice) {
    const was = this.choice; this.choice = choice;
    const a = this.ctx;
    if (!a) return;
    try {
      this.effects?.gain.setTargetAtTime(choice.effects ? EFFECTS : 0, a.currentTime, 0.03);
      this.music?.gain.cancelScheduledValues(a.currentTime);
      this.music?.gain.setTargetAtTime(choice.music ? MUSIC : 0, a.currentTime, 0.15);
      this.speech?.gain.setTargetAtTime(choice.voice ? SPEECH : 0, a.currentTime, 0.03);
    } catch {   }
    if (!choice.effects) this.charge(null);
    if (choice.music && !was.music) { const want = this.wanted; this.wanted = null; this.scene(want); }
  }

  hush(on: boolean) {
    const a = this.ctx;
    if (!a || this.closed) return;
    void (on ? a.suspend() : a.resume()).catch(() => {});
  }

  /** Plays one moment. `size` is 0 to 1: how hard the launch was, or how hard she landed. */
  cue(cue: BlastCue, size = 0.5, delay = 0) {
    const a = this.ctx;
    if (!a || !this.choice.effects || a.state === 'closed') return;
    const family = familyOf(cue), log = this.log.get(family) ?? [];
    this.log.set(family, log);
    if (!allowCue(log, (a.currentTime + delay) * 1000, cue)) return;
    try { this.voice(cue, a.currentTime + delay + 0.005, Math.max(0, Math.min(1, size))); } catch {   }
  }

  heard(events: readonly BlastEvent[]) {
    for (const event of events) {
      const cue = cueOf(event);
      if (cue) this.cue(cue, event.type === 'land' ? event.impact / 14 : 0.5);
      if (event.type === 'hit' && !event.hit.waived && this.choice.voice) for (const line of hitCopy({ ...event.hit, outcome: 'boost' }).lines) void this.line(line);
    }
  }

  /**
   * Speaks a line the screen is showing (named by its English text) over the music, which drops while it is spoken. A line
   * without a voice is only read. A new line cuts off the one before it, and one that arrives late is not spoken.
   */
  say(line: TextKey) {
    const a = this.ctx, asked = performance.now();
    if (!a || !this.speech || !this.choice.voice || this.closed) return;
    void this.line(line).then(buffer => {
      const now = this.ctx;
      if (!buffer || now !== a || !this.speech || !this.choice.voice || this.closed || performance.now() - asked > LATE_MS) return;
      try {
        this.speaking?.stop();
        const source = now.createBufferSource(); source.buffer = buffer; source.connect(this.speech); source.start();
        this.speaking = source;
        const music = this.music?.gain, t = now.currentTime;
        if (music && this.choice.music) {
          music.cancelScheduledValues(t); music.setTargetAtTime(MUSIC * UNDER, t, 0.05);
          music.setTargetAtTime(MUSIC, t + buffer.duration + 0.1, 0.25);
        }
      } catch {   }
    });
  }

  private line(line: TextKey) {
    const voice = blastVoices[line], spoken = voice ? tongueFor(voice, pageLanguage()) : null;
    return voice && spoken ? this.load(`voice/${voice.file}-${spoken}`, ['ogg', 'm4a']) : Promise.resolve(null);
  }

  /** While the player holds, a hum whose pitch rises with the pressure; `level` 0 to 1, or null when she has let go. */
  charge(level: number | null) {
    const a = this.ctx;
    if (!a || !this.effects) return;
    try {
      if (level === null || !this.choice.effects) {
        if (!this.hum) return;
        const { osc, buzz, gain } = this.hum; this.hum = null;
        gain.gain.cancelScheduledValues(a.currentTime); gain.gain.setTargetAtTime(0, a.currentTime, 0.02);
        osc.stop(a.currentTime + 0.12); buzz.stop(a.currentTime + 0.12);
        return;
      }
      if (!this.hum) {
        const osc = a.createOscillator(), buzz = a.createOscillator(), gain = a.createGain(), soft = a.createBiquadFilter();
        osc.type = 'triangle'; buzz.type = 'square'; soft.type = 'lowpass'; soft.frequency.value = 1800;
        gain.gain.setValueAtTime(0, a.currentTime); gain.gain.setTargetAtTime(0.09, a.currentTime, 0.03);
        const quiet = a.createGain(); quiet.gain.value = 0.18;
        osc.connect(gain); buzz.connect(quiet).connect(gain); gain.connect(soft).connect(this.effects);
        osc.start(); buzz.start();
        this.hum = { osc, buzz, gain };
      }
      const pitch = 220 * 2 ** (2 * Math.max(0, Math.min(1, level)));
      this.hum.osc.frequency.setTargetAtTime(pitch, a.currentTime, 0.02);
      this.hum.buzz.frequency.setTargetAtTime(pitch / 2 * (1 + 0.01 * Math.sin(a.currentTime * (8 + level * 20))), a.currentTime, 0.02);
    } catch { this.hum = null; }
  }

  receipt(lines: number, record: boolean) {
    for (let line = 0; line < Math.min(10, lines); line++) this.cue('print', 0.5, 0.52 + line * 0.075);
    this.track('receipt', false);
    if (record) this.cue('record', 1, 0.62 + Math.min(10, lines) * 0.075);
  }

  /** The music for what is on screen now: a looping track, or null for quiet. Moving to another fades across. */
  scene(track: BlastTrack | null) {
    if (track === this.wanted) return;
    this.wanted = track;
    this.track(track, true);
  }

  close() {
    this.closed = true; listeners.delete(this.listen);
    const a = this.ctx; this.ctx = null; this.hum = null; this.playing = null;
    if (a) void a.close().catch(() => {});
  }


  private track(track: BlastTrack | null, loop: boolean) {
    const a = this.ctx, out = this.music;
    if (!a || !out) return;
    try {
      if (loop) {
        const old = this.playing;
        if (old && old.track !== track) { this.playing = null; old.gain.gain.cancelScheduledValues(a.currentTime); old.gain.gain.setTargetAtTime(0, a.currentTime, FADE / 4); old.source?.stop(a.currentTime + FADE * 1.5); }
        else if (old) return;
      }
    } catch { this.playing = null; }
    if (!track || !this.choice.music || !this.tracks[track]) return;
    void this.load(track, this.tracks[track]!.formats).then(buffer => {
      const now = this.ctx;
      if (!buffer || !now || now !== a || (loop && this.wanted !== track) || this.closed) return;
      try {
        const source = now.createBufferSource(), gain = now.createGain(), file = this.tracks[track];
        source.buffer = buffer;
        if (loop) { source.loop = true; if (file?.loop) { source.loopStart = file.loop[0]; source.loopEnd = file.loop[1]; } }
        gain.gain.setValueAtTime(0, now.currentTime); gain.gain.linearRampToValueAtTime(1, now.currentTime + (loop ? FADE : 0.05));
        source.connect(gain).connect(out); source.start();
        if (loop) this.playing = { track, gain, source };
      } catch {   }
    });
  }

  private load(name: string, formats: readonly Format[]): Promise<AudioBuffer | null> {
    const known = this.loads.get(name);
    if (known) return known;
    const a = this.ctx, format = formats.find(canPlay);
    const loading = !a || !format ? Promise.resolve(null) : (async () => {
      try {
        const answer = await fetch(`/audio/blast/${name}.${format}`);
        if (!answer.ok) return null;
        return await a.decodeAudioData(await answer.arrayBuffer());
      } catch { return null; }
    })();
    this.loads.set(name, loading);
    return loading;
  }


  private tone(at: number, { type = 'triangle', from, to = from, at: after = 0, dur, vol = 0.2 }: Voice) {
    const a = this.ctx!, start = at + after, osc = a.createOscillator(), gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.008, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(this.effects!);
    osc.start(start); osc.stop(start + dur + 0.03);
  }

  private hiss(at: number, { at: after = 0, dur, vol = 0.2, filter, from, to = from, q = 1 }: Hiss) {
    const a = this.ctx!, start = at + after;
    if (!this.noise) {
      this.noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.6), a.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    }
    const source = a.createBufferSource(), shape = a.createBiquadFilter(), gain = a.createGain();
    source.buffer = this.noise; shape.type = filter; shape.Q.value = q;
    shape.frequency.setValueAtTime(from, start);
    if (to !== from) shape.frequency.exponentialRampToValueAtTime(to, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.01, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(shape).connect(gain).connect(this.effects!);
    source.start(start); source.stop(start + dur + 0.03);
  }

  private arp(at: number, notes: readonly number[], step: number, dur: number, vol: number, type: OscillatorType = 'triangle') {
    notes.forEach((note, index) => this.tone(at, { type, from: note, at: index * step, dur, vol }));
  }

  private voice(cue: BlastCue, at: number, size: number) {
    switch (cue) {
      case 'press':
        this.tone(at, { type: 'sine', from: 620, to: 900, dur: 0.05, vol: 0.14 }); return;
      case 'launch':
        this.tone(at, { type: 'square', from: 260, to: 110, dur: 0.12, vol: 0.12 });
        this.hiss(at, { dur: 0.32 + size * 0.2, vol: 0.12 + size * 0.16, filter: 'bandpass', from: 500, to: 3600, q: 0.8 });
        if (size >= 0.9) { this.tone(at, { type: 'sine', from: 120, to: 38, dur: 0.38, vol: 0.32 }); this.arp(at + 0.08, [N.G5, N.C6, N.E6], 0.035, 0.12, 0.08); }
        return;
      case 'one':
        this.arp(at, [N.C6, N.E6, N.G6, N.C7], 0.04, 0.11, 0.15);
        this.tone(at, { type: 'sine', from: N.E7, at: 0.17, dur: 0.22, vol: 0.07 });
        this.hiss(at, { dur: 0.06, vol: 0.08, filter: 'highpass', from: 5000 });
        return;
      case 'two':
        this.arp(at, [N.G5, N.C6], 0.06, 0.1, 0.16);
        this.hiss(at, { dur: 0.05, vol: 0.06, filter: 'lowpass', from: 1400 });
        return;
      case 'meh':
        this.tone(at, { type: 'sine', from: 300, to: 560, dur: 0.06, vol: 0.16 });
        this.tone(at, { type: 'sine', from: 560, to: 330, at: 0.06, dur: 0.16, vol: 0.13 });
        return;
      case 'bad':
        this.tone(at, { type: 'sawtooth', from: 330, to: 140, dur: 0.3, vol: 0.07 });
        this.tone(at, { type: 'square', from: 349, to: 148, dur: 0.3, vol: 0.05 });
        this.hiss(at, { dur: 0.08, vol: 0.1, filter: 'lowpass', from: 900 });
        return;
      case 'boost':
        this.tone(at, { type: 'square', from: 300, to: 1400, dur: 0.2, vol: 0.06 });
        this.hiss(at, { dur: 0.28, vol: 0.12, filter: 'highpass', from: 1200, to: 6000 });
        for (const note of [N.C6, N.E6, N.G6]) this.tone(at, { from: note, at: 0.17, dur: 0.3, vol: 0.09 });
        return;
      case 'combo':
        this.arp(at, [N.E6, N.G6, N.C7], 0.035, 0.09, 0.13);
        this.arp(at + 0.14, [N.G6, N.C7, N.E7], 0.035, 0.12, 0.12);
        this.tone(at, { type: 'sine', from: N.E7, at: 0.3, dur: 0.4, vol: 0.07 });
        return;
      case 'refill':
        this.tone(at, { type: 'sine', from: 280, to: 820, dur: 0.07, vol: 0.18 });
        this.tone(at, { type: 'sine', from: 380, to: 1100, at: 0.08, dur: 0.07, vol: 0.16 });
        return;
      case 'full':
        this.tone(at, { type: 'sine', from: N.G6, dur: 0.22, vol: 0.12 });
        this.tone(at, { type: 'sine', from: N.C7, at: 0.09, dur: 0.34, vol: 0.12 });
        this.tone(at, { type: 'triangle', from: N.C6, at: 0.09, dur: 0.3, vol: 0.05 });
        return;
      case 'dive':
        this.tone(at, { type: 'sine', from: 1500, to: 380, dur: 0.28, vol: 0.1 });
        this.hiss(at, { dur: 0.26, vol: 0.08, filter: 'bandpass', from: 2400, to: 600, q: 1.4 });
        return;
      case 'land':
        this.tone(at, { type: 'sine', from: 150, to: 48, dur: 0.18, vol: 0.12 + size * 0.24 });
        this.hiss(at, { dur: 0.1, vol: 0.05 + size * 0.1, filter: 'lowpass', from: 700 });
        return;
      case 'print':
        this.hiss(at, { dur: 0.022, vol: 0.12, filter: 'highpass', from: 3200 });
        this.tone(at, { type: 'square', from: 1800 + Math.random() * 300, dur: 0.014, vol: 0.03 });
        return;
      case 'record':
        this.arp(at, [N.C5, N.E5, N.G5], 0.09, 0.12, 0.12, 'square');
        for (const note of [N.C6, N.E6, N.G6]) this.tone(at, { from: note, at: 0.28, dur: 0.55, vol: 0.08 });
        this.tone(at, { type: 'sine', from: N.C7, at: 0.3, dur: 0.5, vol: 0.05 });
        return;
    }
  }
}

function defaultContext(): AudioContext | null {
  const Speaker = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Speaker ? new Speaker({ latencyHint: 'interactive' }) : null;
}

function canPlay(format: Format) {
  try { return typeof document !== 'undefined' && document.createElement('audio').canPlayType(mime[format]) !== ''; } catch { return false; }
}
