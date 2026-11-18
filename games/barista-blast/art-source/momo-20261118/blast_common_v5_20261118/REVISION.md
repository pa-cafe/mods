# v5 portafilter correction
Real Blender models and Cycles renders, not generative concept art. No repo modifications or deployment.

Based on v4: top two cups remain separated from hopper, X clearance >=0.080.

Added distinct circular brew group, locking collar, tapered metal basket, basket rim, metal handle neck, insulated dark handle, crossbar and two dark-ended outlets.
- Cup center: X -1.38, Y 0 in Blender. Outlets X -1.435 and -1.325, Y 0, within cup opening.
- Cup rim top Z 0.570; outlet bottom Z 0.654; vertical clearance 0.084. Handle bottom >=0.743, above cup rim by >=0.173.
- Contact at mounting bracket, basket lock, handle neck, spout attachment is intentional mechanical connection, not unintended clipping.
- Exact machine bounding box unchanged from v4: min [-2.851249933,-0.259999931,0], max [-0.722368598,1.549999952,2.879999876].
- Gauge center, nozzle pivot, root coordinates, machine-power-lamp/strip material hooks unchanged.
- Machine GLB 228656 bytes, 4316 triangles, 6 primitives, no textures. All seven GLBs parsed successfully with Three GLTFLoader.
- assets/ = corrected original sage palette, neutral-assets/ = optional neutral materials, same geometry.
- common-props-source.blend / common-props-neutral-source.blend and build.py / base_helpers.py are editable sources.
- machine-front.png, machine-left.png, machine-detail.png, machine-neutral.png: actual multi-angle Blender renders. Not live-game validation or six-stage palette acceptance.
