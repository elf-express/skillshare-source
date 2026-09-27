# CODING AGENTS: READ THIS FIRST

This is a design handoff bundle for **<product / feature>**.
Source tool: <claude.ai/design | Figma | other>. Exported on <YYYY-MM-DD> by <name>.
Design system: Ant Design (`prototype/_ds/<ant-design-system-id>/`). Implementation target: **ant-design-vue 4** (Vue 3).
Team rules: skills `elf-ui-design`, `elf-ui-pattern`, `elf-i18n`, `elf-vue`.

## Read in this order — do not skip or skim

1. `chats/` — <N> transcript(s). The intent lives here. For each topic, the **last decision the user confirmed** wins.
2. `prototype/<Primary>.html` — the primary design. Read it top to bottom, then open **every file it imports**:
   - `prototype/support.js`
   - `prototype/_ds/<id>/readme.md`, `styles.css`, `tokens/fig-tokens.css`, `tokens/fonts.css`
   - <other imports>
3. `prototype/uploads/` — annotated screenshots the user pasted during review. They are feedback, not specs; find where each is referenced in the chat.
4. `SPEC.md` — element → ant-design-vue mapping, tokens, states, responsive rules, copy lengths, open questions.
   If `SPEC.md` is missing or its status is not "Confirmed", write/refresh it and **ask the user every open question before implementing**.

## Paths

| Original export path | Path in this repo |
| --- | --- |
| `README.md` | `HANDOFF.md` |
| `project/` | `prototype/` |

## How to implement

- Recreate the **visual output and behaviour**; do **not** copy the prototype's internal structure (inline styles, `div onClick`, `sc-if` / `sc-for`, `dc-props`).
- Map every element to an ant-design-vue component (see `SPEC.md`). Hand-built prototype controls (segmented, switch, modal, select, slider, upload, table, tree) become their `a-*` equivalents.
- Colours, fonts, shadows: team tokens only (`src/styles/app.css` → `src/styles/theme.ts`, checked by `theme.test.ts`). Do not copy design-system variable names into the app.
- Do not carry over prototype-runtime workarounds (e.g. padding hacks for the design-system Button).
- Add every state listed in `SPEC.md`, including the ones the prototype does not draw (loading, empty, error, focus).
- All copy goes through i18n: `en` + `zh-TW`.
- Do not render or screenshot the prototype to measure it — read the source. Screenshots are for acceptance review only.

## Out of scope (proposed in chat but not approved)

- <e.g. dark theme — chat line 119>
- <e.g. daily usage cap, profile switching — chat line 1253>

## Bundle integrity

- [ ] Every file imported by the primary prototype exists
- [ ] Every file referenced by `_ds/<id>/readme.md` exists (missing: <list, or "none">)
- [ ] Every image in `uploads/` is referenced in `chats/`
