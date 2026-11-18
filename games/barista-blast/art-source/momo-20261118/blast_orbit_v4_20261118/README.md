# Blast 軌道關 v4：遠地標、gags、天空／地面、變體補齊包

這是可編輯 Blender 實體網格資產，不是生成圖片。搭配先前 `blast_orbit_v3_20261118` 的六個近景主體及三種小件使用。沒有改動 repo、遊戲、碰撞、關卡、動畫時序或部署。

## 交付
- `orbit-v4-assets.blend`：26 組可編輯模型，按資產／材質組織；預設隱藏渲染的來源物件可重新顯示。
- `orbit-v4-gag-composition.blend`：固定鏡位示意，塔、火箭、夾臂、車分開。
- `assets/*.glb`：26 個 Y-up GLB，米制、無貼圖、共 900,768 bytes。
- `build.py`、`base_helpers.py`：可重建來源；Blender 4.3.2。
- `manifest.json`、`three-loader-qa.json`、`checksums.json`：預算、載入及完整性檢查。
- `orbit-v4-sight-0..3.png`：原 .62 尺度與 +5 高度的固定遊戲鏡位預覽；不是瀏覽器實玩截圖。
- `orbit-v4-sight-0-framed.png`／`2-framed.png`：同鏡位、只改遠景顯示尺度的候選。資料站 .52，衛星群 .46；其他原值不變。
- `orbit-v4-gag-rig.png`：動畫分件的靜態組裝樣板，沒有烘焙動畫。

## 風格／覆蓋
象牙陶瓷、靛藍釉、霧面黃銅、奶油泡沫、豆色、少量玫瑰糖。沿用台北 v3 的低反光、柔邊語言，同時保留太空站、月面、衛星與戴森球可辨識輪廓。

四遠地標：資料站、月球基地、七顆衛星單體、戴森球核心＋殼。Gags：塔、兩夾臂、火箭、噴焰、煙／火／閃光粒子、兩種碎片、左右跑車、16 顆列隊用小衛星。環境：雲、天空豆、遠泡沫丘、7m 地面單元、4 組近景低矮變體裝飾。

變體是六個 v3 主體配四組新裝飾，共 24 種搭配，不是 24 個不同主體。保留原 seeded 變體選擇與碰撞資料；不要每幀隨機換配件。

## Three.js 接口
GLB +X 沿街、+Y 向上、+Z 朝玩家。Blender 點 (x,y,z) 對應 Three (x,z,-y)。GLB 不需再旋轉90度。

### 遠地標
`orb4_data_station_landmark`、`moon_base_landmark`、`dyson_core`、`dyson_panel_shell` 原基準根節點 `(X,5,-66)`，scale=.62。X 用原關卡值。戴森球核心和殼共用根節點；若轉殼，包一層 localY=26 的 pivot，再把 GLB 子節點 localY=-26，勿繞地面原點轉。

`orb4_satellite_landmark_unit` 中心原點，複製7顆：t=i/6；局部位置=(-26+52t,18+38*t^1.6,(i%2)*1.5)，scale=1+.5t；局部 rotationZ=atan2(38*1.6*max(.001,t)^.6,52)-PI/2。外層沿用上述根節點。

**已知鏡位問題**：原尺寸的資料站頂端、七衛星隊列尾端超出畫面。保留原比例截圖以便比較，不冒稱通過構圖 QA。另附資料站 root scale=.52、衛星整群 root scale=.46 的同鏡位候選；這只影響裝飾遠景，不應改碰撞／鏡頭。組裝者用真實 UI 安全區再驗收，兩者不可同時顯示。

