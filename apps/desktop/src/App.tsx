import React, { useState } from "react";
import { Header } from "./components/Header";
import { StatusIndicator } from "./components/StatusIndicator";
import { ConnectButton } from "./components/ConnectButton";
import { ServerCard } from "./components/ServerCard";
import { MetricsBar } from "./components/MetricsBar";
import { DiagnosticsModal } from "./components/DiagnosticsModal";
import { StateSimulator } from "./components/StateSimulator";
import { useVpn } from "./state/useVpn";
import { useNativeTunnel } from "./state/useNativeTunnel";

export const App: React.FC = () => {
  const {
    state,
    title,
    subtitle,
    selectedServer,
    setSelectedServer,
    servers,
    metrics,
    errorCode,
    errorMessage,
    toggleConnection,
    simulateState,
  } = useVpn();

  const {
    report: nativeReport,
    formattedState,
    queryError,
    lastChecked,
  } = useNativeTunnel();

  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-[#FFFFFF] select-none overflow-hidden font-sans">
      {/* Minimal Top Header */}
      <Header onOpenDiagnostics={() => setIsDiagnosticsOpen(true)} />

      {/* Live Windows Service Observer Bar */}
      <div className="bg-[#181818] border-b border-[#202020] px-4 py-1.5 flex items-center justify-between text-[9px] font-mono tracking-wider">
        <div className="flex items-center gap-2">
          <span className="text-[#7D7D7D] uppercase">WIN SERVICE:</span>
          <span className="text-[#A0A0A0] font-semibold">WireGuardTunnel$flux</span>
          <span className="text-[#333333]">|</span>
          <span
            className={`px-1.5 py-0.5 border uppercase font-bold text-[9px] ${
              formattedState.tone === "positive"
                ? "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30"
                : formattedState.tone === "warning"
                ? "text-[#FFCE3E] bg-[#FFCE3E]/10 border-[#FFCE3E]/30"
                : formattedState.tone === "danger"
                ? "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30"
                : "text-[#7D7D7D] bg-[#202020] border-[#2A2A2A]"
            }`}
          >
            {formattedState.label}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[#7D7D7D]">
          <span>OBSERVER: READ-ONLY</span>
          <span className="w-1 h-1 bg-[#FFC000] inline-block rounded-none animate-pulse" />
        </div>
      </div>

      {/* Main VPN Dashboard Stage */}
      <main className="flex-1 flex flex-col items-center justify-between py-6 overflow-y-auto">
        <div className="w-full flex flex-col items-center">
          {/* Status Headline and Microcopy */}
          <StatusIndicator
            state={state}
            title={title}
            subtitle={subtitle}
            nativeServiceState={formattedState}
          />

          {/* Primary Action Button */}
          <ConnectButton
            state={state}
            onToggle={toggleConnection}
          />

          {/* Server Selection Panel */}
          <ServerCard
            selectedServer={selectedServer}
            servers={servers}
            onSelectServer={setSelectedServer}
            connectionState={state}
          />

          {/* Live Session Metrics (Displayed when Connected) */}
          {state === "connected" && <MetricsBar metrics={metrics} />}
        </div>

        {/* Developer State Testing Panel (Tucked at bottom) */}
        <StateSimulator
          currentState={state}
          onSimulate={simulateState}
        />
      </main>

      {/* System Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        state={state}
        selectedServer={selectedServer}
        errorCode={errorCode}
        errorMessage={errorMessage}
        nativeReport={nativeReport}
        nativeError={queryError}
        lastChecked={lastChecked}
      />
    </div>
  );
};

export default App;
