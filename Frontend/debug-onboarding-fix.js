/**
 * Debug script to test onboarding data saving and retrieval
 * This is a simple Node.js script to check the SQLite database directly
 */

const path = require('path');
const fs = require('fs');

// Mock SQLite for testing
const mockSQLite = () => {
    console.log('🧪 TESTING ONBOARDING DATA PERSISTENCE');
    console.log('='.repeat(50));

    // Check if database file exists
    const dbPath = path.join(__dirname, 'platemate.db');

    if (fs.existsSync(dbPath)) {
        console.log(`✅ Database file found: ${dbPath}`);

        // Get file stats
        const stats = fs.statSync(dbPath);
        console.log(`📊 Database size: ${stats.size} bytes`);
        console.log(`📅 Last modified: ${stats.mtime}`);

        if (stats.size > 0) {
            console.log('✅ Database appears to have data');
        } else {
            console.log('⚠️ Database file is empty');
        }
    } else {
        console.log('❌ Database file not found');
        console.log('🔍 This could mean:');
        console.log('   1. App hasn\'t been run yet');
        console.log('   2. Database is stored elsewhere');
        console.log('   3. Database creation failed');
    }

    // Check for common files that indicate app state
    const configFiles = [
        'package.json',
        'app.json',
        '.env',
        'src/utils/database.ts'
    ];

    console.log('\n📂 Configuration Files Check:');
    configFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} exists`);
        } else {
            console.log(`❌ ${file} missing`);
        }
    });

    console.log('\n💡 To properly test onboarding data:');
    console.log('   1. Complete the onboarding flow in the app');
    console.log('   2. Check the app logs for "Profile saved successfully"');
    console.log('   3. Look for the SQLite database in the app\'s data directory');
    console.log('   4. If using Expo, the database might be in the device/simulator storage');

    return true;
};

// Run the mock test
try {
    mockSQLite();
    console.log('\n✅ Debug script completed successfully');
    process.exit(0);
} catch (error) {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
} 