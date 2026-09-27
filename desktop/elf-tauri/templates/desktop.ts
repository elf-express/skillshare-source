/**
 * <web-dir>/src/api/desktop.ts — the ONLY file allowed to import @tauri-apps/*.
 *
 * The same bundle runs in a browser and inside the desktop app, so anything
 * that depends on the shell has to be asked for at runtime rather than
 * assumed. The Tauri API is imported dynamically so the browser build never
 * pulls it into the main chunk.
 */

/** True only inside the Tauri shell; `__TAURI_INTERNALS__` is injected by it. */
export const IS_DESKTOP = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Mirrors `ShellInfo` in src-tauri/src/lib.rs — keep field names in sync. */
export type ShellInfo = { version: string; platform: string }

/** Version and OS of the desktop shell, or null in a browser. */
export async function shellInfo(): Promise<ShellInfo | null> {
  if (!IS_DESKTOP) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<ShellInfo>('shell_info')
}

/**
 * Absolute path of the desktop data directory, or null in a browser.
 * Swallows errors on purpose: a shell too old to expose the command must not
 * break the page. Decide per command whether failure is worth surfacing.
 */
export async function desktopDataDir(): Promise<string | null> {
  if (!IS_DESKTOP) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string>('data_dir')
  } catch {
    return null
  }
}

/** An update the shell found; installing it stays the caller's decision. */
export type DesktopUpdate = {
  version: string
  notes: string
  /** Downloads and installs, reporting whole-number percentages as it goes. */
  install: (onProgress: (percent: number) => void) => Promise<void>
}

/**
 * Asks the updater endpoint for a newer bundle. Null in a browser — the web
 * deployment updates by pulling new container images. Failures propagate: a
 * check that cannot reach the endpoint is worth showing the user.
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdate | null> {
  if (!IS_DESKTOP) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null

  return {
    version: update.version,
    notes: update.body ?? '',
    install: async (onProgress) => {
      let got = 0
      let total = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          got += event.data.chunkLength
          // Held below 100 until the install itself returns, so the page never
          // claims it is done while the installer is still running.
          if (total) onProgress(Math.min(99, Math.floor((got / total) * 100)))
        }
      })
      // Only reached on macOS and Linux: the Windows installer takes over and
      // the process exits inside downloadAndInstall. Those two platforms
      // replace the bundle on disk and need a relaunch to run the new version.
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  }
}
