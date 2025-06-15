import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
    getUnsyncedFoodLogs,
    markFoodLogAsSynced,
    updateLastSyncTime,
    purgeOldData,
    getLastSyncTime,
    updateUserProfile,
    markUserProfileSynced,
    getUnsyncedUserProfiles,
    getUnsyncedSteps,
    markStepsSynced,
    getUnsyncedStreaks,
    markStreakSynced
} from './database';
import { BACKEND_URL, isDebug } from './config';
import { auth } from './firebase/index';

// Sync interval in milliseconds (3 hours)
const SYNC_INTERVAL = 3 * 60 * 60 * 1000;

// Define a type for food log entries
interface FoodLogEntry {
    id: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    notes?: string;
    synced: number;
    sync_action: string;
    last_modified: string;
}

// Network status check
let isConnected = true;

// Update network status
export const setOnlineStatus = (status: boolean) => {
    isConnected = status;
};

// Check if device is online
export const isOnline = (): boolean => {
    return isConnected;
};

// Main data sync function - DISABLED FOR OFFLINE MODE
export const syncData = async (): Promise<boolean> => {
    console.log('🚫 Sync disabled - app running in offline mode');
    return true; // Return true to indicate "success" (no sync needed)
};

// Returns true if a sync is needed based on time threshold
export const shouldSync = async (): Promise<boolean> => {
    try {
        // Get last sync time
        const lastSync = await getLastSyncTime();

        if (!lastSync || !lastSync.lastSync) {
            // Never synced before or no sync record
            return true;
        }

        // Parse last sync time
        const lastSyncTime = new Date(lastSync.lastSync).getTime();
        const now = new Date().getTime();

        // Calculate difference in minutes
        const diffMinutes = (now - lastSyncTime) / (1000 * 60);

        // Sync if it's been more than 15 minutes
        return diffMinutes > 15;
    } catch (error) {
        console.error('❌ Error checking sync status:', error);
        return true; // Default to syncing if there's an error
    }
};

// Sync a single food log
const syncFoodLog = async (foodLog: FoodLogEntry): Promise<number> => {
    try {
        const { id, sync_action, ...data } = foodLog;
        console.log(`🔄 Syncing food log ID ${id} with action: ${sync_action}`);

        // Ensure date is in the correct format (YYYY-MM-DD)
        let formattedData = { ...data };
        if (data.date) {
            // If date is already in YYYY-MM-DD format, use it as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                formattedData.date = data.date;
            } else {
                // Otherwise, try to extract the date part
                try {
                    const dateStr = data.date.split('T')[0].split(' ')[0]; // Handle both ISO and space-separated formats
                    formattedData.date = dateStr;
                } catch (error) {
                    console.error('❌ Error formatting date for sync:', error);
                    // Keep original date if parsing fails
                }
            }
        }

        console.log('Food log data for sync:', formattedData);

        let response;

        switch (sync_action) {
            case 'create':
                console.log(`Creating new food log on backend: ${BACKEND_URL}/meal_entries/create`);
                response = await axios.post(`${BACKEND_URL}/meal_entries/create`, formattedData);
                break;
            case 'update':
                console.log(`Updating food log on backend: ${BACKEND_URL}/meal_entries/update/${id}`);
                response = await axios.put(`${BACKEND_URL}/meal_entries/update/${id}`, formattedData);
                break;
            case 'delete':
                console.log(`Deleting food log on backend: ${BACKEND_URL}/meal_entries/delete/${id}`);
                response = await axios.delete(`${BACKEND_URL}/meal_entries/delete/${id}`);
                break;
            default:
                throw new Error(`Unknown sync action: ${sync_action}`);
        }

        if (response.status >= 200 && response.status < 300) {
            // Mark as synced in local database
            const serverId = response.data.id || id;
            console.log(`✅ Sync successful. Server ID: ${serverId}`);
            await markFoodLogAsSynced(id, serverId);
            return 1; // Successfully synced
        } else {
            console.error('❌ Error syncing food log:', response.statusText);
            return 0; // Failed to sync
        }
    } catch (error) {
        console.error('❌ Error syncing food log:', error);
        return 0; // Failed to sync
    }
};

// Sync all unsynced food logs - DISABLED FOR OFFLINE MODE
export const syncFoodLogs = async (): Promise<{ success: number, failed: number }> => {
    console.log('🚫 Food log sync disabled - app running in offline mode');
    return { success: 0, failed: 0 };
};

// Start periodic sync - DISABLED FOR OFFLINE MODE
export const startPeriodicSync = async () => {
    console.log('🚫 Sync disabled - app running in offline mode');

    // Don't sync immediately when app starts
    // await syncFoodLogs();

    // Don't set up periodic sync
    // const intervalId = setInterval(async () => {
    //     await syncFoodLogs();
    // }, SYNC_INTERVAL);

    // Store a dummy interval ID
    await AsyncStorage.setItem('syncIntervalId', '0');

    return 0; // Return dummy interval ID
};

// Stop periodic sync
export const stopPeriodicSync = async () => {
    const intervalIdStr = await AsyncStorage.getItem('syncIntervalId');
    if (intervalIdStr) {
        const intervalId = parseInt(intervalIdStr, 10);
        clearInterval(intervalId);
        await AsyncStorage.removeItem('syncIntervalId');
    }
};

// Sync when the app comes online - DISABLED FOR OFFLINE MODE
export const setupOnlineSync = () => {
    console.log('🚫 Online sync disabled - app running in offline mode');
    // NetInfo.addEventListener(state => {
    //     if (state.isConnected && state.isInternetReachable) {
    //         console.log('📡 Device is now online, starting sync...');
    //         syncFoodLogs();
    //     }
    // });
}; 