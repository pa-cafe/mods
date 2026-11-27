// What is behind the shaft. The climb goes up through BARISTA BLAST!!'s six places in the order a run there reaches
// them, painted with that game's own scenes: the Taipei street she leaves from, the roastery, the bay at night, orbit,
// the divine realm and the void. Each takeaway counter is the kerb of a street of its place, floating at that height.
import { atlasLook, drawStamp, hash, orbitProps, voidOf, type Stamp } from '../../barista-blast/page/art.ts';
import { cloudArt, farShape, ORBIT, paintBody, rowArt, scenes, type Scene } from '../../barista-blast/page/scenes.ts';
import { drawGiant } from '../../barista-blast/page/voidGiant.ts';
import type { HopLook } from '../rules.ts';

/** The height each of BARISTA BLAST!!'s scenes begins at, in its own order. A counter stands at every one. */
export const hopZones = [0, 100, 200, 400, 600, 800] as const;
export const zoneAt = (height: number) => hopZones.findLastIndex(from => height >= from);
/** One place gives way to the next over this many metres, centred on where the next begins. */
export const ZONE_BLEND = 16;
const VOID = scenes.length - 1;

/** What the scenery is painted on: a canvas `width` by `height` CSS pixels, `scale` pixels to the metre, with `floor` metres at its bottom edge. */
export type Backdrop = { width: number; height: number; scale: number; ratio: number; floor: number; now: number; look: HopLook };

export class Scenery {
  private shops = new Map<string, Stamp>();
  private clouds = scenes.map(scene => cloudArt(scene));
  private res = 0;

  /** True where the sky is dark enough that the shaft's own marks should be drawn light. */
  dark(height: number) { return scenes[zoneAt(height)].stars > 0.3; }

  /** The sky, and everything in it that is not a street. */
  sky(ctx: CanvasRenderingContext2D, view: Backdrop) {
    const middle = view.floor + view.height / view.scale / 2, to = zoneAt(middle + ZONE_BLEND / 2);
    const k = to === 0 ? 1 : Math.min(1, (middle + ZONE_BLEND / 2 - hopZones[to]) / ZONE_BLEND);
    if (k < 1) this.place(ctx, view, to - 1, 1);
    this.place(ctx, view, to, k);
  }

  private place(ctx: CanvasRenderingContext2D, view: Backdrop, index: number, alpha: number) {
    const { width, height, floor, scale } = view, scene = scenes[index], size = Math.min(width, height);
    ctx.save(); ctx.globalAlpha = alpha;
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    scene.sky.forEach((color, at) => wash.addColorStop(at / (scene.sky.length - 1), color));
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);

    // Everything in the sky slides down as she climbs, the far things slowest.
    const slid = (depth: number, span: number, at: number) => ((at * span + floor * scale * depth) % span + span) % span;
    if (scene.stars) {
      ctx.fillStyle = '#fff';
      for (let star = 0; star < 80; star++) {
        const z = hash(star, 31);
        ctx.globalAlpha = alpha * scene.stars * (0.35 + z * 0.6);
        ctx.fillRect(hash(star, 32) * width, slid(0.03 + z * 0.04, height, hash(star, 33)), z * 1.6 + 0.6, z * 1.6 + 0.6);
      }
      ctx.globalAlpha = alpha;
    }
    const bodyX = width * 0.76, bodyY = height * (0.16 + scene.bodyAt * 0.3) + (floor - hopZones[index]) * scale * 0.02;
    const glow = ctx.createRadialGradient(bodyX, bodyY, 0, bodyX, bodyY, size * 0.42);
    glow.addColorStop(0, scene.glow); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = alpha * 0.7; ctx.fillStyle = glow; ctx.fillRect(bodyX - size * 0.42, bodyY - size * 0.42, size * 0.84, size * 0.84);
    ctx.globalAlpha = alpha; paintBody(ctx, scene, bodyX, bodyY, size * 0.075);

    if (index === ORBIT) this.orbit(ctx, view, alpha);
    if (index === VOID) { const giant = voidOf(atlasLook[view.look]); if (giant) drawGiant(ctx, giant, width, height, view.now, false); }

