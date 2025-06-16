/**
 * Complete fix for all Expo fetch-related errors
 * Addresses both "Body is unusable" and "fetch failed" errors
 * 
 * To use: node fix-fetch-failed.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying complete fix for all Expo fetch errors...');

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

// Create backup if it doesn't exist already
const backupPath = `${packageJsonPath}.backup-original`;
if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2));
    console.log(`📑 Created backup at: ${backupPath}`);
}

// Save original script for reporting
const originalScript = packageJson.scripts?.start || '';

// Create the new script with ALL the needed flags
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts.start = 'cross-env NODE_OPTIONS="--no-experimental-fetch --dns-result-order=ipv4first" EXPO_CLI_NO_DOCTOR=1 EXPO_NO_DOCTOR=1 EXPO_OFFLINE=1 expo start --offline';

// Add variation scripts for different situations
packageJson.scripts['start-minimal'] = 'cross-env NODE_OPTIONS="--no-experimental-fetch" EXPO_CLI_NO_DOCTOR=1 expo start';
packageJson.scripts['start-online'] = 'cross-env NODE_OPTIONS="--no-experimental-fetch" EXPO_CLI_NO_DOCTOR=1 expo start';
packageJson.scripts['start-original'] = originalScript;

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json scripts with all necessary flags.');
console.log(`\n📋 Original start script: ${originalScript}`);
console.log(`📋 New start script: ${packageJson.scripts.start}`);

// Create a NODE_ENV fix file
const nodeEnvFixPath = path.join(__dirname, 'node-env-fix.js');
const nodeEnvFixContent = `// Node.js environment fix for Expo
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
`;

fs.writeFileSync(nodeEnvFixPath, nodeEnvFixContent);
console.log('✅ Created node-env-fix.js file.');

// Create an .npmrc file with network settings
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

// Look for Metro config to update
const metroConfigPath = path.join(__dirname, 'metro.config.js');
if (fs.existsSync(metroConfigPath)) {
    console.log('✅ Found metro.config.js - adding node-env-fix.js to it...');

    // Read metro config
    const metroConfig = fs.readFileSync(metroConfigPath, 'utf8');

    // Check if already modified
    if (!metroConfig.includes('node-env-fix')) {
        // Create backup
        fs.writeFileSync(`${metroConfigPath}.backup`, metroConfig);

        // Add the node-env-fix at the beginning of the file
        const updatedConfig = `// Load environment fix
require('./node-env-fix');

${metroConfig}`;

        fs.writeFileSync(metroConfigPath, updatedConfig);
        console.log('✅ Updated metro.config.js to include environment fix.');
    } else {
        console.log('ℹ️ metro.config.js already includes environment fix.');
    }
}

console.log(`
🚀 Complete fix applied! Now try:

  npm start

If you still encounter issues, try these steps in order:

  1. Delete node_modules: rm -rf node_modules
  2. Clear npm cache: npm cache clean --force
  3. Reinstall dependencies: npm install
  4. Try different start scripts if needed:
     - npm run start-minimal
     - npm run start-online

Still having problems? Check your Node.js version:
  1. Make sure you're using Node.js 16.x (if possible)
  2. Or try: nvm install 16.20.2 && nvm use 16.20.2
`); 