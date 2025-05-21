import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
    getUnsyncedFoodLogs,
    markFoodLogAsSynced,
    updateLastSyncTime,
    purgeOldData
} from './database';
import { BACKEND_URL } from './config';

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

// Check if the device is online with additional validation
export const isOnline = async (): Promise<boolean> => {
    try {
        // First check with NetInfo
        const netInfo = await NetInfo.fetch();
        const isConnected = netInfo.isConnected;

        if (!isConnected) {
            console.log('📡 Device appears to be offline according to NetInfo');
            return false;
        }

        // For Expo Go testing, don't rely as heavily on the backend ping
        // This helps when testing with Expo Go where the backend might not be available
        // but the app should still function in "offline mode"
        console.log('📡 Device appears to be connected. Skipping backend ping for Expo Go testing.');
        return true;

        // Note: The following code is commented out to improve testing experience
        // in Expo Go. Uncomment for production use where you want to verify 
        // the backend is actually reachable.
        /*
        // Add a lightweight ping to our backend as additional verification
        try {
            // Use a 1.5 second timeout for quick check
            const timeoutPromise = new Promise<boolean>((_, reject) => {
                setTimeout(() => reject(new Error('Network ping timeout')), 1500);
            });

            const pingPromise = axios.get(`${BACKEND_URL}/health`, { timeout: 1500 })
                .then(response => response.status === 200)
                .catch(() => false);

            // Race between ping and timeout
            const pingSucceeded = await Promise.race([pingPromise, timeoutPromise]) as boolean;

            if (!pingSucceeded) {
                console.log('📡 Backend is unreachable despite being connected');
                return false;
            }

            return true;
        } catch (error) {
            console.log('📡 Additional network check failed:', error);
            return false;
        }
        */
    } catch (error) {
        console.error('📡 Error checking network status:', error);
        return false;
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

// Sync all unsynced food logs
export const syncFoodLogs = async (): Promise<{ success: number, failed: number }> => {
    try {
        // Check if online
        const online = await isOnline();
        if (!online) {
            console.log('📡 Device is offline, skipping sync');
            return { success: 0, failed: 0 };
        }

        // Get all unsynced food logs
        const unsyncedLogs = await getUnsyncedFoodLogs() as FoodLogEntry[];
        console.log(`📊 Found ${unsyncedLogs.length} unsynced food logs`);

        if (unsyncedLogs.length === 0) {
            console.log('✅ No unsynced food logs to sync');
            await updateLastSyncTime('success');
            return { success: 0, failed: 0 };
        }

        console.log(`🔄 Syncing ${unsyncedLogs.length} food logs...`);

        // Sync each food log
        let success = 0;
        let failed = 0;
        const maxRetries = 3;

        for (const log of unsyncedLogs) {
            let retries = 0;
            let synced = false;

            while (retries < maxRetries && !synced) {
                try {
                    const result = await syncFoodLog(log);
                    if (result === 1) {
                        success++;
                        synced = true;
                    } else {
                        retries++;
                        console.log(`⚠️ Retry ${retries}/${maxRetries} for food log ID ${log.id}`);
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    retries++;
                    console.error(`❌ Error on retry ${retries}/${maxRetries} for food log ID ${log.id}:`, error);
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!synced) {
                failed++;
                console.error(`❌ Failed to sync food log ID ${log.id} after ${maxRetries} retries`);
            }
        }

        // Update last sync time
        const status = failed === 0 ? 'success' : 'partial';
        await updateLastSyncTime(status);

        console.log(`✅ Sync completed: ${success} succeeded, ${failed} failed`);

        // Purge old data
        await purgeOldData();

        return { success, failed };
    } catch (error) {
        console.error('❌ Error syncing food logs:', error);
        await updateLastSyncTime('failed');
        return { success: 0, failed: 0 };
    }
};

// Start periodic sync
export const startPeriodicSync = async () => {
    // Sync immediately when app starts
    await syncFoodLogs();

    // Set up periodic sync
    const intervalId = setInterval(async () => {
        await syncFoodLogs();
    }, SYNC_INTERVAL);

    // Store interval ID in AsyncStorage
    await AsyncStorage.setItem('syncIntervalId', intervalId.toString());

    return intervalId;
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

// Sync when the app comes online
export const setupOnlineSync = () => {
    NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
            console.log('📡 Device is now online, starting sync...');
            syncFoodLogs();
        }
    });
}; 