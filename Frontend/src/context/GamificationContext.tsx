import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import GamificationService, {
    Achievement,
    GamificationStatus,
    XPAwardResult
} from '../services/GamificationService';
import { auth } from '../utils/firebase';

interface GamificationContextType {
    status: GamificationStatus | null;
    achievements: Achievement[];
    isLoading: boolean;
    error: string | null;

    // State for popups
    achievementPopup: {
        visible: boolean;
        achievement: Achievement | null;
    };
    levelUpPopup: {
        visible: boolean;
        newLevel: number;
        newRank: string;
        levelsGained: number;
    };

    // Actions
    refreshStatus: () => Promise<void>;
    refreshAchievements: () => Promise<void>;
    awardXP: (action: string, amount?: number) => Promise<XPAwardResult | null>;
    showAchievementPopup: (achievement: Achievement) => void;
    hideAchievementPopup: () => void;
    showLevelUpPopup: (level: number, rank: string, levelsGained?: number) => void;
    hideLevelUpPopup: () => void;
    checkForNewAchievements: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<GamificationStatus | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Popup states
    const [achievementPopup, setAchievementPopup] = useState({
        visible: false,
        achievement: null as Achievement | null,
    });

    const [levelUpPopup, setLevelUpPopup] = useState({
        visible: false,
        newLevel: 1,
        newRank: 'Beginner',
        levelsGained: 1,
    });

    // Refresh gamification status
    const refreshStatus = useCallback(async () => {
        if (!auth.currentUser) return;

        try {
            setIsLoading(true);
            setError(null);
            const newStatus = await GamificationService.getStatus();
            setStatus(newStatus);
        } catch (err) {
            setError('Failed to load gamification status');
            console.error('Error refreshing gamification status:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Refresh achievements
    const refreshAchievements = useCallback(async () => {
        if (!auth.currentUser) return;

        try {
            setError(null);
            const newAchievements = await GamificationService.getAchievements();
            setAchievements(newAchievements);
        } catch (err) {
            setError('Failed to load achievements');
            console.error('Error refreshing achievements:', err);
        }
    }, []);

    // Award XP and handle popups
    const awardXP = useCallback(async (action: string, amount?: number): Promise<XPAwardResult | null> => {
        if (!auth.currentUser) return null;

        try {
            const result = await GamificationService.awardXP(action, amount);

            if (result.success) {
                // Update local status
                await refreshStatus();

                // Show level up popup if user leveled up
                if (result.level_up && result.new_rank) {
                    showLevelUpPopup(result.level, result.new_rank, result.levels_gained);
                }

                // Show achievement popups for new achievements
                if (result.new_achievements && result.new_achievements.length > 0) {
                    // Show the first achievement immediately
                    showAchievementPopup(result.new_achievements[0]);

                    // If there are multiple achievements, show them sequentially
                    if (result.new_achievements.length > 1) {
                        for (let i = 1; i < result.new_achievements.length; i++) {
                            setTimeout(() => {
                                showAchievementPopup(result.new_achievements[i]);
                            }, i * 4000); // 4 seconds between each achievement popup
                        }
                    }

                    // Refresh achievements list
                    await refreshAchievements();
                }
            }

            return result;
        } catch (err) {
            console.error('Error awarding XP:', err);
            return null;
        }
    }, [refreshStatus, refreshAchievements]);

    // Check for new achievements manually
    const checkForNewAchievements = useCallback(async () => {
        if (!auth.currentUser) return;

        try {
            const result = await GamificationService.checkAchievements();

            if (result.new_achievements && result.new_achievements.length > 0) {
                // Show achievement popups
                result.new_achievements.forEach((achievement, index) => {
                    setTimeout(() => {
                        showAchievementPopup(achievement);
                    }, index * 4000);
                });

                // Refresh data
                await Promise.all([refreshStatus(), refreshAchievements()]);
            }
        } catch (err) {
            console.error('Error checking for new achievements:', err);
        }
    }, [refreshStatus, refreshAchievements]);

    // Popup control functions
    const showAchievementPopup = useCallback((achievement: Achievement) => {
        setAchievementPopup({
            visible: true,
            achievement,
        });
    }, []);

    const hideAchievementPopup = useCallback(() => {
        setAchievementPopup({
            visible: false,
            achievement: null,
        });
    }, []);

    const showLevelUpPopup = useCallback((level: number, rank: string, levelsGained: number = 1) => {
        setLevelUpPopup({
            visible: true,
            newLevel: level,
            newRank: rank,
            levelsGained,
        });
    }, []);

    const hideLevelUpPopup = useCallback(() => {
        setLevelUpPopup({
            visible: false,
            newLevel: 1,
            newRank: 'Beginner',
            levelsGained: 1,
        });
    }, []);

    // Initialize data when user changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                // User signed in, load gamification data
                refreshStatus();
                refreshAchievements();
            } else {
                // User signed out, clear data
                setStatus(null);
                setAchievements([]);
                setError(null);
            }
        });

        return unsubscribe;
    }, [refreshStatus, refreshAchievements]);

    const value: GamificationContextType = {
        status,
        achievements,
        isLoading,
        error,
        achievementPopup,
        levelUpPopup,
        refreshStatus,
        refreshAchievements,
        awardXP,
        showAchievementPopup,
        hideAchievementPopup,
        showLevelUpPopup,
        hideLevelUpPopup,
        checkForNewAchievements,
    };

    return (
        <GamificationContext.Provider value={value}>
            {children}
        </GamificationContext.Provider>
    );
};

export const useGamification = (): GamificationContextType => {
    const context = useContext(GamificationContext);
    if (!context) {
        throw new Error('useGamification must be used within a GamificationProvider');
    }
    return context;
};

export default GamificationContext; 