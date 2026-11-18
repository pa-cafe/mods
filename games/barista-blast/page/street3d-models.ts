import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { thoughtLabel } from './street3d-blank';
import type { Kit } from './street3d-kit';

// Static URLs let the host's bundler fingerprint these exact, repository-owned files.
// Only the district entering the camera is fetched. Missing pieces use their original builders.
const districts = [
  {
    'tpe3_101_jade_refined': new URL('../art-source/momo-20261118/blast_taipei_v3_20261118/assets/tpe3_101_jade_refined.glb?no-inline', import.meta.url).href,
    'tpe3_corner_cafe_7m': new URL('../art-source/momo-20261118/blast_taipei_v3_20261118/assets/tpe3_corner_cafe_7m.glb?no-inline', import.meta.url).href,
    'tpe3_arcade_apartment_7m': new URL('../art-source/momo-20261118/blast_taipei_v3_20261118/assets/tpe3_arcade_apartment_7m.glb?no-inline', import.meta.url).href,
    'cks-memorial-refined': new URL('../art-source/momo-20261118/blast_memorial_fix_20261118/cks-memorial-refined.glb?no-inline', import.meta.url).href,
    'tpe_mrt_viaduct_tile14m': new URL('../art-source/momo-20261118/blast_taipei_metro_20261118/assets/tpe_mrt_viaduct_tile14m.glb?no-inline', import.meta.url).href,
    'tpe_mrt_train_2car_tile14m': new URL('../art-source/momo-20261118/blast_taipei_metro_20261118/assets/tpe_mrt_train_2car_tile14m.glb?no-inline', import.meta.url).href,
    'tpe4_longshan_low_courtyard': new URL('../art-source/momo-20261118/blast_temple_v4_20261118/assets/tpe4_longshan_low_courtyard.glb?no-inline', import.meta.url).href,
    'tpe5_grand_hotel_yuanshan': new URL('../art-source/momo-20261118/blast_taipei_hotel_v5_20261118/assets/tpe5_grand_hotel_yuanshan.glb?no-inline', import.meta.url).href,
    'tpe5_bubble_tea_shop_7m': new URL('../art-source/momo-20261118/blast_taipei_shopfill_v5_20261118/assets/tpe5_bubble_tea_shop_7m.glb?no-inline', import.meta.url).href,
    'tpe5_gabled_cafe_7m': new URL('../art-source/momo-20261118/blast_taipei_shopfill_v5_20261118/assets/tpe5_gabled_cafe_7m.glb?no-inline', import.meta.url).href,
    'tpe5_air_conditioner': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_air_conditioner.glb?no-inline', import.meta.url).href,
    'tpe5_bakery_loaf': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_bakery_loaf.glb?no-inline', import.meta.url).href,
    'tpe5_cafe_parasol': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_cafe_parasol.glb?no-inline', import.meta.url).href,
    'tpe5_cloud_lobe': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_cloud_lobe.glb?no-inline', import.meta.url).href,
    'tpe5_coffee_cart': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_coffee_cart.glb?no-inline', import.meta.url).href,
    'tpe5_crossing_signal': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_crossing_signal.glb?no-inline', import.meta.url).href,
    'tpe5_distant_hill': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_distant_hill.glb?no-inline', import.meta.url).href,
    'tpe5_far_tower_0': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_far_tower_0.glb?no-inline', import.meta.url).href,
    'tpe5_far_tower_1': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_far_tower_1.glb?no-inline', import.meta.url).href,
    'tpe5_far_tower_2': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_far_tower_2.glb?no-inline', import.meta.url).href,
    'tpe5_flower_planter': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_flower_planter.glb?no-inline', import.meta.url).href,
    'tpe5_hedge_7m': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_hedge_7m.glb?no-inline', import.meta.url).href,
    'tpe5_park_fence_7m': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_park_fence_7m.glb?no-inline', import.meta.url).href,
    'tpe5_parked_bicycle': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_parked_bicycle.glb?no-inline', import.meta.url).href,
    'tpe5_parked_scooter': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_parked_scooter.glb?no-inline', import.meta.url).href,
    'tpe5_roof_bubble_tea': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_roof_bubble_tea.glb?no-inline', import.meta.url).href,
    'tpe5_roof_chimney': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_roof_chimney.glb?no-inline', import.meta.url).href,
    'tpe5_roof_water_tank': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_roof_water_tank.glb?no-inline', import.meta.url).href,
    'tpe5_runtime_plaque_tall': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_runtime_plaque_tall.glb?no-inline', import.meta.url).href,
    'tpe5_runtime_plaque_wide': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_runtime_plaque_wide.glb?no-inline', import.meta.url).href,
    'tpe5_skyline_block': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_skyline_block.glb?no-inline', import.meta.url).href,
    'tpe5_miramar_gondola': new URL('../art-source/momo-20261118/blast_taipei_wheel_v5_20261118/assets/tpe5_miramar_gondola.glb?no-inline', import.meta.url).href,
    'tpe5_miramar_mall_support': new URL('../art-source/momo-20261118/blast_taipei_wheel_v5_20261118/assets/tpe5_miramar_mall_support.glb?no-inline', import.meta.url).href,
    'tpe5_miramar_wheel_rotor': new URL('../art-source/momo-20261118/blast_taipei_wheel_v5_20261118/assets/tpe5_miramar_wheel_rotor.glb?no-inline', import.meta.url).href,
  },
  {
    'hsc3_cable_span_14m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_cable_span_14m.glb?no-inline', import.meta.url).href,
    'hsc3_cafe_chair': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_cafe_chair.glb?no-inline', import.meta.url).href,
    'hsc3_cafe_table': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_cafe_table.glb?no-inline', import.meta.url).href,
    'hsc3_cooling_deck': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_cooling_deck.glb?no-inline', import.meta.url).href,
    'hsc3_cooling_tower': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_cooling_tower.glb?no-inline', import.meta.url).href,
    'hsc3_crate': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_crate.glb?no-inline', import.meta.url).href,
    'hsc3_drum_roaster_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_drum_roaster_7m.glb?no-inline', import.meta.url).href,
    'hsc3_fab_hall': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_fab_hall.glb?no-inline', import.meta.url).href,
    'hsc3_fab_office': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_fab_office.glb?no-inline', import.meta.url).href,
    'hsc3_fab_skybridge': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_fab_skybridge.glb?no-inline', import.meta.url).href,
    'hsc3_far_factory_14m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_far_factory_14m.glb?no-inline', import.meta.url).href,
    'hsc3_kettle_gantry_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_kettle_gantry_7m.glb?no-inline', import.meta.url).href,
    'hsc3_low_loading_yard_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_low_loading_yard_7m.glb?no-inline', import.meta.url).href,
    'hsc3_planter': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_planter.glb?no-inline', import.meta.url).href,
    'hsc3_power_boiler': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_power_boiler.glb?no-inline', import.meta.url).href,
    'hsc3_power_flue_filter': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_power_flue_filter.glb?no-inline', import.meta.url).href,
    'hsc3_power_secondary_stack': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_power_secondary_stack.glb?no-inline', import.meta.url).href,
    'hsc3_power_striped_chimney': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_power_striped_chimney.glb?no-inline', import.meta.url).href,
    'hsc3_power_turbine_hall': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_power_turbine_hall.glb?no-inline', import.meta.url).href,
    'hsc3_pylon_14m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_pylon_14m.glb?no-inline', import.meta.url).href,
    'hsc3_road_tile_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_road_tile_7m.glb?no-inline', import.meta.url).href,
    'hsc3_sawtooth_roastery_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_sawtooth_roastery_7m.glb?no-inline', import.meta.url).href,
    'hsc3_shift_canteen_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_shift_canteen_7m.glb?no-inline', import.meta.url).href,
    'hsc3_silo_pair_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_silo_pair_7m.glb?no-inline', import.meta.url).href,
    'hsc3_smoke_cluster_unit': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_smoke_cluster_unit.glb?no-inline', import.meta.url).href,
    'hsc3_steam_cluster_unit': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_steam_cluster_unit.glb?no-inline', import.meta.url).href,
    'hsc3_streetlamp': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_streetlamp.glb?no-inline', import.meta.url).href,
    'hsc3_substation': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_substation.glb?no-inline', import.meta.url).href,
    'hsc3_tree': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_tree.glb?no-inline', import.meta.url).href,
    'hsc3_walk_tile_7m': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_walk_tile_7m.glb?no-inline', import.meta.url).href,
    'hsc3_wind_dune': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_wind_dune.glb?no-inline', import.meta.url).href,
    'hsc3_wind_rotor': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_wind_rotor.glb?no-inline', import.meta.url).href,
    'hsc3_wind_tower': new URL('../art-source/momo-20261118/blast_hsinchu_full_v3_20261118/assets/hsc3_wind_tower.glb?no-inline', import.meta.url).href,
  },
  {
    'sf3_billboard_garage_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_billboard_garage_7m.glb?no-inline', import.meta.url).href,
    'sf3_communications_hut_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_communications_hut_7m.glb?no-inline', import.meta.url).href,
    'sf3_delivery_truck': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_delivery_truck.glb?no-inline', import.meta.url).href,
    'sf3_freeway_14m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_freeway_14m.glb?no-inline', import.meta.url).href,
    'sf3_highrise_shop_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_highrise_shop_7m.glb?no-inline', import.meta.url).href,
    'sf3_neon_cafe_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_neon_cafe_7m.glb?no-inline', import.meta.url).href,
    'sf3_roadside_billboard': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_roadside_billboard.glb?no-inline', import.meta.url).href,
    'sf3_sedan': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_sedan.glb?no-inline', import.meta.url).href,
    'sf3_server_exchange_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_server_exchange_7m.glb?no-inline', import.meta.url).href,
    'sf3_vending_alley_7m': new URL('../art-source/momo-20261118/blast_sf_v3_20261118/assets/sf3_vending_alley_7m.glb?no-inline', import.meta.url).href,
    'sf4_billboard_1': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_billboard_1.glb?no-inline', import.meta.url).href,
    'sf4_billboard_2': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_billboard_2.glb?no-inline', import.meta.url).href,
    'sf4_billboard_3': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_billboard_3.glb?no-inline', import.meta.url).href,
    'sf4_cloud_bank': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_cloud_bank.glb?no-inline', import.meta.url).href,
    'sf4_coit_hill_complete': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_coit_hill_complete.glb?no-inline', import.meta.url).href,
    'sf4_crescent_moon': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_crescent_moon.glb?no-inline', import.meta.url).href,
    'sf4_far_block_0': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_far_block_0.glb?no-inline', import.meta.url).href,
    'sf4_far_block_1': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_far_block_1.glb?no-inline', import.meta.url).href,
    'sf4_far_block_2': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_far_block_2.glb?no-inline', import.meta.url).href,
    'sf4_golden_gate_complete': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_golden_gate_complete.glb?no-inline', import.meta.url).href,
    'sf4_ground_7m': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_ground_7m.glb?no-inline', import.meta.url).href,
    'sf4_painted_ladies_complete': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_painted_ladies_complete.glb?no-inline', import.meta.url).href,
    'sf4_transamerica_complete': new URL('../art-source/momo-20261118/blast_sf_v4_20261118/assets/sf4_transamerica_complete.glb?no-inline', import.meta.url).href,
  },
  {
    'orb3_cup_eyes_station_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_cup_eyes_station_7m.glb?no-inline', import.meta.url).href,
    'orb3_drifting_bean_cluster_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_drifting_bean_cluster_7m.glb?no-inline', import.meta.url).href,
    'orb3_foam_bank': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_foam_bank.glb?no-inline', import.meta.url).href,
    'orb3_latte_heart_hill_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_latte_heart_hill_7m.glb?no-inline', import.meta.url).href,
    'orb3_spoon_bean_garden_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_spoon_bean_garden_7m.glb?no-inline', import.meta.url).href,
    'orb3_sugar_constellation_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_sugar_constellation_7m.glb?no-inline', import.meta.url).href,
    'orb3_tripod_moka_robot_7m': new URL('../art-source/momo-20261118/blast_orbit_v3_20261118/assets/orb3_tripod_moka_robot_7m.glb?no-inline', import.meta.url).href,
    'orb4_data_station_landmark': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_data_station_landmark.glb?no-inline', import.meta.url).href,
    'orb4_dyson_core': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_dyson_core.glb?no-inline', import.meta.url).href,
    'orb4_dyson_panel_shell': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_dyson_panel_shell.glb?no-inline', import.meta.url).href,
    'orb4_far_foam_dome': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_far_foam_dome.glb?no-inline', import.meta.url).href,
    'orb4_gag_arm_left': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_arm_left.glb?no-inline', import.meta.url).href,
    'orb4_gag_arm_right': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_arm_right.glb?no-inline', import.meta.url).href,
    'orb4_gag_fire': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_fire.glb?no-inline', import.meta.url).href,
    'orb4_gag_flame': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_flame.glb?no-inline', import.meta.url).href,
    'orb4_gag_flash': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_flash.glb?no-inline', import.meta.url).href,
    'orb4_gag_launch_tower': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_launch_tower.glb?no-inline', import.meta.url).href,
    'orb4_gag_puff': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_puff.glb?no-inline', import.meta.url).href,
    'orb4_gag_roadster_left': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_roadster_left.glb?no-inline', import.meta.url).href,
    'orb4_gag_roadster_right': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_roadster_right.glb?no-inline', import.meta.url).href,
    'orb4_gag_rocket': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_rocket.glb?no-inline', import.meta.url).href,
    'orb4_gag_shard_ivory': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_shard_ivory.glb?no-inline', import.meta.url).href,
    'orb4_gag_shard_rose': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_shard_rose.glb?no-inline', import.meta.url).href,
    'orb4_gag_train_satellite': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_gag_train_satellite.glb?no-inline', import.meta.url).href,
    'orb4_ground_7m': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_ground_7m.glb?no-inline', import.meta.url).href,
    'orb4_moon_base_landmark': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_moon_base_landmark.glb?no-inline', import.meta.url).href,
    'orb4_near_variant_0': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_near_variant_0.glb?no-inline', import.meta.url).href,
    'orb4_near_variant_1': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_near_variant_1.glb?no-inline', import.meta.url).href,
    'orb4_near_variant_2': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_near_variant_2.glb?no-inline', import.meta.url).href,
    'orb4_near_variant_3': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_near_variant_3.glb?no-inline', import.meta.url).href,
    'orb4_satellite_landmark_unit': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_satellite_landmark_unit.glb?no-inline', import.meta.url).href,
    'orb4_sky_bean': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_sky_bean.glb?no-inline', import.meta.url).href,
    'orb4_sky_cloud': new URL('../art-source/momo-20261118/blast_orbit_v4_20261118/assets/orb4_sky_cloud.glb?no-inline', import.meta.url).href,
  },
  {
    'div3_causeway_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_causeway_7m.glb?no-inline', import.meta.url).href,
    'div3_cloud_bank': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_cloud_bank.glb?no-inline', import.meta.url).href,
    'div3_cloud_island_complete': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_cloud_island_complete.glb?no-inline', import.meta.url).href,
    'div3_continuous_stairway': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_continuous_stairway.glb?no-inline', import.meta.url).href,
    'div3_gpu_body': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_gpu_body.glb?no-inline', import.meta.url).href,
    'div3_light_mote': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_light_mote.glb?no-inline', import.meta.url).href,
    'div3_near_00_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_00_7m.glb?no-inline', import.meta.url).href,
    'div3_near_01_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_01_7m.glb?no-inline', import.meta.url).href,
    'div3_near_02_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_02_7m.glb?no-inline', import.meta.url).href,
    'div3_near_03_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_03_7m.glb?no-inline', import.meta.url).href,
    'div3_near_04_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_04_7m.glb?no-inline', import.meta.url).href,
    'div3_near_05_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_near_05_7m.glb?no-inline', import.meta.url).href,
    'div3_server_temple': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_server_temple.glb?no-inline', import.meta.url).href,
    'div3_waterfall': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_waterfall.glb?no-inline', import.meta.url).href,
  },
  {
    'void3_floating_cube': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_floating_cube.glb?no-inline', import.meta.url).href,
    'void3_floating_cup': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_floating_cup.glb?no-inline', import.meta.url).href,
    'void3_floating_diamond': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_floating_diamond.glb?no-inline', import.meta.url).href,
    'void3_floating_orb': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_floating_orb.glb?no-inline', import.meta.url).href,
    'void3_floating_ring': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_floating_ring.glb?no-inline', import.meta.url).href,
    'void3_ground_7m': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_ground_7m.glb?no-inline', import.meta.url).href,
    'void3_thinking_monolith': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/void3_thinking_monolith.glb?no-inline', import.meta.url).href,
  },
  {
    'div3_sun_disc': new URL('../art-source/momo-20261118/blast_divine_void_v3_20261118/assets/div3_sun_disc.glb?no-inline', import.meta.url).href,
    'common_ban_letter': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_ban_letter.glb?no-inline', import.meta.url).href,
    'common_machine_body': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_machine_body.glb?no-inline', import.meta.url).href,
    'common_machine_needle': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_machine_needle.glb?no-inline', import.meta.url).href,
    'common_quota_wall_blocked': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_quota_wall_blocked.glb?no-inline', import.meta.url).href,
    'common_quota_wall_reset': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_quota_wall_reset.glb?no-inline', import.meta.url).href,
    'common_steam_puff': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_steam_puff.glb?no-inline', import.meta.url).href,
    'common_takeaway_window': new URL('../art-source/momo-20261118/blast_common_v3_20261118/assets/common_takeaway_window.glb?no-inline', import.meta.url).href,
    'tpe5_crate': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_crate.glb?no-inline', import.meta.url).href,
    'tpe5_menu_board': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_menu_board.glb?no-inline', import.meta.url).href,
    'tpe5_potted_plant': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_potted_plant.glb?no-inline', import.meta.url).href,
    'tpe5_cafe_table': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_cafe_table.glb?no-inline', import.meta.url).href,
    'tpe5_cafe_chair': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_cafe_chair.glb?no-inline', import.meta.url).href,
    'tpe5_street_bench': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_street_bench.glb?no-inline', import.meta.url).href,
    'tpe5_heritage_lamp': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_heritage_lamp.glb?no-inline', import.meta.url).href,
    'tpe5_street_tree_4p4m': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_street_tree_4p4m.glb?no-inline', import.meta.url).href,
    'tpe5_steam_puff': new URL('../art-source/momo-20261118/blast_taipei_street_v5_20261118/assets/tpe5_steam_puff.glb?no-inline', import.meta.url).href,
  },
] as const;

