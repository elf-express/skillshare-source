# Token 對照表（填入 SPEC.md 第 4 節）

規則：團隊 CSS token 欄只能填 `elf-ui-pattern` 規則 27 的名稱；對不到時填「新提案」並在 SPEC.md 待確認列出（`elf-ui-pattern` 規則 31）。
antd 欄名稱以專案安裝的 ant-design-vue 版本型別為準（4.2.6 已核對，見 `references/tokens.md`）。

## 1. 顏色

| 設計端名稱（Figma variable / 原型 CSS 變數） | 設計值 | 用途（出現在哪些元素） | 團隊 CSS token | antd `theme` 路徑 | 處理 |
| --- | --- | --- | --- | --- | --- |
| `--color-primary-colorprimary` | `#______` | 主按鈕、選中側欄、進度條 | `--primary` | `token.colorPrimary` | 沿用 |
| `--color-primary-colorprimaryhover` | | hover | `--primary-hover` | `token.colorPrimaryHover` | |
| `--color-primary-colorprimaryactive` | | 按下、連結 | `--primary-active` | `token.colorPrimaryActive` | |
| （info） | = primary | 資訊提示 | `--primary` | `token.colorInfo` | 必設 |
| success / warning / error | | | `--success` / `--warning` / `--error` | `token.colorSuccess` / `colorWarning` / `colorError` | |
| 文字 88 / 65 / 45 / 25 | | | `--text` / `--text-2` / `--text-3` / `--muted` | `colorText` / `colorTextSecondary` / `colorTextTertiary` / `colorTextPlaceholder` | |
| 邊框 / 分隔 | | | `--line-2` / `--line` | `colorBorder` / `colorBorderSecondary` | |
| 頁面底 / 卡片 / 懸浮層 | | | `--bg` / `--surface` / `--surface` | `colorBgLayout` / `colorBgContainer` / `colorBgElevated` | |
| 側欄底 | | | `--sider` | `components.Layout.colorBgHeader` | |
| 分段軌道 | | | `--seg-bg` | `components.Segmented.colorBgLayout` | |
| 遮罩 | | | 新提案 | `token.colorBgMask` | 待確認 |
| <其他原型值> | | | <合併到 / 新提案> | | |

## 2. 非顏色

| 類別 | 設計值 | antd `theme.token` | CSS | 刻度內？ |
| --- | --- | --- | --- | --- |
| 字型 | 團隊繁中堆疊 | `fontFamily` | `--font` | — |
| 等寬字型 | | — | `--font-mono` | — |
| 內文字級 / 行高 | 14 / 22 | `fontSize` | 直接寫 | 是 |
| 圓角 XS / SM / base / LG | 2 / 4 / 6 / 8 | `borderRadiusXS/SM/borderRadius/LG` | 直接寫 | 是 |
| 控制項高 SM / base / LG | 24 / 32 / 40 | `controlHeightSM/controlHeight/LG` | 直接寫 | 是 |
| 懸浮陰影 | 三層 | `boxShadow` | `--overlay-shadow` | — |
| 卡片陰影 | | `boxShadowTertiary` | `--card-shadow` | — |
| 動效 | 0.2s | `motionDurationMid` | 直接寫 | — |
| <刻度外的值> | <34px> | | | 否 → 理由：<> |

## 3. 實作後核對

- [ ] 表 1 每列的「團隊 CSS token」都存在於 `app.css :root`，且沒有表外名稱
- [ ] 表 1 每列的 antd 路徑都在 `theme.ts`，值與 CSS 相同
- [ ] `theme.test.ts` 覆蓋表 1 全部列與字型（`references/tokens.md` §6）
- [ ] `.vue` / `.ts`（`theme.ts` 以外）沒有 hex / `rgb()`
