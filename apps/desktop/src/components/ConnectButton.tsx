import React from "react";
import { ConnectionState } from "../types/vpn";

interface ConnectButtonProps {
  state: ConnectionState;
  onToggle: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({ state, onToggle }) => {
  const isConnected = state === "connected";
  const isBusy = state === "preparing" || state === "connecting" || state === "disconnecting";
  const isError = state === "error";

  const getButtonStyles = () => {
    if (isConnected) {
      // Disconnect state: Sophisticated dark iron with sharp white/danger border
      return "bg-[#181818] hover:bg-[#202020] text-[#FFFFFF] hover:text-[#EF4444] border border-[#202020] hover:border-[#EF4444]";
    }
    if (isBusy) {
      // Busy state: Muted gold with steady pulse
      return "bg-[#917300] text-[#000000] cursor-wait border-0";
    }
    if (isError) {
      // Error state: Gold retry button or danger border
      return "bg-[#FFC000] hover:bg-[#917300] text-[#000000] border-0";
    }
    // Default CTA: Signature Lamborghini Gold rectangle with black text
    return "bg-[#FFC000] hover:bg-[#917300] text-[#000000] border-0";
  };

  const getLabel = () => {
    switch (state) {
      case "connected":
        return "DISCONNECT";
      case "preparing":
        return "PREPARING...";
      case "connecting":
        return "CONNECTING...";
      case "reconnecting":
        return "RECONNECTING...";
      case "disconnecting":
        return "DISCONNECTING...";
      case "error":
        return "RETRY CONNECTION";
      case "disconnected":
      default:
        return "CONNECT";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-8 w-full px-6">
      <button
        onClick={onToggle}
        disabled={isBusy}
        aria-label={getLabel()}
        className={`w-full max-w-xs h-14 rounded-none flex items-center justify-center gap-3 px-8 text-sm font-bold tracking-[0.2em] uppercase transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#FFC000] focus:ring-offset-2 focus:ring-offset-[#000000] cursor-pointer ${getButtonStyles()}`}
      >
        {/* Minimal geometric indicator */}
        {isBusy ? (
          <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent animate-spin" />
        ) : isConnected ? (
          <span className="w-2 h-2 bg-[#EF4444]" />
        ) : (
          <span className="w-2 h-2 bg-black" />
        )}

        <span>{getLabel()}</span>
      </button>

      {/* Subtle context note */}
      <span className="text-[10px] font-mono tracking-widest uppercase text-[#7D7D7D] mt-3">
        {isConnected ? "TUNNEL SERVICE ACTIVE" : "WIREGUARD TUNNEL"}
      </span>
    </div>
  );
};
