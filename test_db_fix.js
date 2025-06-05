// Test script to verify database locking fixes
// Run this in your project directory after the changes

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking database configuration fixes...\n');

// Check if the database initialization includes the new PRAGMA settings
const databaseFile = path.join(__dirname, 'Frontend/src/utils/database.ts');

if (fs.existsSync(databaseFile)) {
    const content = fs.readFileSync(databaseFile, 'utf8');

    console.log('✅ Checking database.ts file...');

    const checks = [
        { setting: 'PRAGMA journal_mode = WAL', found: content.includes('PRAGMA journal_mode = WAL') },
        { setting: 'PRAGMA busy_timeout = 30000', found: content.includes('PRAGMA busy_timeout = 30000') },
        { setting: 'PRAGMA synchronous = NORMAL', found: content.includes('PRAGMA synchronous = NORMAL') },
        { setting: 'BEGIN IMMEDIATE TRANSACTION', found: content.includes('BEGIN IMMEDIATE TRANSACTION') }
    ];

    checks.forEach(check => {
        console.log(`${check.found ? '✅' : '❌'} ${check.setting}: ${check.found ? 'FOUND' : 'MISSING'}`);
    });

    console.log('\n📋 Summary:');
    const passedChecks = checks.filter(c => c.found).length;
    console.log(`${passedChecks}/${checks.length} optimizations applied`);

    if (passedChecks === checks.length) {
        console.log('\n🎉 All database locking fixes have been applied successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Test uploading an image for calorie calculation');
        console.log('2. Verify the data gets stored properly');
        console.log('3. Check that no "table locked" errors occur');
    } else {
        console.log('\n⚠️  Some fixes may be missing. Please review the changes.');
    }
} else {
    console.log('❌ Cannot find database.ts file');
}

// Check if polling interval was updated
const watcherFile = path.join(__dirname, 'Frontend/src/utils/databaseWatcher.ts');
if (fs.existsSync(watcherFile)) {
    const watcherContent = fs.readFileSync(watcherFile, 'utf8');
    const hasReducedPolling = watcherContent.includes('10000');
    console.log(`\n${hasReducedPolling ? '✅' : '❌'} Database polling frequency: ${hasReducedPolling ? 'REDUCED TO 10s' : 'NEEDS UPDATE'}`);
} 