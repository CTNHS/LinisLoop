# LinisLoop — Camp Tinio NHS Edition (v5)

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

## Phone use
- **Quick test on the same Wi-Fi:** run the server and open the "On your phone" address it prints. Uploading with
  *Take photo* works (opens the phone camera). Live camera preview needs HTTPS.
- **Install as an app:** upload the `www` folder to any HTTPS host (Netlify drag-and-drop works), open it in Chrome,
  then menu → *Install app*.
- **Android APK (no Android Studio needed):** put this folder in a GitHub repo → **Actions** tab → *Build Android APK* → *Run workflow*.
  After ~5 min download **LinisLoop-apk** (contains `app-debug.apk`), send it to your phone and install (allow "install unknown apps").
- **Android APK (own PC):** install JDK 17 + Android Studio, then `npm install`, `npm run android:prepare`, `cd android`, `gradlew assembleDebug`.
  APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Limitations (prototype)
Data lives only in the browser on that device (no cloud sync or real multi-user). Coordinator tools are demo-only and
not secure. Clearing browser data erases everything — use **Save backup file**. Not an emergency or official
government reporting channel. Avoid faces, addresses, and other personal info in photos.


## V5 design and rewards
- Volunteer-first full-screen cleanup hero with custom beach cleanup artwork and mobile bottom navigation.
- Photo-backed cleanup reports award 10 local demo EcoPoints; reports without a photo award 2 points.
- EcoPoints are demonstration points stored locally on the device and have no cash or redeemable value.
