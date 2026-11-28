import js from '@eslint/js';
import ts from 'typescript-eslint';

const cafe = { regex: '^(\\.\\./)+(worker|shared|src|tests|scripts|companion)(/|$)', message: 'A mod may not import from the cafe.' };
const platform = ['fetch', 'WebSocket', 'XMLHttpRequest', 'setTimeout', 'setInterval', 'queueMicrotask', 'crypto', 'Date', 'process', 'caches', 'localStorage'];

/**
 * What keeps a mod separable from the cafe. `under` is where this repo sits in the linting project: '' when it is the
 * project, 'mods/' while the cafe carries it as a folder.
 */
export const boundaries = (under = '') => [
  { files: [`${under}**/*.ts`], ignores: [`${under}*.config.ts`, `${under}bin/**`, `${under}games/*/tools/**`, `${under}games/*/page/**`], rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!zod$|\\.{1,2}/)', message: 'A mod may import only zod and its own files.' }, cafe] }],
  } },
  // The local simulator and each game's tools run on Node; nothing in a game's rules imports them.
  { files: [`${under}bin/**/*.ts`, `${under}games/*/tools/**/*.ts`], rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!zod$|vitest$|node:|\\.{1,2}/)', message: 'The simulator may import only Node, zod and this repo.' }, cafe] }],
  } },
  // A game's page is its screen in the browser: it may draw with three and use the browser, and still imports nothing of
  // the cafe. What it needs from the page that carries it, it gets through its host (games/*/page/host.ts).
  { files: [`${under}games/*/page/**/*.ts`], rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!zod$|three$|three/addons/|vitest$|node:|\\.{1,2}/)', message: 'A game page may import only three, zod and this repo.' }, cafe] }],
  } },
  { files: [`${under}**/*.test.ts`], ignores: [`${under}bin/**`, `${under}games/*/tools/**`, `${under}games/*/page/**`], rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!zod$|vitest$|\\.{1,2}/)', message: 'A mod test may import only vitest, zod and the mod.' }, cafe] }],
  } },
  // A game gets its clock, randomness, storage and network from the cafe or not at all, so a match replays from its seed.
  { files: [`${under}games/**/*.ts`], ignores: [`${under}games/*/tools/**`, `${under}games/*/page/**`], rules: {
    'no-restricted-globals': ['error', ...platform.map((name) => ({ name, message: 'A game uses what the cafe passes in, not the platform.' }))],
    'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the rng the cafe passes in, so a match replays from its seed.' }],
  } },
];

export default ts.config(
  // The automation templates run inside Zapier, n8n and Apps Script, with those platforms' globals.
  { ignores: ['node_modules/**', 'recipes/automation/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { files: ['connectors/herdr/**/*.mjs', 'connectors/herdr-desktop/**/*.{js,mjs}'], languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', Response: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', Buffer: 'readonly', URL: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } } },
  ...boundaries(),
);
