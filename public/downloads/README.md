# Android APK output

After a successful Capacitor debug build, the APK is copied here as `bookly.apk`:

```bash
npm run android:build
npm run build
```

Requires JDK + Android SDK (`ANDROID_HOME` or `android/local.properties` `sdk.dir`).

When this file is present, the landing **Install on phone** CTA starts the APK download on Android (after trying the PWA install prompt). When missing, Install shows Add-to-Home-Screen steps instead.
