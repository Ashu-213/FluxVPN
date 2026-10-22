/**
 * Environment detection for FLUX VPN.
 *
 * Distinguishes between native Tauri desktop execution (where the Rust IPC bridge
 * `window.__TAURI_INTERNALS__.invoke` is present) and standard web browser/Vite preview.
 */

export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as {
    isTauri?: boolean;
    __TAURI_INTERNALS__?: { invoke?: unknown };
    __TAURI__?: unknown;
  };
  return Boolean(
    w.isTauri ||
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === "function") ||
      w.__TAURI__
  );
}

export const BROWSER_PREVIEW_DIAGNOSTIC_MSG =
  "Browser preview mode active: native Windows WireGuard controls require the Tauri desktop shell. Launch with 'npm run dev:tauri'.";
