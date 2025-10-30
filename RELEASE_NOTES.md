# ResQLink Release Build Configuration

## Overview
This document provides comprehensive instructions for configuring and building release versions of the ResQLink app for Android and iOS platforms.

---

## Android Release Configuration

### 1. Keystore Creation

**CRITICAL**: The keystore file contains your app's signing credentials. Keep it secure and backed up. If lost, you cannot update your app on the Play Store.

#### Generate Release Keystore
```bash
# Navigate to project root
cd /path/to/ResQLink

# Create keystore directory (not tracked by git)
mkdir -p android/keystores

# Generate keystore
keytool -genkey -v \
  -keystore android/keystores/resqlink-release.keystore \
  -alias resqlink \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**What to enter when prompted:**
- **Keystore password**: Create a strong password (minimum 6 characters)
- **Key password**: Create a strong password (can be same as keystore password)
- **First and last name**: Your organization name (e.g., "ResQLink Team")
- **Organizational unit**: Your department (e.g., "Development")
- **Organization**: Your company name (e.g., "ResQLink")
- **City or Locality**: Your city
- **State or Province**: Your state
- **Country code**: Two-letter country code (e.g., "US")

**IMPORTANT**: Record these values securely:
- Keystore location: `android/keystores/resqlink-release.keystore`
- Keystore password: [SAVE SECURELY]
- Key alias: `resqlink`
- Key password: [SAVE SECURELY]

### 2. Configure Signing Credentials

Create a `local.properties` file in the `android/` directory (this file is not tracked by git):

```properties
# Android SDK location (should already exist)
sdk.dir=/Users/[YOUR_USERNAME]/Library/Android/sdk

# Release signing configuration
RESQLINK_RELEASE_STORE_FILE=keystores/resqlink-release.keystore
RESQLINK_RELEASE_STORE_PASSWORD=[YOUR_KEYSTORE_PASSWORD]
RESQLINK_RELEASE_KEY_ALIAS=resqlink
RESQLINK_RELEASE_KEY_PASSWORD=[YOUR_KEY_PASSWORD]
```

**Security Notes:**
- `local.properties` is already in `.gitignore` and will not be committed
- Never commit keystore files or passwords to version control
- Back up the keystore file and credentials to a secure location
- Consider using a password manager to store credentials

### 3. Verify Configuration

The signing configuration in `android/app/build.gradle` includes:
- **Signing Config**: References credentials from `local.properties`
- **Fallback Mechanism**: Uses debug signing if release credentials not configured
- **Code Shrinking**: Enabled with ProGuard for release builds
- **Resource Shrinking**: Enabled to reduce APK size
- **Optimization**: Uses `proguard-android-optimize.txt` for better performance

### 4. ProGuard Configuration

The `android/app/proguard-rules.pro` file includes comprehensive rules for:
- Capacitor core and plugins (Filesystem, Camera, Geolocation, etc.)
- JavaScript interface preservation for WebView
- Debugging support (line numbers, source files)
- Reflection and serialization support
- AndroidX and support libraries
- Cordova compatibility
- Optimization settings for performance

### 5. Build Release APK/AAB

#### Build APK (for testing)
```bash
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

#### Build AAB (for Play Store)
```bash
cd android
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 6. Version Management

Update version in `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 1      // Increment for each release (1, 2, 3...)
    versionName "1.0"  // User-visible version (1.0, 1.1, 2.0...)
}
```

**Version Guidelines:**
- **versionCode**: Integer that must increase with each release
- **versionName**: User-visible version string (semantic versioning recommended)
- For major releases: Increment versionName (e.g., 1.0 → 2.0)
- For minor updates: Increment versionName (e.g., 1.0 → 1.1)
- For patches: Increment versionName (e.g., 1.0.0 → 1.0.1)
- Always increment versionCode by at least 1 for each Play Store upload

---

## iOS Release Configuration

### 1. Apple Developer Account Requirements

**Prerequisites:**
- Active Apple Developer Program membership ($99/year)
- Access to Apple Developer Portal (https://developer.apple.com)
- Xcode installed on macOS (version 14.0 or later recommended)

### 2. Bundle Identifier Configuration

Verify bundle identifier in `ios/App/App/Info.plist`:
```xml
<key>CFBundleIdentifier</key>
<string>com.resqlink.mesh</string>
```

This must match your App ID in the Apple Developer Portal.

### 3. Code Signing Setup

#### Option A: Automatic Signing (Recommended for beginners)
1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the project in the navigator
3. Select the "App" target
4. Go to "Signing & Capabilities" tab
5. Check "Automatically manage signing"
6. Select your Team from the dropdown
7. Xcode will automatically create provisioning profiles

#### Option B: Manual Signing (For advanced users)
1. Create App ID in Apple Developer Portal
2. Create Distribution Certificate
3. Create Distribution Provisioning Profile
4. Download and install certificate and profile
5. Configure in Xcode "Signing & Capabilities" tab

### 4. Version Configuration

Update version in `ios/App/App/Info.plist`:
```xml
<key>CFBundleShortVersionString</key>
<string>1.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

**Version Guidelines:**
- **CFBundleShortVersionString**: User-visible version (e.g., "1.0")
- **CFBundleVersion**: Build number (must increase with each App Store submission)
- Use semantic versioning for short version
- Increment build number for each TestFlight or App Store upload

### 5. Build Release IPA

#### Using Xcode
1. Open `ios/App/App.xcworkspace` in Xcode
2. Select "Any iOS Device" or a connected device as build destination
3. Select Product → Archive
4. In Organizer, select the archive and click "Distribute App"
5. Choose distribution method (App Store Connect, Ad Hoc, Enterprise, etc.)
6. Follow wizard to export IPA

