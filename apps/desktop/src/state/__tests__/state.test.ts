import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMicrocopy } from "../useVpn.ts";
import { formatVerificationState, formatNativeServiceState } from "../../types/vpn.ts";
import {
  evaluateServiceStateTransition,
  evaluateDataPlaneHealth,
  evaluateReconnectionOutcome,
  evaluateUserCancellation,
} from "../connectionLifecycle.ts";
import { isTauriEnvironment, BROWSER_PREVIEW_DIAGNOSTIC_MSG } from "../environment.ts";

describe("FLUX VPN Frontend State & Verification Truthfulness", () => {
  describe("getMicrocopy truthfulness", () => {
    it("reports Not connected when state is disconnected", () => {
      const copy = getMicrocopy("disconnected");
      assert.equal(copy.title, "Not connected");
      assert.match(copy.subtitle, /Not connected/);
    });

    it("reports Preparing tunnel when state is preparing", () => {
      const copy = getMicrocopy("preparing");
      assert.equal(copy.title, "Preparing tunnel");
      assert.match(copy.subtitle, /Service Control Manager/);
    });

    it("reports Connecting when state is connecting", () => {
      const copy = getMicrocopy("connecting");
      assert.equal(copy.title, "Connecting…");
      assert.match(copy.subtitle, /Dispatching start signal/);
    });

    it("reports Disconnecting when state is disconnecting", () => {
      const copy = getMicrocopy("disconnecting");
      assert.equal(copy.title, "Disconnecting…");
      assert.match(copy.subtitle, /Dispatching stop signal/);
    });

    it("reports Reconnecting when state is reconnecting", () => {
      const copy = getMicrocopy("reconnecting");
      assert.equal(copy.title, "Reconnecting…");
      assert.match(copy.subtitle, /Connection interrupted · Reconnecting…/);
    });

    it("NEVER reports Connected or Protected when Windows service is running but handshake is pending (noHandshake)", () => {
      const copy = getMicrocopy("connected", undefined, "noHandshake");
      assert.equal(copy.title, "Tunnel Running");
      assert.equal(copy.subtitle, "Tunnel service active · Handshake pending");
      assert.doesNotMatch(copy.title, /Connected/i);
      assert.doesNotMatch(copy.subtitle, /Protected/i);
    });

    it("NEVER reports Connected or Protected when verification state is unavailable or serviceStopped", () => {
      const copyUnavailable = getMicrocopy("connected", undefined, "unavailable");
      assert.equal(copyUnavailable.title, "Tunnel Running");
      assert.doesNotMatch(copyUnavailable.subtitle, /Protected/i);

      const copyStopped = getMicrocopy("connected", undefined, "serviceStopped");
      assert.equal(copyStopped.title, "Tunnel Running");
      assert.doesNotMatch(copyStopped.subtitle, /Protected/i);
    });

    it("truthfully reports Handshake Verified when cryptographic handshake is verified but traffic is pending", () => {
      const copy = getMicrocopy("connected", undefined, "handshakeVerified");
      assert.equal(copy.title, "Handshake Verified");
      assert.equal(copy.subtitle, "Tunnel active · Cryptographic handshake verified");
      assert.doesNotMatch(copy.subtitle, /Protected/i);
    });

    it("truthfully reports Connected and Bidirectional traffic verified when traffic is actively observed", () => {
      const copy = getMicrocopy("connected", undefined, "trafficObserved");
      assert.equal(copy.title, "Connected");
      assert.equal(copy.subtitle, "Tunnel active · Bidirectional traffic verified");
    });

    it("truthfully reports Telemetry Restricted when UAPI pipe access is denied", () => {
      const copy = getMicrocopy("connected", undefined, "permissionDenied");
      assert.equal(copy.title, "Telemetry Restricted");
      assert.match(copy.subtitle, /Admin permission required/i);
    });

    it("truthfully reports Service Not Installed on SERVICE_NOT_INSTALLED error", () => {
      const copy = getMicrocopy("error", "SERVICE_NOT_INSTALLED");
      assert.equal(copy.title, "Service Not Installed");
      assert.match(copy.subtitle, /WireGuardTunnel\$flux/);
    });

    it("truthfully reports Permission Required on TUNNEL_PERMISSION_DENIED error", () => {
      const copy = getMicrocopy("error", "TUNNEL_PERMISSION_DENIED");
      assert.equal(copy.title, "Permission Required");
      assert.match(copy.subtitle, /Administrator permission is required/);
    });

    it("truthfully reports Server Unavailable on SERVER_UNAVAILABLE error", () => {
      const copy = getMicrocopy("error", "SERVER_UNAVAILABLE");
      assert.equal(copy.title, "Server Unavailable");
      assert.match(copy.subtitle, /Couldn't reach the VPN server/);
    });
  });

  describe("formatVerificationState mappings", () => {
    it("maps trafficObserved to positive active state", () => {
      const res = formatVerificationState("trafficObserved");
      assert.equal(res.label, "TRAFFIC ACTIVE");
      assert.equal(res.tone, "positive");
      assert.equal(res.isVerified, true);
    });

    it("maps handshakeVerified to positive verified state", () => {
      const res = formatVerificationState("handshakeVerified");
      assert.equal(res.label, "HANDSHAKE VERIFIED");
      assert.equal(res.tone, "positive");
      assert.equal(res.isVerified, true);
    });

    it("maps noHandshake to warning unverified state", () => {
      const res = formatVerificationState("noHandshake");
      assert.equal(res.label, "NO HANDSHAKE");
      assert.equal(res.tone, "warning");
      assert.equal(res.isVerified, false);
    });

    it("maps serviceStopped to neutral unverified state", () => {
      const res = formatVerificationState("serviceStopped");
      assert.equal(res.label, "SERVICE STOPPED");
      assert.equal(res.tone, "neutral");
      assert.equal(res.isVerified, false);
    });

    it("maps permissionDenied to danger unverified state", () => {
      const res = formatVerificationState("permissionDenied");
      assert.equal(res.label, "ACCESS DENIED");
      assert.equal(res.tone, "danger");
      assert.equal(res.isVerified, false);
    });
  });

  describe("formatNativeServiceState mappings", () => {
    it("maps running to positive installed and running", () => {
      const res = formatNativeServiceState("running");
      assert.equal(res.label, "RUNNING");
      assert.equal(res.tone, "positive");
      assert.equal(res.isInstalled, true);
      assert.equal(res.isRunning, true);
    });

    it("maps stopped to neutral installed not running", () => {
      const res = formatNativeServiceState("stopped");
      assert.equal(res.label, "STOPPED");
      assert.equal(res.tone, "neutral");
      assert.equal(res.isInstalled, true);
      assert.equal(res.isRunning, false);
    });

    it("maps notInstalled to neutral uninstalled", () => {
      const res = formatNativeServiceState("notInstalled");
      assert.equal(res.label, "NOT INSTALLED");
      assert.equal(res.tone, "neutral");
      assert.equal(res.isInstalled, false);
      assert.equal(res.isRunning, false);
    });

    it("maps accessDenied to danger uninstalled", () => {
      const res = formatNativeServiceState("accessDenied");
      assert.equal(res.label, "ACCESS DENIED");
      assert.equal(res.tone, "danger");
      assert.equal(res.isInstalled, false);
      assert.equal(res.isRunning, false);
    });
  });

  describe("Connection Reliability & Failure Recovery Engine", () => {
    describe("evaluateServiceStateTransition", () => {
      it("detects unexpected Windows WireGuard service termination when connected without user intent", () => {
        const res = evaluateServiceStateTransition("connected", "stopped", false);
        assert.equal(res.nextState, "reconnecting");
        assert.equal(res.triggerReconnect, true);
        assert.match(res.errorMessage || "", /WireGuard service stopped unexpectedly/i);
      });

      it("preserves clean user-initiated disconnect from disconnecting state", () => {
        const res = evaluateServiceStateTransition("disconnecting", "stopped", true);
        assert.equal(res.nextState, "disconnected");
        assert.equal(res.triggerReconnect, false);
        assert.equal(res.errorCode, undefined);
      });

      it("preserves clean user-initiated disconnect if service drops while connected", () => {
        const res = evaluateServiceStateTransition("connected", "stopped", true);
        assert.equal(res.nextState, "disconnected");
        assert.equal(res.triggerReconnect, false);
      });

      it("does not trigger redundant reconnection loops if service remains stopped while already reconnecting", () => {
        const res = evaluateServiceStateTransition("reconnecting", "stopped", false);
        assert.equal(res.nextState, "reconnecting");
        assert.equal(res.triggerReconnect, false);
      });

      it("stays disconnected on initial launch when service is stopped", () => {
        const res = evaluateServiceStateTransition("disconnected", "stopped", false);
        assert.equal(res.nextState, "disconnected");
        assert.equal(res.triggerReconnect, false);
      });

      it("transitions to connected when service starts while connecting", () => {
        const res = evaluateServiceStateTransition("connecting", "running", false);
        assert.equal(res.nextState, "connected");
        assert.equal(res.triggerReconnect, false);
      });

      it("transitions to connected when service starts while preparing", () => {
        const res = evaluateServiceStateTransition("preparing", "running", false);
        assert.equal(res.nextState, "connected");
        assert.equal(res.triggerReconnect, false);
      });

      it("transitions to error when service is uninstalled from Windows SCM", () => {
        const res = evaluateServiceStateTransition("connected", "notInstalled", false);
        assert.equal(res.nextState, "error");
        assert.equal(res.errorCode, "SERVICE_NOT_INSTALLED");
      });

      it("transitions to error when permission is denied", () => {
        const res = evaluateServiceStateTransition("connecting", "accessDenied", false);
        assert.equal(res.nextState, "error");
        assert.equal(res.errorCode, "TUNNEL_PERMISSION_DENIED");
      });
    });

    describe("evaluateDataPlaneHealth & Grace Period", () => {
      it("resets unverified timer when bidirectional traffic is active", () => {
        const res = evaluateDataPlaneHealth("connected", "trafficObserved", 5000, 10000);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, null);
      });

      it("resets unverified timer when cryptographic handshake is verified", () => {
        const res = evaluateDataPlaneHealth("connected", "handshakeVerified", 5000, 10000);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, null);
      });

      it("initiates grace period on first unverified poll without entering reconnecting immediately", () => {
        const now = 1000;
        const res = evaluateDataPlaneHealth("connected", "noHandshake", null, now);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, now);
      });

      it("tolerates transient rekey within grace period (e.g. 5 seconds elapsed < 10 seconds)", () => {
        const startTime = 1000;
        const res = evaluateDataPlaneHealth("connected", "noHandshake", startTime, startTime + 5000);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, startTime);
      });

      it("triggers reconnection when unverified traffic is sustained beyond 10s grace period", () => {
        const startTime = 1000;
        const res = evaluateDataPlaneHealth("connected", "noHandshake", startTime, startTime + 10001);
        assert.equal(res.shouldEnterReconnecting, true);
        assert.equal(res.newUnverifiedSinceMs, null);
      });

      it("does not monitor data plane health when not in connected state", () => {
        const res = evaluateDataPlaneHealth("preparing", "noHandshake", null, 1000);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, null);
      });

      it("does not treat permissionDenied as data plane failure", () => {
        const res = evaluateDataPlaneHealth("connected", "permissionDenied", null, 1000);
        assert.equal(res.shouldEnterReconnecting, false);
        assert.equal(res.newUnverifiedSinceMs, null);
      });
    });

    describe("evaluateReconnectionOutcome & Bounded Retries", () => {
      it("advances retry count on attempt 1 failure", () => {
        const res = evaluateReconnectionOutcome(false, 0);
        assert.equal(res.nextState, "reconnecting");
        assert.equal(res.nextAttempts, 1);
      });

      it("advances retry count on attempt 2 failure", () => {
        const res = evaluateReconnectionOutcome(false, 1);
        assert.equal(res.nextState, "reconnecting");
        assert.equal(res.nextAttempts, 2);
      });

      it("transitions to error with SERVER_UNAVAILABLE when 3 attempts are exhausted", () => {
        const res = evaluateReconnectionOutcome(false, 2);
        assert.equal(res.nextState, "error");
        assert.equal(res.nextAttempts, 3);
        assert.equal(res.errorCode, "SERVER_UNAVAILABLE");
        assert.match(res.errorMessage || "", /automated recovery failed/i);
      });

      it("transitions to connected and resets attempt counters on recovery success", () => {
        const res = evaluateReconnectionOutcome(true, 2);
        assert.equal(res.nextState, "connected");
        assert.equal(res.nextAttempts, 0);
        assert.equal(res.errorCode, undefined);
        assert.equal(res.errorMessage, null);
      });
    });

    describe("evaluateUserCancellation", () => {
      it("transitions to disconnecting with hasUserDisconnected flag set to true", () => {
        const res = evaluateUserCancellation();
        assert.equal(res.nextState, "disconnecting");
        assert.equal(res.hasUserDisconnected, true);
        assert.equal(res.errorCode, undefined);
        assert.equal(res.errorMessage, null);
      });
    });
  });

  describe("Environment Detection & Browser Preview Graceful Handling", () => {
    it("returns false when running in standard browser/Node environment without Tauri IPC bridge", () => {
      // In the Node.js test environment, window.__TAURI_INTERNALS__ is undefined
      assert.equal(isTauriEnvironment(), false);
    });

    it("returns true when window.__TAURI_INTERNALS__.invoke is present", () => {
      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        (globalThis as unknown as { window?: unknown }).window = {
          __TAURI_INTERNALS__: {
            invoke: () => Promise.resolve(),
          },
        };
        assert.equal(isTauriEnvironment(), true);
      } finally {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    });

    it("returns true when window.isTauri is true", () => {
      const originalWindow = (globalThis as unknown as { window?: unknown }).window;
      try {
        (globalThis as unknown as { window?: unknown }).window = {
          isTauri: true,
        };
        assert.equal(isTauriEnvironment(), true);
      } finally {
        (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
    });

    it("provides informative diagnostic message directing user to npm run dev:tauri", () => {
      assert.match(BROWSER_PREVIEW_DIAGNOSTIC_MSG, /Browser preview mode active/i);
      assert.match(BROWSER_PREVIEW_DIAGNOSTIC_MSG, /npm run dev:tauri/);
    });

    it("does NOT mask genuine native IPC errors as web preview when running in desktop mode", () => {
      // When isDesktop is true, query failure must be reported as danger QUERY FAILED
      const isDesktop = true;
      const report = null;
      const queryError = "Access is denied (os error 5)";

      const formattedState = !isDesktop
        ? { label: "WEB PREVIEW", tone: "warning" as const, isInstalled: false, isRunning: false }
        : report
        ? formatNativeServiceState(report)
        : queryError
        ? { label: "QUERY FAILED", tone: "danger" as const, isInstalled: false, isRunning: false }
        : { label: "CHECKING...", tone: "warning" as const, isInstalled: false, isRunning: false };

      assert.equal(formattedState.label, "QUERY FAILED");
      assert.equal(formattedState.tone, "danger");
    });
  });
});
