import React from "react";
import { ConnectionState, FormattedServiceState, FormattedVerificationState } from "../types/vpn";

interface StatusIndicatorProps {
  state: ConnectionState;
  title: string;
  subtitle: string;
  nativeServiceState?: FormattedServiceState;
  verificationState?: FormattedVerificationState;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  title,
  subtitle,
  nativeServiceState,
  verificationState,
}) => {
  // Truthful uppercase state headline derived from authoritative state and verification evidence
  const getStateTitle = () => {
    if (title) {
      return title.toUpperCase();
    }
    switch (state) {
      case "connected":
        return "CONNECTED";
      case "preparing":
        return "PREPARING";
      case "connecting":
        return "CONNECTING";
      case "reconnecting":
        return "RECONNECTING";
      case "disconnecting":
        return "DISCONNECTING";
      case "error":
        return "CONNECTION ERROR";
      case "disconnected":
      default:
        return "DISCONNECTED";
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "connected":
        // Distinguish between verified data plane vs pending handshake
        if (verificationState && !verificationState.isVerified) {
          return "text-[#FFCE3E]"; // Amber warning when handshake or data plane is unverified
        }
        return "text-[#FFC000]"; // Active gold when data plane is verified
      case "preparing":
      case "connecting":
      case "reconnecting":
      case "disconnecting":
        return "text-[#FFCE3E]";
      case "error":
        return "text-[#EF4444]";
      case "disconnected":
      default:
        return "text-[#7D7D7D]";
    }
  };

  const getIndicatorSquare = () => {
    switch (state) {
      case "connected":
        if (verificationState && !verificationState.isVerified) {
          return "bg-[#FFCE3E] animate-pulse";
        }
        return "bg-[#FFC000]";
      case "preparing":
      case "connecting":
      case "reconnecting":
      case "disconnecting":
        return "bg-[#FFCE3E] animate-pulse";
      case "error":
        return "bg-[#EF4444]";
      case "disconnected":
      default:
        return "bg-[#7D7D7D]";
    }
  };

  const getServiceToneSquare = (tone: string) => {
    switch (tone) {
      case "positive":
        return "bg-[#10B981]";
      case "warning":
        return "bg-[#FFCE3E] animate-pulse";
      case "danger":
        return "bg-[#EF4444]";
      case "neutral":
      default:
        return "bg-[#7D7D7D]";
    }
  };

  return (
    <div className="flex flex-col items-center text-center px-4 pt-2 pb-1">
      {/* State Badges: Session, Service, Data Plane */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#181818] border border-[#202020]">
          <span className={`w-1.5 h-1.5 ${getIndicatorSquare()}`} />
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            SESSION · {state.toUpperCase()}
          </span>
        </div>

        {nativeServiceState && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#181818] border border-[#202020]">
            <span className={`w-1.5 h-1.5 ${getServiceToneSquare(nativeServiceState.tone)}`} />
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
              SERVICE · {nativeServiceState.label}
            </span>
          </div>
        )}

        {verificationState && (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#181818] border border-[#202020]">
            <span className={`w-1.5 h-1.5 ${getServiceToneSquare(verificationState.tone)}`} />
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
              DATA PLANE · {verificationState.label}
            </span>
          </div>
        )}
      </div>

      {/* Main Status Display Headline */}
      <h1
        className={`text-3xl md:text-4xl font-extrabold tracking-tight uppercase leading-none mb-2 ${getStatusColor()}`}
      >
        {getStateTitle()}
      </h1>

      {/* Architectural Subtitle */}
      <p className="text-xs uppercase tracking-[0.15em] text-[#7D7D7D] max-w-xs transition-colors font-medium">
        {subtitle}
      </p>
    </div>
  );
};
