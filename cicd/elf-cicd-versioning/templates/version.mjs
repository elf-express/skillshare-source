#!/usr/bin/env node
// scripts/version.mjs
// Single source of truth for the version number, which otherwise lives in
// several places across four toolchains. Never edit one of them by hand.
//
//   node scripts/version.mjs            → print the current version
//   node scripts/version.mjs patch      → 0.0.1 -> 0.0.2
//   node scripts/version.mjs minor      → 0.0.2 -> 0.1.0
//   node scripts/version.mjs major      → 0.1.0 -> 1.0.0
//   node scripts/version.mjs 1.2.3      → set explicitly
//
// No dependencies on purpose: version.yml runs it without `pnpm install`.
//
// Replace <AppName> / <crate-name>. Delete the Tauri targets if the repo has
// no src-tauri/. pnpm-lock.yaml does not record workspace package versions,
// so it is not a target.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const p = (...parts) => join(root, ...parts)

const ROOT_PKG = p('package.json')

/** Each target: the file, and a regex capturing (prefix)(version)(suffix). */
const TARGETS = [
  {
    file: ROOT_PKG,
    find: /("version"\s*:\s*")([^"]+)(")/,
  },
  {
    file: p('apps', 'package.json'),
    find: /("version"\s*:\s*")([^"]+)(")/,
  },
  {
    file: p('src-tauri', 'tauri.conf.json'),
    find: /("version"\s*:\s*")([^"]+)(")/,
  },
  {
    // Only the [package] version, not a dependency's.
    file: p('src-tauri', 'Cargo.toml'),
    find: /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
  },
  {
    file: p('server', 'src', '<AppName>.Api', '<AppName>.Api.csproj'),
    find: /(<Version>)([^<]+)(<\/Version>)/,
  },
  {
    // The lock file records the crate's own version too. Leaving it to cargo
    // means it lags by however many bumps happened since the last build, which
    // breaks `cargo build --locked` and leaves an uncommitted change sitting in
    // the tree after every release.
    file: p('src-tauri', 'Cargo.lock'),
    find: /(name = "<crate-name>"\r?\nversion = ")([^"]+)(")/,
  },
]

const read = (f) => readFileSync(f, 'utf8')

const current = () => {
  const m = read(ROOT_PKG).match(/"version"\s*:\s*"([^"]+)"/)
  if (!m) throw new Error('no version in root package.json')
  return m[1]
}

const bump = (version, kind) => {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) throw new Error(`not a plain semver version: ${version}`)
  let [major, minor, patch] = m.slice(1).map(Number)
  if (kind === 'major') [major, minor, patch] = [major + 1, 0, 0]
  else if (kind === 'minor') [major, minor, patch] = [major, minor + 1, 0]
  else if (kind === 'patch') patch += 1
  else throw new Error(`unknown bump: ${kind}`)
  return `${major}.${minor}.${patch}`
}

const arg = process.argv[2]

if (!arg) {
  console.log(current())
  process.exit(0)
}

const previous = current()
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(previous, arg)

let touched = 0
for (const { file, find } of TARGETS) {
  if (!existsSync(file)) {
    console.warn(`skip (missing): ${file}`)
    continue
  }
  const before = read(file)
  if (!find.test(before)) {
    // A missing <Version> in the csproj is the expected case on a fresh
    // scaffold — fail loudly rather than silently leaving it behind.
    throw new Error(`no version field matched in ${file}`)
  }
  const after = before.replace(find, (_, a, _old, c) => `${a}${next}${c}`)
  if (after !== before) {
    writeFileSync(file, after)
    touched++
  }
}

console.log(
  previous === next
    ? `already at ${next} (${touched} files written)`
    : `${previous} -> ${next} (${touched} files written)`,
)
