<h1 align="center">Ging — QR Alarm Clock</h1>

<p align="center">
  <strong>No Snooze. No Escape. Get out of bed.</strong>
</p>

<p align="center">
  <em>Named after the Filipino word <strong>"gising"</strong> — to wake up.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Android_Studio-Ready-3DDC84?logo=android-studio&logoColor=white" alt="Android Studio" />
</p>

<p align="center">
  <img src="assets/icon.png" alt="Ging Logo" width="120" />
</p>

---

## Overview

**Ging** is an alarm clock that forces you to physically get out of bed. Unlike a normal alarm where you tap snooze, Ging **will not stop ringing** until you walk to your printed QR code and scan it with your phone's camera.

The logic is simple: **if you are already on your feet in front of the QR code, you are already awake.**

The interface follows an Apple iOS-inspired glassmorphic dark theme — clean, minimal, and consistent across every screen.

---

## How It Works

1. **Generate your wake-up code.** On first launch, Ging generates a unique QR code bound to your alarms. Download it as a PNG or a print-ready A4 PDF and stick it somewhere far from your bed — a bathroom mirror, fridge, or hallway.
2. **Set your alarm.** Pick the time with the iOS-style scroll wheel, choose the repeat days, and select an alarm sound.
3. **Wake up and scan.** When the alarm fires, it blasts sound at maximum volume. The only way to dismiss it is to walk to your QR code and hold your camera up to it. When the scanned code matches, the alarm stops.

There is no snooze button, no dismiss-on-tap, and no silent way out. The alarm rings continuously until the correct code is scanned.

---

## Features

- **QR Code Lock** — The alarm can only be dismissed by scanning the unique printed QR code tied to your account.
- **Three Alarm Sounds** — Industrial siren, Classic high-pitch beep, and Air Horn. All synthesized procedurally via the Web Audio API, so there are no audio files to ship. Each sound can be previewed before saving.
- **iOS-Style Scroll Wheel Time Picker** — A three-column snap-scrolling wheel (hour, minute, AM/PM) for setting times precisely.
- **Per-Day Scheduling** — Choose which days of the week each alarm rings (every day, weekdays, weekends, or custom).
- **Print-Ready QR Sheet** — Export your wake-up code as a PNG image or a full A4 PDF poster with setup instructions.
- **Anti-Bypass Protection (Android)** — Locks volume to maximum, displays over the lock screen and other apps, and resists Android's memory/battery killers while the alarm is active.
- **Persistent State** — All alarms, permissions, and your QR secret are saved locally on the device via a single localStorage key, so they survive app restarts.

---

## Design Language

The entire app uses a fixed **dark glassmorphic** design system inspired by iOS:

- Pure black background with ambient color glow (muted Ging orange `#FF8A42` and iOS red `#FF453A`).
- Translucent glass surfaces with heavy backdrop blur, hairline borders, and grouped list rows (like iOS Settings).
- System-first font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text"`).
- Squircle app logo (iOS `border-radius` ratio) on the splash and header.
- The theme is intentionally dark-only and does not adapt to light mode — the glow and blur effects are built around a black canvas.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework and component architecture |
| **TypeScript** | Type-safe application logic |
| **Vite 6** | Dev server and production bundler |
| **Tailwind CSS 4** | Utility-first styling (configured via `@theme` in `index.css`, no config file) |
| **Framer Motion** | Animations and transitions |
| **Capacitor 8** | Native Android wrapper (camera, audio, battery, overlay) |
| **jsQR** | Real-time QR decoding from camera frames |
| **qrcode** | QR code generation rendered to canvas |
| **jsPDF** | PDF generation for printable QR sheets |
| **Lucide React** | Icon set |
| **Web Audio API** | Procedural alarm sound synthesis (no audio files) |

A custom Capacitor plugin (`GingAndroid`) bridges to native Android capabilities that the web layer cannot reach on its own.

---

## Custom Native Plugin — GingAndroid

The app registers a custom Capacitor plugin named **GingAndroid** that exposes the following native methods:

| Method | Purpose |
|--------|---------|
| `setAlarmActive({ active })` | Locks/unlocks the Android back-button and system-exit behavior during ringing |
| `forceMaxVolume()` | Forces the system speaker volume to 100% (called on a 2.5s loop while ringing) |
| `requestOverlayPermission()` / `checkOverlayPermission()` | Request and verify "display over other apps" |
| `requestBatteryBypass()` / `checkBatteryBypass()` | Request and verify battery-optimization exemption |
| `saveBase64File({ base64Data, filename, mimeType })` | Saves a generated PNG or PDF directly to device storage |

These are implemented in the native Kotlin code under `android/app/src/main/java`.

---

## Permissions

Ging requests six permissions during onboarding, presented as an iOS Settings grouped list. Each row can be expanded for a detailed explanation.

| Key | Permission | Why it is needed |
|-----|------------|------------------|
| `camera` | Camera | Reads and decodes the QR code locally via an on-device pipeline |
| `audio` | Web Audio Autoplay | Unlocks the audio channel so the alarm sounds immediately at full volume |
| `overlay` | Display Over Other Windows | Keeps the alarm on top of the lock screen and other apps so it cannot be swiped away |
| `battery` | Ignore Battery Optimizations | Keeps Ging's scheduler running during Android deep sleep so the alarm fires on time |
| `lockscreen` | Wake Lock Screen | Wakes and illuminates the screen when the alarm fires, even when locked |
| `notification` | Foreground Service | Keeps a lightweight service alive so Android's memory cleaner does not kill the alarm |

