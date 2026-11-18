# 新竹完整 v3 素材製作包（待整合驗收，不是整關完成）

此包承接使用者已核准的台北 v3。**全為真正 Blender 幾何；沒有修改 repo、合併或部署。** 已用同一套乳白／深青／焙銅霧面材質重做新竹的前景、中景、四組地標、遠景廠房、路面、工業街件及蒸汽／煙外觀。沒有匯入舊 GLB 混在新版裡。

## 交付與前後圖

- `before-near-only-fixed-camera.png` 是上一批「只有六個新前景、沒有後景」的 Blender 審閱畫面。
- `after-fab/cooling/power/wind-fixed-camera.png` 是這批加入完整背景的四個固定鏡位。
- 五張使用相同相機位置、22°垂直 FOV、1440×810。**前圖不是原版遊戲截圖，後圖也不是遊戲截圖。** 這組只證明資產製作前後，不可冒稱原遊戲同 renderer 對照。
- 四個地標輪流放在同一審閱 root `(7,5,-66)`、倍率 `.62`；並非宣稱它們在實際關卡都放同一位置。地標頂端被原飛行鏡頭裁切，沒有為展示偷偷改相機。
- `landmark-catalog-not-game-camera.png` 用額外正交鏡位檢查四組完整輪廓，明確不是遊戲鏡頭。
- `hsinchu-full-v3-assets.blend` 可編輯全部34個原型（隱藏／在原點重疊）；四個 `hsinchu-*-composition.blend` 可編輯完整審閱組裝；`landmark-catalog.blend` 可編輯地標檢視場景。
- `build.py`、`preview.py`、`catalog.py` 為重建來源，`manifest.json`／`three-loader-qa.json`／`runtime-qa.json` 為實際驗證紀錄。

## 34件覆蓋

### 六個前景 slot

| 原 roastery slot | 新模型 |
|---|---|
| 0 鋸齒廠房＋煙囪 | hsc3_sawtooth_roastery_7m |
| 1 開放滾筒烘豆棚 | hsc3_drum_roaster_7m |
| 2 低裝卸院／麻袋／桶 | hsc3_low_loading_yard_7m |
| 3 架高摩卡壺 | hsc3_kettle_gantry_7m |
| 4 工班食堂／屋頂徽章 | hsc3_shift_canteen_7m |
| 5 雙筒倉 | hsc3_silo_pair_7m |

每格7m、底中心、scale=1，不套地標倍率。原圖標、招牌文字、蒸汽與獨立家具必須掛回新版接口。四變體由 `style-variants.json` 給定材質替換建議，**尚未實作到 runtime，也尚未四變體各自截圖**。原 seed 與 slot 選取不改。

### 四組地標（14件）

- fab：`fab_hall`、`fab_office`、`fab_skybridge`，維持廠房＋細辦公塔＋多層排氣的輪廓。不是只剩一個方盒。
- cooling：`cooling_tower`（重用兩次，不同倍率）、`cooling_deck`，連續雙曲面、真正開口塔緣與維修平台。
- power：`power_turbine_hall`、`power_boiler`、`power_striped_chimney`、`power_flue_filter`、`substation`、`power_secondary_stack`。保留大型鍋爐、紅白／焙銅條紋煙囪、過濾設備與變電站，不再以小變電站代替整座電廠。
- wind：`wind_tower`、`wind_rotor`、`wind_dune`，三座群組。rotor與tower分檔，pivot在rotor局部原點，軸向glTF +Z。**原版是靜態角度，不新增未授權旋轉機制。** 若現有runtime驅動旋轉，仍可掛回同pivot。

四組 assembly 以 JSON 為準，不將重複實例冒算新模型。

### 中後景與街件

- 中景：`pylon_14m`、`cable_span_14m`，三層兩側電纜、14m連續跨距。塔中心 `14i+7`，電纜中心 `14i+14`，不要把兩者放同一中心。
- 遠景：`far_factory_14m`。沿用原 skyline seed、深度層與避免遮地標規則；不能把它硬塞進地標排除範圍。
- 氣體：`steam_cluster_unit`、`smoke_cluster_unit`。獨立單位團塊，從runtime接口複製；沒有烘死在建築裡。預覽是靜態作者擺位，不是動畫通過證據。
- 街件：`streetlamp`、`tree`、`planter`、`crate`、`cafe_table`、`cafe_chair`、`blank_signboard`。只供Blast實例，不更改小屋共用家具。
- 地面：`road_tile_7m`、`walk_tile_7m`，含標線、排水口與接縫。須核對遊戲地面標高，不能當碰撞幾何使用。

## 空間與動態接口

全部 GLB：米制、+Y向上、+X沿街、+Z朝玩家，無外部貼圖／uri、無壓縮extension、無骨架／動畫，所有材質霧面。地標只在組裝時套 `.62` 和 `+5m`，匯出檔不預套。近景及14m中景不可套地標倍率。

`runtime-interfaces.json` 有所有 sight 組裝位置、倍率、rotor角度與steam/smoke/sign/badge掛點。座標是glTF，不是Blender。`style-variants.json` 提供4組材質外觀映射，不更改現有 seed/規則。標牌是幾何背板，沒有UV貼圖依賴，請用原Canvas sign mesh投到指定面前方，保留原內容與隨機字句。

**重要幾何校準：** Three.js實測未縮放組裝 reach：fab44m、cooling44.5m、power57.243m、wind46.311m。power與wind超過舊宣告reach（48、44），整合時須按新包圍盒更新視覺排除範圍或調整資產，不能繼續用舊reach而讓遠景插進模型。這僅影響視覺culling，不得改碰撞或分數規則。wind地形底部有負Y以埋地，詳見QA，不能用最低點自動重新歸零。

燈光／霧／曝光不是GLB自帶。預覽用Cycles/AgX，進遊戲要沿用Three.js既有品質與色調映射，調整同一新竹palette而不是移植Blender燈光數字。

## 已驗證

34/34 GLB經實際Node GLTFLoader解析、讀包圍盒。逐件檢查≤250KiB／≤5000 triangles／≤6 primitives，無外部buffer uri／image／texture。四個assembly實際Three.js合成bounds，rotor以分離資產驗證接口。已目視四張固定鏡位及完整地標檢視圖。

## 尚未完成，不可稱整關完成

1. 沒有在真正遊戲renderer整合或測試。沒有手機GPU/FPS、整景draw calls、碰撞／規則replay、轉場／postcard／低品質／失敗fallback結果。
2. 共用Machine、StreetProp（quota wall、ban letter等）外觀與介面由整合／共用道具工作負責，本包未替換；不冒稱全部動態道具完成。
3. 所有4變體的runtime接入、招牌Canvas、蒸汽生成、家具instance回收、雲／sun shader、原子style bundle載入／同風格fallback尚需程式接回。
4. 若仍走舊程序build作正常補件，就仍是新舊混搭，不得驗收。整合方須逐列完成coverage，確認所有near、sights、behind、far、groundMarks、clouds、props都使用新版。
5. 原遊戲真正同鏡位前後對照尚需Codex取得；本包只能提供Blender製作前後及來源說明。
