# San Francisco v3 — six foreground slots + highway kit

Actual Blender-authored source and exported GLBs, not generated bitmap art. This is an asset delivery/review kit, **not integrated game footage and not a fully remade stage**. No repository was modified.

## Style
Shared crafted bevels, ivory architectural trim, deep inset glass, warm localized light and muted surfaces with Taipei v3. SF keeps midnight indigo/dusty blue/copper rather than importing Taipei daylight palette. The six original near-slot functions and height rhythm are preserved, not replaced by a generic row of cafes.

## Contract
Meters. GLB +X along street, +Y up, +Z facing player; Blender (x,-z,y) conversion. Static root origin (0,0,0), all mesh transforms applied. No pre-applied 0.62 landmark scale. No textures, six or fewer material primitives per file. Local bounds are in manifest; Three.js world bounds in three-loader-qa.json.

### Near slots (replace visual geometry, retain behavior)
Place each at Three `(7*i+3.5,0,-8)`, scale 1. Main wall face is local GLB z=+1.5, hence world -6.5, matching FACE. Six entries in original `street3d-sets.ts` `night` order:
0. `sf3_highrise_shop_7m`: 15.8m shop tower, tiered cornice, three-column windows, roof sign frame.
1. `sf3_neon_cafe_7m`: low cafe, canopy, local cup emblem, terrace stools, rooftop sign.
2. `sf3_server_exchange_7m`: visible recessed server racks and rooftop HVAC.
3. `sf3_vending_alley_7m`: low wall, two actual vending cabinets/cans, bench and lamp; preserves a visual gap.
4. `sf3_billboard_garage_7m`: shuttered garage and elevated advertising frame.
5. `sf3_communications_hut_7m`: tapered open lattice mast, dishes, hut and beacon. 20m antenna retained, not a skyscraper substituted.

Original runtime posters/cup mascot/CAFE/OPEN/brand graphics are NOT baked into the kit. `Canvas sign backing` is a plain mesh without UV. Integrator must attach a separate CanvasTexture plane and preserve content/legibility without overlaying old building geometry. Near slot graphics require coordinated restyling to finish no-mixing criterion.

### Behind layer
`sf3_freeway_14m`: local X 0..14, Three root `(14*i,0,-21)`, scale 1. Roadtop y=10.05, original highway deck=8.6, depth=6.8. No cars or billboards baked into roadway; this preserves separate traffic/placement control. Adjacent deck edges are exactly X=0/14; lamps sit within tile bounds. Underlying beveled deck end edges should be checked for seams in runtime.

`sf3_sedan` / `sf3_delivery_truck`: origin at center X, ground Y=0, facing +X. Road placement y=10, lanes z=-21 +/-1.55. Opposite way rotate Y=pi. Keep original per-car positioning/scrolling/motion rules; do not claim a new car animation. These have static wheels, suitable for existing background behavior. Recolor material `sf3-dusty-blue` per clone if desired (clone material first), preserving restrained palette.

`sf3_roadside_billboard`: root ground center, front +Z. Board center local y=17.1, width 4.8, height 3.1, face z=.285. Original ADS[0] dimensions. Attach runtime Canvas plane here. ADS[1]/[2] and exit sign have different dimensions and need dedicated frames or proportionate adaptation; do not reuse exact original code geometry behind this.

## Preview
`sf-v3-fixed-camera.png` is a Blender composition **not in-game**. Camera matches measured desktop flying setup: 960:540 aspect (rendered 1440:810), vertical FOV 22°, sensor height24mm, focal61.73464819mm; Blender XYZ `(20.12321937,-75.95224980,11.22035256)`, rotation `(90°,0°,0°)`. Near slots root y=8; freeway y=21. Lighting, sky and demo road are illustrative and are not runtime parity evidence. The six slots are displayed once in sequence, not random runtime distribution. No far landmarks are in this preview.

## Verified
Node Three.js GLTFLoader parse/bounds 10/10. All 10 GLBs total 614,420 bytes, 10,384 triangles. Max single asset126,964 bytes /2,152 triangles /6 primitives. No textures. Blender source saves both source assets and separate review composition. No browser rendering, mobile FPS, draw-call or game regression claim.

## Still required before full-stage acceptance
- Existing v2 four far-landmark models must be checked in the approved v3 style; bridge abutments/hills, Coit pedestal/hill/plantings, Painted Ladies terrace and skyline were left old in the integration and need replacing.
- Complete billboard variants, exit signage, sky/cloud/moon, distant blocks, ground/road materials/marks and shared gameplay props need the same coordinated treatment.
- Variants and night/day emissive handling need runtime review. Static materials have restrained emission; no animation is embedded.
- Replace old near/behind geometry atomically after load; normal render path must not leave old pieces visible behind new ones. Failure fallback should be intentional, not mixed geometry.
- Check preserved original graphics, behavioral logic, collisions, replay and transitions. Reconcile global props with the common-asset owner; this kit does not replace player/launcher.

Reference sources: local copies `blast_five_stages_v2_20261118/reference-code/street3d-sets.ts` (night six slots) and `street3d-bay.ts` (behind/freeway); original v2 and Taipei v3 files inspected. The raw source export has already grouped geometry by shared material. No geometry compression is applied, intentionally requiring only the existing GLTFLoader (no decoder change).
