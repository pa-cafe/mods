# BLAST 其餘五關 v2 可組裝素材：設計審視稿

**不是完成整關、不是遊戲截圖、未接入 repo、未交給 Codex。**

承接台北 v2 的低模細節、微倒角與柔和材質，這批提供新竹／舊金山／軌道／神界／虛無共40個獨立GLB及五個組裝場景。台北、中正紀念堂與捷運由另外工作處理，本包未改。

## 已核對的原始內容

唯讀來源：`pa-cafe/mods`，PR #14，commit `478d123f491f37d5f841749e2c1b8b1da28df925`。

相關 `games/barista-blast/page/` 檔案快照在 `reference-code/`：street3d-hsinchu.ts、street3d-bay.ts、street3d-orbit.ts、street3d-temple.ts、street3d-blank.ts、street3d-sets.ts、street3d.ts。這是對照資料，**不是要覆蓋 repo 的程式碼**。

| 關卡 | 原地標對照 | 此包模型 | 仍須保留／整合方核對 |
|---|---|---|---|
| 新竹 | `sights`: fab、cooling、power、wind；`behind`: pylons | 晶圓廠、辦公塔、冷卻塔、變電站、風機、管架、儲罐、機房、桁架，共9件 | 原power()還有大型鍋爐、紅白煙囪及配套，非本包小變電站的等價替代；原plume蒸汽／煙與背後連續電線需留原系統或另製。風機本版靜態，不能用靜態合併模型替代已有或未來旋轉接口。 |
| 舊金山 | bridge、pyramid、coit、ladies；behind: freeway | 金門橋、Transamerica Pyramid、Coit Tower、彩繪女士、夜城、街角遊戲樓、餐館、告示街件、新月雲，共9件 | 原高速路／交通、跨路牌及地形仍由原系統保留；此包沒有重做或移除。細橋纜、柵欄、彩繪女士細節是輕量重設計，不宣稱逐三角等價。 |
| 軌道 | datacentre、moonbase、satellites、ring | 資料中心、月球基地、小衛星單體＋點軌跡、戴森球，以及咖啡杯站、摩卡壺、豆、奶泡、湯匙糖塊，共10件 | `satellites()`是沿t^1.6曲線排列七顆太陽能衛星，不是有軌火車；已更正。本包不含錯誤磁浮車體。原軌道gags、飛行道具、拆解動態等繼續由遊戲程式控制，不能用背景GLB替代。 |
| 神界 | serverTemple、stairway、graphicsCard、cloudIsland | 柱廊神殿、光環、浮島、天梯片段、門廊、三風扇GPU，共6件 | 原完整天梯連續佈置、島上植栽和神界切換／角色特效需保留；GPU風扇為靜態，無動畫承諾。模組可組裝，不等同原整段地形。 |
| 虛無 | slab，含雙層圓基座、隨機中文句及漂浮杯／方塊／球 | 石碑、雙層基座、真中空杯、碎片組、飄浮板及可選破門，共6件 | 原SAYINGS隨機字句必須由原程式保留。GLB的 `v6-runtime-face` 保留UV0供貼原CanvasTexture；預覽上的「思考中…」只是DEMO，不是烘焙進GLB。可選破門是新增裝飾，不得取代原碎片。 |

### 不能因換素材而移除的系統

`street3d-sets.ts` 的sightOn／skyline仍負責地標slot、reach、避免遠景樓撞進地標、behind函式與0.62縮放／5m lift。`street3d.ts` 保留分塊keep、相機lens、霧、日光、雲／floaters、machine.pose、place(props)、orbit gags.update、場景wipe與render流程。此包沒有改動其中任何一項，也沒有重現或驗證完整遊戲機制。

## 檔案與使用

- `assets/*.glb`：40件獨立米制模型，無外部貼圖，無天空／地板／相機／燈光。
- `sources/*-metric.blend`：五個同尺度可編輯場景，含DEMO地面、天空、鏡頭和燈光供審視。
- `previews/*-side.png`：側視組裝 Blender 渲染，非遊戲畫面。
- `manifest.json`：逐件bytes、tris、primitives、材質名、包圍盒、各關配置與尺度。
- `three-loader-qa.json`：40件實際GLTFLoader成功解析、Three.js包圍盒與三角形。
- `runtime-anchors.json`：虛無文字面掛點與動態邊界。
- `build.py`及各關.py／`base_helpers.py`／`calibrate.py`：重建來源。

## 已確認接口

- glTF2、米制、Y-up，+X沿街、+Z朝玩家。建築原點在底中心附近；漂浮件／天體採中心原點，精確bbox見JSON。
- **未預套0.62縮放或+5m抬升。** 地標須用場景loader，不是家具loader。
- 每件≤250KiB／5,000tris／6primitives；全部程式assert通過。GLB均無外部圖片、無Draco/Meshopt、無骨架、無動畫。
- 按材質合併mesh。具體emissive材質名在manifest，整合方依名稱接回；不要求bloom才可見。
- 地標尺寸不是全照台北倍數硬套：舊金山以橋面122m寬為錨（設計8.8單位），神界以神殿底階58m寬為錨（設計3.7單位），虛無以碑身40.5m高為錨（設計4單位）。新竹與軌道暫採台北共用19.122m/單位；**其餘個別資產尺寸、reach與遠景深度仍須整合方核對**。不要據此宣稱全部原尺寸一比一匹配。
- 細線／欄杆在遠景手機可能消失，沒有LOD／碰撞體；需要基於遊戲相機簡化，不要使用整個視覺mesh作物理碰撞。
- 風機、GPU風扇現在合併進材質mesh，若需旋轉應再拆node與pivot，不能直接假定有骨架或可旋轉子件。

## 驗證

五張側視圖已逐張目視：各關具有不同地標與空間，不是咖啡街換色。40件GLTFLoader解析PASS，米制bbox／預算assert已通過，虛無runtime文字面的TEXCOORD_0已確認。

Chromium在這個環境仍因socket權限無法啟動，所以**沒有瀏覽器實際渲染、正式遊戲loader、手機FPS、碰撞或整關流程通過的宣稱**。Blender的燈光、霧、陰影與遊戲不同，入遊戲後仍需對照。

## 重建

```sh
blender -b -t 6 --python build.py
blender -b -t 6 --python calibrate.py
blender -b -t 6 --python void-preview-caption.py
npm ci --ignore-scripts
node validate-three.mjs
```

第一步產生設計單位GLB及圖；第二步只校準一次；第三步在虛無預覽示範原中文runtime字句，不改GLB。未送審前請勿將這批視為已被使用者核准的完成資產。