### 火箭／塔臂／特效
GAG_DEPTH=50，TRAIN_DEPTH=60。使用原 `orbit-gags.ts` 的狀態機、時序、文字及 pose，僅替換 visual。
- 塔 `orb4_gag_launch_tower` 原點是地面，已有後方結構及底座。
- 左臂 local=(-4.3,10.6,-.2)，右臂=(4.3,10.6,-.2)。GLB 原點就是鉸鏈，保留原旋轉軸與 ARM_OPEN=.66。
- `orb4_gag_rocket` 原點地面；ROCKET r=1.5/base=1.2/body=12/nose=4。保留原 rocket.position.y=pad.lift-(1-pad.rocket)*20。新尖頂較原包絡略圓，不變碰撞。
- `orb4_gag_flame` 接火箭 local=(0,0,0)，朝 -Y 延伸7m。按原 plume 狀態縮放，別再沿 Y 平移半高。
- puff/fire/flash 都是中心原點單位球，按舊位置、透明度及縮放更新；14 煙粒、9 碎片使用原 pool，不每幀載入新模型。粒子透明度需要 clone material，避免連動全部 clone。
- `orb4_gag_shard_ivory/rose` 中心原點，沿用碎片 pose。
- 左／右 roadster 已以 X 負／正方向建模，不要重複鏡像；Dummy face 的 Canvas 保留，貼在 local=(-dir*.45,3,.52)，大小 .9×.9，避免把頭部變空白。
- `orb4_gag_train_satellite` 是 **16 顆** gag 小衛星，不是七顆遠地標；x=(i-7.5)*3.2, y=-.012*x*x，原 trainAt() 驅動父群。
- `words`／字幕仍使用動態 Canvas，保持原語言與時序。建議奶油底 #F3E8CF、靛藍字 #293759、黃銅框 #A87840，軟邊而非新硬幾何。文字不烘進 GLB。

### 天空／地面／近景變體
- `orb4_sky_cloud` 取代原三球雲；保留原隨機位置、比例與移動速度。
- `orb4_sky_bean` 取代原天空豆，保留時間驅動。
- `orb4_far_foam_dome` 原點在底部，局部形狀(1.3,.75,1)；依原 r=6+roll*6+back*6 統一縮放，保留 z=-40-back*30-roll*10、seed、層級。勿重疊舊泡沫。
- 天空漸層／星光是 runtime，不是 GLB。建議漸層 ['#10172B','#293759','#625A88','#D9AEBC']、星光奶油色，保留星點密度／時間，需整合者實作與測試。
- `orb4_ground_7m` 以 x=0 為中心，放在 x=7*i+3.5，y=0，z=0；步道範圍z=-6.4..0，道路z=0..12，步道頂y=0、路面頂y=-.18，兩豆標記位於world x=7*i+1.4及+4.9,z=5。延伸範圍須按實際場景覆蓋；不要蓋住角色陰影或與舊面共面。
- `orb4_near_variant_0..3` 與對應 v3 近景主體共用根 `(7*i+3.5,0,-4.4)`，scale1，以既有 c.v%4 選；不要用遠景 .62/+5 變換。

## QA／尚待工作
26/26 GLB 通過 Node GLTFLoader 載入、bounds 和網格檢查。最大 4,644 triangles，最多6 draw primitives/資產，沒有材質貼圖。實例化／合批仍由組裝者完成，多份遠景不應同時加載到視野內。
已逐張目視五張原鏡位樣板；資料站／衛星原比例裁切如上。Blender Cycles24samples、AgX，圖上細噪不是紋理。Three 的色調映射、燈光、材質及星空合成仍要對齊，不保證直接載入畫面完全同色。

剩餘：整合26件及v3九件；停用對應原 visual、保留控制器；套用字幕／face／漸層新樣式；確認遠景縮放方案；六近景×四變體全覆蓋、所有 gag phase、日夜／天空動態及手機桌機實玩 QA。共用街件由另包負責，不在此包冒稱覆蓋。未測瀏覽器 drawcall、GPU frame time、記憶體，也未改任何 repo。

## 參考
reference-code 保留原代碼供接口比對。gags、orbit-gags、scenes 取自 pa-cafe/mods @ b6441c1b0e5382846b14ed01c9240d7af1f62a26。建模不是直接轉存舊程序網格。
