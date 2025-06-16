/**
 * Direct fix for "Body is unusable: Body has already been read" error in Expo
 * 
 * This script patches the undici module by creating a wrapper around Response.json()
 * to cache the result and avoid the error.
 * 
 * To use: node fix-undici-body-error.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Body is unusable error in Expo...');

// Function to find a file in node_modules
function findFile(startPath, pattern) {
    if (!fs.existsSync(startPath)) {
        return null;
    }

    const files = fs.readdirSync(startPath);
    for (const file of files) {
        const filePath = path.join(startPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            const result = findFile(filePath, pattern);
            if (result) return result;
        } else if (file === pattern || file.includes(pattern)) {
            return filePath;
        }
    }

    return null;
}

// Looking for undici's response.js file which handles Response.json()
const nodeModulesPath = path.join(__dirname, 'node_modules');
const undiciResponseFile = findFile(nodeModulesPath, 'response.js');

if (!undiciResponseFile) {
    console.error('❌ Could not find undici Response file. Make sure undici is installed.');
    process.exit(1);
}

console.log(`📄 Found undici Response file: ${undiciResponseFile}`);

// Read the file
let content = fs.readFileSync(undiciResponseFile, 'utf8');

// Check if file is already patched
if (content.includes('// PATCHED FOR BODY IS UNUSABLE ERROR')) {
    console.log('✅ File already patched.');
    process.exit(0);
}

// Find the JSON method in the file
const jsonMethodRegex = /(json\s*\([^\)]*\)\s*{[\s\S]*?)(return parseJSONFromBytes)/;

if (!jsonMethodRegex.test(content)) {
    console.error('❌ Could not find json method in the file.');
    process.exit(1);
}

// Patch the file by adding a cache for the JSON result
content = content.replace(
    jsonMethodRegex,
    `$1// PATCHED FOR BODY IS UNUSABLE ERROR
  if (this._jsonCache) {
    return this._jsonCache;
  }
  this._jsonCache = $2`
);

// Create a backup
fs.writeFileSync(`${undiciResponseFile}.backup`, fs.readFileSync(undiciResponseFile));
console.log(`📑 Created backup at: ${undiciResponseFile}.backup`);

// Write patched file
fs.writeFileSync(undiciResponseFile, content);
console.log('✅ Successfully patched undici to fix the Body is unusable error.');
console.log('\nNow try running npm start again.'); 