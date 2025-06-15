# Fix Expo Fetch Error - Node.js Version Manager Script
# This script helps fix the "TypeError: fetch failed" error in Expo CLI

Write-Host "=== PlateMate Expo Fetch Error Fix ===" -ForegroundColor Green
Write-Host ""

# Check current Node version
$currentNodeVersion = node --version
Write-Host "Current Node.js version: $currentNodeVersion" -ForegroundColor Yellow

# Check if we're using Node 18+
if ($currentNodeVersion -match "v(1[8-9]|2[0-9])\.") {
    Write-Host "❌ Node.js version $currentNodeVersion is causing the fetch error!" -ForegroundColor Red
    Write-Host "   Expo CLI has compatibility issues with Node.js 18+" -ForegroundColor Red
    Write-Host ""
    
    Write-Host "🔧 SOLUTION STEPS:" -ForegroundColor Cyan
    Write-Host "1. Install Node Version Manager (nvm-windows)" -ForegroundColor White
    Write-Host "2. Download from: https://github.com/coreybutler/nvm-windows/releases" -ForegroundColor White
    Write-Host "3. Install nvm-setup.zip and restart PowerShell" -ForegroundColor White
    Write-Host "4. Run these commands:" -ForegroundColor White
    Write-Host "   nvm install 16.20.2" -ForegroundColor Gray
    Write-Host "   nvm use 16.20.2" -ForegroundColor Gray
    Write-Host "   npm install -g @expo/cli@latest" -ForegroundColor Gray
    Write-Host "   npm start" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "📋 ALTERNATIVE SOLUTION (Current Session Only):" -ForegroundColor Cyan
    Write-Host "If you can't install nvm right now, try running:" -ForegroundColor White
    Write-Host "npm run start-offline" -ForegroundColor Gray
    Write-Host ""
    
} else {
    Write-Host "✅ Node.js version is compatible!" -ForegroundColor Green
    Write-Host "   If you're still getting fetch errors, try:" -ForegroundColor White
    Write-Host "   npm run start-offline" -ForegroundColor Gray
    Write-Host ""
}

# Check if nvm is installed
try {
    $nvmVersion = nvm version 2>$null
    if ($nvmVersion) {
        Write-Host "✅ NVM is installed: $nvmVersion" -ForegroundColor Green
        Write-Host "Available Node versions:" -ForegroundColor White
        nvm list
        Write-Host ""
        Write-Host "To switch to Node 16.20.2, run:" -ForegroundColor Cyan
        Write-Host "   nvm use 16.20.2" -ForegroundColor Gray
    }
} catch {
    Write-Host "ℹ️  NVM not installed. Download from:" -ForegroundColor Blue
    Write-Host "   https://github.com/coreybutler/nvm-windows/releases" -ForegroundColor Blue
}

Write-Host ""
Write-Host "🚀 After fixing Node version, run: npm start" -ForegroundColor Green
Write-Host "=== End of Fix Script ===" -ForegroundColor Green 