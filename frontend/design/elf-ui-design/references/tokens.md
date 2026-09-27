# Design token 對照

單一來源與同步機制由 `elf-ui-pattern` 規定（規則 27–31、references §7）；本檔補上「從設計端（Figma variables / 原型 CSS 變數）到團隊 token 再到 ant-design-vue `theme`」的對照與非顏色刻度。

- 設計端來源：`prototype/_ds/ant-design-system-*/tokens/fig-tokens.css`（Figma variables 匯出，無單位數字，長度需乘 1px）、DS `readme.md`「Visual foundations」、原型 `<style>` 的覆寫。
- 實作端：`src/styles/app.css :root`（名稱 = `elf-ui-pattern` 規則 27 封閉清單）→ `src/styles/theme.ts`（`TOKENS` + `CSS_VAR_OF`）→ `theme.test.ts`。
- ant-design-vue 名稱已對照 **4.2.6** 型別（`es/theme/interface/`）；升版時重新核對。

目錄：
1. [顏色對照](#1-顏色對照)
2. [字型](#2-字型)
3. [間距 / 尺寸 / 圓角 / 陰影 / 動效](#3-間距--尺寸--圓角--陰影--動效)
4. [對不到 token 的值怎麼處理](#4-對不到-token-的值怎麼處理)
5. [深色模式](#5-深色模式)
6. [同步測試擴充](#6-同步測試擴充)

---

## 1. 顏色對照

| Figma variable（`fig-tokens.css`） | DS 預設值 | 參考原型值 | 團隊 CSS token | antd `theme` |
| --- | --- | --- | --- | --- |
| `--color-primary-colorprimary`（primary-6） | `#1677FF` | `#d97757` | `--primary` | `token.colorPrimary` |
| `--color-primary-colorprimaryhover`（primary-5） | `#4096FF` | `#e08a6c` | `--primary-hover` | `token.colorPrimaryHover` |
| `--color-primary-colorprimaryactive`（primary-7） | `#0958D9` | `#c0623f` | `--primary-active` | `token.colorPrimaryActive` |
| success（readme） | `#52C41A` | `#8a9a5b` | `--success` | `token.colorSuccess` |
| warning（readme） | `#FAAD14` | `#c4922f` | `--warning` | `token.colorWarning` |
| error（readme） | `#FF4D4F` | `#bc4b3c` | `--error` | `token.colorError` |
| `--color-neutral-text-colortext`（opacity-88） | `rgba(0,0,0,.88)` | `#1f1e1d` | `--text` | `token.colorText` |
| `--color-neutral-text-colortextlabel`（opacity-65） | `rgba(0,0,0,.65)` | `#5c5951` | `--text-2` | `token.colorTextSecondary` |
| `--color-neutral-text-colortextdescription`（opacity-45） | `rgba(0,0,0,.45)` | `#8b877e` | `--text-3` | `token.colorTextTertiary`、`colorTextDescription` |
| `--color-neutral-text-colortextplaceholder`（opacity-25） | `rgba(0,0,0,.25)` | `#b8b3a8` | `--muted` | `token.colorTextPlaceholder`、`colorTextDisabled` |
| `--color-neutral-borders-colorborder`（gray-5） | `#D9D9D9` | `#ddd6ca` | `--line-2` | `token.colorBorder` |
| `--color-neutral-borders-colorbordersecondary`（gray-4） | `#F0F0F0` | `#ebe5db` | `--line` | `token.colorBorderSecondary`、`colorSplit` |
| `--color-neutral-background-colorbglayout`（gray-3） | `#F5F5F5` | `#faf9f5` | `--bg` | `token.colorBgLayout` |
| `--color-neutral-background-colorbgcontainer`（gray-1） | `#FFFFFF` | `#fff` | `--surface` | `token.colorBgContainer` |
| `--color-neutral-background-colorbgelevated`（gray-1） | `#FFFFFF` | `#fff` | `--surface` | `token.colorBgElevated` |
| 深色導覽 / 側欄（readme） | `#001529` | `#262624` | `--sider` | `components.Layout.colorBgHeader`（sider 與 header 共用） |
| 分段選擇軌道（原型手刻） | —（antd 用 `colorBgLayout`） | `#f0ebe2` | `--seg-bg` | `components.Segmented.colorBgLayout` |
| `--color-neutral-background-colorbgmask`（opacity-45） | `rgba(0,0,0,.45)` | `rgba(31,30,29,.45)` | **無**（待確認） | `token.colorBgMask` |
| `--color-info-colorinfo` | = primary | 未覆寫 | `--primary` | `token.colorInfo`（**MUST** 設為與 primary 同值，否則 info 狀態仍是藍色） |

規則：
- 原型 / Figma 的值填「參考原型值」欄；團隊 token 名稱只能從 `elf-ui-pattern` 規則 27 選。
- DS 的文字色是「黑色 + 透明度」；參考原型改成實色暖灰。兩種都可以，但**同一產品只能選一種**，並寫在 SPEC.md。實色在深色模式要另給一組值（§5）。
- 表內 `colorInfo`、`colorTextTertiary`、`colorBorderSecondary`、`colorBgLayout`、`colorBgMask` 參考實作的 `App.vue` 都沒設 → antd 元件的次要文字、分隔線、info 色、遮罩仍是 antd 藍灰預設值。實作 **MUST** 設齊本表所有 antd 欄。

## 2. 字型

```css
:root {
  /* Latin → system UI font; CJK → Traditional Chinese glyphs per platform. */
  --font:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC',
    'Helvetica Neue', Arial, sans-serif;
  /* Code / typing text. CJK fallback keeps Chinese in the typing box on TC glyphs. */
  --font-mono:
    'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'PingFang TC',
    'Microsoft JhengHei', 'Noto Sans TC', monospace;
}
```

| 項目 | 規則 | 依據 |
| --- | --- | --- |
| 拉丁字 | `-apple-system` 開頭；**不**寫 `'SF Pro Text'` | DS `fonts.css`：SF Pro 不可散布、已移除；非 macOS 不存在 |
| CJK | `PingFang TC`（macOS）→ `Microsoft JhengHei`（Windows / WebView2）→ `Noto Sans TC`（Linux） | DS 預設堆疊為 `PingFang SC`、`Noto Sans SC`（簡體字形）；參考原型只寫 `PingFang TC`，Windows 會落到瀏覽器預設 CJK 字型 |
| 等寬 | 等寬堆疊尾端也要有 TC 字型 | 參考原型中文 / 注音練習在等寬字型區塊內顯示 |
| 載入 Google Fonts | **MUST NOT**（DS `fonts.css` 載入 Inter / Roboto 只供規格標籤） | 桌面離線可用、隱私 |
| 字級 | 內文 14 / 行高 22；說明 12 / 20；H1–H5 Semibold 38 / 30 / 24 / 20 / 16；程式碼 12 | DS readme；`--h1` 在 `fig-tokens.css` 為 40（待確認） |
| antd | `token.fontFamily` = `--font` 同字串；`token.fontSize: 14`；`fontSizeHeading1..5` 用 antd 預設 | |
| 數字 | 計數 / 百分比 / 計時加 `.nums`（tabular-nums） | `elf-ui-pattern` 規則 30；原型大量使用 `font-variant-numeric:tabular-nums` |

## 3. 間距 / 尺寸 / 圓角 / 陰影 / 動效

| 類別 | 刻度 | Figma variable | antd token | 目前團隊 CSS token |
| --- | --- | --- | --- | --- |
| 間距單位 | 4 | `--sizeunit: 4` | `sizeUnit` | 無（直接寫 px，須在刻度內） |
| 間距 | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 | `--size-size-sizexxs..sizexxl` | `sizeXXS..sizeXXL`、`padding*`、`margin*` | 無 |
| 控制項高 | 24 / 32 / 40 | `--size-height-controlheightsm/…/lg` | `controlHeightSM` / `controlHeight` / `controlHeightLG` | 無 |
| 圓角 | 2（標籤、核取）/ 4（小控制項）/ 6（按鈕、輸入）/ 8（卡片、對話框） | `--style-borderradiusxs/sm/(base)/lg` | `borderRadiusXS/SM/borderRadius/LG` | 無 |
| 懸浮陰影 | `0 6px 16px 0 rgba(0,0,0,.08), 0 3px 6px -4px rgba(0,0,0,.12), 0 9px 28px 8px rgba(0,0,0,.05)` | readme | `boxShadow`、`boxShadowSecondary` | `--overlay-shadow` |
| 卡片陰影 | 參考原型 `0 1px 2px 0 rgba(0,0,0,.03)` | readme「faint tertiary shadow」 | `boxShadowTertiary` | `--card-shadow` |
| 選中分段陰影 | 參考原型 `0 2px 8px rgba(0,0,0,.06)` | — | （antd Segmented 內建） | `--seg-shadow` |
| 動效 | 0.2s ease-in-out；懸浮層由 0.8 縮放淡入；不彈跳 | readme | `motionDurationMid: '0.2s'` | 無 |
| 斷點 | 480 / 576 / 768 / 992 / 1200 / 1600 | `--size-screen-*` | `screenXS..screenXXL` | 無；內容區雙欄門檻 620（`elf-ui-pattern` 規則 41） |

規則：
- 「目前團隊 CSS token = 無」的類別：CSS 中直接寫 px，**MUST** 是刻度內的值；刻度外的值 **MUST** 在 SPEC.md 標註理由（參考原型的 `height:34px` 輸入框、`padding:10px 20px 12px` 鍵盤卡片都是刻度外）。
- 若要把圓角 / 間距做成 CSS 變數（例 `--radius-lg`），**MUST** 依 `elf-ui-pattern` 規則 31 擴表，不可在專案內自創。
- antd 元件的尺寸只透過 `theme.token` 調整，**MUST NOT** 用 CSS 覆寫 `.ant-*` 內部 class（參考實作 `.btn-slot .ant-btn { padding: 6px 16px }` 為反例）。

## 4. 對不到 token 的值怎麼處理

參考原型還有下列顏色找不到 token（實作時散落在 TS / `.vue`）：

| 原型值 | 用途 | 處理 |
| --- | --- | --- |
| `#8c877c` | 未輸入字元 | 與 `--text-3`（`#8b877e`）差 1 → **MUST** 合併為 `--text-3`，不要新增 `--text-4` |
| `#f5f1ea`、`#ece6dc`、`#fdfcfa`、`#e6ded2` | 鍵帽底、進度軌道、拖放區底、游標底線 | 先嘗試以 `--seg-bg` / `--line` / `--bg` 取代；不能取代 → 待確認 + 規則 31 |
| `rgba(217,119,87,.08/.10/.12/.32)` | 主色淡底、主色光暈 | antd `colorPrimaryBg` 語意；CSS 端待確認（可用 `color-mix(in srgb, var(--primary) 8%, transparent)`，需確認 WebView2 / 目標瀏覽器支援） |
| 分類色 `#b06a4f`、`#a8763e`、`#6f8f85`、`#7d8c5c`、`#c08552` | 分類色點、頭像、成就 | 屬資料視覺化 / 分類色票：**MUST** 集中在一個模組並列入待確認，**MUST NOT** 散落各 view |
| 手指色 `FING` | 虛擬鍵盤手指色條 | 同上（領域色票） |

判斷順序：(1) 與既有 token 差距肉眼不可辨 → 合併；(2) 語意上是某 token 的淡色 / 深色 → 用 antd 衍生色或 `color-mix`；(3) 真正新語意 → 列待確認，依 `elf-ui-pattern` 規則 31 擴表。

## 5. 深色模式

只在簡報要求時實作（SKILL.md 規則 25）。做法：

```css
/* app.css — same token names, dark values. */
:root[data-theme='dark'] {
  --bg: /* dark value */;
  --surface: /* … */;
  /* every token in elf-ui-pattern rule 27 MUST be redefined here */
}
```

```ts
// theme.ts
import { theme as antdTheme } from 'ant-design-vue'

export const DARK_TOKENS = { /* same keys as TOKENS */ } as const
export function themeFor(mode: 'light' | 'dark') {
  return {
    token: { ...(mode === 'dark' ? DARK_TOKENS : TOKENS) /* + non-color tokens */ },
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  }
}
```

- 切換點只有一處（settings store），同時設定 `document.documentElement.dataset.theme` 與 `ConfigProvider :theme="themeFor(mode)"`。
- DS 深色值可作起點：`fig-tokens.css` 的 `:root[data-theme="dark"]` 區塊（中性灰階反轉、primary 色階另給暗色版）。
- `theme.test.ts` **MUST** 同時檢查 `:root` 對 `TOKENS`、`:root[data-theme='dark']` 對 `DARK_TOKENS`。
- 文字色若用實色（參考原型的暖灰），深色值要逐一給；若用「黑 / 白 + 透明度」（DS 做法），深色只需換基底。

## 6. 同步測試擴充

`elf-ui-pattern` references §7.3 的 `theme.test.ts` 只比對顏色。設計交接後 **MUST** 把本檔新增的對應也納入：

```ts
import { describe, expect, it } from 'vitest'
import css from './app.css?raw'
import { CSS_VAR_OF, FONT, TOKENS, TOKENS_EXTRA, theme } from './theme'

function cssVar(name: string): string | undefined {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`))
  return m?.[1].replace(/\s+/g, ' ').trim().toLowerCase()
}

describe('theme tokens', () => {
  it.each(Object.entries(CSS_VAR_OF))('%s equals %s in app.css', (key, cssName) => {
    expect(cssVar(cssName)).toBe(TOKENS[key as keyof typeof TOKENS].toLowerCase())
  })
  it('font stack matches --font', () => {
    expect(cssVar('--font')).toBe(FONT.replace(/\s+/g, ' ').toLowerCase())
  })
  it('component tokens match their CSS variables', () => {
    expect(cssVar('--seg-bg')).toBe(TOKENS_EXTRA.segBg)
    expect(cssVar('--sider')).toBe(TOKENS_EXTRA.sider)
    expect(theme.components.Segmented.colorBgLayout).toBe(TOKENS_EXTRA.segBg)
  })
  it('info follows primary', () => {
    expect(theme.token.colorInfo).toBe(TOKENS.colorPrimary)
  })
})
```
