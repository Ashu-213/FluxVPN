import React, { useState } from "react";
import { ServerInfo, ConnectionState } from "../types/vpn";

interface ServerCardProps {
  selectedServer: ServerInfo;
  servers: ServerInfo[];
  onSelectServer: (server: ServerInfo) => void;
  connectionState: ConnectionState;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  selectedServer,
  servers,
  onSelectServer,
  connectionState,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isLocked =
    connectionState === "connected" ||
    connectionState === "connecting" ||
    connectionState === "preparing";

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      <div className="relative">
        {/* Card Header Label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#7D7D7D]">
            RELAY ENDPOINT
          </span>
          <span className="text-[10px] font-mono uppercase text-[#7D7D7D]">
            {isLocked ? "LOCKED DURING SESSION" : "SELECT LOCATION"}
          </span>
        </div>

        {/* Selected Server Container */}
        <div
          onClick={() => !isLocked && setIsOpen(!isOpen)}
          className={`flex items-center justify-between p-4 rounded-none bg-[#181818] border border-[#202020] transition-colors ${
            isLocked
              ? "opacity-80 cursor-default"
              : "cursor-pointer hover:border-[#7D7D7D] hover:bg-[#202020]"
          }`}
        >
          <div className="flex items-center gap-3.5">
            {/* Country Code Sharp Block */}
            <div className="w-8 h-8 rounded-none bg-[#202020] border border-[#2A2A2A] flex items-center justify-center font-mono font-bold text-xs text-[#FFC000]">
              {selectedServer.countryCode}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-wider uppercase text-[#FFFFFF]">
                {selectedServer.name}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-[#7D7D7D]">
                {selectedServer.location}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#7D7D7D] bg-[#202020] px-2 py-0.5 border border-[#2A2A2A]">
              {selectedServer.pingMs} MS
            </span>

            {!isLocked && (
              <svg
                className={`w-3.5 h-3.5 text-[#7D7D7D] transition-transform duration-150 ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && !isLocked && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-[#181818] border border-[#202020] rounded-none shadow-2xl">
            {servers.map((s) => {
              const isSelected = s.id === selectedServer.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectServer(s);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-3.5 border-b border-[#202020] last:border-b-0 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#202020] text-[#FFC000]"
                      : "hover:bg-[#202020] text-[#FFFFFF]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isSelected ? "text-[#FFC000]" : "text-[#7D7D7D]"
                      }`}
                    >
                      {s.countryCode}
                    </span>
                    <div className="text-left">
                      <p className="text-xs font-bold uppercase tracking-wider">
                        {s.name}
                      </p>
                      <p className="text-[10px] uppercase text-[#7D7D7D]">
                        {s.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#7D7D7D]">
                      {s.pingMs} MS
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 bg-[#FFC000]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
