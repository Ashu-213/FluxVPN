# 04 — Desktop UI Theme

## 1. Visual Principle: Obsidian & Gold Design System
The FLUX desktop interface embodies an uncompromising aesthetic of darkness and precision — adapted from the architectural language documented in `docs/DESIGN-lamborghini.md`. Absolute black (`#000000`) dominates the viewport, punctuated by surgical deployments of pure white typography and primary Gold (`#FFC000`).

**Core Tenets:**
- **Absolute Darkness as Canvas:** True black (`#000000`) without gradient wash or blue tints.
- **Architectural Rectangles:** Zero border-radius (`0px`) on all interactive buttons, cards, and input boundaries.
- **Commanding Typography:** Bold uppercase display typography with tight line-heights and disciplined letter tracking.
- **Restrained Color Economy:** Gold is reserved exclusively for the primary connection state and critical action; surfaces rely on shifting shades of charcoal and dark iron for visual depth.
- **No Decorative Gimmicks:** No neon halos, dropped shadows, bouncy scale transforms, or gradient borders. Depth is created strictly through surface layering.

---

## 2. Color Palette & Semantic Roles

| Token | Hex Value | Semantic Role |
| :--- | :--- | :--- |
| `--bg` | `#000000` | Absolute Black. Primary canvas, hero stage, and global viewport background. |
| `--surface` | `#181818` | Dark Iron. Primary container background, inactive relays, and button resting states. |
| `--surface-2` | `#202020` | Charcoal. Elevated cards, server dropdown lists, and modal bodies. |
| `--border` | `#202020` | Subtle razor divider. Structural grid borders and card boundaries. |
| `--border-light` | `rgba(255, 255, 255, 0.12)` | Active focus borders and subtle component separators. |
| `--text` | `#FFFFFF` | Pure White. Primary display headlines, active labels, and button text on dark surfaces. |
| `--text-secondary` | `#F5F5F5` | Smoke. Secondary body text and diagnostic logs. |
| `--text-muted` | `#7D7D7D` | Ash. Telemetry labels, uppercase microcopy, and inactive state indicators. |
| `--text-dim` | `#494949` | Graphite. Technical identifiers and disabled metadata. |
| `--gold` | `#FFC000` | FLUX Gold. Primary Connect CTA button fill, active state text, and live markers. |
| `--gold-hover` | `#917300` | Dark Amber. Pressed and hover state for primary gold action buttons. |
| `--gold-text` | `#FFCE3E` | Gold Text Accent. Highlighted numeric throughput rates and active server tags. |
| `--cyan` | `#29ABE2` | Informational Cyan. Network pings and telemetry status accents. |
| `--danger` | `#EF4444` | Crimson. Error headlines, failed handshakes, and Disconnect hover alerts. |
| `--focus` | `#FFC000` | Gold outline with 2px black offset for accessible keyboard focus rings. |

---

## 3. Typography Hierarchy

* **Typeface:** Inter (offline-bundled via `@fontsource/inter`), with system-ui fallbacks.
* **Capitalization:** All display titles, button labels, and system status markers use uppercase.
* **Weights:** Regular (400) for body, Bold (700) and Extrabold (800) for commanding display headlines.

| Role | Size | Weight | Tracking / Line-Height | Context |
| :--- | :--- | :--- | :--- | :--- |
| **Display Heading** | 30px–36px | 800 | `leading-none`, uppercase | Main connection status (`CONNECTED`, `DISCONNECTED`) |
| **Brand Mark** | 16px | 700 | `tracking-[0.2em]`, uppercase | Header app title (`FLUX`) |
| **Primary Action** | 14px | 700 | `tracking-[0.2em]`, uppercase | Primary CTA button label (`CONNECT`, `DISCONNECT`) |
| **Section Label** | 10px | 600 | `tracking-[0.2em]`, font-mono | Card subtitles (`RELAY ENDPOINT`, `SYSTEM STATUS`) |
| **Body / Microcopy** | 12px | 500 | `tracking-[0.15em]`, uppercase | State microcopy (`TUNNEL ACTIVE · ALL TRAFFIC ENCRYPTED`) |
| **Telemetry Value** | 12px | 700 | font-mono, uppercase | Metrics indicators (`585 KB/S`, `24 MS`, `00:04:12`) |
| **Diagnostics Monospace** | 10px | 400 | font-mono, leading-relaxed | Sanitized log viewer in diagnostics modal |

