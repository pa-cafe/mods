import * as THREE from 'three';
import { hash } from './art';
import { neonColors } from './gemini-elements';
import { FACE, TILE } from './street3d-sets';

/**
 * The night in neon along one place's street: tubes round the shopfronts, signs, lamps with a pool of light under each and
 * streaks of it on the wet road. Everything is its own colour and glows without being lit, and everything is a plain mesh,
 * so it sits in the same scene as the street without changing how the street is lit or built. Fades in and out with `level`.
 */
const SIGNS = ['Ne', 'H', 'C', 'Ar', 'OPEN', 'cup', 'GEMINI 4', 'bean'] as const;
const DARK = '#171030';
const tau = Math.PI * 2;

const glowTexture = () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, fade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, 'rgba(255,255,255,1)'); fade.addColorStop(0.25, 'rgba(255,255,255,.55)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

function paintSign(ctx: CanvasRenderingContext2D, sign: string, color: string, w: number, h: number) {
  ctx.fillStyle = DARK; ctx.beginPath(); ctx.roundRect(0, 0, w, h, h * 0.16); ctx.fill();
  ctx.shadowColor = color; ctx.shadowBlur = h * 0.07; ctx.strokeStyle = ctx.fillStyle = color; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.035; ctx.beginPath(); ctx.roundRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12, h * 0.12); ctx.stroke(); ctx.stroke();
  ctx.lineWidth = h * 0.045;
  if (sign === 'cup') {
    ctx.beginPath(); ctx.moveTo(w * 0.34, h * 0.36); ctx.lineTo(w * 0.62, h * 0.36); ctx.lineTo(w * 0.57, h * 0.7); ctx.lineTo(w * 0.39, h * 0.7); ctx.closePath();
    ctx.moveTo(w * 0.62, h * 0.42); ctx.arc(w * 0.63, h * 0.5, h * 0.09, -Math.PI / 2, Math.PI / 2);
    for (const x of [0.43, 0.53]) { ctx.moveTo(w * x, h * 0.3); ctx.bezierCurveTo(w * (x + 0.05), h * 0.24, w * (x - 0.05), h * 0.2, w * x, h * 0.14); }
    ctx.stroke(); ctx.stroke();
  } else if (sign === 'bean') {
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.26, h * 0.19, 0, 0, tau); ctx.moveTo(-w * 0.19, 0); ctx.bezierCurveTo(-w * 0.06, -h * 0.12, w * 0.06, h * 0.12, w * 0.19, 0);
    ctx.stroke(); ctx.stroke(); ctx.restore();
  } else {
    const long = sign.length > 3;
    ctx.font = `900 ${h * (long ? 0.3 : sign.length > 1 ? 0.52 : 0.6)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sign, w / 2, h * 0.53, w * 0.82); ctx.fillText(sign, w / 2, h * 0.53, w * 0.82);
  }
}

export class NeonRig {
  readonly group = new THREE.Group();
  private tiles = new Map<number, THREE.Group>();
  private glow = glowTexture();
  private halos = new Map<string, THREE.MeshBasicMaterial>();
  private tubes = new Map<string, THREE.MeshBasicMaterial>();
  private signs = new Map<string, THREE.MeshBasicMaterial>();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private pane = new THREE.PlaneGeometry(1, 1);
  private pole = new THREE.CylinderGeometry(1, 1, 1, 10);
  private ball = new THREE.SphereGeometry(1, 14, 10);
  private dark = new THREE.MeshBasicMaterial({ color: DARK, transparent: true, fog: false });
  constructor() { this.group.visible = false; }

  private halo(color: string, strength: number) {
    const key = `${color}:${strength}`;
    let made = this.halos.get(key);
    if (!made) {
      made = new THREE.MeshBasicMaterial({ map: this.glow, color, transparent: true, opacity: strength, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      made.userData.strength = strength; this.halos.set(key, made);
    }
    return made;
  }
  private tube(color: string) {
    let made = this.tubes.get(color);
    if (!made) { made = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.45), transparent: true, fog: false }); made.userData.strength = 1; this.tubes.set(color, made); }
    return made;
  }
  private sign(text: string, color: string, w: number, h: number) {
    const key = `${text}:${color}`;
    let made = this.signs.get(key);
    if (!made) {
      const canvas = document.createElement('canvas'); canvas.width = Math.round(256 * w / h); canvas.height = 256;
      paintSign(canvas.getContext('2d')!, text, color, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      made = new THREE.MeshBasicMaterial({ map: texture, transparent: true, fog: false }); made.userData.strength = 1; made.userData.texture = texture;
      this.signs.set(key, made);
    }
    return made;
  }

  /** One lit tube, `w` by `h` metres, in the colour given. */
  private bar(group: THREE.Group, color: string, w: number, h: number, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(this.box, this.tube(color)); mesh.scale.set(w, h, 0.09); mesh.position.set(x, y, z); group.add(mesh);
  }
  private blob(group: THREE.Group, color: string, strength: number, w: number, h: number, x: number, y: number, z: number, flat = false) {
    const mesh = new THREE.Mesh(this.pane, this.halo(color, strength)); mesh.scale.set(w, h, 1); mesh.position.set(x, y, z); mesh.renderOrder = 6;
    if (flat) mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
  }

  private tile(index: number, rich: boolean) {
    const group = new THREE.Group(), at = (salt: number) => hash(index, 100 + salt), pick = (salt: number) => neonColors[Math.floor(at(salt) * neonColors.length)];
    const first = pick(0), second = neonColors[(neonColors.indexOf(first) + 2) % neonColors.length], z = FACE + 0.3;
    group.position.x = index * TILE;
    // The shopfront in tubes: a band along the top and a frame round the window.
    const top = 3.1 + at(1) * 0.9;
    this.bar(group, first, 5.6, 0.1, TILE / 2, top, z); this.blob(group, first, 0.55, 7.6, 1.8, TILE / 2, top, z + 0.05);
    const wx = TILE / 2, wy = 1.7, ww = 3.4, wh = 1.5;
    this.bar(group, second, ww, 0.08, wx, wy + wh / 2, z); this.bar(group, second, ww, 0.08, wx, wy - wh / 2, z);
    this.bar(group, second, 0.08, wh, wx - ww / 2, wy, z); this.bar(group, second, 0.08, wh, wx + ww / 2, wy, z);
    this.blob(group, second, 0.4, ww + 2.6, wh + 2, wx, wy, z + 0.05);
    // A sign on a bracket: an element, a cup, an OPEN.
    const text = SIGNS[Math.floor(at(2) * SIGNS.length)], color = pick(3), wide = text.length > 3, w = wide ? 3.4 : 1.7, h = wide ? 1.2 : 1.7, sx = 0.9 + at(4) * (TILE - 1.8);
    const board = new THREE.Mesh(this.pane, this.sign(text, color, w, h)); board.scale.set(w, h, 1); board.position.set(sx, top + 1.3 + h / 2, z + 0.3); group.add(board);
    this.blob(group, color, 0.7, w * 2.6, h * 2.6, sx, top + 1.3 + h / 2, z + 0.25);
    // A lamp on every other tile, with its pool of light on the pavement and its streak on the road.
    if (index % 2 === 0) {
      const lamp = pick(5), lx = at(6) > 0.5 ? 0.4 : TILE - 0.4, lz = -2.6, height = 4.6;
      const post = new THREE.Mesh(this.pole, this.dark); post.scale.set(0.07, height, 0.07); post.position.set(lx, height / 2, lz);
      const head = new THREE.Mesh(this.ball, this.tube(lamp)); head.scale.set(0.24, 0.24, 0.24); head.position.set(lx, height + 0.1, lz); group.add(post, head);
      this.blob(group, lamp, 0.8, 4.2, 4.2, lx, height + 0.1, lz + 0.1);
      this.blob(group, lamp, 0.6, 6.4, 3.2, lx, 0.05, lz + 0.4, true);
      if (rich) this.blob(group, lamp, 0.3, 1.1, 5.5, lx + 0.5, 0.04, 5.5, true);
    }
    return group;
  }

  /** Puts the tiles from `first` to `last` along the street, lit to `level`. Off at 0. `rich` adds the streaks on the road. */
  update(scene: THREE.Scene, first: number, last: number, level: number, now: number, rich: boolean) {
    this.group.visible = level > 0.01;
    if (!this.group.visible) return;
    if (!this.group.parent) scene.add(this.group);
    for (const [index, tile] of this.tiles) if (index < first || index > last) { this.group.remove(tile); this.tiles.delete(index); }
    for (let index = first; index <= last; index++) if (!this.tiles.has(index)) { const tile = this.tile(index, rich); this.tiles.set(index, tile); this.group.add(tile); }
    const pulse = 0.93 + 0.07 * Math.sin(now / 380);
    for (const group of [this.halos, this.tubes, this.signs]) for (const material of group.values()) material.opacity = Math.min(1, material.userData.strength * level * (group === this.halos ? pulse : 1));
    this.dark.opacity = level;
  }

  dispose() {
    for (const group of [this.halos, this.tubes, this.signs]) for (const material of group.values()) { (material.userData.texture as THREE.Texture | undefined)?.dispose(); material.dispose(); }
    this.dark.dispose();
    this.glow.dispose(); this.box.dispose(); this.pane.dispose(); this.pole.dispose(); this.ball.dispose();
    this.group.removeFromParent(); this.tiles.clear();
  }
}
