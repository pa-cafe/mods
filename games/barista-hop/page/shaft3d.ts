// The shaft in three.js, drawn on a canvas of its own behind the game's. It is built from BARISTA BLAST!!'s street:
// the same shops, landmarks, clouds and light, stood on end. Every takeaway counter is a whole street of its place
// floating on a bank of cloud, with that place's skyline behind it; between two streets there are shops on small
// clouds and whatever drifts through that part of the sky. The saucers, carts and foam are modelled too. The barista,
// the residents and every word stay on the game's own canvas, which lies over this one.
import * as THREE from 'three';
import { CREAM, hash, INK, MINT, PINK, RED } from '../../barista-blast/page/art.ts';
import { paintBody, scenes } from '../../barista-blast/page/scenes.ts';
import { Build, Kit, loadMarks, meshes, shade, type Part } from '../../barista-blast/page/street3d-kit.ts';
import { StreetModels, type ModelId } from '../../barista-blast/page/street3d-models.ts';
import { buildProp } from '../../barista-blast/page/street3d-props.ts';
import { FAR_TILE, SIGHT_MARGIN, skyline, skylines, TILE } from '../../barista-blast/page/street3d-sets.ts';
import { floater, moods, shopFront, shopKind } from '../../barista-blast/page/street3d.ts';
import { hopCloudX, hopSpotX, hopTuning as T, type HopRun, type HopSpot } from '../rules.ts';
import { hopZones, zoneAt, ZONE_BLEND } from './scenery.ts';

const FOV = 24, SKY = -520, AIR = 30, MID = T.width / 2, GOLD = '#FFC83D', STORM = '#5B5670';
/** Where a row of shops and a stretch of skyline start, so that one of each is centred on the shaft. */
const ROW_AT = MID - TILE / 2, FAR_AT = MID - FAR_TILE / 2;
/** Every this many stretches of skyline has a landmark. */
const SIGHT_EVERY = 4;
const rad = (degrees: number) => degrees * Math.PI / 180;
const mod = (value: number, by: number) => (value % by + by) % by;
const one = new THREE.Color(), two = new THREE.Color();
const mix = (a: string, b: string, k: number) => `#${one.set(a).lerp(two.set(b), k).getHexString()}`;

/** The model each place hangs in its sky, and the one its clouds are made of (with how large blast draws it). */
const bodies: readonly (ModelId | null)[] = ['div3_sun_disc', 'div3_sun_disc', 'sf4_crescent_moon', 'orb4_sky_bean', 'div3_sun_disc', null];
const cloudModels: readonly (readonly [ModelId, number])[] = [['tpe5_cloud_lobe', 1], ['hsc3_steam_cluster_unit', 1], ['sf4_cloud_bank', 0.5], ['orb4_sky_cloud', 0.65], ['div3_cloud_bank', 1.5]];
/** What drifts past between two streets of a place, and how many metres across it is drawn. */
const drifters: readonly (readonly (readonly [ModelId, number])[])[] = [
  [], [], [],
  [['orb4_gag_rocket', 9], ['orb4_gag_roadster_left', 5], ['orb4_gag_train_satellite', 11], ['orb4_satellite_landmark_unit', 8], ['orb3_drifting_bean_cluster_7m', 7], ['orb4_dyson_core', 9]],
  [['div3_cloud_island_complete', 15], ['div3_waterfall', 11], ['div3_light_mote', 3]],
  [['void3_thinking_monolith', 12], ['void3_floating_orb', 4]],
];

/** What the game's canvas showed this frame: the climb, the height at the bottom of the screen, and pixels to the metre. */
type ShaftView = { run: HopRun; floor: number; scale: number; now: number };
type Street = { place: number; group: THREE.Group; todo: (() => void)[] };

function release(group: THREE.Object3D) { group.traverse(node => { if (node instanceof THREE.InstancedMesh) node.dispose(); }); }

