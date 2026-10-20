import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  TunnelStatusReport,
  FormattedServiceState,
  formatNativeServiceState,
} from "../types/vpn";

const FIXED_FLUX_TUNNEL_NAME = "flux";
const POLL_INTERVAL_MS = 3000;

export interface UseNativeTunnelResult {
  report: TunnelStatusReport | null;
  formattedState: FormattedServiceState;
  isLoading: boolean;
  queryError: string | null;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

export function useNativeTunnel(): UseNativeTunnelResult {
  const [report, setReport] = useState<TunnelStatusReport | null>(null);
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
      // Invoke Tauri command with strictly hardcoded tunnel name
      const result = await invoke<TunnelStatusReport>("get_tunnel_status", {
        tunnelName: FIXED_FLUX_TUNNEL_NAME,
      });

      // Ignore stale responses if a newer request was dispatched or component unmounted
      if (!isMountedRef.current || currentSeq !== requestSeqRef.current) {
        return;
      }

      setReport(result);
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

  // Derived formatted state
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

  return {
    report,
    formattedState,
    isLoading,
    queryError,
    lastChecked,
    refresh: fetchStatus,
  };
}
