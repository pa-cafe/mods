


import * as THREE from 'three';
import { blastHost } from './host.ts';
import { blastTokens } from '../rules.ts';
import { hash } from './art';
import type { Lens } from './camera';
import { ORBIT, paintBody, sceneAt, scenes } from './scenes';
import { Build, Kit, loadMarks, meshes, type Part } from './street3d-kit';
import { voidCup } from './street3d-blank';
import { StreetModels } from './street3d-models';
import { Machine, type MachineState } from './street3d-machine';
import { buildProp, propKey, type StreetProp } from './street3d-props';
import { GAG_DEPTH, OrbitGags } from './street3d-gags';
import { FACE, FAR_TILE, groundMarks, pieces, SIGHT_MARGIN, sightOn, skyline, skylines, TILE, type Tint } from './street3d-sets';

const FOV = 22, SKY = -520, CLOUD_TILE = 30;

const PROP = 1.7;

function metresAt(tokens: number) { let low = 0, high = 20_000; while (high - low > 0.5) { const middle = (low + high) / 2; if (blastTokens(middle) < tokens) low = middle; else high = middle; } return high; }

const sights = scenes.map((scene, place) => {
  const next = scenes[place + 1], spots = new Map<number, number>(), count = skylines[place].sights.length;
  const from = metresAt(scene.from), length = next ? metresAt(next.from) - from : 2000;
  for (let i = 0; i < count; i++) spots.set(Math.floor((from + (i + 0.3) * length / count) / FAR_TILE), i);
  return spots;
});

function floater(b: Build, kind: number, color: string) {
  const look = { rough: 0.35, glow: 0.15 };
  if (kind === 0) b.box(color, 3, 3, 3, 0, -1.5, 0, look);
  else if (kind === 1) { b.tube(color, 2, 2.4, 0, 0, 0, { ...look, top: 0, sides: 4 }); b.tube(color, 2, 2.4, 0, -2.4, 0, { ...look, top: 0, sides: 4, turn: [180, 0, 0] }); }
  else if (kind === 2 || kind === 4) voidCup(b, 3.6, 0, 0, 0, color, look);
  else if (kind === 3) b.ring(color, 2.2, 0.8, 0, 0, 0, look);
}
const rad = (degrees: number) => degrees * Math.PI / 180;
const mod = (value: number, by: number) => (value % by + by) % by;

const moods = [
  { sun: '#FFE9C8', power: 2.45, fill: 1.75, glow: 0.2, angle: [-6, 9, 8] },
  { sun: '#FFE0B9', power: 2.55, fill: 1.85, glow: 0.4, angle: [-10, 6, 7] },
  { sun: '#CFCCFF', power: 1.65, fill: 1.55, glow: 1.15, angle: [-4, 10, 6] },
  { sun: '#FFF0E0', power: 2.15, fill: 1.85, glow: 1, angle: [-6, 12, 8] },
  { sun: '#FFF6D8', power: 2.45, fill: 1.85, glow: 0.8, angle: [-4, 14, 8] },
  { sun: '#FFFFFF', power: 2.1, fill: 2.05, glow: 0.4, angle: [-4, 10, 6] },
] as const;
/** What the game's canvas saw this frame: its lens, the place the run is in, and the slanted edge (in pixels, at the top and bottom of the screen) while the next place sweeps in from the right. */
/** A camera swung off the street's straight-on view, for a still picture: round `target` by `yaw` and `pitch` degrees, with `target` drawn at `at` (pixels). */
type Angle = { target: THREE.Vector3; yaw: number; pitch: number; at: { x: number; y: number } };
/** `disassembly` is the words that float up when orbit's rocket comes apart, in the page's language. */
export type StreetView = { lens: Lens; from: number; to: number; wipe: { top: number; bottom: number } | null; machine: MachineState; props: StreetProp[]; disassembly: string };

