export type ConnectionState =
  | "disconnected"
  | "preparing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnecting"
  | "error";

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "DEVICE_REVOKED"
  | "SERVER_UNAVAILABLE"
  | "TUNNEL_PERMISSION_DENIED"
  | "TUNNEL_START_FAILED"
  | "SERVICE_NOT_INSTALLED"
  | "DNS_CONFIGURATION_FAILED"
  | "CONFIGURATION_INVALID";

export interface ServerInfo {
  id: string;
  name: string;
  location: string;
  countryCode: string;
  endpoint: string;
  pingMs: number;
}

export interface VpnMetrics {
  connectedDurationSec: number;
  downloadBytes: number;
  uploadBytes: number;
  currentDownloadKbps: number;
  currentUploadKbps: number;
  isRealTelemetry?: boolean;
}

export interface VpnDiagnosticReport {
  appVersion: string;
  platform: string;
  adapterMode: "Mock (Simulation)" | "Native WireGuard";
  state: ConnectionState;
  selectedServer: string;
  lastError: string | null;
  generatedAt: string;
}

export type NativeServiceState =
  | "running"
  | "stopped"
  | "startPending"
  | "stopPending"
  | "notInstalled"
  | "accessDenied"
  | { unknown: string };

export interface TunnelStatusReport {
  tunnelName: string;
  serviceName: string;
  state: NativeServiceState;
  errorMessage: string | null;
}

export interface TunnelOperationResult {
  success: boolean;
  tunnelName: string;
  serviceName: string;
  state: NativeServiceState;
  errorCode: string | null;
  message: string;
}

export type NativeServiceTone = "positive" | "warning" | "neutral" | "danger";

export interface FormattedServiceState {
  label: string;
  tone: NativeServiceTone;
  isInstalled: boolean;
  isRunning: boolean;
}

export function formatNativeServiceState(state: NativeServiceState): FormattedServiceState {
  if (typeof state === "string") {
    switch (state) {
      case "running":
        return { label: "RUNNING", tone: "positive", isInstalled: true, isRunning: true };
      case "stopped":
        return { label: "STOPPED", tone: "neutral", isInstalled: true, isRunning: false };
      case "startPending":
        return { label: "STARTING...", tone: "warning", isInstalled: true, isRunning: false };
      case "stopPending":
        return { label: "STOPPING...", tone: "warning", isInstalled: true, isRunning: false };
      case "notInstalled":
        return { label: "NOT INSTALLED", tone: "neutral", isInstalled: false, isRunning: false };
      case "accessDenied":
        return { label: "ACCESS DENIED", tone: "danger", isInstalled: false, isRunning: false };
    }
  }
  if (typeof state === "object" && state !== null && "unknown" in state) {
    return { label: `UNKNOWN (${state.unknown})`, tone: "warning", isInstalled: false, isRunning: false };
  }
  return { label: "UNKNOWN", tone: "warning", isInstalled: false, isRunning: false };
}

export type VerificationState =
  | "serviceStopped"
  | "noHandshake"
  | "handshakeVerified"
  | "trafficObserved"
  | "unavailable"
  | "permissionDenied"
  | "queryFailed";

export interface TunnelTelemetry {
  lastHandshakeEpochSec: number | null;
  handshakeAgeSeconds: number | null;
  rxBytes: number;
  txBytes: number;
}

export interface TunnelVerificationReport {
  tunnelName: string;
  state: VerificationState;
  telemetry: TunnelTelemetry | null;
  errorMessage: string | null;
}

export interface FormattedVerificationState {
  label: string;
  tone: NativeServiceTone;
  isVerified: boolean;
}

export function formatVerificationState(state: VerificationState): FormattedVerificationState {
  switch (state) {
    case "trafficObserved":
      return { label: "TRAFFIC ACTIVE", tone: "positive", isVerified: true };
    case "handshakeVerified":
      return { label: "HANDSHAKE VERIFIED", tone: "positive", isVerified: true };
    case "noHandshake":
      return { label: "NO HANDSHAKE", tone: "warning", isVerified: false };
    case "serviceStopped":
      return { label: "SERVICE STOPPED", tone: "neutral", isVerified: false };
    case "unavailable":
      return { label: "UNAVAILABLE", tone: "neutral", isVerified: false };
    case "permissionDenied":
      return { label: "ACCESS DENIED", tone: "danger", isVerified: false };
    case "queryFailed":
    default:
      return { label: "QUERY FAILED", tone: "danger", isVerified: false };
  }
}
