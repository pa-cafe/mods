import type { BlastLook } from '../rules.ts';
import type { BlastFigure, BlastStageCafe } from './contract.ts';
import { atlasLook, type AtlasLook } from './art';

/**
 * Who is on screen in one cafe's game (v3 §2.0): the cafe's barista flies and the player works the machine. Every kind
 * of resident stands along every street; `cast` is the cafe's own residents, who play their own kind under their own
 * names. `names` follows `cast`; a null name is a cafe that hides names, shown as the kind's own.
 */
export type BlastStage = {
  cast: readonly BlastLook[]; names: readonly (string | null)[]; flyer: AtlasLook; flyerName: string | null; operator: AtlasLook;
  /** The barista's own full-body picture and portrait, where uploaded. Residents always wear their kind's built-in look. */
  flyerArt: string | null; operatorArt: string | null; flyerFace: string | null;
};

const intern = (flyer: AtlasLook): AtlasLook => flyer === 'deepseek' ? 'dots' : 'deepseek';

/** `own` is the player's own barista, when they are a friend of this cafe's owner. A kind nobody in the cafe is, and every kind when there is no cafe, is played by its own character. */
export function stageOf(cafe: BlastStageCafe | null, own: BlastFigure | null): BlastStage {
  const flyer = atlasLook[cafe?.barista.look ?? 'dots'], residents = cafe?.residents ?? [];
  return {
    cast: residents.map(resident => resident.look), names: residents.map(resident => resident.name),
    flyer, flyerName: cafe?.barista.name ?? null, operator: own ? atlasLook[own.look] : intern(flyer),
    flyerArt: cafe?.barista.art ?? null, operatorArt: own?.art ?? null, flyerFace: cafe?.barista.face ?? null,
  };
}