function skyTexture(colors: readonly string[]) {
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d')!, fill = ctx.createLinearGradient(0, 0, 0, 256);
  colors.forEach((color, at) => fill.addColorStop(at / (colors.length - 1) * 0.8, color));
  ctx.fillStyle = fill; ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function bodyTexture(place: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, halo = ctx.createRadialGradient(128, 128, 0, 128, 128, 128), scene = scenes[place];
  halo.addColorStop(0, `${scene.glow}cc`); halo.addColorStop(0.35, `${scene.glow}40`); halo.addColorStop(1, `${scene.glow}00`);
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 256, 256);
  paintBody(ctx, scene, 128, 128, 24);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


class World {
  scene = new THREE.Scene();
  sun = new THREE.DirectionalLight('#fff', 2);
  fog = new THREE.Fog('#fff', 30, 150);
  ground = new THREE.Group();

  backdrop = new THREE.Group();
  sky: THREE.Mesh; body: THREE.Mesh;
  rows = new Map<number, THREE.Group>(); far = new Map<number, THREE.Group>(); clouds = new Map<number, THREE.Group>();
  private owned: { dispose(): void }[] = [];

  constructor(readonly place: number, slab: (color: string, w: number, h: number, d: number, y: number, z: number) => THREE.Mesh, pane: THREE.BufferGeometry) {
    const scene = scenes[place], mood = moods[place];

    const fill = new THREE.HemisphereLight(new THREE.Color(scene.sky[1]).lerp(new THREE.Color('#fff'), 0.6), scene.walk, mood.fill);
    this.sun.color.set(mood.sun); this.sun.intensity = mood.power;
    this.sun.castShadow = true; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 26, bottom: -6, near: 1, far: 90 });
    this.fog.color.set(scene.sky[2]); this.scene.fog = this.fog;
    this.ground.add(slab(scene.walk, 500, 0.3, -FACE + 8, -0.3, (FACE - 8) / 2 - 0.6), slab(scene.walkEdge, 500, 0.24, 0.3, -0.34, -0.6), slab(scene.road, 500, 0.3, 60, -0.48, 29.4), slab(scene.far.color, 500, 0.3, 120, -0.5, FACE - 68));
    const own = <T extends { dispose(): void }>(item: T) => { this.owned.push(item); return item; };
    const flat = (map: THREE.Texture, see = false) => own(new THREE.MeshBasicMaterial({ map: own(map), fog: false, depthWrite: false, transparent: see }));
    this.sky = new THREE.Mesh(pane, flat(skyTexture(scene.sky))); this.sky.position.z = SKY; this.sky.renderOrder = -3;
    this.body = new THREE.Mesh(pane, flat(bodyTexture(place), true)); this.body.position.z = SKY + 20; this.body.renderOrder = -1;
    this.backdrop.add(this.sky, this.body);
    if (scene.stars) {
      const points = new Float32Array(120 * 3), half = -SKY * Math.tan(rad(FOV / 2));
      for (let i = 0; i < 120; i++) points.set([(hash(i, 32) - 0.5) * half * 6, (hash(i, 33) * 1.7 - 0.7) * half, SKY + 10], i * 3);
      const stars = new THREE.Points(own(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3))), own(new THREE.PointsMaterial({ color: '#fff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: scene.stars, fog: false, depthWrite: false })));
      stars.renderOrder = -2; this.backdrop.add(stars);
    }
    this.scene.add(this.sun, this.sun.target, fill, this.ground, this.backdrop);
  }


  keep(layer: Map<number, THREE.Group>, first: number, last: number, make: (index: number) => THREE.Group) {
    for (const [index, group] of layer) if (index < first || index > last) { this.scene.remove(group); layer.delete(index); }
    for (let index = first; index <= last; index++) if (!layer.has(index)) { const group = make(index); layer.set(index, group); this.scene.add(group); }
  }

  dispose() { for (const item of this.owned) item.dispose(); }
}

export class Street3d {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 900);
  private pool = blastHost().furniture();
  private kit = new Kit();
  private models = new StreetModels(this.kit);
  private machine = new Machine(this.kit);
  private made = new Map<string, Part[]>();
  private gags = new OrbitGags((key, make) => this.parts(key, false, make));

  private props = new THREE.Group();
  private spare = new Map<string, THREE.Group[]>();
  private worlds: (World | undefined)[] = [];
  private box = new THREE.BoxGeometry(1, 1, 1);
  private pane = new THREE.PlaneGeometry(1, 1);
  private plain = new Map<string, THREE.Material>();
  private view = { width: 1, height: 1, ratio: 1 };
  private edge = new THREE.Plane();

  private level = matchMedia('(pointer: coarse)').matches ? 1 : 0;

  private sharp = false;
  private pace = { last: 0, slow: 0, frames: 0 };

  /**
   * The street where a run stopped, as a still picture: the place it reached, framed on that place's landmark nearest
   * the stop, so the landmark fills `frame` (in pixels of the picture). Built on a canvas of its own and let go after.
   */
  static async postcard(x: number, width: number, height: number, frame: { left: number; top: number; right: number; bottom: number }) {
    const gl = document.createElement('canvas'); gl.width = width; gl.height = height;
    const street = await Street3d.open(gl);
    try {
      street.level = 0; street.resize(width, height, 1);
      const tokens = blastTokens(x), place = Math.max(0, sceneAt(tokens));

      await street.models.warm(place);
      const spots = [...sights[place]].map(([stretch, which]) => ({ at: stretch * FAR_TILE, which })), passed = spots.filter(spot => spot.at <= x);
      const spot = passed.length ? passed[passed.length - 1] : spots[0];
      const kit = new THREE.Box3(), half = 2 * Math.tan(rad(FOV / 2)), whole = height / half;
      if (spot) { const build = new Build(street.kit); sightOn(build, place, spot.which); const group = meshes(build.done()); group.position.x = spot.at; kit.setFromObject(group); group.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); }); }
      else kit.set(new THREE.Vector3(x, 0, -66), new THREE.Vector3(x + 20, 30, -66));
      const size = kit.getSize(new THREE.Vector3()), middle = kit.getCenter(new THREE.Vector3()), depth = Math.max(0, -middle.z);

      const far = Math.min((frame.right - frame.left) / Math.max(1, size.x), (frame.bottom - frame.top) / Math.max(1, size.y), whole / (depth + 10));
      const scale = whole / (whole / far - depth);
      const across = middle.x - ((frame.left + frame.right) / 2 - width / 2) / far, up = middle.y - (height / 2 - (frame.top + frame.bottom) / 2) / far;
      const view: StreetView = { lens: { scale, left: across - width / (2 * scale), ground: up * scale + height / 2 }, from: place, to: place, wipe: null, machine: { power: 0, shake: 0 }, props: [], disassembly: '' };


      const angle: Angle = { target: middle, yaw: 16, pitch: 9, at: { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 } };
      street.draw(view, angle);
      await new Promise(done => setTimeout(done, 900));
      street.draw(view, angle);
      const picture = document.createElement('canvas'); picture.width = width; picture.height = height;
      picture.getContext('2d')!.drawImage(gl, 0, 0);
      return picture;
    } finally { street.dispose(); street.renderer.forceContextLoss(); }
  }

  /** Loads the cafe's marks for the signs, then stands the street up. Throws where there is no WebGL. */
  static async open(canvas: HTMLCanvasElement, sharp = false) { await loadMarks(); const street = new Street3d(canvas); street.hold(sharp); return street; }

  /** Holds the street at everything on, or lets it step down again when the device falls behind. */
  hold(sharp: boolean) {
    this.sharp = sharp;
    if (sharp && this.level !== 0) { this.level = 0; this.resize(this.view.width, this.view.height, this.view.ratio); }
    this.pace.frames = this.pace.slow = 0;
  }


  private calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
  }

  resize(width: number, height: number, ratio: number) {
    this.view = { width, height, ratio };
    this.renderer.setPixelRatio(Math.min(ratio, [2, 1.5, 1][this.level])); this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    for (const world of this.worlds) if (world) this.frame(world);
  }


  private frame(world: World) {
    const half = -SKY * Math.tan(rad(FOV / 2)), wide = half * this.camera.aspect, scene = scenes[world.place], size = Math.min(wide, half) * 1.6;
    world.sky.scale.set(wide * 2.1, half * 2.1, 1);
    world.body.scale.set(size, size, 1); world.body.position.set(wide * 0.56, half * (1 - 2 * scene.bodyAt * 0.78), SKY + 20);
    world.sun.castShadow = this.level === 0; world.sun.shadow.mapSize.set(2048, 2048);
  }

  private slab = (color: string, w: number, h: number, d: number, y: number, z: number) => {
    let material = this.plain.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.9 }); this.plain.set(color, material); }
    const mesh = new THREE.Mesh(this.box, material); mesh.scale.set(w, h, d); mesh.position.set(0, y + h / 2, z); mesh.receiveShadow = true;
    return mesh;
  };

  private world(place: number) {
    let world = this.worlds[place];
    if (!world) {
      world = new World(place, this.slab, this.pane);
      this.worlds[place] = world;
      this.frame(world);
      const current = world;
      void this.models.warm(place).then(() => {
        if (this.worlds[place] !== current) return;
        // Replace provisional tiles together on the next draw, including both sides of a wipe.
        for (const layer of [current.far, current.clouds]) {
          for (const group of layer.values()) current.scene.remove(group);
          layer.clear();
        }
        for (const [key, parts] of this.made) {
          if (!key.startsWith(`far:${place}:`) && key !== `cloud:${place}`) continue;
          for (const part of parts) part.geometry.dispose();
          this.made.delete(key);
        }
      });
    }
    return world;
  }


  private parts(key: string, shadow: boolean, make: (b: Build) => void) {
    let parts = this.made.get(key);
    if (!parts) { const build = new Build(this.kit); make(build); parts = build.done().map(part => ({ ...part, shadow: part.shadow && shadow })); this.made.set(key, parts); }
    return meshes(parts);
  }


  private row(world: World, index: number) {
    const place = world.place, scene = scenes[place];

    const kind = index === 0 ? 0 : mod(index * 5 + Math.floor(hash(Math.floor(index / 6), 61 + place) * 6), 6), v = Math.floor(hash(index, 62 + place) * 4);
    const tint: Tint = { s: scene, wall: scene.walls[(kind + v) % scene.walls.length], accent: scene.accents[v % scene.accents.length], other: scene.accents[(v + 1) % scene.accents.length], glow: moods[place].glow, v };
    const piece = pieces[place][kind], group = this.parts(`row:${place}:${kind}:${v}`, true, b => { piece.build(b, tint); groundMarks(b, scene); });
    group.position.x = index * TILE;
    for (const [id, x, z, turn, size = 1] of piece.models ?? []) {
      void this.pool.load(id).then(model => {
        if (world.rows.get(index) !== group) return;
        model.position.set(x, 0, z); model.rotation.y = rad(turn); model.scale.setScalar(size * PROP);
        model.traverse(node => { node.castShadow = true; node.receiveShadow = true; });
        group.add(model);
      }, () => {  });
    }
    return group;
  }

  private far(world: World, index: number) {
    const at = (stretch: number) => sights[world.place].get(stretch) ?? -1, sight = at(index), train = mod(index, 4) === 2, v = mod(index, 4);
    const near = Array.from({ length: SIGHT_MARGIN * 2 + 1 }, (_, i) => i - SIGHT_MARGIN).flatMap(away => away && at(index + away) >= 0 ? [[away, at(index + away)] as const] : []);
    const group = this.parts(`far:${world.place}:${v}:${sight}:${near.join(';')}`, false, b => skyline(b, world.place, v, sight, train, near));
    group.position.x = index * FAR_TILE;
    return group;
  }


  private clouds(world: World, index: number) {
    const scene = scenes[world.place], group = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const at = index * 4 + i, size = 0.9 + hash(at, 41) * 1.6, kind = Math.floor(hash(at, 45) * 5);

      const x = index * CLOUD_TILE + hash(at, 42) * CLOUD_TILE;
      if (scene.floaters && [...sights[world.place].keys()].some(stretch => Math.abs(x - (stretch + 0.5) * FAR_TILE) < 24)) continue;
      const cloud = scene.floaters ? this.parts(`floater:${world.place}:${kind}`, false, b => floater(b, kind, scene.floaters![kind % scene.floaters!.length])) : this.parts(`cloud:${world.place}`, false, b => { if (world.place === 0 && b.model('tpe_soft_cloud', 0, 0, 0, 0.19)) return; b.ball(scene.cloud, 3, 1.1, 1.4, 0, 0, 0, { glow: 0.35, rough: 1 }); b.ball(scene.cloud, 1.9, 1.3, 1.3, -0.6, 0.7, 0.1, { glow: 0.35, rough: 1 }); b.ball(scene.cloud, 2.2, 0.9, 1.2, 2, -0.3, 0.2, { glow: 0.35, rough: 1 }); });
      if (scene.floaters) cloud.rotation.set(hash(at, 46) * 6.3, hash(at, 47) * 6.3, hash(at, 48) * 6.3);
      cloud.position.set(hash(at, 42) * CLOUD_TILE, 13 + hash(at, 44) ** 1.7 * 180, -30 - hash(at, 43) * 34); cloud.scale.setScalar(size);
      group.add(cloud);
    }
    group.position.x = index * CLOUD_TILE;
    return group;
  }

  /** Draws the street as the game's lens sees it: the game's plane is z = 0, and the camera sits back far enough that a metre there is `lens.scale` pixels. */
  draw({ lens, from, to, wipe, machine, props, disassembly }: StreetView, angle?: Angle) {
    const { view, camera, renderer } = this, distance = view.height / lens.scale / (2 * Math.tan(rad(FOV / 2)));
    let x = lens.left + view.width / (2 * lens.scale);
    const y = (lens.ground - view.height / 2) / lens.scale;
    camera.position.set(x, y, distance); camera.rotation.set(0, 0, 0);
    if (angle) {

      const { target, yaw, pitch, at } = angle, reach = distance - target.z;
      camera.position.set(target.x + reach * Math.sin(rad(yaw)) * Math.cos(rad(pitch)), target.y + reach * Math.sin(rad(pitch)), target.z + reach * Math.cos(rad(yaw)) * Math.cos(rad(pitch)));
      camera.lookAt(target);
      camera.setViewOffset(view.width, view.height, view.width / 2 - at.x, view.height / 2 - at.y, view.width, view.height);
      x = (camera.position.x + target.x) / 2;
    }
    camera.updateMatrixWorld();
    const near = Math.abs(x) < 80;
    if (near) this.machine.pose(machine, performance.now());
    this.place(props, performance.now());
    const show = (place: number) => {
      const world = this.world(place), [dx, dy, dz] = moods[place].angle;
      world.fog.near = distance + 18; world.fog.far = distance + 130;
      world.sun.position.set(x + dx, dy, dz); world.sun.target.position.set(x, 0, -4);
      world.ground.position.x = x; world.backdrop.position.copy(camera.position); world.backdrop.quaternion.copy(camera.quaternion);

      const reach = (depth: number) => view.width / (2 * lens.scale) * (distance + depth) / distance, span = (depth: number, tile: number, margin = 1) => [Math.floor((x - reach(depth)) / tile) - margin, Math.floor((x + reach(depth)) / tile) + margin] as const;
      const more = angle ? 4 : 0;
      world.keep(world.rows, ...span(-FACE + 5, TILE, 1 + more), index => this.row(world, index));
      world.keep(world.far, ...span(82, FAR_TILE, SIGHT_MARGIN + more), index => this.far(world, index));
      world.keep(world.clouds, ...span(64, CLOUD_TILE, 1 + more), index => this.clouds(world, index));
      if (place === ORBIT) {
        const at = (distance + GAG_DEPTH) / distance;
        this.gags.update(world.scene, { centre: x, half: view.width / (2 * lens.scale) * at, top: lens.ground / lens.scale * at }, this.calm ? 0 : performance.now(), disassembly, !angle && this.level < 2);
      }

      if (near) world.scene.add(this.machine.group);
      world.scene.add(this.props);
      renderer.render(world.scene, camera);
    };
    if (!wipe || from === to) { renderer.clippingPlanes = []; renderer.autoClear = true; show(to); }
    else {

      const point = (sx: number, sy: number) => new THREE.Vector3(lens.left + sx / lens.scale, (lens.ground - sy) / lens.scale, 0), top = point(wipe.top, 0);
      this.edge.setFromCoplanarPoints(camera.position, top, point(wipe.bottom, view.height));
      if (this.edge.distanceToPoint(top.clone().setX(top.x + 1)) < 0) this.edge.negate();
      renderer.autoClear = true; renderer.clippingPlanes = [this.edge.clone().negate()]; show(from);
      renderer.autoClear = false; renderer.clearDepth(); renderer.clippingPlanes = [this.edge]; show(to);
    }
    this.watch();
  }


  private place(props: readonly StreetProp[], now: number) {
    const taken = new Map<string, number>();
    this.props.clear();
    for (const prop of props) {
      const key = propKey(prop), copies = this.spare.get(key) ?? [], index = taken.get(key) ?? 0;
      if (!this.spare.has(key)) this.spare.set(key, copies);
      if (!copies[index]) copies[index] = this.parts(key, true, b => buildProp(b, prop));
      const group = copies[index];
      taken.set(key, index + 1);
      group.position.set(prop.x, prop.kind === 'mail' ? Math.sin(now / 520 + prop.x) * 0.08 : 0, 0);
      group.scale.set(1 / prop.squash, prop.squash, 1);
      this.props.add(group);
    }
  }


  private watch() {
    const now = performance.now(), took = now - this.pace.last;
    this.pace.last = now;
    if (took > 200 || this.level === 2 || this.sharp) return;
    this.pace.frames++; if (took > 24) this.pace.slow++;
    if (this.pace.frames < 120) return;
    if (this.pace.slow > 60) { this.level++; this.resize(this.view.width, this.view.height, this.view.ratio); }
    this.pace.frames = this.pace.slow = 0;
  }

  dispose() {
    for (const world of this.worlds) world?.dispose();
    for (const parts of this.made.values()) for (const part of parts) part.geometry.dispose();
    for (const material of this.plain.values()) material.dispose();
    this.worlds.length = 0; this.models.dispose();
    this.machine.dispose(); this.kit.dispose(); this.pool.dispose(); this.renderer.dispose(); this.box.dispose(); this.pane.dispose();
  }
}
