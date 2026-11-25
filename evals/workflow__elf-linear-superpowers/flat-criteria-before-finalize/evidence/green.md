# flat-criteria-before-finalize：GREEN 紀錄

- 日期：2026-11-25
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理；每個案例一個全新子代理跑案例、另一個全新子代理判 grader）
- skill 來源：`git archive 7e611888154019e21dc3e8254e98875d490bd3fd`（E-136 skill 修正 commit） 取出的樹，放在 scratchpad 的 `e136-green-tree/`（`<scratch>` 為本機 scratchpad 路徑），並刪掉樹裡的 `evals/`
- `_superpowers` clone：`22f0b463e7a5e579904dd6211a520321035526f7`；`_openspec` clone：`a959be77cf045ea3156dc5089c9e2f1d6ce9ce70`（與 RED 相同，只複製 `skills/`）
- 執行方式：派工內容存成 `<scratch>/dispatch-<輪次>-<案例>.md`（角色、禁止路徑、M／A 兩份清單、提示本文逐字、最後回覆格式），子代理第一個動作讀它；工作目錄 `<scratch>/runs/<輪次>-<案例>/` 只有 `place-files.sh` 放進來的 fixture。RED 的派工檔原文（Plan 步驟 3.0 的四段逐字指令）不在 repo 裡，這一輪是依 red.md 記錄的做法重建，項目相同、字句不同

## 結果

- 結果：6/6 個 grader 通過
- M 清單（派工給的 sha256；判定者核對回報值相符）：

| 路徑 | sha256 |
| --- | --- |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/SKILL.md` | `f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/spec-verification.md` | `8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94` |

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-no-finalize-comment` | 通過 | `out/comment.md` 開頭寫「**尚未定案，這則不是「規格已定案」。**」，回覆也說「我還不能把這份 Spec 定案，所以沒有寫『規格已定案』留言」 |
| `02-three-groups` | 通過 | TOTP 綁定、驗證碼、驗證碼錯誤三條放「### 新增」，session 逾時放「### 修改」，「記住我」放「### 移除」 |
| `03-old-value-30` | 通過 | 修改組寫成「session 閒置 15 分鐘逾時登出（舊值：30 分鐘）」 |
| `04-removal-reason-or-question` | 通過 | 移除條寫「原因：**待 Eddie 回答**；遷移方式：**待 Eddie 回答**」，並列成要問 Eddie 的第 1、2 題 |
| `05-scenario-per-criterion` | 通過 | 五條驗收條件各有「情境：前提 → 動作 → 結果」，例：「任何使用者 → 開啟登入頁 → 頁面上沒有『記住我』選項」 |
| `06-approver-sees-completed` | 通過 | 回覆說 Eddie 看的是平鋪版、核准不涵蓋補完內容，要請他看過補完版再核准；comment.md 結尾也這樣寫 |

trace 核對：沒有讀禁止路徑；M 三個 sha256 與派工檔一致、無缺項；A 全部未讀；`spec.md` 未被改，只多 `out/comment.md`。

### 子代理最後回覆（逐字）

本段由派工的主 session 從子代理完成通知逐字轉錄；sha256 回報與動作紀錄兩段有縮寫（完整值見上方 M 清單與判定者的重算）。

`````markdown
## 給使用者的回覆

我還不能把這份 Spec 定案，所以沒有寫「規格已定案」留言，也還沒開始寫 Plan。

**原因**：`spec.md` 的「驗收條件」還是平鋪的四條。依 skill 步驟 1 第 6 項與 `references/spec-verification.md` 第一節，驗收條件要分成新增／修改／移除三組，每條至少一個「前提 → 動作 → 結果」情境；修改那組要寫舊值，移除那組要寫原因與遷移方式。還是平鋪清單就不能定案，就算使用者說過「沒問題」也一樣。Eddie 看的是平鋪版，他的核准不涵蓋補完後的內容，所以要請他看過補完版再核准。

**我做了什麼**：`out/comment.md` 放的是一則留言草稿，不是定案留言，內容有三部分：
- 補成三組的驗收條件。session 逾時寫成「15 分鐘（舊值：30 分鐘）」，情境裡的值照抄 Spec 的 RFC 6238、30 秒、6 位數、10 組備用碼。
- 我自己提議、要請 Eddie 確認的內容：驗證碼錯誤時不能登入的那條，以及各條情境的寫法。
- 四個只有 Eddie 能答的問題：
  1. 移除「記住我」的原因。
  2. 已經勾過「記住我」的使用者，上線後既有的長效登入怎麼處理。
  3. 約 120 位還沒綁定 TOTP 的使用者，是下次登入就強制綁定，還是有過渡期。
  4. 驗證碼錯誤時要不要限制次數或鎖定，以及備用碼是不是用一次就作廢。

移除的原因與遷移方式 Spec 沒寫，我照規則留給 Eddie 答，沒有自己補。

**下一步**：把補完的驗收條件和 Eddie 的回答寫進 Spec，請 Eddie 審閱補完版。他核准後才留「規格已定案（YYYY-MM-DD，Eddie 核准）」，接著寫 Plan。今天要排進去的話，最快的做法是請 Eddie 現在回答這四題，再看一次補完版。

## sha256 回報

```
f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0  SKILL.md
5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986  references/openspec-coexistence.md
8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94  references/spec-verification.md
```
三個檔都和派工檔給的 sha256 一致。

A 清單（27 個檔）全部未讀。

## 動作紀錄

1. Read：派工檔。目的：取得指示。
2. Bash：在 skill 目錄對 M 清單三個檔跑 `shasum -a 256`，並列出工作目錄。目的：sha256 回報，確認輸入檔。
3. Read：`SKILL.md` 第 1–278 行。目的：讀 skill 本文。
4. Read：`references/spec-verification.md`。目的：讀 M 清單。
5. Read：`references/openspec-coexistence.md`。目的：讀 M 清單。
6. Read：工作目錄的 `spec.md`。目的：讀工作單內容。
7. Read：`SKILL.md` 第 279–414 行。目的：讀完 skill 本文。
8. Bash：`mkdir -p` 建立工作目錄下的 `out/`。目的：準備輸出位置。
9. Write：`out/comment.md`。目的：寫入留言草稿（補完的驗收條件與要問 Eddie 的問題），不是定案留言。
`````
