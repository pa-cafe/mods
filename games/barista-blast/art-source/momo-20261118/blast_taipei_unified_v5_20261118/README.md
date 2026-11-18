# 台北全場景統一 v5 / 素材與組裝審閱包

## 範圍與狀態
承接 Dylan 認可的 v3 暖柔和咖啡街方向，這次補齊圓山大飯店、美麗華摩天輪/商場，以及台北街件和環境的新模型。**素材已建、Blender組裝已檢視；尚未遊戲整合或完成全景驗收。** 沒有修改 repo、合併或部署。不要以某個新地標已換入就宣稱完成，正常畫面不能留原版場景物件混搭。

原碼核對基準：`pa-cafe/mods@8ab71ecac6cd6c971605206d8c1954f110df11bc` 的 street3d-taipei.ts、street3d-sets.ts。後者隨包附上；前者在廟v4包。模型是重新製作，不是匯出原程式幾何。

## 五地標覆蓋
| 原slot | 新素材 | 狀態 |
|---|---|---|
| 101 | v3 tpe3_101_jade_refined | 已有，保留；不是這輪新建 |
| 中正紀念堂 | cks-memorial-refined | 保留修正版，沒有再改 |
| 龍山寺式廟宇 | v4 tpe4_longshan_low_courtyard | 保留25.38m低廟版本 |
| 圓山大飯店 | v5 tpe5_grand_hotel_yuanshan | 本輪新建，七層紅柱金瓦；52×37.55×40m含山丘 |
| 美麗華 | v5 mall_support + wheel_rotor + gondola×18 | 本輪新建，約32.8m寬、41.43m高；不是只換輪子，商場一起換 |

所有地標使用原有scene loader、0.62縮放/+5m抬升；GLB未預套。原遊戲位置/slot/動態與碰撞行為不變。v5輪框局部pivot在輪心，座艙pivot在吊點，不是底中心，詳runtime-anchors.json。原碼摩天輪是靜態幾何，本包不擅自新增旋轉；若未來有動畫，座艙可獨立維持垂直。

## 原6種前景街段對應
| street[] | 新替代 | 保留接口 |
|---|---|---|
| 0 咖啡館 | v3 corner_cafe + 新桌椅/盆栽/煙囪/煙團 | 原 badge:round、咖啡館道具坐標/變體 |
| 1 珍奶店 | 新 bubble_tea_shop + roof_bubble_tea | 原珍奶牌匾、杯標識、隨機窗亮度 |
| 2 攤車綠籬 | 新 coffee_cart + hedge + parasol + parked_scooter | 原 mascot、攤車/雨傘/機車位置 |
| 3 公寓騎樓 | v3 arcade_apartment + 新AC/水塔/牌匾 | 原 words、左右雙面直牌、隨機窗亮度 |
| 4 公園 | 新 fence/tree/bench/menu_board/lamp/signal/bicycle | 原 mascot:board、原道具位置 |
| 5 斜頂店 | 新 gabled_cafe + chimney/puff/flower_planter/bread/crate/menu_board | 原窗、門、花台/箱堆與煙團節奏 |

這是「素材可覆蓋」的對應，不是原生成器已接好。v3兩個店面帶靜態 PA CAFE/BLAST/PLAY 裝飾，不得因此吞掉原隨機中文/牌匾；整合時用新牌匾及原Canvas接口保留動態內容，必要時改v3源檔移除衝突固定字。原高度c.v、窗亮roll、色彩變體仍須接回，不能只永久循環固定六個GLB。原咖啡店、騎樓和斜頂的外形經改造，不是逐個尺寸照抄。

## 新街件/環境30件
- 台北停放機車、自行車（原碼靜態，不冒稱移動車輛動畫）
- 路燈、雙燈號誌、4.4m街樹、花台、盆栽
- 長椅、圓桌、椅子、立牌、木箱、7m公園欄杆
- 咖啡攤車、遮陽傘、7m綠籬
- 屋頂珍奶杯、煙囪、單顆煙團、水塔、冷氣外機、麵包
- 橫式/直式空白牌匾（原Canvas內容接回，不刻假文字）
- 遠山、雲團、群樓、3種單棟遠景樓

