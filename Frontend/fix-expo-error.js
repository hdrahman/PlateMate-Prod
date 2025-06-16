// Direct fix script for the "Body is unusable" error in Expo CLI
// To use: node fix-expo-error.js

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying direct fix for Expo CLI fetch error...');

// Find the getNativeModuleVersions file
function findFile(startPath, filter) {
    if (!fs.existsSync(startPath)) {
        console.log('Directory not found: ' + startPath);
        return null;
    }

    let foundPath = null;

    try {
        const files = fs.readdirSync(startPath);

        for (let file of files) {
            const filepath = path.join(startPath, file);
            const stat = fs.statSync(filepath);

            if (stat.isDirectory()) {
                const found = findFile(filepath, filter);
                if (found) return found;
            } else if (file === filter || file.includes(filter)) {
                return filepath;
            }
        }
    } catch (err) {
        // Skip permission errors
    }

    return null;
}

// Find the Expo CLI node_modules directory
const nodeModulesPath = path.resolve(__dirname, 'node_modules');
const targetFile = findFile(nodeModulesPath, 'getNativeModuleVersions.js');

if (!targetFile) {
    console.error('❌ Could not find getNativeModuleVersions.js file in node_modules.');
    console.log('Creating a workaround by disabling Expo Doctor completely...');

    // Create a new .env file with the doctor disabled flag
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    try {
        envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    } catch (err) {
        // Ignore error
    }

    // Add the environment variables if not already present
    if (!envContent.includes('EXPO_CLI_NO_DOCTOR=1')) {
        envContent += '\n# Disable Expo Doctor to fix fetch errors\nEXPO_CLI_NO_DOCTOR=1\n';
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Added EXPO_CLI_NO_DOCTOR=1 to .env file');
    }

    process.exit(0);
}

console.log(`📄 Found target file: ${targetFile}`);

// Read the file content
let fileContent = fs.readFileSync(targetFile, 'utf8');

// Check if the file has already been patched
if (fileContent.includes('// PATCHED FOR BODY IS UNUSABLE ERROR')) {
    console.log('✅ File has already been patched.');
    process.exit(0);
}

// Add error handling to prevent "Body is unusable" error
if (fileContent.includes('response.json()')) {
    console.log('🔨 Patching file to handle "Body is unusable" error...');

    // Replace the problematic code with a wrapped version
    fileContent = fileContent.replace(
        /(\s*)(const result = await response\.json\(\);)/g,
        `$1// PATCHED FOR BODY IS UNUSABLE ERROR
$1let result;
$1try {
$1  $2
$1} catch (error) {
$1  console.warn('Error parsing response JSON, using fallback:', error.message);
$1  result = { 
$1    expoModules: {},
$1    modules: {},
$1    sdkVersions: {} 
$1  };
$1}`
    );

    // Create a backup of the original file
    const backupPath = `${targetFile}.backup`;
    fs.writeFileSync(backupPath, fs.readFileSync(targetFile));
    console.log(`📑 Created backup at: ${backupPath}`);

    // Write the patched file
    fs.writeFileSync(targetFile, fileContent);
    console.log('✅ Patch applied successfully! Try running "npm start" again.');
} else {
    console.log('❌ The file does not contain the expected code to patch.');
    console.log('Adding fallback solution by disabling Expo Doctor...');

    // Create a new .env file with the doctor disabled flag
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    try {
        envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    } catch (err) {
        // Ignore error
    }

    // Add the environment variables if not already present
    if (!envContent.includes('EXPO_CLI_NO_DOCTOR=1')) {
        envContent += '\n# Disable Expo Doctor to fix fetch errors\nEXPO_CLI_NO_DOCTOR=1\n';
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Added EXPO_CLI_NO_DOCTOR=1 to .env file');
    }
} 