import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import useStepTracker, { StepHistoryItem, UseStepTrackerResult } from '../hooks/useStepTracker';

// Create the context with a default value
const StepContext = createContext<UseStepTrackerResult>({
    todaySteps: 0,
    stepHistory: [],
    isAvailable: false,
    isTracking: false,
    startTracking: async () => { },
    stopTracking: () => { },
    refreshStepData: async () => { },
    loading: true
});

// Create a provider component
export const StepProvider = ({ children }: { children: ReactNode }) => {
    const stepTracker = useStepTracker();

    // Memoize the context value to prevent unnecessary re-renders of consumers
    // Only re-create when actual data values change
    const contextValue = useMemo(() => stepTracker, [
        stepTracker.todaySteps,
        stepTracker.stepHistory,
        stepTracker.isAvailable,
        stepTracker.isTracking,
        stepTracker.loading,
        stepTracker.startTracking,
        stepTracker.stopTracking,
        stepTracker.refreshStepData,
        stepTracker.setCalorieGoal
    ]);

    return (
        <StepContext.Provider value={contextValue}>
            {children}
        </StepContext.Provider>
    );
};

// Create a custom hook to use the step context
export const useSteps = () => useContext(StepContext);

export default StepContext; 