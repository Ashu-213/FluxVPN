import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  TunnelStatusReport,
  FormattedServiceState,
  formatNativeServiceState,
  TunnelVerificationReport,
  FormattedVerificationState,
  formatVerificationState,
  TunnelTelemetry,
} from "../types/vpn";

const FIXED_FLUX_TUNNEL_NAME = "flux";
const POLL_INTERVAL_MS = 3000;

export interface UseNativeTunnelResult {
  report: TunnelStatusReport | null;
  formattedState: FormattedServiceState;
  verificationReport: TunnelVerificationReport | null;
  formattedVerification: FormattedVerificationState;
  telemetry: TunnelTelemetry | null;
  isLoading: boolean;
  queryError: string | null;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

export function useNativeTunnel(): UseNativeTunnelResult {
  const [report, setReport] = useState<TunnelStatusReport | null>(null);
  const [verificationReport, setVerificationReport] = useState<TunnelVerificationReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Sequence and concurrency guards
  const requestSeqRef = useRef<number>(0);
  const isQueryingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const fetchStatus = useCallback(async () => {
    // Prevent overlapping queries
    if (isQueryingRef.current) return;

    isQueryingRef.current = true;
    const currentSeq = ++requestSeqRef.current;

    try {
      // Invoke native status and verification queries concurrently
      const [serviceResult, verifyResult] = await Promise.all([
        invoke<TunnelStatusReport>("get_tunnel_status", {
          tunnelName: FIXED_FLUX_TUNNEL_NAME,
        }),
        invoke<TunnelVerificationReport>("verify_tunnel_connectivity", {
          tunnelName: FIXED_FLUX_TUNNEL_NAME,
        }),
      ]);

      // Ignore stale responses if a newer request was dispatched or component unmounted
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) {
        return;
      }

      setReport(serviceResult);
      setVerificationReport(verifyResult);
      setQueryError(null);
      setLastChecked(new Date());
    } catch (err: unknown) {
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) {
        return;
      }

      const errMsg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "IPC invocation failed";

      setQueryError(errMsg);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isQueryingRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial query on mount
    fetchStatus();

    // Polling interval
    const intervalId = window.setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [fetchStatus]);

  // Derived formatted state for service
  const formattedState: FormattedServiceState = report
    ? formatNativeServiceState(report.state)
    : queryError
    ? {
        label: "QUERY FAILED",
        tone: "danger",
        isInstalled: false,
        isRunning: false,
      }
    : {
        label: "CHECKING...",
        tone: "warning",
        isInstalled: false,
        isRunning: false,
      };

  // Derived formatted state for handshake / traffic verification
  const formattedVerification: FormattedVerificationState = verificationReport
    ? formatVerificationState(verificationReport.state)
    : {
        label: "CHECKING...",
        tone: "warning",
        isVerified: false,
      };

  return {
    report,
    formattedState,
    verificationReport,
    formattedVerification,
    telemetry: verificationReport?.telemetry || null,
    isLoading,
    queryError,
    lastChecked,
    refresh: fetchStatus,
  };
}
