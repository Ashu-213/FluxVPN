import React from "react";
import { VpnMetrics } from "../types/vpn";

interface MetricsBarProps {
  metrics: VpnMetrics;
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

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const isReal = metrics.isRealTelemetry === true;

  return (
    <div className="w-full max-w-sm mx-auto px-6 mt-4">
      <div className="grid grid-cols-3 border border-[#202020] bg-[#181818]">
        {/* Session Duration */}
        <div className="flex flex-col p-3 border-r border-[#202020] text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            DURATION
          </span>
          <span className="text-xs font-mono font-bold text-[#FFFFFF] mt-1">
            {formatDuration(metrics.connectedDurationSec)}
          </span>
        </div>

        {/* Download Rate */}
        <div className="flex flex-col p-3 border-r border-[#202020] text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            DOWNLOAD
          </span>
          <span className="text-xs font-mono font-bold text-[#FFCE3E] mt-1">
            {isReal
              ? metrics.currentDownloadKbps > 1024
                ? `${(metrics.currentDownloadKbps / 1024).toFixed(1)} MB/S`
                : `${metrics.currentDownloadKbps} KB/S`
              : "-- (STANDBY)"}
          </span>
        </div>

        {/* Upload Rate */}
        <div className="flex flex-col p-3 text-center">
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            UPLOAD
          </span>
          <span className="text-xs font-mono font-bold text-[#FFFFFF] mt-1">
            {isReal
              ? metrics.currentUploadKbps > 1024
                ? `${(metrics.currentUploadKbps / 1024).toFixed(1)} MB/S`
                : `${metrics.currentUploadKbps} KB/S`
              : "-- (STANDBY)"}
          </span>
        </div>
      </div>
    </div>
  );
};
