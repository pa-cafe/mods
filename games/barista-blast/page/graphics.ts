export const blastGraphicsModes = ['auto', 'sharp', 'saver'] as const;
export type BlastGraphics = typeof blastGraphicsModes[number];
const GRAPHICS = 'pa-cafe-blast-graphics';
export const storedGraphics = (): BlastGraphics => {
  let mode: string | null = null;
  try { mode = localStorage.getItem(GRAPHICS); } catch {   }
  return blastGraphicsModes.find(known => known === mode) ?? 'auto';
};
export function storeGraphics(mode: BlastGraphics) { try { localStorage.setItem(GRAPHICS, mode); } catch {   } }
/** True where the street stays flat: the player chose the saver, the browser has no WebGL2, or the address asks for 2D. */
export const flatStreet = () => storedGraphics() === 'saver' || !('WebGL2RenderingContext' in window) || new URLSearchParams(location.search).has('2d');
