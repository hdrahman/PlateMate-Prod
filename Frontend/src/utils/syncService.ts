import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
    getUnsyncedFoodLogs,
    markFoodLogAsSynced,
    updateLastSyncTime,
    purgeOldData
} from './database';

const BACKEND_URL = 'http://172.31.153.15:8000'; // Replace with your backend URL
const SYNC_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

// Check if the device is online
export const isOnline = async (): Promise<boolean> => {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected && netInfo.isInternetReachable;
};

// Sync a single food log
const syncFoodLog = async (foodLog: any): Promise<number> => {
    try {
        const { id, sync_action, ...data } = foodLog;

        let response;

        switch (sync_action) {
            case 'create':
                response = await axios.post(`${BACKEND_URL}/meal_entries/create`, data);
                break;
            case 'update':
                response = await axios.put(`${BACKEND_URL}/meal_entries/update/${id}`, data);
                break;
            case 'delete':
                response = await axios.delete(`${BACKEND_URL}/meal_entries/delete/${id}`);
                break;
            default:
                throw new Error(`Unknown sync action: ${sync_action}`);
        }

        if (response.status >= 200 && response.status < 300) {
            // Mark as synced in local database
            const serverId = response.data.id || id;
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
        const unsyncedLogs = await getUnsyncedFoodLogs();

        if (unsyncedLogs.length === 0) {
            console.log('✅ No unsynced food logs to sync');
            await updateLastSyncTime('success');
            return { success: 0, failed: 0 };
        }

        console.log(`🔄 Syncing ${unsyncedLogs.length} food logs...`);

        // Sync each food log
        let success = 0;
        let failed = 0;

        for (const log of unsyncedLogs) {
            const result = await syncFoodLog(log);
            if (result === 1) {
                success++;
            } else {
                failed++;
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