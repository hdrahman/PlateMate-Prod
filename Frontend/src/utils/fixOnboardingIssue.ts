import { getDatabase } from './database';
import { supabase } from './supabaseClient';

/**
 * Fix the onboarding issue by transferring data from the old user ID to the current user ID
 */
export const fixOnboardingIssue = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const db = await getDatabase();
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
            return { success: false, message: 'No user is currently logged in' };
        }

        const currentUserId = currentUser.id;
        console.log(`🔧 Fixing onboarding issue for user: ${currentUserId}`);

        // Check if current user already has a profile
        const existingProfile = await db.getFirstAsync(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [currentUserId]
        );

        if (existingProfile) {
            return { success: true, message: 'User already has a profile - no fix needed' };
        }

        // Find the user with food logs (from the logs, we know it's FAy2Jp10PyQfj8NyrUpylPhzwMq1)
        const profilesWithData = await db.getAllAsync(`
            SELECT p.*, fl.log_count 
            FROM user_profiles p
            LEFT JOIN (
                SELECT user_id, COUNT(*) as log_count 
                FROM food_logs 
                GROUP BY user_id
            ) fl ON p.firebase_uid = fl.user_id
            ORDER BY p.last_modified DESC, fl.log_count DESC
        `);

        if (profilesWithData.length === 0) {
            return { success: false, message: 'No existing profiles found - user needs to complete onboarding' };
        }

        // Use the first profile (most recent or with most data)
        const sourceProfile = profilesWithData[0] as any;
        const sourceUserId = sourceProfile.firebase_uid;

        console.log(`🔄 Transferring data from ${sourceUserId} to ${currentUserId}`);
        console.log(`📧 Source profile email: ${sourceProfile.email}`);

        // Start transaction
        await db.runAsync('BEGIN TRANSACTION');

        let totalUpdates = 0;

        // 1. Transfer user profile
        const result1 = await db.runAsync(`
            UPDATE user_profiles 
            SET firebase_uid = ?, last_modified = ? 
            WHERE firebase_uid = ?
        `, [currentUserId, new Date().toISOString(), sourceUserId]);
        totalUpdates += result1.changes;
        console.log(`✅ Updated ${result1.changes} profile record(s)`);

        // 2. Transfer food logs
        const result2 = await db.runAsync(`
            UPDATE food_logs 
            SET user_id = ?, last_modified = ? 
            WHERE user_id = ?
        `, [currentUserId, new Date().toISOString(), sourceUserId]);
        totalUpdates += result2.changes;
        console.log(`✅ Updated ${result2.changes} food log record(s)`);

        // 3. Transfer nutrition goals
        const result3 = await db.runAsync(`
            UPDATE nutrition_goals 
            SET firebase_uid = ?, last_modified = ? 
            WHERE firebase_uid = ?
        `, [currentUserId, new Date().toISOString(), sourceUserId]);
        totalUpdates += result3.changes;
        console.log(`✅ Updated ${result3.changes} nutrition goal record(s)`);

        // 4. Transfer other data tables
        const tables = [
            { table: 'exercise_logs', column: 'user_id' },
            { table: 'step_logs', column: 'user_id' },
            { table: 'user_streaks', column: 'firebase_uid' },
            { table: 'weight_entries', column: 'firebase_uid' },
            { table: 'cheat_day_settings', column: 'firebase_uid' },
            { table: 'user_subscriptions', column: 'firebase_uid' },
            { table: 'api_tokens', column: 'user_id' }
        ];

        for (const { table, column } of tables) {
            try {
                const result = await db.runAsync(`
                    UPDATE ${table} 
                    SET ${column} = ?, last_modified = ? 
                    WHERE ${column} = ?
                `, [currentUserId, new Date().toISOString(), sourceUserId]);
                totalUpdates += result.changes;
                console.log(`✅ Updated ${result.changes} ${table} record(s)`);
            } catch (error) {
                // Table might not exist, continue
                console.log(`ℹ️ Skipped ${table} (table may not exist)`);
            }
        }

        // Commit transaction
        await db.runAsync('COMMIT');

        console.log(`✅ Data transfer completed! Total records updated: ${totalUpdates}`);

        return {
            success: true,
            message: `Successfully transferred ${totalUpdates} records from ${sourceProfile.email} to current user`
        };

    } catch (error) {
        // Rollback on error
        try {
            const db = await getDatabase();
            await db.runAsync('ROLLBACK');
            console.log('⏪ Transaction rolled back due to error');
        } catch (rollbackError) {
            console.error('❌ Error rolling back transaction:', rollbackError);
        }
        console.error('❌ Error fixing onboarding issue:', error);
        return { success: false, message: `Fix failed: ${error}` };
    }
};

/**
 * Diagnose the current onboarding state
 */
export const diagnoseOnboardingState = async (): Promise<void> => {
    try {
        const db = await getDatabase();
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        console.log('🔧 ONBOARDING DIAGNOSTICS');
        console.log('='.repeat(50));

        if (!currentUser) {
            console.log('❌ No user logged in');
            return;
        }

        console.log(`👤 Current User ID: ${currentUser.id}`);
        console.log(`📧 Current User Email: ${currentUser.email}`);

        // Check current user profile
        const currentProfile = await db.getFirstAsync(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [currentUser.id]
        );

        console.log(`📋 Current User Profile: ${currentProfile ? 'EXISTS' : 'MISSING'}`);
        if (currentProfile) {
            const profile = currentProfile as any;
            console.log(`   - Name: ${profile.first_name} ${profile.last_name || ''}`);
            console.log(`   - Email: ${profile.email}`);
            console.log(`   - Onboarding Complete: ${profile.onboarding_complete ? 'YES' : 'NO'}`);
        }

        // Check for other profiles
        const allProfiles = await db.getAllAsync(`
            SELECT firebase_uid, email, first_name, last_name, onboarding_complete 
            FROM user_profiles
        `);

        console.log(`\n📊 Total Profiles in Database: ${allProfiles.length}`);
        allProfiles.forEach((profile: any, index: number) => {
            console.log(`   ${index + 1}. ${profile.firebase_uid} (${profile.email})`);
            console.log(`      Name: ${profile.first_name} ${profile.last_name || ''}`);
            console.log(`      Onboarding: ${profile.onboarding_complete ? 'COMPLETE' : 'INCOMPLETE'}`);
        });

        // Check food logs
        const foodLogStats = await db.getAllAsync(`
            SELECT user_id, COUNT(*) as count 
            FROM food_logs 
            GROUP BY user_id
        `);

        console.log(`\n🍽️  Food Log Summary: ${foodLogStats.length} users with logs`);
        foodLogStats.forEach((stat: any, index: number) => {
            console.log(`   ${index + 1}. ${stat.user_id}: ${stat.count} logs`);
        });

        // Recommendation
        if (!currentProfile && allProfiles.length > 0) {
            console.log('\n💡 RECOMMENDATION:');
            console.log('   Run fixOnboardingIssue() to transfer data to current user');
        } else if (!currentProfile && allProfiles.length === 0) {
            console.log('\n💡 RECOMMENDATION:');
            console.log('   Complete onboarding from scratch (no existing data found)');
        } else {
            console.log('\n✅ No issues detected');
        }

    } catch (error) {
        console.error('❌ Error during diagnostics:', error);
    }
}; 