# 工程交接必讀：新竹 v3

## 不能忽略：地標 reach 變更

本包不可沿用原 power=48、wind=44 的視覺排除範圍。下列是 Node GLTFLoader + Three.js Box3 實際組裝值，**未套 .62/+5**。不要改碰撞或玩法規則來配合美術。

- **fab**：min `[-44, 0, -9.5]`；max `[42.5, 70, 9.5]`；對稱 reach **44.000m**。
- **cooling**：min `[-44.5, 0, -17.5]`；max `[44.5, 57.323082733154294, 21.415]`；對稱 reach **44.500m**。
- **power**：min `[-57.24248695373535, 0, -13.25]`；max `[42, 73.23776245117188, 9.800000190734863]`；對稱 reach **57.242m**。
- **wind**：min `[-46.31079864501953, -5.699999809265137, -17.012800216674805]`；max `[43.67734909057617, 67.3186907241369, 18.207679748535156]`；對稱 reach **46.311m**。

建議將 sight reach 向上取整並留小幅輪廓餘量，或縮改視覺asset再重算。wind最低Y為負是埋地造型，不能把整個assembly自動移到Y=0。

## 蒸汽／煙掛點（glTF局部米制）

- `cooling.steam`：`[[-21, 56.8, 1], [22, 53.58, 7]]`。先套地標 .62，最後加 sight root 與+5m。
- `power.smoke`：`[[36, 73.5, 2], [-38, 42.4, 4]]`。先套地標 .62，最後加 sight root 與+5m。
- `power.steam`：`[[10.6, 51.4, 3]]`。先套地標 .62，最後加 sight root 與+5m。
- `hsc3_sawtooth_roastery_7m` steam：`[[2.35, 12.4, -0.65]]`。近景root `(7i+3.5,0,-8)`、scale=1。
- `hsc3_drum_roaster_7m` steam：`[[1, 7.4, -0.4]]`。近景root `(7i+3.5,0,-8)`、scale=1。
- `hsc3_kettle_gantry_7m` steam：`[[-1.7, 7.2, 0]]`。近景root `(7i+3.5,0,-8)`、scale=1。

使用 hsc3_steam_cluster_unit／hsc3_smoke_cluster_unit 作新外觀。原 plume 的 n/start/swell/lean（例如雙冷卻塔 n=5、start=4/3.6、swell=1.4、lean=3.6/3.4）仍由程式生成位置與大小，不以預覽固定4團取代原配置。原近景 puffs 的seed/數量與現在實際update行為也需保留。原版這些建築蒸汽大多是靜態幾何，不能將本包宣稱為新動畫；若當前runtime已有動畫，把transform driver掛到新group。

## 原四變體明確映射

原 roastery[slot] 與 c.v 選取不變。slot0..5分別對應六件近景模型，`c.v=0/1/2/3` 一對一使用 style-variants.json 的 index0/1/2/3。每個slot四變體都必須使用新版幾何，不能某些c.v回舊build。

- c.v=0 → ivory-teal-copper，linear RGB overrides `{}`。
- c.v=1 → sage-cream，linear RGB overrides `{'hsc3-deep-teal': [0.16, 0.31, 0.25], 'hsc3-roasted-copper': [0.43, 0.24, 0.13]}`。
- c.v=2 → brick-night-shift，linear RGB overrides `{'hsc3-deep-teal': [0.11, 0.22, 0.23], 'hsc3-roasted-copper': [0.48, 0.16, 0.09], 'hsc3-cream-enamel': [0.7, 0.59, 0.44]}`。
- c.v=3 → pale-laboratory，linear RGB overrides `{'hsc3-deep-teal': [0.15, 0.32, 0.34], 'hsc3-cream-enamel': [0.84, 0.76, 0.59]}`。

**尚未實作的差異：** 四變體目前是材質映射建議，共用每slot同一新版幾何；不是24件各自獨立造型。原slot0的7+0.4v屋高、slot3壺身金屬交替、slot4隨機窗燈等細分變化，需整合方保留或做相容的新變化，尚無逐變體畫面證據。不可因此聲稱原四變體所有細節完全等價。材質必須per-instance clone，不能全域改色影響其它slot。

## 不得報完成的項目

coverage.json的所有runtimeIntegrated目前都是false；這包是34件可編輯素材與接口，不是已完成遊戲。共用Machine/StreetProp視覺尚由共用工作處理。真實遊戲相機、四變體、轉場、replay、故障fallback、手機FPS尚未驗證。前後固定圖是「前一批只有近景」到「本批完整層次」的Blender對照，**不是原版遊戲與新版遊戲的同renderer對照**。
