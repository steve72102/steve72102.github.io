# 交線學院 COMMON｜上傳門檻（2026-11-14）

使用者已確認原角色正面高品質預覽，並授權完成後上傳。當前狀態為 **正面美術已確認；遊戲動作素材未通過，不得上傳**。

| 階段 | 狀態 | 證據 |
| --- | --- | --- |
| Fashion DNA 與 Common Recipe | 已保留；8 項測試通過 | `../outfit-recipe-pilot/`、`FOLLOWUP_MANIFEST.json` |
| FRONT 美術方向 | 使用者已確認 | `doctor-common-front-v1.png` |
| 四方向靜態穿搭原畫 | 已生成並並列目視 | `four-view/compare.png`、`four-view/FOUR_VIEW_QA.md` |
| 正面外套透明分件 | 退件 | `parts/jacket-fit-v4.png`、`parts/PART_FIT_QA.md` |
| 其餘七欄、四方向、動作素材 | 未製作／未驗證 | 無合格素材 |
| 商城、背包、衣櫥、場景真實 UI | 未接入／未驗證 | 遊戲程式未修改 |
| 正式網站 | 未上傳 | 隔離工作樹未推送 |

目前 `game/painted-avatar.js` 所用的原畫層含八欄、方向與 256×384 單格／1024×768 圖集規格；本批 1024×1536 穿搭插畫無法直接宣稱為可跑步裝備。要讓同一件衣服在商品卡和場景一致，須先建立共座標的透明部件、對應的實際動畫格，再核對商品 ID 與真實 loadout。任何一項缺圖只能沿用原有正確穿戴回退，不能把幾何示意或靜態全身圖當成完成品。

使用者已同意改用精確像素遮罩分層，且已確認原角色正面試作，見 `original-character-review/FRONT_V2_REVIEW.md`。先前四方向圖與失敗分件留作歷史檢查資料，不沿用為本款後續已驗收成果。現有可動素材試驗見 `RUNTIME_ART_GAP.md`。

2026-11-15 範圍更新：使用者要求先將目前進度更新雲端。隔離副本現有十位的正面候選，見 `original-character-review/ten-front-candidates.png`；其中只有博士正面曾獲使用者確認。`CAST_ART_COVERAGE.json` 是逐人的來源與缺件清單。全部四方向／八欄／RUN8 及真實 UI 尚未達標；可上傳隔離進度分支供檢視，但不得將候選圖接入正式遊戲或宣稱完成。