type Keys<T> = T extends unknown ? keyof T : never;
export type ModelId = Keys<typeof districts[number]>
  | 'hsinchu_wafer_fab_v2' | 'hsinchu_office_v2' | 'hsinchu_cooling_tower_v2' | 'hsinchu_substation_v2' | 'hsinchu_wind_turbine_v2' | 'hsinchu_pipe_gantry_v2' | 'hsinchu_tank_pair_v2' | 'hsinchu_utility_hall_v2'
  | 'coffee_cup_habitat_v2' | 'd5_celestial_halo' | 'd5_cloud_island' | 'd5_divine_gpu' | 'd5_portal_colonnade' | 'd5_server_temple' | 'dyson_sphere_v2' | 'lunar_base_v2' | 'milk_foam_drift_v2' | 'moka_lander_v2' | 'orbital_data_station_v2' | 'sfv2_back_skyline' | 'sfv2_coit_tower' | 'sfv2_deco_arcade' | 'sfv2_golden_gate' | 'sfv2_neon_diner' | 'sfv2_painted_ladies' | 'sfv2_transamerica_pyramid' | 'solar_satellite_unit_v2' | 'tpe3_low_market_7m' | 'tpe3_tea_balcony_7m' | 'tpe_arcade_front' | 'tpe_cafe_front' | 'tpe_coffee_kiosk' | 'tpe_distant_skyline' | 'tpe_soft_cloud' | 'tpe_tea_front' | 'v6_coffee_cup' | 'v6_monolith_dais' | 'v6_thinking_monolith';
