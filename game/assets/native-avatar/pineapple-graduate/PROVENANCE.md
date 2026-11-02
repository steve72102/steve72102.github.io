# 原創素材與範圍：graduate 鳳梨工裝

本批以使用者已批准十人學者造型中，上排第三位圓潤少年／青年男角色為身份來源，保留黑色瀏海、年輕圓臉、較矮且略厚實身形；服裝承接第一批 doctor 的鳳梨八件套金黃帆布、深綠披肩／工裝褲、奶油襯衣、菱格金色記事本與金綠帽。完整原畫由本次內建 imagegen 原創生成並人工逐張核對，沒有擷取其他遊戲／品牌服裝或標誌。

## 實際範圍

- 正、背、左、右均獨立繪製；每方向 8 張跑步原畫及 8 張動作姿勢，共 64 張。
- 動作圖集順序是 idle、start、stop、turn、rise、apex、fall、land；每個動作目前一張姿勢，不能說已完成每動作多影格轉場。
- 這組完整人物原畫僅用於 graduate 且八欄全部裝備 fruit-pineapple 對應物件。混搭分件與其骨架動畫屬另一渲染層，不能冒充本組逐格原畫。
- 背面胸前記事本／雙手由身體自然遮住。人物在起跑、煞停、轉向與跳躍原畫中改變關節與衣擺，不由整張圖片扭動／鏡像產生。

## 來源與可重建資料

可攜交付來源放在 art-source/characters/pineapple-graduate/：generation-records.json 記錄每次 prompt 與來源 SHA256；masters/ 保留 8 張原始 1536×1024 RGBA PNG 的無損 WebP，以及 packing-manifest.json、visual-review.json、atlas-audit.json。開發工作資料夾名稱為 characters/graduate，交付 staging 可改成上述統一路徑。PNG 原始位元檔與 WebP 檔的 SHA 不同，但解碼 RGBA 相同，逐張值見 manifest。

包裝由共享 pack-character.py 執行：以 8 個分離的 alpha>16 主體確定各格，再依最近主體分配重疊裁切矩形內的來源像素，只去除相鄰姿勢像素；各自 RGBA 在縮小前保持完全相同。無損原檔保留所有來源像素。此分區提取有明確揭露，不是重新繪畫或創造新動作。64 格使用同一等比縮小比例、整數平移、透明封裝與 lossless WebP；沒有鏡像、旋轉、局部扭曲、補繪或 AI 補格。

8 個網頁圖集均為 1024×768、4×2 格，每格 256×384，足點 (128,372)。身高校準對照第一批 doctor 正面待機可見高度 295px，graduate 身形比例 432/450；本組正面待機實際 284px，同角色全部 64 格同一縮放率。previewBox 與 portraitBox 見 manifest。

## 驗收界線

本資料夾已檢查 64 格透明邊界、尺寸、足點規格、來源／網頁 SHA，以及 8 張原檔和 8 張網頁 inspection 的姿勢、衣物、手持、鞋底與年齡臉型。人工檢查與自動檢查分開記錄；hash 不相同不能單獨證明步態正確。inspection 圖是素材檢查圖，不是遊戲畫面。實際試穿、大廳跑跳、手機和遠端渲染由主整合批次另交 browser 證據；本檔不宣稱那些尚未在此執行的項目已通過。
