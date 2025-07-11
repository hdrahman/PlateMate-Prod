import { db, getCurrentUserId } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Check if we should show the first food log popup
 * @param firebaseUid - The Firebase UID of the user
 * @returns true if we should show the popup, false otherwise
 */
export const shouldShowFirstFoodLogPopup = async (firebaseUid: string): Promise<boolean> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to check first food log before database initialization');
        return false;
    }

    try {
        // Check if we've already shown the popup to this user
        const hasShownKey = `first_food_log_popup_shown_${firebaseUid}`;
        const hasShownPopup = await AsyncStorage.getItem(hasShownKey);
        
        if (hasShownPopup === 'true') {
            console.log('📋 First food log popup already shown to this user');
            return false;
        }

        // Check if user has exactly 1 food log (just logged their first)
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM food_logs WHERE user_id = ?`,
            [firebaseUid]
        );
        
        const totalLogs = result?.count || 0;
        console.log(`📊 User has ${totalLogs} food logs total`);
        
        // Show popup only if they have exactly 1 food log and haven't seen popup
        return totalLogs === 1;
    } catch (error) {
        console.error('❌ Error checking first food log popup condition:', error);
        return false;
    }
};

/**
 * Mark that the first food log popup has been shown to this user
 * @param firebaseUid - The Firebase UID of the user
 */
export const markFirstFoodLogPopupShown = async (firebaseUid: string): Promise<void> => {
    try {
        const hasShownKey = `first_food_log_popup_shown_${firebaseUid}`;
        await AsyncStorage.setItem(hasShownKey, 'true');
        console.log('✅ Marked first food log popup as shown for user');
    } catch (error) {
        console.error('❌ Error marking first food log popup as shown:', error);
    }
};

/**
 * Check if this is the user's first food log (legacy function for backward compatibility)
 * @param firebaseUid - The Firebase UID of the user
 * @returns true if this is their first food log, false otherwise
 */
export const isFirstFoodLog = async (firebaseUid: string): Promise<boolean> => {
    return shouldShowFirstFoodLogPopup(firebaseUid);
};

/**
 * Get the total number of food logs for a user
 * @param firebaseUid - The Firebase UID of the user
 * @returns The total number of food logs
 */
export const getTotalFoodLogsCount = async (firebaseUid: string): Promise<number> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get food log count before database initialization');
        return 0;
    }

    try {
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM food_logs WHERE user_id = ?`,
            [firebaseUid]
        );
        
        return result?.count || 0;
    } catch (error) {
        console.error('❌ Error getting food log count:', error);
        return 0;
    }
};
