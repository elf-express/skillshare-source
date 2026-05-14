---
name: vue3-i18n-debugging
description: Debug and fix Vue 3 Composition API i18n problems. Use when user reports i18n-ally warnings, translation keys showing as missing, `this.$t()` errors in `<script setup>`, duplicate IDE diagnostics from git worktrees, or any Vue I18n setup that "looks right but doesn't work". Works for Vue 3 + Vite + vue-i18n projects using `<script setup>`.
---

# Vue 3 i18n Debugging

## Principle: Trust the filesystem, not the extension

IDE extensions (i18n-ally, i18n-ally-next, tarus) cache locale data at startup. They lie when you change files. **Always verify with Node, never with extension warnings.**

```bash
# Ground truth check (run this FIRST when a key seems missing)
node -e "console.log(require('./src/renderer/i18n/en-US.json').general.browse)"
```

If Node prints the value, the key exists. If the extension still warns, it's cache. Tell the user to `Ctrl+Shift+P` → **Developer: Reload Window**. Don't chase the warning.

## Common bugs (ordered by how often I've seen them)

### 1. `this.$t()` in `<script setup>` — always a bug

`<script setup>` has no `this`. Two cases:

**Case A: The string is user-facing** → migrate to Composition API:
```ts
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
// ...
const message = t('general.browse');
```

**Case B: The string is a KeyboardEvent value or other program identifier** → remove the translation:
```ts
// WRONG — e.key is locale-independent (W3C UI Events)
if (e.key === this.$t('escape')) { ... }

// RIGHT — 'Escape', 'Alt', 'Control', 'Enter' are fixed strings
if (e.key === 'Escape') { ... }
```

**Decision rule**: If the string is compared to data from an API, DOM event, config, or database field — don't translate. If the string is rendered to the user — translate.

### 2. `defineProps` default can't reference `t`

Vue compiles `defineProps` as a macro BEFORE setup runs. So this fails:

```ts
// WRONG — Vue error: "defineProps is referencing locally declared variables"
const { t } = useI18n();
const props = defineProps({
  message: { default: () => t('general.browse'), type: String }
});
```

Fix: default to `undefined`, fallback in template:
```vue
<template>
  <span>{{ message ?? t('general.browse') }}</span>
</template>

<script setup lang="ts">
const { t } = useI18n();
const props = defineProps({
  message: { default: undefined, type: String }
});
</script>
```

### 3. Locale files in TS format confuse i18n-ally

i18n-ally's TypeScript parser handles `export const enUS = { ... }` + `export default` poorly. If the extension reports hundreds of "key missing" warnings but the keys exist, **convert to JSON**:

```
src/renderer/i18n/
  en-US.json         ← JSON is universally parseable
  zh-TW.json
  index.ts           ← import JSON modules
```

```ts
// index.ts
import enUS from './en-US.json';
import zhTW from './zh-TW.json';
const messages = { 'en-US': enUS, 'zh-TW': zhTW };
export type MessageSchema = typeof enUS  // type inference still works
```

Requires `"resolveJsonModule": true` in tsconfig (usually already set in Vite projects).

### 4. `.vscode/settings.json` needs BOTH extensions configured

If user has both `lokalise.i18n-ally` and `lydanne.i18n-ally-next` installed, they read different config keys. Set both:

```json
{
  "i18n-ally.localesPaths": ["src/renderer/i18n"],
  "i18n-ally.sourceLanguage": "en-US",
  "i18n-ally.keystyle": "nested",
  "i18n-ally.enabledParsers": ["json"],
  "i18n-ally.enabledFrameworks": ["vue"],
  "i18n-ally.pathMatcher": "{locale}.json",

  "i18n-ally-next.localesPaths": ["src/renderer/i18n"],
  "i18n-ally-next.sourceLanguage": "en-US",
  "i18n-ally-next.keystyle": "nested",
  "i18n-ally-next.enabledParsers": ["json"],
  "i18n-ally-next.enabledFrameworks": ["vue"],
  "i18n-ally-next.pathMatcher": "{locale}.json"
}
```

Also exclude agent worktrees from IDE scanning (otherwise Vue component analyzers report every diagnostic 4x):

```json
"search.exclude": { ".claude/worktrees/**": true },
"files.watcherExclude": { ".claude/worktrees/**": true }
```

### 5. Empty string values are worse than missing keys

