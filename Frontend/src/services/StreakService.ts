import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';
import SettingsService from './SettingsService';

interface StreakData {
    type: string;
    currentStreak: number;
    lastActivityDate: string; // YYYY-MM-DD format
    bestStreak: number;
    lastCelebrationDay: number; // Prevent spam
}

interface GoalData {
    type: string;
    target: number;
    current: number;
    achieved: boolean;
    date: string; // YYYY-MM-DD format
}

class StreakService {
    private static instance: StreakService;
    private readonly STREAKS_KEY = 'user_streaks';
    private readonly GOALS_KEY = 'daily_goals';

    public static getInstance(): StreakService {
        if (!StreakService.instance) {
            StreakService.instance = new StreakService();
        }
        return StreakService.instance;
    }

    async recordActivity(activityType: string): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const streaks = await this.getStreaks();
            
            let streak = streaks.find(s => s.type === activityType);
            if (!streak) {
                streak = {
                    type: activityType,
                    currentStreak: 0,
                    lastActivityDate: '',
                    bestStreak: 0,
                    lastCelebrationDay: 0
                };
                streaks.push(streak);
            }

            // Check if this is consecutive day
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (streak.lastActivityDate === yesterdayStr) {
                // Consecutive day - increment streak
                streak.currentStreak++;
            } else if (streak.lastActivityDate === today) {
                // Already recorded today - don't change streak
                return;
            } else {
                // Gap in streak - reset to 1
                streak.currentStreak = 1;
            }

            streak.lastActivityDate = today;
            
            // Update best streak
            if (streak.currentStreak > streak.bestStreak) {
                streak.bestStreak = streak.currentStreak;
            }

            await this.saveStreaks(streaks);

            // Check for celebration milestones
            await this.checkForStreakCelebration(streak);

            console.log(`📈 ${activityType} streak: ${streak.currentStreak} days`);
        } catch (error) {
            console.error('Error recording activity:', error);
        }
    }

    private async checkForStreakCelebration(streak: StreakData): Promise<void> {
        try {
            const settings = await SettingsService.getNotificationSettings();
            
            if (!settings.behavioralNotifications?.streakCelebrations || !settings.generalSettings.enabled) {
                return;
            }

            // Celebrate at key milestones (3, 7, 14, 30, 60, 100 days)
            const milestones = [3, 7, 14, 30, 60, 100];
            const currentStreak = streak.currentStreak;

            if (milestones.includes(currentStreak) && streak.lastCelebrationDay !== currentStreak) {
                await NotificationService.showStreakNotification(
                    streak.type,
                    currentStreak,
                    settings.generalSettings.savageMode
                );

                // Update to prevent duplicate celebrations
                streak.lastCelebrationDay = currentStreak;
                const streaks = await this.getStreaks();
                const index = streaks.findIndex(s => s.type === streak.type);
                if (index !== -1) {
                    streaks[index] = streak;
                    await this.saveStreaks(streaks);
                }
            }
        } catch (error) {
            console.error('Error checking streak celebration:', error);
        }
    }

    async recordGoalProgress(goalType: string, value: number, target: number): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const goals = await this.getGoals();
            
            let goal = goals.find(g => g.type === goalType && g.date === today);
            if (!goal) {
                goal = {
                    type: goalType,
                    target,
                    current: 0,
                    achieved: false,
                    date: today
                };
                goals.push(goal);
            }

            const previousValue = goal.current;
            goal.current = Math.max(goal.current, value); // Take the higher value
            goal.achieved = goal.current >= goal.target;

            await this.saveGoals(goals);

            // Check for goal achievement notification
            if (!goal.achieved && previousValue < goal.target && goal.current >= goal.target) {
                await this.celebrateGoalAchievement(goalType, goal.current, goal.target);
            }

            console.log(`🎯 ${goalType} progress: ${goal.current}/${goal.target} (${Math.round((goal.current/goal.target)*100)}%)`);
        } catch (error) {
            console.error('Error recording goal progress:', error);
        }
    }

    private async celebrateGoalAchievement(goalType: string, value: number, target: number): Promise<void> {
        try {
            const settings = await SettingsService.getNotificationSettings();
            
            if (!settings.statusNotifications?.goalAchievements || !settings.generalSettings.enabled) {
                return;
            }

            await NotificationService.showGoalAchievementNotification(
                goalType,
                value,
                target,
                settings.generalSettings.savageMode
            );
        } catch (error) {
            console.error('Error celebrating goal achievement:', error);
        }
    }

    async getStreakSummary(): Promise<{ [key: string]: number }> {
        const streaks = await this.getStreaks();
        const summary: { [key: string]: number } = {};
        
        for (const streak of streaks) {
            summary[streak.type] = streak.currentStreak;
        }
        
        return summary;
    }

    async checkForInactivity(): Promise<void> {
        try {
            const settings = await SettingsService.getNotificationSettings();
            
            if (!settings.behavioralNotifications?.plateauBreaking || !settings.generalSettings.enabled) {
                return;
            }

            const streaks = await this.getStreaks();
            const today = new Date();
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(today.getDate() - 3);

            for (const streak of streaks) {
                const lastActivity = new Date(streak.lastActivityDate + 'T00:00:00');
                
                if (lastActivity < threeDaysAgo && streak.currentStreak > 0) {
                    // User has been inactive for 3+ days, send motivational notification
                    await this.sendInactivityReminder(streak.type, settings.generalSettings.savageMode);
                }
            }
        } catch (error) {
            console.error('Error checking for inactivity:', error);
        }
    }

    private async sendInactivityReminder(activityType: string, savageMode: boolean): Promise<void> {
        const title = savageMode ? 
            `Where Did You Go? 🤔` : 
            `We Miss You! 💙`;
            
        const body = savageMode ?
            `It's been 3 days since you logged ${activityType}. Did you give up or just forget we exist? 😏` :
            `It's been a few days since your last ${activityType} entry. Ready to get back on track? 🚀`;

        await NotificationService.showImmediateNotification(title, body, { 
            type: 'inactivity_reminder', 
            activityType,
            action: 'open_app'
        });
    }

    private async getStreaks(): Promise<StreakData[]> {
        try {
            const stored = await AsyncStorage.getItem(this.STREAKS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error getting streaks:', error);
            return [];
        }
    }

    private async saveStreaks(streaks: StreakData[]): Promise<void> {
        try {
            await AsyncStorage.setItem(this.STREAKS_KEY, JSON.stringify(streaks));
        } catch (error) {
            console.error('Error saving streaks:', error);
        }
    }

    private async getGoals(): Promise<GoalData[]> {
        try {
            const stored = await AsyncStorage.getItem(this.GOALS_KEY);
            const goals: GoalData[] = stored ? JSON.parse(stored) : [];
            
            // Clean up old goals (keep only last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
            
            return goals.filter(goal => goal.date >= cutoffDate);
        } catch (error) {
            console.error('Error getting goals:', error);
            return [];
        }
    }

    private async saveGoals(goals: GoalData[]): Promise<void> {
        try {
            await AsyncStorage.setItem(this.GOALS_KEY, JSON.stringify(goals));
        } catch (error) {
            console.error('Error saving goals:', error);
        }
    }

    // Method to start periodic inactivity checks
    async startInactivityMonitoring(): Promise<void> {
        // Check once daily for inactivity
        setInterval(() => {
            this.checkForInactivity();
        }, 24 * 60 * 60 * 1000); // 24 hours

        console.log('📊 Streak and inactivity monitoring started');
    }
}

export default StreakService.getInstance();