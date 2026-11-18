# Coverage ledger (asset readiness, not runtime acceptance)

| Original visual family | New replacement | Status |
|---|---|---|
| Divine near six kinds | div3_near_00..05_7m | New mesh per kind; runtime four palette variants pending |
| Server temple with columns, roof, halo, clouds | div3_server_temple | Complete silhouette/body rebuild |
| Stairway continuous 36-step/gate feature | div3_continuous_stairway | Complete connected redesigned 30-tread ascent + gate; no collision changes |
| Divine GPU with three fans | div3_gpu_body | Whole body/rims/heatsink/three static fans/halo rebuilt |
| Floating island body AND pavilion/trees | div3_cloud_island_complete | Complete whole-island body + top structure |
| Island waterfall | div3_waterfall + div3_light_mote | Independent piece and particles, runtime placement pending |
| Divine skyline foam + atmospheric cloud mesh | div3_cloud_bank | One new source geometry scales at original placements; recolor/variant pending |
| Divine sun and sky | div3_sun_disc + runtime-anchors palette | New sun, gradient update specified; not integrated |
| Divine ground/slab/marks | div3_causeway_7m | New tile, runtime extend edge/slab to original width pending |
| Void near 0..5 | Remain EMPTY | Intentional original gameplay/story feature, not old mesh retention |
| Void monolith/body/dual dais/border | void3_thinking_monolith | Full mesh new |
| Void sayings canvas | Original function on new mount | Content mechanism preserved, no old slab retained |
| Void nine local shards | new cup/cube/orb assets | Original deterministic/random transform logic preserved by integration |
| Void global floaters 0..4 | cube/diamond/cup/ring/cup | All five shape families covered |
| Void ground | void3_ground_7m | New tile, runtime extension pending |
| Void sky | runtime palette; no sky body | No weather/empty appearance preserved |
| Common window/quota/mail/machine | separate common_assets package | Not duplicated here |
| Characters, HUD, hitboxes, score | unchanged | Not scene-art scope |
| 2D fallback | not changed by these GLBs | Needs matching palette/vector styles separately |

Acceptance remaining: remove old corresponding geometry on normal loaded route; reconnect transforms, canvas, particles and sun billboard; actual browser screenshot and occlusion QA, 4 variant cycling, loading fallback, low mode, mobile perf. No claim that the game itself is already visually uniform.
