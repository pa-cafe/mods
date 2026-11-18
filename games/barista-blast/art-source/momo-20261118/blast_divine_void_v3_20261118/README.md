# 神界／虛無 v3 full visual replacement kit

這是可編輯 Blender 素材與鏡位代理預覽，不是已接進遊戲的結果。不改 repo。
美術：霧面瓷、蜂蜜黃銅、淡奶油雲、藍綠釉；沿用台北 v3 的倒角與材質語言，但保留神界和虛無各自的特色。

## Exact inventory and mapping
- 神界 six near slots 0..5 → div3_near_00..05_7m，7m 節塊，local ground center。原 root 是 tile midpoint；GLB Y-up，+Z 朝玩家。root 放 x=7i+3.5，y=0，z=-6.5，scale 1（以 near 雲 bank 中心為基準），依地面接口調整，不套遠地標 .62。
- 四個 sights → div3_server_temple、div3_continuous_stairway、div3_gpu_body、div3_cloud_island_complete。全件替代而非保留舊島上殿或舊天梯。保持 sight 原 root、.62 scale、+5m lift；資產原點0。
- GPU 為原本靜態三風扇構圖，無新增旋轉或 gameplay。光環改放不易被完整神殿擋住的位置，需實景再驗收。
- 島瀑布 → div3_waterfall，與島根相對 Three (17,0,4)，同 .62。原島內光束和微粒可用新暖光材質、div3_light_mote 重建，不保留舊幾何。
- cloud layer / landmark clouds / far foam → div3_cloud_bank，依原 deterministic placements 與大小縮放。所有舊程序雲、山丘幾何需撤下。
- 神界 ground slab/groundMarks → div3_causeway_7m + runtime extend/repeat。此片涵蓋12m深度，若原 slab 更深以同材質延展，保留原碰撞地面。
- 神界 sun disc → div3_sun_disc unit radius，使用原 screen position 的 billboard/size邏輯；sky gradient採對應淡藍 #A9C7DC / cream #F8EDD2，不需要人為加建築背景。
- 虛無本來六個 near slots 都是空，保持空；不得以填入街屋「證明有換」破壞原關特徵。
- 虛無 sole sight → void3_thinking_monolith，包含完整雙層台座、碑及邊框。原 w18 h40.5 foot9 相容。
- `void:face:${said}` 中文 Canvas 不烘入材質，不偽造文字。保留原 SAYINGS、隨機選句、canvas字型與動態內容，掛在 local Three (0,29.25,2.36)，width16.4 height38.9；比前面邊框略前，避免z-fighting。這是唯一保留的文字內容機制，不留舊碑幾何。
- 碑周九組 shards → 用新 void3_floating_cube/cup/orb，維持原位置、尺寸、轉角；全景浮物 0 cube、1 diamond、2 cup、3 ring、4 cup → 對應 void3_floating_*。不得把 diamond誤換sphere。
- 虛無 ground → void3_ground_7m，淡灰瓷材質；天空維持空曠灰白梯度 #D8D6D2/#F3F0E9，無月無太陽。
- 共用角色/HUD/玩法不在本包；window/wall/mail/machine 由 common_assets 負責，不重複建模。

## Variants and complete-world acceptance
六個神界 near 資產可由 runtime對 brass/ivory材質作四個輕微配色variant，clone材質不得修改跨關shared material；幾何仍全新，不可用原variant回填。虛無空near按原機制維持空。

不得以 GLTFLoader PASS 宣稱整關無新舊混搭。仍待組裝者逐層替換並驗證：near / sight / far / cloud或floaters / sky/body / ground/slab/marks / stars或motes / waterfall / 原動態文字 / 共用道具。舊 fallback可以保留作載入失敗保護，但正常已載入畫面不得露出舊幾何。舊2D fallback目前不在這份GLB包之內，應另以同色彩語言統一，而非聲稱GLB改了2D。

## Camera, quality and source
Blender assets are metres, Z-up front -Y; GLB exporter converts to Y-up front+Z. All five fixed previews use 960×540, vertical FOV22°, camera Blender (20.12321937,-75.95224980,11.22035256), Euler(90,0,0); main landmark at (7,66,5), scale .62. They are Blender proxy renders, not game screenshots and not exact original-game comparison. Sources: reference-code street3d-temple.ts, street3d-blank.ts, street3d-sets.ts, street3d.ts, scenes.ts in neighboring v2/orbit packages.

Each GLB target <=250KiB/5000tris/6primitives, no textures; necessary geometry decimated preserving silhouette. Manifest gives actual values. Need real browser/mobile checks for visibility, clipping, batching/drawcalls, shadows/emission, gameplay and fallback before acceptance.
