# 🔧 Expo "TypeError: fetch failed" Fix

## Problem Description
When running `npm start` in the Frontend directory, you encounter:
```
TypeError: fetch failed
    at node:internal/deps/undici/undici:13510:13
```

## Root Cause
This error occurs because **Node.js v18+ (including v22.15.1)** uses a newer version of the undici library that has compatibility issues with Expo CLI's network requests.

## ✅ COMPLETE SOLUTION

### 1. **Immediate Fix (Recommended)**
Use Node Version Manager to switch to a compatible Node.js version:

**For Windows:**
1. Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
2. Restart PowerShell/Command Prompt as Administrator
3. Run these commands:
```powershell
nvm install 16.20.2
nvm use 16.20.2
npm install -g @expo/cli@latest
```

**For macOS/Linux:**
```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 16.20.2
nvm install 16.20.2
nvm use 16.20.2
npm install -g @expo/cli@latest
```

### 2. **Alternative Solutions**

#### Option A: Use Offline Mode
```bash
npm run start-offline
```

#### Option B: Use DNS Fix
```bash
npm run start-dev  # Now includes DNS fix
```

#### Option C: Manual Node Options
```bash
NODE_OPTIONS="--dns-result-order=ipv4first" npm start
```

## 🔧 Configuration Files Added

### `.nvmrc`
Locks Node.js version to 16.20.2 for this project.

### `package.json` Updates
- Added `engines` field specifying Node 16.x
- Updated all scripts with DNS resolution fix
- Added `start-offline` script for network issues

### `.npmrc`
Network configuration to handle DNS and connectivity issues:
- DNS IPv4 preference
- Increased fetch retries
- Better timeout handling

### `expo.json`
Additional Expo CLI configuration for network handling.

## 🚀 How to Use

1. **Run the diagnostic script:**
```powershell
cd Frontend
.\fix-expo-fetch-error.ps1
```

2. **Start the app:**
```bash
npm start
```

3. **If still having issues:**
```bash
npm run start-offline
```

## 📋 Verification

After applying the fix, you should see:
- No "TypeError: fetch failed" errors
- Expo development server starts successfully
- QR code appears for device connection

## 🛠️ Troubleshooting

### Still getting fetch errors?
1. Clear npm cache: `npm cache clean --force`
2. Delete node_modules: `rm -rf node_modules`
3. Reinstall dependencies: `npm install`
4. Try offline mode: `npm run start-offline`

### Network/Firewall Issues?
- Check if corporate firewall is blocking Expo's servers
- Try using mobile hotspot temporarily
- Use offline mode for development

### DNS Issues?
- The scripts now include `--dns-result-order=ipv4first`
- This prioritizes IPv4 over IPv6 to avoid resolution conflicts

## 🔍 Technical Details

The error occurs because:
- Node.js 18+ ships with undici library for fetch operations
- Expo CLI makes network requests to check versions and updates
- The newer undici implementation has stricter error handling
- DNS resolution conflicts between IPv4/IPv6 can cause failures

## 📈 Long-term Solution

Consider pinning Node.js version in your development environment:
1. Use `.nvmrc` file (already created)
2. Document Node version in team README
3. Consider using Docker for consistent development environment

---

**Status:** ✅ RESOLVED - Permanent fix implemented
**Last Updated:** December 2024
**Tested On:** Windows 10, Node.js v22.15.1 → v16.20.2 