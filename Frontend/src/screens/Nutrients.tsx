import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
    StatusBar,
    Platform,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { initDatabase, isDatabaseReady, getUserProfileBySupabaseUid, getUserGoals } from '../utils/database';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../context/AuthContext';
import { useFoodLog } from '../context/FoodLogContext';
import { calculateNutritionGoals, getDefaultNutritionGoals, NutritionGoals } from '../utils/nutritionCalculator';

const { width: screenWidth } = Dimensions.get('window');

// App theme colors
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';

// Extend the NutritionGoals type to include saturatedFat
declare module '../utils/nutritionCalculator' {
    interface NutritionGoals {
        saturatedFat?: number;
    }
}

// Convert nutrition goals to the format expected by the component
const createMacroGoals = (goals: NutritionGoals) => {
    return {
        protein: { current: 0, goal: goals.protein, unit: 'g' },
        carbs: { current: 0, goal: goals.carbs, unit: 'g' },
        fiber: { current: 0, goal: goals.fiber, unit: 'g' },
        sugar: { current: 0, goal: goals.sugar, unit: 'g' },
        fat: { current: 0, goal: goals.fat, unit: 'g' },
        saturatedFat: { current: 0, goal: Math.round(goals.fat * 0.33), unit: 'g' }, // ~33% of fat
        polyunsaturatedFat: { current: 0, goal: 0, unit: 'g' },
        monounsaturatedFat: { current: 0, goal: 0, unit: 'g' },
        transFat: { current: 0, goal: 0, unit: 'g' },
        cholesterol: { current: 0, goal: 300, unit: 'mg' },
        sodium: { current: 0, goal: goals.sodium, unit: 'mg' },
        potassium: { current: 0, goal: 3500, unit: 'mg' },
        vitaminA: { current: 0, goal: 100, unit: '%' },
        vitaminC: { current: 0, goal: 100, unit: '%' },
        calcium: { current: 0, goal: 100, unit: '%' },
        iron: { current: 0, goal: 100, unit: '%' },
        calories: { current: 0, goal: goals.calories, unit: 'kcal' },
    };
};

// Initialize with default values
const defaultNutritionGoals = getDefaultNutritionGoals();
const initialMacroGoals = createMacroGoals(defaultNutritionGoals);

// Add a GradientText component for text with gradient
const GradientText = ({ text, style, colors }) => {
    return (
        <MaskedView
            maskElement={
                <Text style={[style, { opacity: 1 }]}>
                    {text}
                </Text>
            }
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text style={[style, { opacity: 0 }]}>
                    {text}
                </Text>
            </LinearGradient>
        </MaskedView>
    );
};

// Format date to string (YYYY-MM-DD)
const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format date for display
const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
};

const NutrientsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const scrollRef = useRef<ScrollView>(null);
    const { width: screenWidth } = Dimensions.get('window');

    // Use food log context
    const { nutrientTotals, getLogsByDate, getTotalsByDate, refreshLogs, isLoading: foodLogLoading,
        startWatchingFoodLogs, stopWatchingFoodLogs, lastUpdated, hasError, forceSingleRefresh } = useFoodLog();

    // Date handling
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dbReady, setDbReady] = useState(global.dbInitialized);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Animation for swipe gesture
    const swipeAnim = useRef(new Animated.Value(0)).current;

    // Start with default goals
    const defaultGoals = getDefaultNutritionGoals();

    // Nutrient data state (goals and current values)
    const [nutrientData, setNutrientData] = useState({
        calories: { goal: defaultGoals.calories, current: 0, unit: 'kcal' },
        protein: { goal: defaultGoals.protein, current: 0, unit: 'g' },
        carbs: { goal: defaultGoals.carbs, current: 0, unit: 'g' },
        fat: { goal: defaultGoals.fat, current: 0, unit: 'g' },
        fiber: { goal: defaultGoals.fiber, current: 0, unit: 'g' },
        sugar: { goal: defaultGoals.sugar, current: 0, unit: 'g' },
        saturatedFat: { goal: 20, current: 0, unit: 'g' },
        polyunsaturatedFat: { goal: 0, current: 0, unit: 'g' },
        monounsaturatedFat: { goal: 0, current: 0, unit: 'g' },
        transFat: { goal: 0, current: 0, unit: 'g' },
        cholesterol: { goal: 300, current: 0, unit: 'mg' },
        sodium: { goal: 2300, current: 0, unit: 'mg' },
        potassium: { goal: 3500, current: 0, unit: 'mg' },
        vitaminA: { goal: 900, current: 0, unit: 'IU' },
        vitaminC: { goal: 90, current: 0, unit: 'mg' },
        calcium: { goal: 1000, current: 0, unit: 'mg' },
        iron: { goal: 8, current: 0, unit: 'mg' }
    });

    // Animation values
    const translateX = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Transform interpolations for 3D effect
    const rotate = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: ['10deg', '0deg', '-10deg'],
        extrapolate: 'clamp'
    });

    const scale = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [0.9, 1, 0.9],
        extrapolate: 'clamp'
    });

    // Perspective effect for depth
    const perspective = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp'
    });

    // Date text animation - preventing the text from falling off by using a smaller range
    const dateTextTranslate = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [screenWidth / 4, 0, -screenWidth / 4], // Reduced range to prevent falling off
        extrapolate: 'clamp'
    });

    // Animation for opacity to fade content in/out during transition
    const contentOpacity = swipeAnim.interpolate({
        inputRange: [-screenWidth / 2, -screenWidth / 4, 0, screenWidth / 4, screenWidth / 2],
        outputRange: [0.7, 0.9, 1, 0.9, 0.7],
        extrapolate: 'clamp'
    });

    // Add this to ensure consistent black background during transitions
    const containerStyle = {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    };

    // Load user profile and calculate nutrition goals
    useEffect(() => {
        const loadUserProfile = async () => {
            if (!user) return;

            try {
                setProfileLoading(true);
                // Get user profile from local database
                const profile = await getUserProfileBySupabaseUid(user.id);

                if (profile) {
                    // Get user goals for custom macro goals (same as Home screen)
                    const userGoals = await getUserGoals(user.id);
                    console.log('📊 Loaded user goals from database (Nutrients):', {
                        proteinGoal: userGoals?.proteinGoal,
                        carbGoal: userGoals?.carbGoal,
                        fatGoal: userGoals?.fatGoal
                    });

                    // Calculate nutrition goals based on user profile
                    const goals = calculateNutritionGoals({
                        firstName: profile.first_name,
                        lastName: profile.last_name,
                        phoneNumber: '',
                        height: profile.height,
                        weight: profile.weight,
                        age: profile.age,
                        gender: profile.gender,
                        activityLevel: profile.activity_level,
                        dietaryRestrictions: profile.dietary_restrictions || [],
                        foodAllergies: profile.food_allergies || [],
                        cuisinePreferences: profile.cuisine_preferences || [],
                        spiceTolerance: profile.spice_tolerance,
                        weightGoal: profile.weight_goal,
                        healthConditions: profile.health_conditions || [],
                        dailyCalorieTarget: profile.daily_calorie_target,
                        nutrientFocus: profile.nutrient_focus,
                        defaultAddress: null,
                        preferredDeliveryTimes: [],
                        deliveryInstructions: null,
                        pushNotificationsEnabled: profile.push_notifications_enabled,
                        emailNotificationsEnabled: profile.email_notifications_enabled,
                        smsNotificationsEnabled: profile.sms_notifications_enabled,
                        marketingEmailsEnabled: profile.marketing_emails_enabled,
                        paymentMethods: [],
                        billingAddress: null,
                        defaultPaymentMethodId: null,
                        preferredLanguage: profile.preferred_language || 'en',
                        timezone: profile.timezone || 'UTC',
                        unitPreference: profile.unit_preference || 'metric',
                        darkMode: profile.dark_mode,
                        syncDataOffline: profile.sync_data_offline
                    });

                    // Apply calculated goals to nutrient data (same logic as Home screen)
                    const updatedNutrientData = { ...nutrientData };
                    updatedNutrientData.calories.goal = userGoals?.calorieGoal || goals.calories;
                    updatedNutrientData.protein.goal = userGoals?.proteinGoal || goals.protein;
                    updatedNutrientData.carbs.goal = userGoals?.carbGoal || goals.carbs;
                    updatedNutrientData.fat.goal = userGoals?.fatGoal || goals.fat;
                    updatedNutrientData.fiber.goal = goals.fiber;
                    updatedNutrientData.sugar.goal = goals.sugar;
                    updatedNutrientData.saturatedFat.goal = goals.saturatedFat || 20;

                    console.log('📊 Nutrients screen goals applied:', {
                        protein: updatedNutrientData.protein.goal,
                        carbs: updatedNutrientData.carbs.goal,
                        fat: updatedNutrientData.fat.goal,
                        source: userGoals ? 'Custom user goals + calculated' : 'Calculated only'
                    });

                    setNutrientData(updatedNutrientData);
                }
            } catch (error) {
                console.error('Error loading user profile:', error);
            } finally {
                setProfileLoading(false);
            }
        };

        // Check database readiness
        const checkDatabase = async () => {
            if (!isDatabaseReady()) {
                console.log('Database not ready, initializing...');
                try {
                    await initDatabase();
                    setDbReady(true);
                } catch (error) {
                    console.error('Error initializing database:', error);
                }
            } else {
                setDbReady(true);
            }
        };

        checkDatabase();
        loadUserProfile();
    }, [user]);

    // Start watching for food log changes when component mounts
    useEffect(() => {
        console.log('Nutrients screen starting to watch food logs');
        startWatchingFoodLogs();

        // Clean up when component unmounts
        return () => {
            console.log('Nutrients screen stopping food log watch');
            stopWatchingFoodLogs();
        };
    }, [startWatchingFoodLogs, stopWatchingFoodLogs]);

    // Fetch nutrient data when date changes or when the food log is updated
    // Critical: This ensures both Home and Nutrients screens show identical data
    useEffect(() => {
        if (profileLoading) return;
        fetchNutrientData();
    }, [currentDate, profileLoading, lastUpdated, nutrientTotals]);

    // Function to fetch nutrient data from the food log context
    const fetchNutrientData = async () => {
        // Only fetch if profile is loaded
        if (profileLoading) return;

        try {
            setLoading(true);

            // Check if we're viewing today's data
            const today = new Date();
            const isToday = formatDateToString(currentDate) === formatDateToString(today);

            let totals;
            if (isToday) {
                // Always use context data for today to ensure 100% consistency with Home screen
                console.log('📊 Using context nutrient totals for today:', nutrientTotals);
                totals = nutrientTotals;

                // Only fetch fresh data if context data is completely uninitialized (all values undefined/null)
                // This prevents false positives when user actually has 0 values for nutrients
                if (totals.calories === undefined || totals.protein === undefined || totals.carbs === undefined) {
                    console.log('📊 Context data is uninitialized, fetching fresh data for today');
                    totals = await getTotalsByDate(currentDate);
                }
            } else {
                // Fetch data for other dates
                console.log('📊 Fetching data for non-today date:', formatDateToString(currentDate));
                totals = await getTotalsByDate(currentDate);
            }

            // Update nutrient data with the fetched totals
            const updatedData = { ...nutrientData };
            updatedData.protein.current = totals.protein;
            updatedData.carbs.current = totals.carbs;
            updatedData.fat.current = totals.fat;
            updatedData.calories.current = totals.calories;
            updatedData.fiber.current = totals.fiber;
            updatedData.sugar.current = totals.sugar;
            updatedData.saturatedFat.current = totals.saturatedFat;
            updatedData.polyunsaturatedFat.current = totals.polyunsaturatedFat;
            updatedData.monounsaturatedFat.current = totals.monounsaturatedFat;
            updatedData.transFat.current = totals.transFat;
            updatedData.cholesterol.current = totals.cholesterol;
            updatedData.sodium.current = totals.sodium;
            updatedData.potassium.current = totals.potassium;
            updatedData.vitaminA.current = totals.vitaminA;
            updatedData.vitaminC.current = totals.vitaminC;
            updatedData.calcium.current = totals.calcium;
            updatedData.iron.current = totals.iron;

            console.log('📊 Nutrients screen values (FIXED):', {
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat,
                calories: totals.calories,
                isToday: isToday,
                date: formatDateToString(currentDate),
                dataSource: isToday ? 'FoodLogContext' : 'Database',
                contextRaw: isToday ? nutrientTotals : 'N/A',
                lastUpdated: lastUpdated
            });

            setNutrientData(updatedData);
        } catch (error) {
            console.error('Error fetching nutrient data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate the remaining amount for each nutrient
    const calculateRemaining = (current: number, goal: number) => {
        return goal - current;
    };

    // Get colors based on nutrient type
    const getNutrientColors = (label: string): readonly [string, string] => {
        const lowerLabel = label.toLowerCase();

        if (lowerLabel.includes('protein')) {
            return ['#B71C1C', '#D32F2F'] as const; // Dark red to slightly lighter red
        } else if (lowerLabel.includes('carbs')) {
            return ['#0D47A1', '#0D47A1'] as const; // Dark blue (no gradient)
        } else if (lowerLabel.includes('fiber')) {
            return ['#2E7D32', '#2E7D32'] as const; // Dark rich green (no gradient)
        } else if (lowerLabel.includes('sugar')) {
            return ['#4A148C', '#6A1B9A'] as const; // Dark purple to slightly lighter purple
        } else if (lowerLabel.includes('fat')) {
            return ['#F57F17', '#FFC107'] as const; // Dark amber to lighter amber
        } else {
            return ['#4A148C', '#7B1FA2'] as const; // Default purple gradient
        }
    };

    // Make sure animation completes in case it gets stuck
    useEffect(() => {
        const cleanup = () => {
            // Reset animation state if component unmounts during transition
            swipeAnim.setValue(0);
        };

        return cleanup;
    }, []);

    // Improved go to previous day to prevent sticking
    const gotoPrevDay = () => {
        if (isTransitioning) return;

        setIsTransitioning(true);

        // Animate to the right with 3D effect
        Animated.timing(swipeAnim, {
            toValue: screenWidth,
            duration: 300,
            useNativeDriver: true
        }).start(async ({ finished }) => {
            if (finished) {
                // Change date
                await changeDate(-1);

                // Reset the animation value (off-screen to the left)
                swipeAnim.setValue(-screenWidth);

                // Animate back in from the left with 3D effect
                Animated.spring(swipeAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 70,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) {
                        setIsTransitioning(false);
                    } else {
                        // Force it to complete if animation gets interrupted
                        swipeAnim.setValue(0);
                        setIsTransitioning(false);
                    }
                });
            } else {
                // Force it to complete if animation gets interrupted
                swipeAnim.setValue(0);
                setIsTransitioning(false);
            }
        });
    };

    // Improved go to next day to prevent sticking
    const gotoNextDay = () => {
        if (isTransitioning) return;

        setIsTransitioning(true);

        // Animate to the left with 3D effect
        Animated.timing(swipeAnim, {
            toValue: -screenWidth,
            duration: 300,
            useNativeDriver: true
        }).start(async ({ finished }) => {
            if (finished) {
                // Change date
                await changeDate(1);

                // Reset the animation value (off-screen to the right)
                swipeAnim.setValue(screenWidth);

                // Animate back in from the right with 3D effect
                Animated.spring(swipeAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 70,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) {
                        setIsTransitioning(false);
                    } else {
                        // Force it to complete if animation gets interrupted
                        swipeAnim.setValue(0);
                        setIsTransitioning(false);
                    }
                });
            } else {
                // Force it to complete if animation gets interrupted
                swipeAnim.setValue(0);
                setIsTransitioning(false);
            }
        });
    };

    // Format date for display
    const formatDate = (date: Date): string => {
        // Check if date is today
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return "Today";
        }

        // Check if date is yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        // Check if date is tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.toDateString() === tomorrow.toDateString()) {
            return "Tomorrow";
        }

        // Otherwise return formatted date
        return formatDateForDisplay(date);
    };

    // Handle horizontal gesture
    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        {
            useNativeDriver: true,
            listener: (event: any) => {
                if (event.nativeEvent && !isTransitioning) {
                    // Pass the swipe translation to our animation value
                    swipeAnim.setValue(event.nativeEvent.translationX * 0.8); // Dampen the effect slightly
                }
            }
        }
    );

    // Handle gesture end
    const onHandlerStateChange = ({ nativeEvent }) => {
        const { translationX, velocityX, state } = nativeEvent;

        if (state === State.END) {
            if (isTransitioning) {
                resetSwipeState();
                return;
            }

            // Threshold for swipe action
            const swipeThreshold = screenWidth / 3;

            // Check if swipe was significant enough
            if (Math.abs(translationX) > swipeThreshold || Math.abs(velocityX) > 800) {
                if (translationX > 0) {
                    // Swipe right - go to previous day
                    gotoPrevDay();
                } else {
                    // Swipe left - go to next day
                    gotoNextDay();
                }
            } else {
                // Not enough to trigger date change, animate back
                resetSwipeState();
            }
        }
    };

    const resetSwipeState = () => {
        // Spring back to center position
        Animated.spring(swipeAnim, {
            toValue: 0,
            friction: 5,
            tension: 40,
            useNativeDriver: true
        }).start();
    };

    // Change date by offset
    const changeDate = async (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + offset);
        setCurrentDate(newDate);
    };

    const renderNutrientItem = (label: string, current: number, goal: number, unit: string) => {
        const remaining = calculateRemaining(current, goal);
        // Calculate progress as a percentage of the goal, clamped between 0 and 100
        let progressPercent = Math.max(0, Math.min(100, (goal > 0 ? (current / goal) * 100 : 0)));

        // Special case for polyunsaturated and monounsaturated fats:
        // If goal is 0 but current value is > 0, show full bar (100%)
        if (goal === 0 && current > 0) {
            progressPercent = 100;
        }

        const gradientColors = getNutrientColors(label);

        // Create subdued background color based on the main bar color
        const getSubduedBackgroundColor = (colors: readonly [string, string]) => {
            // Use the first color and make it very transparent for a subdued effect
            const baseColor = colors[0];
            // Extract RGB values and apply low opacity
            if (baseColor.includes('#')) {
                // Convert hex to rgba with low opacity
                const hex = baseColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                return `rgba(${r}, ${g}, ${b}, 0.15)`;
            }
            return 'rgba(128, 128, 128, 0.15)'; // fallback
        };

        const backgroundBarColor = getSubduedBackgroundColor(gradientColors);

        // Display unit correctly based on nutrient type
        const displayUnit = (label.includes('Vitamin') || label.includes('Calcium') || label.includes('Iron'))
            ? ''
            : unit;

        // Format the remaining value display
        const formatRemainingValue = (remaining: number, unit: string) => {
            if (remaining > 0) {
                return `${Math.round(remaining)}${unit}`;
            } else if (remaining < 0) {
                return `${Math.round(Math.abs(remaining))}${unit} over`;
            } else {
                return `Goal met`;
            }
        };

        return (
            <View key={label} style={styles.nutrientRow}>
                <View style={styles.nutrientValues}>
                    <View style={styles.leftValues}>
                        <Text style={styles.remainingValue}>{formatRemainingValue(remaining, displayUnit)}</Text>
                    </View>
                    <Text style={styles.nutrientLabel}>{label}</Text>
                    <Text style={styles.rightValue}>{Math.round(current)}/{Math.round(goal)}</Text>
                </View>
                <View style={[styles.progressBarContainer, { backgroundColor: backgroundBarColor }]}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        locations={[0, 0.6]}
                        style={[styles.progressBar, { width: `${progressPercent}%` }]}
                    />
                </View>
            </View>
        );
    };

    // Error banner component
    const renderErrorBanner = () => {
        if (!hasError) return null;

        return (
            <TouchableOpacity
                style={styles.errorBanner}
                onPress={forceSingleRefresh}
            >
                <Ionicons name="warning-outline" size={20} color="#FFD700" />
                <Text style={styles.errorText}>
                    Database connection issue. Tap to retry.
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, containerStyle]}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <SafeAreaView style={{ flex: 1 }}>
                    {renderErrorBanner()}
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Ionicons name="chevron-back" size={28} color={WHITE} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <GradientText
                                text="NUTRIENTS"
                                colors={["#5A60EA", "#FF00F5"]}
                                style={styles.headerTitle}
                            />
                        </View>
                        <View style={{ width: 28 }} />
                    </View>

                    {/* Day Navigation Bar */}
                    <View style={styles.dayNavContainer}>
                        <TouchableOpacity
                            style={styles.dayNavButton}
                            onPress={gotoPrevDay}
                            disabled={isTransitioning}
                        >
                            <Ionicons name="chevron-back" size={20} color={WHITE} />
                        </TouchableOpacity>
                        <View style={styles.dateContainer}>
                            <Animated.Text style={[styles.todayText, {
                                transform: [{ translateX: dateTextTranslate }]
                            }]}>
                                {formatDate(currentDate)}
                            </Animated.Text>
                        </View>
                        <TouchableOpacity
                            style={styles.dayNavButton}
                            onPress={gotoNextDay}
                            disabled={isTransitioning}
                        >
                            <Ionicons name="chevron-forward" size={20} color={WHITE} />
                        </TouchableOpacity>
                    </View>

                    {/* Content with Gesture Handler */}
                    <PanGestureHandler
                        onGestureEvent={onGestureEvent}
                        onHandlerStateChange={onHandlerStateChange}
                        activeOffsetX={[-20, 20]}  // Only activate for horizontal movement > 20px
                        failOffsetY={[-10, 10]}    // Fail if vertical movement exceeds 10px first
                        enabled={!isTransitioning}
                    >
                        <Animated.View
                            style={[
                                styles.animatedContent,
                                {
                                    opacity: contentOpacity,
                                    transform: [
                                        { perspective: 1000 },
                                        { translateX: swipeAnim },
                                        { rotateY: rotate },
                                        { scale: perspective }
                                    ]
                                }
                            ]}
                        >
                            {/* Column Headers */}
                            <View style={styles.columnHeadersContainer}>
                                <View style={styles.columnHeaders}>
                                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'left' }]}>Remaining</Text>
                                    <View style={{ flex: 2 }} />
                                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Total/Goal</Text>
                                </View>
                                <View style={styles.headerDivider} />
                            </View>

                            {/* Nutrients List */}
                            <ScrollView
                                ref={scrollRef}
                                style={styles.scrollView}
                                showsVerticalScrollIndicator={false}
                                scrollEventThrottle={16}
                            >
                                {!dbReady || loading ? (
                                    <View style={styles.loadingContainer}>
                                        <Text style={styles.loadingText}>{!dbReady ? 'Initializing database...' : 'Loading nutrients...'}</Text>
                                    </View>
                                ) : (
                                    Object.entries(nutrientData)
                                        .filter(([key]) => key !== 'calories')
                                        .map(([key, value]) => {
                                            // Convert key from camelCase to Title Case for display
                                            const label = key.replace(/([A-Z])/g, ' $1')
                                                .replace(/^./, str => str.toUpperCase());
                                            return renderNutrientItem(label, value.current, value.goal, value.unit);
                                        })
                                )}

                                <View style={styles.spacer} />
                            </ScrollView>
                        </Animated.View>
                    </PanGestureHandler>
                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
        paddingBottom: 10,
    },
    backButton: {
        padding: 4,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: WHITE,
        textAlign: 'center',
    },
    dayNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingVertical: 4,
        backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
        borderRadius: 6,
        marginHorizontal: 10,
        marginTop: 5,
    },
    dayNavButton: {
        padding: 8,
    },
    todayText: {
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
    },
    columnHeadersContainer: {
        marginTop: 14,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerDivider: {
        height: 1,
        backgroundColor: '#333',
        marginHorizontal: 16,
    },
    columnHeader: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
    },
    nutrientRow: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    nutrientLabel: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '500',
        flex: 2,
        textAlign: 'center',
    },
    nutrientValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    leftValues: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    rightValue: {
        flex: 1,
        fontSize: 16,
        color: WHITE,
        textAlign: 'right',
    },
    remainingValue: {
        fontSize: 16,
        color: '#BBBBBB', // Lighter gray for remaining values
        textAlign: 'left',
    },
    progressBarContainer: {
        height: 5,
        borderRadius: 2.5,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2.5,
    },
    spacer: {
        height: 20,
    },
    animatedContent: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 200,
    },
    loadingText: {
        color: WHITE,
        fontSize: 16,
    },
    dateContainer: {
        flex: 1,
        overflow: 'hidden', // Prevents date text from visually overflowing
        alignItems: 'center',
    },
    errorBanner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#FF6347',
    },
    errorText: {
        color: '#FFD700',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default NutrientsScreen;

