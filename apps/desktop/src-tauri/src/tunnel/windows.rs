use super::{
    TunnelOperationResult, TunnelServiceState, TunnelStatusReport, construct_service_name,
    validate_tunnel_name,
};
use std::mem::zeroed;
use std::ptr::null;
use windows_sys::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_SERVICE_ALREADY_RUNNING, ERROR_SERVICE_DOES_NOT_EXIST,
    ERROR_SERVICE_NOT_ACTIVE, GetLastError,
};
use windows_sys::Win32::System::Services::{
    CloseServiceHandle, ControlService, OpenSCManagerW, OpenServiceW, QueryServiceStatusEx,
    SC_HANDLE, SC_MANAGER_CONNECT, SC_STATUS_PROCESS_INFO, SERVICE_CONTINUE_PENDING,
    SERVICE_CONTROL_STOP, SERVICE_PAUSE_PENDING, SERVICE_PAUSED, SERVICE_QUERY_STATUS,
    SERVICE_RUNNING, SERVICE_START, SERVICE_START_PENDING, SERVICE_STATUS, SERVICE_STATUS_PROCESS,
    SERVICE_STOP, SERVICE_STOP_PENDING, SERVICE_STOPPED, StartServiceW,
};

/// RAII wrapper ensuring Service Control Manager handles are closed cleanly on all exit paths.
struct ServiceHandle(SC_HANDLE);

impl Drop for ServiceHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                CloseServiceHandle(self.0);
            }
        }
    }
}

