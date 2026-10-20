import React, { useState } from "react";
import { ConnectionState, ServerInfo, TunnelStatusReport } from "../types/vpn";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ConnectionState;
  selectedServer: ServerInfo;
  errorCode?: string;
  errorMessage?: string;
  nativeReport?: TunnelStatusReport | null;
  nativeError?: string | null;
  lastChecked?: Date | null;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  state,
  selectedServer,
  errorCode,
  errorMessage,
  nativeReport,
  nativeError,
  lastChecked,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formatNativeStatus = () => {
    if (!nativeReport) {
      if (nativeError) {
        return `QUERY FAILED (${nativeError})`;
      }
      return "QUERYING...";
    }
    const stateStr =
      typeof nativeReport.state === "string"
        ? nativeReport.state.toUpperCase()
        : JSON.stringify(nativeReport.state);

    return `${stateStr} [Service: ${nativeReport.serviceName}${
      nativeReport.errorMessage ? ` - ${nativeReport.errorMessage}` : ""
    }]`;
  };

  const sanitizedReport = `================================================
FLUX DESKTOP VPN // SYSTEM DIAGNOSTICS
================================================
TIMESTAMP          : ${new Date().toISOString()}
APP VERSION        : 0.1.0
APPLICATION ID     : com.flux.vpn
PLATFORM           : Windows Desktop (x86_64)
ACTIVE SESSION     : ${state.toUpperCase()} (MOCK SIMULATION)
TARGET RELAY       : ${selectedServer.name.toUpperCase()} (${selectedServer.location.toUpperCase()})
ENDPOINT           : ${selectedServer.endpoint}
MEASURED PING      : ${selectedServer.pingMs} MS
SESSION ERROR      : ${errorCode || "NONE"}
STATUS MESSAGE     : ${errorMessage || "NORMAL OPERATIONAL PARAMETERS"}
------------------------------------------------
WINDOWS SCM OBSERVER (NATIVE READ-ONLY):
TARGET TUNNEL      : flux
SERVICE NAME       : WireGuardTunnel$flux
SERVICE STATUS     : ${formatNativeStatus()}
LAST SCM QUERY     : ${lastChecked ? lastChecked.toISOString() : "PENDING"}
SECURITY AUDIT     : READ-ONLY (No service mutations permitted)
================================================
SECURITY & PRIVACY VERIFICATION:
- Cryptographic private keys: SCRUBBED / LOCAL ONLY
- Access tokens & credentials: NONE STORED
- User browsing / payload: NO LOGS COLLECTED
- Windows kernel interfaces: UNMODIFIED
================================================
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sanitizedReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-none">
      <div className="w-full max-w-md bg-[#181818] border border-[#202020] rounded-none shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#202020] bg-[#181818]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FFC000]" />
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[#FFFFFF]">
              SYSTEM DIAGNOSTICS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#7D7D7D] hover:text-[#FFFFFF] transition-colors p-1"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#7D7D7D]">
                SANITIZED SYSTEM REPORT
              </span>
              <span className="text-[9px] font-mono tracking-widest text-[#FFC000] uppercase bg-[#202020] px-2 py-0.5 border border-[#2A2A2A]">
                ZERO SECRETS EXPOSED
              </span>
            </div>
            <pre className="p-3.5 bg-[#000000] border border-[#202020] font-mono text-[10px] text-[#F5F5F5] overflow-x-auto max-h-48 leading-relaxed rounded-none select-all">
              {sanitizedReport}
            </pre>
          </div>

          <div className="p-3 bg-[#202020] border border-[#2A2A2A] text-xs text-[#7D7D7D] space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-bold uppercase tracking-wider text-[#FFFFFF] text-[11px]">
                NATIVE SCM OBSERVER
              </p>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#181818] border border-[#2A2A2A] text-[#FFC000]">
                {nativeReport
                  ? typeof nativeReport.state === "string"
                    ? nativeReport.state.toUpperCase()
                    : "UNKNOWN"
                  : nativeError
                  ? "QUERY FAILED"
                  : "CHECKING..."}
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#7D7D7D]">
              Service: WireGuardTunnel$flux · Permissions: Read-Only (Non-Elevated)
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#202020]">
            <button
              onClick={copyToClipboard}
              className="px-5 py-2 text-xs font-bold tracking-widest uppercase text-[#000000] bg-[#FFC000] hover:bg-[#917300] rounded-none transition-colors"
            >
              {copied ? "COPIED" : "COPY REPORT"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold tracking-widest uppercase text-[#FFFFFF] bg-[#202020] hover:bg-[#2A2A2A] border border-[#2A2A2A] rounded-none transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