---

## 4. Spacing, Geometry & Surfaces

* **8px Grid System:** 8px, 16px, 24px, 32px, 40px, 48px, 56px.
* **Zero Border Radius (`rounded-none`):** Buttons, cards, modals, and input containers feature sharp 90° corners.
* **Depth & Elevation Layering:**
  * **Level 0 (Abyss):** `#000000` flat page background.
  * **Level 1 (Surface):** `#181818` containers and cards with `1px solid #202020` borders.
  * **Level 2 (Hover/Active):** `#202020` elevated dropdowns and button hover states.
  * **Level 3 (Overlay Backdrop):** `rgba(0, 0, 0, 0.85)` modal backdrops.
* **Dividers:** 1px solid `#202020` or `#181818`.

---

## 5. Component Interaction Specifications

### A. Primary Action Button (`ConnectButton.tsx`)
* **Dimensions:** Full width within container (max-w-xs), 56px height (exceeds WCAG 44px touch target).
* **Resting / Idle State:** Solid Gold `#FFC000` fill, Black `#000000` bold uppercase text, black square icon.
* **Hover State:** Deepens to Dark Amber `#917300`.
* **Connecting / Reconnecting State:** `#917300` background with spinning indicator and text `CONNECTING...`.
* **Connected State:** Transforms into rectangular Disconnect button in Dark Iron `#181818`, white text `#FFFFFF` with red square; on hover shifts to `#202020` with crimson text and border (`#EF4444`).

### B. Relay Endpoint Selector (`ServerCard.tsx`)
* **Resting State:** `#181818` background, 1px solid `#202020` border, showing country code box, server name, location, and latency badge.
* **Interactive State:** Expands into a sharp rectangular dropdown menu; selected item highlighted with gold text and marker `#FFC000`. Locked during active connection.

### C. Live Telemetry Strip (`MetricsBar.tsx`)
* **Layout:** 3-column sharp grid (`DURATION`, `DOWNLOAD`, `UPLOAD`).
* **Visuals:** `#181818` surface with `#202020` vertical dividers. Throughput displayed in bold monospace text with gold highlights.

### D. System Diagnostics Modal (`DiagnosticsModal.tsx`)
* **Backdrop:** `rgba(0,0,0,0.85)` without decorative blur.
* **Window:** Sharp `#181818` panel with gold header badge and zero secrets exposed.
* **Action:** Gold `COPY REPORT` button and ghost `CLOSE` button.

### E. Developer State Simulator (`StateSimulator.tsx`)
* **Placement:** Bottom-docked technical drawer.
* **Default:** Collapsed into a discreet single-line hardware-style bar.
* **Expanded:** Grid of sharp monospace trigger buttons (01 // IDLE, 02 // CONNECTING, 03 // CONNECTED, ERR // SERVER, etc.) for testing.

---

## 6. Accessibility & Motion Rules

* **Focus Indicators:** Visible high-contrast focus rings (`focus:ring-2 focus:ring-[#FFC000] focus:ring-offset-2 focus:ring-offset-[#000000]`).
* **Motion & Transitions:**
  * Strictly color and opacity transitions (150ms duration).
  * No `scale`, `translate`, or spring physics on buttons.
  * Full support for `@media (prefers-reduced-motion: reduce)` disabling all transitions and pulses.
* **Contrast:** White (`#FFFFFF`) and Gold (`#FFC000`) on `#000000` achieve contrast ratios > 14:1 (surpassing WCAG AAA requirements).

---

## 7. Responsive Behavior
* **Desktop Window Sizing:**
  * Default: 440px width × 700px height.
  * Minimum: 380px width × 600px height.
  * Resizable without clipping, horizontal scrollbars, or overlapping controls.
