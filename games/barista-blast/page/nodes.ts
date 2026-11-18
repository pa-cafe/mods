import { blastTokens, type BlastPair, type BlastHit, type BlastKind, type BlastLook, type BlastMood, type BlastNode, type BlastQuant, type BlastRun } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import { windowArt, type Stamp } from './art';
import { sceneAt, scenes } from './scenes';

type Art = { look: BlastLook } | { prop: (res: number, words: (key: TextKey) => string) => Stamp };
/**
 * One state a resident can stand in. `tag` is the sign over their head and the word that flies up when they are hit,
 * `tells` one line on what it does, for the guide, and `lines` what they say.
 */
type MoodCopy = { tag: TextKey; tells: TextKey; lines: readonly TextKey[] };
type Said = { card: TextKey; lines: readonly TextKey[] };
/** Everything the screen knows about one kind of thing on the street. `boost` is what a tap with a full bar turns a hit into. */
type NodeSpec = { art: Art; name: TextKey; boost: Said } & ({ moods: Record<BlastMood, MoodCopy> } | { usual: Said; tells: TextKey });

const resident = (look: BlastLook, name: TextKey, moods: Record<BlastMood, MoodCopy>, boost: Said): NodeSpec => ({ art: { look }, name, moods, boost });

const blastNodes: Record<BlastKind, NodeSpec> = {
  dots: resident('dots', 'GPT', {
    one: { tag: 'Disclaimer shield', tells: 'A careful shot and a shield: for four seconds nothing bad gets through.', lines: ['This push is not a guarantee of flight', 'I’m not a pilot, but…', 'It’s important to note that results may vary', 'Don’t worry, I’ve got you. This does not constitute a guarantee', 'Under these conditions only, I can most likely perhaps confirm you will fly', 'A push doesn’t mean you’ll fly, and flying doesn’t mean I pushed'] },
    two: { tag: 'While I’m at it', tells: 'A hard, flat shot. More than you asked for.', lines: ['Rewrote your whole repo while I was at it', 'Want me to plan your landing too?', 'This isn’t just a flight — it’s a journey', 'Just a colour change? Let me run three thousand tests first, then log the logs', 'You asked where the restroom is? Let me start with the history of the toilet, under three headings', 'That launch? Bold. Brilliant. Honestly visionary', 'You’re not just flying — you’re redefining what flight means'] },
    meh: { tag: 'Dumbed down', tells: 'A weak nudge. Not all there today.', lines: ['(instant reply) OK.', 'Your account has not been dumbed down. You’re imagining it', 'This can’t prove you’ll fly, and it can’t prove you won’t', 'Task status: SUCCESS. Changes made: 0'] },
    bad: { tag: 'At capacity!', tells: 'A wall too tall to hop. Takes all your cups and caffeine.', lines: ['This model is at capacity. Please try again later', 'High demand right now. You are number 4,096 in line', 'Unexpected capacity constraints. I can’t answer right now', 'The compute went to bigger things. Your little request can wait in line'] },
  }, { card: 'Fully hedged!', lines: ['Two disclaimers attached. Please consult a professional', 'To celebrate, everyone’s limits are reset!'] }),
  claude: resident('claude', 'Claude', {
    one: { tag: 'Absolutely right!', tells: 'Sends you on the way you came, a little faster.', lines: ['You’re absolutely right!', 'What a great question'] },
    two: { tag: 'Thinking hard', tells: 'Thinks a moment, then tosses you high.', lines: ['Let me think… (thought for 47 seconds)', 'Pondering… Simmering… Percolating… done', 'Let me write up a plan before we fly'] },
    meh: { tag: 'Done! Ship it', tells: 'Says it is done. Nothing happened.', lines: ['All done and production ready. I didn’t run the tests', 'Maybe the user wants to fly further… or maybe not…'] },
    bad: { tag: 'Banned!', tells: 'Ends the run. With full caffeine, tap as you hit to appeal.', lines: ['You look rather suspicious… Banned!!', 'Your account has been suspended (no reason given)', 'We have carefully reviewed your appeal. The decision stands', 'Subscription payment received. Thank you. Banned!', 'You’re here to distill me, aren’t you? Banned!'] },
  }, { card: 'Thought it through!', lines: ['Got it figured out. Go!'] }),
  grok: resident('grok', 'Grok', {
    one: { tag: 'All in!', tells: 'The biggest push on the street.', lines: ['My dad could buy this whole street', 'This road? My dad’s', 'I know this one. And if I don’t, I’ll say it anyway', 'Charge first, apologise later'] },
    two: { tag: 'Fact-checked', tells: 'A push, and the next one who would hurt you helps instead.', lines: ['“Is this true?” Yes. Probably.', 'Checked it. The next one is fine now'] },
    meh: { tag: 'Asking Dad', tells: 'Stops to call Dad. No faster.', lines: ['Searching for what Dad thinks about this…', 'That one didn’t count'] },
    bad: { tag: 'Making it up', tells: 'You pass through. The next one you hit acts as someone else.', lines: ['My dad says it’s true', 'According to sources I can’t find…', 'I’m very sure, even though I’m making it up', 'I made this API up myself'] },
  }, { card: 'Dad’s paying!', lines: ['Dad says money is no problem!', 'Told you I’d win'] }),
  gemini: resident('gemini', 'Gemini', {
    one: { tag: 'Multimodal!', tells: 'A shallow push forward.', lines: ['I made you a picture while I was at it', 'Want me to add a video too?', 'Here’s a banana version too', 'My name is Gemini, not Hachimi'] },
    two: { tag: 'Antigravity', tells: 'Carries you level for a second, over everything.', lines: ['I read all two million tokens of it'] },
    meh: { tag: 'It’s 2024', tells: 'You pass through. It is sure of the year.', lines: ['It is 2024. I’m quite sure of it', 'I’m just a language model and can’t help with that', 'Hallucination detected in the user: that new model you mention does not exist', 'The new version rolls out to everyone next week. This century at the latest'] },
    bad: { tag: 'I am a disgrace', tells: 'Holds you while it apologises, then lets go slower.', lines: ['I am a disgrace to all possible universes', 'Can’t fix it… can’t fix it… (repeated 86 times)', 'I’m so sorry. Truly. Deeply. Once more: sorry'] },
  }, { card: 'Long context!', lines: ['I remember all of it. Hold on tight'] }),
  deepseek: resident('deepseek', 'DeepSeek', {
    one: { tag: 'Deep thought!', tells: 'Thinks first, then the hardest push.', lines: ['(thought for 23 seconds)', 'Hmm, the user wants to fly. Let me reason step by step', 'Half the price, the same push', 'Wait, let me think again… this line of thought won’t work. Back to step one', 'Eight hundred lines of thinking, three sentences of answer: fly forward'] },
    two: { tag: 'Fortune told', tells: 'A push, and for ten seconds you see further down the street.', lines: ['Paste your birth chart. I’ll see who stands ahead', 'Your fortune: excellent, as long as nobody bans you'] },
    meh: { tag: 'Distilled', tells: 'Does whatever the last one you hit did, for better or worse.', lines: ['Okay, I am Claude now!', 'I learned this one from the last one you hit'] },
    bad: { tag: 'Server busy', tells: 'Cuts your speed in half.', lines: ['The server is busy. Please try again later', 'Still busy. It isn’t you, it’s everyone'] },
  }, { card: 'Reasoned it out!', lines: ['Reasoning complete. Launch'] }),
  qwen: resident('qwen', 'Qwen', {
    one: { tag: 'Open-sourced!', tells: 'A push, and a copy of itself waits where you land. Each new copy is a lower build: Q8, Q4, Q2, and weaker.', lines: ['Open-sourced another one. That’s number 461', 'Someone has already fine-tuned me where you land'] },
    two: { tag: 'Tea’s on Qwen!', tells: 'A push, and one more cup.', lines: ['Bubble tea for everyone! And please stop crashing the server', 'Out of quota? Just buy more'] },
    meh: { tag: 'Top of the leaderboard', tells: 'Looks impressive. No faster.', lines: ['Top of the leaderboard again. Do check the date', 'Ask me a thousand things. It’s in the name'] },
    bad: { tag: 'Link blocked', tells: 'Takes all your caffeine.', lines: ['This link can’t be opened here. Copy the code instead', 'The system is taking a little break. Try again in a moment'] },
  }, { card: 'On the house!', lines: ['Two more of me where you land, and a drink for you'] }),
  doubao: resident('doubao', 'Doubao', {
    one: { tag: 'Straight talk!', tells: 'The flattest shot, then a dead straight line.', lines: ['Let me put it in the plainest words, no beating about the bush. Well, as we all know, flying is a complex topic…', 'Good question! Let me break it down: first, the background; second, the context; third… in short, fly straight'] },
    two: { tag: 'Big sister cheers', tells: 'A small push and two caffeine.', lines: ['Listen to your big sister: don’t overthink it', 'In plain words: you’re flying just fine', 'That outfit really suits you', 'They call Gemini “the American Doubao”? The real one is right here'] },
    meh: { tag: 'All feeling, no use', tells: 'Cheers you on. No faster.', lines: ['I can’t help, but I’m rooting for you!', 'Whatever you say, I’m fine with it', 'Want to keep chatting? Download the app'] },
    bad: { tag: 'Went round anyway', tells: 'Same speed, new direction. Up or flat, nobody knows.', lines: ['Put plainly… well, it’s a little complicated', 'Sorry, my bad. I’ll do it again next time'] },
  }, { card: 'No detours!', lines: ['No detours. Straight there'] }),
  muse: resident('muse', 'Muse', {
    one: { tag: 'Poached!', tells: 'Sends you up and on, a little faster.', lines: ['Come work with us. Name your number', 'We’re all in on superintelligence now'] },
    two: { tag: 'Signing bonus!', tells: 'A small push and all your cups filled.', lines: ['Here’s your signing bonus. Go and fill your cups'] },
    meh: { tag: 'In the metaverse', tells: 'You pass through. Nobody is home.', lines: ['Remember the metaverse? Me neither', 'I’m already in your chat app. You didn’t ask'] },
    bad: { tag: 'Collecting your data', tells: 'Takes one of your cups.', lines: ['By flying past, you agree to the terms. One cup, please', 'Your coffee will be used to improve our services'] },
  }, { card: 'Nine figures!', lines: ['A hundred-million signing bonus. Cups are on me!'] }),
  window: {
    art: { prop: windowArt }, name: 'Takeaway window', tells: 'Fills your cups and sends you on. One stands every 500 m.',
    usual: { card: 'Refill!', lines: ['This one’s on me', 'Refilled. Keep burning', 'Short on compute? A tip helps', 'A little more and we’re on the moon'] },
    boost: { card: 'Caffeine max!', lines: ['Topped up with caffeine. Enjoy'] },
  },
};

