import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionState,
  ServerInfo,
  VpnMetrics,
  ErrorCode,
  TunnelOperationResult,
  NativeServiceState,
  VerificationState,
} from "../types/vpn.ts";
import {
  evaluateServiceStateTransition,
  evaluateDataPlaneHealth,
  evaluateReconnectionOutcome,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_TIMEOUT_MS,
  HANDSHAKE_GRACE_PERIOD_MS,
} from "./connectionLifecycle.ts";
import { isTauriEnvironment } from "./environment.ts";

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
          subtitle: "Tunnel active · Bidirectional traffic verified",
        };
      }
      if (verificationState === "handshakeVerified") {
        return {
          title: "Handshake Verified",
          subtitle: "Tunnel active · Cryptographic handshake verified",
        };
      }
      if (verificationState === "permissionDenied") {
        return {
          title: "Telemetry Restricted",
          subtitle: "Tunnel service active · Admin permission required for UAPI pipe",
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
  const reconnectAttemptsRef = useRef<number>(0);
  const unverifiedSinceRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const degradationTimerRef = useRef<number | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (metricsTimerRef.current) window.clearInterval(metricsTimerRef.current);
      if (connectingTimeoutRef.current) window.clearTimeout(connectingTimeoutRef.current);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (degradationTimerRef.current) window.clearTimeout(degradationTimerRef.current);
    };
  }, []);

  const triggerReconnection = useCallback(
    async (reason: string) => {
      if (hasUserDisconnectedRef.current) return;
      if (isOperatingRef.current) return;

      if (!isTauriEnvironment()) {
        setState("error");
        setErrorCode("SERVER_UNAVAILABLE");
        setCustomErrorMessage(
          "Browser preview mode active: native WireGuard controls require the Tauri desktop shell ('npm run dev:tauri')."
        );
        return;
      }

      const currentAttempts = reconnectAttemptsRef.current;
      const outcome = evaluateReconnectionOutcome(false, currentAttempts, RECONNECT_MAX_ATTEMPTS);

      if (outcome.nextState === "error") {
        setState("error");
        setErrorCode(outcome.errorCode);
        setCustomErrorMessage(outcome.errorMessage || "Automated recovery failed.");
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        return;
      }

      reconnectAttemptsRef.current = outcome.nextAttempts;
      setState("reconnecting");
      setCustomErrorMessage(
        `Reconnecting (attempt ${outcome.nextAttempts}/${RECONNECT_MAX_ATTEMPTS}): ${reason}`
      );

      // Bounded safety timeout for this reconnection attempt
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        if (hasUserDisconnectedRef.current) return;
        setState((curr) => {
          if (curr === "reconnecting") {
            const timedOutOutcome = evaluateReconnectionOutcome(
              false,
              reconnectAttemptsRef.current,
              RECONNECT_MAX_ATTEMPTS
            );
            if (timedOutOutcome.nextState === "error") {
              setErrorCode(timedOutOutcome.errorCode);
              setCustomErrorMessage(
                timedOutOutcome.errorMessage || "Connection recovery attempt timed out."
              );
              return "error";
            }
            triggerReconnection("Previous recovery attempt timed out.");
            return "reconnecting";
          }
          return curr;
        });
      }, RECONNECT_TIMEOUT_MS);

      isOperatingRef.current = true;
      try {
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
          if (result.errorCode === "ACCESS_DENIED") {
            setState("error");
            setErrorCode("TUNNEL_PERMISSION_DENIED");
            setCustomErrorMessage(result.message);
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            return;
          }
          if (result.errorCode === "SERVICE_NOT_INSTALLED") {
            setState("error");
            setErrorCode("SERVICE_NOT_INSTALLED");
            setCustomErrorMessage(result.message);
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            return;
          }
          if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
            setState("error");
            setErrorCode("SERVER_UNAVAILABLE");
            setCustomErrorMessage(result.message || "Failed to restart tunnel service.");
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
          }
        }
      } catch (err: unknown) {
        if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
          setState("error");
          setErrorCode("SERVER_UNAVAILABLE");
          const msg = err instanceof Error ? err.message : String(err);
          setCustomErrorMessage(msg);
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        }
      } finally {
        isOperatingRef.current = false;
      }
    },
    [options]
  );

  // Synchronize UI session state with real native Windows service state
  useEffect(() => {
    const nativeState = options?.nativeServiceState;
    if (!nativeState) return;

    const transition = evaluateServiceStateTransition(
      state,
      nativeState,
      hasUserDisconnectedRef.current
    );

    if (transition.triggerReconnect) {
      triggerReconnection("WireGuard service stopped unexpectedly.");
      return;
    }

    if (transition.nextState !== state) {
      setState(transition.nextState);
      if (transition.errorCode !== undefined) {
        setErrorCode(transition.errorCode);
      }
      if (transition.errorMessage !== undefined) {
        setCustomErrorMessage(transition.errorMessage);
      }
      if (transition.nextState === "connected") {
        if (connectingTimeoutRef.current) {
          clearTimeout(connectingTimeoutRef.current);
          connectingTimeoutRef.current = null;
        }
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        if (degradationTimerRef.current) {
          clearTimeout(degradationTimerRef.current);
          degradationTimerRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
        unverifiedSinceRef.current = null;
      }
    }
  }, [options?.nativeServiceState, state, triggerReconnection]);

  // Monitor data plane verification state and trigger recovery on sustained degradation
  useEffect(() => {
    const verification = options?.verificationState;
    const now = Date.now();

    if (state === "connected") {
      const health = evaluateDataPlaneHealth(
        state,
        verification,
        unverifiedSinceRef.current,
        now,
        HANDSHAKE_GRACE_PERIOD_MS
      );

      unverifiedSinceRef.current = health.newUnverifiedSinceMs;

      if (health.shouldEnterReconnecting) {
        if (degradationTimerRef.current) {
          clearTimeout(degradationTimerRef.current);
          degradationTimerRef.current = null;
        }
        triggerReconnection("Sustained loss of verified WireGuard activity.");
      } else if (health.newUnverifiedSinceMs !== null && !degradationTimerRef.current) {
        const remainingMs = Math.max(
          0,
          HANDSHAKE_GRACE_PERIOD_MS - (now - health.newUnverifiedSinceMs)
        );
        degradationTimerRef.current = window.setTimeout(() => {
          degradationTimerRef.current = null;
          if (!hasUserDisconnectedRef.current) {
            triggerReconnection("Sustained loss of verified WireGuard activity.");
          }
        }, remainingMs);
      } else if (health.newUnverifiedSinceMs === null && degradationTimerRef.current) {
        clearTimeout(degradationTimerRef.current);
        degradationTimerRef.current = null;
      }
    } else if (state === "reconnecting") {
      if (degradationTimerRef.current) {
        clearTimeout(degradationTimerRef.current);
        degradationTimerRef.current = null;
      }
      // If service is running and data plane is verified, recovery succeeded!
      if (
        (verification === "trafficObserved" || verification === "handshakeVerified") &&
        options?.nativeServiceState === "running"
      ) {
        const recovery = evaluateReconnectionOutcome(true, reconnectAttemptsRef.current);
        setState(recovery.nextState);
        setErrorCode(recovery.errorCode);
        setCustomErrorMessage(recovery.errorMessage ?? null);
        reconnectAttemptsRef.current = 0;
        unverifiedSinceRef.current = null;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      }
    } else {
      unverifiedSinceRef.current = null;
      if (degradationTimerRef.current) {
        clearTimeout(degradationTimerRef.current);
        degradationTimerRef.current = null;
      }
    }
  }, [options?.verificationState, options?.nativeServiceState, state, triggerReconnection]);

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
    if (
      state === "connecting" ||
      state === "connected" ||
      state === "preparing" ||
      state === "reconnecting"
    ) {
      return;
    }

    isOperatingRef.current = true;
    hasUserDisconnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    unverifiedSinceRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (degradationTimerRef.current) {
      clearTimeout(degradationTimerRef.current);
      degradationTimerRef.current = null;
    }
    setErrorCode(undefined);
    setCustomErrorMessage(null);

    if (!isTauriEnvironment()) {
      setState("error");
      setErrorCode("TUNNEL_START_FAILED");
      setCustomErrorMessage(
        "Browser preview mode active: native WireGuard controls require the Tauri desktop shell ('npm run dev:tauri')."
      );
      isOperatingRef.current = false;
      return;
    }

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
    reconnectAttemptsRef.current = 0;
    unverifiedSinceRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (degradationTimerRef.current) {
      clearTimeout(degradationTimerRef.current);
      degradationTimerRef.current = null;
    }
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }

    if (!isTauriEnvironment()) {
      setState("disconnected");
      setErrorCode(undefined);
      setCustomErrorMessage(null);
      isOperatingRef.current = false;
      return;
    }

    setState("disconnecting");

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
    if (state === "connected" || state === "connecting" || state === "reconnecting") {
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
    subtitle: customErrorMessage || microcopy.subtitle,
    metrics,
    lastOperation,
    connect,
    disconnect,
    toggleConnection,
    simulateState,
  };
}
