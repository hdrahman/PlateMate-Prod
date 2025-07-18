import React, { createContext, useContext, ReactNode } from 'react';
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

    return (
        <StepContext.Provider value={stepTracker}>
            {children}
        </StepContext.Provider>
    );
};

// Create a custom hook to use the step context
export const useSteps = () => useContext(StepContext);

export default StepContext; 