// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlastHit } from '../rules.ts';
import { allowCue, BlastAudio, chooseSound, cueOf, sceneTrack, storedSound, type BlastCue, type BlastTracks } from './sound';
import { hitCopy } from './nodes';
import { blastVoices, tongueFor, type Tongue } from './voices';
import type { TextKey } from './i18n.ts';
/** The file behind an address the cafe serves this game's audio at, /audio/blast/…. */
const served = (address: string) => `${import.meta.dirname}/../audio/${address.replace(/^\/audio\/blast\//, '')}`;

type Made = { kind: string; started: number };
function speaker() {
  const made: Made[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (kind: string) => {
    const one = { kind, gain: param(), frequency: param(), Q: param(), threshold: param(), ratio: param(), type: '', buffer: null as unknown, loop: false, loopStart: 0, loopEnd: 0,
      connect: (next: unknown) => next, start: () => { made.push({ kind, started: context.currentTime }); }, stop() {} };
    return one;
  };
  const context = {
    state: 'running' as AudioContextState, currentTime: 0, sampleRate: 8000, destination: node('out'),
    createGain: () => node('gain'), createOscillator: () => node('osc'), createBiquadFilter: () => node('filter'), createBufferSource: () => node('buffer'), createDynamicsCompressor: () => node('squeeze'),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    decodeAudioData: vi.fn(async () => { throw new Error('not audio'); }),
    resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), close: vi.fn(async () => { context.state = 'closed'; }),
  };
  return { made, context, make: vi.fn(() => context as unknown as AudioContext) };
}
const hit = (more: Partial<BlastHit>): BlastHit => ({ step: 1, x: 10, kind: 'claude', as: 'claude', outcome: 'usual', ...more });

beforeEach(() => { chooseSound({ effects: true, music: true, voice: true }); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('the choice of what to hear', () => {
  it('is on for all three until the player turns one off, and the browser remembers it', () => {
    expect(storedSound()).toEqual({ effects: true, music: true, voice: true });
    chooseSound({ effects: false, music: true, voice: false });
    expect(JSON.parse(localStorage.getItem('pa-cafe-blast-sound')!)).toEqual({ effects: false, music: true, voice: false });
    expect(storedSound()).toEqual({ effects: false, music: true, voice: false });
    localStorage.setItem('pa-cafe-blast-sound', JSON.stringify({ effects: true, music: false }));
    expect(storedSound()).toEqual({ effects: true, music: false, voice: true });
    localStorage.setItem('pa-cafe-blast-sound', 'not json');
    expect(storedSound()).toEqual({ effects: true, music: true, voice: true });
  });

  it('still holds for the visit where the browser’s storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    });
    expect(() => chooseSound({ effects: true, music: false, voice: true })).not.toThrow();
    expect(storedSound()).toEqual({ effects: true, music: false, voice: true });
  });

  it.each([null, JSON.stringify({ effects: true, music: true, voice: true })])('keeps all three muted when only writes fail, with stored value %s', saved => {
    if (saved !== null) localStorage.setItem('pa-cafe-blast-sound', saved);
    vi.stubGlobal('localStorage', {
      getItem: localStorage.getItem.bind(localStorage),
      setItem() { throw new DOMException('Full', 'QuotaExceededError'); },
    });
    const muted = { effects: false, music: false, voice: false };
    chooseSound(muted);
    expect(localStorage.getItem('pa-cafe-blast-sound')).toBe(saved);
    expect(storedSound()).toEqual(muted);
    // Later choices on this visit still replace the failed write, including voices independently.
    chooseSound({ effects: false, music: true, voice: false });
    expect(storedSound()).toEqual({ effects: false, music: true, voice: false });
  });

  it('resumes persistence after writes recover and reads newer stored preferences normally', async () => {
    const storage = localStorage;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem() { throw new DOMException('Full', 'QuotaExceededError'); },
    });
    chooseSound({ effects: false, music: false, voice: false });
    expect(storedSound()).toEqual({ effects: false, music: false, voice: false });
    vi.unstubAllGlobals();
    const next = { effects: true, music: false, voice: false };
    chooseSound(next);
    expect(JSON.parse(localStorage.getItem('pa-cafe-blast-sound')!)).toEqual(next);
    expect(storedSound()).toEqual(next);
    // A fresh module represents the next visit, with no memory of this one's choices.
    vi.resetModules();
    expect((await import('./sound')).storedSound()).toEqual(next);
    const elsewhere = { effects: false, music: true, voice: true };
    localStorage.setItem('pa-cafe-blast-sound', JSON.stringify(elsewhere));
    expect(storedSound()).toEqual(elsewhere);
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); } });
    expect(storedSound()).toEqual(next);
  });
});

