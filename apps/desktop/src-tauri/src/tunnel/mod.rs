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

/// Structured response returned for tunnel lifecycle operations (Start / Stop).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelOperationResult {
    pub success: bool,
    pub tunnel_name: String,
    pub service_name: String,
    pub state: TunnelServiceState,
    pub error_code: Option<String>,
    pub message: String,
}

use std::sync::atomic::{AtomicBool, Ordering};

static IS_OPERATION_RUNNING: AtomicBool = AtomicBool::new(false);

/// RAII concurrency lock preventing concurrent lifecycle operations.
pub struct OperationGuard;

impl OperationGuard {
    pub fn try_acquire() -> Result<Self, String> {
        if IS_OPERATION_RUNNING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            Ok(OperationGuard)
        } else {
            Err("A tunnel operation is already in progress.".into())
        }
    }
}

impl Drop for OperationGuard {
    fn drop(&mut self) {
        IS_OPERATION_RUNNING.store(false, Ordering::SeqCst);
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

/// Dispatches a safe, validated native start operation for the tunnel service.
pub fn start_tunnel_operation(tunnel_name: &str) -> Result<TunnelOperationResult, String> {
    let valid_name = validate_tunnel_name(tunnel_name)?;
    let _guard = match OperationGuard::try_acquire() {
        Ok(g) => g,
        Err(msg) => {
            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_name.to_string(),
                service_name: construct_service_name(valid_name),
                state: TunnelServiceState::Unknown("Conflict".into()),
                error_code: Some("OPERATION_IN_PROGRESS".into()),
                message: msg,
            });
        }
    };

    #[cfg(target_os = "windows")]
    {
        windows::start_tunnel_service(valid_name)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(TunnelOperationResult {
            success: false,
            tunnel_name: valid_name.to_string(),
            service_name: construct_service_name(valid_name),
            state: TunnelServiceState::NotInstalled,
            error_code: Some("UNSUPPORTED_PLATFORM".into()),
            message: "Windows service operations are only supported on Windows OS".into(),
        })
    }
}

/// Dispatches a safe, validated native stop operation for the tunnel service.
pub fn stop_tunnel_operation(tunnel_name: &str) -> Result<TunnelOperationResult, String> {
    let valid_name = validate_tunnel_name(tunnel_name)?;
    let _guard = match OperationGuard::try_acquire() {
        Ok(g) => g,
        Err(msg) => {
            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_name.to_string(),
                service_name: construct_service_name(valid_name),
                state: TunnelServiceState::Unknown("Conflict".into()),
                error_code: Some("OPERATION_IN_PROGRESS".into()),
                message: msg,
            });
        }
    };

    #[cfg(target_os = "windows")]
    {
        windows::stop_tunnel_service(valid_name)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(TunnelOperationResult {
            success: false,
            tunnel_name: valid_name.to_string(),
            service_name: construct_service_name(valid_name),
            state: TunnelServiceState::Stopped,
            error_code: Some("UNSUPPORTED_PLATFORM".into()),
            message: "Windows service operations are only supported on Windows OS".into(),
        })
    }
}

pub mod verification;
pub use verification::{TunnelTelemetry, TunnelVerificationReport, VerificationState};

