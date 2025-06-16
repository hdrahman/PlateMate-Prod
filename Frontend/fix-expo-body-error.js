/**
 * Direct fix for "Body is unusable: Body has already been read" error in Expo
 * 
 * This script modifies package.json to use the most effective flags
 * to prevent the error from occurring.
 * 
 * To use: node fix-expo-body-error.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying direct fix for Expo Body is unusable error...');

// Path to package.json
const packageJsonPath = path.join(__dirname, 'package.json');

// Read package.json
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (err) {
    console.error('❌ Could not read package.json:', err.message);
    process.exit(1);
}

// Create backup
fs.writeFileSync(`${packageJsonPath}.backup`, JSON.stringify(packageJson, null, 2));
console.log(`📑 Created backup at: ${packageJsonPath}.backup`);

// Check if we need to modify the start script
const hasNoFetchFlag = (packageJson.scripts?.start || '').includes('NODE_OPTIONS=--no-experimental-fetch');
const hasOfflineFlag = (packageJson.scripts?.start || '').includes('--offline');
const hasDoctorDisabled = (packageJson.scripts?.start || '').includes('EXPO_CLI_NO_DOCTOR=1');

// Only modify if needed
if (!hasNoFetchFlag || !hasOfflineFlag || !hasDoctorDisabled) {
    // Save original script for reporting
    const originalScript = packageJson.scripts?.start || '';

    // Create the new script with all the needed flags
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.start = 'cross-env NODE_OPTIONS="--no-experimental-fetch --dns-result-order=ipv4first" EXPO_CLI_NO_DOCTOR=1 expo start --offline';

    // Add back the original offline mode start script
    if (!packageJson.scripts['start-original']) {
        packageJson.scripts['start-original'] = originalScript;
    }

    // Add other useful scripts
    packageJson.scripts['start-online'] = 'cross-env NODE_OPTIONS="--no-experimental-fetch --dns-result-order=ipv4first" EXPO_CLI_NO_DOCTOR=1 expo start';

    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json scripts with fixes.');
    console.log(`\n📋 Original start script: ${originalScript}`);
    console.log(`📋 New start script: ${packageJson.scripts.start}`);
} else {
    console.log('✅ package.json already has the necessary fixes.');
}

// Create an .npmrc file with connection timeout settings
const npmrcPath = path.join(__dirname, '.npmrc');
const npmrcContent = `fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
fetch-retries=3
fetch-timeout=120000
`;

if (!fs.existsSync(npmrcPath)) {
    fs.writeFileSync(npmrcPath, npmrcContent);
    console.log('✅ Created .npmrc file with improved network settings.');
} else {
    console.log('ℹ️ .npmrc file already exists - not modifying.');
}

console.log('\n🚀 Fix applied! Try running:');
console.log('  npm start');
console.log('\nIf you still encounter issues, try:');
console.log('  1. Delete node_modules folder: rm -rf node_modules');
console.log('  2. Clear npm cache: npm cache clean --force');
console.log('  3. Reinstall dependencies: npm install');
console.log('  4. Run the patched start script: npm start'); 