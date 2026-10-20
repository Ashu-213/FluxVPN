# 04 — Desktop UI Theme

## Principle
**One clear connection button and one status line.** Use FLUX's own identity; do not copy another VPN's branding.

## 1. Brand
- Name: FLUX
- Voice: short and calm; no networking jargon in normal states.
- Logo: simple bridge/arch glyph that remains legible at small sizes.

## 2. Colour tokens

```css
:root {
  --bg: #0B0F14;
  --surface: #121821;
  --surface-2: #18212C;
  --border: #1F2A37;
  --text: #E6EDF3;
  --text-muted: #8B98A5;
  --accent: #2DD4BF;
  --accent-ink: #04201C;
  --warn: #F59E0B;
  --danger: #EF4444;
  --focus: #60A5FA;
}
```

Use semantic tokens rather than hard-coding colors in components. Verify contrast, including disabled and hover states. Add a light theme only after the dark theme is accessible.

## 3. Typography and spacing
- Font: Inter, fallback `system-ui`.
- Body: 16 px; labels: 14 px; captions: 12 px.
- 4 px spacing grid: 4, 8, 12, 16, 24, 32, 48.
- Inputs: 48 px minimum height.
- Prefer borders and restrained elevation over decorative shadows.
- Respect reduced-motion settings.

## 4. Main screen
- App name and settings control.
- Large Connect/Disconnect button.
- Status: Not connected / Connecting… / Connected / Reconnecting… / Error.
- Server label when available.
- Upload/download speed only if measured reliably.
- A short, actionable error message.

## 5. Other screens
- Sign-in only if accounts are required.
- Server selection only if more than one server exists.
- Devices and subscription screens only if those features are implemented.
- Diagnostics: copyable sanitized report; never include private keys or tokens.
- About: version, privacy policy, support, third-party licenses.

## 6. Windows-specific UX
- Resizable or intentionally fixed-size window with sensible minimum dimensions.
- Optional system-tray actions: Open, Connect/Disconnect, Quit.
- Clearly explain any required administrator permission or driver/service installation.
- Test startup behavior and uninstall cleanup.

## 7. macOS-specific UX
- Follow macOS window and menu conventions.
- Explain system approval required for VPN/network extension installation.
- Handle Network Extension permission or entitlement errors explicitly.
- Test menu-bar behavior only if implemented; do not imply it is available by default.

## 8. Accessibility
- Keyboard navigation and visible focus.
- Label all controls and expose state to assistive technology.
- Do not communicate status by color alone.
- Support text scaling and reduced motion.
- Minimum interactive target should be comfortable for mouse and touchpad use.

## 9. Microcopy
| State | Text |
|---|---|
| Idle | Not connected · Connect when ready |
| Connecting | Connecting… |
| Connected | Connected |
| Reconnecting | Connection interrupted · Reconnecting… |
| Permission | VPN permission is required to continue. |
| Server error | Couldn't reach the VPN server. Try again later. |
| Expired access | Your access is inactive. Check your account. |
| Tunnel error | Couldn't start the VPN. Open diagnostics for details. |
