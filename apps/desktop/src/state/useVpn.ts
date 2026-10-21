import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ConnectionState,
  ServerInfo,
  VpnMetrics,
  ErrorCode,
  TunnelOperationResult,
  NativeServiceState,
  VerificationState,
} from "../types/vpn";

export const MOCK_SERVERS: ServerInfo[] = [
  {
    id: "de-fra-01",
    name: "Frankfurt 01",
    location: "Frankfurt, Germany",
    countryCode: "DE",
    endpoint: "fra1.vpn.flux.internal:51820",
    pingMs: 24,
  },
  {
    id: "in-bom-01",
    name: "Mumbai 01",
    location: "Mumbai, India",
    countryCode: "IN",
    endpoint: "bom1.vpn.flux.internal:51820",
    pingMs: 12,
  },
  {
    id: "sg-sin-01",
    name: "Singapore 01",
    location: "Singapore",
    countryCode: "SG",
    endpoint: "sin1.vpn.flux.internal:51820",
    pingMs: 48,
  },
];

export function getMicrocopy(
  state: ConnectionState,
  errorCode?: ErrorCode,
  verificationState?: VerificationState
): { title: string; subtitle: string } {
  switch (state) {
    case "disconnected":
      return {
        title: "Not connected",
        subtitle: "Not connected · Connect when ready",
      };
    case "preparing":
      return {
        title: "Preparing tunnel",
        subtitle: "Querying Windows Service Control Manager…",
      };
    case "connecting":
      return {
        title: "Connecting…",
        subtitle: "Dispatching start signal to WireGuard service…",
      };
    case "connected":
      if (verificationState === "trafficObserved") {
        return {
          title: "Connected",
          subtitle: "Protected · Bidirectional traffic active",
        };
      }
      if (verificationState === "handshakeVerified") {
        return {
          title: "Handshake Verified",
          subtitle: "Tunnel active · Cryptographic handshake verified",
        };
      }
      return {
        title: "Tunnel Running",
        subtitle: "Tunnel service active · Handshake pending",
      };
    case "reconnecting":
      return {
        title: "Reconnecting…",
        subtitle: "Connection interrupted · Reconnecting…",
      };
    case "disconnecting":
      return {
        title: "Disconnecting…",
        subtitle: "Dispatching stop signal to WireGuard service…",
      };
    case "error":
      if (errorCode === "SERVICE_NOT_INSTALLED") {
        return {
          title: "Service Not Installed",
          subtitle: "WireGuard tunnel service 'WireGuardTunnel$flux' is not installed in Windows SCM.",
        };
      }
      if (errorCode === "TUNNEL_PERMISSION_DENIED") {
        return {
          title: "Permission Required",
          subtitle: "Administrator permission is required to manage the Windows WireGuard service.",
        };
      }
      if (errorCode === "SERVER_UNAVAILABLE") {
        return {
          title: "Server Unavailable",
          subtitle: "Couldn't reach the VPN server. Try again later.",
        };
      }
      if (errorCode === "AUTH_REQUIRED" || errorCode === "DEVICE_REVOKED") {
        return {
          title: "Access Inactive",
          subtitle: "Your access is inactive. Check your account.",
        };
      }
      return {
        title: "Tunnel Error",
        subtitle: "Couldn't start the VPN service. Open diagnostics for details.",
      };
  }
}

interface UseVpnOptions {
  onServiceAction?: () => Promise<void> | void;
  nativeServiceState?: NativeServiceState;
  verificationState?: VerificationState;
}