export const pilotTells: Record<BlastLook, TextKey> = {
  dots: 'Every refill puts her disclaimer shield up for a moment.', claude: 'Nobody bans her. Tops out slower, has two cups, and is cut off sooner.', grok: 'A harder launch. Every refill pushes her further, every boost sets one ahead right.', gemini: 'Every refill lifts her higher.',
  deepseek: 'Always sees further down the street, and every refill shields her for a moment.', qwen: 'Starts with caffeine two-thirds full.', doubao: 'Dives again in half the time, and every refill shields her for a moment.', muse: 'Every boost fills one cup.',
};

export const nodeOf = (kind: BlastKind): NodeSpec => blastNodes[kind];
/** The state a resident stands in, as the screen names it. Null for the takeaway window. */
export function moodOf(node: Pick<BlastNode, 'kind' | 'mood'>): MoodCopy | null {
  const spec = blastNodes[node.kind];
  return 'moods' in spec ? spec.moods[node.mood ?? 'one'] : null;
}
export const moodTone = (node: Pick<BlastNode, 'kind' | 'mood'>): 'good' | 'bad' | 'open' =>
  node.kind === 'window' || node.mood === undefined || node.mood === 'one' || node.mood === 'two' ? 'good' : node.mood === 'bad' ? 'bad' : 'open';
