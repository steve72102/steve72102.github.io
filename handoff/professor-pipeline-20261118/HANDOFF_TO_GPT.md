# 藥學遊戲教授裝備分件｜交給右側 GPT 修復

GitHub 隔離分支：`codex/professor-pipeline-qa-20261118`，基底提交 `5be61711579155e1fbb770ee4c3ce093dacac887`。正式 `main` 仍是舊圖；**不可把此包候選圖宣稱為上架完成品**。

## 使用者要的結果

先修製作管線，再大量生成。以教授 COMMON 與 `wish-river-coat` 為樣本：八欄 `jacket/cape/shirt/pants/shoes/hat/accessory/handheld` 各有獨立透明原畫與非破壞性遮罩；上衣不得藏舊外套，褲子不得藏衣襬與灰邊。四方向、idle/actions 與 RUN8 遵守原本 4×2、1024×768 圖集和腳底錨點 `(128,372)`。渲染必須用真實 loadout ID。完成後才擴展其他角色；未通過標待補件，不發布為完成品。保留人物臉髮、身體原畫、玩家存檔、金幣和 Firebase 規則。

## 已確認與已做

1. 原 `crossline-shirt` PNG 含綠色舊外套；原 `crossline-pants` PNG 含外套側襬、灰白殘影。`professor-river-coat-v1` 借用兩層，因此只修藍外套無法解決。
2. `game/painted-avatar.js` 原會把不相容的穿戴 ID 換成候選 manifest 的第一件物品。隔離提交 `215fc64` 已移除；`professor-loadout.test.cjs` 驗證 512 個欄位／影格選圖計畫與未支援 ID 回退。這個 runtime 變更尚未進正式 main。
3. `export-professor-qa-plans.cjs` + `render-professor-qa.py` 產生 11 種搭配 × 64 格 = 704 格本機合成總覽，含八欄透明單件、COMMON 整套、river 整套與混搭，解碼 104 個來源影像。來源尺寸、alpha、邊界、細碎像素有自動篩查；它**不是**遊戲畫面與美術驗收。
4. `professor-crossline-pending-v2/` 保存 8 組上衣、8 組褲子 PNG 及各自 alpha mask（共 32 檔），全部是候選，原始 PNG/WebP 未覆蓋。上衣候選取自原教授精緻奶白襯衫，因此去掉舊綠外套，但仍需做成具有 COMMON 系列特徵的獨立新設計；褲子候選已減少側襬與灰邊，但**單穿腰線及部分外輪廓被裁壞**，須重新修。
5. `qa-evidence-20261118/` 有 river 整套、褲子單件的 before/候選對照。若 loadout 真穿 `fruit-pineapple-cape`，畫面出現綠色肩披是正確資料，不能悄悄藏起；另外測試無披風的組合。
6. 本機隔離 HTTP 測試入口、候選圖映射與記憶體測試存檔已準備，三個 HTTP 請求回 200。Chrome 操作工具因無法可靠確認瀏覽器 URL 中止，本輪**沒有**真實遊戲跑動截圖或驗收。

## 請你接續實作

先讀 `PACKAGE_INDEX.json` 和分包；直接檢查來源／候選及四張對照。優先修教授上衣、褲子分件（尤其單穿腰口與褲腿邊緣），保持原圖畫風、皺摺、材質、精細光影及 64 格原動作／座標；只在新檔操作，不改母圖。修正批次遮罩／分件流程，讓相同類型的污染可由自動檢查退件，少量人工目視即可。按真實 ID 驗證八欄、整套和混搭；缺少 standalone cape/hat painted profile 也須標待補件。然後回傳可套用的增量檔、before/after、失敗格與測試報告。若你無法讀取原檔或實際操作遊戲，請指出精確阻礙，不要把合成圖冒充遊戲截圖或聲稱已上架。

成果請先交回本對話的 Codex 接續整合；只有實際遊戲 UI 的教授樣本通過後，才允許合併 main 與擴展其他角色。此任務不需音樂分析、重新製作人物或大量生成服裝。

## 重要路徑

- `game/painted-avatar.js`：真實 loadout 選圖修正。
- `game/assets/painted-avatar/professor-crossline-common-v1/manifest.json`、`professor-river-coat-v1/manifest.json`：目前正式引用的來源；未改動。
- `game/assets/painted-avatar/professor-crossline-pending-v2/`：候選圖、mask 與 `CANDIDATE_PROVENANCE.json`（bytes/SHA256/CRC32）。
- `tools/outfit-recipe/QA_STATUS_20261118.md`：已測與未測。
- `tools/outfit-recipe/qa-evidence-20261118/`：四張對照總覽。
- `tools/outfit-recipe/professor-river-game-seed.js`、`serve-professor-candidate.py`：僅供本機隔離遊戲驗收；不得放進正式入口。
