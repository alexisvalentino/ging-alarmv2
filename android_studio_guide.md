# Ging Android Studio Integration & Synchronization Guide

This guide describes how to run, build, and synchronize your **Ging (QR Alarm Clock Web App)** using **Android Studio** for local and production-ready Android builds.

---

## Table of Contents
1. [Understanding the Architecture](#1-understanding-the-architecture)
2. [Workflow FAQ: Where Do I Edit My Code? (React vs. Android Studio)](#2-workflow-faq-where-do-i-edit-my-code-react-vs-android-studio)
3. [Method A: Code Syncing & Building with Capacitor (Recommended)](#3-method-a-code-syncing--building-with-capacitor-recommended)
   - [Step 1: Install Capacitor](#step-1-install-capacitor)
   - [Step 2: Initialize Capacitor Configuration](#step-2-initialize-capacitor-configuration)
   - [Step 3: Build Web Assets](#step-3-build-web-assets)
   - [Step 4: Load Android Platform](#step-4-load-android-platform)
   - [Step 5: Open in Android Studio](#step-5-open-in-android-studio)
   - [Step 6: Syncing & Updating Code Changes](#step-6-syncing--updating-code-changes)
4. [Method B: Running as a Native WebView Wrapper](#4-method-b-running-as-a-native-webview-wrapper)
   - [Step 1: Create a Native Project](#step-1-create-a-native-project)
   - [Step 2: Configure WebView Code](#step-2-configure-webview-code)
   - [Step 3: Adjust AndroidManifest.xml (Internet & Host Permission)](#step-3-adjust-androidmanifestxml-internet--host-permission)
5. [Critical Mobile Fixes (Camera, Permissions & Audio Keep-Alive)](#5-critical-mobile-fixes-camera-permissions--audio-keep-alive)

---

## 1. Understanding the Architecture

**Ging** is built with React, Vite, and Tailwind CSS. Since it is a rich single-page application (SPA), Android Studio cannot directly compile its source `.tsx` files natively. Instead, you have two choices:
* **Capacitor (Recommended):** An official, modern container system that packages your compiled Vite assets (`/dist`) directly into an Android Studio Gradle app project and grants native camera and notification integrations automatically.
* **WebView Wrapper:** An Android Studio activity hosting a Web View container fetching your live hosted app deployment, or serving static files locally.

---

## 2. Workflow FAQ: Where Do I Edit My Code? (React vs. Android Studio)

### Do I edit code in the Android project or in my main JavaScript/React codebase?
**You should edit almost all of your code in your main JavaScript/React/TSX codebase** and NOT in Android Studio!

Here is why:
* **Your Web Codebase (`/src`, `/public`, `App.tsx`, etc.)** is the heart of your application. All UI layouts, alarm logic, local sound playing, and QR code scan logic are written in React and TypeScript.
* **Your Android Folder (`/android`)** is generated automatically by Capacitor. It contains Gradle build files and standard Android platform libraries to wrapper your web app into a mobile package.

### How should I set up my workspace configuration?
You should use a multi-tool workspace partitioning for the best developer experience:

1. **Keep editing React/CSS/TypeScript code in your favorite Web IDE** (such as VS Code, Cursor, or WebStorm). Do not try to edit React TSX files inside Android Studio, as it does not specialize in modern React/Vite configurations.
2. **Use Android Studio strictly to run, emulate, and package your Android app**:
   - Keep Android Studio open on your secondary screen or background.
   - Use it to launch the Android emulator or verify physical phone connections.
   - Use it to set native settings (like the launcher icon, permissions, and compilation build targets).

### I made a change in VS Code. How do I get it to show up inside Android Studio / the Emulator?
To apply changes made in your Web IDE to the Android Studio build, run these two commands in your terminal:

```bash
# 1. Compile your TSX/CSS changes into the optimized /dist bundle
npm run build

# 2. Sync those compiled assets into the Android folder automatically
npx cap sync
```

Once that finishes, you simply go back to Android Studio and press **Run 'app'** (or `Shift + F10`) to build the fresh binary and see your new changes on your emulator or physical screen!

---

## 3. Method A: Code Syncing & Building with Capacitor (Recommended)

This method seamlessly integrates your web frontend codebase with a local Gradle-based Android app inside Android Studio.

### Step 1: Install Capacitor
Open your system terminal inside your extracted project root folder and install Capacitor's command-line tools and Android platform package dependencies:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 2: Initialize Capacitor Configuration
Run the Capacitor initializer tool to set up your app identifier and web workspace details:
```bash
npx cap init "Ging Alarm Clock" "com.ging.alarm" --web-dir=dist
```
*Creates a configuration file `capacitor.config.ts` reflecting your target bundles.*

### Step 3: Build Web Assets
Before running Capacitor, compile the production React code into optimized compiled assets inside `dist/`:
```bash
npm run build
```

### Step 4: Load Android Platform
Compile and link the Capacitor wrapper to prepare the Android project:
```bash
npx cap add android
```
This auto-creates an `/android` directory configured for high-level IDE parsing.

### Step 5: Open in Android Studio
Now, trigger opening the subproject automatically inside Android Studio:
```bash
npx cap open android
```
Alternatively, launch **Android Studio**, click **"Open Project..."**, and choose the **`/android` folder** inside your project root.

---

### Step 6: Syncing & Updating Code Changes

When you modify your React file source (e.g., in `/src/App.tsx` or `/src/components/*`), follow this sync pipeline to push changes directly into your physical device or emulator running in Android Studio:

```
[1] Edit TSX Code ──> [2] npm run build ──> [3] npx cap sync ──> [4] Press Run in IDE (Shift+F10)
```

1. **Rebuild the Web App:**
   ```bash
   npm run build
   ```
2. **Sync Assets to Android Project:**
   ```bash
   npx cap sync
   ```
   *This copies the compiled files from `dist/` into the Android folder assets and maps plugin hooks.*
3. **Run or Deploy in Android Studio:**
   - In Android Studio, hit the green **Run (Play)** button, or use the menu: **Run > Run 'app'** (`Shift + F10`) to build the fresh binary and push it into your device/emulator.

---

## 4. Method B: Running as a Native WebView Wrapper

If you want a lightweight solution completely run from a standard Android activity in Kotlin/Java loading your live production build URL.

### Step 1: Create a Native Project
1. Open Android Studio, select **New Project > Empty Activity** (Kotlin/Java).
2. Set package name as `com.ging.alarm`.

### Step 2: Configure WebView Code
Replace your `MainActivity.kt` setup to host an optimized viewport pointing to your remote web URL or local assets directory:

**Kotlin (`MainActivity.kt`):**
```kotlin
package com.ging.alarm

import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        
        // Handle web camera permission dialog prompts for QR scanner
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }
        
        webView.webViewClient = WebViewClient()
        
        // POINT THIS TO YOUR SHARED WEB DEPLOYMENT URL OR LOCAL IP
        webView.loadUrl("https://ais-pre-4x2d3sivtntbbofo3rynbs-618966864552.asia-southeast1.run.app")
        
        setContentView(webView)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

### Step 3: Adjust AndroidManifest.xml (Internet & Host Permission)
Modify `app/src/main/AndroidManifest.xml` to request active permissions to read URLs and interact with camera sensors. Add these before the `<application>` tag:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
```

If you points WebView to local developmental servers (`http://192.168.x.x:3000`), add the cleartext traffic attribute to your `<application>` tag:
```xml
android:usesCleartextTraffic="true"
```

---

## 5. Critical Mobile Fixes (Camera, Permissions & Audio Keep-Alive)

Because Ging requires scanning a **QR code physical sheet** to turn off the ringing alarm sound, make sure your mobile environment accounts for these two features:

### A. Camera Permissions and Safe Fallback scan
If loading via standard WebViews, some browsers or Android models strict-block local WebRTC webcams.
* We have pre-built a **"⚡ Simulate Bathroom QR Scan (Bypass)"** button during development inside `AlarmRinger.tsx` to handle scanning bypass gracefully if device camera sensors fail to feed inside emulators or strict browser viewports. 
* To scan a real QR code on true physical hardware, make sure you accept the camera authorization popup when prompted inside the app.

### B. Audio and Awake Keeps
To keep alarms ringing reliably:
1. The app requests wake locks and handles user audios through speech-synthesis (TTS) and custom noise buffers.
2. In native Android setups, make sure your phone's battery optimization settings are disabled to prevent the system from putting the web worker process to sleep during sleep hours.
