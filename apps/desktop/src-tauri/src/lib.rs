pub mod tunnel;

use tunnel::{TunnelStatusReport, query_tunnel_service_status};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Read-only inspection of a WireGuard tunnel service.
/// Enforces strict validation: only allows tunnel_name = "flux".
#[tauri::command]
fn get_tunnel_status(tunnel_name: String) -> Result<TunnelStatusReport, String> {
    query_tunnel_service_status(&tunnel_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_tunnel_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