describe('the cues', () => {
  it('each resident’s mood has its own sound, a combo its own, and a hit waiting on a tap sounds when the wait runs out', () => {
    expect((['one', 'two', 'meh', 'bad'] as const).map(mood => cueOf({ type: 'hit', hit: hit({ mood }), from: 1, to: 2 }))).toEqual(['one', 'two', 'meh', 'bad']);
    expect(cueOf({ type: 'hit', hit: hit({ mood: 'one', combo: 'claude+gpt' as never }), from: 1, to: 2 })).toBe('combo');
    expect(cueOf({ type: 'hit', hit: hit({ mood: 'bad', waived: true }), from: 1, to: 2 })).toBe('meh');
    expect(cueOf({ type: 'hit', hit: hit({ mood: 'one' }), from: 1, to: 2, held: true })).toBeNull();
    expect(cueOf({ type: 'lapsed', hit: hit({ mood: 'two' }), from: 1, to: 2 })).toBe('two');
    expect(cueOf({ type: 'boost', hit: hit({}) })).toBe('boost');
    expect(cueOf({ type: 'land', x: 3, impact: 1 })).toBeNull();
    expect(cueOf({ type: 'land', x: 3, impact: 9 })).toBe('land');
  });

  it('a burst of hits plays only a few at once, and the next ones play once the burst has passed', () => {
    const log: number[] = [];
    const heard = [0, 10, 20, 30, 40, 50].map(at => allowCue(log, at, 'one'));
    expect(heard).toEqual([true, true, true, false, false, false]);
    expect(allowCue(log, 500, 'bad')).toBe(true);
  });

  it('the flight’s music follows the scenes: Taipei, Hsinchu, SF, orbit, the temple keeps orbit and the void is quiet', () => {
    expect([0, 1, 2, 3, 4, 5].map(sceneTrack)).toEqual(['taipei', 'hsinchu', 'sf', 'orbit', 'orbit', null]);
  });
});

