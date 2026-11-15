# 交線學院 COMMON｜可動角色美術缺件與單格退件

使用者確認的角色正面穿搭為 `original-character-review/common-front-masked-preview.png`。它使用原遊戲博士高解析原圖的頭臉髮與手部遮罩。該檔是 1024×1536 正面／略側身原畫，不是遊戲 256×384 可動影格。

## 已盤點的原遊戲素材

- `game/assets/academy/doctor-run.webp`：原有四方向、兩列動作的 1536×1024 圖，原頭髮與臉可作身份參照。隔離副本的 `doctor-run-source.png` 為本機解碼檢查檔，另有四張第一列裁切參照。
- `game/assets/native-avatar/pineapple-doctor/`：四方向各 `run`、`actions` 八格的既有圖集，動作覆蓋充足，但穿的是已完成的舊套裝。
- `game/assets/painted-avatar/doctor-v1/` 加方向增量：逐格的八欄分層圖，現有商品 ID 為 `fruit-pineapple-*`，不能直接當成新 COMMON 商品的完整原畫。
- `idle-probe.png`、`idle-probe-v2.png`：只在隔離 HTML Canvas 做的單格實驗。第一張僅把黃色外套轉綠；第二張還換用原有簡裝褲子與原髮、重新配色鞋書。兩張仍保留舊肩飾、原衣片輪廓與小尺寸模糊感，和已確認的正面原畫不一致，**均退件**。沒有登錄商品或改遊戲程式。
- `original-character-review/run-direction-candidates/`：依原 `doctor-run.webp` 四方向第一列與已核准 COMMON 正面製作四張高品質跑姿**服裝底稿**。同系列短外套、肩披與單側刺繡方向已能辨認，但圖像生成重畫了頭手與身形，不能直接使用。正面跑姿以原遊戲頭手遮罩合成的 `down-original-head-garment-pilot.png` 仍有頸側與雙臂殘影，**退件**。底稿只供重新對位與補畫參考，不是新的四方向遊戲素材。

## 正式素材仍缺

1. 同一套 COMMON 的 LEFT、RIGHT、BACK 服裝原畫需與原角色各方向頭髮、臉、身體、手部逐像素或關節對位；現有四張跑姿底稿只證明服裝設計可見，未通過此關。
2. 同座標、可穿脫的八欄透明衣片，包括袖口與肩披前後遮擋；原正面試作沒有足夠分層母檔。軟帽與空白筆記本須補畫，不能拿既有鳳梨套裝低品質換色替代。
3. 原版型在各方向 RUN8 與既有動作的實際美術或合格分件骨架適配。`doctor-run.webp` 只有兩列姿態；現有 64 格屬另一套服裝。
4. 同 ID 的商城試穿、背包、衣櫥、場景畫面與舊存檔回退測試。

目前不能根據靜態原畫或單格換色試驗聲稱已完成可動裝備；正式站點未上傳。下一步應先補製原角色身份不變的三方向高品質服裝原畫，完成一個方向的分件與 idle/RUN8 局部檢查，再擴至其餘方向。

## 2026-11-15 全角色委託後進度

使用者批准相同美術方向延伸至全部十人，並要求先將現有進度更新雲端。`build-cast-coverage.cjs` 產生 `CAST_ART_COVERAGE.json`，確認十人各有原始肖像與跑姿；既有十套 native manifest 屬舊鳳梨服裝，不能充作交線學院 COMMON。十人的正面遮罩候選見 `original-character-review/ten-front-candidates.png`。全部十人四方向與八欄 COMMON 分件、RUN8、商城／背包／場景真實 UI 均未完成。

教授正面候選使用原角色臉髮與手部像素遮罩；五個臉／手採樣點中四個原圖與合成圖逐像素一致，另一本書的採樣點改由服裝底稿承接。其餘角色正面也以原頭手遮罩合成，已目視全身圖，但仍屬候選、未進入遊戲。所有原始 PNG 保持唯讀。

博士四方向跑姿的服裝底稿已再以來源頭手合成：`run-direction-candidates/down-layer-probe.png` 及 `left/right/up-original-head-garment-pilot.png`。DOWN 的舊衣殘片大幅減少；LEFT、RIGHT、UP 仍有頸口錯位或邊緣殘點，而且只是每向單一跑姿，並非 RUN8。這四張一律標記**退件／待補畫**，不得寫入遊戲 manifest 或商品圖。
