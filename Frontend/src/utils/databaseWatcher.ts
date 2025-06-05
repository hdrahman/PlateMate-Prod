// databaseWatcher.ts
// This file provides a purely event-driven notification system for database changes
// It avoids timer-based polling for better performance and resource usage

import { getFoodLogsByDate } from './database';

type DatabaseChangeListener = () => void;

// Store for all registered listeners
const listeners: Set<DatabaseChangeListener> = new Set();

/**
 * Notify all registered listeners that the database has changed
 * This is called by database.ts functions after successful modifications
 */
export const notifyDatabaseChanged = async (): Promise<void> => {
    console.log(`🔔 Notifying ${listeners.size} database change listeners`);

    // Execute all listeners
    listeners.forEach(listener => {
        try {
            listener();
        } catch (error) {
            console.error('❌ Error in database change listener:', error);
        }
    });
};

/**
 * Subscribe to database changes
 * @param listener Function to call when database changes
 * @returns Function to unsubscribe
 */
export const subscribeToDatabaseChanges = (listener: DatabaseChangeListener): () => void => {
    console.log('📲 Adding database change listener');
    listeners.add(listener);

    // Return unsubscribe function for convenience
    return () => unsubscribeFromDatabaseChanges(listener);
};

/**
 * Unsubscribe from database changes
 * @param listener Function to remove from notification list
 */
export const unsubscribeFromDatabaseChanges = (listener: DatabaseChangeListener): void => {
    console.log('📴 Removing database change listener');
    listeners.delete(listener);
};

// Helper to format date as YYYY-MM-DD
function formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Compare logs to detect changes - returns true if changes found
function haveLogsChanged(oldLogs: any[] = [], newLogs: any[] = []): boolean {
    // If length changed, there's definitely a change
    if (!oldLogs || !newLogs || oldLogs.length !== newLogs.length) {
        return true;
    }

    // Sort logs by ID to ensure consistent comparison
    const sortById = (a: any, b: any) => (a.id || 0) - (b.id || 0);
    const sortedOldLogs = [...oldLogs].sort(sortById);
    const sortedNewLogs = [...newLogs].sort(sortById);

    // Compare all logs by ID and last_modified
    for (let i = 0; i < sortedOldLogs.length; i++) {
        const oldLog = sortedOldLogs[i];
        const newLog = sortedNewLogs[i];

        // If IDs don't match or last_modified changed, there's a change
        if (
            oldLog.id !== newLog.id ||
            oldLog.last_modified !== newLog.last_modified
        ) {
            return true;
        }
    }

    return false;
}

// Check for database changes
async function checkForChanges(): Promise<void> {
    try {
        // Only check today's logs for efficiency
        const today = new Date();
        const dateString = formatDateToString(today);

        // Get the current state of logs
        const currentLogs = await getFoodLogsByDate(dateString);

        // If there's no previous state or the logs have changed
        if (!lastLogs[dateString] || haveLogsChanged(lastLogs[dateString], currentLogs)) {
            console.log('🔄 Database changes detected, notifying watchers');

            // Update the cached state
            lastLogs[dateString] = currentLogs;

            // Notify all listeners
            if (listeners.size > 0) {
                await Promise.all(
                    Array.from(listeners).map(listener => {
                        try {
                            return listener();
                        } catch (error) {
                            console.error('Error in database change listener:', error);
                            return Promise.resolve();
                        }
                    })
                );
            }
        }
    } catch (error) {
        console.error('Error checking for database changes:', error);
    }
}

// Start polling for changes
function startPolling(): void {
    if (isPollingActive) return;

    console.log('🔄 Starting database watch polling');
    pollingInterval = setInterval(checkForChanges, POLLING_INTERVAL);
    isPollingActive = true;
}

// Stop polling
function stopPolling(): void {
    if (!isPollingActive || !pollingInterval) return;

    console.log('🔄 Stopping database watch polling');
    clearInterval(pollingInterval);
    pollingInterval = null;
    isPollingActive = false;
}

// Manual trigger for database change notification (useful after CRUD operations)
export async function notifyDatabaseChangedManually(): Promise<void> {
    // Force refresh of the cache for today's date
    const today = new Date();
    const dateString = formatDateToString(today);
    lastLogs[dateString] = await getFoodLogsByDate(dateString);

    // Notify all listeners
    if (listeners.size > 0) {
        console.log(`🔄 Manually notifying ${listeners.size} database watchers`);
        await Promise.all(
            Array.from(listeners).map(listener => {
                try {
                    return listener();
                } catch (error) {
                    console.error('Error in database change listener:', error);
                    return Promise.resolve();
                }
            })
        );
    }
}

// Last known database state
let lastLogs: Record<string, any[]> = {};

// Polling interval (in milliseconds)
const POLLING_INTERVAL = 10000; // 10 seconds, reduced frequency to prevent database locking conflicts

// Track if polling is active
let pollingInterval: NodeJS.Timeout | null = null;
let isPollingActive = false; 