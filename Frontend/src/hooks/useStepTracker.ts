import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UnifiedStepTracker from '../services/UnifiedStepTracker';
import { Pedometer } from 'expo-sensors';

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

                // Wait for UnifiedStepTracker to be initialized (with shorter timeout)
                if (!UnifiedStepTracker.isInitialized()) {
                    console.log('⏳ Waiting for UnifiedStepTracker initialization...');
                    let retries = 0;
                    const maxRetries = 30; // 3 seconds with 100ms intervals (reduced from 5s)
                    
                    while (!UnifiedStepTracker.isInitialized() && retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        retries++;
                    }
                    
                    if (!UnifiedStepTracker.isInitialized()) {
                        console.warn('⚠️ UnifiedStepTracker not initialized after timeout, using cached data');
                        // Keep the cached value we already set
                        const today = new Date().toISOString().split('T')[0];
                        setStepHistory([{ date: today, steps: initialSteps }]);
                        return;
                    }
                }

                // Get authoritative steps from tracker
                const trackerSteps = UnifiedStepTracker.getCurrentSteps();
                
                // Use the higher value between cached and tracker
                const finalSteps = Math.max(initialSteps, trackerSteps);
                
                if (finalSteps !== initialSteps) {
                    setTodaySteps(finalSteps);
                    console.log(`📊 Updated steps from tracker: ${initialSteps} → ${finalSteps}`);
                }

                // Get step history (simplified for now - unified tracker focuses on today)
                const today = new Date().toISOString().split('T')[0];
                const history = [{ date: today, steps: finalSteps }];
                setStepHistory(history);
                
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

    // Set up step counter listener
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        
        // Only set up listener if tracker is initialized
        if (UnifiedStepTracker.isInitialized()) {
            try {
                unsubscribe = UnifiedStepTracker.addListener((steps) => {
                    setTodaySteps(steps);

                    // Also update history for today
                    setStepHistory(prevHistory => {
                        // Look for today's date in the history
                        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
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

                // Update tracking status
                setIsTracking(UnifiedStepTracker.isTracking());
                console.log('✅ Step counter listener set up successfully');
            } catch (error) {
                console.error('❌ Error setting up step counter listener:', error);
            }
        } else {
            console.log('⏳ Deferring listener setup until tracker is initialized');
        }

        // Cleanup listener on unmount
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    // Start tracking steps
    const startTracking = async () => {
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
    };

    // Stop tracking steps
    const stopTracking = async () => {
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
    };

    // Refresh step data (useful when steps are manually added)
    const refreshStepData = async () => {
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
            const today = new Date().toISOString().split('T')[0];
            const history = [{ date: today, steps }];
            setStepHistory(history);
            
            console.log('✅ Step data refreshed');
        } catch (error) {
            console.error('❌ Error refreshing step data:', error);
        }
    };

    // Set calorie goal for notifications (simplified - UnifiedStepTracker doesn't have this method)
    const setCalorieGoal = async (calories: number) => {
        // UnifiedStepTracker focuses on step counting, not calorie goals
        console.log('Calorie goal setting not implemented in UnifiedStepTracker');
    };

    return {
        todaySteps,
        stepHistory,
        isAvailable,
        isTracking,
        startTracking,
        stopTracking,
        refreshStepData,
        setCalorieGoal,
        loading
    };
} 