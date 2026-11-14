import { describe, expect, it } from 'vitest';
import { courseProblems, courseSchema, courseText, handoutMedia, handoutProblems, parseCourse, type Course, type ResidentGuide } from './pack.ts';

const tw = (text: string) => ({ 'zh-TW': text });

/** The smallest pack a course author could publish. Each case below changes one thing about it. */
const pack = (): Course => ({
  id: 'first-cup',
  version: 1,
  title: tw('第一杯'),
  summary: tw('學會交代一件事。'),
  languages: ['zh-TW'],
  price: 'free',
  intro: { cover: '/art/courses/first-cup/cover.jpg', outcomes: [{ icon: 'prompt', text: tw('把事情交代清楚') }], audience: [tw('剛開店的咖啡師')], notFor: [] },
  units: [{
    id: 'brief', week: 1, title: tw('交代清楚'), summary: tw('目的、範圍、怎麼算完成。'),
    handout: [{ kind: 'p', text: tw('先說目的。') }],
    practice: [{ id: 'which', question: tw('哪一句最清楚？'), options: [{ id: 'vague', text: tw('幫我弄一下') }, { id: 'clear', text: tw('整理成五點') }], answer: 'clear', explain: tw('說得出怎麼算完成。') }],
    task: { id: 'first-brief', cadence: 'daily', brief: tw('派一件小事給住民。'), ownerHint: tw('寫清楚怎麼算完成。'), check: 'owner-task-completed' },
  }],
});
const changed = (change: (course: Course) => void) => { const course = pack(); change(course); return course; };

describe('a course pack file', () => {
  it('parses, and comes back with nothing to fix', () => {
    expect(parseCourse(JSON.parse(JSON.stringify(pack())))).toEqual(pack());
    expect(courseProblems(pack())).toEqual([]);
  });

  it.each<[string, (raw: Record<string, unknown>) => void]>([
    ['a field the format does not have', (raw) => { raw.reward = { beans: 500 }; }],
    ['a price', (raw) => { raw.price = 'paid'; }],
    ['a language the cafe does not ship', (raw) => { raw.languages = ['zh-TW', 'fr']; }],
    ['text without Traditional Chinese', (raw) => { raw.title = { en: 'First cup' }; }],
    ['a version that is not a positive whole number', (raw) => { raw.version = 0; }],
    ['an evidence check the format does not know', (raw) => { (raw.units as { task: { check: string } }[])[0].task.check = 'trust-me'; }],
    ['a guide for a kind of resident that does not exist', (raw) => { (raw.units as { handout: unknown[] }[])[0].handout = [{ kind: 'guide', guides: [{ id: 'g', types: ['robot'], label: tw('機器人'), steps: [] }] }]; }],
  ])('does not parse with %s', (_what, change) => {
    const raw = JSON.parse(JSON.stringify(pack()));
    change(raw);
    expect(courseSchema.safeParse(raw).success).toBe(false);
  });

  it.each<[string, (course: Course) => void, string]>([
    ['two units share an id', (c) => { c.units.push({ ...c.units[0], task: undefined }); }, 'unit brief repeats'],
    ['an id is not a slug', (c) => { c.units[0].id = 'Brief One'; }, 'unit Brief One is not a slug'],
    ['two tasks share an id', (c) => { c.units.push({ ...c.units[0], id: 'again' }); }, 'task first-brief repeats'],
    ['the cover is not a file under /art/courses/', (c) => { c.intro.cover = 'https://example.com/cover.jpg'; }, 'cover must be a local file under /art/courses/ without traversal'],
    ['the cover climbs out of its folder', (c) => { c.intro.cover = '/art/courses/../secrets.png'; }, 'cover must be a local file under /art/courses/ without traversal'],
    ['the intro has no audience', (c) => { c.intro.audience = []; }, 'intro needs outcomes and an audience'],
    ['a unit has no handout', (c) => { c.units[0].handout = []; }, 'unit brief has no handout'],
    ['a question has one option', (c) => { c.units[0].practice[0].options.pop(); }, 'brief/which needs two options'],
    ['the answer is not one of the options', (c) => { c.units[0].practice[0].answer = 'neither'; }, 'brief/which answer is not an option'],
    ['a link leaves the cafe', (c) => { c.units[0].handout = [{ kind: 'link', href: 'https://example.com/x.js', text: tw('範本') }]; }, 'brief/handout 0 href must be a template under /automation-templates/'],
    ['an image has no alt text', (c) => { c.units[0].handout = [{ kind: 'image', src: '/art/courses/first-cup/a.png', alt: tw(' '), caption: tw('圖') }]; }, 'brief/handout 0 alt must not be empty'],
  ])('names the problem when %s', (_what, change, problem) => {
    expect(courseProblems(changed(change))).toContain(problem);
  });

  it('accepts a link to an automation template the cafe serves', () => {
    expect(handoutProblems('brief', [{ kind: 'link', href: '/automation-templates/n8n-workflow.json', text: tw('n8n 範本') }])).toEqual([]);
  });

  it('checks a guide: one per kind of resident, each with steps', () => {
    const steps = [{ title: tw('第一步'), text: tw('打開設定。') }];
    const guide = (id: string, guideSteps = steps): ResidentGuide => ({ id, types: ['hermes'], label: tw('怎麼接'), steps: guideSteps });
    expect(handoutProblems('wake', [{ kind: 'guide', guides: [guide('hermes')] }])).toEqual([]);
    expect(handoutProblems('wake', [{ kind: 'guide', guides: [guide('hermes', [])] }])).toContain('wake/handout 0 guide hermes has no steps');
    expect(handoutProblems('wake', [{ kind: 'guide', guides: [guide('a'), guide('b')] }])).toContain('wake/handout 0 guide b repeats resident type hermes');
  });

  it('lists the media a handout needs, so the cafe can check the files exist', () => {
    expect(handoutMedia([
      { kind: 'p', text: tw('字') },
      { kind: 'image', src: '/art/courses/a.png', alt: tw('圖'), caption: tw('圖') },
      { kind: 'video', src: '/art/courses/v.mp4', poster: '/art/courses/v.jpg', caption: tw('片'), captions: '/art/courses/v.vtt' },
    ])).toEqual(['/art/courses/a.png', '/art/courses/v.mp4', '/art/courses/v.jpg', '/art/courses/v.vtt']);
  });

  it('shows text in the reader’s language, and in Traditional Chinese when it has no translation', () => {
    expect(courseText({ 'zh-TW': '第一杯', en: 'First cup' }, 'en')).toBe('First cup');
    expect(courseText({ 'zh-TW': '第一杯', en: 'First cup' }, 'ja')).toBe('第一杯');
  });
});
