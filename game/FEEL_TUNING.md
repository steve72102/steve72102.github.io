# 第二步：角色朝向、步伐與停走

日期：2026-11-02（臺灣時間）。基準為公開 a22c09e 加第一步移動補丁。本文件記錄實作選擇；是否發布以接手端的實際 commit／部署結果為準。

## 已確認的問題與處置

| 優先度 | 原本可重現情形 | 這一步的處置 |
| --- | --- | --- |
| 高 | 按著方向撞牆仍持續播放固定速度跑步 | 以實際位移判斷跑步；保留輸入意圖供原有推桌／網路邏輯使用 |
| 高 | 遠端收到停止狀態後，腳已停下，位置仍繼續插值 | 插值後的可見位移決定步態；到達後再取一次靜止樣本，確保停腳 |
| 中 | 固定 CSS 兩格動畫與移速無關，換方向容易重新起步 | 沿累積移動距離延續步伐；Shift 加速自然增加步頻 |
| 中 | 方向直接換圖，斜向邊界容易來回切換 | 顯示朝向平滑並保留方向死區；實際位置不延遲 |
| 中 | 動畫收尾可能持續重畫、或把站桌上誤判成跳躍 | 使用桌面支撐高度、有限落地反應與明確停止條件 |

## 視覺風格與效果上限

維持明亮、親和的原創藥學學院。此階段採小幅身體重心與落地反應；固定牆面、植物、獎勵、杯子破碎及對戰效果維持既有行為，不新增整畫面震動、殘影、音樂或粒子。

- 碰撞、跳躍、角色座標、速度及網路封包仍由原有程式決定。顯示模組僅接收樣本，不回寫遊戲狀態。
- 步伐循環距離：64 個經場景比例校正的座標單位。
- 朝向平滑時間常數：65 ms。這不是 65 ms 的輸入延遲，亦非承諾所有轉向都在 65 ms 內完成。
- 落地反應：140 ms；畫面中斷超過 250 ms、換場景、大幅位置校正時重置姿態。
- 兩張既有跑步影格依步伐相位選擇；不再同時播放舊 CSS 自主迴圈。
- 正常跑步傾斜上限 1.75°；抵住障礙時最多 0.7°；落地寬度最多 1.018 倍、高度最低 0.965 倍；起跳最多 1.012 倍高度。所有效果會回正。
- 只變形角色圖層，以原本腳底錨點為中心。外層落點、跳躍高度、透視比例、頭頂名字、稱號與陰影定位不由這個模組修改。
- 內部方向模型可表達八個方向，畫面仍使用原素材的基本方向；四向顯示在 45° 邊界外保留 6° 死區。
- 減少動態效果時，保留朝向與移動功能，停用步伐切格、額外傾斜與落地變形；偏好改變時靜止角色也更新。

以上數值是本專案調校值，不是 Riot 公布的 LOL 動畫參數。

## 素材界線

未裝備角色沿用原始圖集的兩格步態；已裝備角色仍是原有三張靜態 SVG 視圖，左側仍沿用右側鏡像。這一步改善步頻、停走、朝向與小幅姿態銜接，沒有新增獨立左右服裝原畫、四肢骨架或八格跑步美術。需要更多步態與不對稱裝備的正確左右視角時，應接續素材階段處理，不能把整張圖的位移／旋轉稱為完成了新肢體動畫。

## 量測與驗收預算

- 相同操作在關閉動作模組、開啟動作模組、減少動態三種情況，移動／跳躍座標與 onMotion 內容逐筆相同。
- 30／60／144 Hz 的相同距離步伐相位一致；第一步的 30／60／120 Hz 跳躍測試保留。
- 靜止 60 個合成角色在必要轉向／落地收尾後，姿態樣式寫入量為 0；每幀不重建裝備 SVG。
- 60 個合成角色的本地渲染數據只用來找回歸，不代表 60 真人連線、真機流暢度或公開服務已通過驗收。
- 瀏覽器檢查必須同時讀狀態與查看截圖。只通過 DOM 斷言不能證明朝向、腳底與服裝呈現正確。
- 正式發布前仍需實體手機／Safari 與公開頁面試玩；完整結果與可重跑指令見交付包。

## 參考資料與本輪套用的 skill

1. [Riot：Character Animation](https://www.riotgames.com/en/artedu/character-animation) — 參考姿態、時間、狀態銜接；此模組由本專案自行實作。
2. [Riot：Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/) — 朝向、角色輪廓與事件重要性保持清楚。
3. [Riot：Animation in the League of Legends Client](https://www.riotgames.com/en/news/animation-league-legends-client) — 此文談賽前 client；參考 transform／opacity 與渲染成本觀念，未將其稱為 LOL 對戰引擎。
4. [Riot：Down The Rabbit Hole of Performance Monitoring](https://www.riotgames.com/en/news/down-rabbit-hole-performance-monitoring) — 先量測，區分測試情境，避免平均 FPS 掩蓋卡頓。
5. [OpenAI game-playtest，固定版本](https://github.com/openai/plugins/blob/0722921d5542fc593105c27bd52630babd8b8c2a/plugins/game-studio/skills/game-playtest/SKILL.md) — 已讀並採用實際操作、代表狀態截圖、UI／渲染分開檢查流程；Game Studio 0.1.2 manifest 標示 MIT。
6. [abagames maximizing-game-feel，固定版本](https://github.com/abagames/agentic-gamedev-skills/blob/82a83d8951da7d28c58a50df36b9448fabf84558/.agents/skills/maximizing-game-feel/SKILL.md) 與 [技巧參考](https://github.com/abagames/agentic-gamedev-skills/blob/82a83d8951da7d28c58a50df36b9448fabf84558/.agents/skills/maximizing-game-feel/references/technique-catalog.md) — 已讀並採用有界視覺反應、碰撞獨立、前後機械結果一致的流程；原作者 LICENSE 為 MIT。

這些 skill 用於本次開發與驗收；未安裝外部引擎或執行上游安裝腳本。沒有加入 Riot 素材或第三方 skill 程式碼，遊戲執行時亦不依賴 ChatGPT、skill 平台或新增付費服務。
