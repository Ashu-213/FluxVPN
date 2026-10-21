import React from "react";
import { TunnelTelemetry, VpnMetrics } from "../types/vpn";

interface MetricsBarProps {
  metrics: VpnMetrics;
  telemetry?: TunnelTelemetry | null;
}

function formatDuration(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics, telemetry }) => {
  const hasRealTraffic = telemetry && (telemetry.rxBytes > 0 || telemetry.txBytes > 0);

  return (
    <div className="w-full max-w-sm mx-auto px-6 mt-4">
      <div className="grid grid-cols-3 border border-[#202020] bg-[#181818]">
        {/* Session Duration / Handshake Age */}
        <div className="flex flex-col p-3 border-r border-[#202020] text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            {telemetry?.handshakeAgeSeconds != null ? "HANDSHAKE" : "DURATION"}
          </span>
          <span className="text-xs font-mono font-bold text-[#FFFFFF] mt-1">
            {telemetry?.handshakeAgeSeconds != null
              ? `${telemetry.handshakeAgeSeconds}S AGO`
              : formatDuration(metrics.connectedDurationSec)}
          </span>
        </div>

        {/* Received / Download */}
        <div className="flex flex-col p-3 border-r border-[#202020] text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            RX TRAFFIC
          </span>
          <span className="text-xs font-mono font-bold text-[#FFCE3E] mt-1">
            {hasRealTraffic ? formatBytes(telemetry.rxBytes) : "-- (STANDBY)"}
          </span>
        </div>

        {/* Transmitted / Upload */}
        <div className="flex flex-col p-3 text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            TX TRAFFIC
          </span>
          <span className="text-xs font-mono font-bold text-[#FFFFFF] mt-1">
            {hasRealTraffic ? formatBytes(telemetry.txBytes) : "-- (STANDBY)"}
          </span>
        </div>
      </div>
    </div>
  );
};
