# 新竹 v3：六款前景街段製作稿

真正 Blender 幾何，非 AI 圖；尚未接入遊戲。承接已核准台北 v3，改造原 roastery 的全部六個 slot，而非只改晶圓廠遠景。這仍僅涵蓋新竹前景第一版，不代表整關或六關完成。

assets/ 六件依原順序：鋸齒廠房、開放滾筒棚、低裝卸庭院、摩卡壺架台、工班食堂、雙 silo。7m 段、原點底中心、GLB +Y向上/+X沿街/+Z朝玩家，建議 root=(7i+3.5,0,-8)、scale=1；不可套地標 0.62/+5。幾何寬與前後延伸仍須 runtime 遮擋審核。

暖乳白／深青／焙銅共6種材質，厚窗框與凹入立面，霧面、柔邊，高低和實心／透空交替。沒有烘入假標語。保留空招牌面、屋頂徽章位置；原 CanvasTexture 圖、steam puffs、獨立家具需整合方以新版同風格重接，禁止讓舊幾何和新殼疊加。蒸汽未放進 GLB。既有不同 slot 的前後位置不完全一樣，此處同一底中心接口需要按遊戲逐件校準，不保證一放就對。

- build.py：可重建腳本。
- hsinchu-v3-assets.blend：可編輯原型（隱藏，在原點重疊）。
- hsinchu-v3-composition.blend：六款排入原固定飛行鏡頭的審閱場景。
- hsinchu-v3-fixed-camera.png：Blender 代理渲染，無 HUD/人物/遠景，不是遊戲畫面；相機位置與22°垂直FOV沿用台北實測鏡位，1440×810 同16:9。
- manifest.json：逐件bytes、triangles、primitives與bounds。
- three-loader-qa.json：實際 Node GLTFLoader解析與bounds。
- SIX-STAGE-COVERAGE-PLAN.md：全六關完整替換待辦與驗收要求。

已做模型預算assert（每件250KiB/5k tri/6primitives）、GLTFLoader解析及預覽目視。未做真實遊戲整合、六關審查、手機GPU/FPS、碰撞、規則回歸。沒有改 repo、合併或部署。
