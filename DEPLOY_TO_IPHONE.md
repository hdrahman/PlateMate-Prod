# Deploy PlateMate to Your iPhone - Complete Guide

## Prerequisites

### 1. Apple Developer Account
- **Free Account**: Test on your own device (7-day certificate)
- **Paid Account ($99/year)**: TestFlight distribution, App Store submission
- Sign up at: https://developer.apple.com

### 2. Required Software
- **macOS** computer (for local builds) OR **EAS Build** (cloud builds, no Mac needed)
- **Xcode** (latest version from Mac App Store) - if building locally
- **Node.js** 18+ installed
- **Expo CLI** and **EAS CLI**

### 3. Your iPhone
- **iOS 13.0+** (PlateMate supports iOS 13 and above)
- Connected to same Apple ID as developer account

---

## Option 1: Quick Deploy with EAS Build (Recommended - No Mac Needed)

### Step 1: Install EAS CLI
```bash
cd Frontend
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
# Enter your Expo account credentials
# Don't have one? Sign up at expo.dev
```

### Step 3: Configure Your Apple Account
```bash
eas device:create
# This will open a webpage to register your iPhone
# Follow the instructions to install the profile on your phone
```

### Step 4: Build for Development
```bash
# Build a development client you can install on your iPhone
eas build --profile development --platform ios

# This will:
# 1. Upload your code to Expo servers
# 2. Build the app in the cloud
# 3. Generate an .ipa file you can install
```

**Build time**: ~15-20 minutes for first build

### Step 5: Install on Your iPhone

**Method A: Install via QR Code**
1. When build completes, EAS will show a QR code
2. Open Camera app on iPhone
3. Scan the QR code
4. Tap "Install" when prompted

**Method B: Install via URL**
1. Copy the install URL from terminal
2. Open Safari on iPhone
3. Navigate to the URL
4. Tap "Install"

### Step 6: Trust the Developer Certificate
1. Go to **Settings → General → VPN & Device Management**
2. Tap your Apple ID
3. Tap "Trust [Your Name]"

### Step 7: Run the App
1. Start the dev server: `cd Frontend && npm start`
2. Open PlateMate app on your iPhone
3. It will connect to the dev server and load your code

---

## Option 2: Local Build with Xcode (Requires Mac)

### Step 1: Install Dependencies
```bash
cd Frontend
npm install
```

### Step 2: Prebuild iOS Project
```bash
npx expo prebuild --platform ios
# This creates the ios/ folder with native code
```

### Step 3: Open in Xcode
```bash
open ios/PlateMate.xcworkspace
```

### Step 4: Configure Signing
1. In Xcode, select the project in left sidebar
2. Select "PlateMate" target
3. Go to "Signing & Capabilities" tab
4. Select your **Team** (your Apple ID)
5. Xcode will automatically create a provisioning profile

### Step 5: Connect Your iPhone
1. Unlock your iPhone
2. Connect via USB cable
3. Select your iPhone in Xcode's device menu (top toolbar)

### Step 6: Build and Run
1. Press **⌘ + R** (Command + R) or click ▶️ Play button
2. Xcode will build and install the app
3. First time: Go to **Settings → General → VPN & Device Management** and trust the certificate

---

## Option 3: TestFlight (Best for Beta Testing)

### Step 1: Build for TestFlight
```bash
eas build --profile production --platform ios --auto-submit
```

### Step 2: Wait for Processing
- Build completes: ~15-20 minutes
- Apple processes the build: ~10-30 minutes
- You'll get email when ready

### Step 3: Invite Yourself as Tester
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **TestFlight** tab
4. Add yourself as internal tester
5. Accept invite on iPhone via email

### Step 4: Install via TestFlight
1. Install **TestFlight** app from App Store
2. Open TestFlight
3. Tap your app
4. Tap "Install"

---

## Testing the Minimalist Theme on iPhone

### 1. Check in Different Lighting
- **Bright sunlight**: Text should be clearly readable (white on black)
- **Dark room**: No eye strain, pure black saves battery on OLED

