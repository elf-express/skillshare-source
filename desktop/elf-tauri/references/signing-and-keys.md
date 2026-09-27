# 簽章與金鑰（Signing and keys）

> 本檔是團隊版 `docs/signing-and-keys.md` 範本：新專案複製到 `docs/signing-and-keys.md`，把 `<AppName>`、
> `<appname>`、`<owner>/<repo>` 換掉。來源：TypingTrainer `docs/signing-and-keys.md`（已實機驗證），指令改為 pnpm。

桌面版 release 有三種**彼此獨立**的簽章，搞混會浪費大量時間：

|                            | 回答的問題                  | 成本               | 沒有它會怎樣           |
| -------------------------- | --------------------------- | ------------------ | ---------------------- |
| **Updater 金鑰**（minisign） | 「這個更新是我們發的嗎？」  | 免費，自己產生     | App 拒絕所有更新       |
| **Apple Developer ID**     | 「macOS 願意打開它嗎？」    | US$99/年           | Gatekeeper 擋下 App    |
| **Windows 程式碼簽章**     | 「SmartScreen 會安靜嗎？」  | 約 US$200–400/年   | 首次執行跳警告         |

只有第一項是**必要**的。另外兩項可選；未簽章的版本一樣能正確自動更新，只是會先跳警告。

---

## 1. Updater 金鑰（必要）

Tauri 以 minisign 金鑰簽每個 bundle。App 內建公鑰，簽章不符的更新一律拒絕。

### 產生

```bash
pnpm tauri signer generate -w ~/.tauri/<appname>.key
```

密碼按兩次 Enter 留空。設密碼只是讓 CI 多一個 secret 要管，沒有實質好處——私鑰本來就只存在你的電腦與 repo secret。

檔案已存在時指令會中止。`--force` 會覆蓋；**先確認沒有要蓋掉一把已經出貨的金鑰**。

產生兩個檔案：

```
~/.tauri/<appname>.key       私鑰 — 絕不離開你的掌控
~/.tauri/<appname>.key.pub   公鑰 — 進版控
```

### 安裝公鑰

把 `<appname>.key.pub` 的**完整內容**貼到 `src-tauri/tauri.conf.json`：

```json
"plugins": {
  "updater": {
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6…"
  }
}
```

佔位字串或格式錯誤不只是執行期失敗——`tauri build` 會在簽章步驟直接停下：`failed to decode base64 pubkey`。

### 安裝私鑰

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/<appname>.key
```

金鑰有密碼時另設 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

接著確認 secret 比金鑰檔新：

```bash
gh secret list
ls -l ~/.tauri/<appname>.key
```

**這一步很重要。** 不成對的金鑰會通過所有關卡——建置成功、release 發佈、清單檢查通過——直到使用者按下「下載並安裝」才失敗。

### 備份

把 `~/.tauri/<appname>.key` 存到團隊密碼管理器或離線磁碟。GitHub secret **不是**備份：存入後無法讀回。

遺失私鑰 = 所有已安裝的 App 永遠無法再更新。它們內建的公鑰只接受那一把私鑰的簽章，換新金鑰推不到任何人——每個使用者都得手動重新下載安裝。

### 本機驗證

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/<appname>.key)"
pnpm desktop:build
```

成功時會看到 bundle **與**簽章各兩個（Windows 範例）：

```
Finished 2 bundles at:
    …/<AppName>_x.y.z_x64_en-US.msi
    …/<AppName>_x.y.z_x64-setup.exe
Finished 2 updater signatures at:
    …/<AppName>_x.y.z_x64_en-US.msi.sig
    …/<AppName>_x.y.z_x64-setup.exe.sig
```

### CI 說金鑰格式錯誤時

`Missing comment in secret key` 幾乎都代表金鑰**不存在**，而不是格式錯：Tauri 先 base64 解碼再驗證，空字串就會報格式錯誤。
確認 `version.yml` 呼叫 `release.yml` 時有 `secrets: inherit`——被呼叫的 workflow 只會自動拿到 `GITHUB_TOKEN`。
（TypingTrainer 因此失敗三次 release。）

---

## 2. Apple Developer ID（選用 — macOS）

沒有它，macOS 使用者會看到「無法打開 <AppName>，因為 Apple 無法檢查是否含有惡意軟體」，必須右鍵 → 打開，或到「系統設定 → 隱私權與安全性」允許。

