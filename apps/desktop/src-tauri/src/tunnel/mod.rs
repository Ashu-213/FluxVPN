use serde::{Deserialize, Serialize};

/// Represents the discrete status of a Windows WireGuard tunnel service.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TunnelServiceState {
    Running,
    Stopped,
    StartPending,
    StopPending,
    NotInstalled,
    AccessDenied,
    Unknown(String),
}

/// Structured response returned across the Tauri IPC boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelStatusReport {
    pub tunnel_name: String,
    pub service_name: String,
    pub state: TunnelServiceState,
    pub error_message: Option<String>,
}

/// Strict validation: For this initial phase, only the official FLUX tunnel name is allowed.
pub const FLUX_TUNNEL_NAME: &str = "flux";

/// Validates the user/frontend-supplied tunnel name strictly.
pub fn validate_tunnel_name(tunnel_name: &str) -> Result<&'static str, String> {
    if tunnel_name == FLUX_TUNNEL_NAME {
        Ok(FLUX_TUNNEL_NAME)
    } else {
        Err(format!(
            "Invalid tunnel name '{}'. Only '{}' is permitted by FLUX security policy.",
            tunnel_name, FLUX_TUNNEL_NAME
        ))
    }
}

/// Constructs the canonical WireGuard Windows service name (`WireGuardTunnel$<name>`).
pub fn construct_service_name(tunnel_name: &str) -> String {
    format!("WireGuardTunnel${}", tunnel_name)
}

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "windows")]
pub use windows::query_tunnel_service_status;

#[cfg(not(target_os = "windows"))]
pub fn query_tunnel_service_status(tunnel_name: &str) -> Result<TunnelStatusReport, String> {
    let valid_name = validate_tunnel_name(tunnel_name)?;
    Ok(TunnelStatusReport {
        tunnel_name: valid_name.to_string(),
        service_name: construct_service_name(valid_name),
        state: TunnelServiceState::NotInstalled,
        error_message: Some("Windows service query is only supported on Windows OS".into()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_tunnel_name() {
        assert_eq!(validate_tunnel_name("flux"), Ok(FLUX_TUNNEL_NAME));
    }

    #[test]
    fn test_invalid_tunnel_names() {
        assert!(validate_tunnel_name("wg0").is_err());
        assert!(validate_tunnel_name("FLUX").is_err());
        assert!(validate_tunnel_name("flux; whoami").is_err());
        assert!(validate_tunnel_name("").is_err());
        assert!(validate_tunnel_name("WireGuardTunnel$flux").is_err());
    }

    #[test]
    fn test_service_name_construction() {
        assert_eq!(construct_service_name("flux"), "WireGuardTunnel$flux");
    }

    #[test]
    fn test_serialization() {
        let report = TunnelStatusReport {
            tunnel_name: "flux".into(),
            service_name: "WireGuardTunnel$flux".into(),
            state: TunnelServiceState::NotInstalled,
            error_message: None,
        };
        let json = serde_json::to_string(&report).expect("must serialize");
        assert!(json.contains("\"tunnelName\":\"flux\""));
        assert!(json.contains("\"serviceName\":\"WireGuardTunnel$flux\""));
        assert!(json.contains("\"state\":\"notInstalled\""));
    }
}
