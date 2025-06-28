import { useState, useEffect } from 'react';
import BackgroundStepTracker, { BackgroundStepTracker as BackgroundStepTrackerClass } from '../services/BackgroundStepTracker';
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

    // Load initial step data
    useEffect(() => {
        async function loadStepData() {
            setLoading(true);
            try {
                // Get today's steps
                const steps = await BackgroundStepTracker.getTodaySteps();
                setTodaySteps(steps);

                // Get step history
                const history = await BackgroundStepTracker.getStepHistory(historyDays);
                setStepHistory(history);
            } catch (error) {
                console.error('Error loading step data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadStepData();
    }, [historyDays]);

    // Set up step counter listener
    useEffect(() => {
        const unsubscribe = BackgroundStepTracker.addListener((steps) => {
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

        // Cleanup listener on unmount
        return () => {
            unsubscribe();
        };
    }, []);

    // Start tracking steps
    const startTracking = async () => {
        if (!isAvailable) return;

        await BackgroundStepTracker.startTracking();
        setIsTracking(true);
    };

    // Stop tracking steps
    const stopTracking = () => {
        BackgroundStepTracker.stopTracking();
        setIsTracking(false);
    };

    return {
        todaySteps,
        stepHistory,
        isAvailable,
        isTracking,
        startTracking,
        stopTracking,
        loading
    };
} 