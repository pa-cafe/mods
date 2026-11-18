# Orbit v3 — authored Blender near-scene kit

Status: asset review only, NOT integrated, NOT full-scene completion. Nine new files authored in Blender; not an export of old Three primitives. No repo changes, merge, or deployment.

## Contract

Meters. GLB +X along street, +Y up, +Z toward player; Blender conversion (x,-z,y). Six near assets have local ground-center origin. Place root at `(7*i+3.5,0,-4.4)`, scale 1, without landmark scale .62 or +5m height. The front-facing geometry lies at local GLB +Z. Match this root to the original foam slot positions rather than the Taipei near depth. Model bounds may overlap the 7m tile by soft foam only; original foam banks also overlapped. Keep current slot spacing and collisions.

The separate foam bank is centered at local ground; floating bean and sugar cube have center pivots. They can receive existing runtime transforms. Do not re-add their geometry over the baked foam of six near tiles.

## Explicit old-to-new map

Source inspected: `blast_five_stages_v2_20261118/reference-code/street3d-sets.ts` foam array and `street3d-orbit.ts`.

| Original near slot | New asset | Preserved cues |
|---|---|---|
| foam[0] | orb3_cup_eyes_station_7m | cup body/handle, dark coffee dome with two white eyes, front door; rounded cream and brass pressure detailing |
| foam[1] | orb3_sugar_constellation_7m | six staggered sugars with one rose cube, fine grains, low silhouette |
| foam[2] | orb3_spoon_bean_garden_7m | tall spoon, recessed bowl, flanking beans, low foam |
| foam[3] | orb3_drifting_bean_cluster_7m | four descending floating beans and small clouds; baked rest pose only |
| foam[4] | orb3_tripod_moka_robot_7m | 3 landing legs, octagonal pot, spout/handle, 3 portholes, antenna |
| foam[5] | orb3_latte_heart_hill_7m | low cream hill, sculpted latte heart, side bean |
| foamBank / optional behind foam builder | orb3_foam_bank | shared rounded cream foam; runtime scales/placement still required |
| floating bean | orb3_floating_bean | center pivot for original float motion |
| sugar floater | orb3_sugar_floater | centered softened cube |

The game camera frame is copied from root's measured stable 960x540 flight reference: Blender location `(20.12321937,-75.95224980,11.22035256)`, rotation `(90°,0,0)`, vertical sensor 24mm, focal length 61.73464819mm, rendered at 1440x810 with identical aspect. This is a Blender asset lineup, not a game screenshot. Actual orbit lens may vary during flight. Background lighting/solid world in this preview is not an exported asset.

## QA

Nine GLBs, 466448 bytes total, 16268 triangles total; individual maximum 125876 bytes / 3604 triangles; <=6 primitives/materials, no textures. GLTFLoader Node parse and bounds in `three-loader-qa.json`. No Draco/meshopt applied to avoid new decoder requirements; meshes already joined by shared material.

## Still required before 'no old/new mixing' can be claimed

1. Integrate all 6 near slots, then implement/verify all four runtime variants. This first kit supplies base meshes only. Never mark all variants done merely because the six slots exist.
2. Preserve procedural coffee steam timing, eyes behavior if any, moving objects and existing gameplay. New cup does not bake steam; reconnect same-style soft puff particles. Near floating beans are rest-pose meshes, not exported animations.
3. Review/update four distant sights. Existing v2 data station, moon base, seven satellite units on t^1.6 curve and Dyson sphere are not replaced by this near kit. The satellite path and visual glints must remain runtime controlled.
4. Update all rocket/gag meshes, floating props, terrain, star/foam sky, ground marks and game-prop registry to the new style. Their exact animated attachment contract must be obtained from current runtime code. Do not remove effects to make coverage simpler.
5. Avoid current old-geometry per-part fallback during successful normal display: stage-bundle preload/atomic activation or same-style fallback is still an engineering task.
6. Real desktop/mobile screenshots, occlusion, HUD clarity, drawcalls/triangles and mobile FPS; deterministic replay/fallback/transition regressions are not yet performed.

`orbit-v3-assets.blend` includes source mesh arrangement (hidden render groups); `orbit-v3-composition.blend` contains copied lineup instances, lights and camera. `build.py` is reproducible with supplied helper file.
