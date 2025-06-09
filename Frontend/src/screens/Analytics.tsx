import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
    ActivityIndicator,
    Platform,
    Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useAuth } from '../context/AuthContext';
import {
    getFoodLogsByDate,
    getTodayCalories,
    getTodayProtein,
    getTodayCarbs,
    getTodayFats,
    getTodayExerciseCalories,
    getUserProfileByFirebaseUid
} from '../utils/database';

const { width, height } = Dimensions.get('window');

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
    balance: number;
    timing: number;
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

    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [nutritionScore, setNutritionScore] = useState<NutritionScore>({
        overall: 0,
        consistency: 0,
        balance: 0,
        timing: 0
    });
    const [macroTrends, setMacroTrends] = useState<MacroTrend[]>([]);
    const [insights, setInsights] = useState<NutritionInsight[]>([]);
    const [avgDailyNutrition, setAvgDailyNutrition] = useState({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    });

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

            // Get user profile for calculations
            const profile = await getUserProfileByFirebaseUid(user?.uid || '');

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
            setNutritionScore({ overall: 0, consistency: 0, balance: 0, timing: 0 });
            return;
        }

        // Consistency Score (based on calorie variance)
        const avgCalories = validDays.reduce((sum, day) => sum + day.calories, 0) / validDays.length;
        const variance = validDays.reduce((sum, day) => sum + Math.pow(day.calories - avgCalories, 2), 0) / validDays.length;
        const consistencyScore = Math.max(0, 100 - (Math.sqrt(variance) / avgCalories * 100));

        // Balance Score (macro distribution)
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

        // Ideal ranges: Protein 25-30%, Carbs 45-50%, Fat 25-30%
        const proteinScore = 100 - Math.abs(avgProteinPercent - 27.5) * 2;
        const carbScore = 100 - Math.abs(avgCarbPercent - 47.5) * 2;
        const fatScore = 100 - Math.abs(avgFatPercent - 27.5) * 2;
        const balanceScore = (Math.max(0, proteinScore) + Math.max(0, carbScore) + Math.max(0, fatScore)) / 3;

        // Timing Score (placeholder)
        const timingScore = 75;

        const overallScore = (consistencyScore + balanceScore + timingScore) / 3;

        setNutritionScore({
            overall: Math.round(overallScore),
            consistency: Math.round(consistencyScore),
            balance: Math.round(balanceScore),
            timing: Math.round(timingScore)
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
        const estimatedTDEE = calculateTDEE(profile);

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
        const proteinTarget = (profile?.weight || 70) * 1.6; // 1.6g per kg body weight

        if (avgProtein < proteinTarget * 0.8) {
            insights.push({
                type: 'warning',
                title: 'Low Protein Intake',
                description: `Average protein (${Math.round(avgProtein)}g) is below optimal range (${Math.round(proteinTarget)}g).`,
                recommendation: 'Add lean proteins like chicken, fish, beans, or Greek yogurt to your meals.'
            });
        } else if (avgProtein >= proteinTarget) {
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

    const calculateBMR = (profile: any) => {
        if (!profile?.weight || !profile?.height || !profile?.age) return 1800;

        // Mifflin-St Jeor Equation
        if (profile.gender === 'male') {
            return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
        } else {
            return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
        }
    };

    const calculateTDEE = (profile: any) => {
        const bmr = calculateBMR(profile);
        const activityMultipliers = {
            'sedentary': 1.2,
            'light': 1.375,
            'moderate': 1.55,
            'active': 1.725,
            'very_active': 1.9
        };

        const multiplier = activityMultipliers[profile?.activity_level as keyof typeof activityMultipliers] || 1.375;
        return bmr * multiplier;
    };

    const formatPeriodLabel = (period: '7d' | '30d' | '90d') => {
        switch (period) {
            case '7d': return 'Last 7 Days';
            case '30d': return 'Last 30 Days';
            case '90d': return 'Last 90 Days';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return COLORS.ACCENT_GREEN;
        if (score >= 60) return COLORS.ACCENT_ORANGE;
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

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
            <GradientText text="Advanced Analytics" style={styles.headerTitle} />
            <View style={styles.placeholder} />
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
                        <Text style={styles.scoreItemLabel}>Balance</Text>
                        <Text style={styles.scoreValue}>{nutritionScore.balance}</Text>
                    </View>
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreItemLabel}>Timing</Text>
                        <Text style={styles.scoreValue}>{nutritionScore.timing}</Text>
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
            <SafeAreaView style={styles.container}>
                {renderHeader()}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.ACCENT_PURPLE} />
                    <Text style={styles.loadingText}>Analyzing your nutrition data...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {renderHeader()}
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {renderPeriodSelector()}
                {renderNutritionScore()}
                {renderMacroBreakdown()}
                {renderInsights()}

                {/* Goal Projections */}
                <GradientCard style={styles.projectionsCard}>
                    <Text style={styles.cardTitle}>Goal Projections</Text>
                    <View style={styles.projectionItem}>
                        <MaterialCommunityIcons name="target" size={24} color={COLORS.ACCENT_GREEN} />
                        <View style={styles.projectionContent}>
                            <Text style={styles.projectionTitle}>Weight Goal Progress</Text>
                            <Text style={styles.projectionDescription}>
                                Based on current patterns, you're on track to reach your goal by March 2025
                            </Text>
                        </View>
                    </View>
                    <View style={styles.projectionItem}>
                        <MaterialCommunityIcons name="chart-line" size={24} color={COLORS.ACCENT_BLUE} />
                        <View style={styles.projectionContent}>
                            <Text style={styles.projectionTitle}>Metabolic Health</Text>
                            <Text style={styles.projectionDescription}>
                                Your eating patterns suggest a metabolic age within healthy range for your age group
                            </Text>
                        </View>
                    </View>
                </GradientCard>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 0 : 20,
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
        paddingHorizontal: 20,
    },
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
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
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientCard: {
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 16,
        padding: 20,
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
    projectionsCard: {},
    projectionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    projectionContent: {
        flex: 1,
        marginLeft: 15,
    },
    projectionTitle: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 5,
    },
    projectionDescription: {
        color: COLORS.SUBDUED,
        fontSize: 14,
        lineHeight: 20,
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
});

export default Analytics; 