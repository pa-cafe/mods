# 圓山大飯店 v5：單件重製稿

參考 `blast_temple_v4_20261118/reference-street3d-taipei.ts` 的 `hotel()`，不更改遊戲 repo。模型已採米制 glTF Y-up，+X 沿街、+Z 朝玩家；原點在飯店中心的地面高度，不預套遊戲 0.62 倍與 +5m 偏移。

## 與原版對照
- 原版約37.6m高，本版37.55m，差約-0.05m（-0.13%），沒有把飯店拉成高塔。
- 保留30m寬、14m高、10m深的七層主要樓體、17根正面紅柱、每層淺石色樓板與深色窗帶。
- 保留12m高處的平台、兩層寬展金瓦歇山式屋頂、較小的頂層休息廳與克制脊飾。
- 山丘包圍盒寬52m、深40m，總高37.55m。相較原版未依測繪增添細節；這是遊戲風格重製，非文資測量模型。
- 材質沿用廟v4的柔和朱紅、暖石、砂金與深玉綠語彙，但維持多層飯店窗格比例；沒有寺廟香爐、龍飾、誇張燕尾或廟埕。
- 增加有限的屋瓦縫線、頂層窗格及入口雨棚，避免過量小碎件。
- 不自行發明山坡階梯。入口道路與山坡銜接留給固定場景組裝。

## 檔案
- `assets/tpe5_grand_hotel_yuanshan.glb`：可整合模型，無相機／燈光／貼圖。
- `grand-hotel-v5-editable.blend`：可編輯模型源檔。
- `grand-hotel-v5-studio.blend`：另含棚拍相機與燈光。
- `grand-hotel-v5-three-quarter.png`：單件 Blender 渲染，不是遊戲畫面。
- `manifest.json`：尺寸、三角形、bytes、材質等。
- `three-loader-qa.json`：Three.js GLTFLoader 解析與包圍盒驗證。

重建：`blender -b -t 6 --python build.py`。需要同目錄的 `base_helpers.py`。

QA：程式assert檢查≤250KiB、≤5000tris、≤6primitives，GLTFLoader實際解析成功，單件渲染目視檢查。尚未固定遊戲鏡位組裝、遮擋、手機FPS或互動驗證。
