use serde::{Deserialize, Serialize};

/// Represents the granular verification state of the WireGuard tunnel data plane.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VerificationState {
    /// The Windows service is stopped; no active data plane exists.
    ServiceStopped,
    /// Service is running, but no handshake has completed or the handshake is stale (> 180s).
    NoHandshake,
    /// A cryptographic handshake completed recently (<= 180s), but no payload traffic has been observed.
    HandshakeVerified,
    /// Handshake is active and bidirectional traffic (both TX and RX > 0) has been observed.
    TrafficObserved,
    /// Service is not installed or the UAPI IPC interface is unreachable.
    Unavailable,
    /// Access to the WireGuard IPC named pipe was denied by Windows security DACL.
    PermissionDenied,
    /// An unexpected query or I/O failure occurred while inspecting telemetry.
    QueryFailed,
}

/// Cryptographic handshake and traffic counter telemetry from the WireGuard interface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelTelemetry {
    pub last_handshake_epoch_sec: Option<u64>,
    pub handshake_age_seconds: Option<u64>,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

/// Comprehensive report of tunnel data-plane verification returned across Tauri IPC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelVerificationReport {
    pub tunnel_name: String,
    pub state: VerificationState,
    pub telemetry: Option<TunnelTelemetry>,
    pub error_message: Option<String>,
}

/// Raw parsed statistics from WireGuard UAPI key-value stream.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RawPeerStats {
    pub last_handshake_epoch_sec: u64,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

/// WireGuard protocol rekey timeout threshold.
/// Standard WireGuard sessions rekey every 120s; after 180s without a successful
/// rekey, the connection is considered stale/unresponsive.
pub const HANDSHAKE_FRESHNESS_LIMIT_SECONDS: u64 = 180;

/// Safely extracts peer handshake and byte counters from a UAPI stream.
/// Explicitly ignores and discards any cryptographic key material or unrelated lines.
pub fn parse_uapi_peer_stats(uapi_output: &str) -> RawPeerStats {
    let mut stats = RawPeerStats::default();

    for line in uapi_output.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("last_handshake_time_sec=") {
            if let Ok(sec) = val.parse::<u64>() {
                stats.last_handshake_epoch_sec = sec;
            }
        } else if let Some(val) = trimmed.strip_prefix("rx_bytes=") {
            if let Ok(bytes) = val.parse::<u64>() {
                stats.rx_bytes = bytes;
            }
        } else if let Some(val) = trimmed.strip_prefix("tx_bytes=") {
            if let Ok(bytes) = val.parse::<u64>() {
                stats.tx_bytes = bytes;
            }
        }
    }

    stats
}

