import React, { useContext } from 'react';
import { useGamification } from '../../context/GamificationContext';
import AchievementPopup from './AchievementPopup';
import LevelUpPopup from './LevelUpPopup';
import { ThemeContext } from '../../ThemeContext';

/**
 * GamificationManager - Global component that handles gamification popups
 * This should be included once at the app level to manage level up and achievement popups
 */
const GamificationManager: React.FC = () => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const {
        achievementPopup,
        levelUpPopup,
        hideAchievementPopup,
        hideLevelUpPopup,
    } = useGamification();

    return (
        <>
            {/* Achievement Popup */}
            <AchievementPopup
                achievement={achievementPopup.achievement}
                visible={achievementPopup.visible}
                onClose={hideAchievementPopup}
            />

            {/* Level Up Popup */}
            <LevelUpPopup
                visible={levelUpPopup.visible}
                newLevel={levelUpPopup.newLevel}
                newRank={levelUpPopup.newRank}
                levelsGained={levelUpPopup.levelsGained}
                onClose={hideLevelUpPopup}
            />
        </>
    );
};

export default GamificationManager; 