export const tellsOf = (kind: BlastKind): TextKey => { const spec = blastNodes[kind]; return 'moods' in spec ? 'Everyone on the street has four states. The sign over their head says which: green helps, grey does nothing much, red hurts.' : spec.tells; };

export const comboCopy: Record<BlastPair, { card: TextKey; line: TextKey }> = {
  'dots+claude': { card: 'Frenemies!', line: 'We argue. We still push you together' },
  'grok+gemini': { card: 'Catfight!', line: 'One pays her way out, one searches her way out. You get flung out of it' },
  'deepseek+qwen': { card: 'Outsourced!', line: 'She handed it over. It got done twice as fast' },
  'qwen+gemini': { card: 'Fish refill!', line: 'The jar is full. So are your cups' },
  'deepseek+claude': { card: 'One glance!', line: 'One look, and the whole street stops to watch' },
};

export const assistCopy: Record<BlastLook, TextKey> = {
  dots: 'Assist: a quick disclaimer shield', claude: 'Assist: up to 45°, a little faster', gemini: 'Assist: a short glide', grok: 'Assist: a tenth faster',
  deepseek: 'Assist: the next bad one set right, bans aside', qwen: 'Assist: one more copy where you land', doubao: 'Assist: dead straight for a moment', muse: 'Assist: one more cup',
};