/// Helper to convert a UTF-8 string slice to a null-terminated UTF-16 wide string.
fn to_wide_null(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Maps Windows `dwCurrentState` constants to serializable `TunnelServiceState`.
pub fn map_service_state(dw_current_state: u32) -> TunnelServiceState {
    match dw_current_state {
        SERVICE_RUNNING => TunnelServiceState::Running,
        SERVICE_STOPPED => TunnelServiceState::Stopped,
        SERVICE_START_PENDING => TunnelServiceState::StartPending,
        SERVICE_STOP_PENDING => TunnelServiceState::StopPending,
        SERVICE_PAUSED => TunnelServiceState::Unknown("Paused".into()),
        SERVICE_PAUSE_PENDING => TunnelServiceState::Unknown("PausePending".into()),
        SERVICE_CONTINUE_PENDING => TunnelServiceState::Unknown("ContinuePending".into()),
        other => TunnelServiceState::Unknown(format!("StateCode({})", other)),
    }
}

/// Read-only inspection of a WireGuard tunnel service via Windows SCM APIs.
/// Requires NO administrator elevation and makes zero modifications.
pub fn query_tunnel_service_status(tunnel_name: &str) -> Result<TunnelStatusReport, String> {
    // 1. Strict input validation
    let valid_tunnel_name = validate_tunnel_name(tunnel_name)?;
    let service_name = construct_service_name(valid_tunnel_name);
    let wide_service_name = to_wide_null(&service_name);

    unsafe {
        // 2. Open SCM database with read-only CONNECT access (available to all standard users)
        let scm_raw = OpenSCManagerW(null(), null(), SC_MANAGER_CONNECT);
        if scm_raw.is_null() {
            let err = GetLastError();
            let state = if err == ERROR_ACCESS_DENIED {
                TunnelServiceState::AccessDenied
            } else {
                TunnelServiceState::Unknown(format!("SCMOpenFailed({})", err))
            };
            return Ok(TunnelStatusReport {
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_message: Some(format!(
                    "Failed to open Windows Service Manager (error code {})",
                    err
                )),
            });
        }
        let _scm_guard = ServiceHandle(scm_raw);

        // 3. Open the specific service with read-only QUERY_STATUS permission
        let service_raw = OpenServiceW(scm_raw, wide_service_name.as_ptr(), SERVICE_QUERY_STATUS);
        if service_raw.is_null() {
            let err = GetLastError();
            let (state, msg) = match err {
                ERROR_SERVICE_DOES_NOT_EXIST => (TunnelServiceState::NotInstalled, None),
                ERROR_ACCESS_DENIED => (
                    TunnelServiceState::AccessDenied,
                    Some("Access denied while querying service status".into()),
                ),
                other => (
                    TunnelServiceState::Unknown(format!("OpenServiceFailed({})", other)),
                    Some(format!("Service query failed (error code {})", other)),
                ),
            };

            return Ok(TunnelStatusReport {
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_message: msg,
            });
        }
        let _service_guard = ServiceHandle(service_raw);

        // 4. Query current process/service status
        let mut ssp: SERVICE_STATUS_PROCESS = zeroed();
        let mut bytes_needed: u32 = 0;
        let success = QueryServiceStatusEx(
            service_raw,
            SC_STATUS_PROCESS_INFO,
            &mut ssp as *mut _ as *mut u8,
            std::mem::size_of::<SERVICE_STATUS_PROCESS>() as u32,
            &mut bytes_needed,
        );

        if success == 0 {
            let err = GetLastError();
            return Ok(TunnelStatusReport {
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state: TunnelServiceState::Unknown(format!("QueryStatusFailed({})", err)),
                error_message: Some(format!("QueryServiceStatusEx failed (error code {})", err)),
            });
        }

        // 5. Map Windows state to our domain model
        let mapped_state = map_service_state(ssp.dwCurrentState);

        Ok(TunnelStatusReport {
            tunnel_name: valid_tunnel_name.to_string(),
            service_name,
            state: mapped_state,
            error_message: None,
        })
    }
}

/// Native start operation for a WireGuard tunnel service via Windows SCM APIs.
/// Enforces strict validation, handles missing service and permission errors explicitly,
/// and reports structured outcome without throwing untyped crashes.
pub fn start_tunnel_service(tunnel_name: &str) -> Result<TunnelOperationResult, String> {
    let valid_tunnel_name = validate_tunnel_name(tunnel_name)?;
    let service_name = construct_service_name(valid_tunnel_name);
    let wide_service_name = to_wide_null(&service_name);

    unsafe {
        // 1. Open SCM database with connect permission
        let scm_raw = OpenSCManagerW(null(), null(), SC_MANAGER_CONNECT);
        if scm_raw.is_null() {
            let err = GetLastError();
            let (code, msg) = if err == ERROR_ACCESS_DENIED {
                (
                    "ACCESS_DENIED",
                    "Access denied opening Windows Service Control Manager.",
                )
            } else {
                (
                    "SYSTEM_ERROR",
                    "Failed to open Windows Service Control Manager.",
                )
            };
            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state: if err == ERROR_ACCESS_DENIED {
                    TunnelServiceState::AccessDenied
                } else {
                    TunnelServiceState::Unknown(format!("SCMOpenFailed({})", err))
                },
                error_code: Some(code.into()),
                message: format!("{} (error code {})", msg, err),
            });
        }
        let _scm_guard = ServiceHandle(scm_raw);

        // 2. Open the specific service with SERVICE_START | SERVICE_QUERY_STATUS permissions
        let service_raw = OpenServiceW(
            scm_raw,
            wide_service_name.as_ptr(),
            SERVICE_START | SERVICE_QUERY_STATUS,
        );

        if service_raw.is_null() {
            let err = GetLastError();
            let (state, code, msg) = match err {
                ERROR_SERVICE_DOES_NOT_EXIST => (
                    TunnelServiceState::NotInstalled,
                    "SERVICE_NOT_INSTALLED",
                    format!(
                        "WireGuard tunnel service '{}' is not installed in Windows Service Control Manager.",
                        service_name
                    ),
                ),
                ERROR_ACCESS_DENIED => (
                    TunnelServiceState::AccessDenied,
                    "ACCESS_DENIED",
                    format!(
                        "Access denied opening service '{}' with start permissions. Administrator privileges are required.",
                        service_name
                    ),
                ),
                other => (
                    TunnelServiceState::Unknown(format!("OpenServiceFailed({})", other)),
                    "SYSTEM_ERROR",
                    format!(
                        "Failed to open service '{}' (error code {})",
                        service_name, other
                    ),
                ),
            };

            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_code: Some(code.into()),
                message: msg,
            });
        }
        let _service_guard = ServiceHandle(service_raw);

        // 3. Query current status to prevent redundant start attempts
        let mut ssp: SERVICE_STATUS_PROCESS = zeroed();
        let mut bytes_needed: u32 = 0;
        let query_success = QueryServiceStatusEx(
            service_raw,
            SC_STATUS_PROCESS_INFO,
            &mut ssp as *mut _ as *mut u8,
            std::mem::size_of::<SERVICE_STATUS_PROCESS>() as u32,
            &mut bytes_needed,
        );

        if query_success != 0 {
            if ssp.dwCurrentState == SERVICE_RUNNING {
                return Ok(TunnelOperationResult {
                    success: true,
                    tunnel_name: valid_tunnel_name.to_string(),
                    service_name,
                    state: TunnelServiceState::Running,
                    error_code: None,
                    message: "WireGuard tunnel service is already running.".into(),
                });
            } else if ssp.dwCurrentState == SERVICE_START_PENDING {
                return Ok(TunnelOperationResult {
                    success: true,
                    tunnel_name: valid_tunnel_name.to_string(),
                    service_name,
                    state: TunnelServiceState::StartPending,
                    error_code: None,
                    message: "WireGuard tunnel service start is already pending.".into(),
                });
            }
        }

        // 4. Request service start
        let start_res = StartServiceW(service_raw, 0, null());
        if start_res == 0 {
            let err = GetLastError();
            let (state, code, msg) = match err {
                ERROR_SERVICE_ALREADY_RUNNING => (
                    TunnelServiceState::Running,
                    None,
                    "WireGuard tunnel service is already running.".to_string(),
                ),
                ERROR_ACCESS_DENIED => (
                    TunnelServiceState::AccessDenied,
                    Some("ACCESS_DENIED".to_string()),
                    format!(
                        "Access denied starting service '{}'. Administrator privileges are required.",
                        service_name
                    ),
                ),
                other => (
                    TunnelServiceState::Unknown(format!("StartServiceFailed({})", other)),
                    Some("START_FAILED".to_string()),
                    format!(
                        "Failed to start service '{}' (error code {})",
                        service_name, other
                    ),
                ),
            };

            let is_success = code.is_none();
            return Ok(TunnelOperationResult {
                success: is_success,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_code: code,
                message: msg,
            });
        }

        Ok(TunnelOperationResult {
            success: true,
            tunnel_name: valid_tunnel_name.to_string(),
            service_name,
            state: TunnelServiceState::StartPending,
            error_code: None,
            message: "WireGuard tunnel service start command dispatched successfully.".into(),
        })
    }
}