The Continue button is disabled until all six are granted. Native permissions (overlay, battery) are re-checked automatically on app focus and on a 2.5-second polling interval.

---

## App Flow

The app is a single state machine in `App.tsx` driven by `currentView`:

```
splash  ->  permissions  ->  setup-qr  ->  dashboard  <->  ringing
   |            |               |             |
   |            |               |             +-- trigger alarm
   |            |               |
   |            |               +-- regenerate / download QR
   |            |
   |            +-- grant all 6 permissions to continue
   |
   +-- auto-advances after 3.8s, or tap Get Started
```

A scheduler in `App.tsx` evaluates active alarms every 12 seconds against the current device time and day, and transitions to `ringing` when a match is found. Once the QR scan succeeds, control returns to `dashboard`.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

### Install Dependencies
```bash
npm install
```

### Run the Development Server
```bash
npm run dev
```
The app is served at `http://localhost:3000` and is also exposed on your LAN (`--host=0.0.0.0`).

> Note: The dev server's HMR can be disabled by setting `DISABLE_HMR=true` in the environment.

### Build for Production
```bash
npm run build
```
Outputs optimized assets to the `dist/` directory.

---

## Building for Android (Android Studio)

Ging uses **Capacitor** to wrap the web build into a native Android app (`appId: com.ging.alarm`). The Android project lives in the `android/` folder.

### Step 1 — Build the web assets
```bash
npm run build
```

### Step 2 — Sync into the Android project
```bash
npx cap sync android
```
This copies the compiled `dist/` files and the Capacitor config into `android/app/src/main/assets/public`.

### Step 3 — Open in Android Studio
```bash
npx cap open android
```
Or open the `android/` folder directly in Android Studio.

### Step 4 — Run on a device or emulator
In Android Studio, click **Run** (or press `Shift + F10`) to build the APK and deploy it.

### Updating after code changes
Whenever you edit the React/TypeScript source, repeat the sync loop:

```
edit code  ->  npm run build  ->  npx cap sync android  ->  Run in Android Studio
```

> Edit source code in your preferred editor (VS Code, etc.), not in Android Studio. Android Studio is only used to compile and deploy the native build.

For a more detailed walkthrough of the Android setup, device developer mode, and troubleshooting, see [android_studio_guide.md](android_studio_guide.md).

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server on port 3000 (LAN-accessible) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript type-check with no emit (`tsc --noEmit`) |
| `npm run clean` | Remove `dist/` and generated server files |
| `npx cap sync android` | Sync web assets into the Android project |
| `npx cap open android` | Open the Android project in Android Studio |

---

## Project Structure

```
ging/
├── android/                         # Capacitor-generated native Android project
├── assets/
│   ├── icon.png                     # App icon
│   └── splash.png                   # Source splash asset
├── public/
│   └── logo.png                     # In-app logo
├── src/
│   ├── App.tsx                      # Root component, state machine, alarm scheduler, persistence
│   ├── main.tsx                     # React entry point
│   ├── index.css                    # Design system: @theme tokens, glass primitives, animations
│   ├── types.ts                     # TypeScript type definitions (Alarm, PermissionItem, AppState)
│   ├── components/
│   │   ├── Splash.tsx               # Welcome / launch screen
│   │   ├── PermissionsSetup.tsx     # iOS Settings-style permission grant flow
│   │   ├── QRCodeManager.tsx        # QR generation, PNG/PDF download, regenerate
│   │   ├── Dashboard.tsx            # Alarm list, add/edit/delete, sound + repeat picker
│   │   ├── AlarmRinger.tsx          # Ringing screen with live camera QR scanner
│   │   ├── TimeWheelPicker.tsx      # iOS-style scroll-wheel time picker (12h + AM/PM)
│   │   └── GingLogo.tsx             # Squircle logo component
│   └── utils/
│       └── audio.ts                 # Procedural alarm sound engine (Web Audio API)
├── capacitor.config.ts              # Capacitor config (appId, webDir)
├── vite.config.ts                   # Vite build config (React + Tailwind plugins)
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies and scripts
├── android_studio_guide.md          # Detailed Android Studio integration guide
└── index.html                       # HTML entry point
```

---

## State Persistence

All app state is persisted in a single localStorage entry keyed **`GING_WAKEUPS_APPSTORE_STATE`**. It stores:

- `hasCompletedOnboarding` — whether the user finished the setup flow
- `alarms` — the full list of configured alarms
- `permissions` — the six permission records and their granted state
- `userQRSecret` — the generated wake-up code string
- `lastWakeUpTime` — the date of the last successful scan

This ensures the user's alarms and QR code survive app restarts and device reboots without any backend.

---

## License

This project is licensed under the Apache 2.0 License. See individual source file headers for details.

---

<p align="center">
  <strong>Ging</strong> — <em>Gising ka kahit ayaw mo pa.</em>
</p>
