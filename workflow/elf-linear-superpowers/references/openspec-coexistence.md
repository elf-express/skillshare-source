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

## 使用者要求違反上面的規則時

說明違反哪一條，改走規則指定的做法，並請使用者決定要不要在工作單上另開單改規則。對話裡的催促不算改規則。
