import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectionState, ServerInfo, VpnMetrics, ErrorCode } from "../types/vpn";

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

export function getMicrocopy(state: ConnectionState, errorCode?: ErrorCode): { title: string; subtitle: string } {
  switch (state) {
    case "disconnected":
      return {
        title: "Not connected",
        subtitle: "Not connected · Connect when ready",
      };
    case "preparing":
      return {
        title: "Preparing tunnel",
        subtitle: "Configuring local cryptographic keys…",
      };
    case "connecting":
      return {
        title: "Connecting…",
        subtitle: "Establishing secure WireGuard session…",
      };
    case "connected":
      return {
        title: "Connected",
        subtitle: "Tunnel active · All traffic encrypted",
      };
    case "reconnecting":
      return {
        title: "Reconnecting…",
        subtitle: "Connection interrupted · Reconnecting…",
      };
    case "disconnecting":
      return {
        title: "Disconnecting…",
        subtitle: "Reverting network route tables…",
      };
    case "error":
      if (errorCode === "TUNNEL_PERMISSION_DENIED") {
        return {
          title: "Permission Required",
          subtitle: "VPN permission is required to continue.",
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
        subtitle: "Couldn't start the VPN. Open diagnostics for details.",
      };
  }
}

export function useVpn() {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [selectedServer, setSelectedServer] = useState<ServerInfo>(MOCK_SERVERS[0]);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>(undefined);
  const [customErrorMessage, setCustomErrorMessage] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<VpnMetrics>({
    connectedDurationSec: 0,
    downloadBytes: 0,
    uploadBytes: 0,
    currentDownloadKbps: 0,
    currentUploadKbps: 0,
    isRealTelemetry: false,
  });

  const timerRef = useRef<number | null>(null);
  const metricsTimerRef = useRef<number | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (metricsTimerRef.current) window.clearInterval(metricsTimerRef.current);
    };
  }, []);

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

  const connect = useCallback(() => {
    if (state === "connecting" || state === "connected" || state === "preparing") return;

    setErrorCode(undefined);
    setCustomErrorMessage(null);
    setState("preparing");

    // Phase 1: Preparing (allocating keys/simulating handshake preparation)
    timerRef.current = window.setTimeout(() => {
      setState("connecting");

      // Phase 2: Connecting (handshake negotiation)
      timerRef.current = window.setTimeout(() => {
        setState("connected");
      }, 1200);
    }, 400);
  }, [state]);

  const disconnect = useCallback(() => {
    if (state === "disconnected" || state === "disconnecting") return;

    setState("disconnecting");
    timerRef.current = window.setTimeout(() => {
      setState("disconnected");
      setErrorCode(undefined);
      setCustomErrorMessage(null);
    }, 500);
  }, [state]);

  const toggleConnection = useCallback(() => {
    if (state === "connected") {
      disconnect();
    } else if (state === "disconnected" || state === "error") {
      connect();
    }
  }, [state, connect, disconnect]);

  // Utility to simulate states for UI testing and validation
  const simulateState = useCallback((targetState: ConnectionState, code?: ErrorCode, customMsg?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(targetState);
    setErrorCode(code);
    if (customMsg) setCustomErrorMessage(customMsg);
  }, []);

  const microcopy = getMicrocopy(state, errorCode);

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
    connect,
    disconnect,
    toggleConnection,
    simulateState,
  };
}
