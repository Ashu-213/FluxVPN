import type {
  ConnectionState,
  ErrorCode,
  NativeServiceState,
  VerificationState,
} from "../types/vpn.ts";

export const RECONNECT_MAX_ATTEMPTS = 3;
export const RECONNECT_TIMEOUT_MS = 15000;
export const HANDSHAKE_GRACE_PERIOD_MS = 10000;

export interface ServiceTransitionOutcome {
  nextState: ConnectionState;
  errorCode?: ErrorCode;
  errorMessage?: string | null;
  triggerReconnect: boolean;
}

/**
 * Evaluates state transition when the native Windows service state changes.
 *
 * Distinguishes clean user-initiated stops from unexpected service crashes/terminations.
 */
export function evaluateServiceStateTransition(
  currentState: ConnectionState,
  nativeState: NativeServiceState,
  hasUserDisconnected: boolean
): ServiceTransitionOutcome {
  if (nativeState === "running") {
    if (currentState === "connecting" || currentState === "preparing") {
      return {
        nextState: "connected",
        errorCode: undefined,
        errorMessage: null,
        triggerReconnect: false,
      };
    }
    if (currentState === "disconnected" && !hasUserDisconnected) {
      // Service was already running when application initialized
      return {
        nextState: "connected",
        errorCode: undefined,
        errorMessage: null,
        triggerReconnect: false,
      };
    }
    // If in reconnecting, stay in reconnecting until data plane verification confirms healthy traffic
    return {
      nextState: currentState,
      triggerReconnect: false,
    };
  }

  if (nativeState === "stopped") {
    // Expected user-initiated disconnect or natural teardown
    if (hasUserDisconnected || currentState === "disconnecting") {
      return {
        nextState: "disconnected",
        errorCode: undefined,
        errorMessage: null,
        triggerReconnect: false,
      };
    }

    // UNEXPECTED SERVICE DROP: Service stopped while connected without user intent
    if (currentState === "connected") {
      return {
        nextState: "reconnecting",
        errorCode: undefined,
        errorMessage: "WireGuard service stopped unexpectedly. Attempting automated recovery…",
        triggerReconnect: true,
      };
    }

    if (currentState === "reconnecting") {
      return {
        nextState: "reconnecting",
        triggerReconnect: false,
      };
    }

    return {
      nextState: "disconnected",
      triggerReconnect: false,
    };
  }

  if (nativeState === "notInstalled") {
    if (
      currentState === "connected" ||
      currentState === "connecting" ||
      currentState === "reconnecting"
    ) {
      return {
        nextState: "error",
        errorCode: "SERVICE_NOT_INSTALLED",
        errorMessage: "Tunnel service was uninstalled from Windows Service Control Manager.",
        triggerReconnect: false,
      };
    }
  }

  if (nativeState === "accessDenied") {
    if (
      currentState === "connected" ||
      currentState === "connecting" ||
      currentState === "reconnecting"
    ) {
      return {
        nextState: "error",
        errorCode: "TUNNEL_PERMISSION_DENIED",
        errorMessage: "Administrator permission required to control Windows WireGuard service.",
        triggerReconnect: false,
      };
    }
  }

  return {
    nextState: currentState,
    triggerReconnect: false,
  };
}

export interface DataPlaneHealthResult {
  shouldEnterReconnecting: boolean;
  newUnverifiedSinceMs: number | null;
}

/**
 * Evaluates whether loss of verified data plane activity is sustained enough
 * to warrant entering recovery, without falsely reacting to normal transient rekeys.
 */
export function evaluateDataPlaneHealth(
  currentState: ConnectionState,
  verificationState: VerificationState | undefined,
  unverifiedSinceMs: number | null,
  nowMs: number,
  gracePeriodMs: number = HANDSHAKE_GRACE_PERIOD_MS
): DataPlaneHealthResult {
  // Only monitor data-plane degradation during an active session
  if (currentState !== "connected") {
    return {
      shouldEnterReconnecting: false,
      newUnverifiedSinceMs: null,
    };
  }

  // Data plane is healthy (verified handshake and/or active traffic)
  if (verificationState === "trafficObserved" || verificationState === "handshakeVerified") {
    return {
      shouldEnterReconnecting: false,
      newUnverifiedSinceMs: null,
    };
  }

  // Verification unconfirmed (noHandshake, unavailable, queryFailed)
  if (
    verificationState === "noHandshake" ||
    verificationState === "unavailable" ||
    verificationState === "queryFailed"
  ) {
    if (unverifiedSinceMs === null) {
      // Begin grace period; do NOT drop immediately on a single poll
      return {
        shouldEnterReconnecting: false,
        newUnverifiedSinceMs: nowMs,
      };
    }

    const elapsed = nowMs - unverifiedSinceMs;
    if (elapsed >= gracePeriodMs) {
      // Sustained loss of verified activity beyond grace threshold
      return {
        shouldEnterReconnecting: true,
        newUnverifiedSinceMs: null,
      };
    }

    // Within grace period (e.g. transient 2-second rekey)
    return {
      shouldEnterReconnecting: false,
      newUnverifiedSinceMs: unverifiedSinceMs,
    };
  }

  return {
    shouldEnterReconnecting: false,
    newUnverifiedSinceMs: unverifiedSinceMs,
  };
}

export interface ReconnectionOutcomeResult {
  nextState: ConnectionState;
  nextAttempts: number;
  errorCode?: ErrorCode;
  errorMessage?: string | null;
}

/**
 * Evaluates the outcome of a reconnection attempt when recovery completes or fails.
 */
export function evaluateReconnectionOutcome(
  isRecovered: boolean,
  currentAttempts: number,
  maxAttempts: number = RECONNECT_MAX_ATTEMPTS
): ReconnectionOutcomeResult {
  if (isRecovered) {
    return {
      nextState: "connected",
      nextAttempts: 0,
      errorCode: undefined,
      errorMessage: null,
    };
  }

  const nextAttempts = currentAttempts + 1;
  if (nextAttempts >= maxAttempts) {
    return {
      nextState: "error",
      nextAttempts,
      errorCode: "SERVER_UNAVAILABLE",
      errorMessage:
        "Connection lost and automated recovery failed. WireGuard server is unreachable.",
    };
  }

  return {
    nextState: "reconnecting",
    nextAttempts,
  };
}

/**
 * Evaluates user cancellation during reconnection or connecting.
 */
export function evaluateUserCancellation(): {
  nextState: ConnectionState;
  hasUserDisconnected: boolean;
  errorCode?: ErrorCode;
  errorMessage: null;
} {
  return {
    nextState: "disconnecting",
    hasUserDisconnected: true,
    errorCode: undefined,
    errorMessage: null,
  };
}
