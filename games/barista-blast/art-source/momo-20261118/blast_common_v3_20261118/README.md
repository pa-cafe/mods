# Blast common props v3 — Blender assets, NOT integrated

Source inspected read-only: `pa-cafe/mods@b6441c1b0e5382846b14ed01c9240d7af1f62a26`, `street3d-props.ts`, `street3d-machine.ts`, and MACHINE/UNIT in `art.ts`. Reference copies are included. User scope: replace normal 3D old visuals consistently, retain gameplay, timing, pose and labels. Materials match Taipei v3's ivory, sage, terracotta, dark timber and muted brass; these are freshly authored geometry, not old TS meshes exported.

## Coverage mapping

| Original | Replacement | State/coverage |
|---|---|---|
| takeaway / kind window | common_takeaway_window.glb | New rounded kiosk, scalloped awning, timber mullions, counter, cup. Dynamic sign absent in original too. |
| serverWall / kind wall reset=false | common_quota_wall_blocked.glb | Four bronze-edged vented rack doors, red indicator material, blank dynamic tag frame. |
| serverWall / kind wall reset=true | common_quota_wall_reset.glb | Identical silhouette with separate green indicator material. Reset must still derive from original rules. |
| banLetter / kind mail | common_ban_letter.glb | New weighted post/ceramic envelope, modeled fold, address strokes and postage. Blank dynamic tag. |
| Machine constructor main geometry | common_machine_body.glb | New rounded ceramic/brass body, gauge surround, cups, hopper, drip tray, wand. Original root/LEFT convention retained. |
| Machine needle | common_machine_needle.glb | Independent origin-zero pointer and hub for original power rotation. |
| Machine steam sphere | common_steam_puff.glb | Independent clustered matte puff; original life/position/opacity path must remain. |

The exact `StreetProp.kind` registry contains only window/wall/mail. “quota” and “ban” are product concepts, not extra kinds. All registered kinds are mapped above. This does NOT claim all street-furniture, vehicles or stage-specific gags are covered: those belong to scene owners. Character atlas, HUD and 2D effects not changed. The 2D aim nozzle graphic from `art.ts` is also not replaced by this 3D-only package; do not hide or remove it during integration.

## Units, axes, placement

All dimensions are metres. glTF Y-up, front +Z; authoring Blender `(x,-z,y)`. No .62 landmark scaling. No extra +5m elevation. Source origins remain at (0,0,0), geometry positioned as original builder expects, especially machine whose body is to the LEFT of origin. Three.js model root stays at (0,0,0) before pose; do not center geometry by bounds.

`place()` still applies prop.x, mail y bob `sin(now/520+x)*.08`, and `(1/squash,squash,1)`. Existing bounds/collision logic remains untouched. No baked animation clips.

## Mandatory dynamic hooks for coding integrator

1. Wall/mail labels: use current sign string and reset logic; never bake fixed wording. New frame centres in Three coords: wall `(0,5.73,-.70)`, width 2.1 and height .42; mail `(0,5.59,-.60)`, width 2.2 and height .42. Front label plane must be at z=-.61 (wall) / -.51 (mail), just ahead of inset, within frame. Use `.28` text height or fit; do not draw the old red filled tag rectangle on top of new frame. Retain original tagWidth logic bounded by these widths. Runtime canvas-only lettering can use warm ivory with red/green state accent. Word source remains original. GLBs deliberately have no image textures or sign text; node/material names are stable but UVs are omitted because integrator adds a UV plane.
2. Machine needle: attach loaded asset under a group at `(-2.2385,.759,-.09)` and apply original `rotation.z=(210-power*240)*PI/180` to that group. Do not rotate the entire machine or offset its baked geometry twice.
3. Optional machine name lettering: add fresh ivory `PA CAFE` lettering-only Canvas plane on sage band centred at Three `(-1.80125,1.51,-.12)`, width 1.1, height .22. Keep it within the band; do not overlay the old logo background. Root shake: original `group.position.x=shake` unchanged.
4. `machine-power-lamp` material: emissive intensity `.3+power*3*(.6+.4*sin(now*.02))`; `machine-power-strip`: `.4+power*2.2`. Clone these materials per machine instance before mutation; keep palette.
5. Steam: replace each of six sphere meshes with a loaded clone of common_steam_puff; same `now`, `life`, `size`, visibility cutoff .95 and exact original positions. Override its material with a cloned transparent ivory/white standard material, opacity `.35+power*.4`, depthWrite=false. Export is opaque to avoid Blend/GLB transparency defaults leaking into other common props.
6. Source hopper redesigned opaque ceramic/metal instead of old transparent cylinder; it has no gameplay state. Do not re-add the old hopper sphere/box shell over the replacement body.
7. Existing state keys/cache (`propKey`) and disposal must remain. Cache loaded geometries, clone hierarchies, share static materials; safely clone animated materials. Atomically load the full common style bundle. Normal load path must not leave old builder geometry behind. For download failure use a coherent bundle fallback, not random per-object old/new mixture; implementation is not delivered here.

## Preview evidence

`common-props-side-review.png` is a studio lineup under 22-degree vertical perspective, not game rendering.
`common-props-aim-camera.png` uses supplied actual stable aim camera: 960x540, Three position (-2.25470085,3.65384615,24.73343277), vFOV 22 degrees. Ground projects to 475.2000859px, target 475.2px, assert passes. Positions of extra demonstration props are chosen for review; not a saved gameplay state. Lighting/background are studio proxies, not the game's renderer. Never label either as live game screenshots.

## QA and outstanding integration

7/7 GLTFLoader parse and bounds pass. No textures, <=6 primitives per asset, each <250KiB and <5000 triangles. Static material consolidation baked, no compression decoder required. Source/review .blend files and rebuilding scripts included. Manifest and Three QA contain exact bytes/triangles/bounds. These are asset/load checks only; desktop/mobile visual integration, collision/readability, state labels, frame timing, reset/ban handling, failure fallback and actual GPU FPS are not tested. No repo modification, merge or deployment performed.