/// Native stop operation for a WireGuard tunnel service via Windows SCM APIs.
/// Enforces strict validation, handles missing service and permission errors explicitly,
/// and reports structured outcome.
pub fn stop_tunnel_service(tunnel_name: &str) -> Result<TunnelOperationResult, String> {
    let valid_tunnel_name = validate_tunnel_name(tunnel_name)?;
    let service_name = construct_service_name(valid_tunnel_name);
    let wide_service_name = to_wide_null(&service_name);

    unsafe {
        // 1. Open SCM database with connect permission
        let scm_raw = OpenSCManagerW(null(), null(), SC_MANAGER_CONNECT);
        if scm_raw.is_null() {
            let err = GetLastError();
            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state: if err == ERROR_ACCESS_DENIED {
                    TunnelServiceState::AccessDenied
                } else {
                    TunnelServiceState::Unknown(format!("SCMOpenFailed({})", err))
                },
                error_code: Some("ACCESS_DENIED".into()),
                message: format!(
                    "Failed to open Windows Service Control Manager (error code {})",
                    err
                ),
            });
        }
        let _scm_guard = ServiceHandle(scm_raw);

        // 2. Open service with SERVICE_STOP | SERVICE_QUERY_STATUS permissions
        let service_raw = OpenServiceW(
            scm_raw,
            wide_service_name.as_ptr(),
            SERVICE_STOP | SERVICE_QUERY_STATUS,
        );

        if service_raw.is_null() {
            let err = GetLastError();
            let (state, code, msg) = match err {
                ERROR_SERVICE_DOES_NOT_EXIST => (
                    TunnelServiceState::NotInstalled,
                    "SERVICE_NOT_INSTALLED",
                    format!(
                        "WireGuard tunnel service '{}' is not installed in Windows Service Control Manager.",
                        service_name
                    ),
                ),
                ERROR_ACCESS_DENIED => (
                    TunnelServiceState::AccessDenied,
                    "ACCESS_DENIED",
                    format!(
                        "Access denied opening service '{}' with stop permissions. Administrator privileges are required.",
                        service_name
                    ),
                ),
                other => (
                    TunnelServiceState::Unknown(format!("OpenServiceFailed({})", other)),
                    "SYSTEM_ERROR",
                    format!(
                        "Failed to open service '{}' (error code {})",
                        service_name, other
                    ),
                ),
            };

            return Ok(TunnelOperationResult {
                success: false,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_code: Some(code.into()),
                message: msg,
            });
        }
        let _service_guard = ServiceHandle(service_raw);

        // 3. Query current status to check if already stopped
        let mut ssp: SERVICE_STATUS_PROCESS = zeroed();
        let mut bytes_needed: u32 = 0;
        let query_success = QueryServiceStatusEx(
            service_raw,
            SC_STATUS_PROCESS_INFO,
            &mut ssp as *mut _ as *mut u8,
            std::mem::size_of::<SERVICE_STATUS_PROCESS>() as u32,
            &mut bytes_needed,
        );

        if query_success != 0 && ssp.dwCurrentState == SERVICE_STOPPED {
            return Ok(TunnelOperationResult {
                success: true,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state: TunnelServiceState::Stopped,
                error_code: None,
                message: "WireGuard tunnel service is already stopped.".into(),
            });
        }

        // 4. Request service stop
        let mut status: SERVICE_STATUS = zeroed();
        let stop_res = ControlService(service_raw, SERVICE_CONTROL_STOP, &mut status);

        if stop_res == 0 {
            let err = GetLastError();
            let (state, code, msg) = match err {
                ERROR_SERVICE_NOT_ACTIVE => (
                    TunnelServiceState::Stopped,
                    None,
                    "WireGuard tunnel service is not active.".to_string(),
                ),
                ERROR_ACCESS_DENIED => (
                    TunnelServiceState::AccessDenied,
                    Some("ACCESS_DENIED".to_string()),
                    format!(
                        "Access denied stopping service '{}'. Administrator privileges are required.",
                        service_name
                    ),
                ),
                other => (
                    TunnelServiceState::Unknown(format!("StopServiceFailed({})", other)),
                    Some("STOP_FAILED".to_string()),
                    format!(
                        "Failed to stop service '{}' (error code {})",
                        service_name, other
                    ),
                ),
            };

            let is_success = code.is_none();
            return Ok(TunnelOperationResult {
                success: is_success,
                tunnel_name: valid_tunnel_name.to_string(),
                service_name,
                state,
                error_code: code,
                message: msg,
            });
        }

        Ok(TunnelOperationResult {
            success: true,
            tunnel_name: valid_tunnel_name.to_string(),
            service_name,
            state: TunnelServiceState::StopPending,
            error_code: None,
            message: "WireGuard tunnel service stop command dispatched successfully.".into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_service_state() {
        assert_eq!(
            map_service_state(SERVICE_RUNNING),
            TunnelServiceState::Running
        );
        assert_eq!(
            map_service_state(SERVICE_STOPPED),
            TunnelServiceState::Stopped
        );
        assert_eq!(
            map_service_state(SERVICE_START_PENDING),
            TunnelServiceState::StartPending
        );
        assert_eq!(
            map_service_state(SERVICE_STOP_PENDING),
            TunnelServiceState::StopPending
        );
        assert_eq!(
            map_service_state(9999),
            TunnelServiceState::Unknown("StateCode(9999)".into())
        );
    }

    #[test]
    fn test_to_wide_null() {
        let wide = to_wide_null("flux");
        assert_eq!(
            wide,
            vec!['f' as u16, 'l' as u16, 'u' as u16, 'x' as u16, 0]
        );
    }

    #[test]
    fn test_query_non_existent_tunnel() {
        // Querying "flux" when no service is installed should return NotInstalled, not error out.
        let report = query_tunnel_service_status("flux").expect("query must succeed");
        assert_eq!(report.tunnel_name, "flux");
        assert_eq!(report.service_name, "WireGuardTunnel$flux");
        // On a dev machine where the tunnel is not installed, it should be NotInstalled
        assert_eq!(report.state, TunnelServiceState::NotInstalled);
    }

    #[test]
    fn test_start_non_existent_tunnel() {
        let result = start_tunnel_service("flux").expect("start invocation must succeed");
        assert_eq!(result.tunnel_name, "flux");
        assert_eq!(result.service_name, "WireGuardTunnel$flux");
        assert!(!result.success);
        assert_eq!(result.state, TunnelServiceState::NotInstalled);
        assert_eq!(result.error_code, Some("SERVICE_NOT_INSTALLED".into()));
    }

    #[test]
    fn test_stop_non_existent_tunnel() {
        let result = stop_tunnel_service("flux").expect("stop invocation must succeed");
        assert_eq!(result.tunnel_name, "flux");
        assert_eq!(result.service_name, "WireGuardTunnel$flux");
        assert!(!result.success);
        assert_eq!(result.state, TunnelServiceState::NotInstalled);
        assert_eq!(result.error_code, Some("SERVICE_NOT_INSTALLED".into()));
    }
}
