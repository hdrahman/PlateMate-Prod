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

// Main data sync function
export const syncData = async (): Promise<boolean> => {
    // Check online status
    if (!isOnline()) {
        console.log('🔄 Device offline, skipping sync');
        return false;
    }

    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
        console.log('🔄 User not authenticated, skipping sync');
        return false;
    }

    console.log('🔄 Starting data sync');

    try {
        // Get access token
        const accessToken = await user.getIdToken();

        // Create axios instance with auth header
        const api = axios.create({
            baseURL: BACKEND_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Debug: Log details if in debug mode
        if (isDebug) {
            console.log('🔄 Sync using URL:', BACKEND_URL);
            console.log('🔄 Auth token received:', accessToken ? '✅ YES' : '❌ NO');
        }

        // Track if any sync operations were attempted
        let syncAttempted = false;

        // 1. Sync user profiles
        const unsyncedProfiles = await getUnsyncedUserProfiles();
        if (unsyncedProfiles.length > 0) {
            syncAttempted = true;
            console.log(`🔄 Syncing ${unsyncedProfiles.length} user profiles`);

            for (const profile of unsyncedProfiles) {
                if (profile.firebase_uid) {
                    try {
                        await api.post('/users/sync-profile', {
                            profile
                        });

                        // Mark as synced locally
                        await markUserProfileSynced(profile.firebase_uid);
                        console.log(`✅ User profile synced: ${profile.firebase_uid}`);
                    } catch (error) {
                        console.error('❌ Error syncing user profile:', error);
                    }
                }
            }
        }

        // 2. Sync food logs
        const unsyncedFoodLogs = await getUnsyncedFoodLogs();
        if (unsyncedFoodLogs.length > 0) {
            syncAttempted = true;
            console.log(`🔄 Syncing ${unsyncedFoodLogs.length} food logs`);

            const response = await api.post('/food-logs/sync', {
                logs: unsyncedFoodLogs
            });

            if (response.data && response.data.success) {
                // Mark food logs as synced
                for (const log of unsyncedFoodLogs) {
                    if (log.id) {
                        await markFoodLogAsSynced(log.id, log.id);
                    }
                }
                console.log(`✅ ${unsyncedFoodLogs.length} food logs synced`);
            }
        } else {
            console.log('✅ No unsynced food logs to sync');
        }

        // 3. Sync step data
        const unsyncedSteps = await getUnsyncedSteps();
        if (unsyncedSteps.length > 0) {
            syncAttempted = true;
            console.log(`🔄 Syncing ${unsyncedSteps.length} step records`);

            try {
                const response = await api.post('/steps/sync', {
                    steps: unsyncedSteps
                });

                if (response.data && response.data.success) {
                    // Mark steps as synced
                    const stepIds = unsyncedSteps.map(s => s.id).filter(id => id !== undefined);
                    await markStepsSynced(stepIds);
                    console.log(`✅ ${unsyncedSteps.length} step records synced`);
                }
            } catch (error) {
                console.error('❌ Error syncing steps:', error);
            }
        } else {
            console.log('✅ No unsynced step data to sync');
        }

        // 4. Sync streak data
        const unsyncedStreaks = await getUnsyncedStreaks();
        if (unsyncedStreaks.length > 0) {
            syncAttempted = true;
            console.log(`🔄 Syncing ${unsyncedStreaks.length} streak records`);

            try {
                const response = await api.post('/streaks/sync', {
                    streaks: unsyncedStreaks
                });

                if (response.data && response.data.success) {
                    // Mark streaks as synced
                    for (const streak of unsyncedStreaks) {
                        if (streak.firebase_uid) {
                            await markStreakSynced(streak.firebase_uid);
                        }
                    }
                    console.log(`✅ ${unsyncedStreaks.length} streak records synced`);
                }
            } catch (error) {
                console.error('❌ Error syncing streaks:', error);
            }
        } else {
            console.log('✅ No unsynced streak data to sync');
        }

        // Update last sync time if any sync was attempted
        if (syncAttempted) {
            await updateLastSyncTime('success');
            console.log('✅ Sync completed successfully');
        } else {
            console.log('✅ No data to sync');
        }

        return true;
    } catch (error) {
        console.error('❌ Error during sync process:', error);

        // Update sync status with error
        await updateLastSyncTime('error');
        return false;
    }
};

// Returns true if a sync is needed based on time threshold
export const shouldSync = async (): Promise<boolean> => {
    try {
        // Get last sync time
        const lastSync = await getLastSyncTime();

        if (!lastSync || !lastSync.last_sync) {
            // Never synced before or no sync record
            return true;
        }

        // Parse last sync time
        const lastSyncTime = new Date(lastSync.last_sync).getTime();
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