export function useVpn(options?: UseVpnOptions) {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [selectedServer, setSelectedServer] = useState<ServerInfo>(MOCK_SERVERS[0]);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);
  const [customErrorMessage, setCustomErrorMessage] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<TunnelOperationResult | null>(null);

  const [metrics, setMetrics] = useState<VpnMetrics>({
    connectedDurationSec: 0,
    downloadBytes: 0,
    uploadBytes: 0,
    currentDownloadKbps: 0,
    currentUploadKbps: 0,
    isRealTelemetry: false,
  });

  const isOperatingRef = useRef<boolean>(false);
  const metricsTimerRef = useRef<number | null>(null);
  const connectingTimeoutRef = useRef<number | null>(null);
  const hasUserDisconnectedRef = useRef<boolean>(false);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (metricsTimerRef.current) window.clearInterval(metricsTimerRef.current);
      if (connectingTimeoutRef.current) window.clearTimeout(connectingTimeoutRef.current);
    };
  }, []);

  // Synchronize UI session state with real native Windows service state
  useEffect(() => {
    const nativeState = options?.nativeServiceState;
    if (!nativeState) return;

    if (nativeState === "running") {
      if (state === "connecting" || state === "preparing") {
        setState("connected");
        setErrorCode(undefined);
        setCustomErrorMessage(null);
        if (connectingTimeoutRef.current) {
          clearTimeout(connectingTimeoutRef.current);
          connectingTimeoutRef.current = null;
        }
      } else if (state === "disconnected" && !hasUserDisconnectedRef.current && !isOperatingRef.current) {
        // Service was already running when app opened
        setState("connected");
      }
    } else if (nativeState === "stopped") {
      if (state === "connected" || state === "disconnecting") {
        setState("disconnected");
        setErrorCode(undefined);
        setCustomErrorMessage(null);
      }
    } else if (nativeState === "notInstalled") {
      if (state === "connected") {
        setState("error");
        setErrorCode("SERVICE_NOT_INSTALLED");
        setCustomErrorMessage("Tunnel service was uninstalled from Windows Service Control Manager.");
      }
    } else if (nativeState === "accessDenied") {
      if (state === "connected" || state === "connecting") {
        setState("error");
        setErrorCode("TUNNEL_PERMISSION_DENIED");
      }
    }
  }, [options?.nativeServiceState, state]);

  // Update session duration when connected (throughput is marked standby until native driver telemetry is bound)
  useEffect(() => {
    if (state === "connected") {
      metricsTimerRef.current = window.setInterval(() => {
        setMetrics((prev) => ({
          connectedDurationSec: prev.connectedDurationSec + 1,
          downloadBytes: 0,
          uploadBytes: 0,
          currentDownloadKbps: 0,
          currentUploadKbps: 0,
          isRealTelemetry: false,
        }));
      }, 1000);
    } else {
      if (metricsTimerRef.current) {
        clearInterval(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
      if (state === "disconnected") {
        setMetrics({
          connectedDurationSec: 0,
          downloadBytes: 0,
          uploadBytes: 0,
          currentDownloadKbps: 0,
          currentUploadKbps: 0,
          isRealTelemetry: false,
        });
      }
    }
    return () => {
      if (metricsTimerRef.current) clearInterval(metricsTimerRef.current);
    };
  }, [state]);

  const connect = useCallback(async () => {
    if (isOperatingRef.current) return;
    if (state === "connecting" || state === "connected" || state === "preparing") return;

    isOperatingRef.current = true;
    hasUserDisconnectedRef.current = false;
    setErrorCode(undefined);
    setCustomErrorMessage(null);
    setState("preparing");

    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }

    try {
      // Invoke native start_tunnel command with strictly fixed tunnel name "flux"
      const result = await invoke<TunnelOperationResult>("start_tunnel", {
        tunnelName: "flux",
      });

      setLastOperation(result);

      if (options?.onServiceAction) {
        try {
          await options.onServiceAction();
        } catch {
          // Non-fatal observer refresh failure
        }
      }

      if (!result.success) {
        // Explicitly model native failure: Do NOT claim VPN is connected!
        setState("error");
        if (result.errorCode === "SERVICE_NOT_INSTALLED") {
          setErrorCode("SERVICE_NOT_INSTALLED");
        } else if (result.errorCode === "ACCESS_DENIED") {
          setErrorCode("TUNNEL_PERMISSION_DENIED");
        } else {
          setErrorCode("TUNNEL_START_FAILED");
        }
        setCustomErrorMessage(result.message);
        return;
      }

      // If service is already reported running, transition immediately; otherwise await observer with timeout
      if (result.state === "running") {
        setState("connected");
      } else {
        setState("connecting");
        connectingTimeoutRef.current = window.setTimeout(() => {
          setState((curr) => {
            if (curr === "connecting") {
              setErrorCode("TUNNEL_START_FAILED");
              setCustomErrorMessage("Tunnel service start timed out awaiting Windows SCM.");
              return "error";
            }
            return curr;
          });
        }, 15000);
      }
    } catch (err: unknown) {
      setState("error");
      setErrorCode("TUNNEL_START_FAILED");
      const msg = err instanceof Error ? err.message : String(err);
      setCustomErrorMessage(msg);
    } finally {
      isOperatingRef.current = false;
    }
  }, [state, options]);

  const disconnect = useCallback(async () => {
    if (isOperatingRef.current) return;
    if (state === "disconnected" || state === "disconnecting") return;

    isOperatingRef.current = true;
    hasUserDisconnectedRef.current = true;
    setState("disconnecting");

    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }

    try {
      // Invoke native stop_tunnel command with strictly fixed tunnel name "flux"
      const result = await invoke<TunnelOperationResult>("stop_tunnel", {
        tunnelName: "flux",
      });

      setLastOperation(result);

      if (options?.onServiceAction) {
        try {
          await options.onServiceAction();
        } catch {
          // Non-fatal observer refresh failure
        }
      }

      if (!result.success && result.errorCode === "ACCESS_DENIED") {
        setState("error");
        setErrorCode("TUNNEL_PERMISSION_DENIED");
        setCustomErrorMessage(result.message);
        return;
      }

      // Successfully stopped or was already stopped
      setState("disconnected");
      setErrorCode(undefined);
      setCustomErrorMessage(null);
    } catch (err: unknown) {
      setState("error");
      setErrorCode("TUNNEL_START_FAILED");
      const msg = err instanceof Error ? err.message : String(err);
      setCustomErrorMessage(msg);
    } finally {
      isOperatingRef.current = false;
    }
  }, [state, options]);

  const toggleConnection = useCallback(() => {
    if (state === "connected" || state === "connecting") {
      disconnect();
    } else if (state === "disconnected" || state === "error") {
      connect();
    }
  }, [state, connect, disconnect]);

  // Utility to simulate states for UI testing and validation
  const simulateState = useCallback((targetState: ConnectionState, code?: ErrorCode, customMsg?: string) => {
    setState(targetState);
    setErrorCode(code);
    if (customMsg) setCustomErrorMessage(customMsg);
  }, []);

  const microcopy = getMicrocopy(state, errorCode, options?.verificationState);

  return {
    state,
    selectedServer,
    setSelectedServer,
    servers: MOCK_SERVERS,
    errorCode,
    errorMessage: customErrorMessage || microcopy.subtitle,
    title: microcopy.title,
    subtitle: microcopy.subtitle,
    metrics,
    lastOperation,
    connect,
    disconnect,
    toggleConnection,
    simulateState,
  };
}
