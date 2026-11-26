# LinisLoop — Camp Tinio NHS Edition (v3)

**Small Actions. Cleaner Communities.** A mobile-first community waste reporting and cleanup app.

## Run it (easiest)
1. Install Node.js LTS from https://nodejs.org (one time).
2. **Windows:** double-click `start.bat`  ·  **Mac/Linux:** run `./start.sh`  ·  or run `npm start`.
3. Open **http://localhost:8080**. No `npm install` is needed.

You can also just double-click `www/index.html`. Everything works that way except the live in-app
camera preview and installing as an app (browsers require `localhost` or HTTPS for those); the
**Take photo** button then opens your device's own camera app instead.

## What's new
- **New login**: Sign in / Create account / Continue as guest, show-password toggle, validation messages.
  Accounts are stored on the device only; passwords are salted + SHA-256 hashed (classroom-grade, not server security).
- **Camera & photo reports**: *Take photo* (live camera with front/back switch), *Upload photo*, optional GPS pin,
  photo preview, tap a report photo to enlarge. Photos are auto-resized (max 1280 px) so they stay small.
- **Local saving**: reports, events, accounts and points persist across reloads (localStorage). Photos are saved in
  IndexedDB. Profile → **Save backup file / Restore backup** exports/imports everything including photos.
- **Offline**: installable PWA with offline fallback (service worker).
- **Bug fixes**: "Report" buttons pointed at a non-existent page; the home banner photo was hotlinked from the web and
  broke offline (now a bundled illustration); the 1.2 MB photo limit blocked normal phone photos; reports were tied to
  the editable display name (now tied to the account); volunteer counter was wrong; the welcome banner showed on every
  tab; quiz expanded to 4 questions with points; Capacitor was packaging `node_modules` (now uses `www/` only).

## Project layout
```
www/            the app (index.html, app.js, styles.css, sw.js, manifest, assets/)
server.js       tiny local web server (no dependencies)
start.bat/.sh   one-click launchers
capacitor.config.json, package.json   optional Android packaging
```

## Android APK (manual installation)

The project is configured to build a **debug APK** for direct installation on Android phones. This is not a Play Store release, but it can be installed manually.

### Build the APK with GitHub Actions (recommended)

This method does not require Android Studio on your computer.

1. Create a GitHub repository and upload the complete contents of this `LinisLoop` project folder (keep the `.github/workflows/build-apk.yml` file).
2. Open the repository on GitHub and select **Actions**. If prompted, enable GitHub Actions for the repository.
3. Select **Build LinisLoop Android APK** in the workflow list.
4. Tap **Run workflow** and confirm **Run workflow**.
5. Wait for the run to finish with a green check mark. Open that run and find **Artifacts** near the bottom.
6. Download **LinisLoop-Android-APK**. It contains `LinisLoop-v3-debug.apk`.
7. Send the APK to your Android phone (or download it directly on the phone), open it, and follow Android's prompt to allow installation from that source.
8. Tap **Install**, then open **LinisLoop** from your app drawer.

The workflow also runs automatically whenever you push changes to the `main` or `master` branch. Each uploaded artifact is kept for 30 days.

### Build locally (requires Android development tools)

1. Install Node.js 20 or newer and Android Studio with the Android SDK.
2. Install JDK 17.
3. In this project folder, run `npm install`.
4. Run `npm run android:prepare` to generate and sync the native Android project.
5. Run `cd android` then `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).
6. The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

### Installable website (optional PWA)

Upload the `www` folder to an HTTPS host, open the site in Chrome on Android, then use Chrome's menu → **Install app** (the wording may vary). This installs the web app; it is separate from the manually installable APK above.

## Limitations (prototype)
Data lives only in the browser on that device (no cloud sync or real multi-user). Coordinator tools are demo-only and
not secure. Clearing browser data erases everything — use **Save backup file**. Not an emergency or official
government reporting channel. Avoid faces, addresses, and other personal info in photos.
