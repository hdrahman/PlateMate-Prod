import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getFoodLogsByDate as getLocalFoodLogsByDate, addFoodLog as addLocalFoodLog } from '../utils/database';
import { subscribeToDatabaseChanges, unsubscribeFromDatabaseChanges, notifyDatabaseChanged } from '../utils/databaseWatcher';
import { navigateToFoodLog } from '../navigation/RootNavigation';

// Local helper to format date as YYYY-MM-DD
function formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Define types for food log entries
export interface FoodLogEntry {
    id?: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    weight?: number;
    weight_unit?: string;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    notes?: string;
    synced?: number;
    sync_action?: string;
    last_modified?: string;
}

// Define the nutrient totals type
export interface NutrientTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    saturatedFat: number;
    polyunsaturatedFat: number;
    monounsaturatedFat: number;
    transFat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitaminA: number;
    vitaminC: number;
    calcium: number;
    iron: number;
}

// Max number of errors before disabling auto-refresh
const MAX_CONSECUTIVE_ERRORS = 3;

// Context type
interface FoodLogContextType {
    foodLogs: FoodLogEntry[];
    todayLogs: FoodLogEntry[];
    nutrientTotals: NutrientTotals;
    isLoading: boolean;
    hasError: boolean;
    addFoodLog: (foodLog: Omit<FoodLogEntry, 'id'>) => Promise<number | undefined>;
    refreshLogs: (date?: Date) => Promise<void>;
    getTotalsByDate: (date: Date) => Promise<NutrientTotals>;
    getLogsByDate: (date: Date) => Promise<FoodLogEntry[]>;
    startWatchingFoodLogs: () => void;
    stopWatchingFoodLogs: () => void;
    lastUpdated: number; // Timestamp of last update
    forceSingleRefresh: () => Promise<void>;
}

// Create the context with a default value
const FoodLogContext = createContext<FoodLogContextType>({
    foodLogs: [],
    todayLogs: [],
    nutrientTotals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        polyunsaturatedFat: 0,
        monounsaturatedFat: 0,
        transFat: 0,
        cholesterol: 0,
        sodium: 0,
        potassium: 0,
        vitaminA: 0,
        vitaminC: 0,
        calcium: 0,
        iron: 0
    },
    isLoading: true,
    hasError: false,
    addFoodLog: async () => undefined,
    refreshLogs: async () => { },
    getTotalsByDate: async () => ({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        polyunsaturatedFat: 0,
        monounsaturatedFat: 0,
        transFat: 0,
        cholesterol: 0,
        sodium: 0,
        potassium: 0,
        vitaminA: 0,
        vitaminC: 0,
        calcium: 0,
        iron: 0
    }),
    getLogsByDate: async () => [],
    startWatchingFoodLogs: () => { },
    stopWatchingFoodLogs: () => { },
    lastUpdated: 0,
    forceSingleRefresh: async () => { }
});

// Default empty nutrient totals
const emptyTotals: NutrientTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    polyunsaturatedFat: 0,
    monounsaturatedFat: 0,
    transFat: 0,
    cholesterol: 0,
    sodium: 0,
    potassium: 0,
    vitaminA: 0,
    vitaminC: 0,
    calcium: 0,
    iron: 0
};

