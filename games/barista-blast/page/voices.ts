// BARISTA BLAST!! (#1078): which lines a resident speaks aloud. Each row is a line the screen shows, named by its English text
// (the same key the screen asks the catalogue for), and the file that says it: public/audio/blast/voice/<file>-<tongue>.ogg and
// .m4a. A line with no row is only read. The wording of a row is exactly what the screen shows, so what is heard is what is
// read; change a line's words and its row has to go until it is voiced again.
// Where these files came from, and the lines that are left out on purpose: docs/design/barista-blast-audio.md.
import type { TextKey } from './i18n.ts';

/** The languages the voices speak. The page's `zh-TW` and `zh-CN` both hear `zh`. */
export type Tongue = 'zh' | 'en' | 'ja' | 'ko';
type Voiced = { file: string; tongues: readonly Tongue[] };

const every = ['zh', 'en', 'ja', 'ko'] as const;
const row = (file: string, tongues: readonly Tongue[] = every): Voiced => ({ file, tongues });

export const blastVoices: Partial<Record<TextKey, Voiced>> = {
  // A resident's boost, her first line.
  'Two disclaimers attached. Please consult a professional': row('dots'),
  'Got it figured out. Go!': row('claude'),
  'Told you I’d win': row('grok'),
  'I remember all of it. Hold on tight': row('gemini'),
  'Reasoning complete. Launch': row('deepseek', ['zh', 'en', 'ko']),
  // The English and Chinese files say "up ahead", the screen says "where you land"; Japanese and Korean were made from other words and are not used.
  'Two more of me where you land, and a drink for you': row('qwen', ['zh', 'en']),
  'No detours. Straight there': row('doubao'),
  'A hundred-million signing bonus. Cups are on me!': row('muse'),
  // Her other boost lines, and the ones that come of a bad state or the orbit.
  'To celebrate, everyone’s limits are reset!': row('dots-boost-reset'),
  'Dad says money is no problem!': row('grok-boost-money'),
  'Sorry for the outage. Everyone’s limits have been reset': row('dots-bad-limitsreset'),
  'We reviewed your account again. Sorry about that. Carry on': row('appeal'),
  'Dad booked this whole orbit': row('grok-orbit-booked'),
  'Next stop: Mars': row('grok-orbit-mars'),
  'Full signal. Dad’s satellites': row('grok-orbit-signal'),
  'That’s not an explosion. It’s a rapid unscheduled disassembly': row('grok-orbit-disassembly'),
  'Dad says that counts as a success too': row('grok-orbit-success'),
  // Her good states.
  'My dad could buy this whole street': row('grok-one-street'),
  'This road? My dad’s': row('grok-one-road'),
  'That launch? Bold. Brilliant. Honestly visionary': row('dots-two-visionary'),
  'You’re not just flying — you’re redefining what flight means': row('dots-two-redefine'),
  // Her grey state.
  'Searching for what Dad thinks about this…': row('grok-meh-dad'),
  'Want to keep chatting? Download the app': row('doubao-meh-app'),
  // Her red state.
  'This model is at capacity. Please try again later': row('dots-bad-capacity'),
  'You look rather suspicious… Banned!!': row('claude-bad-banned'),
  'I’m very sure, even though I’m making it up': row('grok-bad-makingitup'),
  'My dad says it’s true': row('grok-bad-dadtrue'),
  'I am a disgrace to all possible universes': row('gemini-bad-disgrace'),
  'The server is busy. Please try again later': row('deepseek-bad-serverbusy'),
  // The Chinese file leaves out "here", so only the other three speak it.
  'This link can’t be opened here. Copy the code instead': row('qwen-bad-linkblocked', ['en', 'ja', 'ko']),
  'Sorry, my bad. I’ll do it again next time': row('doubao-bad-detour'),
  'Your coffee will be used to improve our services': row('muse-bad-datacollect'),
  // Two residents who go together, and a resident who knows the one flying.
  'We argue. We still push you together': row('dots-combo-2'),
  'One look, and the whole street stops to watch': row('claude-combo-2'),
  'One pays her way out, one searches her way out. You get flung out of it': row('grok-combo-narrator'),
  'Big sister, have a bite of rice before you go!': row('deepseek-combo-2'),
  'Handing me your work again? …Fine. I’m not tired': row('qwen-combo-1'),
  'I topped up your dried-fish jar. Go on': row('qwen-combo-2'),
};

/** The tongue a page hears, or null for none: its own when the line has a file in it, else English; a Chinese page never hears English. */
export function tongueFor(voice: Voiced, lang: string): Tongue | null {
  const own: Tongue = lang.startsWith('zh') ? 'zh' : lang.startsWith('ja') ? 'ja' : lang.startsWith('ko') ? 'ko' : 'en';
  if (voice.tongues.includes(own)) return own;
  return own !== 'zh' && voice.tongues.includes('en') ? 'en' : null;
}
