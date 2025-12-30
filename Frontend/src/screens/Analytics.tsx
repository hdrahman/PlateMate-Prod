import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    StatusBar,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
    Circle,
    Defs,
    LinearGradient as SvgLinearGradient,
    Stop,
    Path,
    G
} from 'react-native-svg';
import { ThemeContext } from '../ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
    getFoodLogsByDate,
    getUserGoals,
    getUserProfileByFirebaseUid,
    getUserStreak
} from '../utils/database';
import { useSteps } from '../context/StepContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────
interface DailyData {
    date: string;
    dayOfWeek: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealBreakdown: { [key: string]: number };
}

interface WeeklyStats {
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    daysLogged: number;
    totalCalories: number;
}

interface InsightData {
    type: 'success' | 'warning' | 'info';
    icon: string;
    title: string;
    message: string;
}

interface DayPattern {
    day: string;
    dayIndex: number;
    avgCalories: number;
    avgProtein: number;
    count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = React.memo(({
    icon,
    label,
    value,
    subtext,
    gradient,
    theme,
    isDarkTheme,
    isEmpty = false
}: {
    icon: string;
    label: string;
    value: string | number;
    subtext?: string;
    gradient: readonly string[];
    theme: any;
    isDarkTheme: boolean;
    isEmpty?: boolean;
}) => (
    <View style={[
        styles.statCard,
        {
            backgroundColor: theme.colors.cardBackground,
            borderColor: isDarkTheme ? 'transparent' : theme.colors.border,
            borderWidth: isDarkTheme ? 0 : 1,
            shadowColor: isDarkTheme ? 'transparent' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkTheme ? 0 : 0.06,
            shadowRadius: 8,
            elevation: isDarkTheme ? 0 : 3,
        }
    ]}>
        <LinearGradient
            colors={gradient as unknown as [string, string, ...string[]]}
            style={styles.statIconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <Ionicons name={icon as any} size={18} color="#FFF" />
        </LinearGradient>
        <Text style={[styles.statValue, { color: isEmpty ? theme.colors.textMuted : theme.colors.text }]}>
            {isEmpty ? '—' : value}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
        {subtext && (
            <Text style={[styles.statSubtext, { color: theme.colors.textMuted }]}>{subtext}</Text>
        )}
    </View>
));

const PeriodButton = React.memo(({
    label,
    isActive,
    onPress,
    theme
}: {
    label: string;
    isActive: boolean;
    onPress: () => void;
    theme: any;
}) => (
    <TouchableOpacity
        style={[
            styles.periodButton,
            isActive && { backgroundColor: theme.colors.primary + '20' }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Text style={[
            styles.periodButtonText,
            { color: isActive ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
            {label}
        </Text>
    </TouchableOpacity>
));

const MacroProgressBar = React.memo(({
    label,
    current,
    goal,
    color,
    theme,
    isEmpty = false
}: {
    label: string;
    current: number;
    goal: number;
    color: string;
    theme: any;
    isEmpty?: boolean;
}) => {
    const percentage = isEmpty ? 0 : Math.min((current / goal) * 100, 100);
    const isOver = current > goal && !isEmpty;

    return (
        <View style={styles.macroProgressContainer}>
            <View style={styles.macroProgressHeader}>
                <Text style={[styles.macroLabel, { color: theme.colors.text }]}>{label}</Text>
                <Text style={[
                    styles.macroValue,
                    { color: isEmpty ? theme.colors.textMuted : isOver ? theme.colors.warning : theme.colors.textSecondary }
                ]}>
                    {isEmpty ? '—' : `${Math.round(current)}g / ${goal}g`}
                </Text>
            </View>
            <View style={[styles.macroProgressTrack, { backgroundColor: theme.colors.ringBackground }]}>
                <View
                    style={[
                        styles.macroProgressFill,
                        {
                            width: `${percentage}%`,
                            backgroundColor: isEmpty ? theme.colors.ringBackground : color
                        }
                    ]}
                />
            </View>
        </View>
    );
});

const InsightCard = React.memo(({
    insight,
    theme,
    isDarkTheme
}: {
    insight: InsightData;
    theme: any;
    isDarkTheme: boolean;
}) => {
    const getColor = () => {
        switch (insight.type) {
            case 'success': return theme.colors.success;
            case 'warning': return theme.colors.warning;
            default: return theme.colors.primary;
        }
    };

    return (
        <View style={[
            styles.insightCard,
            {
                backgroundColor: theme.colors.cardBackground,
                borderLeftColor: getColor(),
                borderColor: isDarkTheme ? 'transparent' : theme.colors.border,
                borderWidth: isDarkTheme ? 0 : 1,
                borderLeftWidth: 3,
            }
        ]}>
            <View style={[styles.insightIconContainer, { backgroundColor: getColor() + '20' }]}>
                <Ionicons name={insight.icon as any} size={20} color={getColor()} />
            </View>
            <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                    {insight.title}
                </Text>
                <Text style={[styles.insightMessage, { color: theme.colors.textSecondary }]}>
                    {insight.message}
                </Text>
            </View>
        </View>
    );
});

// Empty State Component
const EmptyState = React.memo(({
    icon,
    title,
    message,
    theme
}: {
    icon: string;
    title: string;
    message: string;
    theme: any;
}) => (
    <View style={styles.emptyState}>
        <Ionicons name={icon as any} size={40} color={theme.colors.textMuted} />
        <Text style={[styles.emptyStateTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
        <Text style={[styles.emptyStateMessage, { color: theme.colors.textMuted }]}>{message}</Text>
    </View>
));

// Mini Line Chart Component
const MiniLineChart = React.memo(({
    data,
    color,
    height = 60,
    width = SCREEN_WIDTH - 80,
}: {
    data: number[];
    color: string;
    height?: number;
    width?: number;
}) => {
    if (data.length < 2 || data.every(d => d === 0)) return null;

    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - minValue) / range) * (height - 10);
        return `${x},${y}`;
    }).join(' ');

    const pathD = `M ${points.split(' ').map((p, i) => (i === 0 ? p : `L ${p}`)).join(' ')}`;

    return (
        <Svg width={width} height={height}>
            <Defs>
                <SvgLinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
                    <Stop offset="100%" stopColor={color} stopOpacity="1" />
                </SvgLinearGradient>
            </Defs>
            <Path
                d={pathD}
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {data.map((value, index) => {
                const x = (index / (data.length - 1)) * width;
                const y = height - ((value - minValue) / range) * (height - 10);
                return (
                    <Circle key={index} cx={x} cy={y} r={3} fill={color} />
                );
            })}
        </Svg>
    );
});

// Proper Pie Chart using Arc Paths
const PieChart = React.memo(({
    data,
    size = 140,
    theme
}: {
    data: { label: string; value: number; color: string }[];
    size?: number;
    theme: any;
}) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;

    const radius = size / 2;
    const centerX = size / 2;
    const centerY = size / 2;

    // Create arc path for each segment
    const createArcPath = (startAngle: number, endAngle: number, r: number) => {
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = centerX + r * Math.cos(startRad);
        const y1 = centerY + r * Math.sin(startRad);
        const x2 = centerX + r * Math.cos(endRad);
        const y2 = centerY + r * Math.sin(endRad);

        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

        return `M ${centerX} ${centerY} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    };

    let currentAngle = 0;
    const segments = data.map((segment, index) => {
        const percentage = segment.value / total;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        // Skip tiny segments
        if (angle < 1) return null;

        return (
            <Path
                key={index}
                d={createArcPath(startAngle, endAngle - 0.5, radius - 5)}
                fill={segment.color}
            />
        );
    });

    return (
        <View style={styles.pieContainer}>
            <Svg width={size} height={size}>
                {segments}
                {/* Center circle for donut effect */}
                <Circle cx={centerX} cy={centerY} r={radius * 0.5} fill={theme.colors.cardBackground} />
            </Svg>
            <View style={styles.pieCenter}>
                <Text style={[styles.pieTotalValue, { color: theme.colors.text }]}>
                    {Math.round(total)}
                </Text>
                <Text style={[styles.pieTotalLabel, { color: theme.colors.textMuted }]}>cal</Text>
            </View>
        </View>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Analytics Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Analytics() {
    const navigation = useNavigation();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { user } = useAuth();
    const { todaySteps } = useSteps();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('7d');
    const [streak, setStreak] = useState(0);
    const [weightProgress, setWeightProgress] = useState({ current: 0, start: 0, target: 0, goal: 'maintain' });
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const [currentWeekStats, setCurrentWeekStats] = useState<WeeklyStats | null>(null);
    const [goals, setGoals] = useState({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
    const [insights, setInsights] = useState<InsightData[]>([]);
    const [dayPatterns, setDayPatterns] = useState<DayPattern[]>([]);
    const [mealDistribution, setMealDistribution] = useState<{ label: string; value: number; color: string }[]>([]);
    const [personalRecords, setPersonalRecords] = useState<{ label: string; value: string; icon: string; date?: string }[]>([]);
    const [weeklyDeficit, setWeeklyDeficit] = useState({ current: 0, target: 0 });
    const [projectedDate, setProjectedDate] = useState<string | null>(null);
    const [bestDay, setBestDay] = useState<DayPattern | null>(null);
    const [worstDay, setWorstDay] = useState<DayPattern | null>(null);
    const [hasData, setHasData] = useState(false);
    const [totalDaysLogged, setTotalDaysLogged] = useState(0);

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Helper to get date string
    const getDateString = (daysAgo: number) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0];
    };

    // Load data
    const loadData = useCallback(async () => {
        if (!user?.uid) return;

        try {
            // Get streak
            const userStreak = await getUserStreak(user.uid);
            setStreak(userStreak);

            // Get profile and goals
            const profile = await getUserProfileByFirebaseUid(user.uid);
            const userGoals = await getUserGoals(user.uid);

            if (profile) {
                setWeightProgress({
                    current: profile.weight || 0,
                    start: profile.starting_weight || profile.weight || 0,
                    target: profile.target_weight || profile.weight || 0,
                    goal: userGoals?.fitnessGoal || 'maintain'
                });
            }

            if (userGoals) {
                setGoals({
                    calories: userGoals.calorieGoal || 2000,
                    protein: userGoals.proteinGoal || 150,
                    carbs: userGoals.carbGoal || 200,
                    fat: userGoals.fatGoal || 65
                });
            }

            // Get food logs for the selected period
            const daysToFetch = selectedPeriod === '7d' ? 14 : selectedPeriod === '30d' ? 60 : 90;
            const allDailyData: DailyData[] = [];
            const mealTotals: { [key: string]: number } = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
            let daysWithLogs = 0;

            for (let i = 0; i < daysToFetch; i++) {
                const dateStr = getDateString(i);
                const date = new Date();
                date.setDate(date.getDate() - i);
                const logs = await getFoodLogsByDate(dateStr);

                const dayData: DailyData = {
                    date: dateStr,
                    dayOfWeek: date.getDay(),
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    mealBreakdown: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
                };

                logs.forEach((log: any) => {
                    // Exclude negative sentinel values from aggregations
                    dayData.calories += (log.calories > 0) ? log.calories : 0;
                    dayData.protein += (log.protein > 0) ? log.protein : 0;
                    dayData.carbs += (log.carbohydrates > 0) ? log.carbohydrates : 0;
                    dayData.fat += (log.fat > 0) ? log.fat : 0;

                    const mealType = (log.meal_type || 'snack').toLowerCase();
                    if (i < 7) {
                        const mealCalories = (log.calories > 0) ? log.calories : 0;
                        dayData.mealBreakdown[mealType] = (dayData.mealBreakdown[mealType] || 0) + mealCalories;
                        mealTotals[mealType] = (mealTotals[mealType] || 0) + mealCalories;
                    }
                });

                if (dayData.calories > 0) daysWithLogs++;
                allDailyData.push(dayData);
            }

            setDailyData(allDailyData);
            setTotalDaysLogged(daysWithLogs);
            setHasData(daysWithLogs > 0);

            // Calculate meal distribution (only if we have data)
            const totalMealCals = Object.values(mealTotals).reduce((a, b) => a + b, 0);
            if (totalMealCals > 0) {
                setMealDistribution([
                    { label: 'Breakfast', value: mealTotals.breakfast, color: theme.colors.chartCarbs },
                    { label: 'Lunch', value: mealTotals.lunch, color: theme.colors.chartProtein },
                    { label: 'Dinner', value: mealTotals.dinner, color: theme.colors.chartFat },
                    { label: 'Snacks', value: mealTotals.snack, color: theme.colors.primary }
                ].filter(m => m.value > 0));
            } else {
                setMealDistribution([]);
            }

            // Calculate weekly stats
            const thisWeekData = allDailyData.slice(0, 7);
            const daysWithData = thisWeekData.filter(d => d.calories > 0);

            if (daysWithData.length > 0) {
                const count = daysWithData.length;
                const totalCals = daysWithData.reduce((sum, d) => sum + d.calories, 0);
                setCurrentWeekStats({
                    avgCalories: Math.round(totalCals / count),
                    avgProtein: Math.round(daysWithData.reduce((sum, d) => sum + d.protein, 0) / count),
                    avgCarbs: Math.round(daysWithData.reduce((sum, d) => sum + d.carbs, 0) / count),
                    avgFat: Math.round(daysWithData.reduce((sum, d) => sum + d.fat, 0) / count),
                    daysLogged: count,
                    totalCalories: totalCals
                });

                // Calculate weekly deficit
                const calorieGoal = userGoals?.calorieGoal || 2000;
                const weeklyTarget = calorieGoal * count; // Only count logged days
                const calorieBalance = totalCals - weeklyTarget;
                let targetBalance = 0;
                if (userGoals?.fitnessGoal === 'lose') targetBalance = -500 * count;
                else if (userGoals?.fitnessGoal === 'gain') targetBalance = 500 * count;
                setWeeklyDeficit({ current: calorieBalance, target: targetBalance });
            } else {
                setCurrentWeekStats(null);
            }

            // Calculate day-of-week patterns (need at least 3 days of data)
            if (daysWithLogs >= 3) {
                const dayStats: { [key: number]: { calories: number[]; protein: number[] } } = {};
                allDailyData.forEach(d => {
                    if (d.calories > 0) {
                        if (!dayStats[d.dayOfWeek]) {
                            dayStats[d.dayOfWeek] = { calories: [], protein: [] };
                        }
                        dayStats[d.dayOfWeek].calories.push(d.calories);
                        dayStats[d.dayOfWeek].protein.push(d.protein);
                    }
                });

                const patterns: DayPattern[] = Object.entries(dayStats)
                    .filter(([_, stats]) => stats.calories.length >= 1)
                    .map(([day, stats]) => ({
                        day: DAY_NAMES[parseInt(day)],
                        dayIndex: parseInt(day),
                        avgCalories: Math.round(stats.calories.reduce((a, b) => a + b, 0) / stats.calories.length),
                        avgProtein: Math.round(stats.protein.reduce((a, b) => a + b, 0) / stats.protein.length),
                        count: stats.calories.length
                    }))
                    .sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));

                setDayPatterns(patterns);

                // Find best and worst days (need at least 2 patterns)
                if (patterns.length >= 2) {
                    const calorieGoal = userGoals?.calorieGoal || 2000;
                    const sortedByDiff = [...patterns].sort((a, b) =>
                        Math.abs(a.avgCalories - calorieGoal) - Math.abs(b.avgCalories - calorieGoal)
                    );
                    setBestDay(sortedByDiff[0]);

                    const sortedByOverage = [...patterns].sort((a, b) => b.avgCalories - a.avgCalories);
                    if (sortedByOverage[0].avgCalories > calorieGoal) {
                        setWorstDay(sortedByOverage[0]);
                    } else {
                        setWorstDay(null);
                    }
                }
            } else {
                setDayPatterns([]);
                setBestDay(null);
                setWorstDay(null);
            }

            // Calculate personal records (need meaningful data)
            const records: { label: string; value: string; icon: string; date?: string }[] = [];

            if (daysWithLogs >= 1) {
                // Best protein day
                const daysWithProtein = allDailyData.filter(d => d.protein > 0);
                if (daysWithProtein.length > 0) {
                    const bestProteinDay = daysWithProtein.reduce((best, d) => d.protein > best.protein ? d : best);
                    if (bestProteinDay.protein >= 50) { // Only show if meaningful
                        records.push({
                            label: 'Highest protein day',
                            value: `${Math.round(bestProteinDay.protein)}g`,
                            icon: 'trophy-outline',
                            date: new Date(bestProteinDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        });
                    }
                }

                // Lowest calorie day (only if user is trying to lose weight)
                if (userGoals?.fitnessGoal === 'lose') {
                    const daysWithCals = allDailyData.filter(d => d.calories > 500); // Must have meaningful data
                    if (daysWithCals.length > 0) {
                        const lowestCalDay = daysWithCals.reduce((low, d) => d.calories < low.calories ? d : low);
                        records.push({
                            label: 'Best calorie day',
                            value: `${Math.round(lowestCalDay.calories)} cal`,
                            icon: 'ribbon-outline',
                            date: new Date(lowestCalDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        });
                    }
                }

                // Current streak
                if (userStreak >= 3) {
                    records.push({
                        label: 'Current streak',
                        value: `${userStreak} days 🔥`,
                        icon: 'flame-outline'
                    });
                }

                // Most consistent week
                if (daysWithLogs >= 7) {
                    const weeksOfData = [];
                    for (let w = 0; w < Math.floor(allDailyData.length / 7); w++) {
                        const weekData = allDailyData.slice(w * 7, (w + 1) * 7);
                        const logged = weekData.filter(d => d.calories > 0).length;
                        weeksOfData.push({ week: w, daysLogged: logged });
                    }
                    const best = weeksOfData.reduce((b, w) => w.daysLogged > b.daysLogged ? w : b, { week: 0, daysLogged: 0 });
                    if (best.daysLogged >= 5) {
                        records.push({
                            label: 'Best week consistency',
                            value: `${best.daysLogged}/7 days`,
                            icon: 'calendar-outline'
                        });
                    }
                }
            }

            setPersonalRecords(records);

            // Calculate weight projection (only if goal is set and we have logging history)
            if (profile && userGoals?.fitnessGoal && userGoals.fitnessGoal !== 'maintain' && daysWithLogs >= 7) {
                const currentWeight = profile.weight || 0;
                const targetWeight = profile.target_weight || currentWeight;
                const weightDiff = Math.abs(targetWeight - currentWeight);

                if (weightDiff > 0) {
                    const weeksToGoal = weightDiff / 0.5;
                    if (weeksToGoal > 0 && weeksToGoal < 52) {
                        const projDate = new Date();
                        projDate.setDate(projDate.getDate() + weeksToGoal * 7);
                        setProjectedDate(projDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
                    }
                }
            } else {
                setProjectedDate(null);
            }

            // Generate insights (only if we have enough data)
            if (daysWithLogs >= 3) {
                generateInsights(thisWeekData, userGoals, userStreak, dayPatterns);
            } else {
                setInsights([{
                    type: 'info',
                    icon: 'bulb-outline',
                    title: 'Keep Logging!',
                    message: 'Log a few more days to unlock personalized insights and analysis.'
                }]);
            }

        } catch (error) {
            console.error('Error loading analytics data:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user?.uid, selectedPeriod, theme.colors]);

    // Generate smart insights
    const generateInsights = (
        weekData: DailyData[],
        userGoals: any,
        streak: number,
        patterns: DayPattern[]
    ) => {
        const newInsights: InsightData[] = [];
        const daysWithData = weekData.filter(d => d.calories > 0);
        if (daysWithData.length === 0) return;

        // Protein insight
        const avgProtein = daysWithData.reduce((sum, d) => sum + d.protein, 0) / daysWithData.length;
        const proteinGoal = userGoals?.proteinGoal || 150;

        if (avgProtein < proteinGoal * 0.7) {
            newInsights.push({
                type: 'warning',
                icon: 'nutrition-outline',
                title: 'Protein Gap',
                message: `Averaging ${Math.round(avgProtein)}g daily. Try adding lean protein sources.`
            });
        } else if (avgProtein >= proteinGoal * 0.9) {
            newInsights.push({
                type: 'success',
                icon: 'checkmark-circle-outline',
                title: 'Great Protein Intake',
                message: 'Consistently hitting your protein goals!'
            });
        }

        // Streak insights
        if (streak >= 7) {
            newInsights.push({
                type: 'success',
                icon: 'flame-outline',
                title: `${streak} Day Streak! 🔥`,
                message: 'Amazing dedication! Keep it going!'
            });
        } else if (streak >= 3) {
            newInsights.push({
                type: 'info',
                icon: 'trending-up-outline',
                title: 'Building Momentum',
                message: `${streak} days logged! Keep going to reach 7 days.`
            });
        }

        // Consistency insight
        if (daysWithData.length >= 5) {
            newInsights.push({
                type: 'success',
                icon: 'calendar-outline',
                title: 'Great Consistency',
                message: `${daysWithData.length}/7 days logged this week. You're on track!`
            });
        }

        setInsights(newInsights.slice(0, 3));
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    // Calculate weight progress percentage
    const weightLost = useMemo(() => {
        const { current, start, target, goal } = weightProgress;
        if (goal === 'maintain' || !start || !target) return null;
        const totalChange = Math.abs(start - target);
        const actualChange = goal === 'lose' ? start - current : current - start;
        if (totalChange === 0) return 100;
        return Math.max(0, Math.min(100, Math.round((actualChange / totalChange) * 100)));
    }, [weightProgress]);

    // Get chart data
    const chartData = useMemo(() => {
        const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        return dailyData.slice(0, days).reverse().map(d => d.calories);
    }, [dailyData, selectedPeriod]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]} edges={["top"]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                    Loading analytics...
                </Text>
            </SafeAreaView>
        );
    }

    const hasChartData = chartData.some(d => d > 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "left", "right"]}>
            <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />

            {/* Header - Centered */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Analytics</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
            >
                {/* Period Selector */}
                <View style={[styles.periodSelector, { backgroundColor: theme.colors.cardBackground }]}>
                    <PeriodButton label="7 Days" isActive={selectedPeriod === '7d'} onPress={() => setSelectedPeriod('7d')} theme={theme} />
                    <PeriodButton label="30 Days" isActive={selectedPeriod === '30d'} onPress={() => setSelectedPeriod('30d')} theme={theme} />
                    <PeriodButton label="90 Days" isActive={selectedPeriod === '90d'} onPress={() => setSelectedPeriod('90d')} theme={theme} />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <StatCard icon="flame" label="Streak" value={streak} subtext="days" gradient={theme.colors.gradientNeonOrange} theme={theme} isDarkTheme={isDarkTheme} isEmpty={!hasData && streak === 0} />
                    <StatCard icon="restaurant" label="Avg Calories" value={currentWeekStats?.avgCalories || 0} subtext="per day" gradient={theme.colors.gradientNeonPurple} theme={theme} isDarkTheme={isDarkTheme} isEmpty={!hasData} />
                    <StatCard icon="trending-down" label="Weight" value={weightLost !== null ? `${weightLost}%` : '—'} subtext={weightLost !== null ? "to goal" : "not set"} gradient={theme.colors.gradientNeonGreen} theme={theme} isDarkTheme={isDarkTheme} isEmpty={weightLost === null} />
                    <StatCard icon="footsteps" label="Steps" value={todaySteps?.toLocaleString() || 0} subtext="today" gradient={theme.colors.gradientNeonCyan} theme={theme} isDarkTheme={isDarkTheme} />
                </View>

                {/* Calorie Trend Chart */}
                <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Calorie Trend</Text>
                    {hasChartData ? (
                        <>
                            <View style={styles.chartContainer}>
                                <MiniLineChart data={chartData} color={theme.colors.chartCalories} />
                            </View>
                            <View style={styles.chartLabels}>
                                <Text style={[styles.chartLabel, { color: theme.colors.textMuted }]}>
                                    {selectedPeriod === '7d' ? '7 days ago' : selectedPeriod === '30d' ? '30 days ago' : '90 days ago'}
                                </Text>
                                <Text style={[styles.chartLabel, { color: theme.colors.textMuted }]}>Today</Text>
                            </View>
                        </>
                    ) : (
                        <EmptyState icon="analytics-outline" title="No data yet" message="Start logging meals to see your calorie trends" theme={theme} />
                    )}
                </View>

                {/* Best & Worst Day Analysis */}
                {(bestDay || worstDay) && (
                    <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Best & Worst Days</Text>
                        <View style={styles.bestWorstContainer}>
                            {bestDay && (
                                <View style={styles.bestWorstItem}>
                                    <View style={[styles.bestWorstIcon, { backgroundColor: theme.colors.success + '20' }]}>
                                        <Ionicons name="trophy" size={24} color={theme.colors.success} />
                                    </View>
                                    <Text style={[styles.bestWorstDay, { color: theme.colors.text }]}>{DAY_FULL_NAMES[bestDay.dayIndex]}</Text>
                                    <Text style={[styles.bestWorstLabel, { color: theme.colors.success }]}>Best Day</Text>
                                    <Text style={[styles.bestWorstStats, { color: theme.colors.textSecondary }]}>
                                        Avg: {bestDay.avgCalories} cal
                                    </Text>
                                    <Text style={[styles.bestWorstDetail, { color: theme.colors.textMuted }]}>
                                        You stay closest to your goals on {DAY_FULL_NAMES[bestDay.dayIndex]}s
                                    </Text>
                                </View>
                            )}
                            {worstDay && (
                                <View style={styles.bestWorstItem}>
                                    <View style={[styles.bestWorstIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                                        <Ionicons name="alert-circle" size={24} color={theme.colors.warning} />
                                    </View>
                                    <Text style={[styles.bestWorstDay, { color: theme.colors.text }]}>{DAY_FULL_NAMES[worstDay.dayIndex]}</Text>
                                    <Text style={[styles.bestWorstLabel, { color: theme.colors.warning }]}>Challenging Day</Text>
                                    <Text style={[styles.bestWorstStats, { color: theme.colors.textSecondary }]}>
                                        Avg: {worstDay.avgCalories} cal (+{worstDay.avgCalories - goals.calories})
                                    </Text>
                                    <Text style={[styles.bestWorstDetail, { color: theme.colors.textMuted }]}>
                                        Plan ahead for {DAY_FULL_NAMES[worstDay.dayIndex]}s
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Meal Distribution Pie Chart */}
                {mealDistribution.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Meal Distribution</Text>
                        <View style={styles.mealDistContent}>
                            <PieChart data={mealDistribution} theme={theme} />
                            <View style={styles.mealLegend}>
                                {mealDistribution.map((item, index) => {
                                    const total = mealDistribution.reduce((s, d) => s + d.value, 0);
                                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                                    return (
                                        <View key={index} style={styles.legendItem}>
                                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                            <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                                            <Text style={[styles.legendValue, { color: theme.colors.text }]}>{pct}%</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                )}

                {/* Personal Records */}
                {personalRecords.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🏆 Personal Records</Text>
                        {personalRecords.map((record, index) => (
                            <View key={index} style={[styles.recordItem, index < personalRecords.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                <View style={[styles.recordIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <Ionicons name={record.icon as any} size={20} color={theme.colors.primary} />
                                </View>
                                <View style={styles.recordContent}>
                                    <Text style={[styles.recordLabel, { color: theme.colors.textSecondary }]}>{record.label}</Text>
                                    {record.date && <Text style={[styles.recordDate, { color: theme.colors.textMuted }]}>{record.date}</Text>}
                                </View>
                                <Text style={[styles.recordValue, { color: theme.colors.text }]}>{record.value}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Weight Projection */}
                {projectedDate && (
                    <View style={[styles.projectionCard, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                        <View style={[styles.projectionIcon, { backgroundColor: theme.colors.success + '20' }]}>
                            <Ionicons name="trending-up" size={24} color={theme.colors.success} />
                        </View>
                        <View style={styles.projectionContent}>
                            <Text style={[styles.projectionTitle, { color: theme.colors.text }]}>Goal Projection</Text>
                            <Text style={[styles.projectionDate, { color: theme.colors.textSecondary }]}>
                                At current pace → reach {weightProgress.target}kg by ~{projectedDate}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Weekly Macro Breakdown */}
                <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: isDarkTheme ? 'transparent' : theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Weekly Averages</Text>
                    <MacroProgressBar label="Protein" current={currentWeekStats?.avgProtein || 0} goal={goals.protein} color={theme.colors.chartProtein} theme={theme} isEmpty={!hasData} />
                    <MacroProgressBar label="Carbs" current={currentWeekStats?.avgCarbs || 0} goal={goals.carbs} color={theme.colors.chartCarbs} theme={theme} isEmpty={!hasData} />
                    <MacroProgressBar label="Fat" current={currentWeekStats?.avgFat || 0} goal={goals.fat} color={theme.colors.chartFat} theme={theme} isEmpty={!hasData} />
                    <View style={styles.consistencyRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.consistencyText, { color: theme.colors.textSecondary }]}>
                            {currentWeekStats?.daysLogged || 0}/7 days logged this week
                        </Text>
                    </View>
                </View>

                {/* Insights */}
                {insights.length > 0 && (
                    <View style={styles.insightsSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 12 }]}>Insights</Text>
                        {insights.map((insight, index) => (
                            <InsightCard key={index} insight={insight} theme={theme} isDarkTheme={isDarkTheme} />
                        ))}
                    </View>
                )}

                {/* New User Welcome */}
                {!hasData && (
                    <View style={[styles.welcomeCard, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
                        <Ionicons name="sparkles" size={32} color={theme.colors.primary} />
                        <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Welcome to Analytics!</Text>
                        <Text style={[styles.welcomeText, { color: theme.colors.textSecondary }]}>
                            Start logging your meals to unlock personalized insights, track your progress, and discover your eating patterns.
                        </Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, alignItems: 'flex-start' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    headerSpacer: { width: 40 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
    periodSelector: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
    periodButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    periodButtonText: { fontSize: 14, fontWeight: '500' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    statCard: { width: (SCREEN_WIDTH - 44) / 2, padding: 16, borderRadius: 16, alignItems: 'center' },
    statIconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statValue: { fontSize: 24, fontWeight: '700' },
    statLabel: { fontSize: 12, marginTop: 2 },
    statSubtext: { fontSize: 10, marginTop: 2 },
    card: { padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
    chartContainer: { alignItems: 'center', marginVertical: 10 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    chartLabel: { fontSize: 11 },
    // Macro progress
    macroProgressContainer: { marginBottom: 16 },
    macroProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    macroLabel: { fontSize: 14, fontWeight: '500' },
    macroValue: { fontSize: 13 },
    macroProgressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
    macroProgressFill: { height: '100%', borderRadius: 4 },
    consistencyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' },
    consistencyText: { fontSize: 13 },
    // Insights
    insightsSection: { marginBottom: 20 },
    insightCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10 },
    insightIconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    insightContent: { flex: 1, marginLeft: 12 },
    insightTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    insightMessage: { fontSize: 13, lineHeight: 18 },
    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyStateTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
    emptyStateMessage: { fontSize: 13, textAlign: 'center', marginTop: 4 },
    // Pie chart
    pieContainer: { alignItems: 'center', justifyContent: 'center' },
    pieCenter: { position: 'absolute', alignItems: 'center' },
    pieTotalValue: { fontSize: 22, fontWeight: '700' },
    pieTotalLabel: { fontSize: 11 },
    // Meal distribution
    mealDistContent: { flexDirection: 'row', alignItems: 'center' },
    mealLegend: { flex: 1, marginLeft: 24 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendLabel: { flex: 1, fontSize: 14 },
    legendValue: { fontSize: 14, fontWeight: '600' },
    // Best/Worst days
    bestWorstContainer: { flexDirection: 'row', gap: 12 },
    bestWorstItem: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.05)' },
    bestWorstIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    bestWorstDay: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    bestWorstLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
    bestWorstStats: { fontSize: 13, marginBottom: 4 },
    bestWorstDetail: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
    // Projection
    projectionCard: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1 },
    projectionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    projectionContent: { flex: 1, marginLeft: 14 },
    projectionTitle: { fontSize: 15, fontWeight: '600' },
    projectionDate: { fontSize: 13, marginTop: 2 },
    // Records
    recordItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    recordIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    recordContent: { flex: 1, marginLeft: 12 },
    recordLabel: { fontSize: 14 },
    recordDate: { fontSize: 11, marginTop: 2 },
    recordValue: { fontSize: 16, fontWeight: '700' },
    // Welcome card
    welcomeCard: { padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1 },
    welcomeTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 8 },
    welcomeText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});