describe('the speaker', () => {
  it('makes no sound and opens nothing until the first press', () => {
    const { make, made } = speaker(), audio = new BlastAudio(make, {});
    audio.cue('launch'); audio.charge(0.5); audio.scene('theme');
    expect(make).not.toHaveBeenCalled();
    expect(made).toEqual([]);
    audio.wake();
    expect(make).toHaveBeenCalledTimes(1);
    audio.wake();
    expect(make).toHaveBeenCalledTimes(1);
    audio.close();
  });

  it('plays every cue without a fault, and plays none with the effects turned off', () => {
    const { make, made, context } = speaker(), audio = new BlastAudio(make, {});
    audio.wake();
    const cues: BlastCue[] = ['press', 'launch', 'one', 'two', 'meh', 'bad', 'boost', 'combo', 'refill', 'full', 'dive', 'land', 'print', 'record'];
    for (const cue of cues) { context.currentTime += 1; expect(() => audio.cue(cue, 1)).not.toThrow(); }
    expect(made.length).toBeGreaterThan(cues.length);
    audio.charge(0.2); audio.charge(0.9); audio.charge(null);
    audio.receipt(7, true);
    chooseSound({ effects: false, music: true, voice: true });
    const before = made.length;
    context.currentTime += 5; audio.cue('one');
    expect(made.length).toBe(before);
    audio.close();
    expect(context.close).toHaveBeenCalled();
  });

  it('plays the music that is in audio/, each loop inside its padded file, and each file small enough', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation(type => type.includes('opus') ? 'probably' : '');
    const fetching = vi.fn(async (url: string) => new Response(readFileSync(served(url))));
    vi.stubGlobal('fetch', fetching);
    const { make, context } = speaker();
    const sources: { loop: boolean; loopStart: number; loopEnd: number }[] = [];
    const makeSource = context.createBufferSource;
    context.createBufferSource = () => { const one = makeSource(); sources.push(one); return one; };
    context.decodeAudioData = vi.fn(async () => ({}) as never);
    const audio = new BlastAudio(make);
    audio.wake();
    for (const track of ['theme', 'taipei', 'hsinchu', 'sf', 'orbit'] as const) {
      audio.scene(track);
      await vi.waitFor(() => expect(sources.at(-1)?.loop).toBe(true));
      const { loopStart, loopEnd } = sources.at(-1)!;
      expect(loopStart).toBe(0.1);
      expect(loopEnd).toBeGreaterThan(25);
    }
    expect(fetching.mock.calls.map(call => call[0])).toEqual(['theme', 'taipei', 'hsinchu', 'sf', 'orbit'].map(track => `/audio/blast/${track}.ogg`));
    for (const track of ['theme', 'taipei', 'hsinchu', 'sf', 'orbit', 'receipt']) for (const format of ['ogg', 'm4a']) {
      expect(statSync(`${import.meta.dirname}/../audio/${track}.${format}`).size, `${track}.${format}`).toBeLessThanOrEqual(300_000);
    }
    audio.close();
  });

  it('with no music files it stays quiet, asks for nothing and throws nothing', async () => {
    const fetching = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetching);
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const { make } = speaker(), audio = new BlastAudio(make, {});
    audio.wake();
    for (const track of ['theme', 'taipei', 'hsinchu', 'sf', 'orbit', null] as const) audio.scene(track);
    audio.receipt(4, false);
    await vi.waitFor(() => Promise.resolve());
    expect(fetching).not.toHaveBeenCalled();
    audio.close();
  });

  it('a track listed but missing, or not audio, is silence too', async () => {
    const answers = [new Response(null, { status: 404 }), new Response('<html>'), Promise.reject(new Error('offline'))];
    const fetching = vi.fn(async () => answers.shift()!);
    vi.stubGlobal('fetch', fetching);
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const tracks: BlastTracks = { theme: { formats: ['ogg'] }, taipei: { formats: ['m4a'] }, receipt: { formats: ['ogg', 'm4a'] } };
    const { make, context } = speaker(), audio = new BlastAudio(make, tracks);
    const failed = vi.fn();
    window.addEventListener('unhandledrejection', failed);
    audio.scene('theme');
    audio.wake();
    audio.scene('taipei');
    audio.receipt(3, false);
    await vi.waitFor(() => expect(fetching).toHaveBeenCalledTimes(3));
    await new Promise(done => setTimeout(done, 0));
    expect(fetching.mock.calls.map(call => (call as unknown[])[0])).toEqual(['/audio/blast/theme.ogg', '/audio/blast/taipei.m4a', '/audio/blast/receipt.ogg']);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', failed);
    audio.close();
  });
});

const voiced = (more: Partial<BlastHit>) => hitCopy(hit(more)).lines.filter(line => blastVoices[line]);
const url = (file: string, spoken: Tongue) => `/audio/blast/voice/${file}-${spoken}.ogg`;
/** A speaker whose every fetch is answered with a real file, and which says which lines it started. */
function speaking() {
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation(type => type.includes('opus') ? 'probably' : '');
  const fetching = vi.fn(async (address: string) => new Response(readFileSync(served(address))));
  vi.stubGlobal('fetch', fetching);
  const { make, context } = speaker();
  const started: string[] = [], stopped: string[] = [];
  let heard = 0;
  context.decodeAudioData = vi.fn(async () => ({ duration: 2, id: `line ${++heard}` }) as never);
  const makeSource = context.createBufferSource;
  context.createBufferSource = () => {
    const one = makeSource();
    const name = () => (one.buffer as { id?: string } | null)?.id ?? '';
    one.start = () => { if (name()) started.push(name()); };
    one.stop = () => { if (name()) stopped.push(name()); };
    return one;
  };
  const audio = new BlastAudio(make, {});
  audio.wake();
  return { audio, fetching, started, stopped };
}
const asked = (fetching: ReturnType<typeof speaking>['fetching']) => fetching.mock.calls.map(call => call[0]);