/// Evaluates raw peer telemetry against current time and service state to determine
/// the truthful verification state.
pub fn evaluate_verification_state(
    service_running: bool,
    stats: Option<&RawPeerStats>,
    current_epoch_sec: u64,
) -> (VerificationState, Option<TunnelTelemetry>) {
    if !service_running {
        return (VerificationState::ServiceStopped, None);
    }

    let stats = match stats {
        Some(s) => s,
        None => return (VerificationState::NoHandshake, None),
    };

    let handshake_epoch = stats.last_handshake_epoch_sec;
    let (is_fresh, age_seconds) = if handshake_epoch > 0 && current_epoch_sec >= handshake_epoch {
        let age = current_epoch_sec - handshake_epoch;
        (age <= HANDSHAKE_FRESHNESS_LIMIT_SECONDS, Some(age))
    } else {
        (false, None)
    };

    let telemetry = TunnelTelemetry {
        last_handshake_epoch_sec: if handshake_epoch > 0 {
            Some(handshake_epoch)
        } else {
            None
        },
        handshake_age_seconds: age_seconds,
        rx_bytes: stats.rx_bytes,
        tx_bytes: stats.tx_bytes,
    };

    if !is_fresh {
        (VerificationState::NoHandshake, Some(telemetry))
    } else if stats.rx_bytes > 0 && stats.tx_bytes > 0 {
        (VerificationState::TrafficObserved, Some(telemetry))
    } else {
        (VerificationState::HandshakeVerified, Some(telemetry))
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum VerificationQueryError {
    NotFound,
    PermissionDenied,
    Io(String),
}

/// Queries the WireGuard UAPI named pipe on Windows.
#[cfg(target_os = "windows")]
pub fn query_uapi_pipe(tunnel_name: &str) -> Result<String, VerificationQueryError> {
    use std::fs::OpenOptions;
    use std::io::{Read, Write};

    // Standard named pipe endpoints created by wireguard-windows
    let pipe_paths = [
        format!(
            r"\\.\pipe\ProtectedPrefix\Administrators\WireGuard\{}",
            tunnel_name
        ),
        format!(r"\\.\pipe\WireGuard\{}", tunnel_name),
    ];

    let mut last_err = None;

    for path in &pipe_paths {
        match OpenOptions::new().read(true).write(true).open(path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(b"get=1\n\n") {
                    return Err(VerificationQueryError::Io(e.to_string()));
                }
                let mut buffer = String::new();
                if let Err(e) = file.read_to_string(&mut buffer) {
                    return Err(VerificationQueryError::Io(e.to_string()));
                }
                return Ok(buffer);
            }
            Err(e) => {
                last_err = Some(e);
            }
        }
    }

    if let Some(err) = last_err {
        match err.kind() {
            std::io::ErrorKind::PermissionDenied => Err(VerificationQueryError::PermissionDenied),
            std::io::ErrorKind::NotFound => Err(VerificationQueryError::NotFound),
            _ => Err(VerificationQueryError::Io(err.to_string())),
        }
    } else {
        Err(VerificationQueryError::NotFound)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_uapi_valid_peer() {
        let uapi = r#"
public_key=a8b3c4d5e6f7...
listen_port=51820
public_key=peer_pubkey_12345
endpoint=198.51.100.1:51820
allowed_ip=0.0.0.0/0
last_handshake_time_sec=1700000100
last_handshake_time_nsec=500000
rx_bytes=1048576
tx_bytes=2097152
persistent_keepalive_interval=25
errno=0
"#;
        let stats = parse_uapi_peer_stats(uapi);
        assert_eq!(stats.last_handshake_epoch_sec, 1700000100);
        assert_eq!(stats.rx_bytes, 1048576);
        assert_eq!(stats.tx_bytes, 2097152);
    }

    #[test]
    fn test_parse_uapi_no_handshake() {
        let uapi = r#"
public_key=peer_pubkey_12345
endpoint=198.51.100.1:51820
last_handshake_time_sec=0
rx_bytes=0
tx_bytes=148
errno=0
"#;
        let stats = parse_uapi_peer_stats(uapi);
        assert_eq!(stats.last_handshake_epoch_sec, 0);
        assert_eq!(stats.rx_bytes, 0);
        assert_eq!(stats.tx_bytes, 148);
    }

    #[test]
    fn test_evaluate_service_stopped() {
        let (state, telemetry) = evaluate_verification_state(false, None, 1700000000);
        assert_eq!(state, VerificationState::ServiceStopped);
        assert!(telemetry.is_none());
    }

    #[test]
    fn test_evaluate_stale_handshake() {
        let stats = RawPeerStats {
            last_handshake_epoch_sec: 1700000000,
            rx_bytes: 5000,
            tx_bytes: 6000,
        };
        // 181 seconds later (> 180s threshold)
        let now = 1700000000 + 181;
        let (state, telemetry) = evaluate_verification_state(true, Some(&stats), now);
        assert_eq!(state, VerificationState::NoHandshake);
        let tel = telemetry.expect("telemetry present");
        assert_eq!(tel.handshake_age_seconds, Some(181));
        assert_eq!(tel.rx_bytes, 5000);
        assert_eq!(tel.tx_bytes, 6000);
    }

    #[test]
    fn test_evaluate_fresh_handshake_zero_rx() {
        let stats = RawPeerStats {
            last_handshake_epoch_sec: 1700000000,
            rx_bytes: 0,
            tx_bytes: 148,
        };
        // 30 seconds later (<= 180s)
        let now = 1700000000 + 30;
        let (state, telemetry) = evaluate_verification_state(true, Some(&stats), now);
        assert_eq!(state, VerificationState::HandshakeVerified);
        let tel = telemetry.expect("telemetry present");
        assert_eq!(tel.handshake_age_seconds, Some(30));
        assert_eq!(tel.rx_bytes, 0);
    }

    #[test]
    fn test_evaluate_traffic_observed() {
        let stats = RawPeerStats {
            last_handshake_epoch_sec: 1700000000,
            rx_bytes: 1048576,
            tx_bytes: 2097152,
        };
        // 10 seconds later
        let now = 1700000000 + 10;
        let (state, telemetry) = evaluate_verification_state(true, Some(&stats), now);
        assert_eq!(state, VerificationState::TrafficObserved);
        let tel = telemetry.expect("telemetry present");
        assert_eq!(tel.handshake_age_seconds, Some(10));
        assert_eq!(tel.rx_bytes, 1048576);
        assert_eq!(tel.tx_bytes, 2097152);
    }

    #[test]
    fn test_serialization() {
        let report = TunnelVerificationReport {
            tunnel_name: "flux".into(),
            state: VerificationState::TrafficObserved,
            telemetry: Some(TunnelTelemetry {
                last_handshake_epoch_sec: Some(1700000000),
                handshake_age_seconds: Some(15),
                rx_bytes: 1024,
                tx_bytes: 2048,
            }),
            error_message: None,
        };
        let json = serde_json::to_string(&report).expect("must serialize");
        assert!(json.contains("\"state\":\"trafficObserved\""));
        assert!(json.contains("\"handshakeAgeSeconds\":15"));
        assert!(json.contains("\"rxBytes\":1024"));
        assert!(json.contains("\"txBytes\":2048"));
    }
}
