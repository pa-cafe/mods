// What the game needs from the page that carries it, and nothing else: the language to speak in, and the cafe's
// furniture models for the street. The cafe installs it once before the game starts; a page that never does gets
// English and a street without furniture.
import type { Group } from 'three';
import type { Locale } from '../../../locales.ts';

/** Loads a furniture model by its id in the cafe's catalogue. Each load is a fresh copy the street may move and turn. */
export interface FurnitureModels { load(id: string): Promise<Group>; warm?(id: string): void; dispose(): void }
export interface BlastHost {
  locale(): Locale;
  furniture(): FurnitureModels;
}

const none: FurnitureModels = { load: () => Promise.reject(new Error('This page brings no furniture')), dispose() {} };
let host: BlastHost = { locale: () => 'en', furniture: () => none };
export function installBlastHost(next: BlastHost) { host = next; }
export const blastHost = () => host;
