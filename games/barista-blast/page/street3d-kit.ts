import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rad = (degrees: number) => degrees * Math.PI / 180;
/** A colour made darker or lighter by a factor, as a hex string. */
export const shade = (color: string, by: number) => `#${new THREE.Color(color).multiplyScalar(by).getHexString()}`;
/** `glow` lights a part from inside; `turn` is degrees about x, y, z; `flat` is an unlit see-through pool of light. */
type Look = { glow?: number; turn?: readonly [number, number, number]; rough?: number; flat?: number };
export type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; shadow: boolean };
type Pending = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; key: string };
type Painter = (ctx: CanvasRenderingContext2D, size: number) => void;

/** Geometries, materials and painted signs, made once and shared by every piece. */
export class Kit {
  private shapes = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<string, THREE.Material>();
  private textures = new Map<string, THREE.CanvasTexture>();

  shape(key: string, make: () => THREE.BufferGeometry) {
    let shape = this.shapes.get(key);
    if (!shape) { shape = make(); if (!shape.index) shape.setIndex([...Array(shape.attributes.position.count).keys()]); this.shapes.set(key, shape); }
    return shape;
  }

  picture(name: string, paint: Painter, size = 128) {
    let texture = this.textures.get(name);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      paint(canvas.getContext('2d')!, size);
      texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      this.textures.set(name, texture);
    }
    return texture;
  }

  material(key: string, color: string, look: Look, picture?: THREE.Texture) {
    let material = this.materials.get(key);
    if (!material) {
      material = look.flat
        ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: look.flat, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
        : new THREE.MeshStandardMaterial({ color: picture ? '#fff' : color, map: picture ?? null, roughness: look.rough ?? 0.85, emissive: look.glow ? picture ? '#fff' : color : '#000', emissiveMap: look.glow && picture ? picture : null, emissiveIntensity: look.glow ?? 0 });
      this.materials.set(key, material);
    }
    return material;
  }

  dispose() { for (const group of [this.shapes, this.materials, this.textures]) { for (const item of group.values()) item.dispose(); group.clear(); } }
}

export class Build {
  private pending: Pending[] = [];
  private pictures = new Map<string, THREE.Texture>();
  private looks = new Map<string, { color: string; look: Look }>();
  private frame: THREE.Matrix4 | null = null;
  constructor(private kit: Kit) {}

  /** Everything `make` builds comes out `size` times its own size, about the point on the ground at (x, z), and `lift` metres higher. */
  scaled(size: number, x: number, z: number, lift: number, make: () => void) {
    this.frame = new THREE.Matrix4().makeTranslation(x, lift, z).multiply(new THREE.Matrix4().makeScale(size, size, size)).multiply(new THREE.Matrix4().makeTranslation(-x, 0, -z));
    make();
    this.frame = null;
  }