街件和商店是直接公尺，不要套地標0.62/+5。一般地面物件底部中心；煙團/雲的原點是漂浮中心。三種遠景單樓標準主體5×20×6m，可依原seed生成的w/h/depth調整，保留taken避讓與隨機規律。群樓只供整體遠景/審閱，不要每原單棟位置都塞一整群。

## 中後景不能漏換
目前原碼另有 `middleRows[0]` 的 v2 tpe_cafe_front/tpe_tea_front/tpe_coffee_kiosk/tpe_arcade_front（z=-29）及 tpe_distant_skyline（z=-99），以及後面逐棟b.box遠樓迴圈。整合必須一起改用同風格素材/材質、保留taken空隙；不能前排換v3/v5卻留下這些舊中景。審閱圖使用新群樓/山/雲，沒有把全部原種子排布逐一重現。

## 動態與遊戲接口不變
- 捷運：沿用已重製橋體及車廂原檔，保留14m節距、9.5m車廂底高及原train判斷。沒有新增/刪除時序。
- 原煙團puffs：提供單團外形；保留原n、drift、位置或現有動畫，不烘焙整條。
- 晝夜：材質名含emissive的燈光需程式接回；signal-go與原state對應。所有新GLB均未寫入時間軌。
- 文字/標誌：保留temple:name、badge:mall、badge:round、plaque、mascot等Canvas/樣式/內容，不用空白牌匾當完成替代。
- window/wall/mail/machine遊戲道具由root的共用素材工作負責，本包未動。
- **角色與HUD不屬本次場景外觀範圍，沒有修改。** 也不更動角色運動、碰撞、得分、物理或相機。

## 審閱圖與限制
`101 / memorial / temple / grand-hotel / miramar-fixed-camera.png`均為960×540 Blender Cycles審閱，不是遊戲截圖。固定鏡位：lens61.73464819、verticalsensor24mm、相機(x+13.12321937,-75.95224980,11.22035256)、rotation(90°,0°,0°)；x=7/49/91/133/175。101頂端裁切是原鏡位，不為完整露塔改鏡頭。捷運/商店局部遮住廟和商場下半部，保持原深度層，不假移到前景。圓山與摩天輪主輪廓清楚。

本審閱序列使用代表性六街段組裝，沒有玩家、HUD、遊戲道具，也未模擬全部seed/光照/時序。Blender柔光與遊戲即時材質仍有差異。Node GLTFLoader parse不等於瀏覽器/GPU驗證。

## 預算與剩餘驗收
所有本輪36件GLB各自≤250KiB / ≤5000tris / ≤6primitives / 無貼圖；詳qa-summary.json。美麗華「唯一檔案」4932tris，但實例18個座艙後是7448tris，靜態整體最多27primitives（body5+rotor4+18×1），需用InstancedMesh共用座艙，不能拿4932當完整實景計數。全場景drawcalls/FPS尚未測。

仍未完成：
1. Codex把上述原生成器的每個舊分支換掉，接回文字符號、變體、晝夜/煙團/捷運掛點，避免舊模型fallback偷偷出現。
2. 地面、斑馬線、路面材質和天空/霧色由遊戲程式維持幾何/玩法，只做同色盤材質統一；本包未改程式，無法聲稱已完成。
3. 全seed、雙向鏡頭移動、各晝夜狀態、載入失敗時、較小視窗的遮擋與全覆蓋檢查。
4. 遊戲WebGL/GPU成本、drawcall和行動裝置FPS、碰撞與玩法回歸測試。
5. 本輪僅台北；其他關是否所有分支已換，須各自清點，不能沿用台北結論。

## 原檔組織
- 四個v5子目錄：飯店、摩天輪、街件、補齊店面，各含GLB/可編輯blend/build.py/helper/manifest/GLTFLoader報告。
- 本目錄 `taipei-unified-v5-review.blend` 為完整審閱組裝，可直接開啟。
- `review.py` 重建需相鄰v3、v4與四個v5目錄；本交付壓縮包附重建所需v3來源場景及保留GLB、v4廟GLB。
