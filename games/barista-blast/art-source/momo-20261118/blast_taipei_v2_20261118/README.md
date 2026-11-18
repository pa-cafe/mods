# 台北 v2：側視場景風格修訂稿（未驗收／未接入）

本版回應 v1 太過極簡、孤立物件、缺乏概念城市節奏的問題。保留 v1，不覆寫或視為完成交接。這批只優先改台北；其他五關仍是早期基礎稿。

## 本次新增／修訂

9 個模組：`tpe_101_refined`、`tpe_cafe_front`、`tpe_tea_front`、`tpe_arcade_front`、`tpe_coffee_kiosk`、`tpe_distant_skyline`、`tpe_blue_roof_pavilion`、`tpe_soft_cloud`、`tpe_street_details`。

- 101 增加八節塔簷、重複窗格、發光窗、基座窗，保持剪影。
- 街屋補前後凹凸、窗框、窗台、小屋簷、條紋遮棚、店面玻璃與門、屋頂水塔、加蓋與冷氣。
- 茶屋有垂直 TEA 招牌，遊戲店有屋頂 BLAST! 看板及陽台欄杆，咖啡店較低，單層咖啡亭打開天際線視窗。
- 長幅場景用不等高／尺度及小間距組裝街廓，展示遠景樓群、101、清楚露出的藍頂地標、前景街邊件與道路。
- 物件微倒角與平滑低模雲讓風格較柔和，不依賴貼圖。

## 已按收到的整合接口校準

- GLB glTF2、米制、Y-up；+X 沿街、+Z 朝玩家。
- 建築底中心為原點。雲為中心原點。街邊組有局部offset，整體原點在街面高度。
- **未預套遊戲的0.62縮放或+5m抬升。**
- 101 高93.7m，寬約25.24m、深約20.65m。收到的原資產35m寬含周邊，因此本版不把塔身硬拉寬至35m；整合方可另添周邊補足。
- 其他模組同採93.7/4.9的設計尺度換算。這是風格化城市尺度，不是實際台北測量；正確尺寸與各件bbox見 manifest／Three.js QA。街屋等仍須依遊戲鏡頭及地標層調整，不能誤用家具 loader。
- 每件≤250KiB、≤5,000 tris、≤6 primitives；無貼圖。已用程式assert驗證。
- 自發光材質固定名稱 **`warm-window`**，供程式重新接 emissive；其他為普通粗糙非金屬材質。不依賴Bloom才可辨識。

## 檔案

- `assets/*.glb`：9件米制模組，只含模型與材質；沒有路面、天空、燈光或相機。
- `taipei-v2-assembled-metric.blend`：相同米制的可編輯組裝源檔。含預覽用的道路、天空、日輪、相機、燈光，名稱前綴DEMO者不屬於交付遊戲素材。
- `taipei-v2-side-context.png`：接近側視的 Blender 場景審視圖。
- `manifest.json`：全部預算與座標規格。
- `three-loader-qa.json`：實際GLTFLoader解析／bbox結果，非瀏覽器渲染。
- `build.py`、`base_helpers.py`、`calibrate.py`：重建腳本。`base_helpers.py`只由build讀入共用定義，不要單獨執行。

## 重建

```sh
blender -b -t 6 --python build.py
blender -b -t 6 --python calibrate.py
```

build先在設計單位生成模組與渲染，calibrate再轉米制，產生metric源檔。不要對已校準GLB重複執行calibrate。需要重做就兩步順序重跑。

## QA邊界

這是風格修訂稿，**不是遊戲畫面、不是完成驗收**。Blender渲染已目視檢查，GLB有預算assert與Three.js解析驗證；尚未做正式場景loader、實際遊戲相機、陰影、遮擋、碰撞、LOD、行動端FPS測試。此機Chromium仍受socket權限限制，未宣稱瀏覽器實際顯示通過。

標牌為風格草稿；接入前應與遊戲品牌／語言需求統一。模組材質合併方便組裝，但需要個別動畫的門、招牌、雲請由整合方指定分拆。