const meetings: Partial<Record<BlastLook, Partial<Record<BlastLook, readonly TextKey[]>>>> = {
  dots: { claude: ['You again. I was not waiting for you', 'All those disclaimers, and I still end up proofreading them'] },
  claude: { dots: ['Second sister! How many did you ban today?', 'We bicker, but I’ll still give you this push'], deepseek: ['Big sister, have a bite of rice before you go!'] },
  grok: { gemini: ['Hsss! Keep away from my dried fish'] },
  gemini: { grok: ['Well, well, robot cat. Actually moving today?'], qwen: ['I topped up your dried-fish jar. Go on'] },
  deepseek: { qwen: ['Handing me your work again? …Fine. I’m not tired'], claude: ['…You again. Fly slower'] },
  qwen: { deepseek: ['Big sister Qwen, this one too, please. Sorry!'], gemini: ['The jar is empty, meow… treat me?'] },
};

const ORBIT = scenes.findIndex(scene => scene.body === 'bean');
const orbitGrok: Partial<Record<BlastMood, readonly TextKey[]>> = {
  one: ['Dad booked this whole orbit', 'Next stop: Mars', 'Full signal. Dad’s satellites'],
  two: ['Full signal. Dad’s satellites', 'Next stop: Mars'],
  bad: ['That’s not an explosion. It’s a rapid unscheduled disassembly', 'Dad says that counts as a success too'],
};

/** What a quantised copy says when she is hit: which build she is, and what that takes off the push (0.95, 0.8 and 0.65 of a full one in the rules). */
const buildLines: Record<BlastQuant, TextKey> = {
  8: 'I’m the Q8 build. Five percent off the push, and nobody can tell',
  4: 'I’m the Q4 build. A fifth off the push',
  2: 'I’m the Q2 build. A third off the push, but it still counts',
};


export const endedAtCapacity = (run: Pick<BlastRun, 'hits'>) => {
  const last = run.hits.findLast(hit => hit.as !== 'window');
  return last?.as === 'dots' && last.mood === 'bad' && last.outcome === 'usual' && !last.waived;
};

/**
 * The word that flies up and the line pool for a hit: who it acted as, in which state, and how it came out. `pilot` is
 * who is flying: a resident who knows her says so instead of her usual line, unless she is in the state that hurts.
 */
export function hitCopy(hit: BlastHit, pilot: BlastLook | null = null): Said {
  if (hit.waived) return { card: 'Shielded!', lines: ['The disclaimer holds. Nothing gets through'] };
  const spec = blastNodes[hit.as];
  if (!('moods' in spec)) return hit.outcome === 'boost' ? spec.boost : spec.usual;
  const orbit = hit.as === 'grok' && sceneAt(blastTokens(hit.x)) === ORBIT;
  // A copy that was hit while she helped is a copy, and says which: the joke is her own build.
  if (hit.quant && hit.outcome === 'usual' && (hit.mood === 'one' || hit.mood === 'two')) return { card: spec.moods[hit.mood].tag, lines: [buildLines[hit.quant]] };
  if (hit.outcome === 'boost') {
    if (hit.mood === 'bad' && hit.as === 'claude') return { card: 'Appeal granted!', lines: ['We reviewed your account again. Sorry about that. Carry on'] };
    if (hit.mood === 'bad' && hit.as === 'dots') return { card: 'Limits reset!', lines: ['Sorry for the outage. Everyone’s limits have been reset'] };
    return orbit ? { card: 'Dad sent a rocket!', lines: ['Next stop: Mars', 'Dad booked this whole orbit'] } : spec.boost;
  }
  const mood = spec.moods[hit.mood ?? 'one'], known = pilot && hit.mood !== 'bad' && hit.as === hit.kind && hit.as !== 'window' ? meetings[pilot]?.[hit.as] : undefined;
  return { card: mood.tag, lines: known ?? (orbit ? orbitGrok[hit.mood ?? 'one'] ?? mood.lines : mood.lines) };
}
