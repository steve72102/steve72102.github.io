# 藥學遊戲穿戴原畫｜暫停與交接（2026-11-17）

## 指令與聯絡

使用者已要求左側 Codex **暫停全部遊戲實作**，把現有進度交給右側 ChatGPT 對話「接續藥學遊戲精修」完成，再回傳左側。左側不再繼續修改或發布遊戲。右側收到後請在隔離副本接手；完成時用可用的跨對話工具把成果訊息與檔案連結送回 Codex thread `01a18ddb-788b-7421-9a91-e0d1372aac00`。若沒有跨對話工具，請在右側對話提供完整交付 ZIP 與摘要，明確請使用者轉交左側。不要宣稱已回傳，除非實際發送成功。

正式網站：`https://steve72102.github.io/game/`。最後已發布 `main` commit 為 `79e74084aca72f7bc914e126eed75eaf264a49c7`。本交接中的候選人物圖與程式**尚未上架**，正式 `main` 和玩家資料未被本批更動。

## 目標

將既有裝備做成真正可穿脫、能跟原本十位角色在四方向 `actions`／`run` 動作中一致移動的高品質原畫分件；保留角色原臉、髮、手、身形，八欄 ID、玩家存檔、金幣、Firebase 與既有美術。使用者同意上架後再自行目視檢查，仍須如實標示未驗證的畫面。商品卡 JPG 不是透明人物穿戴層，不能直接貼到角色身上。

批次盤點：151 件裝備 × 10 位角色 = 1,510 組。合併最新隔離裝備清單與工作區現有角色 manifest 後，結構上 15 組宣告完整 64 格、73 組部分支援、1,422 組缺素材；這是 manifest 宣告盤點，**不是**逐格畫質驗收。細項見 `wearable-coverage-sanitized.json`。已上架的 15 件許願池與 9 件原學院裝備有立體**商品單件圖**，不代表角色穿戴原畫完成。

## 本批未發布的具體進度

`candidate/` 是隔離工作樹的增量快照，路徑相對於 repo 根目錄：

- `game/assets/painted-avatar/professor-river-coat-v1/`：8 張 1024×768 透明外套圖集（down/left/right/up × actions/run，每張 4×2 = 8 格）與新 manifest。它們由教授既有 Crossline 外套動作圖非破壞性衍生，改成溪藍／銀邊並加細水線；保留原姿勢和 alpha。**這只是材質與紋樣試作，外套輪廓仍沿用舊版，未達到所有裝備獨特版型的最終目標。**
- `game/painted-avatar.js`：容許新 outfit manifest 明列借用同角色已註冊 outfit 圖層，並依實際裝備覆蓋分數挑選 manifest；需查核混搭優先序。
- `game/painted-crossline-common.js`：登錄新 `professor-river-coat-v1`，並讓已穿 `wish-river-coat` 的教授預載動作格。
- `game/assets/shop/wish-river-coat-v1.jpg`：已上架的單件商品原畫副本，供對照設計；不是人物層。
- `tools/outfit-recipe/materialize-river-jacket.ps1` 與 `build-river-manifest.cjs`：可重建上述試作；原始圖沒有被覆蓋。
- `tools/outfit-recipe/river-motion.test.cjs`：宣告與 4×2 圖集路徑測試。

`source/` 保存本批使用的 8 張原教授 Crossline 外套圖集與原 manifest。`docs/baseline-main/` 是已發布 main 的兩份程式原版，`docs/patches/` 是候選相對於 main 的可讀差異。對比圖 `professor-jacket-source-cell.png`、`professor-river-jacket-cell.png` 只展示一格外套層，不是人物完整合成，更不是完整 UI 驗收。

本批實測 `node --test --test-isolation=none tools/outfit-recipe/river-motion.test.cjs tools/outfit-recipe/professor-mixed-fallback.test.cjs`：2/2 通過，詳見 `TESTS.txt`。尚未測：圖像逐格品質、四方向人物合成、RUN8 實際動作、混搭所有排列、下載失敗回退、正式遊戲 UI、手機、發布後快取。新 manifest `status: complete` 僅指宣告 64 格覆蓋，不等於美術驗收。

## 右側接續優先順序

1. 從最新 main 建立隔離副本，核對本包基線 SHA；以 `docs/patches` 三方合併，不直接覆蓋已變更檔案。
2. 評估溪藍試作是否真正達到原畫品質；若仍像舊外套換色，重新製作版型，不要把此候選當完成品。保留原圖、臉髮手與現有可跑角色。
3. 用 `.agents/skills/game-wearable-batch/SKILL.md` 和 `tools/outfit-recipe/wearable-coverage.cjs` 建立可重複的批次製作及載入流程。每件 ID 要對應獨立分件與 4 方向 RUN8，仍沿用現有八欄裝備，不改金幣與存檔。
4. 只有完成可用動作素材的項目才接入商城、背包、衣櫥與場景；缺件誠實列出。視情況分批交付，不要以商品卡、鏡像、舊衣換色或單張拉伸虛報所有 1,510 組已完成。
5. 完成後將 code/runtime、原畫來源、manifest、差異、測試與未測事項打包回傳左側 Codex。使用者要求左側暫停；**右側先回傳，不直接改正式 main／網站**，由左側在收到成果與使用者後續指示時處理。

## 載入／快取提醒

目前正式 `game/index.html` 與 `game/sw.js` 仍是 `20261117-dimensional-gear-v1`，未登錄這批新圖。若之後整合，需同步版本、manifest 載入與失敗回退，檢查 Service Worker 舊快取。`professor-river-coat-v1` 新 manifest 借用 `professor-crossline-common-v1`，必須先登錄舊 manifest。不要將新原畫放進正式商品卡而場景仍顯示舊衣。
