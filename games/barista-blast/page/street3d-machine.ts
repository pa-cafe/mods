import * as THREE from 'three';
import { CREAM, INK, MACHINE, RED, UNIT } from './art';
import { Build, type Kit, mark, markShape, meshes } from './street3d-kit';

const M = MACHINE.scale / UNIT, LEFT = -2.75, MID = LEFT + MACHINE.width * M / 2, FRONT = -0.14, BACK = -0.8;
const PIVOT = [LEFT + MACHINE.pivot[0] * M, -MACHINE.pivot[1] * M] as const, GAUGE = [LEFT + MACHINE.gauge[0] * M, -MACHINE.gauge[1] * M] as const;
const HEAD = [LEFT + 1.37, FRONT + 0.12] as const, HANDLE_TURN = 25, HANDLE = [Math.sin(HANDLE_TURN * Math.PI / 180), Math.cos(HANDLE_TURN * Math.PI / 180)] as const;
const GREEN = '#2F6B55', BASE = '#55665D', STEEL = '#DCE6EA', GREY = '#8FA0A8', COPPER = '#C9794B', GOLD = '#FFC83D', ROAST = '#4A2C1C';
/** How full the gauge is (0–1), and how far the machine has shaken sideways (metres). */
export type MachineState = { power: number; shake: number };

const face = (ctx: CanvasRenderingContext2D, s: number) => {
  const deg = (value: number) => value * Math.PI / 180, arc = (from: number, to: number, color: string) => { ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.38, deg(from), deg(to)); ctx.strokeStyle = color; ctx.lineWidth = s * 0.1; ctx.stroke(); };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s);
  arc(150, 390, STEEL); arc(150, 240, '#6BD49A'); arc(240, 320, GOLD); arc(320, 390, RED);
  ctx.fillStyle = INK; ctx.font = `800 ${s * 0.13}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BAR', s / 2, s * 0.8);
};
const name = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.fillStyle = GREEN; ctx.fillRect(0, 0, s, s);
  ctx.translate(s / 2, s / 2); ctx.transform(1, 0, -0.2, 1, 0, 0); ctx.scale(1, 3.6);
  ctx.fillStyle = CREAM; ctx.font = `italic 900 ${s * 0.2}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PA CAFE', 0, 0, s * 0.94);
};

