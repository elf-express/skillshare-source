# elf-vue 設定檔範本

取材自參考專案 `TypingTrainer`，並改為 pnpm（團隊標準）與加上覆蓋率門檻 55%。
`<project>` 請換成專案代號（小寫、kebab-case）。

目錄：
1. [根目錄 package.json](#1-根目錄-packagejson)
2. [pnpm-workspace.yaml / .npmrc](#2-pnpm-workspaceyaml--npmrc)
3. [apps/package.json](#3-appspackagejson)
4. [apps/vite.config.ts（含 Vitest + coverage）](#4-appsviteconfigts)
5. [apps/tsconfig.json](#5-appstsconfigjson)
6. [apps/env.d.ts](#6-appsenvdts)
7. [apps/.env.example](#7-appsenvexample)
8. [apps/eslint.config.js](#8-appseslintconfigjs)
9. [.prettierrc.json / .prettierignore / .editorconfig](#9-prettier--editorconfig)
10. [.gitignore（前端相關段落）](#10-gitignore前端相關段落)

---

## 1. 根目錄 package.json

```json
{
  "name": "<project>",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@<PNPM_VERSION>",
  "scripts": {
    "dev": "pnpm --filter ./apps dev",
    "build": "pnpm --filter ./apps build",
    "preview": "pnpm --filter ./apps preview",
    "lint": "pnpm -r --if-present run lint",
    "lint:fix": "pnpm -r --if-present run lint:fix",
    "typecheck": "pnpm -r --if-present run typecheck",
    "test": "pnpm -r --if-present run test",
    "test:coverage": "pnpm -r --if-present run test:coverage",
    "format": "prettier --write \"**/*.{ts,vue,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,vue,json,md,css}\"",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build"
  },
  "devDependencies": {
    "prettier": "^3.3.3"
  },
  "engines": {
    "node": ">=24.18"
  }
}
```

> `<PNPM_VERSION>` 換成完整版號（例 `11.26.0`）；團隊確切版號以 `elf-stack` 為準（見 SKILL.md 待確認 #1）。
> CI 的 `pnpm/action-setup` 與 Docker 的 `npm install -g pnpm@${PNPM_VERSION}` 都讀這個欄位；**不使用 corepack**。
>
> `verify` 跑 `test:coverage`（不是 `test`），所以本機提交前就會被 lines 55% 門檻擋下，與 CI 一致。
> 前端依賴一律加在 `apps`（`pnpm --filter ./apps add <pkg>`），根目錄只放 prettier 這類 repo 級工具。

---

## 2. pnpm-workspace.yaml / .npmrc

`pnpm-workspace.yaml`

```yaml
packages:
  - apps

# Refuse to install on an unsupported Node instead of warning and failing later.
engineStrict: true
```

`.npmrc`：**只放 registry / auth**（若無私有 registry 可不建立）。**MUST NOT** 在 `.npmrc` 寫 `engine-strict`；
engine-strict 只由 `pnpm-workspace.yaml` 的 `engineStrict: true` 設定（團隊已決議，見 `elf-stack`）。

---

## 3. apps/package.json

```json
{
  "name": "@<project>/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@ant-design/icons-vue": "^7.0.1",
    "ant-design-vue": "^4.2.6",
    "axios": "^1.7.9",
    "pinia": "^2.2.6",
    "vue": "^3.5.13",
    "vue-i18n": "^10.0.5",
    "vue-router": "^4.4.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@vitejs/plugin-vue": "^6.0.9",
    "@vitest/coverage-v8": "5.0.1",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^9.17.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-vue": "^9.32.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.18.1",
    "vite": "^6.4.3",
    "vitest": "5.0.1",
    "vue-tsc": "^2.1.10"
  }
}
```

版本取自參考專案；團隊版本基準以 `elf-stack` 為準。`ant-design-vue` 4 為團隊 UI 函式庫（已決議）。
`@vitest/coverage-v8` **必須**與 `vitest` **完全相同版號**（精確版號、不加 `^`；兩者一起升級），裝在 `apps/`：
`pnpm --filter ./apps add -D -E vitest@<x.y.z> @vitest/coverage-v8@<x.y.z>`。

---

## 4. apps/vite.config.ts

```ts
/// <reference types="vitest/config" />
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Read rather than imported: a JSON import here would need resolveJsonModule for one string.
const pkg = createRequire(import.meta.url)('./package.json') as { version: string }

export default defineConfig({
  // Relative base so the built bundle also runs from file:// (Tauri). Pure web apps may use '/'.
  base: './',
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'jsdom',
    // Tests sit next to the file they cover: foo.ts -> foo.test.ts
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Fixed team list (same as elf-cicd-frontend); changing it needs review.
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main.ts', 'src/api/mock/**'],
      thresholds: { lines: 55 },
    },
  },
})
```

---

## 5. apps/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue", "env.d.ts"]
}
```

`strict: true` 不可關閉。`resolveJsonModule` 讓 `i18n/locales/*.json` 可直接 import。

---

## 6. apps/env.d.ts

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. https://localhost:7001/api */
  readonly VITE_API_BASE_URL?: string
  /** Anything but 'false' (including unset) → answer every call from src/api/mock fixtures */
  readonly VITE_USE_MOCK?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Substituted at build time from apps/package.json (vite.config.ts `define`). */
declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
```

每新增一個 `VITE_*` 變數：同時改 `ImportMetaEnv` 與 `.env.example`。

---

## 7. apps/.env.example

```dotenv
# Copy to .env.local and adjust. Read at build time by Vite. Never put secrets here.

# Base URL of the backend API.
VITE_API_BASE_URL=https://localhost:7001/api

# true  → all data comes from src/api/mock fixtures (no backend needed). Default when unset.
# false → every request goes to VITE_API_BASE_URL. Production images set this in web.Dockerfile.
VITE_USE_MOCK=true
```

`USE_MOCK` 預設開（`!== 'false'`，與 `elf-api-contract` 一致）；正式映像由 `docker/web.Dockerfile` 的
`ARG VITE_USE_MOCK=false` + `ENV VITE_USE_MOCK=$VITE_USE_MOCK` 關閉（見 `elf-cicd-docker`）。

---

## 8. apps/eslint.config.js

```js
import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  {
    // Vite `define` constants exist at runtime but in no scope ESLint can see.
    // Scoped to bundled sources: Node-side files never get the substitution.
    files: ['**/*.vue', 'src/**/*.ts'],
    languageOptions: {
      globals: { __APP_VERSION__: 'readonly' },
    },
  },
  {
    rules: {
      // Views are single-word by design (Practice, Result, Settings…).
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Layout is Prettier's job.
      'vue/attributes-order': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
    },
  },
  prettier,
)
```

中文專案若文案或正規式刻意使用全形空白（U+3000），加上參考專案的例外：

```js
{
  rules: {
    'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true }],
    'vue/no-irregular-whitespace': ['error', {
      skipHTMLTextContents: true, skipHTMLAttributeValues: true,
      skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true,
    }],
  },
},
{
  files: ['**/*.vue'],
  rules: { 'no-irregular-whitespace': 'off' },
},
```

---

## 9. Prettier / EditorConfig

`.prettierrc.json`

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 110,
  "trailingComma": "all",
  "vueIndentScriptAndStyle": false
}
```

`.prettierignore`

```gitignore
node_modules
dist
coverage
pnpm-lock.yaml
```

`.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## 10. .gitignore（前端相關段落）

```gitignore
node_modules
dist
coverage
*.local
*.log
.env
.env.*
!.env.example
.DS_Store
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea

# Playwright
/test-results/
/playwright-report/
/blob-report/
```

`!.vscode/settings.json` 用於提交 i18n-ally 設定（見 `elf-i18n`）；個人偏好不要寫進該檔。