export type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

export class StreetModels {
  private readonly pending = new Map<number, Promise<void>>();
  private readonly paint = new Map<string, THREE.MeshStandardMaterial>();
  private readonly active = new Set<number>();
  private readonly ready = new Set<number>();
  private readonly loader = new GLTFLoader();
  private readonly stop = new AbortController();

  constructor(private readonly kit: Kit) {}

  hasStyle(place: number) { return this.active.has(place); }

  isReady(place: number) { return this.ready.has(place); }

  warm(place: number) {
    let pending = this.pending.get(place);
    if (!pending) {
      pending = this.loadDistrict(place);
      this.pending.set(place, pending);
    }
    return pending;
  }

  private async loadDistrict(place: number) {
    if (place !== 6) {
      await this.warm(6);
      if (!this.active.has(6)) { this.ready.add(place); return; }
    }
    const loaded = await Promise.all(Object.entries(districts[place]).map(async ([id, url]) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.any([this.stop.signal, AbortSignal.timeout(8000)]) });
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
    const incomplete = loaded.some(asset => !asset?.parts.length);
    for (const asset of loaded) {
      if (!asset) continue;
      if (this.stop.signal.aborted || incomplete) {
        for (const mesh of asset.parts) { mesh.geometry.dispose(); mesh.material.dispose(); }
        continue;
      }
      // The six nearby factory fronts expose named finishes for their seeded palettes.
      const nearHsinchu = asset.id.startsWith('hsc3_') && asset.id.endsWith('_7m') && !asset.id.includes('_tile_');
      for (const mesh of asset.parts) {
        const material = mesh.material;
        const propFinish = asset.id.startsWith('common_') && (material.name === 'common-sage' || material.name === 'common-dark-timber');
        const vehiclePaint = (asset.id === 'sf3_sedan' || asset.id === 'sf3_delivery_truck') && material.name === 'sf3-dusty-blue';
        if (material.name === 'v6-runtime-face') {
          material.map = thoughtLabel(this.kit);
          material.color.set('#fff');
          material.emissive.set('#fff');
          material.emissiveMap = material.map;
          material.emissiveIntensity = 0.55;
        } else if (!material.map && !material.emissive.getHex() && !material.transparent && !material.vertexColors && !material.name.startsWith('machine-power-') && !nearHsinchu && !vehiclePaint && !propFinish) {
          // Keep each Blender colour in linear vertex RGB. Tile batching can now draw
          // dozens of differently painted pieces with the same opaque surface in one call.
          const key = [material.roughness, material.metalness, material.side].join(':');
          let paint = this.paint.get(key);
          if (!paint) {
            paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: material.roughness, metalness: material.metalness, side: material.side });
            this.paint.set(key, paint);
          }
          const colors = new Float32Array(mesh.geometry.attributes.position.count * 3);
          for (let i = 0; i < colors.length; i += 3) material.color.toArray(colors, i);
          mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          mesh.material = paint;
          material.dispose();
        }
      }
      this.kit.models.set(asset.id, asset.parts);
    }
    if (!this.stop.signal.aborted) {
      if (!incomplete) this.active.add(place);
      this.ready.add(place);
    }
  }

  dispose() {
    this.stop.abort();
    const materials = new Set<THREE.Material>();
    for (const parts of this.kit.models.values()) {
      for (const mesh of parts) { mesh.geometry.dispose(); materials.add(mesh.material); }
    }
    for (const material of materials) material.dispose();
    this.paint.clear();
    this.kit.models.clear();
  }
}
