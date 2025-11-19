import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Platform,
    Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
    getFoodLogsByDate,
    getTodayCalories,
    getTodayProtein,
    getTodayCarbs,
    getTodayFats,
    getTodayExerciseCalories,
    getUserProfileBySupabaseUid
} from '../utils/database';
import { calculateNutritionGoals, calculateBMRData } from '../utils/nutritionCalculator';

const { width, height } = Dimensions.get('window');

// Define responsive dimensions that scale with screen size
const getResponsiveDimensions = () => {
    // Calculate dimensions based on screen width
    const horizontalPadding = Math.max(16, width * 0.05);
    const cardSpacing = Math.max(12, width * 0.03);
    const cardRadius = Math.min(16, width * 0.04);

    return {
        horizontalPadding,
        cardSpacing,
        cardRadius
    };
};

const responsiveDimensions = getResponsiveDimensions();
const { horizontalPadding, cardSpacing, cardRadius } = responsiveDimensions;

// Theme colors
const COLORS = {
    PRIMARY_BG: '#000000',
    CARD_BG: '#1C1C1E',
    ACCENT_PURPLE: '#AA00FF',
    ACCENT_BLUE: '#2196F3',
    ACCENT_GREEN: '#4CAF50',
    ACCENT_ORANGE: '#FF9800',
    ACCENT_RED: '#F44336',
    WHITE: '#FFFFFF',
    SUBDUED: '#AAAAAA',
    LIGHT_GRAY: '#333333'
};

interface NutritionInsight {
    type: 'warning' | 'success' | 'info';
    title: string;
    description: string;
    recommendation?: string;
}

interface MacroTrend {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    exerciseCalories: number;
}

interface NutritionScore {
    overall: number;
    consistency: number;
    recovery: number;
    nutrition: number;
}

const GradientCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
    <View style={[styles.cardContainer, style]}>
        <LinearGradient
            colors={['rgba(170, 0, 255, 0.1)', 'rgba(33, 150, 243, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCard}
        >
            {children}
        </LinearGradient>
    </View>
);

const GradientText: React.FC<{ text: string; style?: any; colors?: readonly [string, string, ...string[]] }> = ({
    text,
    style,
    colors = [COLORS.ACCENT_PURPLE, COLORS.ACCENT_BLUE] as const
}) => (
    <MaskedView
        maskElement={<Text style={[style, { opacity: 1 }]}>{text}</Text>}
    >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={[style, { opacity: 0 }]}>{text}</Text>
        </LinearGradient>
    </MaskedView>
);

const Analytics: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [nutritionScore, setNutritionScore] = useState<NutritionScore>({
        overall: 0,
        consistency: 0,
        recovery: 0,
        nutrition: 0
    });
    const [macroTrends, setMacroTrends] = useState<MacroTrend[]>([]);
    const [insights, setInsights] = useState<NutritionInsight[]>([]);
    const [avgDailyNutrition, setAvgDailyNutrition] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    });
    const [userProfile, setUserProfile] = useState<any>(null);
    const [userGoals, setUserGoals] = useState<any>(null);

    useEffect(() => {
        if (user) {
            loadAnalyticsData();
        }
    }, [user, selectedPeriod]);

    const loadAnalyticsData = async () => {
        try {
            setLoading(true);

            const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
            const trends: MacroTrend[] = [];
            const today = new Date();

            // Get user profile and goals for calculations
            const profile = await getUserProfileBySupabaseUid(user?.id || '');

            // Calculate nutrition goals based on profile
            let goals = null;
            if (profile) {
                setUserProfile(profile);
                // Calculate TDEE and goals based on user data
                goals = calculateGoalsFromProfile(profile);
                setUserGoals(goals);
            }

            // Load nutrition data for the selected period
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                try {
                    const logs = await getFoodLogsByDate(dateStr) as any[];
                    const exerciseCals = i === 0 ? await getTodayExerciseCalories() : 0;

                    const dayTotals = logs.reduce((acc, log: any) => ({
                        calories: acc.calories + (log.calories || 0),
                        protein: acc.protein + (log.proteins || 0),
                        carbs: acc.carbs + (log.carbs || 0),
                        fat: acc.fat + (log.fats || 0)
                    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

                    trends.push({
                        date: dateStr,
                        calories: dayTotals.calories,
                        protein: dayTotals.protein,
                        carbs: dayTotals.carbs,
                        fat: dayTotals.fat,
                        exerciseCalories: exerciseCals
                    });
                } catch (error) {
                    console.log(`Error loading data for ${dateStr}:`, error);
                    trends.push({
                        date: dateStr,
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                        exerciseCalories: 0
                    });
                }
            }

            setMacroTrends(trends);

            // Calculate analytics
            calculateNutritionScore(trends);
            generateInsights(trends, profile);
            calculateAverageNutrition(trends);

        } catch (error) {
            console.error('Error loading analytics data:', error);
            Alert.alert('Error', 'Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const calculateNutritionScore = (trends: MacroTrend[]) => {
        const validDays = trends.filter(day => day.calories > 0);
        if (validDays.length === 0) {
            setNutritionScore({ overall: 0, consistency: 0, recovery: 0, nutrition: 0 });
            return;
        }

        // Enhanced Consistency Score (multiple factors)
        const avgCalories = validDays.reduce((sum, day) => sum + day.calories, 0) / validDays.length;
        const variance = validDays.reduce((sum, day) => sum + Math.pow(day.calories - avgCalories, 2), 0) / validDays.length;
        const calorieConsistency = Math.max(0, 100 - (Math.sqrt(variance) / avgCalories * 100));

        // Weekly pattern consistency (weekday vs weekend)
        const weekdayAvg = validDays.slice(0, 5).reduce((sum, day) => sum + day.calories, 0) / Math.min(5, validDays.length);
        const weekendAvg = validDays.slice(-2).reduce((sum, day) => sum + day.calories, 0) / Math.min(2, validDays.length);
        const weeklyConsistency = 100 - Math.min(50, Math.abs(weekendAvg - weekdayAvg) / weekdayAvg * 100);

        const consistencyScore = (calorieConsistency * 0.7 + weeklyConsistency * 0.3);

        // Recovery Score (based on adequate nutrition for recovery)
        const avgProtein = validDays.reduce((sum, day) => sum + day.protein, 0) / validDays.length;
        const proteinGoalGrams = userGoals?.proteinGoal || calculateGoalsFromProfile(userProfile).proteinGoal;

        // Recovery factors: adequate protein, sufficient calories, consistent intake
        const proteinRecoveryScore = Math.min(100, (avgProtein / proteinGoalGrams) * 100);
        const calorieRecoveryScore = Math.min(100, (avgCalories / (userGoals?.targetCalories || calculateGoalsFromProfile(userProfile).targetCalories)) * 100);
        const recoveryConsistency = 100 - (Math.sqrt(variance) / avgCalories * 50); // Less penalty for recovery

        const recoveryScore = (proteinRecoveryScore * 0.4 + calorieRecoveryScore * 0.3 + recoveryConsistency * 0.3);

        // Nutrition Score (macro distribution + overall quality)
        const avgProteinPercent = validDays.reduce((sum, day) => {
            const totalCals = day.calories || 1;
            return sum + (day.protein * 4 / totalCals * 100);
        }, 0) / validDays.length;

        const avgCarbPercent = validDays.reduce((sum, day) => {
            const totalCals = day.calories || 1;
            return sum + (day.carbs * 4 / totalCals * 100);
        }, 0) / validDays.length;

        const avgFatPercent = validDays.reduce((sum, day) => {
            const totalCals = day.calories || 1;
            return sum + (day.fat * 9 / totalCals * 100);
        }, 0) / validDays.length;

        // Dynamic macro ranges based on user goal (evidence-based 2024 guidelines)
        const fitnessGoal = userProfile?.fitness_goal || 'maintain_weight';
        let proteinTarget, carbTarget, fatTarget, proteinTolerance, carbTolerance, fatTolerance;

        if (fitnessGoal === 'lose_weight') {
            // Higher protein for muscle preservation during weight loss
            proteinTarget = 30; carbTarget = 40; fatTarget = 30;
            proteinTolerance = 5; carbTolerance = 10; fatTolerance = 5;
        } else if (fitnessGoal === 'build_muscle' || fitnessGoal === 'gain_weight') {
            // Moderate protein, higher carbs for energy and muscle building
            proteinTarget = 25; carbTarget = 50; fatTarget = 25;
            proteinTolerance = 5; carbTolerance = 10; fatTolerance = 5;
        } else {
            // Balanced approach for maintenance/general health
            proteinTarget = 25; carbTarget = 45; fatTarget = 30;
            proteinTolerance = 7; carbTolerance = 10; fatTolerance = 7;
        }

        const proteinScore = 100 - Math.max(0, Math.abs(avgProteinPercent - proteinTarget) - proteinTolerance) * 3;
        const carbScore = 100 - Math.max(0, Math.abs(avgCarbPercent - carbTarget) - carbTolerance) * 2;
        const fatScore = 100 - Math.max(0, Math.abs(avgFatPercent - fatTarget) - fatTolerance) * 3;

        // Protein adequacy bonus (encourage adequate protein)
        const proteinAdequacyBonus = Math.min(20, (avgProtein / proteinGoalGrams) * 20); // Bonus up to 20 points for meeting protein goal

        const nutritionScore = (Math.max(0, proteinScore) + Math.max(0, carbScore) + Math.max(0, fatScore)) / 3 + proteinAdequacyBonus;

        // Enhanced Overall Score (weighted by importance)
        const overallScore = (consistencyScore * 0.35 + recoveryScore * 0.35 + nutritionScore * 0.3);

        setNutritionScore({
            overall: Math.min(100, Math.round(overallScore)),
            consistency: Math.round(consistencyScore),
            recovery: Math.min(100, Math.round(recoveryScore)),
            nutrition: Math.min(100, Math.round(nutritionScore))
        });
    };

    const generateInsights = (trends: MacroTrend[], profile: any) => {
        const insights: NutritionInsight[] = [];
        const validDays = trends.filter(day => day.calories > 0);

        if (validDays.length === 0) {
            insights.push({
                type: 'warning',
                title: 'No Nutrition Data',
                description: 'Start logging your meals to get personalized insights.',
                recommendation: 'Begin by tracking at least one meal per day to establish baseline patterns.'
            });
            setInsights(insights);
            return;
        }

        // Calorie Analysis
        const avgCalories = validDays.reduce((sum, day) => sum + day.calories, 0) / validDays.length;
        const goalData = calculateGoalsFromProfile(profile);
        const estimatedTDEE = goalData.tdee;

        if (avgCalories < estimatedTDEE * 0.8) {
            insights.push({
                type: 'warning',
                title: 'Potential Under-eating',
                description: `Your average intake (${Math.round(avgCalories)} cal) is significantly below estimated needs (${Math.round(estimatedTDEE)} cal).`,
                recommendation: 'Consider increasing portion sizes or adding healthy snacks to meet your energy needs.'
            });
        } else if (avgCalories > estimatedTDEE * 1.2) {
            insights.push({
                type: 'info',
                title: 'Calorie Surplus',
                description: `You're consuming ${Math.round(avgCalories - estimatedTDEE)} calories above your estimated daily needs.`,
                recommendation: 'If weight gain isn\'t your goal, consider reducing portion sizes or increasing activity.'
            });
        }

        // Protein Analysis
        const avgProtein = validDays.reduce((sum, day) => sum + day.protein, 0) / validDays.length;
        const proteinTargetInsights = calculateGoalsFromProfile(profile).proteinGoal; // Use evidence-based calculation

        if (avgProtein < proteinTargetInsights * 0.8) {
            insights.push({
                type: 'warning',
                title: 'Low Protein Intake',
                description: `Average protein (${Math.round(avgProtein)}g) is below optimal range (${Math.round(proteinTargetInsights)}g).`,
                recommendation: 'Add lean proteins like chicken, fish, beans, or Greek yogurt to your meals.'
            });
        } else if (avgProtein >= proteinTargetInsights) {
            insights.push({
                type: 'success',
                title: 'Excellent Protein Intake',
                description: `You're meeting your protein goals with ${Math.round(avgProtein)}g daily average.`,
                recommendation: 'Keep up the great work! Consider spreading protein evenly across meals.'
            });
        }

        // Consistency Analysis
        const calorieVariance = validDays.reduce((sum, day) => sum + Math.pow(day.calories - avgCalories, 2), 0) / validDays.length;
        const calorieStdDev = Math.sqrt(calorieVariance);

        if (calorieStdDev > avgCalories * 0.3) {
            insights.push({
                type: 'info',
                title: 'Inconsistent Eating Patterns',
                description: 'Your daily calorie intake varies significantly day to day.',
                recommendation: 'Try meal planning or prep to create more consistent eating patterns.'
            });
        }

        setInsights(insights);
    };

    const calculateAverageNutrition = (trends: MacroTrend[]) => {
        const validDays = trends.filter(day => day.calories > 0);
        if (validDays.length === 0) return;

        const totals = validDays.reduce((acc, day) => ({
            calories: acc.calories + day.calories,
            protein: acc.protein + day.protein,
            carbs: acc.carbs + day.carbs,
            fat: acc.fat + day.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        setAvgDailyNutrition({
            calories: Math.round(totals.calories / validDays.length),
            protein: Math.round(totals.protein / validDays.length),
            carbs: Math.round(totals.carbs / validDays.length),
            fat: Math.round(totals.fat / validDays.length)
        });
    };

    // Reuse canonical calculator for consistency with rest of app
    const calculateGoalsFromProfile = (profile: any) => {
        if (!profile) {
            return {
                tdee: 2000,
                targetCalories: 2000,
                proteinGoal: 100,
                currentWeight: 70,
                targetWeight: 70,
                age: 30
            };
        }

        // Convert snake_case DB fields to UserProfile format
        const userProfile = {
            firstName: '',
            email: '',
            dateOfBirth: null,
            location: null,
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activity_level,
            dietaryRestrictions: [],
            foodAllergies: [],
            cuisinePreferences: [],
            spiceTolerance: null,
            weightGoal: profile.weight_goal || null,
            targetWeight: profile.target_weight || null,
            startingWeight: null,
            fitnessGoal: profile.weight_goal || profile.fitness_goal,
            healthConditions: [],
            dailyCalorieTarget: null,
            nutrientFocus: null,
            motivations: [],
            futureSelfMessage: null,
            futureSelfMessageType: null,
            futureSelfMessageCreatedAt: null,
            futureSelfMessageUri: null,
            onboardingComplete: true,
            premium: false,
            defaultAddress: null,
            preferredDeliveryTimes: [],
            deliveryInstructions: null,
        };

        const goals = calculateNutritionGoals(userProfile);
        const bmrData = calculateBMRData(userProfile);

        return {
            tdee: bmrData?.maintenanceCalories || 2000,
            targetCalories: bmrData?.dailyTarget || 2000,
            proteinGoal: goals.protein,
            currentWeight: profile.weight || 70,
            targetWeight: profile.target_weight || profile.weight || 70,
            age: profile.age || 30
        };
    };

    const formatPeriodLabel = (period: '7d' | '30d' | '90d') => {
        switch (period) {
            case '7d': return 'Last 7 Days';
            case '30d': return 'Last 30 Days';
            case '90d': return 'Last 90 Days';
        }
    };

    const getScoreColor = (score: number) => {
        // Dynamic scoring thresholds based on user experience
        const isNewbie = !userProfile?.experience_level || userProfile?.experience_level === 'beginner';
        const excellentThreshold = isNewbie ? 75 : 85; // Lower bar for beginners
        const goodThreshold = isNewbie ? 55 : 65; // More encouraging for beginners

        if (score >= excellentThreshold) return COLORS.ACCENT_GREEN;
        if (score >= goodThreshold) return COLORS.ACCENT_ORANGE;
        return COLORS.ACCENT_RED;
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'warning': return 'warning';
            case 'success': return 'checkmark-circle';
            case 'info': return 'information-circle';
            default: return 'information-circle';
        }
    };

    const getInsightColor = (type: string) => {
        switch (type) {
            case 'warning': return COLORS.ACCENT_RED;
            case 'success': return COLORS.ACCENT_GREEN;
            case 'info': return COLORS.ACCENT_BLUE;
            default: return COLORS.ACCENT_BLUE;
        }
    };

    const getProgressTitle = (period: '7d' | '30d' | '90d') => {
        switch (period) {
            case '7d': return "This Week's Progress";
            case '30d': return "This Month's Progress";
            case '90d': return "Last Quarter's Progress";
        }
    };

    const renderHeader = () => (
        <View style={[styles.headerSafeArea, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
                <GradientText text="Advanced Analytics" style={styles.headerTitle} />
                <View style={styles.placeholder} />
            </View>
        </View>
    );

    const renderPeriodSelector = () => (
        <View style={styles.periodSelector}>
            {(['7d', '30d', '90d'] as const).map((period) => (
                <TouchableOpacity
                    key={period}
                    style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
                    onPress={() => setSelectedPeriod(period)}
                >
                    <Text style={[
                        styles.periodButtonText,
                        selectedPeriod === period && styles.periodButtonTextActive
                    ]}>
                        {formatPeriodLabel(period)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderNutritionScore = () => (
        <GradientCard style={styles.scoreCard}>
            <Text style={styles.cardTitle}>Nutrition Score</Text>
            <View style={styles.scoreContainer}>
                <View style={styles.overallScoreContainer}>
                    <Text style={[styles.overallScore, { color: getScoreColor(nutritionScore.overall) }]}>
                        {nutritionScore.overall}
                    </Text>
                    <Text style={styles.scoreLabel}>Overall</Text>
                </View>
                <View style={styles.scoreBreakdown}>
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Consistency</Text>
                        <Text style={styles.scoreValue}>{nutritionScore.consistency}</Text>
                    </View>
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Recovery</Text>
                        <Text style={styles.scoreValue}>{nutritionScore.recovery}</Text>
                    </View>
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Nutrition</Text>
                        <Text style={styles.scoreValue}>{nutritionScore.nutrition}</Text>
                    </View>
                </View>
            </View>
        </GradientCard>
    );

    const renderMacroBreakdown = () => (
        <GradientCard style={styles.macroCard}>
            <Text style={styles.cardTitle}>Daily Average Breakdown</Text>
            <View style={styles.macroStats}>
                <View style={styles.macroStat}>
                    <Text style={styles.macroStatValue}>{avgDailyNutrition.calories}</Text>
                    <Text style={styles.macroStatLabel}>Calories</Text>
                </View>
                <View style={styles.macroStat}>
                    <Text style={styles.macroStatValue}>{avgDailyNutrition.protein}g</Text>
                    <Text style={styles.macroStatLabel}>Protein</Text>
                </View>
                <View style={styles.macroStat}>
                    <Text style={styles.macroStatValue}>{avgDailyNutrition.carbs}g</Text>
                    <Text style={styles.macroStatLabel}>Carbs</Text>
                </View>
                <View style={styles.macroStat}>
                    <Text style={styles.macroStatValue}>{avgDailyNutrition.fat}g</Text>
                    <Text style={styles.macroStatLabel}>Fat</Text>
                </View>
            </View>
        </GradientCard>
    );

    const renderNutritionTrendsChart = () => {
        if (macroTrends.length === 0) return null;

        // Get the full period data
        const periodLength = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        const periodData = macroTrends.slice(-periodLength);

        // Determine how to sample data based on period
        let sampledData;
        let labelFormat;

        if (selectedPeriod === '7d') {
            // For 7-day view, show all daily data points
            sampledData = periodData;
            labelFormat = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })[0];
        } else if (selectedPeriod === '30d') {
            // For 30-day view, use fixed weekly points
            sampledData = [];

            // Get number of weeks (roughly 4)
            const numWeeks = Math.ceil(periodData.length / 7);

            // For each week, calculate the average
            for (let i = 0; i < numWeeks; i++) {
                const weekStart = periodData.length - (i + 1) * 7;  // Start from the end
                const weekEnd = periodData.length - i * 7 - 1;

                // Ensure valid indices
                const validStart = Math.max(0, weekStart);
                const validEnd = Math.min(weekEnd, periodData.length - 1);

                const weekData = periodData.slice(validStart, validEnd + 1);

                // Only add if we have data
                if (weekData.length > 0) {
                    // Calculate averages for the week
                    const avgCalories = weekData.reduce((sum, day) => sum + (day.calories || 0), 0) / weekData.length;
                    const avgProtein = weekData.reduce((sum, day) => sum + (day.protein || 0), 0) / weekData.length;
                    const avgCarbs = weekData.reduce((sum, day) => sum + (day.carbs || 0), 0) / weekData.length;
                    const avgFat = weekData.reduce((sum, day) => sum + (day.fat || 0), 0) / weekData.length;

                    // Use the middle of the week for the date
                    const dateIndex = Math.floor((validStart + validEnd) / 2);
                    const weekDate = periodData[dateIndex]?.date || periodData[validStart]?.date;

                    sampledData.unshift({  // Add to beginning to keep chronological order
                        date: weekDate,
                        calories: avgCalories,
                        protein: avgProtein,
                        carbs: avgCarbs,
                        fat: avgFat,
                        exerciseCalories: 0
                    });
                }
            }

            // Simple week numbers for labels
            labelFormat = (_, index) => `W${index + 1}`;

        } else {
            // For 90-day view, use monthly samples
            sampledData = [];

            // Determine unique months in the data
            const months = new Set();

            // Group by month
            periodData.forEach(day => {
                const date = new Date(day.date);
                const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
                months.add(monthYear);
            });

            // Process each unique month
            const monthsArray = Array.from(months);
            monthsArray.forEach(monthYear => {
                // Get all days in this month
                const monthData = periodData.filter(day => {
                    const date = new Date(day.date);
                    return `${date.getFullYear()}-${date.getMonth()}` === monthYear;
                });

                if (monthData.length > 0) {
                    // Calculate averages for the month
                    const avgCalories = monthData.reduce((sum, day) => sum + (day.calories || 0), 0) / monthData.length;
                    const avgProtein = monthData.reduce((sum, day) => sum + (day.protein || 0), 0) / monthData.length;
                    const avgCarbs = monthData.reduce((sum, day) => sum + (day.carbs || 0), 0) / monthData.length;
                    const avgFat = monthData.reduce((sum, day) => sum + (day.fat || 0), 0) / monthData.length;

                    sampledData.push({
                        date: monthData[0].date, // Use the first day of the month for the date
                        calories: avgCalories,
                        protein: avgProtein,
                        carbs: avgCarbs,
                        fat: avgFat,
                        exerciseCalories: 0
                    });
                }
            });

            // Sort by date
            sampledData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // For 90-day period, use month abbreviations
            labelFormat = (dateStr: string) => {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', { month: 'short' });
            };
        }

        // Safety check - if we don't have any data after sampling, use original data points
        if (sampledData.length === 0 && periodData.length > 0) {
            // Fall back to showing all the data we have
            sampledData = periodData;
            labelFormat = (dateStr: string) => {
                const date = new Date(dateStr);
                return date.getDate().toString();
            };
        }

        // Make sure we have at least one valid data point
        if (sampledData.length === 0) return null;

        // Find the max value for scaling
        const maxCalories = Math.max(...sampledData.map(t => t.calories || 0), 1);  // Minimum of 1 to avoid division by zero
        const chartHeight = 150;

        return (
            <GradientCard style={styles.cardContainer}>
                <Text style={styles.cardTitle}>Nutrition Trends</Text>
                <Text style={styles.chartSubtitle}>
                    {selectedPeriod === '7d' ? 'Daily averages' :
                        selectedPeriod === '30d' ? 'Weekly averages' : 'Monthly averages'}
                </Text>

                <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_PURPLE }]} />
                        <Text style={styles.legendText}>Calories</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_GREEN }]} />
                        <Text style={styles.legendText}>Protein</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_BLUE }]} />
                        <Text style={styles.legendText}>Carbs</Text>
                    </View>
                </View>

                <View style={styles.chartContainer}>
                    {/* Bar chart visualization with appropriate sampling */}
                    <View style={styles.chartBars}>
                        {sampledData.map((day, index) => {
                            const calorieHeight = ((day.calories || 0) / maxCalories) * chartHeight;
                            const proteinHeight = ((day.protein || 0) * 4 / maxCalories) * chartHeight; // Convert to calories
                            const carbsHeight = ((day.carbs || 0) * 4 / maxCalories) * chartHeight;     // Convert to calories

                            return (
                                <View key={index} style={styles.barGroup}>
                                    <View style={styles.barContainer}>
                                        {/* Calories bar */}
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: Math.max(calorieHeight, 1), // Minimum height of 1
                                                    backgroundColor: COLORS.ACCENT_PURPLE
                                                }
                                            ]}
                                        />
                                        {/* Protein bar */}
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: Math.max(proteinHeight, 1), // Minimum height of 1
                                                    backgroundColor: COLORS.ACCENT_GREEN,
                                                    width: 4,
                                                    marginLeft: 2
                                                }
                                            ]}
                                        />
                                        {/* Carbs bar */}
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: Math.max(carbsHeight, 1), // Minimum height of 1
                                                    backgroundColor: COLORS.ACCENT_BLUE,
                                                    width: 4,
                                                    marginLeft: 1
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.barLabel}>
                                        {typeof labelFormat === 'function' ?
                                            (selectedPeriod === '30d' ? labelFormat(day.date, index) : labelFormat(day.date)) :
                                            `W${index + 1}`}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </GradientCard>
        );
    };

    const renderWeeklyProgress = () => {
        if (macroTrends.length === 0) return null;

        // Get the appropriate data based on selected period
        const periodLength = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
        const periodData = macroTrends.slice(-periodLength);

        // Calculate days on track for the selected period
        const targetCalories = userGoals?.targetCalories || calculateGoalsFromProfile(userProfile).targetCalories;
        const daysOnTrack = periodData.filter(day =>
            day.calories >= targetCalories * 0.9 && day.calories <= targetCalories * 1.1
        ).length;

        // Calculate average calories for the selected period
        const avgCalories = periodData.reduce((sum, day) => sum + day.calories, 0) / periodData.length;

        // Calculate average protein for the selected period
        const avgProtein = periodData.reduce((sum, day) => sum + day.protein, 0) / periodData.length;

        return (
            <GradientCard style={styles.progressCard}>
                <Text style={styles.cardTitle}>{getProgressTitle(selectedPeriod)}</Text>

                <View style={styles.weeklyStats}>
                    <View style={styles.weeklyStat}>
                        <Text style={styles.weeklyStatNumber}>{daysOnTrack}/{periodLength}</Text>
                        <Text style={styles.weeklyStatLabel}>Days on track</Text>
                    </View>
                    <View style={styles.weeklyStat}>
                        <Text style={[styles.weeklyStatNumber, {
                            color: avgCalories <= targetCalories ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                        }]}>
                            {Math.round(avgCalories)}
                        </Text>
                        <Text style={styles.weeklyStatLabel}>Avg calories</Text>
                    </View>
                    <View style={styles.weeklyStat}>
                        <Text style={[styles.weeklyStatNumber, {
                            color: Math.round(avgProtein) >= (userGoals?.proteinGoal || calculateGoalsFromProfile(userProfile).proteinGoal) ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                        }]}>
                            {Math.round(avgProtein)}g
                        </Text>
                        <Text style={styles.weeklyStatLabel}>Avg protein</Text>
                    </View>
                </View>

                {/* Determine number of indicators based on period */}
                {selectedPeriod === '7d' ? (
                    // For 7-day view, show daily indicators
                    <View style={styles.weekDaysContainer}>
                        {periodData.map((day, index) => {
                            const isLogged = day.calories > 0;
                            const isOnTrack = day.calories >= targetCalories * 0.9 && day.calories <= targetCalories * 1.1;

                            return (
                                <View key={index} style={styles.dayIndicator}>
                                    <View style={[styles.dayDot, {
                                        backgroundColor: !isLogged ? COLORS.LIGHT_GRAY :
                                            isOnTrack ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                                    }]} />
                                    <Text style={styles.dayAbbrev}>
                                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })[0]}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                ) : selectedPeriod === '30d' ? (
                    // For 30-day view, show 4 weekly indicators
                    <View style={styles.longPeriodDotsContainer}>
                        {Array.from({ length: 4 }).map((_, i) => {
                            // Each dot represents 1 week (7 days)
                            const startIdx = i * 7;
                            const endIdx = Math.min((i + 1) * 7 - 1, periodData.length - 1);

                            // Get data for this week
                            const weekData = periodData.slice(startIdx, endIdx + 1);
                            const hasLoggedDays = weekData.some(day => day.calories > 0);

                            // Calculate if this week is on track (more than 50% of logged days on target)
                            const loggedDays = weekData.filter(day => day.calories > 0);
                            const onTrackDays = loggedDays.filter(day =>
                                day.calories >= targetCalories * 0.9 && day.calories <= targetCalories * 1.1
                            );

                            const isOnTrack = loggedDays.length > 0 &&
                                (onTrackDays.length / loggedDays.length) >= 0.5;

                            return (
                                <View key={i} style={styles.dayIndicator}>
                                    <View style={[styles.dayDot, {
                                        backgroundColor: !hasLoggedDays ? COLORS.LIGHT_GRAY :
                                            isOnTrack ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                                    }]} />
                                    <Text style={styles.dayAbbrev}>
                                        W{i + 1}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    // For 90-day view, show 12 weekly indicators (approximately 3 months)
                    <View style={styles.longPeriodDotsContainer}>
                        {Array.from({ length: 12 }).map((_, i) => {
                            // For 90 days (approximately 13 weeks), each dot represents roughly 1 week
                            const weeksPerDot = 90 / 12 / 7;
                            const startIdx = Math.floor(i * 7 * weeksPerDot);
                            const endIdx = Math.min(Math.floor((i + 1) * 7 * weeksPerDot) - 1, periodData.length - 1);

                            // Get data for this week segment
                            const weekData = periodData.slice(startIdx, endIdx + 1);
                            const hasLoggedDays = weekData.some(day => day.calories > 0);

                            // Calculate if this week is on track (more than 50% of logged days on target)
                            const loggedDays = weekData.filter(day => day.calories > 0);
                            const onTrackDays = loggedDays.filter(day =>
                                day.calories >= targetCalories * 0.9 && day.calories <= targetCalories * 1.1
                            );

                            const isOnTrack = loggedDays.length > 0 &&
                                (onTrackDays.length / loggedDays.length) >= 0.5;

                            return (
                                <View key={i} style={styles.dayIndicator}>
                                    <View style={[styles.dayDot, {
                                        backgroundColor: !hasLoggedDays ? COLORS.LIGHT_GRAY :
                                            isOnTrack ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                                    }]} />
                                    <Text style={styles.dayAbbrev}>
                                        W{i + 1}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </GradientCard>
        );
    };

    const renderQuickWins = () => {
        const proteinGoal = userGoals?.proteinGoal || calculateGoalsFromProfile(userProfile).proteinGoal;
        const needsMoreProtein = avgDailyNutrition.protein < proteinGoal;
        // Dynamic thresholds based on user experience and goals
        const consistencyThreshold = userProfile?.experience_level === 'beginner' ? 60 : 75; // More lenient for beginners
        const nutritionThreshold = userProfile?.fitness_goal === 'lose_weight' ? 65 : 70; // Slightly more lenient for weight loss

        const inconsistentCalories = nutritionScore.consistency < consistencyThreshold;
        const poorNutrition = nutritionScore.nutrition < nutritionThreshold;
        const poorRecovery = nutritionScore.recovery < 70;

        const tips = [];
        if (needsMoreProtein) {
            tips.push({
                icon: '🥩',
                title: 'Boost protein',
                subtitle: `Add ${Math.round(proteinGoal - avgDailyNutrition.protein)}g more daily`
            });
        }
        if (inconsistentCalories) {
            tips.push({
                icon: '📅',
                title: 'Stay consistent',
                subtitle: 'Aim for similar calories each day'
            });
        }
        if (poorNutrition) {
            tips.push({
                icon: '⚖️',
                title: 'Balance nutrition',
                subtitle: 'Adjust protein/carb/fat ratios'
            });
        }
        if (poorRecovery) {
            tips.push({
                icon: '💪',
                title: 'Improve recovery',
                subtitle: 'Focus on adequate protein and calories'
            });
        }

        if (tips.length === 0) {
            tips.push({
                icon: '🎯',
                title: 'Stay the course',
                subtitle: 'Your nutrition is well balanced!'
            });
        }

        return (
            <GradientCard style={styles.quickWinsCard}>
                <Text style={styles.cardTitle}>Quick Wins</Text>
                <Text style={styles.quickWinsSubtitle}>Simple changes for better results</Text>

                {tips.slice(0, 3).map((tip, index) => (
                    <View key={index} style={styles.tipRow}>
                        <Text style={styles.tipIcon}>{tip.icon}</Text>
                        <View style={styles.tipContent}>
                            <Text style={styles.tipTitle}>{tip.title}</Text>
                            <Text style={styles.tipSubtitle}>{tip.subtitle}</Text>
                        </View>
                    </View>
                ))}
            </GradientCard>
        );
    };

    const renderDynamicTimeline = (profile: any) => {
        // Generate timeline based on user's goal and experience level
        const fitnessGoal = profile?.fitness_goal || 'maintain_weight';
        const isNewbie = !profile?.experience_level || profile?.experience_level === 'beginner';

        if (fitnessGoal === 'lose_weight') {
            return (
                <>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_GREEN }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 1-4</Text>
                            <Text style={styles.timelineDescription}>Water weight loss (1-3kg)</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_BLUE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 5-12</Text>
                            <Text style={styles.timelineDescription}>Steady fat loss (0.5-1kg/week)</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_PURPLE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 13+</Text>
                            <Text style={styles.timelineDescription}>Body recomposition</Text>
                        </View>
                    </View>
                </>
            );
        } else if (fitnessGoal === 'build_muscle' || fitnessGoal === 'gain_weight') {
            return (
                <>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_GREEN }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 1-4</Text>
                            <Text style={styles.timelineDescription}>{isNewbie ? 'Strength gains' : 'Muscle pumps'}</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_BLUE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 5-12</Text>
                            <Text style={styles.timelineDescription}>Muscle growth phase</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_PURPLE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 13+</Text>
                            <Text style={styles.timelineDescription}>Strength & definition</Text>
                        </View>
                    </View>
                </>
            );
        } else {
            // Maintenance or general health
            return (
                <>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_GREEN }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 1-4</Text>
                            <Text style={styles.timelineDescription}>Habit formation</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_BLUE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 5-12</Text>
                            <Text style={styles.timelineDescription}>Energy & vitality</Text>
                        </View>
                    </View>
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.ACCENT_PURPLE }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineDate}>Week 13+</Text>
                            <Text style={styles.timelineDescription}>Long-term wellness</Text>
                        </View>
                    </View>
                </>
            );
        }
    };

    const renderPredictiveInsights = () => {
        // Only render if we have real user data
        if (!userProfile?.weight || !userProfile?.target_weight || !userProfile?.age || !userGoals?.targetCalories || !userGoals?.proteinGoal) {
            return null;
        }

        // Get real user data from profile and goals
        const currentWeight = userGoals?.currentWeight || userProfile?.weight;
        const goalWeight = userGoals?.targetWeight || userProfile?.target_weight;
        const userAge = userGoals?.age || userProfile?.age;
        const targetCalories = userGoals?.targetCalories;
        const avgWeeklyDeficit = (avgDailyNutrition.calories - targetCalories) * 7;
        const weeksToGoal = avgWeeklyDeficit < -1000 ? Math.ceil(Math.abs(currentWeight - goalWeight) * 7700 / Math.abs(avgWeeklyDeficit)) : null;

        // Metabolic age estimation
        const proteinGoal = userGoals?.proteinGoal;
        const metabolicAgeModifiers = {
            proteinIntake: avgDailyNutrition.protein >= proteinGoal ? -2 : avgDailyNutrition.protein >= proteinGoal * 0.8 ? 0 : 2,
            calorieConsistency: nutritionScore.consistency >= 80 ? -1 : nutritionScore.consistency >= 60 ? 0 : 2,
            nutritionQuality: nutritionScore.nutrition >= 75 ? -1 : nutritionScore.nutrition >= 60 ? 0 : 1,
            recoverySupport: nutritionScore.recovery >= 75 ? -1 : nutritionScore.recovery >= 60 ? 0 : 1,
        };

        const metabolicAge = Math.max(18, userAge + Object.values(metabolicAgeModifiers).reduce((sum, mod) => sum + mod, 0));

        return (
            <GradientCard style={styles.predictiveCard}>
                <Text style={styles.cardTitle}>🔮 Predictive Insights</Text>

                {/* Goal Projection */}
                <View style={styles.predictionSection}>
                    <View style={styles.predictionHeader}>
                        <MaterialCommunityIcons name="target" size={20} color={COLORS.ACCENT_GREEN} />
                        <Text style={styles.predictionTitle}>Goal Projection</Text>
                    </View>
                    {weeksToGoal && weeksToGoal <= 52 ? (
                        <Text style={styles.predictionText}>
                            📅 You should reach {goalWeight}kg by{'\n'}
                            <Text style={styles.highlightText}>
                                {new Date(Date.now() + weeksToGoal * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </Text>
                        </Text>
                    ) : (
                        <Text style={styles.predictionText}>
                            📈 Adjust your calorie surplus to see goal completion date
                        </Text>
                    )}
                </View>

                {/* Metabolic Age */}
                <View style={styles.predictionSection}>
                    <View style={styles.predictionHeader}>
                        <MaterialCommunityIcons name="dna" size={20} color={COLORS.ACCENT_BLUE} />
                        <Text style={styles.predictionTitle}>Metabolic Age</Text>
                    </View>
                    <Text style={styles.predictionText}>
                        🧬 Your nutrition patterns suggest a{'\n'}metabolic age of{' '}
                        <Text style={[styles.highlightText, {
                            color: metabolicAge <= userAge ? COLORS.ACCENT_GREEN : COLORS.ACCENT_ORANGE
                        }]}>{metabolicAge} years</Text>
                    </Text>
                    {metabolicAge > userAge && (
                        <Text style={styles.improvementTip}>
                            💡 Increase protein and meal consistency to improve
                        </Text>
                    )}
                </View>

                {/* Transformation Timeline */}
                <View style={styles.predictionSection}>
                    <View style={styles.predictionHeader}>
                        <MaterialCommunityIcons name="timeline-text" size={20} color={COLORS.ACCENT_PURPLE} />
                        <Text style={styles.predictionTitle}>Transformation Timeline</Text>
                    </View>
                    <View style={styles.timelineContainer}>
                        {renderDynamicTimeline(userProfile)}
                    </View>
                </View>
            </GradientCard>
        );
    };

    const renderInsights = () => (
        <GradientCard style={styles.insightsCard}>
            <Text style={styles.cardTitle}>Personalized Insights</Text>
            {insights.length === 0 ? (
                <Text style={styles.noInsightsText}>
                    Continue logging meals to receive personalized insights and recommendations.
                </Text>
            ) : (
                insights.map((insight, index) => (
                    <View key={index} style={styles.insightItem}>
                        <View style={styles.insightHeader}>
                            <Ionicons
                                name={getInsightIcon(insight.type) as any}
                                size={20}
                                color={getInsightColor(insight.type)}
                            />
                            <Text style={styles.insightTitle}>{insight.title}</Text>
                        </View>
                        <Text style={styles.insightDescription}>{insight.description}</Text>
                        {insight.recommendation && (
                            <Text style={styles.insightRecommendation}>
                                💡 {insight.recommendation}
                            </Text>
                        )}
                    </View>
                ))
            )}
        </GradientCard>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.ACCENT_PURPLE} />
                    <Text style={styles.loadingText}>Analyzing your nutrition data...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderHeader()}
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {renderPeriodSelector()}
                {renderNutritionScore()}
                {renderMacroBreakdown()}
                {renderNutritionTrendsChart()}
                {renderWeeklyProgress()}
                {renderQuickWins()}
                {renderPredictiveInsights()}
                {renderInsights()}

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    headerSafeArea: {
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: horizontalPadding,
        paddingTop: 15,
        paddingBottom: 15,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    placeholder: {
        width: 34,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: horizontalPadding,
    },
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: COLORS.CARD_BG,
        borderRadius: cardRadius,
        padding: 4,
        marginBottom: cardSpacing,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    periodButtonActive: {
        backgroundColor: COLORS.ACCENT_PURPLE,
    },
    periodButtonText: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        fontWeight: '500',
    },
    periodButtonTextActive: {
        color: COLORS.WHITE,
        fontWeight: '600',
    },
    cardContainer: {
        marginBottom: cardSpacing,
        borderRadius: cardRadius,
        overflow: 'hidden',
    },
    gradientCard: {
        backgroundColor: COLORS.CARD_BG,
        borderRadius: cardRadius,
        padding: horizontalPadding,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 15,
    },
    scoreCard: {},
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    overallScoreContainer: {
        alignItems: 'center',
        marginRight: 30,
    },
    overallScore: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    scoreLabel: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        marginTop: 5,
    },
    scoreBreakdown: {
        flex: 1,
    },
    scoreItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    scoreValue: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    scoreItemLabel: {
        color: COLORS.SUBDUED,
        fontSize: 14,
    },
    macroCard: {},
    macroStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroStat: {
        alignItems: 'center',
    },
    macroStatValue: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    macroStatLabel: {
        color: COLORS.SUBDUED,
        fontSize: 12,
        marginTop: 2,
    },
    insightsCard: {},
    noInsightsText: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    insightItem: {
        marginBottom: 15,
        padding: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    insightTitle: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    insightDescription: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    insightRecommendation: {
        color: COLORS.ACCENT_BLUE,
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.SUBDUED,
        fontSize: 16,
        marginTop: 15,
    },
    bottomSpacer: {
        height: 30,
    },
    // Progress card styles
    progressCard: {},
    weeklyStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 15,
    },
    weeklyStat: {
        alignItems: 'center',
        flex: 1,
    },
    weeklyStatNumber: {
        color: COLORS.WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    weeklyStatLabel: {
        color: COLORS.SUBDUED,
        fontSize: 12,
        textAlign: 'center',
    },
    weekDaysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 15,
        paddingHorizontal: 10,
    },
    dayIndicator: {
        alignItems: 'center',
        minWidth: 30,
    },
    dayDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginBottom: 4,
    },
    dayAbbrev: {
        color: COLORS.SUBDUED,
        fontSize: 10,
    },
    // Quick wins styles
    quickWinsCard: {},
    quickWinsSubtitle: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        marginBottom: 15,
        fontStyle: 'italic',
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
    },
    tipIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        color: COLORS.WHITE,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    tipSubtitle: {
        color: COLORS.SUBDUED,
        fontSize: 12,
    },
    predictiveCard: {},
    predictionSection: {
        marginBottom: 25,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    predictionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    predictionTitle: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    predictionText: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 8,
    },
    highlightText: {
        color: COLORS.ACCENT_GREEN,
        fontWeight: '600',
        fontSize: 16,
    },
    improvementTip: {
        color: COLORS.ACCENT_BLUE,
        fontSize: 13,
        fontStyle: 'italic',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    timelineContainer: {
        marginTop: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingLeft: 5,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
        marginTop: 2,
    },
    timelineContent: {
        flex: 1,
    },
    timelineDate: {
        color: COLORS.WHITE,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    timelineDescription: {
        color: COLORS.SUBDUED,
        fontSize: 12,
        lineHeight: 16,
    },
    // Chart styles
    chartSubtitle: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        marginTop: -10,
        marginBottom: 15,
    },
    chartContainer: {
        height: 180,
        marginTop: 10,
    },
    chartBars: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 150,
    },
    barGroup: {
        alignItems: 'center',
        flex: 1,
    },
    barContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 150,
    },
    bar: {
        width: 6,
        borderRadius: 3,
        backgroundColor: COLORS.ACCENT_PURPLE,
    },
    barLabel: {
        color: COLORS.SUBDUED,
        fontSize: 10,
        marginTop: 4,
    },
    chartLegend: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 5,
    },
    legendText: {
        color: COLORS.SUBDUED,
        fontSize: 12,
    },

    // Progress styles
    progressBar: {
        height: 20,
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 10,
        marginVertical: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 10,
    },
    progressSummary: {
        color: COLORS.SUBDUED,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 5,
    },
    progressSummaryContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    longPeriodDotsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 10,
        flexWrap: 'wrap',
        marginTop: 20,
        marginBottom: 10,
    },
    longPeriodDayIndicator: {
        alignItems: 'center',
        marginHorizontal: 2,
        marginVertical: 5,
    },
});

export default Analytics; 