#### Using Command Line (requires proper signing setup)
```bash
# Build for release
ionic capacitor build ios

# Open in Xcode to archive
open ios/App/App.xcworkspace
```

### 6. App Store Submission Requirements

Before submitting to App Store:
- [ ] App icons configured (1024x1024px required)
- [ ] Launch screen configured
- [ ] App privacy policy URL prepared
- [ ] App Store screenshots prepared (multiple device sizes)
- [ ] App description and metadata written
- [ ] Test on physical iOS devices (required, not just simulator)
- [ ] Ensure compliance with App Store Review Guidelines

---

## Build Scripts (npm scripts)

The following scripts have been added to `package.json` for convenience:

### Android Scripts
```bash
# Build Android for development
npm run build:android

# Build release AAB for Play Store
npm run release:android

# Build release APK for testing
npm run release:android:apk
```

### iOS Scripts
```bash
# Build iOS for development (opens Xcode)
npm run build:ios

# Sync iOS after web changes
npm run sync:ios
```

### Combined Scripts
```bash
# Build web assets and sync to native platforms
npm run build

# Run dev server
npm run dev
```

---

## Deployment Checklist

### Android Deployment
- [ ] Keystore created and backed up securely
- [ ] Signing credentials configured in `local.properties`
- [ ] Version code and name updated in `build.gradle`
- [ ] ProGuard rules tested (release build works correctly)
- [ ] Release AAB built successfully
- [ ] AAB tested on physical device
- [ ] Google Play Console account set up
- [ ] App listing created with screenshots and description
- [ ] Privacy policy URL provided
- [ ] Release uploaded to Play Console

### iOS Deployment
- [ ] Apple Developer account active
- [ ] Bundle identifier configured
- [ ] Code signing configured (automatic or manual)
- [ ] Version and build number updated
- [ ] App icons and launch screen configured
- [ ] Archive built successfully in Xcode
- [ ] App tested on physical iOS devices
- [ ] App Store Connect account configured
- [ ] App listing created with screenshots and metadata
- [ ] Privacy policy URL provided
- [ ] Build uploaded to App Store Connect
- [ ] Submitted for review

---

## Security Best Practices

### Keystore Security
1. **Never commit** keystore files to version control
2. **Back up** keystore to multiple secure locations:
   - Encrypted cloud storage
   - Encrypted external drive
   - Password manager vault (for credentials)
3. **Restrict access** to keystore files and passwords
4. **Use strong passwords** for keystore and key passwords
5. **Document recovery procedures** for keystore loss scenarios

### Credential Management
1. Use `local.properties` for Android credentials (not tracked by git)
2. Use environment variables for CI/CD pipelines
3. Use secure secrets management for team collaboration
4. Rotate credentials periodically
5. Audit access to signing materials

### Build Security
1. Build releases in clean, trusted environments
2. Verify integrity of dependencies before release builds
3. Test release builds thoroughly before distribution
4. Maintain separate development and release signing keys
5. Use official distribution channels (Play Store, App Store)

---

## Troubleshooting

### Android Issues

**Problem**: Build fails with "RESQLINK_RELEASE_STORE_FILE not found"
- **Solution**: Ensure `local.properties` exists in `android/` directory with correct signing configuration

**Problem**: ProGuard causes app crashes
- **Solution**: Check logcat for ClassNotFoundException, add keep rules in `proguard-rules.pro`

**Problem**: Release build significantly larger than expected
- **Solution**: Verify `shrinkResources` and `minifyEnabled` are set to `true` in release build type

### iOS Issues

**Problem**: Code signing fails
- **Solution**: Verify Apple Developer account is active, certificate is valid, and provisioning profile matches bundle identifier

**Problem**: Archive fails to build
- **Solution**: Clean build folder (Product → Clean Build Folder) and try again

**Problem**: App crashes on device but works in simulator
- **Solution**: Check for architecture-specific issues, ensure all required frameworks are included

---

## Additional Resources

### Android
- [Android Developer - Publishing Guide](https://developer.android.com/studio/publish)
- [Google Play Console](https://play.google.com/console)
- [ProGuard Documentation](https://www.guardsquare.com/manual/home)

### iOS
- [Apple Developer - App Distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Xcode Documentation](https://developer.apple.com/documentation/xcode)

### Capacitor
- [Capacitor - Android Guide](https://capacitorjs.com/docs/android)
- [Capacitor - iOS Guide](https://capacitorjs.com/docs/ios)
- [Ionic - Publishing Guide](https://ionicframework.com/docs/publishing)

---

## Version History

### Version 1.0 (Initial Release)
- **Release Date**: TBD
- **Platform**: Android & iOS
- **Key Features**:
  - Mesh networking communication
  - Offline messaging capabilities
  - Location sharing
  - Emergency broadcasting
  - File attachment support
  - End-to-end encryption
- **SDK Versions**:
  - Android: minSdk 23, targetSdk 35
  - iOS: Minimum iOS 13.0
- **Build Configuration**: Complete release signing and optimization

---

## Maintenance Notes

### Regular Updates
1. Update dependencies quarterly for security patches
2. Monitor Android and iOS SDK updates
3. Test on new device releases and OS versions
4. Update ProGuard rules for new dependencies
5. Review App Store and Play Store policy changes

### Version Increment Strategy
- **Major version (X.0.0)**: Breaking changes, major new features
- **Minor version (x.Y.0)**: New features, non-breaking changes
- **Patch version (x.y.Z)**: Bug fixes, minor improvements

### Build Frequency
- **Development builds**: As needed for testing
- **Beta releases**: Weekly or bi-weekly to TestFlight/Play Store Beta
- **Production releases**: Monthly or as needed for critical fixes

---

**Last Updated**: December 2024
**Maintained By**: ResQLink Development Team
**Contact**: For questions about release configuration, contact the development team.
