use super::{TunnelServiceState, TunnelStatusReport, construct_service_name, validate_tunnel_name};
use std::mem::zeroed;
use std::ptr::null;
use windows_sys::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_SERVICE_DOES_NOT_EXIST, GetLastError,
};
use windows_sys::Win32::System::Services::{
    CloseServiceHandle, OpenSCManagerW, OpenServiceW, QueryServiceStatusEx, SC_HANDLE,
    SC_MANAGER_CONNECT, SC_STATUS_PROCESS_INFO, SERVICE_CONTINUE_PENDING, SERVICE_PAUSE_PENDING,
    SERVICE_PAUSED, SERVICE_QUERY_STATUS, SERVICE_RUNNING, SERVICE_START_PENDING,
    SERVICE_STATUS_PROCESS, SERVICE_STOP_PENDING, SERVICE_STOPPED,
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
}
