// databaseWatcher.ts
// This file provides an event-driven notification system for database changes
// with support for table-specific subscriptions to minimize unnecessary re-renders.

type DatabaseChangeListenerCallback = () => void | Promise<void>;

// Store for all registered listeners and their specific table interests
// Key: Listener function
// Value: Array of table names to listen for (e.g., ['food_logs', 'water_intake'])
//        OR null to listen for ALL changes (legacy behavior)
const listeners: Map<DatabaseChangeListenerCallback, string[] | null> = new Map();

// Debouncing and loop prevention
let isNotifying = false;
let notificationTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 1000;

// Accumulate changed tables during debounce period
let pendingChangedTables: Set<string> | null = new Set(); // null means "all tables/unknown"

// Interface for notification options
export interface NotificationOptions {
    tables?: string[]; // Optional list of tables that changed
}

/**
 * Notify listeners that the database has changed.
 * 
 * @param options Object containing details about what changed (e.g., { tables: ['food_logs'] })
 *                If options.tables is omitted, it is treated as a generic "everything changed" event.
 */
export const notifyDatabaseChanged = async (options?: NotificationOptions | string): Promise<void> => {
    // Handle legacy string argument (source) if passed (though we prefer object now)
    const tables = (typeof options === 'object' && options.tables) ? options.tables : undefined;

    // Add tables to the pending set
    if (tables) {
        // If we haven't already fallen back to "all tables" (null), add specific tables
        if (pendingChangedTables !== null) {
            tables.forEach(t => pendingChangedTables!.add(t));
        }
    } else {
        // If no specific tables provided, marks as "all/unknown" change
        pendingChangedTables = null;
    }

    // Clear any pending notification timer to restart debounce
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    // Debounce notifications
    notificationTimeout = setTimeout(async () => {
        if (isNotifying) {
            console.log('🔄 Skipping notification - already in progress');
            return;
        }

        isNotifying = true;

        try {
            const affectedTables = pendingChangedTables ? Array.from(pendingChangedTables) : 'ALL';
            console.log(`🔔 Notifying database change listeners. Affected tables: ${JSON.stringify(affectedTables)}`);

            // Execute eligible listeners
            // We need to clone the listeners to avoid concurrent modification issues if a listener unsubscribes during execution
            const listenersToNotify = new Map(listeners);

            listenersToNotify.forEach((subscribedTables, listener) => {
                let shouldNotify = false;

                if (pendingChangedTables === null) {
                    // Global change occurred -> Notify everyone
                    shouldNotify = true;
                } else if (!subscribedTables) {
                    // Listener wants everything -> Notify
                    shouldNotify = true;
                } else {
                    // Listener wants specific tables -> Check intersection
                    // If ANY of the changed tables matches ANY of the subscribed tables -> Notify
                    for (const changedTable of pendingChangedTables) {
                        if (subscribedTables.includes(changedTable)) {
                            shouldNotify = true;
                            break;
                        }
                    }
                }

                if (shouldNotify) {
                    try {
                        const result = listener();
                        if (result instanceof Promise) {
                            result.catch(err => console.error('❌ Error in async database change listener:', err));
                        }
                    } catch (error) {
                        console.error('❌ Error in database change listener:', error);
                    }
                }
            });
        } finally {
            isNotifying = false;
            // Reset pending tables for next batch
            pendingChangedTables = new Set();
        }
    }, DEBOUNCE_MS);
};

/**
 * Subscribe to database changes.
 * 
 * @param listener Function to call when database changes
 * @param tables Optional array of table names to listen for. If omitted, listens to ALL changes.
 * @returns Function to unsubscribe
 */
export const subscribeToDatabaseChanges = (
    listener: DatabaseChangeListenerCallback,
    tables?: string[]
): () => void => {
    const tableLog = tables ? `[${tables.join(', ')}]` : 'ALL';
    console.log(`📲 Adding database change listener for tables: ${tableLog}`);

    listeners.set(listener, tables || null);

    // Return unsubscribe function
    return () => unsubscribeFromDatabaseChanges(listener);
};

/**
 * Unsubscribe from database changes
 * @param listener Function to remove
 */
export const unsubscribeFromDatabaseChanges = (listener: DatabaseChangeListenerCallback): void => {
    console.log('📴 Removing database change listener');
    listeners.delete(listener);
};

/**
 * Manual trigger primarily for testing or legacy calls
 */
export async function notifyDatabaseChangedManually(): Promise<void> {
    await notifyDatabaseChanged(); // Generic update
}

// Deprecated polling methods - strictly no-op now to prevent event storms
// Keeping them exported but empty to avoid breaking legacy imports that might call them
export const startPolling = () => { console.log('Polling is deprecated and disabled'); };
export const stopPolling = () => { };