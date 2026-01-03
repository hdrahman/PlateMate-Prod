/**
 * WearableBackgroundSync - Background synchronization service for wearable health data
 * 
 * Uses expo-background-fetch for periodic background sync
 * and provides foreground sync capabilities
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WearableHealthService from './WearableHealthService';

// Task name for background fetch
export const WEARABLE_HEALTH_SYNC_TASK = 'WEARABLE_HEALTH_SYNC_TASK';

// Storage keys
const LAST_BACKGROUND_SYNC_KEY = 'WEARABLE_LAST_BACKGROUND_SYNC';
const BACKGROUND_SYNC_ENABLED_KEY = 'WEARABLE_BACKGROUND_SYNC_ENABLED';

// Minimum interval between background syncs (in seconds)
const MIN_BACKGROUND_INTERVAL = 15 * 60; // 15 minutes

// Foreground sync interval (in milliseconds)
const FOREGROUND_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface SyncResult {
    success: boolean;
    timestamp: Date;
    data?: {
        steps: number;
        heartRateAvg: number;
        activeCalories: number;
        workoutMinutes: number;
        sleepHours: number;
    };
    error?: string;
}

class WearableBackgroundSync {
    private static instance: WearableBackgroundSync;
    private foregroundSyncInterval: NodeJS.Timeout | null = null;
    private isInitialized = false;
    private listeners: Set<(result: SyncResult) => void> = new Set();

    private constructor() {}

    public static getInstance(): WearableBackgroundSync {
        if (!WearableBackgroundSync.instance) {
            WearableBackgroundSync.instance = new WearableBackgroundSync();
        }
        return WearableBackgroundSync.instance;
    }

    /**
     * Initialize the background sync service
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('🔄 WearableBackgroundSync: Initializing...');

            // Define the background task
            this.defineBackgroundTask();

            // Check if background sync should be enabled
            const enabled = await this.isBackgroundSyncEnabled();
            if (enabled) {
                await this.registerBackgroundTask();
            }

            this.isInitialized = true;
            console.log('✅ WearableBackgroundSync: Initialized');
        } catch (error) {
            console.error('❌ WearableBackgroundSync: Initialization failed:', error);
        }
    }

    /**
     * Define the background task handler
     */
    private defineBackgroundTask(): void {
        TaskManager.defineTask(WEARABLE_HEALTH_SYNC_TASK, async () => {
            try {
                console.log('🔄 Background task: Starting wearable health sync...');

                // Initialize the service if needed
                await WearableHealthService.initialize();

                // Check if connected
                if (!WearableHealthService.isConnected()) {
                    console.log('⚠️ Background task: Not connected to health service');
                    return BackgroundFetch.BackgroundFetchResult.NoData;
                }

                // Perform sync
                const data = await WearableHealthService.syncAll();

                // Save last sync time
                await AsyncStorage.setItem(LAST_BACKGROUND_SYNC_KEY, new Date().toISOString());

                console.log('✅ Background task: Sync completed', data);
                return BackgroundFetch.BackgroundFetchResult.NewData;
            } catch (error) {
                console.error('❌ Background task: Sync failed:', error);
                return BackgroundFetch.BackgroundFetchResult.Failed;
            }
        });
    }

    /**
     * Register the background fetch task
     */
    public async registerBackgroundTask(): Promise<boolean> {
        try {
            // Check if already registered
            const status = await BackgroundFetch.getStatusAsync();
            
            if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
                console.warn('⚠️ Background fetch is restricted on this device');
                return false;
            }

            if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
                console.warn('⚠️ Background fetch permission denied');
                return false;
            }

            // Register the task
            await BackgroundFetch.registerTaskAsync(WEARABLE_HEALTH_SYNC_TASK, {
                minimumInterval: MIN_BACKGROUND_INTERVAL,
                stopOnTerminate: false,
                startOnBoot: true,
            });

            await AsyncStorage.setItem(BACKGROUND_SYNC_ENABLED_KEY, 'true');
            console.log('✅ Background sync task registered');
            return true;
        } catch (error) {
            console.error('❌ Failed to register background task:', error);
            return false;
        }
    }

    /**
     * Unregister the background fetch task
     */
    public async unregisterBackgroundTask(): Promise<void> {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(WEARABLE_HEALTH_SYNC_TASK);
            
            if (isRegistered) {
                await BackgroundFetch.unregisterTaskAsync(WEARABLE_HEALTH_SYNC_TASK);
            }

            await AsyncStorage.setItem(BACKGROUND_SYNC_ENABLED_KEY, 'false');
            console.log('✅ Background sync task unregistered');
        } catch (error) {
            console.error('❌ Failed to unregister background task:', error);
        }
    }

    /**
     * Check if background sync is enabled
     */
    public async isBackgroundSyncEnabled(): Promise<boolean> {
        try {
            const enabled = await AsyncStorage.getItem(BACKGROUND_SYNC_ENABLED_KEY);
            return enabled === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Start foreground sync interval
     */
    public startForegroundSync(): void {
        if (this.foregroundSyncInterval) {
            console.log('⚠️ Foreground sync already running');
            return;
        }

        console.log('🔄 Starting foreground sync interval');

        // Perform initial sync
        this.performSync();

        // Set up interval
        this.foregroundSyncInterval = setInterval(() => {
            this.performSync();
        }, FOREGROUND_SYNC_INTERVAL);
    }

    /**
     * Stop foreground sync interval
     */
    public stopForegroundSync(): void {
        if (this.foregroundSyncInterval) {
            clearInterval(this.foregroundSyncInterval);
            this.foregroundSyncInterval = null;
            console.log('⏹️ Foreground sync stopped');
        }
    }

    /**
     * Perform a manual sync
     */
    public async performSync(): Promise<SyncResult> {
        try {
            console.log('🔄 Performing wearable health sync...');

            // Ensure service is initialized
            await WearableHealthService.initialize();

            // Check if connected
            if (!WearableHealthService.isConnected()) {
                const result: SyncResult = {
                    success: false,
                    timestamp: new Date(),
                    error: 'Not connected to health service',
                };
                this.notifyListeners(result);
                return result;
            }

            // Perform sync
            const data = await WearableHealthService.syncAll();

            const result: SyncResult = {
                success: true,
                timestamp: new Date(),
                data,
            };

            this.notifyListeners(result);
            console.log('✅ Sync completed:', data);
            return result;
        } catch (error) {
            const result: SyncResult = {
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
            this.notifyListeners(result);
            console.error('❌ Sync failed:', error);
            return result;
        }
    }

    /**
     * Get the last background sync time
     */
    public async getLastBackgroundSyncTime(): Promise<Date | null> {
        try {
            const timestamp = await AsyncStorage.getItem(LAST_BACKGROUND_SYNC_KEY);
            return timestamp ? new Date(timestamp) : null;
        } catch {
            return null;
        }
    }

    /**
     * Check background fetch status
     */
    public async getBackgroundFetchStatus(): Promise<string> {
        try {
            const status = await BackgroundFetch.getStatusAsync();
            
            switch (status) {
                case BackgroundFetch.BackgroundFetchStatus.Available:
                    return 'available';
                case BackgroundFetch.BackgroundFetchStatus.Restricted:
                    return 'restricted';
                case BackgroundFetch.BackgroundFetchStatus.Denied:
                    return 'denied';
                default:
                    return 'unknown';
            }
        } catch {
            return 'error';
        }
    }

    /**
     * Check if background task is registered
     */
    public async isBackgroundTaskRegistered(): Promise<boolean> {
        try {
            return await TaskManager.isTaskRegisteredAsync(WEARABLE_HEALTH_SYNC_TASK);
        } catch {
            return false;
        }
    }

    // Listener management
    public addListener(callback: (result: SyncResult) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(result: SyncResult): void {
        this.listeners.forEach(callback => callback(result));
    }

    /**
     * Enable or disable background sync
     */
    public async setBackgroundSyncEnabled(enabled: boolean): Promise<boolean> {
        if (enabled) {
            return await this.registerBackgroundTask();
        } else {
            await this.unregisterBackgroundTask();
            return true;
        }
    }
}

// Export singleton instance
export default WearableBackgroundSync.getInstance();
