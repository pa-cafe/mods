// What the game needs from the page that carries it, and nothing else: the language to speak in, and where the
// pictures are served. The cafe installs it once before the game starts; a page that never does gets English and the
// cafe's own address for BARISTA BLAST!!'s pictures, which this game draws its people from.
import type { Locale } from '../../../locales.ts';

export interface HopHost {
  locale(): Locale;
  /** The address of one file of games/barista-blast/art. */
  art(file: string): string;
}

let host: HopHost = { locale: () => 'en', art: file => `/art/blast/${file}` };
export function installHopHost(next: Partial<HopHost>) { host = { ...host, ...next }; }
export const hopHost = () => host;
