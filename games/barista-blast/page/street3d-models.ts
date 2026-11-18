import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { thoughtLabel } from './street3d-blank';
import type { Kit } from './street3d-kit';

// Static URLs let the host's bundler fingerprint these exact, repository-owned files.
// Only the district entering the camera is fetched. Missing pieces use their original builders.
const districts = [
  {
    'tpe_101_refined': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_101_refined.glb', import.meta.url).href,
    'cks-memorial-refined': new URL('../art-source/momo-20261118/blast_memorial_fix_20261118/cks-memorial-refined.glb', import.meta.url).href,
    'tpe_mrt_viaduct_tile14m': new URL('../art-source/momo-20261118/blast_taipei_metro_20261118/assets/tpe_mrt_viaduct_tile14m.glb', import.meta.url).href,
    'tpe_mrt_train_2car_tile14m': new URL('../art-source/momo-20261118/blast_taipei_metro_20261118/assets/tpe_mrt_train_2car_tile14m.glb', import.meta.url).href,
    'tpe_distant_skyline': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_distant_skyline.glb', import.meta.url).href,
    'tpe_cafe_front': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_cafe_front.glb', import.meta.url).href,
    'tpe_tea_front': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_tea_front.glb', import.meta.url).href,
    'tpe_arcade_front': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_arcade_front.glb', import.meta.url).href,
    'tpe_coffee_kiosk': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_coffee_kiosk.glb', import.meta.url).href,
    'tpe_soft_cloud': new URL('../art-source/momo-20261118/blast_taipei_v2_20261118/assets/tpe_soft_cloud.glb', import.meta.url).href,
  },
  {
    'hsinchu_wafer_fab_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_wafer_fab_v2.glb', import.meta.url).href,
    'hsinchu_office_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_office_v2.glb', import.meta.url).href,
    'hsinchu_cooling_tower_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_cooling_tower_v2.glb', import.meta.url).href,
    'hsinchu_substation_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_substation_v2.glb', import.meta.url).href,
    'hsinchu_wind_turbine_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_wind_turbine_v2.glb', import.meta.url).href,
    'hsinchu_pipe_gantry_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_pipe_gantry_v2.glb', import.meta.url).href,
    'hsinchu_tank_pair_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_tank_pair_v2.glb', import.meta.url).href,
    'hsinchu_utility_hall_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/hsinchu_utility_hall_v2.glb', import.meta.url).href,
  },
  {
    'sfv2_golden_gate': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_golden_gate.glb', import.meta.url).href,
    'sfv2_transamerica_pyramid': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_transamerica_pyramid.glb', import.meta.url).href,
    'sfv2_coit_tower': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_coit_tower.glb', import.meta.url).href,
    'sfv2_painted_ladies': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_painted_ladies.glb', import.meta.url).href,
    'sfv2_deco_arcade': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_deco_arcade.glb', import.meta.url).href,
    'sfv2_neon_diner': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_neon_diner.glb', import.meta.url).href,
    'sfv2_back_skyline': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/sfv2_back_skyline.glb', import.meta.url).href,
  },
  {
    'orbital_data_station_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/orbital_data_station_v2.glb', import.meta.url).href,
    'lunar_base_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/lunar_base_v2.glb', import.meta.url).href,
    'solar_satellite_unit_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/solar_satellite_unit_v2.glb', import.meta.url).href,
    'dyson_sphere_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/dyson_sphere_v2.glb', import.meta.url).href,
    'milk_foam_drift_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/milk_foam_drift_v2.glb', import.meta.url).href,
    'coffee_cup_habitat_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/coffee_cup_habitat_v2.glb', import.meta.url).href,
    'moka_lander_v2': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/moka_lander_v2.glb', import.meta.url).href,
  },
  {
    'd5_server_temple': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/d5_server_temple.glb', import.meta.url).href,
    'd5_celestial_halo': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/d5_celestial_halo.glb', import.meta.url).href,
    'd5_divine_gpu': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/d5_divine_gpu.glb', import.meta.url).href,
    'd5_cloud_island': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/d5_cloud_island.glb', import.meta.url).href,
    'd5_portal_colonnade': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/d5_portal_colonnade.glb', import.meta.url).href,
  },
  {
    'v6_thinking_monolith': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/v6_thinking_monolith.glb', import.meta.url).href,
    'v6_monolith_dais': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/v6_monolith_dais.glb', import.meta.url).href,
    'v6_coffee_cup': new URL('../art-source/momo-20261118/blast_five_stages_v2_20261118/assets/v6_coffee_cup.glb', import.meta.url).href,
  },
] as const;

type Keys<T> = T extends unknown ? keyof T : never;
export type ModelId = Keys<typeof districts[number]>;
export type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

export class StreetModels {
  private readonly pending = new Map<number, Promise<void>>();
  private readonly loader = new GLTFLoader();
  private readonly stop = new AbortController();

  constructor(private readonly kit: Kit) {}

  warm(place: number) {
    let pending = this.pending.get(place);
    if (!pending) {
      pending = this.loadDistrict(place);
      this.pending.set(place, pending);
    }
    return pending;
  }

  private async loadDistrict(place: number) {
    const loaded = await Promise.all(Object.entries(districts[place]).map(async ([id, url]) => {
      try {
        const response = await fetch(url, { signal: this.stop.signal });
        if (!response.ok) return;
        const { scene } = await this.loader.parseAsync(await response.arrayBuffer(), '');
        scene.updateMatrixWorld(true);
        const parts: ModelMesh[] = [];
        scene.traverse(node => {
          if (node instanceof THREE.Mesh) parts.push(node as ModelMesh);
        });
        return { id: id as ModelId, parts };
      } catch { return; }
    }));
    for (const asset of loaded) {
      if (!asset) continue;
      if (this.stop.signal.aborted) {
        for (const mesh of asset.parts) { mesh.geometry.dispose(); mesh.material.dispose(); }
        continue;
      }
      for (const { material } of asset.parts) {
        if (material.name === 'v6-runtime-face') {
          material.map = thoughtLabel(this.kit);
          material.color.set('#fff');
          material.emissive.set('#fff');
          material.emissiveMap = material.map;
          material.emissiveIntensity = 0.55;
        }
      }
      this.kit.models.set(asset.id, asset.parts);
    }
  }

  dispose() {
    this.stop.abort();
    for (const parts of this.kit.models.values()) {
      for (const mesh of parts) { mesh.geometry.dispose(); mesh.material.dispose(); }
    }
    this.kit.models.clear();
  }
}
