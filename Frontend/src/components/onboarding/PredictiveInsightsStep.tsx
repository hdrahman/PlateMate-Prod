import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Animated,
    Easing,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import Svg, {
    Path,
    Circle,
    Defs,
    LinearGradient as SvgGradient,
    Stop,
    Text as SvgText,
    G,
    ClipPath,
    Rect
} from 'react-native-svg';

// Try to import date-fns functions with fallbacks
let format, addWeeks, addDays;
try {
    const dateFns = require('date-fns');
    format = dateFns.format;
    addWeeks = dateFns.addWeeks;
    addDays = dateFns.addDays;
} catch (error) {
    console.warn('date-fns library not available:', error);
    format = (date) => date.toLocaleDateString();
    addWeeks = (date, weeks) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + weeks * 7);
        return newDate;
    };
    addDays = (date, days) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + days);
        return newDate;
    };
}

interface PredictiveInsightsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onComplete: () => void;
}

interface Milestone {
    week: number;
    title: string;
    description: string;
    icon: string;
    color: string;
}

interface SuccessMetric {
    label: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
    icon: string;
    color: string;
}

const { width, height } = Dimensions.get('window');

const PredictiveInsightsStep: React.FC<PredictiveInsightsStepProps> = ({ profile, updateProfile, onComplete }) => {
    const { user, signUp } = useAuth(); // Get current user and signUp function
    const [targetDate, setTargetDate] = useState<string>('');
    const [dailyCalories, setDailyCalories] = useState<number>(0);
    const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
    const [successRate, setSuccessRate] = useState<number>(87);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [successMetrics, setSuccessMetrics] = useState<SuccessMetric[]>([]);
    const [estimatedWeeks, setEstimatedWeeks] = useState<number>(24);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const counterAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        calculateMetrics();
        startAnimations();
    }, [profile]);

    const startAnimations = () => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(progressAnim, {
                toValue: 1,
                duration: 1200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
            Animated.timing(counterAnim, {
                toValue: 1,
                duration: 1000,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
        ]).start();
    };

    const calculateMetrics = () => {
        const weeks = calculateEstimatedWeeks();
        setEstimatedWeeks(weeks);

        const completionDate = addWeeks(new Date(), weeks);
        setTargetDate(format(completionDate, 'MMMM d, yyyy'));

        const calories = calculateDailyCalories();
        setDailyCalories(calories);

        const calculatedMacros = calculateMacros(calories);
        setMacros(calculatedMacros);

        calculateSuccessRate();
        generateMilestones(weeks);
        generateSuccessMetrics();
    };

    const calculateEstimatedWeeks = (): number => {
        if (!profile.weight || !profile.targetWeight || profile.weight === profile.targetWeight) {
            return 24;
        }

        const weightDiff = Math.abs(profile.weight - profile.targetWeight);
        let weeklyRate = 0.5;

        if (profile.weightGoal) {
            switch (profile.weightGoal) {
                case 'lose_1': weeklyRate = 1; break;
                case 'lose_0_75': weeklyRate = 0.75; break;
                case 'lose_0_5': weeklyRate = 0.5; break;
                case 'lose_0_25': weeklyRate = 0.25; break;
                case 'gain_0_25': weeklyRate = 0.25; break;
                case 'gain_0_5': weeklyRate = 0.5; break;
                default: weeklyRate = 0.5;
            }
        }

        const estimatedWeeks = Math.ceil(weightDiff / weeklyRate);
        return Math.min(Math.max(estimatedWeeks, 4), 52);
    };

    const calculateDailyCalories = (): number => {
        if (!profile.weight || !profile.height || !profile.age || !profile.gender) {
            return 2000;
        }

        let bmr = 0;
        if (profile.gender.toLowerCase() === 'male') {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * (profile.age || 30) + 5;
        } else {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * (profile.age || 30) - 161;
        }

        let activityMultiplier = 1.2;
        if (profile.activityLevel) {
            switch (profile.activityLevel) {
                case 'sedentary': activityMultiplier = 1.2; break;
                case 'lightly_active': activityMultiplier = 1.375; break;
                case 'moderately_active': activityMultiplier = 1.55; break;
                case 'very_active': activityMultiplier = 1.725; break;
                case 'extra_active': activityMultiplier = 1.9; break;
                default: activityMultiplier = 1.2;
            }
        }

        let tdee = Math.round(bmr * activityMultiplier);

        if (profile.fitnessGoal === 'fat_loss') {
            tdee -= 500;
        } else if (profile.fitnessGoal === 'muscle_gain') {
            tdee += 300;
        }

        return tdee;
    };

    const calculateMacros = (calories: number) => {
        let protein = 0;
        let fat = 0;
        let carbs = 0;

        if (profile.fitnessGoal === 'fat_loss') {
            protein = Math.round((calories * 0.30) / 4);
            fat = Math.round((calories * 0.30) / 9);
            carbs = Math.round((calories * 0.40) / 4);
        } else if (profile.fitnessGoal === 'muscle_gain') {
            protein = Math.round((calories * 0.30) / 4);
            fat = Math.round((calories * 0.25) / 9);
            carbs = Math.round((calories * 0.45) / 4);
        } else {
            protein = Math.round((calories * 0.30) / 4);
            fat = Math.round((calories * 0.30) / 9);
            carbs = Math.round((calories * 0.40) / 4);
        }

        return { protein, carbs, fat };
    };

    const calculateSuccessRate = () => {
        let baseRate = 80;

        if (profile.fitnessGoal === 'balanced') {
            baseRate += 5;
        } else if (profile.fitnessGoal === 'fat_loss') {
            if (profile.weightGoal === 'lose_0_25') {
                baseRate += 7;
            } else if (profile.weightGoal === 'lose_0_5') {
                baseRate += 4;
            } else if (profile.weightGoal === 'lose_0_75') {
                baseRate -= 2;
            } else if (profile.weightGoal === 'lose_1') {
                baseRate -= 5;
            }
        }

        if (profile.cheatDayEnabled) {
            baseRate += 3;
        }

        setSuccessRate(Math.min(Math.max(Math.round(baseRate), 75), 92));
    };

    const generateMilestones = (weeks: number) => {
        const milestoneData: Milestone[] = [];

        // Week 2 milestone
        milestoneData.push({
            week: 2,
            title: "Habit Formation",
            description: "Your tracking becomes automatic",
            icon: "checkmark-circle",
            color: "#22C55E"
        });

        // Quarter milestone
        const quarterWeek = Math.floor(weeks / 4);
        milestoneData.push({
            week: quarterWeek,
            title: "Visible Changes",
            description: "Friends start noticing your progress",
            icon: "eye",
            color: "#3B82F6"
        });

        // Half milestone
        const halfWeek = Math.floor(weeks / 2);
        milestoneData.push({
            week: halfWeek,
            title: "Breakthrough Moment",
            description: "Your mindset shifts permanently",
            icon: "lightning-bolt",
            color: "#F59E0B"
        });

        // Final milestone
        milestoneData.push({
            week: weeks,
            title: "Goal Achievement",
            description: "You've reached your target!",
            icon: "trophy",
            color: "#EF4444"
        });

        setMilestones(milestoneData);
    };

    const generateSuccessMetrics = () => {
        const metrics: SuccessMetric[] = [
            {
                label: "Energy Levels",
                value: "+47%",
                trend: "up",
                icon: "battery-charging",
                color: "#22C55E"
            },
            {
                label: "Sleep Quality",
                value: "+38%",
                trend: "up",
                icon: "moon",
                color: "#3B82F6"
            },
            {
                label: "Confidence",
                value: "+62%",
                trend: "up",
                icon: "trending-up",
                color: "#F59E0B"
            },
            {
                label: "Stress Levels",
                value: "-41%",
                trend: "down",
                icon: "trending-down",
                color: "#EF4444"
            }
        ];

        setSuccessMetrics(metrics);
    };

    const renderProgressRing = (percentage: number, size: number, strokeWidth: number, color: string) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const strokeDasharray = circumference;

        return (
            <Animated.View style={{ width: size, height: size }}>
                <Svg width={size} height={size}>
                    <Defs>
                        <SvgGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor={color} stopOpacity="1" />
                            <Stop offset="100%" stopColor={color} stopOpacity="0.6" />
                        </SvgGradient>
                    </Defs>

                    {/* Background circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />

                    {/* Progress circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={`url(#gradient-${color})`}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDasharray - (strokeDasharray * percentage) / 100}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                </Svg>
            </Animated.View>
        );
    };

    const renderHeroCard = () => (
        <Animated.View
            style={[
                styles.heroCardContainer,
                {
                    opacity: fadeAnim,
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim }
                    ]
                }
            ]}
        >
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={styles.heroCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.heroCard}>
                    <View style={styles.heroContent}>
                        <Text style={styles.heroTitle}>Your Transformation Journey</Text>
                        <Text style={styles.heroSubtitle}>
                            Based on your profile, here's what we predict for your success
                        </Text>

                        <View style={styles.successRateContainer}>
                            <View style={styles.progressRingContainer}>
                                {renderProgressRing(successRate, 120, 8, '#A855F7')}
                                <View style={styles.progressRingContent}>
                                    <Text style={styles.successPercentage}>
                                        {successRate}%
                                    </Text>
                                    <Text style={styles.successLabel}>Success Rate</Text>
                                </View>
                            </View>

                            <View style={styles.successDetails}>
                                <Text style={styles.successDescription}>
                                    You're {successRate}% likely to achieve your goals with PlateMate's personalized approach.
                                </Text>
                                <View style={styles.comparisonRow}>
                                    <Text style={styles.comparisonText}>vs. 23% with traditional diets</Text>
                                    <Ionicons name="trending-up" size={16} color="#22C55E" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );

    const renderTimelineCard = () => (
        <Animated.View
            style={[
                styles.timelineCardContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
        >
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.timelineCard}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="map" size={24} color="#06B6D4" />
                        <Text style={styles.cardTitle}>Your Transformation Timeline</Text>
                    </View>

                    <View style={styles.timelineContainer}>
                        {milestones.map((milestone, index) => (
                            <View key={index} style={styles.timelineItem}>
                                <View style={styles.timelineLeftColumn}>
                                    <Text style={styles.timelineWeek}>Week {milestone.week}</Text>
                                </View>

                                <View style={styles.timelineMiddleColumn}>
                                    <View style={[styles.timelineIcon, { backgroundColor: milestone.color }]}>
                                        <Ionicons name={milestone.icon as any} size={16} color="#fff" />
                                    </View>
                                    {index < milestones.length - 1 && <View style={styles.timelineLine} />}
                                </View>

                                <View style={styles.timelineRightColumn}>
                                    <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                                    <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );

    const renderNutritionCard = () => (
        <Animated.View
            style={[
                styles.nutritionCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.cardHeader}>
                <Ionicons name="nutrition" size={24} color="#10B981" />
                <Text style={styles.cardTitle}>Your Personalized Nutrition Plan</Text>
            </View>

            <View style={styles.nutritionContent}>
                <View style={styles.calorieTargetContainer}>
                    <View style={styles.calorieHeader}>
                        <Ionicons name="flame" size={32} color="#F97316" />
                        <View>
                            <Text style={styles.calorieValue}>
                                {dailyCalories.toLocaleString()}
                            </Text>
                            <Text style={styles.calorieLabel}>Daily Calories</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.macrosGrid}>
                    {[
                        { name: 'Protein', value: macros.protein, color: '#EF4444', icon: 'fitness' },
                        { name: 'Carbs', value: macros.carbs, color: '#F97316', icon: 'leaf' },
                        { name: 'Fat', value: macros.fat, color: '#22C55E', icon: 'water' }
                    ].map((macro, index) => (
                        <View key={index} style={styles.macroCard}>
                            <View style={[styles.macroIcon, { backgroundColor: macro.color }]}>
                                <Ionicons name={macro.icon as any} size={20} color="#fff" />
                            </View>
                            <Text style={styles.macroValue}>
                                {macro.value}g
                            </Text>
                            <Text style={styles.macroName}>{macro.name}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </Animated.View>
    );

    const renderMetricsCard = () => (
        <Animated.View
            style={[
                styles.metricsCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.cardHeader}>
                <Ionicons name="analytics" size={24} color="#3B82F6" />
                <Text style={styles.cardTitle}>Expected Health Improvements</Text>
            </View>

            <View style={styles.metricsGrid}>
                {successMetrics.map((metric, index) => (
                    <View key={index} style={styles.metricItem}>
                        <View style={styles.metricHeader}>
                            <View style={[styles.metricIcon, { backgroundColor: metric.color }]}>
                                <Ionicons name={metric.icon as any} size={18} color="#fff" />
                            </View>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                        </View>

                        <View style={styles.metricValueContainer}>
                            <Text style={[styles.metricValue, { color: '#fff' }]}>
                                {metric.value}
                            </Text>
                            <Ionicons
                                name={metric.trend === 'up' ? 'trending-up' : 'trending-down'}
                                size={16}
                                color={metric.trend === 'down' ? '#EF4444' : '#22C55E'}
                            />
                        </View>
                    </View>
                ))}
            </View>
        </Animated.View>
    );

    const renderCompletionCard = () => (
        <Animated.View
            style={[
                styles.completionCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
        >
            <View style={styles.completionContent}>
                <Ionicons name="calendar" size={32} color="#F59E0B" />
                <Text style={styles.completionTitle}>Target Achievement Date</Text>
                <Text style={styles.completionDate}>{targetDate}</Text>
                <Text style={styles.completionSubtext}>
                    In approximately {estimatedWeeks} weeks, you'll reach your goal
                </Text>
            </View>
        </Animated.View>
    );

    const { completeOnboarding } = useOnboarding();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const handleSubmit = async () => {
        // Automatically create account and start 15-day premium trial
        if (profile.email && profile.password) {
            setIsLoading(true);
            try {
                console.log('🚀 Starting account creation with collected profile data:', profile.email);

                // Prepare calculated data to pass directly (avoids React state race condition)
                const calculatedData = {
                    dailyCalorieTarget: dailyCalories,
                    projectedCompletionDate: targetDate,
                    estimatedDurationWeeks: estimatedWeeks,
                    nutrientFocus: {
                        protein: macros.protein,
                        carbs: macros.carbs,
                        fat: macros.fat,
                    },
                    premium: true,
                    trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
                };

                console.log('📊 Calculated metrics prepared:', calculatedData);

                // Check if user is already authenticated (from AccountCreationStep)
                let authUser = user;

                if (!authUser) {
                    // Create the account if not already authenticated
                    setLoadingMessage('Creating your account...');
                    console.log('👤 Creating user account...');
                    const displayName = `${profile.firstName} ${profile.lastName || ''}`.trim();
                    authUser = await signUp(profile.email, profile.password, displayName);
                    console.log('✅ Account created successfully!');
                    console.log('🆔 New user UID:', authUser?.id);
                    console.log('📧 New user email:', authUser?.email);
                } else {
                    console.log('✅ User already authenticated, skipping account creation');
                    console.log('🆔 Existing user UID:', authUser?.id);
                    console.log('📧 Existing user email:', authUser?.email);
                }

                // No need to wait - we have the user object directly!
                setLoadingMessage('Saving your profile...');
                console.log('💾 Calling completeOnboarding with user and calculated data...');
                console.log('📋 User object being passed:', { id: authUser?.id, email: authUser?.email });

                // Pass user directly to avoid context race condition
                await completeOnboarding(calculatedData, authUser);
                console.log('✅ Onboarding completed successfully with UID:', authUser?.id);

                setLoadingMessage('Finalizing setup...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UI

                console.log('🎊 Onboarding flow completed successfully!');
                onComplete();
            } catch (error) {
                console.error('❌ Account creation/onboarding error:', error);
                console.error('📋 Error details:', {
                    message: error.message,
                    stack: error.stack,
                    profileEmail: profile.email,
                    hasPassword: !!profile.password
                });

                // Show user-friendly error message
                let errorMessage = 'Failed to create account. ';
                if (error.message?.includes('Missing required')) {
                    errorMessage = 'Please complete all required profile information before continuing.';
                } else if (error.message?.includes('already exists') || error.message?.includes('already registered')) {
                    errorMessage = 'An account with this email already exists. Please sign in instead.';
                } else if (error.message) {
                    errorMessage = error.message;
                } else {
                    errorMessage += 'Please try again or contact support if the problem persists.';
                }

                Alert.alert('Error', errorMessage);
            } finally {
                setIsLoading(false);
            }
        } else {
            console.error('❌ Missing account information:', {
                hasEmail: !!profile.email,
                hasPassword: !!profile.password
            });
            Alert.alert('Error', 'Missing account information. Please go back and complete your profile.');
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                {/* Header handled at screen level – removed duplicate back/progress bar */}

                {renderHeroCard()}
                {renderTimelineCard()}
                {renderNutritionCard()}
                {renderMetricsCard()}
                {renderCompletionCard()}

                <Animated.View style={{ opacity: fadeAnim }}>
                    <TouchableOpacity
                        style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.nextButtonText}>Start My Journey</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>

            {/* Loading Overlay */}
            {isLoading && loadingMessage && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#9D4EDD" />
                        <Text style={styles.loadingMessage}>{loadingMessage}</Text>
                        <Text style={styles.loadingSubtext}>This may take a few seconds...</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    contentContainer: {
        flexGrow: 1,
        paddingBottom: 0,
        paddingTop: 0,
    },
    heroCardContainer: {
        marginHorizontal: 0,
        marginTop: 0,
        marginBottom: 16,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    heroCardGradient: {
        borderRadius: 20,
        padding: 2,
    },
    heroCard: {
        backgroundColor: '#2a2a3e',
        borderRadius: 18,
        padding: 24,
    },
    heroContent: {
        alignItems: 'center',
    },
    heroTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: '#B8B8CC',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    successRateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    progressRingContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRingContent: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    successPercentage: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
    successLabel: {
        color: '#B8B8CC',
        fontSize: 12,
        marginTop: 2,
    },
    successDetails: {
        flex: 1,
        marginLeft: 24,
    },
    successDescription: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    comparisonText: {
        color: '#B8B8CC',
        fontSize: 14,
        marginRight: 8,
    },
    timelineCardContainer: {
        marginHorizontal: 0,
        marginBottom: 16,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    cardGradient: {
        borderRadius: 20,
        padding: 2,
    },
    timelineCard: {
        backgroundColor: '#2a2a3e',
        borderRadius: 18,
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginLeft: 12,
    },
    timelineContainer: {
        paddingLeft: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineLeftColumn: {
        width: 60,
        alignItems: 'flex-end',
        paddingRight: 16,
        paddingTop: 4,
    },
    timelineWeek: {
        color: '#B8B8CC',
        fontSize: 12,
        fontWeight: '600',
    },
    timelineMiddleColumn: {
        alignItems: 'center',
        position: 'relative',
    },
    timelineIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    timelineLine: {
        position: 'absolute',
        top: 32,
        width: 2,
        height: 20,
        backgroundColor: '#E5E7EB',
        zIndex: 1,
    },
    timelineRightColumn: {
        flex: 1,
        marginLeft: 16,
        paddingTop: 2,
    },
    milestoneTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    milestoneDescription: {
        color: '#B8B8CC',
        fontSize: 14,
    },
    nutritionCard: {
        backgroundColor: '#2a2a3e',
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 0,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#9D4EDD',
    },
    nutritionContent: {
        alignItems: 'center',
    },
    calorieTargetContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    calorieHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    calorieValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '700',
        marginLeft: 12,
    },
    calorieLabel: {
        color: '#B8B8CC',
        fontSize: 16,
        marginLeft: 12,
    },
    macrosGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    macroCard: {
        alignItems: 'center',
        flex: 1,
    },
    macroIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    macroValue: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    macroName: {
        color: '#B8B8CC',
        fontSize: 14,
    },
    metricsCard: {
        backgroundColor: '#2a2a3e',
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 0,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#9D4EDD',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    metricItem: {
        width: '48%',
        marginBottom: 16,
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    metricIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    metricLabel: {
        color: '#B8B8CC',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    metricValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '700',
        marginRight: 4,
    },
    completionCard: {
        backgroundColor: '#2a2a3e',
        marginHorizontal: 0,
        marginBottom: 24,
        borderRadius: 20,
        padding: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#9D4EDD',
    },
    completionContent: {
        alignItems: 'center',
    },
    completionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 8,
    },
    completionDate: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    completionSubtext: {
        color: '#B8B8CC',
        fontSize: 14,
        textAlign: 'center',
    },
    nextButton: {
        backgroundColor: '#9D4EDD',
        marginHorizontal: 0,
        marginTop: 8,
        marginBottom: 0,
        borderRadius: 100,
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#9D4EDD',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    nextButtonDisabled: {
        opacity: 0.6,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingCard: {
        backgroundColor: '#2a2a3e',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#9D4EDD',
        minWidth: 280,
    },
    loadingMessage: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    loadingSubtext: {
        color: '#B8B8CC',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
});

export default PredictiveInsightsStep; 