# Aquachron Wash-Off Calculator: phone app

The calculator from [Disperse-AQC-Calculator](https://github.com/Isovitisgr13/Disperse-AQC-Calculator), packaged for phones.

**iPhone:** GitHub Actions builds an IPA on a macOS runner on every push.

**Android:** GitHub Actions builds an installable APK on every push.

## iPhone IPA

1. Open the **Actions** tab → **Build iPhone IPA** → the latest run.
2. Download **AQC-Calculator-ipa** under *Artifacts* and unzip it to get `AQC-Calculator.ipa`.
3. Install it with [Sideloadly](https://sideloadly.io) or [AltStore](https://altstore.io) on a Windows PC or Mac:
   connect the iPhone by cable, drop in the IPA and sign in with your Apple ID. The tool signs the app for your phone.
4. On the iPhone: **Settings → General → VPN & Device Management** → trust your Apple ID.
   On iOS 16 or later also turn on **Settings → Privacy & Security → Developer Mode**.

The IPA is unsigned; Apple only lets an iPhone run apps signed for it. With a free Apple ID the signature lasts
**7 days**, then re-install (or let AltStore refresh it). A paid Apple Developer account ($99/year) gives one-year
signatures and TestFlight.

### Without a computer: home-screen web app

`www/` is also an installable web app. Host it on any HTTPS address, open it in Safari, then
**Share → Add to Home Screen**. It opens full screen, works offline and never expires.

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
| `capacitor.config.json`, `package.json` | [Capacitor](https://capacitorjs.com) setup that wraps `www/` as an iPhone and Android app. |
| `.github/workflows/ios.yml` | Builds the IPA (macOS runner). |
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
