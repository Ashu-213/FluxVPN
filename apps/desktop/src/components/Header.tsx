import React from "react";
import logoImg from "../assets/logo.png";

interface HeaderProps {
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDiagnostics }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-[#000000] border-b border-[#181818]">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <img
          src={logoImg}
          alt="FLUX Logo"
          className="w-7 h-7 object-contain opacity-95"
        />
        <div className="flex items-center gap-3">
          <span className="font-bold text-base tracking-[0.2em] text-[#FFFFFF] uppercase">
            FLUX
          </span>
          <span className="px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase bg-[#181818] text-[#7D7D7D] border border-[#202020]">
            SIMULATED
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDiagnostics}
          className="px-3 py-1.5 text-xs font-semibold tracking-wider uppercase text-[#7D7D7D] hover:text-[#FFFFFF] bg-transparent hover:bg-[#181818] border border-[#202020] hover:border-[#7D7D7D] transition-colors focus:outline-none focus:ring-1 focus:ring-[#FFC000]"
          title="Open Diagnostics"
        >
          Diagnostics
        </button>
      </div>
    </header>
  );
};
