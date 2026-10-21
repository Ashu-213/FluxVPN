pub mod tunnel;

use tunnel::{
    TunnelOperationResult, TunnelStatusReport, TunnelVerificationReport,
    query_tunnel_service_status, start_tunnel_operation, stop_tunnel_operation,
    verify_tunnel_connectivity as verify_tunnel_conn,
};

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

/// Secure native start operation for the FLUX WireGuard tunnel service.
/// Enforces strict validation: only allows tunnel_name = "flux".
#[tauri::command]
fn start_tunnel(tunnel_name: String) -> Result<TunnelOperationResult, String> {
    start_tunnel_operation(&tunnel_name)
}

/// Secure native stop operation for the FLUX WireGuard tunnel service.
/// Enforces strict validation: only allows tunnel_name = "flux".
#[tauri::command]
fn stop_tunnel(tunnel_name: String) -> Result<TunnelOperationResult, String> {
    stop_tunnel_operation(&tunnel_name)
}

/// Semantic alias for start_tunnel matching connect flow.
#[tauri::command]
fn connect_tunnel(tunnel_name: String) -> Result<TunnelOperationResult, String> {
    start_tunnel_operation(&tunnel_name)
}

/// Semantic alias for stop_tunnel matching disconnect flow.
#[tauri::command]
fn disconnect_tunnel(tunnel_name: String) -> Result<TunnelOperationResult, String> {
    stop_tunnel_operation(&tunnel_name)
}

/// Native verification of actual WireGuard handshake, traffic counters, and data plane.
/// Strictly enforces tunnel_name = "flux" and returns granular verification state.
#[tauri::command]
fn verify_tunnel_connectivity(tunnel_name: String) -> Result<TunnelVerificationReport, String> {
    verify_tunnel_conn(&tunnel_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_tunnel_status,
            start_tunnel,
            stop_tunnel,
            connect_tunnel,
            disconnect_tunnel,
            verify_tunnel_connectivity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
