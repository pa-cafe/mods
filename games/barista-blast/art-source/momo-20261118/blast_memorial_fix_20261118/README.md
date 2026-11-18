# 中正紀念堂辨識度修正版

Blender 建模及 Cycles 實際渲染，不是生成圖片。此為風格化遊戲地標，不是測繪復原。

## 修正重點
- 八角攢尖重簷、外挑上翹簷角與藍色屋脊，金色甕形寶頂。
- 收分白色主堂、實際鏤空拱門加深色內凹陰影面、立式匾額與簷下白色斗拱節奏。
- 三層基座、寬闊雙側階梯、中央石坡與扶欄。
- 將一般藍頂廟宇輪廓改成白色厚重堂體＋雙簷八角屋頂的紀念堂輪廓。

## 工程交付
- cks-memorial-refined.glb：單一靜態 mesh，6 材質／primitives，無貼圖、骨架或壓縮擴充。
- 公尺、Y-up、+Z 正面／朝玩家、+X 沿街；原點為主體地面中心。
- 未套用遊戲端 0.62 縮放或 +5m 抬升。
- GLB 229916 bytes、4347 triangles。底座連階梯尺寸約 36.3 × 39.25 × 32.865m (XYZ)。階梯向正面伸出，因此前後範圍不完全對稱。
- cks-memorial-refined.blend 包含資產及僅供渲染用的攝影棚地板／燈光／相機；遊戲資產只在 GLB，不包含攝影棚。
- front.png、side.png、three-quarter.png 是 Blender 預覽，不是遊戲內截圖。
- Node Three.js GLTFLoader 解析與 bounding box 已通過，見 three-loader-qa.json；未聲稱已通過瀏覽器 GPU 或完整遊戲整合測試。
- 未修改 repo、未 commit/push/deploy。

## 參考來源
實景以國立中正紀念堂管理處官方照片為主，僅作建模參考，不作遊戲貼圖：
https://www.cksmh.gov.tw/News_Photo_Content.aspx?n=6105&s=157232
https://file.moc.gov.tw/001/Upload/OldFiles/AdminUploads/Photos/large/45de68a7-4fa8-4ecd-b6a2-c04adc767956.jpg
臺北旅遊網對白色方形主體與寶藍八角屋頂的說明：
https://www.travel.taipei/zh-tw/media/audio-guide/details/4
