# 原創素材與範圍：researcher 鳳梨工裝

本批以使用者批准十人造型中，上排第四位年輕女研究員為身份來源，保留圓潤臉型、短捲深髮、帽上護目鏡、較寬肩膀與厚實身形；服裝承接第一批 doctor 鳳梨八件套的金黃帆布、深綠披肩／工裝褲、奶油襯衣、金綠帽與菱格記事本。所有姿勢由本次內建 imagegen 原創生成、人工視檢，不擷取其他遊戲或品牌／標誌。遊戲沒有新增影像生成 API 或訂閱依賴。

## 實際範圍

- 正、背、左、右獨立繪製，各方向 8 張跑步原畫與 8 張動作姿勢，共 64 張。
- 動作順序 idle、start、stop、turn、rise、apex、fall、land；每動作一張，僅是動作姿勢覆蓋，不能當成每個轉場已有多張完整原畫。
- 只在 researcher 角色及 jacket、cape、shirt、pants、shoes、hat、accessory、handheld 全八欄都相符鳳梨套裝時使用。原繪分件／骨架混搭是另一條渲染路徑。
- 帽上護目鏡、臉型、身形與髮型仍屬這位研究員；背面胸前書本與手臂被身體自然遮住；各張圖只持有一本書。

## 原檔與重建

可攜交付來源位於 art-source/characters/pineapple-researcher/；開發工作資料夾為 characters/researcher，可在交付 staging 統一名稱。generation-records.json 記錄逐次 prompt、來源與來源 hash；masters/ 提供各張原始 1536×1024 RGBA PNG 的無損 WebP。packing-manifest.json 列明原始／母檔／網頁 SHA、裁切與像素校驗；PNG 和 WebP 位元檔不同，解碼 RGBA 完全相同。

共享 pack-character.py 先找 8 個分離的 alpha>16 主體，再將裁切矩形中的每個 alpha 像素歸給最近主體，只排除相鄰人物的像素。來源矩形可能重疊，但不能有不透明人物互相接觸；沒有削掉自己的輪廓以通過檢查。無損母檔保存完整來源。後續僅同角色 64 格使用同一等比縮小、整數錨點平移、透明圖集封裝及 lossless WebP，不做鏡像、旋轉、局部扭動或新增畫姿。

網頁 8 圖集均 1024×768、4×2 格；每格 256×384，足點 (128,372)。正面待機依第一批 doctor 295px 與研究員身形比例 420/450 校準，實際 276px，全 64 格 commonScale 0.5264。previewBox、portraitBox 與每格 alpha 範圍見 manifest。

## 真實驗收界線

已視檢全部 8 張原檔與 8 張封裝 inspection，並執行已安裝 skill 的 audit_atlas.py，64 格的尺寸、透明邊界、來源／輸出 hash、方向動作覆蓋與足點規格通過。首次右向鞋尖碰邊、正面換腿不明確均重繪後再驗；不靠補透明邊假裝完整輪廓。人工檢查與自動檢查分開記錄；雜湊互異不是步態正確的證明。inspection 圖只是素材檢查，不是實際遊戲截圖。試穿、大廳、手機與遠端外觀的 browser 證據由主整合批次另交，本檔不借用 doctor 舊測試或宣稱尚未執行的測試通過。
