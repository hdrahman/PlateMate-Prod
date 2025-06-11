import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { auth } from '../utils/firebase';

export interface Achievement {
    id: number;
    name: string;
    description: string;
    icon?: string;
    xp_reward: number;
    completed: boolean;
    completed_at?: string;
}

export interface GamificationStatus {
    level: number;
    xp: number;
    xp_to_next_level: number;
    rank: string;
    streak_days: number;
    total_achievements: number;
    completed_achievements: number;
}

export interface XPAwardResult {
    success: boolean;
    xp_awarded: number;
    total_xp: number;
    level: number;
    level_up: boolean;
    levels_gained?: number;
    new_rank?: string;
    new_achievements: Achievement[];
}

export interface LeaderboardEntry {
    rank: number;
    user_id: number;
    name: string;
    level: number;
    xp: number;
    rank_title: string;
    streak_days: number;
}

class GamificationService {
    private baseURL = `${BACKEND_URL}/gamification`;

    private async getHeaders() {
        const token = await auth.currentUser?.getIdToken(true);
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }

    // Get current gamification status
    async getStatus(): Promise<GamificationStatus> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${this.baseURL}/status`, { headers });
            return response.data;
        } catch (error) {
            console.error('Error fetching gamification status:', error);
            throw error;
        }
    }

    // Award XP for an action
    async awardXP(action: string, amount?: number): Promise<XPAwardResult> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.post(
                `${this.baseURL}/award-xp`,
                { action, amount },
                { headers }
            );
            return response.data;
        } catch (error) {
            console.error('Error awarding XP:', error);
            throw error;
        }
    }

    // Update user's activity streak
    async updateStreak(): Promise<any> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.post(`${this.baseURL}/update-streak`, {}, { headers });
            return response.data;
        } catch (error) {
            console.error('Error updating streak:', error);
            throw error;
        }
    }

    // Get all achievements
    async getAchievements(): Promise<Achievement[]> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${this.baseURL}/achievements`, { headers });
            return response.data;
        } catch (error) {
            console.error('Error fetching achievements:', error);
            throw error;
        }
    }

    // Check for new achievements
    async checkAchievements(): Promise<{ new_achievements: Achievement[] }> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.post(`${this.baseURL}/check-achievements`, {}, { headers });
            return response.data;
        } catch (error) {
            console.error('Error checking achievements:', error);
            throw error;
        }
    }

    // Get leaderboard
    async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${this.baseURL}/leaderboard?limit=${limit}`, { headers });
            return response.data;
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            throw error;
        }
    }

    // Get XP reward information
    async getXPRewards(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseURL}/xp-rewards`);
            return response.data;
        } catch (error) {
            console.error('Error fetching XP rewards:', error);
            throw error;
        }
    }

    // Helper method to award XP for common actions
    async awardFoodLogXP(): Promise<XPAwardResult> {
        return this.awardXP('food_log');
    }

    async awardExerciseLogXP(): Promise<XPAwardResult> {
        return this.awardXP('exercise_log');
    }

    async awardWeightLogXP(): Promise<XPAwardResult> {
        return this.awardXP('weight_log');
    }

    async awardProfileCompleteXP(): Promise<XPAwardResult> {
        return this.awardXP('profile_complete');
    }

    async awardGoalSetterXP(): Promise<XPAwardResult> {
        return this.awardXP('goal_setter');
    }

    async awardDailyGoalMetXP(): Promise<XPAwardResult> {
        return this.awardXP('daily_goal_met');
    }

    async awardWeeklyGoalMetXP(): Promise<XPAwardResult> {
        return this.awardXP('weekly_goal_met');
    }

    async awardPerfectDayXP(): Promise<XPAwardResult> {
        return this.awardXP('perfect_day');
    }

    // Format level progress for display
    formatLevelProgress(xp: number, xpToNextLevel: number): { current: number; total: number; percentage: number } {
        const currentLevelXP = xp;
        const totalXPForNextLevel = xp + xpToNextLevel;
        const percentage = xpToNextLevel > 0 ? (xp / totalXPForNextLevel) * 100 : 100;

        return {
            current: xp,
            total: totalXPForNextLevel,
            percentage: Math.round(percentage),
        };
    }

    // Get rank color for UI display
    getRankColor(rank: string): string {
        const rankColors: { [key: string]: string } = {
            'Beginner': '#8E8E93',
            'Novice': '#CD7F32',
            'Amateur': '#C0C0C0',
            'Intermediate': '#FFD700',
            'Advanced': '#FF8C00',
            'Expert': '#8A2BE2',
            'Master': '#FF1493',
            'Elite': '#00CED1',
            'Champion': '#FF4500',
            'Legend': '#FFD700',
            'Mythic': '#8A2BE2',
            'Immortal': '#DC143C',
            'Divine': '#00BFFF',
            'Transcendent': '#FF00FF',
            'Omnipotent': '#FFFFFF',
        };
        return rankColors[rank] || '#FFD700';
    }

    // Calculate achievement completion percentage
    calculateAchievementProgress(completed: number, total: number): number {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    }

    // Get achievement icon for display
    getAchievementIcon(achievement: Achievement): string {
        if (achievement.icon) {
            return achievement.icon;
        }

        // Default icons based on achievement type
        const nameToIcon: { [key: string]: string } = {
            'First Steps': 'footsteps',
            'Getting Started': 'checkmark-circle',
            'Dedicated Logger': 'calendar',
            'Nutrition Master': 'restaurant',
            'Workout Warrior': 'fitness',
            'Fitness Fanatic': 'barbell',
            'Weight Tracker': 'analytics',
            'Consistency King': 'flame',
            'Streak Master': 'trending-up',
            'Level Up': 'arrow-up-circle',
            'Rising Star': 'rocket',
            'Elite Status': 'diamond',
            'Profile Complete': 'person-circle',
            'Goal Setter': 'target',
            'Perfect Week': 'star',
        };

        return nameToIcon[achievement.name] || 'trophy';
    }

    // Format streak display text
    formatStreakText(streakDays: number): string {
        if (streakDays === 0) return 'Start your streak!';
        if (streakDays === 1) return '1 day streak';
        if (streakDays < 7) return `${streakDays} day streak`;
        if (streakDays < 30) return `${streakDays} day streak 🔥`;
        if (streakDays < 100) return `${streakDays} day streak 🔥🔥`;
        return `${streakDays} day streak 🔥🔥🔥`;
    }

    // Get next achievement suggestion
    getNextAchievementSuggestion(achievements: Achievement[]): Achievement | null {
        const incomplete = achievements.filter(a => !a.completed);
        if (incomplete.length === 0) return null;

        // Sort by XP reward (easier achievements first)
        incomplete.sort((a, b) => a.xp_reward - b.xp_reward);
        return incomplete[0];
    }

    // Calculate total XP earned from achievements
    getTotalAchievementXP(achievements: Achievement[]): number {
        return achievements
            .filter(a => a.completed)
            .reduce((total, a) => total + a.xp_reward, 0);
    }
}

export default new GamificationService(); 