    const clouds = this.clouds[index], span = height * 1.5;
    for (let cloud = 0; cloud < 7; cloud++) {
      const art = clouds[cloud % clouds.length], depth = 0.12 + hash(cloud, 41) * 0.3, k = (0.5 + depth * 2.2) * Math.max(0.6, size / 620);
      const drift = (hash(cloud, 42) * (width + 260) + view.now * 0.004 * (0.4 + depth)) % (width + 260) - 240;
      ctx.globalAlpha = alpha * (0.45 + hash(cloud, 43) * 0.4);
      ctx.drawImage(art, drift, slid(depth, span, hash(cloud, 44)) - height * 0.25, art.width * k, art.height * k);
    }
    ctx.restore();
  }

  /** Orbit's set dressing from BARISTA BLAST!!: a satellite, the roadster and a rocket, drifting by behind the shaft. */
  private orbit(ctx: CanvasRenderingContext2D, view: Backdrop, alpha: number) {
    const props = orbitProps();
    if (!props) return;
    const { width, height, floor, scale, now } = view;
    const things = [[props.satellite, 430, 0.2, 3.4, 0.05], [props.car, 485, 0.75, 3, -0.12], [props.rocket, 540, 0.3, 1.1, 0.3], [props.satellite, 575, 0.8, 2.6, -0.08]] as const;
    things.forEach(([image, at, across, wide, lean], index) => {
      // Half as fast as the shaft: far enough back to pass slowly, near enough to pass at all.
      const y = height * 0.5 - (at - floor - height / scale / 2) * scale * 0.5, w = wide * scale, h = w * image.naturalHeight / image.naturalWidth;
      if (y < -h || y > height + h) return;
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.translate(width * across + Math.sin(now / 2600 + index) * scale * 0.4, y); ctx.rotate(lean + Math.sin(now / 3100 + index * 2) * 0.05);
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  /** The street a counter at `y` metres is the kerb of: far roofs, a row of the place's shops, and the pavement they stand on. */
  street(ctx: CanvasRenderingContext2D, view: Backdrop, y: number) {
    const { width, height, scale, floor } = view, index = zoneAt(y + 1), scene = scenes[index];
    const base = height - (y - 0.55 - floor) * scale;
    if (base < -scale || base - 7 * scale > height) return;
    const res = Math.max(0.5, Math.round(scale * view.ratio / 80 * 4) / 4);
    if (res !== this.res) { this.shops.clear(); this.res = res; }

    this.far(ctx, scene, width, base - 0.2 * scale, scale * 0.8, y);
    const s = scale * 0.95, slot = 3.4, shift = hash(index, 60) * slot;
    for (let at = -1; (at * slot - shift) * s < width; at++) {
      const kind = Math.floor(hash(at + index * 37, 61) * scene.row.length), key = `${index}/${kind}`;
      let art = this.shops.get(key);
      if (!art) { art = rowArt(scene, kind, res); this.shops.set(key, art); }
      drawStamp(ctx, art, (at * slot - shift) * s, base, s);
    }

    const kerb = base + 0.45 * scale;
    ctx.fillStyle = scene.walk; ctx.fillRect(0, base, width, kerb - base);
    ctx.fillStyle = scene.walkEdge; ctx.fillRect(0, kerb, width, Math.max(4, scale * 0.12));
    if (y <= 0) {
      // The street she leaves from has a road, and nothing under it.
      ctx.fillStyle = scene.road; ctx.fillRect(0, kerb + Math.max(4, scale * 0.12), width, height);
      const lane = kerb + scale * 0.75, thick = Math.max(4, scale * 0.11);
      ctx.fillStyle = scene.lane; ctx.globalAlpha = 0.9;
      for (let x = 0.4 * scale; x < width; x += 1.9 * scale) ctx.fillRect(x, lane, 1.1 * scale, thick);
      ctx.globalAlpha = 1;
      return;
    }
    // A street in the sky rests on the place's own cloud.
    ctx.fillStyle = scene.floaters ? scene.walkEdge : scene.cloud; ctx.globalAlpha = 0.92;
    ctx.beginPath();
    for (let x = -scale; x < width + scale; x += scale * 1.5) { const puff = Math.floor(x / scale + y); ctx.ellipse(x + scale * 0.7, kerb + scale * 0.12, scale * (1 + hash(puff, 71) * 0.5), scale * (0.45 + hash(puff, 72) * 0.5), 0, 0, Math.PI); }
    ctx.fill(); ctx.globalAlpha = 1;
  }

  private far(ctx: CanvasRenderingContext2D, scene: Scene, width: number, base: number, s: number, salt: number) {
    const first = Math.floor(salt), last = first + Math.ceil(width / s / 1.5) + 2;
    ctx.save(); ctx.globalAlpha = scene.far.alpha; ctx.fillStyle = scene.far.color; ctx.beginPath();
    for (let at = first; at <= last; at++) farShape(ctx, scene.far.shape, at, ((at - first) * 1.5 - 1) * s, base, s * 1.6);
    ctx.fill(); ctx.restore();
    const lights = scene.far.lights;
    if (!lights) return;
    for (let at = first; at <= last; at++) for (let light = 0; light < 4; light++) {
      if (hash(at * 4 + light, 54) < 0.45) continue;
      ctx.fillStyle = lights[hash(at * 4 + light, 55) > 0.5 ? 0 : 1];
      ctx.fillRect(((at - first) * 1.5 - 1 + 0.15 + hash(at * 4 + light, 56) * 0.7) * s, base - (0.5 + hash(at * 4 + light, 57) * 2.4) * s, 0.1 * s, 0.12 * s);
    }
  }
}
