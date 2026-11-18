# San Francisco v4: complete landmark/environment replacement kit

Actual Blender-authored geometry, not image generation. Supplements SF v3 foreground/highway kit; does not supersede its six slots or traffic. No repository modifications or runtime integration performed.

## Coverage
- `sf4_golden_gate_complete`: two towers, deck/truss, railings, suspension cables, lights, **both banks/hills and trees**, one replacement assembly. Reach ~75 m, not merely a replacement tower.
- `sf4_transamerica_complete`: tapered tower, spire, wings, apertures and adjacent blocks.
- `sf4_coit_hill_complete`: sculpted hill, terrace, trees, small hill houses, full fluted tower, observation crown.
- `sf4_painted_ladies_complete`: five distinct colored Victorian houses, bay windows/gables, terrace, lamps and background hills/trees.
- `sf4_far_block_0/1/2`: three new single-building skyline variants with recessed windows, roof details; replace EACH original procedural block, not entire skyline-placement logic.
- `sf4_cloud_bank`: new sculpted cloud geometry.
- `sf4_crescent_moon`: real crescent geometry, no generated texture.
- `sf4_billboard_1/2/3`: remaining advertising-frame variants and exit sign. SF v3 supplies variant 0. Text/content remain runtime planes.
- `sf4_ground_7m`: coordinated walk/road surfaces, seams, drain and lane dash.

SF v3 + v4 cover all six near-building types, freeway, cars/trucks, four far landmarks including attached landscape, distant blocks, all four advertising frames, ground marks, moon and cloud geometry. **This is not a claim that the running stage has no old visuals.** Shared gameplay objects and runtime graphics require the separate integration work below.

## Transform contract
Meters, GLB Y up / +Z facing player. Blender coordinates convert `(x,-z,y)`. Mesh transforms applied; all local roots at zero. Landmark assembly place at original sight x, Three `(x,5,-66)` with scalar `.62`. Do NOT additionally retain original bridge banks, Coit hill, Painted Ladies terrace, trees, or Transamerica neighbors. Keep original sight trigger, exclusion reach and scrolling lifecycle. Bridge new full reach ~75 m: if old exclusion reach is 72, expand exclusion to bounds so distant blocks do not poke through bank edges.

Far blocks: bases at y=0; nominal widths/heights 5/18, 6/28, 7/37 (third antenna extends to40.4). Preserve original deterministic individual position, exclusions and spacing. Scale X to chosen original width and Y to chosen body height; account for crown/antenna in exclusion. No direct drop-in replacement for the entire `skyline()` function is supplied.

Cloud: preserve original hashed position, cloud tile and motion. New bank width about14.2m, versus old cloud cluster about7.2m: use roughly `.5 * originalSize`, inspect actual camera silhouette. Do not silently double cloud occupancy.

Moon: origin center, visual diameter roughly8m. Original `bodyTexture` paints the moon at radius24px on a256px texture, so solid-disc diameter is only 18.75% of its full backdrop plane. To preserve apparent size, first estimate GLB scalar `(runtimeBodyPlaneSize * .1875) / 8`, keep original body center/depth (-500), and verify visual diameter. Keep/restyle the soft halo separately, not the old full moon beneath this mesh. Near/far clipping and fog must be handled deliberately for this sky-only object.

Billboard frames1/2/3 retain original widths5.2/3.6/4.4, heights3.3/2.8/2.6, post bases17.2/14.4/11.6. Canvas plane center local y=base+h/2+.3, front z=.24 or greater to avoid z fighting. Attach separately with visible dimensions w x h; frames contain no readable text and no UV surface. Exit sign retains its original z=-25 placement; other boards keep their existing tile offset/behind-depth.

Ground tile origin is start x=0; local X0..7, sidewalk local z=-7..0, road local z=0..10. Place x=7*i at original street origin; no old marks underneath. Road top y=-.2 and sidewalk y=0. Preserve physics ground rather than changing collision to match this cosmetic offset. Verify original playable ground/camera framing before replacement.

## Sky art direction (runtime, not a GLB)
Sky remains a procedural gradient, which is the appropriate representation rather than a giant exported dome. Proposed sRGB stops: #20223F, #373752, #62627C; fog uses lower stop, cloud material muted warm ivory, moon warm ivory. Rebuild/restyle gradient, halo, stars and scene ambient/fog together. Keep existing sky sizing/parallax/bodyAt placement; do not adopt the flat review-render world as the final game sky. These settings are a proposal and have not been applied or browser-validated.

## Preview / QA limitations
Four fixed-game-camera Blender images and editable review scenes: landmark0 Golden Gate,1 Transamerica,2 Coit,3 Painted Ladies. Same v3 foreground lineup and new ground in each. Camera matches parent-provided desktop verticalFOV22°, 960x540, Blender pos(20.12321937,-75.95224980,11.22035256), rotation(90°,0°,0°). Landmarks placed(7,66,5),scale.62. They are isolated landmark comparison compositions, not screenshots of the game. Highway/traffic, distant blocks, cloud, moon and runtime labels are not shown in these four compositions.

Visual inspection: architectural trim/material family consistent with v3; Coit retains fluted observation tower and full hill; Painted Ladies clearly reads as five bay-window houses. Golden Gate tower tops and Transamerica spire are clipped at this original game camera/scale. This is explicitly unresolved framing, not hidden by changing preview camera. Integrator must test during actual scroll and decide whether modest vertical-scale/placement adjustment is needed without altering game camera. No mobile/FPS/animation/regression evidence yet.

Node GLTFLoader parse/bounds pass for all13GLBs. Manifest contains individual bounds/bytes/triangles. Per-file budgets <=256000bytes, <=5000triangles, <=6primitives, zero textures. No decoder needed. Editable `sf-v4-assets.blend`, deterministic `build.py` and helper source included. Review scenes contain imported new v3 foreground assets, not original procedural geometry.

## Required before final acceptance
1. Replace original geometry atomically; no old attachments under new assets. Retain pooling/lifecycle, transition and per-vehicle motion; do not bake moving cars into static freeway.
2. Restyle/attach every runtime advertisement, cafe/open poster/mascot label. Preserve message meaning and interfaces, not old mismatched panels.
3. Apply coordinated sky/fog/star/halo treatment and new cloud/moon placement. Bounds/overlap review needed.
4. Integrate shared gameplay prop pack and check player/launch/collision/replay/scene-switch behavior with its owner.
5. Browser fixed-camera screenshots, all four landmark scroll positions, mobile aspect ratios, frame-time/drawcall checks. No claim of production completeness until these pass.

Sources read: `reference-code/street3d-bay.ts`, `street3d-sets.ts`, `street3d.ts`, SF v3 and Taipei v3 existing authored assets. No repository writes.
