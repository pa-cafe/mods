// What a course pack is: the file a course author writes, and the checks the cafe runs on it before a barista can
// enrol. A pack is JSON that parses with `courseSchema` and comes back from `courseProblems` with nothing to fix.
// The cafe decides which evidence checks it can run and what a finished task earns; a pack cannot grant beans itself.

import { z } from 'zod';
import { locales, type Locale } from '../locales.ts';
import { residentTypes, type ResidentType } from '../resident-types.ts';

export type CourseText = { 'zh-TW': string } & Partial<Record<Exclude<Locale, 'zh-TW'>, string>>;
export type HandoutBlock =
  | { kind: 'h'; text: CourseText }
  | { kind: 'p'; text: CourseText }
  | { kind: 'list'; items: CourseText[] }
  | { kind: 'tip'; text: CourseText }
  | { kind: 'command'; text: CourseText }
  | { kind: 'image'; src: string; alt: CourseText; caption: CourseText }
  | { kind: 'video'; src: string; poster: string; caption: CourseText; captions: string }
  | { kind: 'link'; href: string; text: CourseText }
  | { kind: 'guide'; guides: ResidentGuide[] };
export interface GuideField { from: CourseText; to: CourseText; sample: string }
export interface GuideStep { title: CourseText; text: CourseText; template?: CourseText; fields?: GuideField[]; image?: { src: string; alt: CourseText } }
export interface ResidentGuide { id: string; types: ResidentType[]; label: CourseText; steps: GuideStep[] }
export interface PracticeQuestion { id: string; question: CourseText; options: { id: string; text: CourseText }[]; answer: string; explain: CourseText }
export type EvidenceCheck = 'owner-task-completed' | 'resident-joined' | 'wake-configured' | 'github-connected' | 'github-pr-opened' | 'github-pr-matches';
export interface CourseTask { id: string; cadence: 'daily' | 'weekly'; brief: CourseText; ownerHint: CourseText; check: EvidenceCheck }
export interface CourseUnit { id: string; week: number; title: CourseText; summary: CourseText; handout: HandoutBlock[]; practice: PracticeQuestion[]; task?: CourseTask }
export type CourseIcon = 'prompt' | 'tools' | 'wake' | 'keys' | 'terminal' | 'git';
export interface CourseIntro { cover: string; outcomes: { icon: CourseIcon; text: CourseText }[]; audience: CourseText[]; notFor: CourseText[] }
export interface Course {
  id: string; version: number; title: CourseText; summary: CourseText; intro: CourseIntro; languages: Locale[]; price: 'free'; units: CourseUnit[];
}

export const courseTextSchema = z.strictObject({ 'zh-TW': z.string(), 'zh-CN': z.string().optional(), ja: z.string().optional(), ko: z.string().optional(), en: z.string().optional() });
export const handoutBlockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('h'), text: courseTextSchema }),
  z.strictObject({ kind: z.literal('p'), text: courseTextSchema }),
  z.strictObject({ kind: z.literal('list'), items: z.array(courseTextSchema) }),
  z.strictObject({ kind: z.literal('tip'), text: courseTextSchema }),
  z.strictObject({ kind: z.literal('command'), text: courseTextSchema }),
  z.strictObject({ kind: z.literal('image'), src: z.string(), alt: courseTextSchema, caption: courseTextSchema }),
  z.strictObject({ kind: z.literal('video'), src: z.string(), poster: z.string(), caption: courseTextSchema, captions: z.string() }),
  z.strictObject({ kind: z.literal('link'), href: z.string(), text: courseTextSchema }),
  z.strictObject({ kind: z.literal('guide'), guides: z.array(z.strictObject({
    id: z.string(), types: z.array(z.enum(residentTypes)), label: courseTextSchema,
    steps: z.array(z.strictObject({
      title: courseTextSchema, text: courseTextSchema, template: courseTextSchema.optional(),
      fields: z.array(z.strictObject({ from: courseTextSchema, to: courseTextSchema, sample: z.string() })).optional(),
      image: z.strictObject({ src: z.string(), alt: courseTextSchema }).optional(),
    })),
  })) }),
]);
const evidenceChecks = ['owner-task-completed', 'resident-joined', 'wake-configured', 'github-connected', 'github-pr-opened', 'github-pr-matches'] as const satisfies readonly EvidenceCheck[];
const courseIcons = ['prompt', 'tools', 'wake', 'keys', 'terminal', 'git'] as const satisfies readonly CourseIcon[];
export const courseSchema = z.strictObject({
  id: z.string(), version: z.number().int().positive(), title: courseTextSchema, summary: courseTextSchema,
  languages: z.array(z.enum(locales)), price: z.literal('free'),
  intro: z.strictObject({ cover: z.string(), outcomes: z.array(z.strictObject({ icon: z.enum(courseIcons), text: courseTextSchema })), audience: z.array(courseTextSchema), notFor: z.array(courseTextSchema) }),
  units: z.array(z.strictObject({
    id: z.string(), week: z.number().int().positive(), title: courseTextSchema, summary: courseTextSchema, handout: z.array(handoutBlockSchema),
    practice: z.array(z.strictObject({ id: z.string(), question: courseTextSchema, options: z.array(z.strictObject({ id: z.string(), text: courseTextSchema })), answer: z.string(), explain: courseTextSchema })),
    task: z.strictObject({ id: z.string(), cadence: z.enum(['daily', 'weekly']), brief: courseTextSchema, ownerHint: courseTextSchema, check: z.enum(evidenceChecks) }).optional(),
  })),
});