### 2. Verify Safe Areas
- **iPhone with notch** (12-16): Content should not overlap notch/Dynamic Island
- **Landscape mode**: iPads should handle rotation smoothly

### 3. Test Gestures
- **Swipe back**: Should work from screen edge
- **Pull to refresh**: Should feel smooth
- **Scroll**: Should be buttery smooth (60fps)

### 4. Check Performance
- Open **Settings → Developer** on iPhone
- Enable **Show FPS** overlay
- Navigate through app, should stay at 60fps

### 5. Test Dark Mode Integration
- iPhone uses light theme (`userInterfaceStyle: "light"` in app.json)
- This is intentional - PlateMate has its own dark theme
- Status bar should show light content (`barStyle="light-content"`)

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd Frontend
rm -rf node_modules
npm install
eas build --clear-cache --profile development --platform ios
```

### App Won't Install
- **Certificate expired**: Rebuild with `eas build`
- **"Untrusted Developer"**: Go to Settings → General → VPN & Device Management → Trust

### Can't Connect to Dev Server
```bash
# Make sure your iPhone and computer are on same WiFi
# Start dev server with:
npm start

# If still not working, try tunnel:
npm start -- --tunnel
```

### HealthKit Not Working
- HealthKit requires **physical device** (not simulator)
- Check **Settings → Health → Data Access & Devices → PlateMate**
- Permissions should be granted

### Camera Black Screen
- Camera requires **physical device** (not simulator)
- Check **Settings → PlateMate → Camera** permission
- Known issue: Camera needs 300ms to initialize (already fixed in code)

---

## Update the App on Your Phone

### For Development Builds
1. Make code changes
2. Save files
3. App auto-reloads via Fast Refresh
4. No rebuild needed!

### For New Native Dependencies
```bash
# If you add new npm packages that touch native code:
eas build --profile development --platform ios
# Then reinstall the new .ipa on your phone
```

### For Production Updates
```bash
# Build new version
eas build --profile production --platform ios --auto-submit
# Wait for App Store Connect processing
# TestFlight will auto-notify testers of update
```

---

## Performance Optimization for iPhone

### 1. Enable Hermes (JavaScript Engine)
Already configured in `app.json`:
```json
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```
✅ Faster startup, lower memory usage

### 2. Optimize Images
- Use `expo-image` (already in dependencies)
- Pure black backgrounds use minimal power on OLED
- White text is efficient to render

### 3. Monitor Performance
```bash
# Run with profiler
npx react-native run-ios --configuration Release
```

---

## Checklist Before First Install

- [ ] Backend is running and accessible
- [ ] `.env` file in Frontend has correct `BACKEND_URL`
- [ ] Apple Developer account is set up
- [ ] iPhone is unlocked and connected (for local builds)
- [ ] Xcode Command Line Tools installed (for local builds)
- [ ] EAS CLI installed and logged in (for cloud builds)

---

## Quick Reference Commands

```bash
# Development build (cloud)
cd Frontend
eas build --profile development --platform ios

# Development build (local)
cd Frontend
npx expo run:ios

# Production build for TestFlight
cd Frontend
eas build --profile production --platform ios --auto-submit

# Check build status
eas build:list

# View logs
eas build:view [BUILD_ID]
```

---

## Cost Breakdown

### Free Option
- ✅ Expo account (free)
- ✅ EAS builds (limited free tier)
- ✅ 7-day device testing (free Apple account)
- ❌ No TestFlight
- ❌ No App Store

### Paid Option ($99/year)
- ✅ Unlimited device testing
- ✅ TestFlight (100 testers)
- ✅ App Store distribution
- ✅ 1-year certificates

---

## Next Steps After Installation

1. **Test the theme** - Navigate through all screens
2. **Check HealthKit** - Grant step tracking permissions
3. **Test camera** - Take food photos
4. **Test offline** - Turn off WiFi, app should still work (SQLite)
5. **Submit feedback** - Use the in-app feature request system

## Support

- **Build issues**: Check [Expo docs](https://docs.expo.dev/build/setup/)
- **iOS signing**: [Apple Developer docs](https://developer.apple.com/help/)
- **Theme questions**: See `Frontend/THEME_GUIDE.md`
