## 下載哪一個？ / Which file?

| 你的系統 System                         | 下載 Download      |
| --------------------------------------- | ------------------ |
| **Windows**                             | `…_x64-setup.exe`  |
| **macOS** — Apple Silicon 或 Intel 皆可 | `…_universal.dmg`  |
| **Linux** — Ubuntu / Debian             | `…_amd64.deb`      |
| **Linux** — 其他發行版 Other distros    | `…_amd64.AppImage` |

安裝完就不用再回這頁了，App 會自己檢查更新。
Once installed, the app updates itself.

<details>
<summary>其他檔案是什麼？ / What are the other files?</summary>

- `…_x64_en-US.msi` — Windows 的另一種安裝格式，企業派送用。一般使用者用 `-setup.exe`。
- `<AppName>-…-1.x86_64.rpm` — Fedora / RHEL 系的 Linux 套件。
- `<AppName>_universal.app.tar.gz` 與 `.sig` — **自動更新專用**，App 自己會抓，不需要手動下載。
- `latest.json` — 更新檢查用的清單檔，同上。

</details>

**macOS 使用者：** `universal` 表示同一個檔案同時包含 arm64 與 x86_64，
Apple Silicon 上跑的是原生 arm64。不需要找「M1/M2 版」，就是這個。

**Windows 與 Linux 目前只提供 x86-64。** Windows on ARM 可透過系統模擬執行 x64 版。

---

<!-- 放到 .github/release-body.md（release.yml 的「Read the release notes」step 讀取；這是唯一來源）。
     release.yml 有 docker job（elf-cicd-docker）時保留下面這行，<owner>/<repo> 一律小寫；沒有 docker job 時刪除這行與上方的 --- -->
網頁版容器映像 / Web deployment images: `ghcr.io/<owner>/<repo>`
