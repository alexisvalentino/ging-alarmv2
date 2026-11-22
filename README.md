# Ging v3 — QR Wake-Up Alarm

<p align="center">
  <img src="public/gingy-mascot-cutout.webp" alt="Ging's mascot" width="120" />
</p>

<p align="center"><strong>A little mascot. A very hard alarm to ignore.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor 8" />
</p>

Ging is a QR-code alarm app. To dismiss a ringing alarm, the user scans their own wake-up code, giving them a reason to get out of bed and move to where the code is placed.

## App preview

![Ging v3 wake schedule screen with the mascot](assets/dashboard-preview.png)

## What it does

- Create alarms with a time, label, sound, and repeat days.
- Generate a personal wake-up QR code and save it as an image or printable PDF.
- Scan and validate the code locally with the device camera; only an exact match to the saved code dismisses the alarm.
- Play alarm sounds with the Web Audio API.
- Schedule native local alerts for active alarms and repeat days.
- Present a guided setup flow for camera, audio, notifications, and platform-specific settings.
- Use a warm, mascot-led interface with a branded startup screen and platform app icons.

### Android alarm behavior

On Android, an exact native alert is scheduled for each enabled alarm day. Tapping it opens Ging's ringing screen. While that screen is active, Ging raises media volume to maximum, reapplies it every 2.5 seconds, blocks the hardware Back action, keeps the display awake, and attempts to return to the ringing screen if it is sent to the background. The screen has no snooze or manual dismiss action; a matching QR scan is the only in-app dismissal path. Android may still allow system-level actions such as force-stopping or powering off the device.

On iOS, Ging schedules native local alerts. Tapping an alert opens the app, where scanning the matching QR code dismisses the in-app ringer. iOS does not allow third-party apps to continuously override system volume or prevent system-level dismissal while backgrounded, so iOS alert delivery cannot enforce the Android ringing behavior.

Exact Android alerts require notification permission and the system's **Alarms & reminders** access. If either is disabled, Ging returns to setup and does not claim the alarm is scheduled. Notification alerts depend on the operating system's notification and sound settings.

These behaviors are implemented across `src/components/AlarmRinger.tsx`, `src/native/GingAndroid.ts`, `src/utils/nativeAlarmNotifications.ts`, `android/app/src/main/java/com/ging/alarm/GingAndroidPlugin.java`, and `MainActivity.java`.

## Tech stack

- React 19 and TypeScript
- Vite 6 and Tailwind CSS 4
- Motion for transitions and animation
- Capacitor 8 for the Android and iOS app shells and native bridge
- `jsQR` for QR decoding; `qrcode` and `jsPDF` for wake-up code exports
- Web Audio API for alarm sound generation

## Run locally

### Requirements

- Node.js 18 or newer and npm
- For Android builds: Android Studio/SDK and JDK 21
- For iOS builds: macOS and Xcode

### Web app

```bash
npm install
npm run dev
```

Vite serves the app at `http://localhost:3000`.

To create and preview a production web build:

```bash
npm run build
npm run preview
```

### Android

Build the web assets and sync them into Capacitor before opening Android Studio:

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

For a local debug APK from PowerShell:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/`. A release build can be created with `assembleRelease`; configure your own signing credentials locally before distributing it. Signing files and local Android configuration are ignored by Git.

### iOS

On macOS with Xcode installed, build and sync the native project:

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Configure signing in Xcode before installing on a device or distributing a build.

## Project layout

```text
assets/                 Source branding and dashboard preview
android/                Capacitor Android project and native alarm integration
ios/                    Capacitor iOS project and local notification integration
public/                 Web icons, manifest, and mascot artwork
src/App.tsx              App state, persistence, navigation, and alarm scheduling
src/components/          Onboarding, alarm list, QR setup, picker, and ringing screens
src/native/              Typed Capacitor plugin bridge
src/utils/               Audio and QR validation helpers
tests/                   QR validation checks
```

## Data and permissions

Alarm settings and the generated wake-up code are stored in the app's local storage on the device. QR scanning and comparison happen on-device. Camera access is used for scanning; Android overlay and battery settings are requested through the native bridge. No account or hosted backend is required by the app flow.

The onboarding screen tracks six setup items. Some are app checks (such as an audio playback check), while others use an operating-system prompt or Android settings page; they are not all equivalent Android runtime permissions.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Build the web app into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run the TypeScript compiler without emitting files |
| `npx cap sync android` | Sync app assets and native plugins into Android |
| `npx cap sync ios` | Sync app assets and native plugins into iOS |

## Platform assets

The repository includes a web app icon, Android launcher and splash assets, and a configured iOS app icon set. Both native platform projects are included; building iOS requires macOS and Xcode.