function gradient(colors: readonly string[]) {
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d')!, fill = ctx.createLinearGradient(0, 0, 0, 256);
  colors.forEach((color, at) => fill.addColorStop(at / (colors.length - 1), color));
  ctx.fillStyle = fill; ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function halo(place: number, disc: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128), scene = scenes[place];
  glow.addColorStop(0, `${scene.glow}cc`); glow.addColorStop(0.35, `${scene.glow}40`); glow.addColorStop(1, `${scene.glow}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256);
  if (disc) paintBody(ctx, scene, 128, 128, 24);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One place's sky, fixed to the camera: its colours, its stars, and its sun, moon or bean. */
class Sky {
  readonly group = new THREE.Group();
  private wash: THREE.MeshBasicMaterial; private glow: THREE.MeshBasicMaterial; private stars: THREE.PointsMaterial | null = null;
  private sheet: THREE.Texture; private pane: THREE.Mesh; private body: THREE.Mesh;
  private solid: THREE.Material[] = []; private owned: { dispose(): void }[] = [];

  constructor(readonly place: number, flat: THREE.PlaneGeometry, model: THREE.Group | null) {
    const scene = scenes[place], own = <Item extends { dispose(): void }>(item: Item) => { this.owned.push(item); return item; };
    this.sheet = own(gradient(moods[place].sky)); this.sheet.repeat.y = 0.62;
    this.wash = own(new THREE.MeshBasicMaterial({ map: this.sheet, fog: false, depthWrite: false, transparent: true }));
    this.pane = new THREE.Mesh(flat, this.wash); this.pane.position.z = SKY; this.pane.renderOrder = -6 + place * 0.01;
    this.glow = own(new THREE.MeshBasicMaterial({ map: own(halo(place, !model)), fog: false, depthWrite: false, transparent: true }));
    this.body = new THREE.Mesh(flat, this.glow); this.body.position.z = SKY + 20; this.body.renderOrder = -4 + place * 0.01;
    this.body.visible = scene.body !== 'none';
    if (model) {
      // The modelled sun, moon or bean sits where the painted disc would, and fades with the sky it belongs to.
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      model.scale.setScalar(0.1875 / Math.max(size.x, size.y));
      model.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        const material = own((node.material as THREE.MeshStandardMaterial).clone());
        material.fog = false; material.depthWrite = false; material.transparent = true;
        node.material = material; node.renderOrder = -3 + place * 0.01; node.castShadow = node.receiveShadow = false; this.solid.push(material);
      });
      this.body.add(model);
    }
    this.group.add(this.pane, this.body);
    if (scene.stars) {
      const points = new Float32Array(160 * 3), half = -SKY * Math.tan(rad(FOV / 2));
      for (let i = 0; i < 160; i++) points.set([(hash(i, 32) - 0.5) * half * 6, (hash(i, 33) * 2 - 1) * half, SKY + 10], i * 3);
      this.stars = own(new THREE.PointsMaterial({ color: '#fff', size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
      const stars = new THREE.Points(own(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3))), this.stars);
      stars.renderOrder = -5 + place * 0.01; this.group.add(stars);
    }
  }

  /** Shows this sky `alpha` strong, `through` of the way up its place: the sky deepens and its sun sinks as she climbs. */
  show(alpha: number, through: number, aspect: number) {
    const half = -SKY * Math.tan(rad(FOV / 2)), wide = half * aspect, size = Math.min(wide, half) * 1.9, scene = scenes[this.place];
    this.pane.scale.set(wide * 2.1, half * 2.1, 1);
    this.body.scale.set(size, size, 1); this.body.position.set(wide * 0.5, half * (0.62 - scene.bodyAt * 0.5 - through * 0.7), SKY + 20);
    this.sheet.offset.y = 0.38 * through;
    this.wash.opacity = alpha; this.glow.opacity = alpha;
    for (const material of this.solid) material.opacity = alpha;
    if (this.stars) this.stars.opacity = alpha * scene.stars;
  }

  dispose() { for (const item of this.owned) item.dispose(); }
}

export class Shaft3d {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 900);
  private scene = new THREE.Scene();
  private world = new THREE.Group(); private things = new THREE.Group(); private backdrop = new THREE.Group();
  private sun = new THREE.DirectionalLight('#fff', 2); private fill = new THREE.HemisphereLight('#fff', '#fff', 1.8); private fog = new THREE.Fog('#fff', 30, 150);
  private kit = new Kit(); private models = new StreetModels(this.kit);
  private made = new Map<string, Part[]>();
  private flat = new THREE.PlaneGeometry(1, 1);
  private ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false });
  private skies = new Map<number, Sky>(); private streets = new Map<number, Street>(); private air = new Map<number, THREE.Group>();
  private pools = new Map<string, THREE.Group[]>(); private used = new Map<string, number>();
  private counters = new Map<number, number>(); private climb = { seed: -1, step: 0 };
  private view = { width: 1, height: 1, ratio: 1 };
  private level = matchMedia('(pointer: coarse)').matches ? 1 : 0;
  private pace = { last: 0, slow: 0, frames: 0 };
  private edges = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), T.width)];
  private alive = true; private warming = new Set<number>([0]);
  private lands = new Map<number, THREE.Mesh>();

  /** Loads the cafe's marks and the first street's models, then stands the shaft up. Throws where there is no WebGL. */
  static async open(canvas: HTMLCanvasElement) {
    await loadMarks();
    const shaft = new Shaft3d(canvas);
    await shaft.models.warm(0);
    return shaft;
  }

  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.sun.castShadow = true; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 30, bottom: -30, near: 1, far: 160 });
    this.scene.fog = this.fog;
    this.scene.add(this.sun, this.sun.target, this.fill, this.backdrop, this.world, this.things);
  }

  resize(width: number, height: number, ratio: number) {
    const wider = width > this.view.width + 1;
    this.view = { width, height, ratio };
    this.renderer.setPixelRatio(Math.min(ratio, [2, 1.5, 1][this.level])); this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.sun.castShadow = this.level === 0;
    // A wider window sees more of every street than was built for it.
    if (wider) this.clear(this.streets);
  }

  private clear(layer: Map<number, THREE.Group | Street>, only?: (index: number) => boolean) {
    for (const [index, item] of layer) {
      if (only && !only(index)) continue;
      const group = item instanceof THREE.Group ? item : item.group;
      group.removeFromParent(); release(group); layer.delete(index);
    }
  }

  /** Everything built for `place` is built again: its models have just arrived. */
  private restyle(place: number) {
    if (!this.alive) return;
    for (const [key, parts] of this.made) {
      if (!key.startsWith(`${place}:`)) continue;
      for (const part of parts) part.geometry.dispose();
      this.made.delete(key);
    }
    this.clear(this.streets, k => this.streets.get(k)!.place === place);
    this.clear(this.air, n => zoneAt(n * AIR + AIR / 2) === place);
    const sky = this.skies.get(place);
    if (sky) { sky.group.removeFromParent(); sky.dispose(); this.skies.delete(place); }
    if (place === 0) { for (const copies of this.pools.values()) for (const copy of copies) { copy.removeFromParent(); release(copy); } this.pools.clear(); }
  }

  /** Fetches a place's models once; what was built without them is built again when they are in. */
  private warm(place: number) {
    if (this.warming.has(place)) return;
    this.warming.add(place);
    void this.models.warm(place).then(() => this.restyle(place));
  }

  private parts(key: string, place: number, shadow: boolean, make: (b: Build) => void) {
    let parts = this.made.get(key);
    if (!parts) { const build = new Build(this.kit, this.models.hasStyle(place)); make(build); parts = build.done().map(part => ({ ...part, shadow: part.shadow && shadow })); this.made.set(key, parts); }
    return meshes(parts);
  }

  /** A model on its own, its middle at the group's middle and its longest side `size` metres. Null until its place's models are in. */
  private fitted(place: number, id: ModelId, size: number) {
    if (!this.models.hasStyle(place) || !this.kit.models.has(id)) return null;
    const inner = this.parts(`${place}:model:${id}`, place, true, b => { b.model(id, 0, 0, 0); }), box = new THREE.Box3().setFromObject(inner);
    const span = box.getSize(new THREE.Vector3()), outer = new THREE.Group();
    inner.position.copy(box.getCenter(new THREE.Vector3())).negate();
    outer.add(inner); outer.scale.setScalar(size / Math.max(span.x, span.y, span.z, 0.01));
    return outer;
  }

  private sky(place: number) {
    let sky = this.skies.get(place);
    if (!sky) {
      const id = bodies[place], model = id && this.kit.models.has(id) && this.models.hasStyle(place) ? this.parts(`${place}:body`, place, false, b => { b.model(id, 0, 0, 0); }) : null;
      sky = new Sky(place, this.flat, model);
      this.skies.set(place, sky); this.backdrop.add(sky.group);
    }
    return sky;
  }

  /** A bank of cloud under something `wide` metres across: what every floating street and shop rests on. */
  private bank(b: Build, color: string, from: number, to: number, salt: number, z = -1.6) {
    for (let x = from; x < to; x += 2.1) {
      const puff = Math.round(x * 3) + salt, big = hash(puff, 71);
      b.ball(color, 1.5 + big * 0.9, 0.62 + big * 0.3, 1.35 + big * 0.4, x + hash(puff, 72), -0.82 - big * 0.25, z - big * 0.7, { glow: 0.3, rough: 1 });
      b.ball(color, 2.2 + big, 0.9, 2.4, x + 1 + hash(puff, 73), -1.25, z - 4.2 - hash(puff, 74) * 3, { glow: 0.3, rough: 1 });
    }
  }

  /** The land a street's skyline stands on, rising to the shelf its landmarks are built for and fading into the haze. */
  private land(near: string, middle: string, far: string) {
    const profile = [[-13, -0.22, near, 1], [-32, 0, near, 1], [-54, 4.95, middle, 1], [-82, 5.02, middle, 1], [-115, 2.8, far, 1], [-176, 1.2, far, 1], [-330, 0, far, 0]] as const;
    const positions: number[] = [], paint: number[] = [], indices: number[] = [];
    for (const [i, [z, y, tint, alpha]] of profile.entries()) {
      one.set(tint);
      for (const x of [-600, 600]) { positions.push(x, y, z); paint.push(one.r, one.g, one.b, alpha); }
      if (i) { const k = i * 2; indices.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(paint, 4));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const land = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 1, side: THREE.DoubleSide }));
    land.receiveShadow = true;
    return land;
  }

  /** Half of what the camera sees across, `depth` metres behind the game's plane. */
  private half(scale: number, depth: number) {
    const distance = this.view.height / scale / (2 * Math.tan(rad(FOV / 2)));
    return this.view.width / (2 * scale) * (distance + depth) / distance;
  }

  /** Street `k`: the counter she lands on is its kerb. Its ground stands at once; its shops and skyline follow a few a frame. */
  private street(k: number, scale: number): Street {
    const place = zoneAt(k * T.counterEvery + 1), scene = scenes[place], group = new THREE.Group(), todo: (() => void)[] = [];
    const floating = k > 0, wide = this.half(scale, 14) + 6, cloud = scene.floaters ? '#C9C9C4' : scene.cloud;
    group.add(this.parts(`${place}:deck:${floating}:${Math.ceil(wide / 8)}`, place, true, b => {
      const span = Math.ceil(wide / 8) * 16;
      b.box(scene.walk, span, 0.3, 15.8, MID, -0.3, -7.2);
      b.box(scene.walkEdge, span, 0.4, 0.2, MID, -0.4, 0.8);
      // The counter's own awning hangs along the kerb, as wide as the shaft.
      for (let stripe = 0; stripe < T.width * 2; stripe++) b.box(stripe % 2 ? CREAM : PINK, 0.5, 0.34, 0.06, stripe * 0.5 + 0.25, -0.38, 0.93, { rough: 0.7 });
      b.box(shade(scene.walkEdge, 0.7), T.width + 0.3, 0.07, 0.1, MID, -0.05, 0.93);
      if (floating) { if (!scene.floaters) this.bank(b, cloud, MID - span / 2, MID + span / 2, k * 13); else b.box('#141418', span, 0.5, 15.4, MID, -0.8, -7.2); return; }
      // The street she leaves from has a road, and nothing under it.
      b.box(scene.road, span, 0.3, 80, MID, -0.5, 40.9);
      for (let x = MID - span / 2; x < MID + span / 2; x += 3.2) b.box(scene.lane, 1.7, 0.02, 0.2, x, -0.2, 3.4);
    }));
    let land = this.lands.get(place * 2 + Number(floating));
    if (!land) {
      const haze = moods[place].sky[2];
      land = floating ? this.land(cloud, mix(cloud, haze, 0.35), mix(cloud, haze, 0.7)) : this.land('#BAAF97', '#929A83', '#A9A692');
      this.lands.set(place * 2 + Number(floating), land);
    }
    group.add(land.clone());
    const stall = this.parts(`${place}:stall`, place, true, b => buildProp(b, { kind: 'window', x: 0, squash: 1 }, place));
    stall.position.set(k % 2 ? T.width - 1.9 : 1.9, 0, -2.6); group.add(stall);

    const shops = this.half(scale, 12) + 1;
    for (let i = Math.floor((MID - shops - ROW_AT) / TILE); i <= Math.floor((MID + shops - ROW_AT) / TILE); i++) todo.push(() => {
      const index = i + k * 3, kind = shopKind(place, index), v = Math.floor(hash(index, 62 + place) * 4);
      const row = this.parts(`${place}:row:${kind}:${v}`, place, true, b => shopFront(b, place, kind, v));
      row.position.x = ROW_AT + i * TILE; group.add(row);
    });
    const count = skylines[place].sights.length, far = this.half(scale, 100);
    const sight = (j: number) => count && mod(j, SIGHT_EVERY) === 0 ? mod(k + j / SIGHT_EVERY, count) : -1;
    for (let j = Math.floor((MID - far - FAR_AT) / FAR_TILE) - SIGHT_MARGIN; j <= Math.floor((MID + far - FAR_AT) / FAR_TILE) + SIGHT_MARGIN; j++) todo.push(() => {
      const near = Array.from({ length: SIGHT_MARGIN * 2 + 1 }, (_, at) => at - SIGHT_MARGIN).flatMap(away => away && sight(j + away) >= 0 ? [[away, sight(j + away)] as const] : []);
      const v = mod(j, 4), stretch = this.parts(`${place}:far:${v}:${sight(j)}:${near.join(';')}`, place, false, b => skyline(b, place, v, sight(j), v === 2, near));
      stretch.position.x = FAR_AT + j * FAR_TILE; group.add(stretch);
    });
    return { place, group, todo };
  }

  /** Thirty metres of open sky: its clouds, a shop on a cloud of its own, and what drifts by. */
  private sky30(n: number) {
    const base = n * AIR, place = zoneAt(base + AIR / 2), scene = scenes[place], group = new THREE.Group();
    const moving: THREE.Object3D[] = [];
    for (let i = 0; i < 6; i++) {
      const at = n * 8 + i, depth = 16 + hash(at, 43) * 50, size = 0.8 + hash(at, 41) * 1.5, kind = Math.floor(hash(at, 45) * 5);
      let cloud: THREE.Group;
      if (scene.floaters) { cloud = this.parts(`${place}:floater:${kind}`, place, false, b => floater(b, kind, scene.floaters![kind % scene.floaters!.length])); cloud.rotation.set(hash(at, 46) * 6.3, hash(at, 47) * 6.3, hash(at, 48) * 6.3); }
      else cloud = this.parts(`${place}:cloud`, place, false, b => {
        const [asset, grown] = cloudModels[place];
        if (b.model(asset, 0, 0, 0, grown)) return;
        b.ball(scene.cloud, 3, 1.1, 1.4, 0, 0, 0, { glow: 0.35, rough: 1 }); b.ball(scene.cloud, 1.9, 1.3, 1.3, -0.6, 0.7, 0.1, { glow: 0.35, rough: 1 }); b.ball(scene.cloud, 2.2, 0.9, 1.2, 2, -0.3, 0.2, { glow: 0.35, rough: 1 });
      });
      cloud.position.set(MID + (hash(at, 42) - 0.5) * (22 + depth * 0.9), base + hash(at, 44) * AIR, -depth); cloud.scale.setScalar(size);
      cloud.userData.drift = { x: cloud.position.x, by: 1.2 + hash(at, 49) * 2, pace: 7000 + hash(at, 50) * 6000, turn: scene.floaters ? 0.00012 : 0 };
      moving.push(cloud); group.add(cloud);
    }
    // A shop on a cloud of its own, to one side and well behind the saucers, wherever no street is near.
    const up = base + 9 + hash(n, 81) * 12, off = Math.abs(up - Math.round(up / T.counterEvery) * T.counterEvery);
    if (off > 22 && !scene.floaters) {
      const index = n * 7 + 3, kind = shopKind(place, index), v = Math.floor(hash(index, 62 + place) * 4);
      const islet = this.parts(`${place}:islet:${kind}:${v}`, place, true, b => {
        shopFront(b, place, kind, v);
        b.box(scene.walk, TILE + 0.8, 0.3, 7.6, TILE / 2, -0.3, -8.6);
        b.box(scene.walkEdge, TILE + 0.8, 0.12, 7.8, TILE / 2, -0.42, -8.6);
        for (let x = 0.4; x < TILE; x += 2) b.ball(scene.cloud, 1.9, 0.8, 2.6, x + 0.6, -1.1 - hash(x * 10, 75) * 0.3, -8.6 + (hash(x * 10, 76) - 0.5) * 2, { glow: 0.3, rough: 1 });
      });
      islet.position.set(n % 2 ? MID + 0.6 : MID - TILE - 0.6, up, -10);
      islet.userData.drift = { x: islet.position.x, by: 0, pace: 5200, bob: 0.35, y: up };
      moving.push(islet); group.add(islet);
    }
    const drifting = drifters[place];
    if (drifting.length) {
      const [id, size] = drifting[mod(n, drifting.length)], thing = this.fitted(place, id, size);
      if (thing) {
        const y = base + 4 + hash(n, 83) * 20;
        thing.position.set(MID + (hash(n, 82) - 0.5) * 15, y, -24 - hash(n, 84) * 14); thing.rotation.z = (hash(n, 85) - 0.5) * 0.7;
        thing.userData.drift = { x: thing.position.x, by: 2.4, pace: 9000, bob: 0.8, y, turn: 0.00006 };
        moving.push(thing); group.add(thing);
      }
    }
    group.userData.moving = moving;
    return group;
  }

  /** The model of one kind of thing she can land on, a metre wide with its top at 0. */
  private thing(kind: string) {
    const copies = this.pools.get(kind) ?? [], at = this.used.get(kind) ?? 0;
    if (!this.pools.has(kind)) this.pools.set(kind, copies);
    if (!copies[at]) {
      copies[at] = this.parts(`0:thing:${kind}`, 0, true, b => {
        if (kind === 'foam') {
          for (const [x, y, r] of [[-0.26, -0.2, 0.26], [0.04, -0.23, 0.32], [0.3, -0.18, 0.24], [-0.05, -0.34, 0.36]] as const) b.ball('#FFFFFF', r, r * 0.72, r * 0.9, x, y, x * 0.2, { glow: 0.45, rough: 1 });
          b.ring('#C9A27E', 0.11, 0.03, 0.02, 0, 0.02, { turn: [90, 0, 0], rough: 0.6 });
        } else if (kind === 'storm') {
          for (const [x, y, r] of [[-0.55, 0.1, 0.55], [0, 0.22, 0.72], [0.55, 0.05, 0.6], [0, -0.3, 0.62]] as const) b.ball(STORM, r, r * 0.62, r * 0.8, x, y, 0, { rough: 1, glow: 0.08 });
          b.ball(RED, 0.2, 0.2, 0.2, 0, 0, 0.5, { glow: 2.2 });
        } else if (kind === 'cart') {
          // A serving trolley: a mint top on two shelves, and four wheels.
          b.box(MINT, 1, 0.09, 0.62, 0, -0.09, 0, { rough: 0.45, glow: 0.2 }); b.box(shade(MINT, 0.72), 0.9, 0.05, 0.54, 0, -0.42, 0);
          for (const x of [-0.42, 0.42]) for (const z of [-0.24, 0.24]) { b.tube('#DCE6EA', 0.025, 0.5, x, -0.59, z, { rough: 0.3 }); b.tube(INK, 0.085, 0.06, x, -0.66, z + Math.sign(z) * 0.05, { turn: [90, 0, 0] }); }
          b.pipe('#DCE6EA', 0.022, 0.62, 0.52, -0.02, 0, 'z', { rough: 0.3 });
          b.tube('#FFFFFF', 0.09, 0.14, -0.2, -0.37, 0.05, { top: 1.3, rough: 0.4 }); b.tube('#C9794B', 0.11, 0.22, 0.18, -0.37, -0.06, { rough: 0.35 });
        } else {
          // A saucer of the cafe's china, its rim in the colour of what landing on it does.
          const rim = kind === 'toss' ? MINT : kind === 'rocket' ? GOLD : kind === 'weak' ? RED : PINK;
          b.tube('#EADBC0', 0.2, 0.07, 0, -0.26, 0, { rough: 0.4, sides: 28, glow: 0.22 });
          b.tube(CREAM, 0.26, 0.17, 0, -0.19, 0, { top: 0.5 / 0.26, rough: 0.35, sides: 28, glow: 0.22 });
          b.tube(rim, 0.5, 0.035, 0, -0.035, 0, { rough: 0.35, sides: 28, glow: kind === 'saucer' ? 0.2 : 0.6 });
          b.tube('#FFFDF4', 0.44, 0.012, 0, -0.008, 0, { rough: 0.3, sides: 28 });
          b.tube('#EFE3CC', 0.2, 0.006, 0, 0, 0, { rough: 0.3, sides: 28 });
        }
      });
      // An ink edge round each, as round everyone who stands on them: the hull of the same shape, a little larger, seen from inside.
      for (const mesh of [...copies[at].children]) { const edge = new THREE.Mesh((mesh as THREE.Mesh).geometry, this.ink); edge.scale.set(1.07, 1.16, 1.07); edge.position.y = -0.015; copies[at].add(edge); }
      this.things.add(copies[at]);
    }
    this.used.set(kind, at + 1);
    copies[at].visible = true;
    return copies[at];
  }

  private put(spot: HopSpot, x: number, y: number, now: number) {
    const kind = spot.kind === 'saucer' ? spot.who?.deed ?? 'saucer' : spot.kind, model = this.thing(kind);
    model.position.set(x, y + (kind === 'foam' ? Math.sin(now / 420 + x * 3) * 0.03 : 0), 0);
    model.scale.set(spot.width, spot.width * 0.82, spot.width);
    model.rotation.z = kind === 'weak' ? Math.sin(now / 300 + x) * 0.05 : 0;
  }

  /** Draws the shaft as the game's canvas sees it: the game's plane is z = 0, and the camera sits back far enough that a metre there is `scale` pixels. */
  draw({ run, floor, scale, now }: ShaftView) {
    const { view, camera, renderer } = this, seen = view.height / scale, distance = seen / (2 * Math.tan(rad(FOV / 2))), eye = floor + seen / 2;
    camera.position.set(MID, eye, distance); camera.updateMatrixWorld();
    if (run.seed !== this.climb.seed || run.step < this.climb.step) this.counters.clear();
    this.climb = { seed: run.seed, step: run.step };
    for (const row of run.rows) if (row.spots[0]?.kind === 'counter') this.counters.set(Math.floor(row.y / T.counterEvery), row.y);

    // The place she is in, and how far the next has faded in over it.
    const to = zoneAt(eye + ZONE_BLEND / 2), k = to === 0 ? 1 : Math.min(1, (eye + ZONE_BLEND / 2 - hopZones[to]) / ZONE_BLEND), from = k < 1 ? to - 1 : to;
    const next = hopZones[to + 1] ?? Infinity;
    this.warm(to); if (next - eye < 90 && to + 1 < scenes.length) this.warm(to + 1);
    const a = moods[from], b = moods[to];
    this.sun.color.set(a.sun).lerp(one.set(b.sun), k); this.sun.intensity = a.power + (b.power - a.power) * k;
    this.fill.color.set(a.sky[1]).lerp(one.set('#fff'), 0.6).lerp(two.set(b.sky[1]).lerp(one.set('#fff'), 0.6), k);
    this.fill.groundColor.set(scenes[from].walk).lerp(one.set(scenes[to].walk), k); this.fill.intensity = a.fill + (b.fill - a.fill) * k;
    this.fog.color.set(a.sky[2]).lerp(one.set(b.sky[2]), k); this.fog.near = distance + 22; this.fog.far = distance + 150;
    const [dx, dy, dz] = b.angle;
    this.sun.target.position.set(MID, eye - 3, -6); this.sun.position.set(MID + dx * 4, eye - 3 + dy * 4, -6 + (dz + 4) * 4);

    this.backdrop.position.copy(camera.position); this.backdrop.quaternion.copy(camera.quaternion);
    for (const [place, sky] of this.skies) sky.group.visible = place === to || place === from;
    for (const place of new Set([from, to])) {
      const start = hopZones[place], end = hopZones[place + 1] ?? start + 300;
      this.sky(place).show(place === to && from !== to ? k : 1, Math.min(1, Math.max(0, (eye - start) / (end - start))), camera.aspect);
    }

    // A street is seen from far below as the cloud it stands on, and from far above as its roofs.
    const first = Math.max(0, Math.ceil((eye - 135) / T.counterEvery)), last = Math.floor((eye + 75) / T.counterEvery);
    this.clear(this.streets, index => index < first || index > last);
    let budget = run.step === 0 ? 99 : 2;
    for (let index = first; index <= last; index++) {
      let street = this.streets.get(index);
      const y = this.counters.get(index) ?? (index ? index * T.counterEvery + 1.2 : 0);
      if (!street) { street = this.street(index, scale); street.group.position.y = y; this.streets.set(index, street); this.world.add(street.group); }
      street.group.position.y += (y - street.group.position.y) * 0.2;
      while (budget > 0 && street.todo.length) { street.todo.splice(Math.floor(street.todo.length / 2), 1)[0](); budget--; }
    }
    const low = Math.max(0, Math.floor((eye - 45) / AIR)), high = Math.floor((eye + 45) / AIR);
    this.clear(this.air, index => index < low || index > high);
    for (let index = low; index <= high; index++) {
      let tile = this.air.get(index);
      if (!tile) { tile = this.sky30(index); this.air.set(index, tile); this.world.add(tile); }
      for (const thing of tile.userData.moving as THREE.Object3D[]) {
        const drift = thing.userData.drift as { x: number; by: number; pace: number; bob?: number; y?: number; turn?: number };
        thing.position.x = drift.x + Math.sin(now / drift.pace + drift.x) * drift.by;
        if (drift.bob) thing.position.y = drift.y! + Math.sin(now / (drift.pace * 0.6) + drift.x) * drift.bob;
        if (drift.turn) thing.rotation.y = now * drift.turn + drift.x;
      }
    }

    for (const copies of this.pools.values()) for (const copy of copies) copy.visible = false;
    this.used.clear();
    for (const row of run.rows) {
      if (row.y < floor - 3 || row.y > floor + seen + 3) continue;
      for (const spot of row.spots) {
        if (spot.gone || spot.kind === 'counter') continue;
        const x = hopSpotX(spot, run.step), reach = spot.width / 2 + 0.2;
        this.put(spot, x, row.y, now);
        if (x < reach) this.put(spot, x + T.width, row.y, now); else if (x > T.width - reach) this.put(spot, x - T.width, row.y, now);
      }
      if (row.cloud && !row.cloud.gone) {
        const x = hopCloudX(row.cloud, run.step);
        for (const at of [x, x < 1.6 ? x + T.width : x > T.width - 1.6 ? x - T.width : NaN]) {
          if (Number.isNaN(at)) continue;
          const storm = this.thing('storm');
          storm.position.set(at, row.cloud.y, 0); storm.scale.set(T.cloudWide, T.cloudTall / 0.52, T.cloudWide); storm.rotation.z = 0;
        }
      }
    }

    // The place first, then what she lands on, cut off at the shaft's two sides: past them it comes round again.
    this.world.visible = true; this.backdrop.visible = true; this.things.visible = false;
    renderer.clippingPlanes = []; renderer.autoClear = true; renderer.render(this.scene, camera);
    this.world.visible = false; this.backdrop.visible = false; this.things.visible = true;
    renderer.clippingPlanes = this.edges; renderer.autoClear = false; renderer.shadowMap.autoUpdate = false; renderer.render(this.scene, camera);
    renderer.shadowMap.autoUpdate = true;
    this.watch();
  }

  /** Steps the picture down where the device cannot keep up with it: first the shadows, then the sharpness. */
  private watch() {
    const now = performance.now(), took = now - this.pace.last;
    this.pace.last = now;
    if (took > 200 || this.level === 2) return;
    this.pace.frames++; if (took > 24) this.pace.slow++;
    if (this.pace.frames < 120) return;
    if (this.pace.slow > 60) { this.level++; this.resize(this.view.width, this.view.height, this.view.ratio); }
    this.pace.frames = this.pace.slow = 0;
  }

  dispose() {
    this.alive = false;
    release(this.scene);
    for (const sky of this.skies.values()) sky.dispose();
    for (const land of this.lands.values()) { land.geometry.dispose(); (land.material as THREE.Material).dispose(); }
    for (const parts of this.made.values()) for (const part of parts) part.geometry.dispose();
    this.models.dispose(); this.kit.dispose(); this.flat.dispose(); this.ink.dispose(); this.renderer.dispose();
  }
}
