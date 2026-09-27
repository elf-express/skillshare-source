// Thin passthrough — all application logic lives in lib.rs so the mobile
// targets, which generate their own entry point, share the same code.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    <appname>_lib::run()
}
