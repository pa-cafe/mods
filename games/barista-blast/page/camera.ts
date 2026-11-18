/** The canvas in CSS pixels. */
export type Viewport = { width: number; height: number };
/** What the camera eases between frames. `offset` is metres from the barista to the point held at `anchor` (a share of the width). */
export type Camera = { scale: number; offset: number; anchor: number };
/** Where the world is on screen this frame: `left` is the world x at the screen's left edge, `ground` the screen y of the street. */
export type Lens = { scale: number; left: number; ground: number };

// The street sits low, with only a strip of road under it, and the zoom keeps the framing it had when the street sat higher.
const GROUND = 0.88, FRAME = 0.78;
const SKY = 22, ACROSS = 22;
const FAR = 1.3, CLIMB = [10, 30] as const;

function wanted(view: Viewport, aiming: boolean, height: number): Camera {
  if (aiming) return { scale: Math.min(view.height * FRAME / 7.5, view.width / 8.5), offset: -1.4, anchor: 0.55 };
  const climbed = Math.min(1, Math.max(0, (height - CLIMB[0]) / (CLIMB[1] - CLIMB[0]))), back = 1 + (FAR - 1) * climbed * climbed * (3 - 2 * climbed);
  return { scale: Math.min(view.height * FRAME / SKY, view.width / ACROSS) / back, offset: 0, anchor: 1 / 4 };
}

export const aimCamera = (view: Viewport): Camera => wanted(view, true, 0);

/** Eases toward the framing this moment wants: the pull back at launch, then the slow breathing with height. The barista's own x is never eased, so it stays put on screen at any speed. */
export function followCamera(camera: Camera, view: Viewport, aiming: boolean, seconds: number, height = 0): Camera {
  const target = wanted(view, aiming, height), ease = 1 - Math.exp(-seconds / 0.6);
  return {
    scale: camera.scale * (target.scale / camera.scale) ** ease,
    offset: camera.offset + (target.offset - camera.offset) * ease,
    anchor: camera.anchor + (target.anchor - camera.anchor) * ease,
  };
}

/** The street stays low on screen at any height, so what the barista will come down on is always in view. A barista who climbs out of the top is marked by the HUD. `x` is where the barista is along the street. */
export function lensOf(camera: Camera, view: Viewport, x: number): Lens {
  return { scale: camera.scale, left: x + camera.offset - camera.anchor * view.width / camera.scale, ground: view.height * GROUND };
}
