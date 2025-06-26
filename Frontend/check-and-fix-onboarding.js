const {
    getDatabase,
    getUserProfileBySupabaseUid,
    addUserProfile,
    ensureDatabaseReady,
    cleanupOldTempOnboardingSessions,
    updateUserProfile
} = require('./src/utils/database');

const checkAndFixOnboarding = async () => {
    console.log('🏥 PlateMate Onboarding Health Check & Fix Tool\n');
    console.log('This tool will diagnose and fix onboarding data issues.\n');

    try {
        // 1. Initialize database
        console.log('1. Initializing database...');
        await ensureDatabaseReady();
        const db = await getDatabase();
        console.log('✅ Database ready\n');

        // 2. Show current database status
        console.log('2. Database Status Check:');

        // Check total profiles
        const totalProfiles = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_profiles');
        console.log(`   📊 Total user profiles: ${totalProfiles.count}`);

        // Check completed profiles
        const completedProfiles = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_profiles WHERE onboarding_complete = 1');
        console.log(`   ✅ Completed onboarding: ${completedProfiles.count}`);

        // Check incomplete profiles
        const incompleteProfiles = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_profiles WHERE onboarding_complete = 0');
        console.log(`   ⏳ Incomplete onboarding: ${incompleteProfiles.count}`);

        console.log('');

        // 3. Analyze each profile in detail
        console.log('3. Profile Analysis:');
        const allProfiles = await db.getAllAsync('SELECT * FROM user_profiles ORDER BY id DESC');

        if (allProfiles.length === 0) {
            console.log('   ⚠️ No user profiles found in database.');
            console.log('   This means no onboarding has been completed or the database is empty.');
        } else {
            for (let i = 0; i < allProfiles.length; i++) {
                const profile = allProfiles[i];
                console.log(`\n   Profile ${i + 1}:`);
                console.log(`   👤 User: ${profile.first_name} ${profile.last_name || ''} (${profile.email})`);
                console.log(`   🆔 ID: ${profile.firebase_uid}`);
                console.log(`   📅 Created: ${profile.last_modified}`);
                console.log(`   🎯 Onboarding Complete: ${profile.onboarding_complete ? '✅ YES' : '❌ NO'}`);

                // Check data completeness
                const dataFields = {
                    'Height': profile.height,
                    'Weight': profile.weight,
                    'Age': profile.age,
                    'Gender': profile.gender,
                    'Activity Level': profile.activity_level,
                    'Fitness Goal': profile.fitness_goal,
                    'Weight Goal': profile.weight_goal,
                    'Dietary Restrictions': profile.dietary_restrictions,
                    'Motivations': profile.motivations
                };

                const completedFields = Object.entries(dataFields).filter(([key, value]) =>
                    value !== null && value !== undefined && value !== '' && value !== '[]'
                ).length;

                const totalFields = Object.keys(dataFields).length;
                const completenessPercentage = Math.round((completedFields / totalFields) * 100);

                console.log(`   📋 Data Completeness: ${completedFields}/${totalFields} fields (${completenessPercentage}%)`);

                // Show specific data
                console.log('   📝 Profile Data:');
                Object.entries(dataFields).forEach(([key, value]) => {
                    const status = (value !== null && value !== undefined && value !== '' && value !== '[]') ? '✅' : '❌';
                    const displayValue = value || 'Not set';
                    console.log(`      ${status} ${key}: ${displayValue}`);
                });

                // Check if this profile should be marked as complete but isn't
                const hasMinimumData = profile.first_name && profile.email &&
                    (profile.height || profile.weight || profile.fitness_goal || profile.activity_level);

                if (hasMinimumData && !profile.onboarding_complete) {
                    console.log('   🔧 ISSUE DETECTED: Profile has data but onboarding_complete is false');
                    console.log('   💡 This can be auto-fixed');
                }
            }
        }

        // 4. Auto-fix issues
        console.log('\n4. Auto-Fix Issues:');

        // Find profiles that should be marked complete
        const fixableProfiles = await db.getAllAsync(`
            SELECT * FROM user_profiles 
            WHERE onboarding_complete = 0 AND 
                  first_name IS NOT NULL AND first_name != '' AND
                  email IS NOT NULL AND email != '' AND
                  (height IS NOT NULL OR weight IS NOT NULL OR fitness_goal IS NOT NULL OR activity_level IS NOT NULL)
        `);

        if (fixableProfiles.length > 0) {
            console.log(`   🔧 Found ${fixableProfiles.length} profile(s) that can be auto-fixed:`);

            for (const profile of fixableProfiles) {
                console.log(`   ⚙️ Fixing profile for ${profile.email}...`);
                try {
                    await db.runAsync(`
                        UPDATE user_profiles 
                        SET onboarding_complete = 1, 
                            last_modified = ? 
                        WHERE firebase_uid = ?
                    `, [new Date().toISOString(), profile.firebase_uid]);
                    console.log(`      ✅ Fixed onboarding completion flag`);
                } catch (error) {
                    console.log(`      ❌ Error fixing profile: ${error.message}`);
                }
            }
        } else {
            console.log('   ✅ No profiles need auto-fixing');
        }

        // 5. Test profile retrieval
        console.log('\n5. Testing Profile Retrieval:');

        if (allProfiles.length > 0) {
            const testProfile = allProfiles[0];
            console.log(`   🧪 Testing retrieval for ${testProfile.email}...`);

            try {
                const retrievedProfile = await getUserProfileBySupabaseUid(testProfile.firebase_uid);
                if (retrievedProfile) {
                    console.log('      ✅ Profile retrieval: SUCCESS');
                    console.log(`      📊 Onboarding Complete: ${retrievedProfile.onboarding_complete ? 'YES' : 'NO'}`);
                    console.log(`      📋 Data Fields: Height(${retrievedProfile.height}), Weight(${retrievedProfile.weight}), Goal(${retrievedProfile.fitness_goal})`);
                } else {
                    console.log('      ❌ Profile retrieval: FAILED');
                }
            } catch (error) {
                console.log(`      ❌ Profile retrieval error: ${error.message}`);
            }
        }

        // 6. Clean up temporary data
        console.log('\n6. Cleanup:');
        try {
            const tempSessions = await db.getAllAsync('SELECT COUNT(*) as count FROM temp_onboarding_sessions');
            console.log(`   🗂️ Temporary sessions: ${tempSessions[0].count}`);

            await cleanupOldTempOnboardingSessions();
            console.log('   🧹 Cleaned up old temporary sessions');
        } catch (error) {
            console.log(`   ⚠️ Cleanup warning: ${error.message}`);
        }

        // 7. Final summary
        console.log('\n7. Final Summary:');

        // Re-check after fixes
        const finalCompleted = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_profiles WHERE onboarding_complete = 1');
        const finalIncomplete = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_profiles WHERE onboarding_complete = 0');

        console.log(`   ✅ Completed profiles: ${finalCompleted.count}`);
        console.log(`   ⏳ Incomplete profiles: ${finalIncomplete.count}`);

        if (finalCompleted.count > 0) {
            console.log('\n🎉 SUCCESS: Onboarding data is now properly connected!');
            console.log('   Your app should now recognize completed onboarding and show the main interface.');
        } else if (finalIncomplete.count > 0) {
            console.log('\n⚠️ ATTENTION: You have profile data but onboarding is not marked complete.');
            console.log('   This suggests the onboarding process was interrupted.');
            console.log('   You may need to complete the onboarding flow again.');
        } else {
            console.log('\n📝 INFO: No onboarding data found.');
            console.log('   The app will start with the onboarding flow as expected.');
        }

        console.log('\n🔧 Troubleshooting Tips:');
        console.log('   1. Restart the app to see if changes take effect');
        console.log('   2. If issues persist, try going through onboarding again');
        console.log('   3. Check console logs for any authentication errors');
        console.log('   4. Ensure you\'re signed in with the correct account');

    } catch (error) {
        console.error('❌ Health check failed:', error);
        console.error('Error details:', error.message);
        console.error('\nPlease report this error with the details above.');
    }
};

// Export for use in other scripts
module.exports = { checkAndFixOnboarding };

// Run if called directly
if (require.main === module) {
    checkAndFixOnboarding().then(() => {
        console.log('\n🏁 Health check completed!');
        console.log('You can now restart your app to test the fixes.');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Health check failed:', error);
        process.exit(1);
    });
} 