  private put(geometry: THREE.BufferGeometry, color: string, size: readonly [number, number, number], at: readonly [number, number, number], look: Look, picture?: { name: string; texture: THREE.Texture }) {
    const key = picture ? `p:${picture.name}:${look.glow ?? 0}` : look.flat ? `f:${color}:${look.flat}` : `${color}:${look.glow ?? 0}:${look.rough ?? 0}`;
    if (picture) this.pictures.set(key, picture.texture);
    this.looks.set(key, { color, look });
    const [rx, ry, rz] = look.turn ?? [0, 0, 0];
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(rx), rad(ry), rad(rz))), new THREE.Vector3(...size));
    this.pending.push({ geometry, matrix: this.frame ? matrix.premultiply(this.frame) : matrix, key });
  }

  /** A box standing on `y`, centred on `x` and `z`. */
  box(color: string, w: number, h: number, d: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('box', () => new THREE.BoxGeometry(1, 1, 1)), color, [w, h, d], [x, y + h / 2, z], look);
  }

  /** An upright tube standing on `y`. `top` is the radius at the top as a share of `r`: 1 a pipe, 0 a cone, 1.4 a cup. */
  tube(color: string, r: number, h: number, x: number, y: number, z: number, look: Look & { top?: number; sides?: number } = {}) {
    const top = look.top ?? 1, sides = look.sides ?? 18;
    this.put(this.kit.shape(`tube:${top}:${sides}`, () => new THREE.CylinderGeometry(top, 1, 1, sides)), color, [r, h, r], [x, y + h / 2, z], look);
  }

  /** A box standing on `y` whose top is smaller than its foot: `tw` and `td` are the top's width and depth as shares of the foot's. A hipped roof, a wall that leans in. */
  taper(color: string, w: number, h: number, d: number, x: number, y: number, z: number, tw: number, td: number, look: Look = {}) {
    const shape = this.kit.shape(`taper:${tw}:${td}`, () => {
      const box = new THREE.BoxGeometry(1, 1, 1), at = box.attributes.position;
      for (let i = 0; i < at.count; i++) if (at.getY(i) > 0) at.setXYZ(i, at.getX(i) * tw, 0.5, at.getZ(i) * td);
      box.computeVertexNormals();
      return box;
    });
    this.put(shape, color, [w, h, d], [x, y + h / 2, z], look);
  }

  /** A tube lying along the street (x) or reaching back from it (z), centred on the point given. */
  pipe(color: string, r: number, length: number, x: number, y: number, z: number, along: 'x' | 'z' = 'x', look: Look = {}) {
    this.put(this.kit.shape('tube:1:18', () => new THREE.CylinderGeometry(1, 1, 1, 18)), color, [r, length, r], [x, y, z], { ...look, turn: along === 'x' ? [0, 0, 90] : [90, 0, 0] });
  }

  ball(color: string, rx: number, ry: number, rz: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('ball', () => new THREE.SphereGeometry(1, 20, 14)), color, [rx, ry, rz], [x, y, z], look);
  }

  /** The upper half of a ball, sitting on `y`: a mound of foam, a dome, a lamp shade. */
  dome(color: string, rx: number, ry: number, rz: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('dome', () => new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)), color, [rx, ry, rz], [x, y, z], look);
  }

  /** A ring standing upright and facing the street: a cup's handle, a porthole's rim. */
  ring(color: string, r: number, thick: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('ring', () => new THREE.TorusGeometry(1, 0.22, 10, 22)), color, [r, r, thick / 0.44], [x, y, z], look);
  }

  /** A roof ridge running along the street, standing on `y`. `lean` moves the ridge: 0 a gable, 1 a saw tooth. */
  ridge(color: string, w: number, h: number, d: number, x: number, y: number, z: number, lean = 0, look: Look = {}) {
    const shape = this.kit.shape(`ridge:${lean}`, () => {
      const side = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(lean * 0.5, 1)]);
      return new THREE.ExtrudeGeometry(side, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
    });
    this.put(shape, color, [w, h, d], [x, y, z], look);
  }

  /** A flat rectangle facing the street, centred on the point given. */
  pane(color: string, w: number, h: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('pane', () => new THREE.PlaneGeometry(1, 1)), color, [w, h, 1], [x, y, z], look);
  }

  /** A flat disc facing the street, or lying on the ground with `turn: [-90, 0, 0]`. */
  disc(color: string, r: number, x: number, y: number, z: number, look: Look = {}) {
    this.put(this.kit.shape('disc', () => new THREE.CircleGeometry(1, 28)), color, [r, r, 1], [x, y, z], look);
  }

  /** A painted square facing the street. `sharp` paints it large enough for a logo or small print; `round` cuts it to the circle inside the square, for a round badge. */
  sign(name: string, paint: Painter, w: number, h: number, x: number, y: number, z: number, look: Look & { sharp?: boolean; round?: boolean } = {}) {
    const shape = look.round ? this.kit.shape('round', () => new THREE.CircleGeometry(0.5, 48)) : this.kit.shape('pane', () => new THREE.PlaneGeometry(1, 1));
    this.put(shape, '#fff', [w, h, 1], [x, y, z], look, { name, texture: this.kit.picture(name, paint, look.sharp ? 512 : 128) });
  }

  done(): Part[] {
    const groups = new Map<string, Pending[]>();
    for (const item of this.pending) groups.set(item.key, [...groups.get(item.key) ?? [], item]);
    return [...groups].map(([key, items]) => {
      const { color, look } = this.looks.get(key)!, copies = items.map(item => item.geometry.clone().applyMatrix4(item.matrix));
      const geometry = mergeGeometries(copies)!;
      for (const copy of copies) copy.dispose();
      return { geometry, material: this.kit.material(key, color, look, this.pictures.get(key)), shadow: !look.flat };
    });
  }
}

/**
 * A landmark on a place's far skyline, modelled at its own size in metres with its middle at (x, z). `reach` is how far
 * it spreads either side of that middle, so the plain blocks of the skyline keep out of its way. `lit` is 0 by day and
 * about 1.4 after dark, for windows and lamps to glow.
 */
type Sight = { reach: number; build(b: Build, x: number, z: number, lit: number): void };
/** What a place shows behind its shops: its landmarks, met in this order along the run, and what runs right behind the shops (a viaduct, a freeway). */
export type Skyline = { sights: readonly Sight[]; behind?(b: Build, length: number, train: boolean, lit: number): void };

