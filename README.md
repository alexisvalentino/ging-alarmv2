<p align="center">
  <img src="public/logo.png" alt="Ging Logo" width="120" />
</p>

<h1 align="center">Ging — QR Alarm Clock</h1>

<p align="center">
  <strong>No Snooze. No Escape. Get out of bed.</strong>
</p>

<p align="center">
  <em>Named after the Filipino word <strong>"gising"</strong> (wake up)</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Android_Studio-Ready-3DDC84?logo=android-studio&logoColor=white" alt="Android Studio" />
</p>

---

## 📖 What is Ging?

**Ging** is a ruthless alarm clock app that forces you to physically get out of bed. Unlike normal alarms where you can just hit snooze, Ging **won't stop ringing** until you walk to your bathroom (or wherever you placed your printed QR code) and scan it with your phone's camera.

The idea is simple: **if you're already standing in the bathroom, you're already awake.**

### Key Features

- 🔊 **4 Aggressive Alarm Sounds** — Screaming Industrial siren, Retro Watch beep, Railway Air Horn, or a Filipino voice literally shouting at you to get up
- 📱 **QR Code Lock** — Alarm can ONLY be dismissed by scanning your unique printed QR code
- 🔥 **Wake-Up Streak Tracker** — Track consecutive days you successfully woke up on time
- 🖨️ **Print-Ready QR Sheet** — Download your QR code as PNG or a full A4 PDF poster
- 📅 **Per-Day Scheduling** — Set different alarms for different days of the week
- 🔒 **Anti-Bypass Protection** — On Android: locks volume to max, displays over lock screen, prevents app killing
- 🇵🇭 **Filipino Shouter Mode** — A Tagalog TTS voice nags you every 5 seconds until you get up

---

## 🔧 How It Works

### 1. Setup Your QR Code
When you first open Ging, it generates a unique QR code tied to your alarms. You **download and print** this QR code, then stick it somewhere far from your bed — like your bathroom mirror, fridge, or hallway.

### 2. Set Your Alarm
Configure your wake-up time, pick which days it should ring, and choose your alarm sound intensity level.

### 3. Wake Up & Scan
When the alarm fires, your phone starts blasting sound at maximum volume. The **only way to shut it off** is to:
1. Get out of bed
2. Walk to where your QR code is posted
3. Hold your phone camera up to scan it

Once the QR code matches — silence. Streak updated. ☕

### 4. Download Options
Your unique QR code can be saved in two formats:
- **PNG Image** — For quick sharing or digital backup
- **PDF A4 Sheet** — A print-ready poster with instructions, perfect for sticking on your bathroom mirror

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework & component architecture |
| **TypeScript** | Type-safe application logic |
| **Vite 6** | Lightning-fast dev server & production bundler |
| **Tailwind CSS 4** | Utility-first styling |
| **Capacitor 8** | Native Android wrapper (camera, audio, battery, overlay permissions) |
| **jsQR** | Real-time QR code scanning from camera frames |
| **qrcode** | QR code generation rendered to canvas |
| **jsPDF** | PDF generation for printable QR sheets |
| **Framer Motion** | Smooth animations and transitions |
| **Lucide React** | Crisp icon set |
| **Web Speech API** | Text-to-speech for Filipino Shouter mode |
| **Web Audio API** | Procedural alarm sound synthesis (no audio files needed) |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm (comes with Node.js)

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

### Build for Production
```bash
npm run build
```
Outputs optimized files to the `dist/` directory.

---

## 📱 Building for Android (Android Studio)

Ging uses **Capacitor** to wrap the web app into a native Android APK. Follow these steps to compile and run it on a real device or emulator.

### Step 1: Build Web Assets
```bash
npm run build
```

### Step 2: Sync to Android Project
```bash
npx cap sync
```
This copies the compiled `dist/` files into the `android/` project folder.

### Step 3: Open in Android Studio
```bash
npx cap open android
```
Or manually open the `/android` folder in Android Studio.

### Step 4: Run on Device/Emulator
In Android Studio, click **Run ▶** (or `Shift + F10`) to build the APK and deploy it.

### Updating After Code Changes
Whenever you edit your React/TypeScript source code:
```
Edit code → npm run build → npx cap sync → Run in Android Studio
```

> **Note:** Edit your source code in VS Code or your preferred editor — not in Android Studio. Android Studio is only used for compiling and deploying the native Android build.

For more detailed Android integration instructions, see [ANDROID_STUDIO_GUIDE.md](ANDROID_STUDIO_GUIDE.md).

---

## 📂 Project Structure

```
ging/
├── android/                    # Capacitor-generated Android project (open in Android Studio)
├── assets/
│   ├── icon.png                # App icon
│   ├── splash.png              # Splash screen image
│   └── ging-banner.png         # README banner
├── public/
│   └── logo.png                # In-app logo
├── src/
│   ├── App.tsx                 # Root component, state management, alarm scheduler
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles
│   ├── types.ts                # TypeScript type definitions
│   ├── components/
│   │   ├── Splash.tsx          # Splash/onboarding screen
│   │   ├── PermissionsSetup.tsx # Permission request flow
│   │   ├── QRCodeManager.tsx   # QR code generation, download (PNG/PDF)
│   │   ├── Dashboard.tsx       # Main alarm dashboard & management
│   │   ├── AlarmRinger.tsx     # Alarm ringing screen with camera QR scanner
│   │   └── GingLogo.tsx        # Logo component
│   └── utils/
│       └── audio.ts            # Audio engine (4 procedural alarm sounds + TTS)
├── capacitor.config.ts         # Capacitor configuration
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
└── ANDROID_STUDIO_GUIDE.md     # Detailed Android Studio integration guide
```

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript type-check (no emit) |
| `npx cap sync` | Sync web assets to the Android project |
| `npx cap open android` | Open the Android project in Android Studio |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the Apache 2.0 License — see individual source files for details.

---

<p align="center">
  <strong>Ging</strong> — <em>Gisising ka kahit ayaw mo pa</em> 🇵🇭
</p>
