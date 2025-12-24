import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UnifiedStepTracker from '../services/UnifiedStepTracker';
import StepEventBus from '../services/StepEventBus';
import { Pedometer } from 'expo-sensors';
import { formatDateToString } from '../utils/dateUtils';

export interface StepHistoryItem {
    date: string;
    steps: number;
}

export interface UseStepTrackerResult {
    todaySteps: number;
    stepHistory: StepHistoryItem[];
    isAvailable: boolean;
    isTracking: boolean;
    startTracking: () => Promise<void>;
    stopTracking: () => void;
    refreshStepData: () => Promise<void>;
    setCalorieGoal: (calories: number) => Promise<void>;
    loading: boolean;
}

export default function useStepTracker(historyDays: number = 7): UseStepTrackerResult {
    const [todaySteps, setTodaySteps] = useState<number>(0);
    const [stepHistory, setStepHistory] = useState<StepHistoryItem[]>([]);
    const [isAvailable, setIsAvailable] = useState<boolean>(false);
    const [isTracking, setIsTracking] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Check if pedometer is available on this device
    useEffect(() => {
        async function checkAvailability() {
            try {
                const available = await Pedometer.isAvailableAsync();
                setIsAvailable(available);
            } catch (error) {
                console.error('Error checking step tracking availability:', error);
                setIsAvailable(false);
            }
        }

        checkAvailability();
    }, []);

    // Load initial step data with improved error handling and progressive loading
    useEffect(() => {
        async function loadStepData() {
            setLoading(true);
            try {
                // Start with immediate loading from available sources
                let initialSteps = 0;

                // Try to get cached steps immediately (fastest) - use correct key
                try {
                    const cached = await AsyncStorage.getItem('UNIFIED_LAST_STEP_COUNT');
                    if (cached) {
                        initialSteps = parseInt(cached, 10) || 0;
                        setTodaySteps(initialSteps);
                        console.log(`📱 Loaded cached steps immediately: ${initialSteps}`);
                    } else {
                        console.log('📱 No cached steps found, starting with 0');
                    }
                } catch (error) {
                    console.error('❌ Failed to load cached steps (AsyncStorage error):', error);
                    console.error('❌ This indicates a missing import or AsyncStorage configuration issue');
                }

                // Show cached data immediately, sync in background
                let finalSteps = initialSteps;

                // Set initial history with cached data right away
                const today = formatDateToString(new Date());
                setStepHistory([{ date: today, steps: initialSteps }]);

                // If tracker isn't initialized yet, continue with cached data
                if (!UnifiedStepTracker.isInitialized()) {
                    console.log('📱 Using cached steps while tracker initializes in background');
                    // Start background initialization but don't wait
                    setTimeout(async () => {
                        // Give tracker time to initialize in background
                        let retries = 0;
                        const maxRetries = 10; // Reduced retries, non-blocking

                        while (!UnifiedStepTracker.isInitialized() && retries < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                            retries++;
                        }

                        if (UnifiedStepTracker.isInitialized()) {
                            // Update with tracker data when ready
                            const trackerSteps = UnifiedStepTracker.getCurrentSteps();
                            if (trackerSteps > finalSteps) {
                                setTodaySteps(trackerSteps);
                                setStepHistory([{ date: today, steps: trackerSteps }]);
                                console.log('📊 Background step update:', trackerSteps);
                            }
                        }
                    }, 0);
                    return; // Don't block, continue with cached data
                }

                // Get authoritative steps from tracker
                const trackerSteps = UnifiedStepTracker.getCurrentSteps();

                // Use the higher value between cached and tracker
                finalSteps = Math.max(initialSteps, trackerSteps);

                if (finalSteps !== initialSteps) {
                    setTodaySteps(finalSteps);
                    console.log(`📊 Updated steps from tracker: ${initialSteps} → ${finalSteps}`);
                }

                // Force a sync to ensure we have latest data
                try {
                    await UnifiedStepTracker.forceSync();
                    const syncedSteps = UnifiedStepTracker.getCurrentSteps();
                    if (syncedSteps > finalSteps) {
                        setTodaySteps(syncedSteps);
                        finalSteps = syncedSteps;
                        console.log(`📊 Updated steps after force sync: ${finalSteps} → ${syncedSteps}`);
                    }
                } catch (error) {
                    console.warn('⚠️ Force sync failed during load:', error);
                }

                // Update step history with final synced data
                setStepHistory([{ date: today, steps: finalSteps }]);

                console.log('✅ Step data loaded successfully');
            } catch (error) {
                console.error('❌ Error loading step data:', error);
                // Keep any cached value we managed to load, or use 0
                if (todaySteps === 0) {
                    setTodaySteps(0);
                    setStepHistory([]);
                }
            } finally {
                setLoading(false);
            }
        }

        loadStepData();
    }, [historyDays]);

    // Simple direct step counter subscription (replicates notification approach)
    useEffect(() => {
        let mounted = true;

        // Direct subscription to EventBus - no complex initialization needed
        const unsubscribe = StepEventBus.subscribe((steps) => {
            if (!mounted) return; // Don't update if component unmounted

            console.log(`📱 Direct step update received: ${steps}`);
            setTodaySteps(steps);

            // Update history for today
            setStepHistory(prevHistory => {
                const today = formatDateToString(new Date());
                const todayIndex = prevHistory.findIndex(item => item.date === today);

                if (todayIndex >= 0) {
                    // Update today's entry
                    const newHistory = [...prevHistory];
                    newHistory[todayIndex] = { ...newHistory[todayIndex], steps };
                    return newHistory;
                } else {
                    // Add a new entry for today
                    return [...prevHistory, { date: today, steps }];
                }
            });
        });

        // Update tracking status if tracker is available
        if (UnifiedStepTracker.isInitialized()) {
            setIsTracking(UnifiedStepTracker.isTracking());
        }

        console.log('✅ Direct step subscription set up successfully');

        // Simple cleanup on unmount
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    // Start tracking steps
    const startTracking = useCallback(async () => {
        if (!isAvailable) {
            console.warn('⚠️ Step tracking not available on this device');
            return;
        }

        if (!UnifiedStepTracker.isInitialized()) {
            console.warn('⚠️ UnifiedStepTracker not initialized, cannot start tracking');
            return;
        }

        try {
            await UnifiedStepTracker.startTracking();
            setIsTracking(UnifiedStepTracker.isTracking());
            console.log('✅ Step tracking started from hook');
        } catch (error) {
            console.error('❌ Error starting step tracking from hook:', error);
        }
    }, [isAvailable]);

    // Stop tracking steps
    const stopTracking = useCallback(async () => {
        if (!UnifiedStepTracker.isInitialized()) {
            console.warn('⚠️ UnifiedStepTracker not initialized, cannot stop tracking');
            return;
        }

        try {
            await UnifiedStepTracker.stopTracking();
            setIsTracking(UnifiedStepTracker.isTracking());
            console.log('✅ Step tracking stopped from hook');
        } catch (error) {
            console.error('❌ Error stopping step tracking from hook:', error);
        }
    }, []);

    // Refresh step data (useful when steps are manually added)
    const refreshStepData = useCallback(async () => {
        if (!UnifiedStepTracker.isInitialized()) {
            console.warn('⚠️ UnifiedStepTracker not initialized, cannot refresh data');
            return;
        }

        try {
            console.log('🔄 Refreshing step data...');

            // Get updated today's steps
            const steps = UnifiedStepTracker.getCurrentSteps();
            setTodaySteps(steps);

            // Update history for today
            const today = formatDateToString(new Date());
            const history = [{ date: today, steps }];
            setStepHistory(history);

            console.log('✅ Step data refreshed');
        } catch (error) {
            console.error('❌ Error refreshing step data:', error);
        }
    }, []);

    // Set calorie goal for notifications (simplified - UnifiedStepTracker doesn't have this method)
    const setCalorieGoal = useCallback(async (calories: number) => {
        // UnifiedStepTracker focuses on step counting, not calorie goals
        console.log('Calorie goal setting not implemented in UnifiedStepTracker');
    }, []);

    // Memoize the return value to prevent unnecessary re-renders
    return useMemo(() => ({
        todaySteps,
        stepHistory,
        isAvailable,
        isTracking,
        startTracking,
        stopTracking,
        refreshStepData,
        setCalorieGoal,
        loading
    }), [
        todaySteps,
        stepHistory,
        isAvailable,
        isTracking,
        startTracking,
        stopTracking,
        refreshStepData,
        setCalorieGoal,
        loading
    ]);
} 