# Aquachron Wash-Off Calculator: phone app

The calculator from [Disperse-AQC-Calculator](https://github.com/Isovitisgr13/Disperse-AQC-Calculator), packaged for phones.

**iPhone:** an APK is an Android file and can't be installed on an iPhone. On iPhone the calculator installs as a
web app (PWA): it gets a home-screen icon, opens full screen and works offline after the first visit.

**Android:** GitHub Actions builds an installable APK on every push.

## iPhone

1. Host the `www/` folder on any HTTPS address. GitHub Pages works; Safari only installs offline web apps from HTTPS.
2. Open that address in **Safari** on the iPhone.
3. Tap **Share** → **Add to Home Screen** → **Add**.

The "AQC Calc" icon opens the calculator full screen. Inputs are saved on the phone.

A native iPhone app (`.ipa`) would need a Mac with Xcode and a paid Apple Developer account to sign and install it.

## Android APK

1. Open the **Actions** tab → **Build Android APK** → the latest run.
2. Download **AQC-Calculator-apk** under *Artifacts* (a zip with `AQC-Calculator.apk`).
3. Copy the APK to the phone and open it. Allow "Install unknown apps" when asked.

This is a debug-signed build, which is fine for installing directly. It isn't signed for the Play Store.

## Files

| Path | What it is |
|---|---|
| `www/index.html`, `www/calc.js` | The calculator, unchanged except for the home-screen icon, manifest and safe-area tags. |
| `www/manifest.webmanifest`, `www/sw.js` | Web app manifest and offline service worker. Bump `VERSION` in `sw.js` after changing `www/`. |
| `www/icons/`, `resources/` | App icon (`resources/icon.svg` is the source). |
| `capacitor.config.json`, `package.json` | [Capacitor](https://capacitorjs.com) setup that wraps `www/` as an Android app. |
| `.github/workflows/android.yml` | Builds the APK. |
| `test/calc.test.js` | Engine checks: `npm test`. |

Build the APK locally (needs JDK 21 and the Android SDK):

```sh
npm ci
npx cap add android
npx capacitor-assets generate --android --iconBackgroundColor '#0A6A74' --splashBackgroundColor '#0A6A74'
npx cap sync android
cd android && ./gradlew assembleDebug
```
