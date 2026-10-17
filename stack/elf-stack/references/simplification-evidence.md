# 「GitHub Actions 未釘 SHA」證據清單（elf-express/skillshare-source 歷史）

> 調查日期：2026-10-17。來源：本 repo 的 `559e52a`（E-302 稽核時的 dev）與 GitHub 官方資料。每一條都可以用表內指令重現。**沒有證據的不列。**

| # | Commit / 位置 | 檔案 | 內容 | 重現方式 |
|---|---|---|---|---|
| E1 | `559e52a` | 各 `elf-*` skill 的範本與文件 | E-302 稽核：`uses:` 行沒有釘 40 碼 commit SHA 的共 39 筆 | `git grep -nE 'uses: *[^ ]+@' 559e52a -- '*/elf-*' '*/*/elf-*' \| grep -vE '@[0-9a-f]{40}'` → 39 筆 |
| E2 | `83cb805`（elf-express/mcp-library，pin all actions to SHA） | `.github/workflows/*.yml` | 團隊自己的 org policy：所有 action 釘 SHA。本表把同一個政策寫進 skill，讓 AI 產出的範本與 mcp-library 一致 | `gh api repos/elf-express/mcp-library/commits/83cb805 --jq '.commit.message'` |
| E3 | CVE-2025-30066（tj-actions/changed-files） | 上游 action 的 tag | 2025-03 該 action 的 tag 被改指向惡意 commit，外洩使用者 CI secrets；釘 40 碼 SHA 的使用者不受影響 | `gh api advisories/GHSA-mrrh-fwg8-r2c3 --jq '.cve_id, .summary'` |
| E4 | GitHub 官方文件（規則 11 的依據） | https://docs.github.com/en/actions/reference/security/secure-use | Dependabot 會更新以 SHA 釘選的 action：「Dependabot updates the version documentation of GitHub Actions when the comment is on the same line」；SHA 沒有對應 tag 時改更新到最新 commit | `curl -sL https://docs.github.com/en/actions/reference/security/secure-use \| grep -o 'version documentation of GitHub Actions when the comment is on the same line'` |

## 對 skill 的直接影響

- E1–E3 → 規則 9（`uses:` 釘 SHA）、規則 10（不得改回 tag）
- E4 → 規則 11（下游啟用 Dependabot `github-actions`）