export function meshes(parts: readonly Part[]) {
  const group = new THREE.Group();
  for (const part of parts) { const mesh = new THREE.Mesh(part.geometry, part.material); mesh.castShadow = mesh.receiveShadow = part.shadow; group.add(mesh); }
  return group;
}


const cupPath = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.moveTo(s * 0.26, s * 0.4); ctx.lineTo(s * 0.68, s * 0.4); ctx.lineTo(s * 0.62, s * 0.76); ctx.lineTo(s * 0.32, s * 0.76); ctx.closePath();
  ctx.moveTo(s * 0.68, s * 0.46); ctx.arc(s * 0.69, s * 0.55, s * 0.1, -Math.PI / 2, Math.PI / 2);
  for (const x of [0.38, 0.54]) { ctx.moveTo(s * x, s * 0.32); ctx.bezierCurveTo(s * (x + 0.08), s * 0.26, s * (x - 0.08), s * 0.2, s * x, s * 0.13); }
};
const beanPath = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(-0.5);
  ctx.moveTo(s * 0.34, 0); ctx.ellipse(0, 0, s * 0.34, s * 0.24, 0, 0, Math.PI * 2);
  ctx.moveTo(-s * 0.26, 0); ctx.bezierCurveTo(-s * 0.08, -s * 0.14, s * 0.08, s * 0.14, s * 0.26, 0);
  ctx.restore();
};
const heartPath = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.moveTo(s * 0.5, s * 0.8); ctx.bezierCurveTo(s * 0.05, s * 0.5, s * 0.2, s * 0.15, s * 0.5, s * 0.36); ctx.bezierCurveTo(s * 0.8, s * 0.15, s * 0.95, s * 0.5, s * 0.5, s * 0.8);
};
const paths = { cup: cupPath, bean: beanPath, heart: heartPath };

export const board = (shape: keyof typeof paths, ink: string, ground: string, fill = ink): Painter => (ctx, s) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  ctx.beginPath(); paths[shape](ctx, s); ctx.fillStyle = fill; ctx.fill(); ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.05; ctx.stroke();
};
export const neon = (what: keyof typeof paths | string, color: string, ground = '#0E0B24'): Painter => (ctx, s) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.1; ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = s * 0.06; ctx.lineJoin = ctx.lineCap = 'round';
  if (what in paths) { ctx.beginPath(); paths[what as keyof typeof paths](ctx, s); ctx.stroke(); ctx.stroke(); return; }
  ctx.font = `900 ${s * 0.36}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(what, s / 2, s / 2, s * 0.9); ctx.fillText(what, s / 2, s / 2, s * 0.9);
};
export const lights = (colors: readonly string[], columns: number, rows: number, share: number, ground: string, seed = 1): Painter => (ctx, s) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  const w = s / columns, h = s / rows;
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    const wave = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453, roll = wave - Math.floor(wave);
    if (roll > share) continue;
    ctx.fillStyle = colors[Math.floor(roll / share * colors.length) % colors.length]; ctx.fillRect(i * w + w * 0.22, j * h + h * 0.22, w * 0.56, h * 0.56);
  }
};


export const markShape = { badge: 1, logo: 678.73 / 197.15, mascot: 510.7 / 457.69 } as const;
type Mark = keyof typeof markShape;
const marks: Partial<Record<Mark, HTMLImageElement>> = {};
/** Fetches the three marks once, before the street is built. One that fails to load leaves its signs with what they showed before. */
export async function loadMarks() {
  await Promise.all((Object.keys(markShape) as Mark[]).map(async name => {
    try {
      const response = await fetch(`/icons/pa-cafe-${name}.svg`);
      if (!response.ok) return;
      // An SVG with no size of its own cannot be drawn to a canvas in every browser: give it one.
      const sized = (await response.text()).replace('<svg ', `<svg width="${Math.round(512 * markShape[name])}" height="512" `), image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
      await image.decode(); marks[name] = image;
    } catch {   }
  }));
}
/** One of the cafe's marks on a plain ground, filling a sign whose proportions are the mark's own (`markShape`). Falls back to `otherwise` if the mark did not load. */
export const mark = (name: Mark, ground: string, otherwise: Painter, margin = 0.06): Painter => (ctx, s) => {
  const image = marks[name];
  if (!image) { otherwise(ctx, s); return; }
  ctx.fillStyle = ground; ctx.fillRect(0, 0, s, s);
  ctx.drawImage(image, s * margin, s * margin, s * (1 - margin * 2), s * (1 - margin * 2));
};
