# URL Blocker

A Chrome extension (Manifest V3) that blocks distracting sites — but only while you're in a **Pomodoro focus session**. During breaks, everything is unblocked, so you get your reward time and your deep work without manually toggling anything.

## Features

- **Pomodoro timer** with a circular countdown ring that changes color by phase (focus / short break / long break).
- **Focus-only blocking** — your blocklist is enforced via `declarativeNetRequest` during focus phases and cleared on breaks.
- **Customizable presets** — save named configurations (focus length, short/long break length, cycles before a long break), edit them in place, and switch the active preset from the timer.
- **Pause / resume** — freeze a session and pick up exactly where you left off.
- **Notifications** on every phase change, even when the popup is closed.

## How it works

The extension is event-driven and survives the MV3 service worker being terminated when idle:

- **Source of truth is `chrome.storage.local`** — blocklist, presets, and the live timer state all live there.
- The **service worker** (`src/pages/Background`) listens for `chrome.alarms` to advance phases, and re-syncs blocking rules whenever the phase or blocklist changes. Rules are applied only when `phase === 'focus'`.
- The **popup** (`src/pages/Popup`) is a thin React renderer over storage; the timer state stores absolute timestamps (`startedAt` / `endsAt`), so the countdown and ring stay correct across restarts.
- **Blocking** uses `declarativeNetRequest` dynamic rules (one per domain, `||domain^`), so Chrome enforces blocking in the network layer without the worker needing to be awake.

## Build

```bash
npm install
npm run build      # outputs to build/
```

For development with hot reload of the popup:

```bash
npm start
```

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **`build/`** folder (not the project root — the loadable manifest is generated there).
4. Pin the extension, open the popup, add a few sites under **Settings**, then hit **Start focus**.

## Tech stack

TypeScript · React 17 · Webpack · SCSS · Chrome Manifest V3 (`declarativeNetRequest`, `alarms`, `notifications`, `storage`).

## License

MIT — see [LICENSE](./LICENSE).
