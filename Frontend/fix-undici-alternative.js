/**
 * Alternative fix for "Body is unusable: Body has already been read" error in Expo
 * 
 * This script directly fixes the getNativeModuleVersions.js file in Expo CLI
 * by adding try/catch blocks around response.json() calls.
 * 
 * To use: node fix-undici-alternative.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Body is unusable error in Expo CLI...');

// Function to find a file in node_modules
function findFile(startPath, pattern) {
    try {
        if (!fs.existsSync(startPath)) {
            return null;
        }

        const files = fs.readdirSync(startPath);
        for (const file of files) {
            try {
                const filePath = path.join(startPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    const result = findFile(filePath, pattern);
                    if (result) return result;
                } else if (file === pattern) {
                    return filePath;
                }
            } catch (err) {
                // Skip inaccessible files
            }
        }
    } catch (err) {
        // Skip inaccessible directories
    }

    return null;
}

// Looking for the Expo CLI file that's causing the error
const nodeModulesPath = path.join(__dirname, 'node_modules');
const expoCLIPath = findFile(nodeModulesPath, 'getNativeModuleVersions.js');

if (!expoCLIPath) {
    console.error('❌ Could not find Expo CLI file. Trying pattern-based search...');

    // Try to find it using a broader search pattern
    const files = [];
    function findFilesRecursive(startDir, pattern) {
        try {
            if (!fs.existsSync(startDir)) return;

            const items = fs.readdirSync(startDir);
            for (const item of items) {
                try {
                    const itemPath = path.join(startDir, item);
                    const stat = fs.statSync(itemPath);

                    if (stat.isDirectory()) {
                        findFilesRecursive(itemPath, pattern);
                    } else if (item.includes(pattern)) {
                        files.push(itemPath);
                        if (files.length >= 5) return; // Limit to 5 results to avoid too much searching
                    }
                } catch (err) {
                    // Skip inaccessible items
                }
            }
        } catch (err) {
            // Skip inaccessible directories
        }
    }

    findFilesRecursive(path.join(nodeModulesPath, '@expo'), 'getNativeModuleVersions');

    if (files.length === 0) {
        console.error('❌ Could not find any matching files. Please try the other fix script.');
        process.exit(1);
    }

    console.log('📑 Found potential files:');
    files.forEach((file, i) => console.log(`   ${i + 1}. ${file}`));

    // Use the first found file
    console.log(`📄 Using: ${files[0]}`);
    expoCLIPath = files[0];
}

console.log(`📄 Found file to patch: ${expoCLIPath}`);

// Read the file
let content = fs.readFileSync(expoCLIPath, 'utf8');

// Check if file is already patched
if (content.includes('// PATCHED FOR BODY IS UNUSABLE ERROR')) {
    console.log('✅ File already patched.');
    process.exit(0);
}

// Look for any pattern like: const result = await response.json();
const jsonCallRegex = /(const\s+[a-zA-Z0-9_]+\s*=\s*await\s+response\.json\(\);)/g;

if (!jsonCallRegex.test(content)) {
    console.error('❌ Could not find response.json() calls in the file.');
    process.exit(1);
}

// Patch all occurrences
content = content.replace(
    jsonCallRegex,
    `// PATCHED FOR BODY IS UNUSABLE ERROR
try {
  $1
} catch (error) {
  console.warn('Error parsing response JSON, using fallback:', error.message);
  const result = { 
    expoModules: {},
    modules: {},
    sdkVersions: {} 
  };
}`
);

// Create a backup
fs.writeFileSync(`${expoCLIPath}.backup`, fs.readFileSync(expoCLIPath));
console.log(`📑 Created backup at: ${expoCLIPath}.backup`);

// Write patched file
fs.writeFileSync(expoCLIPath, content);
console.log('✅ Successfully patched Expo CLI to fix the Body is unusable error.');
console.log('\nNow try running npm start again.'); 