export class Machine {
  readonly group = new THREE.Group();
  private needle = new THREE.Group();
  private parts = [] as ReturnType<Build['done']>;
  private lamp = new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.3 });
  private strip = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.4 });
  private glass = new THREE.MeshStandardMaterial({ color: '#fff', transparent: true, opacity: 0.35, roughness: 0.1 });
  private steam = new THREE.MeshStandardMaterial({ color: '#fff', transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
  private ball = new THREE.SphereGeometry(1, 14, 10);
  private box = new THREE.BoxGeometry(1, 1, 1);
  private jar = new THREE.CylinderGeometry(1, 0.8, 1, 20);
  private puffs: THREE.Object3D[] = [];

  constructor(kit: Kit) {
    const piece = (make: (b: Build) => void) => { const build = new Build(kit); make(build); const parts = build.done(); this.parts.push(...parts); return meshes(parts); };
    if (kit.models.has('common_machine_body')) {
      const body = piece(b => {
        b.finishes = { 'common-sage': '#A26C47', 'common-dark-timber': '#594B46' };
        b.model('common_machine_body', 0, 0, 0);
        b.sign('machine-gauge', face, 0.7, 0.7, GAUGE[0], GAUGE[1], -0.115, { round: true, sharp: true });
        b.sign('machine-lettering', (ctx, size) => {
          ctx.fillStyle = '#FFF1D9'; ctx.font = `bold ${size * 0.8}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PA CAFE', size / 2, size / 2, size);
        }, 1.1, 0.22, -1.80125, 1.51, -0.12, { cutout: true, sharp: true });
      });
      body.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        if (node.material.name === 'machine-power-lamp') { this.lamp.copy(node.material); node.material = this.lamp; }
        if (node.material.name === 'machine-power-strip') { this.strip.copy(node.material); node.material = this.strip; }
      });
      this.needle.add(piece(b => { b.model('common_machine_needle', 0, 0, 0); }));
      this.needle.position.set(-2.2385, 0.759, -0.09);
      const puff = piece(b => { b.model('common_steam_puff', 0, 0, 0); });
      puff.traverse(node => { if (node instanceof THREE.Mesh) node.material = this.steam; });
      for (let i = 0; i < 6; i++) this.puffs.push(puff.clone());
      this.group.add(body, this.needle, ...this.puffs);
      return;
    }
    this.group.add(piece(b => {
      b.box(BASE, 2.1, 0.18, 1.5, MID, 0, BACK);
      b.box(CREAM, 1.9, 1.1, 1.3, MID, 0.18, BACK, { rough: 0.5 }); b.box(GREEN, 1.9, 0.46, 1.3, MID, 1.28, BACK, { rough: 0.5 }); b.box(INK, 1.92, 0.04, 1.32, MID, 1.26, BACK);
      b.sign('machine-name', mark('logo', GREEN, name, 0.04), 0.4 * markShape.logo, 0.4, MID, 1.51, FRONT + 0.01, { sharp: true });
      b.box(STEEL, 1.54, 0.34, 1.04, MID, 1.74, BACK, { rough: 0.25 }); b.box(GREY, 1.6, 0.05, 1.1, MID, 2.08, BACK, { rough: 0.3 });
      for (let i = 0; i < 4; i++) for (const z of [-0.5, -1]) b.tube('#fff', 0.1, 0.22, LEFT + 0.5 + i * 0.3, 2.13, z, { top: 1.25 });
      b.tube(INK, 0.42, 0.06, GAUGE[0], GAUGE[1] - 0.03, FRONT - 0.02, { turn: [90, 0, 0], sides: 48 });
      b.sign('machine-gauge', face, 0.74, 0.74, GAUGE[0], GAUGE[1], FRONT + 0.03, { round: true, sharp: true });
      b.box(STEEL, 0.7, 0.22, 0.5, LEFT + 1.37, 0.87, FRONT + 0.1, { rough: 0.25 }); b.box(GREY, 0.5, 0.14, 0.34, LEFT + 1.37, 0.73, FRONT + 0.12);
      b.box(STEEL, 0.72, 0.1, 0.5, LEFT + 1.37, 0.2, FRONT + 0.12, { rough: 0.3 }); b.tube('#fff', 0.11, 0.24, LEFT + 1.37, 0.3, FRONT + 0.14, { top: 1.3 }); b.tube(ROAST, 0.135, 0.02, LEFT + 1.37, 0.53, FRONT + 0.14);
      b.tube(STEEL, 0.19, 0.11, HEAD[0], 0.62, HEAD[1], { rough: 0.25 }); b.tube(INK, 0.2, 0.03, HEAD[0], 0.7, HEAD[1]);
      const along = (far: number) => [HEAD[0] + HANDLE[0] * far, HEAD[1] + HANDLE[1] * far] as const, turn = [90, 0, -HANDLE_TURN] as const;
      b.tube(GREY, 0.045, 0.16, along(0.27)[0], 0.675 - 0.08, along(0.27)[1], { rough: 0.3, turn }); b.tube(INK, 0.07, 0.5, along(0.6)[0], 0.675 - 0.25, along(0.6)[1], { rough: 0.6, turn });
      b.ball(INK, 0.07, 0.07, 0.07, along(0.85)[0], 0.675, along(0.85)[1], { rough: 0.6 });
      b.tube(COPPER, 0.06, 1.1, LEFT + 1.98, 0.18, BACK + 0.3, { rough: 0.3 }); b.pipe(COPPER, 0.06, 0.5, LEFT + 1.98, PIVOT[1], BACK + 0.55, 'z', { rough: 0.3 });
      b.pipe(BASE, 0.17, 0.3, PIVOT[0], PIVOT[1], 0, 'z'); b.pipe(INK, 0.08, 0.34, PIVOT[0], PIVOT[1], 0, 'z');
      b.tube(ROAST, 0.24, 0.34, LEFT + 0.42, 2.1, BACK, { top: 1.25 }); b.tube(GREY, 0.36, 0.06, LEFT + 0.42, 2.72, BACK); b.ball(INK, 0.07, 0.07, 0.07, LEFT + 0.42, 2.82, BACK);
    }));
    const hopper = new THREE.Mesh(this.jar, this.glass); hopper.scale.set(0.34, 0.6, 0.34); hopper.position.set(LEFT + 0.42, 2.4, BACK);
    const lamp = new THREE.Mesh(this.ball, this.lamp); lamp.scale.setScalar(0.08); lamp.position.set(LEFT + 1.75, 1.05, FRONT + 0.04);
    const strip = new THREE.Mesh(this.box, this.strip); strip.scale.set(1.86, 0.05, 0.03); strip.position.set(MID, 1.2, FRONT + 0.01);
    this.needle.add(piece(b => { b.box(INK, 0.3, 0.05, 0.02, 0.13, -0.025, 0); b.tube(INK, 0.06, 0.03, 0, 0, 0, { turn: [90, 0, 0] }); }));
    this.needle.position.set(GAUGE[0], GAUGE[1], FRONT + 0.05);
    for (let i = 0; i < 6; i++) { const puff = new THREE.Mesh(this.ball, this.steam); this.puffs.push(puff); this.group.add(puff); }
    this.group.add(hopper, lamp, strip, this.needle);
    this.group.traverse(node => { if (node instanceof THREE.Mesh && node.material !== this.steam && node.material !== this.glass) node.castShadow = node.receiveShadow = true; });
  }

  pose({ power, shake }: MachineState, now: number) {
    this.group.position.x = shake;
    this.needle.rotation.z = (210 - power * 240) * Math.PI / 180;
    this.lamp.emissiveIntensity = 0.3 + power * 3 * (0.6 + 0.4 * Math.sin(now * 0.02));
    this.strip.emissiveIntensity = 0.4 + power * 2.2;
    this.puffs.forEach((puff, i) => {
      const life = (now * (0.00035 + power * 0.0009) + i / this.puffs.length) % 1, size = (0.08 + life * 0.3) * (0.7 + power * 1.3);
      puff.position.set(LEFT + 1.55 + Math.sin(i * 2.4 + life * 4) * 0.12 + life * 0.3, 2.2 + life * (1.2 + power * 1.6), BACK + 0.2);
      puff.scale.setScalar(size); puff.visible = life < 0.95;
    });
    this.steam.opacity = 0.35 + power * 0.4;
  }

  dispose() {
    for (const part of this.parts) part.geometry.dispose();
    for (const item of [this.lamp, this.strip, this.glass, this.steam, this.ball, this.box, this.jar]) item.dispose();
  }
}
