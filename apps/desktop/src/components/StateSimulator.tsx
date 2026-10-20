import React, { useState } from "react";
import { ConnectionState, ErrorCode } from "../types/vpn";

interface StateSimulatorProps {
  currentState: ConnectionState;
  onSimulate: (state: ConnectionState, code?: ErrorCode, customMsg?: string) => void;
}

export const StateSimulator: React.FC<StateSimulatorProps> = ({
  currentState,
  onSimulate,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full max-w-sm mx-auto px-6 mt-auto pt-4 pb-3">
      <div className="bg-[#181818] border border-[#202020] p-2.5 rounded-none">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-[#7D7D7D] hover:text-[#FFFFFF] text-[10px] font-mono tracking-widest uppercase transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#FFC000]" />
            DEV SIMULATOR PANEL
          </span>
          <span>{expanded ? "[HIDE]" : "[TEST STATES]"}</span>
        </button>

        {expanded && (
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5 border-t border-[#202020]">
            <button
              onClick={() => onSimulate("disconnected")}
              className={`p-2 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-none ${
                currentState === "disconnected"
                  ? "bg-[#202020] text-[#FFC000] border border-[#FFC000]"
                  : "bg-[#000000] text-[#7D7D7D] hover:text-[#FFFFFF] border border-[#202020]"
              }`}
            >
              01 // IDLE
            </button>

            <button
              onClick={() => onSimulate("connecting")}
              className={`p-2 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-none ${
                currentState === "connecting"
                  ? "bg-[#202020] text-[#FFC000] border border-[#FFC000]"
                  : "bg-[#000000] text-[#7D7D7D] hover:text-[#FFFFFF] border border-[#202020]"
              }`}
            >
              02 // CONNECTING
            </button>

            <button
              onClick={() => onSimulate("connected")}
              className={`p-2 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-none ${
                currentState === "connected"
                  ? "bg-[#202020] text-[#FFC000] border border-[#FFC000]"
                  : "bg-[#000000] text-[#7D7D7D] hover:text-[#FFFFFF] border border-[#202020]"
              }`}
            >
              03 // CONNECTED
            </button>

            <button
              onClick={() => onSimulate("reconnecting")}
              className={`p-2 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-none ${
                currentState === "reconnecting"
                  ? "bg-[#202020] text-[#FFC000] border border-[#FFC000]"
                  : "bg-[#000000] text-[#7D7D7D] hover:text-[#FFFFFF] border border-[#202020]"
              }`}
            >
              04 // RECONNECT
            </button>

            <button
              onClick={() => onSimulate("error", "SERVER_UNAVAILABLE")}
              className="p-2 text-[10px] font-mono uppercase tracking-wider bg-[#000000] text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#202020] rounded-none transition-colors"
            >
              ERR // SERVER
            </button>

            <button
              onClick={() => onSimulate("error", "TUNNEL_PERMISSION_DENIED")}
              className="p-2 text-[10px] font-mono uppercase tracking-wider bg-[#000000] text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#202020] rounded-none transition-colors"
            >
              ERR // PERMISSION
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
