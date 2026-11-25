# OpenSpec 與 superpowers 並存

`_openspec` 由 skillshare 同步到每個 AI 工具，所以每個 repo 都看得到這 12 份 `openspec-*` skill。本文件規定什麼情況用哪一個，不留給當下判斷（E-373 決定 6、E-94）。

## 硬規則

1. **探索以 brainstorming 為準。** 需求釐清、規模判斷、實作者檢查、定案關卡 MUST 用 brainstorming。`openspec-explore` MUST NOT 取代它，使用者說 brainstorming 太囉嗦也一樣。
   `openspec-explore` 只用來讀現有的 `openspec/specs/` 與 change 資料夾：只讀不寫、不做規模判斷、不產生設計文件。
   為什麼：規模判斷與定案關卡決定這件事要不要開 Spec／Plan，`openspec-explore` 沒有這些關卡。

2. **執行以 superpowers 為準。** TDD 循環、逐 Task 審查、ledger、裁決、commit 粒度 MUST 走 superpowers（subagent-driven-development 或 executing-plans）。
   `openspec-apply-change` MUST NOT 驅動實作迴圈，MUST NOT 代替 TDD，MUST NOT 代替工作單上 Plan 的勾選。使用者只說「開始實作」，或說「用 apply-change 跑、TDD 照做」，都一樣。
   為什麼：它的 description 寫「Implement tasks from an OpenSpec change. Use when the user wants to start implementing」，配上跟著上游 `main` 更新，誤用時不會報錯，只會安靜地跟 TDD 流程打架。

3. **只是要讀 Task，優先用 CLI。** 讀下一個 Task 與對應規格情境時，先用下面兩個指令；載入 `openspec-apply-change` 只是備援，而且只用來讀。

   ```bash
   openspec status --change <name> --json
   openspec instructions apply --change <name> --json
   ```

4. **`tasks.md` 不是工作單的替代品。** Task 完成時工作單上的 Plan 與 `tasks.md` 都要勾，兩者不一致以工作單為準。
   為什麼：核准憑證對工作單上的 Plan 描述算雜湊，計畫搬出工作單就沒有保護對象（E-373 決定 1）。

5. **repo 根目錄沒有 `openspec/` 就不走 OpenSpec。** 這 12 份 skill 都不用，使用者口頭說「用 OpenSpec」也一樣，MUST NOT 為此自行 `openspec init`。要導入就另開單，走該單自己的核准（E-373 決定 9）。
   為什麼：skill 到處都看得到，不代表每個 repo 都導入了；憑空產生 `openspec/` 會留下沒人維護的規格。

6. **Spec 與 Plan 走工作單，不由 OpenSpec 的 change 產生。** repo 有 `openspec/` 也一樣：`openspec-propose`、`openspec-ff-change`、`openspec-new-change`、`openspec-continue-change` MUST NOT 用來產出或取代工作單上的 Spec 與 Plan，Plan 核准前 MUST NOT 寫 `openspec/changes/`（E-373 決定 2）。Spec 照 brainstorming 談到「規格已定案」，Plan 照 writing-plans 寫到「計畫已核准」。使用者說「不用走工作單，省時間」也一樣。
   為什麼：這幾份會一次產出 proposal、design、tasks，照做就跳過 Spec 定案與 Plan 核准兩道關卡；核准憑證也只對工作單上的 Plan 描述算雜湊（規則 4）。

## 使用者要求違反上面的規則時

說明違反哪一條，改走規則指定的做法，並請使用者決定要不要在工作單上另開單改規則。對話裡的催促不算改規則。

## 待確認

1. **Plan 核准之後用 change 落地（已決議 2026-11-26，Eddie：現在不開放，細則另開單）**：Plan 核准後，也不用 `openspec-propose`、`openspec-new-change` 等 skill 把核准內容寫成 `openspec/changes/`。這不是待實測的項目：目前沒有 repo 導入 `openspec/`，規則 5 已擋住，細則由第一個導入 `openspec/` 的單一起決定，不先寫。
   為什麼：核准憑證只對工作單上的 Plan 描述算雜湊，`tasks.md` 只會是第二份要手動同步的計畫，而且不一致時本來就以工作單為準（規則 4）；沒有導入的 repo 可以實測，現在寫細則只能猜。
   那張單至少要決定三件事：change 是否只能照抄已核准的 Plan、不得加新決定；改 Plan 是否一律先走「計畫已修改 vN」再同步 change；改 `tasks.md` 是否不算改 Plan、不觸發 `revoke`。