/// Verifies whether the WireGuard data plane has an active cryptographic handshake
/// and actual traffic counters without conflating service status with connectivity.
pub fn verify_tunnel_connectivity(tunnel_name: &str) -> Result<TunnelVerificationReport, String> {
    let valid_name = validate_tunnel_name(tunnel_name)?;

    // 1. Check underlying service status first
    let status_report = query_tunnel_service_status(valid_name)?;

    if status_report.state == TunnelServiceState::NotInstalled {
        return Ok(TunnelVerificationReport {
            tunnel_name: valid_name.to_string(),
            state: VerificationState::Unavailable,
            telemetry: None,
            error_message: Some(
                "WireGuard service 'WireGuardTunnel$flux' is not installed.".into(),
            ),
        });
    }

    if status_report.state != TunnelServiceState::Running {
        return Ok(TunnelVerificationReport {
            tunnel_name: valid_name.to_string(),
            state: VerificationState::ServiceStopped,
            telemetry: None,
            error_message: None,
        });
    }

    // 2. Query WireGuard UAPI named pipe when service is running
    #[cfg(target_os = "windows")]
    {
        use std::time::{SystemTime, UNIX_EPOCH};

        match verification::query_uapi_pipe(valid_name) {
            Ok(uapi_str) => {
                let stats = verification::parse_uapi_peer_stats(&uapi_str);
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let (state, telemetry) =
                    verification::evaluate_verification_state(true, Some(&stats), now);

                Ok(TunnelVerificationReport {
                    tunnel_name: valid_name.to_string(),
                    state,
                    telemetry,
                    error_message: None,
                })
            }
            Err(verification::VerificationQueryError::PermissionDenied) => {
                Ok(TunnelVerificationReport {
                    tunnel_name: valid_name.to_string(),
                    state: VerificationState::PermissionDenied,
                    telemetry: None,
                    error_message: Some(
                        "Access to WireGuard IPC named pipe was denied. Administrator permissions required."
                            .into(),
                    ),
                })
            }
            Err(verification::VerificationQueryError::NotFound) => {
                Ok(TunnelVerificationReport {
                    tunnel_name: valid_name.to_string(),
                    state: VerificationState::Unavailable,
                    telemetry: None,
                    error_message: Some(
                        "WireGuard IPC named pipe not found. Service may be initializing."
                            .into(),
                    ),
                })
            }
            Err(verification::VerificationQueryError::Io(e)) => {
                Ok(TunnelVerificationReport {
                    tunnel_name: valid_name.to_string(),
                    state: VerificationState::QueryFailed,
                    telemetry: None,
                    error_message: Some(format!("Failed to query WireGuard UAPI pipe: {}", e)),
                })
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(TunnelVerificationReport {
            tunnel_name: valid_name.to_string(),
            state: VerificationState::Unavailable,
            telemetry: None,
            error_message: Some("Verification only supported on Windows OS".into()),
        })
    }
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

    #[test]
    fn test_operation_serialization() {
        let op_result = TunnelOperationResult {
            success: false,
            tunnel_name: "flux".into(),
            service_name: "WireGuardTunnel$flux".into(),
            state: TunnelServiceState::NotInstalled,
            error_code: Some("SERVICE_NOT_INSTALLED".into()),
            message: "Service not installed".into(),
        };
        let json = serde_json::to_string(&op_result).expect("must serialize");
        assert!(json.contains("\"success\":false"));
        assert!(json.contains("\"tunnelName\":\"flux\""));
        assert!(json.contains("\"errorCode\":\"SERVICE_NOT_INSTALLED\""));
    }

    #[test]
    fn test_operation_guard_concurrency() {
        let guard1 = OperationGuard::try_acquire();
        assert!(guard1.is_ok());

        // Concurrent attempt must fail
        let guard2 = OperationGuard::try_acquire();
        assert!(guard2.is_err());

        // Dropping guard1 frees lock
        drop(guard1);
        let guard3 = OperationGuard::try_acquire();
        assert!(guard3.is_ok());
    }

    #[test]
    fn test_operation_invalid_tunnel_names() {
        assert!(start_tunnel_operation("wg0").is_err());
        assert!(stop_tunnel_operation("wg0").is_err());
        assert!(start_tunnel_operation("FLUX").is_err());
        assert!(stop_tunnel_operation("").is_err());
        assert!(verify_tunnel_connectivity("wg0").is_err());
    }

    #[test]
    fn test_verify_tunnel_connectivity_non_existent() {
        let report = verify_tunnel_connectivity("flux").expect("verify must succeed");
        assert_eq!(report.tunnel_name, "flux");
        assert_eq!(report.state, VerificationState::Unavailable);
        assert!(report.telemetry.is_none());
    }
}