// Provider component
export const FoodLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
    const [todayLogs, setTodayLogs] = useState<FoodLogEntry[]>([]);
    const [nutrientTotals, setNutrientTotals] = useState<NutrientTotals>(emptyTotals);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
    const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
    const [errorCount, setErrorCount] = useState<number>(0);
    const [isWatching, setIsWatching] = useState<boolean>(false);
    const REFRESH_COOLDOWN = 500; // 500ms cooldown between manual refreshes

    // Use ref to track the current date being displayed
    const currentDateRef = useRef<Date>(new Date());
    const isInitialLoadRef = useRef<boolean>(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Reset error state
    const resetErrorState = useCallback(() => {
        setErrorCount(0);
        setHasError(false);
    }, []);

    // Calculate nutrient totals from logs
    const calculateTotals = (logs: FoodLogEntry[]): NutrientTotals => {
        const totals = { ...emptyTotals };

        logs.forEach(log => {
            totals.protein += log.proteins || 0;
            totals.carbs += log.carbs || 0;
            totals.fat += log.fats || 0;
            totals.calories += log.calories || 0;
            totals.fiber += log.fiber || 0;
            totals.sugar += log.sugar || 0;
            totals.saturatedFat += log.saturated_fat || 0;
            totals.polyunsaturatedFat += log.polyunsaturated_fat || 0;
            totals.monounsaturatedFat += log.monounsaturated_fat || 0;
            totals.transFat += log.trans_fat || 0;
            totals.cholesterol += log.cholesterol || 0;
            totals.sodium += log.sodium || 0;
            totals.potassium += log.potassium || 0;
            totals.vitaminA += log.vitamin_a || 0;
            totals.vitaminC += log.vitamin_c || 0;
            totals.calcium += log.calcium || 0;
            totals.iron += log.iron || 0;
        });

        // Round values for display
        Object.keys(totals).forEach(key => {
            totals[key as keyof NutrientTotals] = Math.round(totals[key as keyof NutrientTotals]);
        });

        return totals;
    };

    // Callback for when database changes are detected
    const handleDatabaseChange = useCallback(async () => {
        console.log('Database change detected, refreshing data');
        await refreshLogs(currentDateRef.current);
    }, []);

    // Refresh logs for a specific date or today
    const refreshLogs = async (date?: Date): Promise<void> => {
        try {
            // Implement refresh cooldown to prevent excessive manual refreshing
            const now = Date.now();
            if (now - lastRefreshTime < REFRESH_COOLDOWN) {
                console.log('Refresh skipped - cooldown period active');
                return;
            }

            setLastRefreshTime(now);

            // Don't block UI with loading state - SQLite queries are fast
            // Only show loading for first-time users with no data
            if (isInitialLoadRef.current && foodLogs.length === 0) {
                setIsLoading(true);
            }

            // Use provided date or default to today
            const targetDate = date || new Date();
            currentDateRef.current = targetDate; // Store current date for change listener
            const dateStr = formatDateToString(targetDate);

            // Fetch logs for the specified date
            console.log('Refreshing food logs for date:', dateStr);

            try {
                const logs = await getLocalFoodLogsByDate(dateStr) as FoodLogEntry[];

                // Update state based on whether we're refreshing today's data or a specific date
                const isTodayData = !date || formatDateToString(date) === formatDateToString(new Date());

                if (isTodayData) {
                    setTodayLogs(logs);
                    setNutrientTotals(calculateTotals(logs));
                }

                // Always update the general foodLogs state
                setFoodLogs(logs);

                // Update timestamp when data is refreshed
                setLastUpdated(Date.now());

                // After first successful load, mark as no longer initial
                if (isInitialLoadRef.current) {
                    isInitialLoadRef.current = false;
                }

                // Reset error count on success
                if (errorCount > 0) {
                    setErrorCount(0);
                    setHasError(false);
                }
            } catch (dbError) {
                console.error('Database error during refresh:', dbError);

                // Increment error count
                const newErrorCount = errorCount + 1;
                setErrorCount(newErrorCount);

                // If we've had too many consecutive errors, disable auto-refresh
                if (newErrorCount >= MAX_CONSECUTIVE_ERRORS) {
                    console.warn(`Too many consecutive errors (${newErrorCount}), disabling auto-refresh`);
                    stopWatchingFoodLogs();
                }

                setHasError(true);
            }
        } catch (error) {
            console.error('Error refreshing food logs:', error);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Load today's logs on mount
    useEffect(() => {
        // Initial load - just once
        const initialLoad = async () => {
            try {
                await refreshLogs();
                resetErrorState();
            } catch (error) {
                console.error("Initial load failed:", error);
                setHasError(true);
            }
        };

        initialLoad();

        // Clean up any subscriptions when unmounting
        return () => {
            stopWatchingFoodLogs();
        };
    }, []);

    // Force a single refresh (for manual actions)
    const forceSingleRefresh = async () => {
        try {
            // No need to set loading state for manual refreshes
            // Keeps previous values during refresh to avoid flickering
            console.log("Forced manual refresh");

            // Use current date
            const dateStr = formatDateToString(currentDateRef.current);
            const logs = await getLocalFoodLogsByDate(dateStr) as FoodLogEntry[];

            // Update directly without loading state
            if (formatDateToString(currentDateRef.current) === formatDateToString(new Date())) {
                setTodayLogs(logs);
                setNutrientTotals(calculateTotals(logs));
            }

            setFoodLogs(logs);
            setLastUpdated(Date.now());

            // Reset error state on successful refresh
            resetErrorState();
        } catch (error) {
            console.error("Forced refresh failed:", error);
            setHasError(true);
        }
    };

    // Start watching food logs
    const startWatchingFoodLogs = useCallback(() => {
        if (isWatching) return;

        console.log('Starting database watch');
        const unsubscribe = subscribeToDatabaseChanges(handleDatabaseChange);
        unsubscribeRef.current = unsubscribe;
        setIsWatching(true);
    }, [isWatching, handleDatabaseChange]);

    // Stop watching food logs
    const stopWatchingFoodLogs = useCallback(() => {
        if (!isWatching || !unsubscribeRef.current) return;

        console.log('Stopping database watch');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        setIsWatching(false);
    }, [isWatching]);

    // Get logs for a specific date
    const getLogsByDate = async (date: Date): Promise<FoodLogEntry[]> => {
        try {
            const dateStr = formatDateToString(date);
            const logs = await getLocalFoodLogsByDate(dateStr) as FoodLogEntry[];
            return logs;
        } catch (error) {
            console.error(`Error getting logs for date ${date}:`, error);
            setHasError(true);
            return [];
        }
    };

    // Get nutrient totals for a specific date
    const getTotalsByDate = async (date: Date): Promise<NutrientTotals> => {
        try {
            const logs = await getLogsByDate(date);
            return calculateTotals(logs);
        } catch (error) {
            console.error(`Error calculating totals for date ${date}:`, error);
            setHasError(true);
            return emptyTotals;
        }
    };

    // Add a new food log entry
    const addFoodLog = async (foodLog: Omit<FoodLogEntry, 'id'>): Promise<number | undefined> => {
        // Immediately navigate the user to the FoodLog screen so they can see the new entry
        navigateToFoodLog();

        try {
            // Start database operation immediately
            const idPromise = addLocalFoodLog(foodLog as any);

            // Update UI state optimistically without waiting for database operation
            // This creates a smoother user experience
            const optimisticLog = { ...foodLog, id: Date.now() } as FoodLogEntry;
            setFoodLogs(prevLogs => [...prevLogs, optimisticLog]);

            // If this is today's log, update today's logs and nutrition totals
            const today = formatDateToString(new Date());
            if (foodLog.date === today) {
                setTodayLogs(prevLogs => [...prevLogs, optimisticLog]);
                setNutrientTotals(prevTotals => {
                    const newTotals = { ...prevTotals };
                    newTotals.calories += foodLog.calories || 0;
                    newTotals.protein += foodLog.proteins || 0;
                    newTotals.carbs += foodLog.carbs || 0;
                    newTotals.fat += foodLog.fats || 0;
                    // Only add values >= 0 (ignore -1 missing values)
                    newTotals.fiber += (foodLog.fiber > 0) ? foodLog.fiber : 0;
                    newTotals.sugar += (foodLog.sugar > 0) ? foodLog.sugar : 0;
                    newTotals.saturatedFat += (foodLog.saturated_fat > 0) ? foodLog.saturated_fat : 0;
                    newTotals.polyunsaturatedFat += (foodLog.polyunsaturated_fat > 0) ? foodLog.polyunsaturated_fat : 0;
                    newTotals.monounsaturatedFat += (foodLog.monounsaturated_fat > 0) ? foodLog.monounsaturated_fat : 0;
                    newTotals.transFat += (foodLog.trans_fat > 0) ? foodLog.trans_fat : 0;
                    newTotals.cholesterol += (foodLog.cholesterol > 0) ? foodLog.cholesterol : 0;
                    newTotals.sodium += (foodLog.sodium > 0) ? foodLog.sodium : 0;
                    newTotals.potassium += (foodLog.potassium > 0) ? foodLog.potassium : 0;
                    newTotals.vitaminA += (foodLog.vitamin_a > 0) ? foodLog.vitamin_a : 0;
                    newTotals.vitaminC += (foodLog.vitamin_c > 0) ? foodLog.vitamin_c : 0;
                    newTotals.calcium += (foodLog.calcium > 0) ? foodLog.calcium : 0;
                    newTotals.iron += (foodLog.iron > 0) ? foodLog.iron : 0;
                    return newTotals;
                });
            }

            // Update timestamp immediately for responsive UI
            setLastUpdated(Date.now());

            // Now wait for the actual database operation to complete
            const id = await idPromise;

            // Notify other components in the background
            setTimeout(async () => {
                try {
                    await notifyDatabaseChanged();
                } catch (notifyError) {
                    console.error('Error notifying database changes:', notifyError);
                    // Continue anyway
                }
            }, 0);

            // Reset error state on successful add
            resetErrorState();

            return id;
        } catch (error) {
            console.error('Error adding food log:', error);
            setHasError(true);

            // Force a refresh to ensure data consistency after error
            forceSingleRefresh().catch(refreshError =>
                console.error('Error refreshing after failed add:', refreshError)
            );

            return undefined;
        }
    };

    return (
        <FoodLogContext.Provider
            value={{
                foodLogs,
                todayLogs,
                nutrientTotals,
                isLoading,
                hasError,
                addFoodLog,
                refreshLogs,
                getTotalsByDate,
                getLogsByDate,
                startWatchingFoodLogs,
                stopWatchingFoodLogs,
                lastUpdated,
                forceSingleRefresh
            }}
        >
            {children}
        </FoodLogContext.Provider>
    );
};

// Custom hook to access the context
export const useFoodLog = () => useContext(FoodLogContext); 