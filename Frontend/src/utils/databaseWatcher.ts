import { getFoodLogsByDate } from './database';

// Define a type for database change callback functions
type DatabaseChangeCallback = () => Promise<void>;

// Store for change listeners
const changeListeners: Set<DatabaseChangeCallback> = new Set();

// Last known database state
let lastLogs: Record<string, any[]> = {};

// Polling interval (in milliseconds)
const POLLING_INTERVAL = 5000; // 5 seconds, which is efficient but responsive

// Track if polling is active
let pollingInterval: NodeJS.Timeout | null = null;
let isPollingActive = false;

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
            if (changeListeners.size > 0) {
                await Promise.all(
                    Array.from(changeListeners).map(callback => {
                        try {
                            return callback();
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

// Subscribe to database changes
export function watchDatabaseChanges(callback: DatabaseChangeCallback): () => void {
    // Add the callback to our listeners
    changeListeners.add(callback);
    console.log(`🔄 Added database watcher (total: ${changeListeners.size})`);

    // Start polling if this is the first listener
    if (changeListeners.size === 1) {
        startPolling();
    }

    // Return an unsubscribe function
    return () => unwatchDatabaseChanges(callback);
}

// Unsubscribe from database changes
export function unwatchDatabaseChanges(callback: DatabaseChangeCallback): void {
    // Remove the callback
    changeListeners.delete(callback);
    console.log(`🔄 Removed database watcher (remaining: ${changeListeners.size})`);

    // Stop polling if there are no more listeners
    if (changeListeners.size === 0) {
        stopPolling();
    }
}

// Manual trigger for database change notification (useful after CRUD operations)
export async function notifyDatabaseChanged(): Promise<void> {
    // Force refresh of the cache for today's date
    const today = new Date();
    const dateString = formatDateToString(today);
    lastLogs[dateString] = await getFoodLogsByDate(dateString);

    // Notify all listeners
    if (changeListeners.size > 0) {
        console.log(`🔄 Manually notifying ${changeListeners.size} database watchers`);
        await Promise.all(
            Array.from(changeListeners).map(callback => {
                try {
                    return callback();
                } catch (error) {
                    console.error('Error in database change listener:', error);
                    return Promise.resolve();
                }
            })
        );
    }
} 