```json
{ "general": { "error": "" } }
```

Vue I18n renders this as **blank** (no fallback to source language). Always audit for empty values:

```bash
node -e "
const d = require('./src/renderer/i18n/en-US.json');
const empty = [];
function walk(o, p='') { for (const k in o) typeof o[k]==='object'&&o[k]!==null ? walk(o[k], p+k+'.') : o[k]===''&&empty.push(p+k); }
walk(d);
console.log('Empty keys:', empty);
"
```

An empty key is either: (a) needs translation, or (b) is an orphan that should be deleted.

### 6. Orphaned keys waste counter space

Unused keys in JSON make progress indicators (e.g., "585 of 591") mismatch reality. To find orphans, grep the codebase for each key path:

```bash
# For a suspected orphan `application.scratchpad`:
grep -rE "application\.scratchpad|t\(['\"]application\.scratchpad" src/
```

If no match, it's dead. Delete from all locale files with a script (loop over 5 locales, `delete d.application.scratchpad`, write back).

## Verification workflow (run after any i18n edit)

```bash
# 1. All locale files parse as valid JSON
node -e "['en-US','zh-TW','zh-CN','ja-JP','ko-KR'].forEach(f => JSON.parse(require('fs').readFileSync('./src/renderer/i18n/'+f+'.json','utf-8')))"

# 2. All locales have same shape (same key count, zero empty values)
node -e "
function count(o){let n=0,e=0;function w(x){for(const k in x)typeof x[k]==='object'&&x[k]!==null?w(x[k]):(n++,x[k]===''&&e++)}w(o);return {total:n,empty:e}}
for (const f of ['en-US','zh-TW','zh-CN','ja-JP','ko-KR']) {
  const r = count(require('./src/renderer/i18n/'+f+'.json'));
  console.log(f, r);
}
"

# 3. translation:check script (if exists)
pnpm translation:check en-US   # expect "X of X strings are present (100.0%)"

# 4. TypeScript compiles (catches this.$t(), defineProps errors)
pnpm vue-tsc --noEmit 2>&1 | grep -E "\.vue" | head -20

# 5. ESLint catches import/format issues
pnpm eslint src/renderer/i18n/index.ts
```

All five must pass before claiming done.

## Severity triage when user pastes IDE diagnostics

IDE diagnostic severities (VS Code scale):
- **Error (8)** — real problem, fix immediately. Examples: `物件可能為「未定義」`, `defineProps is referencing locally declared variables`
- **Warning (4)** — often false positive from component analyzers ("Event emitted but no listeners found" for reusable components is almost always noise)
- **Information (2)** — i18n-ally "key missing" / "translation missing" usually = stale cache, verify with Node before acting
- **Hint (1)** — safe to ignore unless user asks

When user pastes diagnostics, **respond only to Errors first**. Mention that Info/Warning items are likely cache/false-positive, and offer to verify specific ones on request. Don't fix 50 warnings when 2 errors are real bugs.

## Locale reduction pattern

If user wants to drop locales (common when maintenance is hard):

1. Identify keepers (e.g., `en-US`, `zh-TW`, `zh-CN`, `ja-JP`, `ko-KR`)
2. Update `src/renderer/i18n/index.ts` — remove imports + `messages` entries
3. Update `src/renderer/i18n/supported-locales.ts` — remove `localesNames` entries
4. `rm src/renderer/i18n/<locale>.json` for each dropped one
5. Run verification workflow

Only 2 files reference locale identifiers in a well-structured project (`index.ts` + `supported-locales.ts`). If grep finds more, the project has coupling problems worth noting.

## Communication style

- User sees hundreds of warnings → don't explain them away, investigate the root cause (extension cache, worktree pollution, TS parser, etc.)
- Before saying "it's a cache issue", prove it with Node
- Don't blame the tool without checking config first
- When fixes are ready: run verification, report numbers (e.g., "585/585 = 100%, 0 empty"), not vibes

## Anti-patterns I've fallen into

- Fixing ja-JP and ko-KR but ignoring 15 other locales showing <90% → fix globally or drop globally, don't cherry-pick
- Saying "i18n-ally has a bug" when the real issue was our TS file format being ambiguous
- Suggesting to remove MSI target when the user explicitly wanted both NSIS and MSI — respect the stated goal, find a way
- Marking work "done" before running verification commands
