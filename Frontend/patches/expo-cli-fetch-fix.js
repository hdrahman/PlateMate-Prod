// Place this file in Frontend/patches directory
// This is a workaround for the "Body is unusable" error in Expo CLI

// To use this patch:
// 1. Create a 'patches' directory in your Frontend folder if it doesn't exist
// 2. Place this file in the patches directory
// 3. Install patch-package: npm install --save-dev patch-package postinstall-postinstall
// 4. Add to package.json scripts: "postinstall": "patch-package"
// 5. Run: npx patch-package @expo/cli

const fs = require('fs');
const path = require('path');

// Find the @expo/cli module path
const expoCliPath = path.resolve(__dirname, '../node_modules/@expo/cli');
const apiDir = path.join(expoCliPath, 'build/src/api');

// Check if the directory exists
if (!fs.existsSync(apiDir)) {
  console.error('Could not find @expo/cli API directory. Make sure @expo/cli is installed.');
  process.exit(1);
}

// Target file path
const targetFile = path.join(apiDir, 'getNativeModuleVersions.js');

// Check if the file exists
if (!fs.existsSync(targetFile)) {
  console.error('Could not find getNativeModuleVersions.js file.');
  process.exit(1);
}

// Read the file content
let fileContent = fs.readFileSync(targetFile, 'utf8');

// Add error handling to prevent "Body is unusable" error
// We'll wrap the response.json() call in a try/catch block
if (fileContent.includes('response.json()')) {
  console.log('Patching getNativeModuleVersions.js...');

  // Replace the problematic code with a wrapped version
  fileContent = fileContent.replace(
    /const result = await response\.json\(\);/g,
    `let result;
    try {
      result = await response.json();
    } catch (error) {
      console.warn('Error parsing response JSON, using fallback:', error.message);
      result = { 
        expoModules: {},
        modules: {},
        sdkVersions: {} 
      };
    }`
  );

  // Write the patched file
  fs.writeFileSync(targetFile, fileContent);
  console.log('Patch applied successfully!');
} else {
  console.log('The file does not contain the expected code to patch.');
} 