import { Pedometer } from 'expo-sensors';
import { updateTodaySteps, getStepsForDate, getStepsHistory } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundStepTracker, { BackgroundStepTracker as BackgroundStepTrackerClass } from '../services/BackgroundStepTracker';

// Keys for AsyncStorage
const LAST_STEP_COUNT_KEY = 'LAST_STEP_COUNT';
const LAST_RESET_DATE_KEY = 'LAST_RESET_DATE';

class StepTracker {
    private isTracking: boolean = false;
    private subscription: { remove: () => void } | null = null;
    private lastStepCount: number = 0;
    private listeners: Set<(steps: number) => void> = new Set();

    constructor() {
        this.initialize();
    }

    private async initialize() {
        try {
            // Get last saved step count
            const lastStepCountStr = await AsyncStorage.getItem(LAST_STEP_COUNT_KEY);
            if (lastStepCountStr) {
                this.lastStepCount = parseInt(lastStepCountStr, 10);
            }

            // Check if we need to reset the counter (new day)
            await this.checkDateAndResetIfNeeded();
        } catch (error) {
            console.error('Error initializing step tracker:', error);
        }
    }

    private async checkDateAndResetIfNeeded() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);

        if (lastResetDate !== today) {
            // It's a new day, reset the step counter
            this.lastStepCount = 0;
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, '0');
            await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
            console.log('Step counter reset for new day:', today);
        }
    }

    // Start tracking steps
    async startTracking() {
        if (this.isTracking) return;

        try {
            const isAvailable = await Pedometer.isAvailableAsync();
            if (!isAvailable) {
                console.error('Pedometer is not available on this device');
                return;
            }

            // Check if we need to reset for a new day
            await this.checkDateAndResetIfNeeded();

            // Subscribe to pedometer updates
            this.subscription = Pedometer.watchStepCount(result => {
                const steps = result.steps;

                // If it's a new tracking session, use the first reading as baseline
                if (this.lastStepCount === 0) {
                    this.lastStepCount = steps;
                    AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString());
                }

                // Calculate steps taken during this tracking session
                const stepsTaken = steps - this.lastStepCount;

                // Get today's date
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

                // Update steps in the database
                updateTodaySteps(stepsTaken)
                    .then(() => {
                        // Notify all listeners
                        this.notifyListeners(stepsTaken);
                    })
                    .catch(error => {
                        console.error('Error updating steps in database:', error);
                    });
            });

            this.isTracking = true;
            console.log('Step tracking started');
        } catch (error) {
            console.error('Error starting step tracking:', error);
        }
    }

    // Stop tracking steps
    stopTracking() {
        if (!this.isTracking || !this.subscription) return;

        this.subscription.remove();
        this.subscription = null;
        this.isTracking = false;
        console.log('Step tracking stopped');
    }

    // Get steps for today
    async getTodaySteps(): Promise<number> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        try {
            return await getStepsForDate(today);
        } catch (error) {
            console.error('Error getting today\'s steps:', error);
            return 0;
        }
    }

    // Get step history
    async getStepHistory(days: number = 7) {
        try {
            return await getStepsHistory(days);
        } catch (error) {
            console.error('Error getting step history:', error);
            return [];
        }
    }

    // Add a listener for step updates
    addListener(callback: (steps: number) => void) {
        this.listeners.add(callback);
        return () => this.removeListener(callback);
    }

    // Remove a listener
    removeListener(callback: (steps: number) => void) {
        this.listeners.delete(callback);
    }

    // Notify all listeners
    private notifyListeners(steps: number) {
        this.listeners.forEach(listener => listener(steps));
    }

    // Check if step tracking is available on this device
    static async isAvailable(): Promise<boolean> {
        return Pedometer.isAvailableAsync();
    }
}

// Create a singleton instance
const stepTracker = new StepTracker();

// Re-export the enhanced background step tracker as the main step tracker
// This maintains compatibility with existing code while providing enhanced functionality
export default BackgroundStepTracker;

// Legacy compatibility exports
export const stepTrackerLegacy = BackgroundStepTracker;

// Re-export key methods for direct usage
export const startTrackingLegacy = () => BackgroundStepTracker.startTracking();
export const stopTrackingLegacy = () => BackgroundStepTracker.stopTracking();
export const getTodayStepsLegacy = () => BackgroundStepTracker.getTodaySteps();
export const getStepHistoryLegacy = (days?: number) => BackgroundStepTracker.getStepHistory(days);
export const isAvailableLegacy = () => BackgroundStepTrackerClass.isAvailable();
export const isCurrentlyTrackingLegacy = () => BackgroundStepTracker.isCurrentlyTracking();
export const addListenerLegacy = (callback: (steps: number) => void) => BackgroundStepTracker.addListener(callback);
export const removeListenerLegacy = (callback: (steps: number) => void) => BackgroundStepTracker.removeListener(callback); 