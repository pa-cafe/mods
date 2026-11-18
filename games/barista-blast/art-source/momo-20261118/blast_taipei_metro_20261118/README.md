# Taipei MRT modular Blender kit
True Blender 4.3 model/render. This delivery does NOT edit the game/repo and contains no new animation.

## Source verification
Read-only GitHub inspection of pa-cafe/mods at 478d123f491f37d5f841749e2c1b8b1da28df925:
- games/barista-blast/page/street3d-taipei.ts: `viaduct` constructs continuous elevated rail and optionally two cars, cream bodies / blue stripe. Train base y=9.5, rail center z=-19.
- street3d-sets.ts: `skyline` calls `behind` before background buildings, which routes to `viaduct`.
- street3d.ts: `far` sets train=true for mod(index,4)===2; places cached far group at index*FAR_TILE. `draw` updates scrolling/camera and dynamic props, NOT a separate train animation.
Conclusion: original MRT is static scenic geometry that moves onscreen via scene/camera scroll; preserve this. No gameplay/collision logic for train observed in these files.

## Assembly (Three.js axes)
One rail tile is 14 m wide, centered x=0, ground y=0, z=0. Standalone train root bottom-center is y=0; position it at y=9.5 on deck. Both +X along street, +Y up, +Z towards player. Add tile group at x=index*14+7, z=-19. Always instance rail; add train only on original mod(index,4)===2 condition. Do not apply landmark scale .62 / +5 lift: these are background rail assets, not Sight landmarks. No new motion code or animation clip is required.

The prototype geometry respects original 14m repetition and 2-car count; rail top9.5m, train13.258m wide x2.646m tall. Supports are centered at x±3.5. Both endpoints align for tiling. Final rail width3.2m.

## Files / budgets
- assets/tpe_mrt_viaduct_tile14m.glb: 53,044 bytes, 900 triangles, one glTF mesh / 3 material primitives.
- assets/tpe_mrt_train_2car_tile14m.glb: 116,400 bytes, 2,172 triangles, one glTF mesh / 5 material primitives.
- taipei-metro.blend: editable objects, named train root `mrt_train_translate_X` and two child car pivots. Root name denotes axis only, not an included animation.
- metro-side-preview.png: isolated Blender side-angle render, not gameplay screenshot.
- build.py: reproducible current modular source.
- three-loader-qa.json: successful Three.js r187 GLTFLoader Node parse/bounds. Three produces one runtime mesh per material primitive (3 / 5). Browser frame-rate/render verification still pending.

Untextured opaque PBR, no UV/image dependencies. GLB rail/train intentionally merged separately for low draw calls; Blender preserves editable details and per-car pivots. Preview ground/lights/camera excluded from GLB.