export const parseCourse = (pack: unknown): Course => courseSchema.parse(pack);
export const courseText = (text: CourseText, locale: Locale) => text[locale] ?? text['zh-TW'];

export const courseSlug = z.string().regex(/^[a-z0-9-]{1,40}$/);

const localMedia = (problems: string[], label: string, path: string) => {
  if (!/^\/art\/courses\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(path)) problems.push(`${label} must be a local file under /art/courses/ without traversal`);
};
const meaningfulText = (problems: string[], label: string, text: CourseText) => {
  if (!text['zh-TW'].trim() || Object.values(text).some(value => !value.trim())) problems.push(`${label} must not be empty`);
};
export function handoutProblems(label: string, handout: readonly HandoutBlock[]): string[] {
  const problems: string[] = [];
  if (!handout.length) problems.push(`unit ${label} has no handout`);
  for (const [index, block] of handout.entries()) {
    const where = `${label}/handout ${index}`;
    if (block.kind === 'command') meaningfulText(problems, `${where} command`, block.text);
    if (block.kind === 'link') {
      if (!/^\/automation-templates\/[a-z0-9-]+\.(?:json|js|sh|txt)$/.test(block.href)) problems.push(`${where} href must be a template under /automation-templates/`);
      meaningfulText(problems, `${where} text`, block.text);
    }
    if (block.kind === 'image' || block.kind === 'video') {
      localMedia(problems, `${where} src`, block.src);
      meaningfulText(problems, `${where} caption`, block.caption);
      if (block.kind === 'image') meaningfulText(problems, `${where} alt`, block.alt);
      else { localMedia(problems, `${where} poster`, block.poster); localMedia(problems, `${where} captions`, block.captions); }
    }
    if (block.kind === 'guide') guideProblems(problems, where, block.guides);
  }
  return problems;
}
function guideProblems(problems: string[], where: string, guides: readonly ResidentGuide[]) {
  if (!guides.length) problems.push(`${where} has no guide`);
  const ids = new Set<string>(), covered = new Set<ResidentType>();
  for (const guide of guides) {
    const at = `${where} guide ${guide.id}`;
    if (ids.has(guide.id)) problems.push(`${at} repeats`); ids.add(guide.id);
    if (!/^[a-z0-9-]{1,40}$/.test(guide.id)) problems.push(`${at} is not a slug`);
    if (!guide.types.length) problems.push(`${at} names no resident type`);
    for (const type of guide.types) { if (covered.has(type)) problems.push(`${at} repeats resident type ${type}`); covered.add(type); }
    meaningfulText(problems, `${at} label`, guide.label);
    if (!guide.steps.length) problems.push(`${at} has no steps`);
    for (const [index, step] of guide.steps.entries()) {
      const place = `${at} step ${index + 1}`;
      meaningfulText(problems, `${place} title`, step.title); meaningfulText(problems, `${place} text`, step.text);
      if (step.template) meaningfulText(problems, `${place} template`, step.template);
      for (const field of step.fields ?? []) { meaningfulText(problems, `${place} field`, field.from); meaningfulText(problems, `${place} field`, field.to); }
      if (step.image) { localMedia(problems, `${place} image`, step.image.src); meaningfulText(problems, `${place} alt`, step.image.alt); }
    }
  }
}
export const handoutMedia = (handout: readonly HandoutBlock[]) => handout.flatMap(block => block.kind === 'image' ? [block.src] : block.kind === 'video' ? [block.src, block.poster, block.captions] : block.kind === 'link' ? [block.href] : block.kind === 'guide' ? block.guides.flatMap(guide => guide.steps.flatMap(step => step.image ? [step.image.src] : [])) : []);

export function courseProblems(course: Course): string[] {
  const problems: string[] = [];
  const unique = (label: string, ids: string[]) => { const seen = new Set<string>(); for (const id of ids) { if (seen.has(id)) problems.push(`${label} ${id} repeats`); seen.add(id); if (!courseSlug.safeParse(id).success) problems.push(`${label} ${id} is not a slug`); } };
  unique('unit', course.units.map(unit => unit.id));
  unique('task', course.units.flatMap(unit => unit.task ? [unit.task.id] : []));
  unique('outcome icon', course.intro.outcomes.map(outcome => outcome.icon));
  localMedia(problems, 'cover', course.intro.cover);
  if (!course.intro.outcomes.length || !course.intro.audience.length) problems.push('intro needs outcomes and an audience');
  for (const unit of course.units) {
    unique(`question in ${unit.id}`, unit.practice.map(question => question.id));
    problems.push(...handoutProblems(unit.id, unit.handout));
    for (const question of unit.practice) {
      unique(`option in ${unit.id}/${question.id}`, question.options.map(option => option.id));
      if (question.options.length < 2) problems.push(`${unit.id}/${question.id} needs two options`);
      if (!question.options.some(option => option.id === question.answer)) problems.push(`${unit.id}/${question.id} answer is not an option`);
    }
  }
  return problems;
}
