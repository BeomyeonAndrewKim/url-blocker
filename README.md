# URL Blocker

A Chrome extension (Manifest V3) that blocks distracting sites. Keep an **always-blocked** list for the sites you never want to see, and a **focus-only** list that's enforced only while you're in a **Pomodoro focus session** — so you get reward time on breaks and deep work without manually toggling anything.

## Features

- **Pomodoro timer** with a circular countdown ring that changes color by phase (focus / short break / long break).
- **Two blocklists** — _Always blocked_ sites are enforced at all times (idle, focus, and breaks), while _Blocked during focus_ sites are enforced via `declarativeNetRequest` during focus phases and cleared on breaks.
- **Customizable presets** — save named configurations (focus length, short/long break length, cycles before a long break), edit them in place, and switch the active preset from the timer.
- **Pause / resume** — freeze a session and pick up exactly where you left off.
- **Notifications** on every phase change, even when the popup is closed.
- **Backup & restore** — export both blocklists and all presets to a single JSON file, and import it back by merging or overwriting.

## How it works

The extension is event-driven and survives the MV3 service worker being terminated when idle:

- **Source of truth is `chrome.storage.local`** — both blocklists, presets, and the live timer state all live there.
- The **service worker** (`src/pages/Background`) listens for `chrome.alarms` to advance phases, and re-syncs blocking rules whenever the phase or either blocklist changes. The _always-blocked_ list is applied in every phase; the _focus-only_ list is merged in (deduped) only when `phase === 'focus'`.
- The **popup** (`src/pages/Popup`) is a thin React renderer over storage; the timer state stores absolute timestamps (`startedAt` / `endsAt`), so the countdown and ring stay correct across restarts.
- **Blocking** uses `declarativeNetRequest` dynamic rules (one per domain, `||domain^`), so Chrome enforces blocking in the network layer without the worker needing to be awake.

## Backup & restore

Open the popup → **Settings** → **Backup & restore → Open ↗**. That opens a full
extension page (`backup.html`) with:

- **Export** — downloads `url-blocker-<date>.json` containing `alwaysBlocked`,
  `focusBlocked`, `presets` and `activePresetId`.
- **Import** — pick or drag in a backup file. You choose **Merge** (add to your
  current lists, skipping duplicates) or **Overwrite** (replace them), see a
  preview of what the file contains, and confirm before anything is written.

Import treats the file as untrusted input: entries are re-normalized, duplicates
and malformed presets are dropped with a warning, and a file that carries no
presets never wipes the ones you already have.

The page shows the expected shape, so a list can also be written by hand:

```json
{
  "format": "url-blocker-backup",
  "version": 1,
  "alwaysBlocked": ["reddit.com", "youtube.com/shorts"],
  "focusBlocked": ["news.ycombinator.com"],
  "presets": [
    {
      "id": "classic",
      "name": "Classic",
      "focusMinutes": 25,
      "shortBreakMinutes": 5,
      "longBreakMinutes": 15,
      "cyclesBeforeLongBreak": 4
    }
  ],
  "activePresetId": "classic"
}
```

Only `format` and `version` are required; everything else is optional.

Backup lives on its own page rather than in the popup because on macOS the
extension popup closes as soon as the OS file picker opens, which would make
importing from the popup fail silently.

## Build

Requires **Node 22.15+** (see `.nvmrc`).

```bash
nvm use
npm install
npm run build      # outputs to build/
```

Other scripts:

```bash
npm start          # watch + rebuild into build/
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (flat config)
npm run prettier   # format everything
```

`npm start` runs webpack-dev-server with `writeToDisk`, so every save lands in
`build/`. MV3 forbids remote script, so there is no HMR client — reopen the
popup to see a change, and hit **Reload** on `chrome://extensions` only when the
manifest or the service worker changed.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **`build/`** folder (not the project root — the loadable manifest is generated there).
4. Pin the extension, open the popup, and under **Settings** add sites to **Always blocked** (enforced immediately) and/or **Blocked during focus**, then hit **Start focus**.

## Tech stack

TypeScript 5 · React 19 · Webpack 5 · Dart Sass · ESLint 10 (flat config) · Chrome Manifest V3 (`declarativeNetRequest`, `alarms`, `notifications`, `storage`, `webNavigation`).

There is no Babel step: `ts-loader` compiles every source file, including the
`.tsx` entry points.

## License

MIT — see [LICENSE](./LICENSE).