describe('the residents’ voices', () => {
  it('each line the screen can show a resident saying has one voice, and every file it names is there', () => {
    expect(voiced({ as: 'grok', kind: 'grok', mood: 'one' })).toEqual(['My dad could buy this whole street', 'This road? My dad’s']);
    expect(hitCopy(hit({ as: 'window', kind: 'window' })).lines.filter(line => blastVoices[line])).toEqual([]);
    const files = new Set<string>();
    for (const [line, voice] of Object.entries(blastVoices)) {
      expect(voice!.tongues.length, line).toBeGreaterThan(0);
      for (const spoken of voice!.tongues) for (const format of ['ogg', 'm4a']) {
        files.add(`${voice!.file}-${spoken}.${format}`);
        expect(statSync(`${import.meta.dirname}/../audio/voice/${voice!.file}-${spoken}.${format}`).size, `${voice!.file}-${spoken}.${format}`).toBeGreaterThan(1000);
      }
    }
    expect(readdirSync(`${import.meta.dirname}/../audio/voice/`).filter(name => !files.has(name))).toEqual([]);
  });

  it('a page hears its own language when the line has it, English when it does not, and a Chinese page never hears English', () => {
    const line = blastVoices['Reasoning complete. Launch']!, only = blastVoices['This link can’t be opened here. Copy the code instead']!;
    expect(['zh-TW', 'zh-CN', 'ja', 'ko', 'en', 'fr'].map(lang => tongueFor(line, lang))).toEqual(['zh', 'zh', 'en', 'ko', 'en', 'en']);
    expect(['zh-TW', 'zh-CN', 'ja', 'ko', 'en', 'fr'].map(lang => tongueFor(only, lang))).toEqual([null, null, 'ja', 'ko', 'en', 'en']);
  });

  it('a Japanese page speaks the Japanese file and a Korean page the Korean one', async () => {
    const { audio, fetching, started } = speaking();
    document.documentElement.lang = 'ja';
    audio.say('Dad says money is no problem!');
    await vi.waitFor(() => expect(started).toHaveLength(1));
    document.documentElement.lang = 'ko';
    audio.say('Dad says money is no problem!');
    await vi.waitFor(() => expect(started).toHaveLength(2));
    document.documentElement.lang = 'ja';
    audio.say('Reasoning complete. Launch');
    await vi.waitFor(() => expect(started).toHaveLength(3));
    expect(asked(fetching)).toEqual([url('grok-boost-money', 'ja'), url('grok-boost-money', 'ko'), url('deepseek', 'en')]);
    audio.close();
  });

  it('a hit fetches the boost lines she may speak in the page’s tongue, before the tap that would say one', async () => {
    const { audio, fetching, started } = speaking();
    document.documentElement.lang = 'zh-TW';
    audio.heard([{ type: 'hit', hit: hit({ kind: 'dots', as: 'dots', mood: 'one' }), from: 1, to: 2 }]);
    audio.heard([{ type: 'hit', hit: hit({ kind: 'claude', as: 'claude', mood: 'bad' }), from: 1, to: 2 }]);
    audio.heard([{ type: 'hit', hit: hit({ kind: 'muse', as: 'muse', mood: 'one', waived: true }), from: 1, to: 2 }]);
    await vi.waitFor(() => expect(asked(fetching)).toHaveLength(3));
    expect(asked(fetching)).toEqual([url('dots', 'zh'), url('dots-boost-reset', 'zh'), url('appeal', 'zh')]);
    expect(started).toEqual([]);
    audio.say('To celebrate, everyone’s limits are reset!');
    await vi.waitFor(() => expect(started).toHaveLength(1));
    expect(asked(fetching)).toHaveLength(3);
    audio.close();
  });

  it('each kind of line is requested when the screen shows it: good, grey, red, orbit, combo and boost', async () => {
    const { audio, fetching, started } = speaking();
    document.documentElement.lang = 'en';
    const moments: [TextKey, string][] = [
      ['That launch? Bold. Brilliant. Honestly visionary', 'dots-two-visionary'],
      ['My dad could buy this whole street', 'grok-one-street'],
      ['Want to keep chatting? Download the app', 'doubao-meh-app'],
      ['Searching for what Dad thinks about this…', 'grok-meh-dad'],
      ['This model is at capacity. Please try again later', 'dots-bad-capacity'],
      ['You look rather suspicious… Banned!!', 'claude-bad-banned'],
      ['My dad says it’s true', 'grok-bad-dadtrue'],
      ['Next stop: Mars', 'grok-orbit-mars'],
      ['Dad says that counts as a success too', 'grok-orbit-success'],
      ['One pays her way out, one searches her way out. You get flung out of it', 'grok-combo-narrator'],
      ['I topped up your dried-fish jar. Go on', 'qwen-combo-2'],
      ['Sorry for the outage. Everyone’s limits have been reset', 'dots-bad-limitsreset'],
      ['Dad says money is no problem!', 'grok-boost-money'],
    ];
    for (const [line] of moments) { audio.say(line); await vi.waitFor(() => expect(started).toHaveLength(moments.findIndex(each => each[0] === line) + 1)); }
    expect(asked(fetching)).toEqual(moments.map(([, file]) => url(file, 'en')));
    audio.say('A line nobody voiced' as TextKey);
    audio.say('Topped up with caffeine. Enjoy');
    await new Promise(done => setTimeout(done, 0));
    expect(started).toHaveLength(moments.length);
    expect(fetching).toHaveBeenCalledTimes(moments.length);
    audio.close();
  });

  it('a new line cuts off the one before it', async () => {
    const { audio, started, stopped } = speaking();
    document.documentElement.lang = 'en';
    audio.say('Next stop: Mars');
    await vi.waitFor(() => expect(started).toHaveLength(1));
    audio.say('This road? My dad’s');
    await vi.waitFor(() => expect(started).toHaveLength(2));
    expect(stopped).toEqual(['line 1']);
    audio.close();
  });

  it('a line that comes in more than 0.9 seconds late is not spoken', async () => {
    const { audio, fetching, started } = speaking();
    document.documentElement.lang = 'en';
    let release = () => {};
    fetching.mockImplementationOnce(async address => { await new Promise<void>(done => { release = done; }); return new Response(readFileSync(served(address))); });
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    audio.say('Next stop: Mars');
    now.mockReturnValue(2000);
    release();
    await new Promise(done => setTimeout(done, 10));
    expect(started).toEqual([]);
    now.mockReturnValue(2100);
    audio.say('This road? My dad’s');
    await vi.waitFor(() => expect(started).toHaveLength(1));
    audio.close();
  });

  it('music turned off while a line plays stays off after the line ends', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(8))));
    const { make, context } = speaker();
    context.decodeAudioData = vi.fn(async () => ({ duration: 2 }) as never);
    const plans: { at: number; to: number }[][] = [];
    const makeGain = context.createGain;
    context.createGain = () => {
      const one = makeGain(), plan: { at: number; to: number }[] = [];
      plans.push(plan);
      one.gain.setTargetAtTime = ((to: number, at: number) => { plan.push({ at, to }); }) as never;
      one.gain.cancelScheduledValues = ((at: number) => { plan.splice(0, plan.length, ...plan.filter(step => step.at < at)); }) as never;
      return one;
    };
    const audio = new BlastAudio(make, {});
    audio.wake();
    const music = plans[1];
    audio.say('Next stop: Mars');
    await vi.waitFor(() => expect(music.some(step => step.at > 0)).toBe(true));
    audio.set({ effects: true, music: false, voice: true });
    expect(music.at(-1)?.to).toBe(0);
    expect(music.filter(step => step.at > context.currentTime)).toEqual([]);
    audio.close();
  });

  it('says nothing with the voices turned off', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const fetching = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetching);
    chooseSound({ effects: true, music: true, voice: false });
    const { make } = speaker(), audio = new BlastAudio(make, {});
    audio.wake();
    audio.heard([{ type: 'hit', hit: hit({ kind: 'qwen', as: 'qwen', mood: 'one' }), from: 1, to: 2 }]);
    audio.say('Next stop: Mars');
    await new Promise(done => setTimeout(done, 0));
    expect(fetching).not.toHaveBeenCalled();
    audio.close();
  });
});