需要 [Apple Developer Program](https://developer.apple.com/programs/) 會員（US$99/年）。

### 要哪一種憑證

**Developer ID Application**——App Store 以外散佈用。只建這一種。

不要搞混：

- _Apple Development_ — 開發時在自己裝置上執行
- _Apple Distribution_ / _Mac App Distribution_ — 上架 App Store
- _Developer ID Installer_ — `.pkg` 安裝檔，Tauri 不產生

### 建立步驟

1. **產生 CSR。** 在 Mac 開「鑰匙圈存取」→ 選單「憑證輔助程式」→「從憑證授權要求憑證」。填 email，CA Email 留空，選「儲存到磁碟」。得到 `CertificateSigningRequest.certSigningRequest`。
2. **建立憑證。** 到 [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates) → **+** → **Developer ID Application** → 上傳 CSR → 下載 `.cer`。
3. **安裝。** 雙擊 `.cer`，會進入登入鑰匙圈並與 CSR 產生的私鑰配對。
4. **匯出 `.p12`。** 在鑰匙圈找到憑證，展開確認底下有私鑰，右鍵 →「輸出」→ `.p12`，設定密碼（CI 要用）。
   若輸出對話框沒有 `.p12` 選項，代表私鑰不在，這張憑證無法簽任何東西。
5. **轉 base64** 作為 secret：

   ```bash
   openssl base64 -A -in Certificates.p12 | pbcopy
   ```

### 查簽章身分

```bash
security find-identity -v -p codesigning
```

複製完整名稱，例如 `Developer ID Application: Your Name (ABCDE12345)`。

### 公證（Notarization）憑據

兩種方式擇一。API key 方式較佳，因為 CI 不會綁定某個人的 Apple ID。

- **App Store Connect API key**：[appstoreconnect.apple.com/access/integrations/api](https://appstoreconnect.apple.com/access/integrations/api) 產生，記下 Issuer ID 與 Key ID。`.p8` 私鑰**只能下載一次**。
- **Apple ID**：到 [account.apple.com](https://account.apple.com) →「登入與安全性」→「App 專用密碼」產生。帳號密碼無效。Team ID 在會員頁面。

### 要設定的 secrets

```bash
gh secret set APPLE_CERTIFICATE            # .p12 的 base64
gh secret set APPLE_CERTIFICATE_PASSWORD   # .p12 匯出密碼
gh secret set APPLE_SIGNING_IDENTITY       # "Developer ID Application: …"

# API key 方式
gh secret set APPLE_API_ISSUER
gh secret set APPLE_API_KEY
gh secret set APPLE_API_KEY_PATH

# 或 Apple ID 方式（團隊 release.yml 範本採用此方式）
gh secret set APPLE_ID                     # Apple 帳號 email
gh secret set APPLE_PASSWORD               # App 專用密碼
gh secret set APPLE_TEAM_ID
```

`tauri-action` 從環境變數讀取；接線方式見 `elf-cicd-desktop` 的 `templates/release.yml`。只有 macOS job 會用到，其他平台忽略。

### 驗證結果

```bash
spctl -a -vvv -t install <AppName>.app     # 應顯示：accepted, Notarized Developer ID
xcrun stapler validate <AppName>.app       # 應顯示：The validate action worked
```

### 第一次通常會卡

- 公證要排隊，數分鐘甚至更久。
- 被拒時只給一個 log id：`xcrun notarytool log <id>` 看原因。
- 憑證 5 年到期；API key 不會到期但可被撤銷。很久沒事的 release 突然失敗，通常是這個。

---

## 3. Windows 程式碼簽章（選用，未設定）

SmartScreen 對所有未簽章執行檔都會警告。要消除需向商業 CA 購買 OV 或 EV 憑證（約 US$200–400/年）；EV 憑證需硬體 token，不適合無人值守的 CI，除非搭配雲端簽章服務。

`tauri-action` 讀取 `WINDOWS_CERTIFICATE`（`.pfx` 的 base64）與 `WINDOWS_CERTIFICATE_PASSWORD`。

注意：信譽累積在**憑證**上而非 App。全新憑證在累積足夠安裝量前仍會跳警告，買了不會立刻安靜。

---

## 總表

| Secret                                | 用途             | 必要性 |
| ------------------------------------- | ---------------- | ------ |
| `TAURI_SIGNING_PRIVATE_KEY`           | Updater 簽章     | 必要   |
| `APPLE_CERTIFICATE` + `_PASSWORD`     | macOS 程式碼簽章 | 選用   |
| `APPLE_SIGNING_IDENTITY`              | 使用哪張憑證     | 選用   |
| `APPLE_ID` + `_PASSWORD` + `_TEAM_ID` | 公證             | 選用   |
| `WINDOWS_CERTIFICATE` + `_PASSWORD`   | SmartScreen      | 選用   |

Updater 金鑰是唯一不可省略的。缺少時 release 建置直接失敗——這是刻意的，確保未簽章的更新永遠不會出貨。

## 發佈

簽章不是最後一步。`release.yml` 會把 release 留在 **draft** 讓人先檢查資產，而更新端點
（`/releases/latest/download/latest.json`）看不到 draft——未公開的 release 對 App 而言就像清單不存在：

```bash
gh release edit vX.Y.Z --draft=false --latest
curl -sSL -o /dev/null -w '%{http_code}\n' \
  https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

`200` 代表已安裝的 App 看得到更新；`404` 代表仍是 draft。
