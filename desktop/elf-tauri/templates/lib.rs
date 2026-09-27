use serde::Serialize;
use tauri::Manager;

/// Reported by the web layer (e.g. on a Settings page) so a desktop build is
/// distinguishable from the browser build at runtime.
#[derive(Serialize)]
pub struct ShellInfo {
    pub version: String,
    pub platform: String,
}

#[tauri::command]
fn shell_info() -> ShellInfo {
    ShellInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

/// Example of a command that needs the AppHandle and can fail.
///
/// Errors are returned as `Result<_, String>` so the front end receives a
/// readable message from `invoke` instead of a panic. Use the *local* app data
/// directory for large files — the roaming one is synced between machines on
/// Windows.
///
///   Windows  %LOCALAPPDATA%\tw.elf.<appname>\<sub>
///   macOS    ~/Library/Application Support/tw.elf.<appname>/<sub>
///   Linux    ~/.local/share/tw.elf.<appname>/<sub>
#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("no local data dir: {e}"))?
        .join("<sub>");

    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;

    Ok(dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Every new command must be added here, or `invoke` fails at runtime.
        .invoke_handler(tauri::generate_handler![shell_info, data_dir])
        .setup(|app| {
            // Registered at runtime rather than on the builder so the mobile
            // targets, which have no updater to register, still compile.
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running <AppName>");
}
