import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserGoals, updateUserGoals, getUserProfileByFirebaseUid } from '../utils/database'; // Local database functions
import { updateNutritionGoals, updateFitnessGoals, getProfile, CompleteProfile, updateProfile, resetNutritionGoals } from '../api/profileApi'; // Backend API functions
import { formatWeight, kgToLbs, lbsToKg } from '../utils/unitConversion'; // Import unit conversion utilities
import { calculateNutritionGoalsFromProfile, Gender, ActivityLevel, WeightGoal, mapWeightGoal } from '../utils/offlineNutritionCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { getCheatDaySettings, updateCheatDaySettings, getCheatDayProgress, CheatDayProgress } from '../utils/database';

// Constants for colors - matching EditProfile
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#0074dd';
const GRADIENT_START = '#0074dd';
const GRADIENT_MIDDLE = '#5c00dd';
const GRADIENT_END = '#dd0095';
const GREEN = '#4CAF50';
const ORANGE = '#FF9800';
const PURPLE = '#9C27B0';
const PINK = '#FF00F5';

const { width } = Dimensions.get('window');

interface GoalsData {
    targetWeight?: number;
    calorieGoal?: number;
    proteinGoal?: number;
    carbGoal?: number;
    fatGoal?: number;
    fitnessGoal?: string;
    activityLevel?: string;
    weeklyWorkouts?: number;
    stepGoal?: number;
    waterGoal?: number;
    sleepGoal?: number;
    cheatDayEnabled?: boolean;
    cheatDayFrequency?: number;
}

// Activity level data for slider
const ACTIVITY_LEVELS = [
    { key: 'sedentary', label: 'Desk Job', description: 'Office work, driving, studying' },
    { key: 'light', label: 'Standing Job', description: 'Teacher, cashier, lab work' },
    { key: 'moderate', label: 'Walking Job', description: 'Nurse, waiter, retail worker' },
    { key: 'active', label: 'Physical Job', description: 'Construction, cleaning, chef' },
    { key: 'very_active', label: 'Heavy Labor', description: 'Farming, moving, manual labor' }
];

// Fitness goal data for wheel picker (values in kg/week)
const FITNESS_GOALS = [
    { id: 'lose_1', value: -1.0, label: '-1.0 kg/week', description: 'Aggressive weight loss' },
    { id: 'lose_0_75', value: -0.75, label: '-0.75 kg/week', description: 'Fast weight loss' },
    { id: 'lose_0_5', value: -0.5, label: '-0.5 kg/week (Recommended)', description: 'Moderate weight loss' },
    { id: 'lose_0_25', value: -0.25, label: '-0.25 kg/week', description: 'Slow weight loss' },
    { id: 'maintain', value: 0, label: '0 kg/week', description: 'Maintain current weight' },
    { id: 'gain_0_25', value: 0.25, label: '+0.25 kg/week', description: 'Slow weight gain' },
    { id: 'gain_0_5', value: 0.5, label: '+0.5 kg/week', description: 'Moderate weight gain' }
];

// Create a GradientBorder component for form sections
const GradientBorderBox = ({ children, style }: { children: React.ReactNode, style?: any }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
            />
            <View style={[styles.gradientBorderInner, style]}>
                {children}
            </View>
        </View>
    );
};

export default function EditGoals() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('nutrition');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [isImperialUnits, setIsImperialUnits] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Database values - these are the values we display and don't change until after save
    const [dbGoals, setDbGoals] = useState<GoalsData>({});

    // Form values - these update as user types but don't affect display until saved
    const [formValues, setFormValues] = useState<GoalsData>({});

    // Modal states for wheel picker
    const [showFitnessGoalPicker, setShowFitnessGoalPicker] = useState(false);
    const [activityLevelIndex, setActivityLevelIndex] = useState(0); // Will be set from database

    // State for cheat day progress
    const [cheatDayProgress, setCheatDayProgress] = useState<CheatDayProgress>({
        daysCompleted: 0,
        totalDays: 7,
        daysUntilNext: 7,
        enabled: false
    });

    // State for custom cheat day frequency
    const [showCustomFrequencyModal, setShowCustomFrequencyModal] = useState(false);
    const [customFrequencyInput, setCustomFrequencyInput] = useState('');

    // Frequency options data
    const frequencyOptions = [
        { id: 'weekly', label: 'Weekly', days: 7 },
        { id: 'biweekly', label: 'Biweekly', days: 14 },
        { id: 'monthly', label: 'Monthly', days: 30 },
        { id: 'custom', label: 'Custom', days: null }
    ];

    // Track values that affect caloric requirements
    const [originalCaloricValues, setOriginalCaloricValues] = useState<{
        targetWeight?: number;
        fitnessGoal?: string;
        activityLevel?: string;
    }>({});
    const [showCaloricWarning, setShowCaloricWarning] = useState(false);

    useEffect(() => {
        // Animation on component mount
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        ]).start();

        // Fetch user's profile to get unit preference
        const fetchUserProfile = async () => {
            try {
                const profileData = await getProfile();
                if (profileData && profileData.profile) {
                    setIsImperialUnits(profileData.profile.is_imperial_units || false);
                }
            } catch (error) {
                console.error('Error fetching user profile', error);
            }
        };

        // Fetch user's goals
        const fetchUserGoals = async () => {
            setIsFetchingData(true);
            try {
                if (user) {
                    // PRIMARY: Get user goals from SQLite database (primary data source - fast)
                    const userData = await getUserGoals(user.uid);

                    // Set initial values from SQLite database immediately - no fallbacks
                    const localGoals = {
                        targetWeight: userData?.targetWeight,
                        calorieGoal: userData?.calorieGoal,
                        proteinGoal: userData?.proteinGoal,
                        carbGoal: userData?.carbGoal,
                        fatGoal: userData?.fatGoal,
                        fitnessGoal: userData?.fitnessGoal,
                        activityLevel: userData?.activityLevel,
                        weeklyWorkouts: userData?.weeklyWorkouts,
                        stepGoal: userData?.stepGoal,
                        waterGoal: userData?.waterGoal,
                        sleepGoal: userData?.sleepGoal,
                        cheatDayEnabled: userData?.cheatDayEnabled,
                        cheatDayFrequency: userData?.cheatDayFrequency
                    };

                    // Update UI with SQLite data first (immediate display)
                    setDbGoals(localGoals);
                    setFormValues({ ...localGoals });

                    // Store original caloric-affecting values from SQLite
                    setOriginalCaloricValues({
                        targetWeight: localGoals.targetWeight,
                        fitnessGoal: localGoals.fitnessGoal,
                        activityLevel: localGoals.activityLevel
                    });

                    setIsFetchingData(false);
                    console.log('✅ Goals loaded from SQLite database (primary)');

                    // Load cheat day progress
                    try {
                        const progress = await getCheatDayProgress(user.uid);
                        setCheatDayProgress(progress);

                        // Ensure formValues reflect the actual cheat day settings from the database
                        const cheatDaySettings = await getCheatDaySettings(user.uid);
                        if (cheatDaySettings) {
                            // Update form values with actual cheat day settings from database
                            setFormValues(prev => ({
                                ...prev,
                                cheatDayEnabled: cheatDaySettings.enabled,
                                cheatDayFrequency: cheatDaySettings.frequency
                            }));
                            setDbGoals(prev => ({
                                ...prev,
                                cheatDayEnabled: cheatDaySettings.enabled,
                                cheatDayFrequency: cheatDaySettings.frequency
                            }));
                        } else {
                            // No cheat day settings exist yet, use defaults (disabled)
                            setFormValues(prev => ({
                                ...prev,
                                cheatDayEnabled: false,
                                cheatDayFrequency: 7
                            }));
                            setDbGoals(prev => ({
                                ...prev,
                                cheatDayEnabled: false,
                                cheatDayFrequency: 7
                            }));
                        }
                    } catch (error) {
                        console.error('Error loading cheat day progress:', error);
                        // Keep default values on error
                    }

                    // In parallel, try to get user profile to check unit preference
                    fetchUserProfile().catch(error => {
                        console.warn('⚠️ Error fetching user profile for units', error);
                    });

                    // DISABLED: Backend sync disabled to prevent overwriting SQLite data
                    // SQLite is the primary source of truth for offline functionality
                    console.log('ℹ️ Backend sync disabled - using SQLite as primary source for offline functionality');
                }
            } catch (error) {
                console.error('Error fetching user goals', error);
                Alert.alert('Error', 'Failed to load your goals. Please try again.');
                setIsFetchingData(false);
            }
        };

        if (user) {
            fetchUserGoals();
        }
    }, [user]);

    // Helper functions for activity level and fitness goal (memoized to prevent infinite re-renders)
    const getActivityLevelIndex = useCallback((key?: string) => {
        if (!key) return 0;
        const index = ACTIVITY_LEVELS.findIndex(level => level.key === key);
        return index !== -1 ? index : 0;
    }, []);

    // Sync activity level index with form values
    useEffect(() => {
        if (formValues.activityLevel) {
            const newIndex = getActivityLevelIndex(formValues.activityLevel);
            setActivityLevelIndex(newIndex);
        }
    }, [formValues.activityLevel, getActivityLevelIndex]);

    // Check if caloric-affecting values have changed
    const hasCaloricValuesChanged = () => {
        const currentTargetWeight = isImperialUnits && formValues.targetWeight
            ? lbsToKg(formValues.targetWeight)
            : formValues.targetWeight;

        const originalTargetWeight = isImperialUnits && originalCaloricValues.targetWeight
            ? originalCaloricValues.targetWeight
            : originalCaloricValues.targetWeight;

        return (
            currentTargetWeight !== originalTargetWeight ||
            formValues.fitnessGoal !== originalCaloricValues.fitnessGoal ||
            formValues.activityLevel !== originalCaloricValues.activityLevel
        );
    };

    const handleSave = async () => {
        // Check if caloric-affecting values have changed (for both tabs)
        if (hasCaloricValuesChanged()) {
            setShowCaloricWarning(true);
            return;
        }

        await performSave();
    };

    const performSave = async () => {
        setIsLoading(true);

        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Convert weight to metric for storage if in imperial units
            let targetWeightKg = formValues.targetWeight;
            if (isImperialUnits && formValues.targetWeight) {
                targetWeightKg = lbsToKg(formValues.targetWeight);
            }

            // PRIMARY: Save to SQLite database first (this is our primary data source)
            console.log('Saving goals to SQLite database (primary)...');
            await updateUserGoals(user.uid, {
                targetWeight: targetWeightKg,
                calorieGoal: formValues.calorieGoal,
                proteinGoal: formValues.proteinGoal,
                carbGoal: formValues.carbGoal,
                fatGoal: formValues.fatGoal,
                fitnessGoal: formValues.fitnessGoal,
                activityLevel: formValues.activityLevel,
                weeklyWorkouts: formValues.weeklyWorkouts,
                stepGoal: formValues.stepGoal,
                waterGoal: formValues.waterGoal,
                sleepGoal: formValues.sleepGoal,
                cheatDayEnabled: formValues.cheatDayEnabled,
                cheatDayFrequency: formValues.cheatDayFrequency
            });

            // Update display values after successful SQLite save
            setDbGoals({
                ...formValues,
                targetWeight: targetWeightKg // Always store in kg in state
            });

            console.log('✅ Goals saved to SQLite successfully');

            // Update cheat day settings if they changed
            if (formValues.cheatDayEnabled !== undefined || formValues.cheatDayFrequency !== undefined) {
                try {
                    console.log('Updating cheat day settings:', {
                        enabled: formValues.cheatDayEnabled,
                        frequency: formValues.cheatDayFrequency
                    });

                    await updateCheatDaySettings(user.uid, {
                        enabled: formValues.cheatDayEnabled || false,
                        frequency: formValues.cheatDayFrequency || 7
                    });

                    // Reload cheat day progress after updating settings
                    const updatedProgress = await getCheatDayProgress(user.uid);
                    setCheatDayProgress(updatedProgress);

                    console.log('✅ Cheat day settings updated successfully');
                } catch (error) {
                    console.error('Error updating cheat day settings:', error);
                    // Continue with the save process even if cheat day update fails
                }
            }

            // SECONDARY: Try to sync to backend for cloud backup (non-blocking)
            try {
                console.log('Syncing goals to backend for cloud backup...');

                if (activeTab === 'nutrition') {
                    // Format nutrition goals for the API
                    const nutritionGoals = {
                        daily_calorie_target: formValues.calorieGoal,
                        protein_goal: formValues.proteinGoal,
                        carb_goal: formValues.carbGoal,
                        fat_goal: formValues.fatGoal,
                        target_weight: targetWeightKg,
                        weight_goal: formValues.fitnessGoal as any,
                    };

                    // Handle the case where calorieGoal is explicitly undefined (user cleared the field)
                    if (formValues.calorieGoal === undefined) {
                        nutritionGoals.daily_calorie_target = 0;
                    }

                    // Also update the profile with the target weight
                    try {
                        const profileData = await getProfile();
                        if (profileData && profileData.profile) {
                            // Update the profile with the new target weight
                            await updateProfile({
                                ...profileData.profile,
                                target_weight: targetWeightKg || undefined
                            });
                        }
                    } catch (profileError) {
                        console.warn('⚠️ Error updating profile target weight, continuing with nutrition goals sync', profileError);
                    }

                    await updateNutritionGoals(nutritionGoals);
                } else {
                    // Format fitness goals for the API (only fields supported by backend)
                    const fitnessGoals = {
                        weekly_workouts: formValues.weeklyWorkouts,
                        daily_step_goal: formValues.stepGoal,
                        water_intake_goal: formValues.waterGoal,
                        // Note: sleep_goal is not supported by backend FitnessGoals model,
                        // it's stored in SQLite user_profiles table only
                    };

                    await updateFitnessGoals(fitnessGoals);
                }

                console.log('✅ Goals synced to backend successfully');
            } catch (backendError) {
                console.warn('⚠️ Backend sync failed (non-critical), goals saved locally:', backendError);
                // This is non-critical since SQLite (primary) save was successful
            }

            Alert.alert('Success', 'Fitness goals updated successfully');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update goals. Please try again.');
            console.error('❌ SQLite save error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCaloricWarningResponse = async (proceed: boolean) => {
        setShowCaloricWarning(false);

        if (proceed) {
            try {
                setIsLoading(true);

                // Convert weight to metric for storage if in imperial units
                let targetWeightKg = formValues.targetWeight;
                if (isImperialUnits && formValues.targetWeight) {
                    targetWeightKg = lbsToKg(formValues.targetWeight);
                }

                // PRIMARY: Save current changes to SQLite first
                console.log('Saving updated goals to SQLite database...');
                await updateUserGoals(user.uid, {
                    targetWeight: targetWeightKg,
                    calorieGoal: formValues.calorieGoal,
                    proteinGoal: formValues.proteinGoal,
                    carbGoal: formValues.carbGoal,
                    fatGoal: formValues.fatGoal,
                    fitnessGoal: formValues.fitnessGoal,
                    activityLevel: formValues.activityLevel,
                    weeklyWorkouts: formValues.weeklyWorkouts,
                    stepGoal: formValues.stepGoal,
                    waterGoal: formValues.waterGoal,
                    sleepGoal: formValues.sleepGoal,
                    cheatDayEnabled: formValues.cheatDayEnabled,
                    cheatDayFrequency: formValues.cheatDayFrequency
                });

                // Calculate nutrition goals offline using user profile data
                let resetGoals;
                try {
                    console.log('Calculating nutrition goals offline...');

                    // Get user profile from SQLite
                    const userProfile = await getUserProfileByFirebaseUid(user.uid);
                    if (!userProfile) {
                        throw new Error('User profile not found in local database');
                    }

                    // Use current form values for calculation
                    const profileForCalculation = {
                        ...userProfile,
                        weight_goal: formValues.fitnessGoal || 'maintain', // default to maintain if no fitness goal set
                        activity_level: formValues.activityLevel || userProfile.activity_level,
                        target_weight: targetWeightKg || userProfile.target_weight
                    };

                    resetGoals = calculateNutritionGoalsFromProfile(profileForCalculation);

                    if (!resetGoals) {
                        throw new Error('Unable to calculate nutrition goals - missing required profile data');
                    }

                    console.log('✅ Nutrition goals calculated offline');
                } catch (resetError) {
                    console.warn('⚠️ Offline calculation failed:', resetError);
                    Alert.alert("Error", "Cannot calculate nutrition goals. Please ensure your profile has height, weight, age, gender, and activity level set.");
                    return;
                }

                // Update form values with the reset goals
                const updatedGoals = {
                    ...formValues,
                    calorieGoal: resetGoals.daily_calorie_goal,
                    proteinGoal: resetGoals.protein_goal,
                    carbGoal: resetGoals.carb_goal,
                    fatGoal: resetGoals.fat_goal,
                };

                // Update both displayed values
                setFormValues(updatedGoals);
                setDbGoals({
                    ...updatedGoals,
                    targetWeight: targetWeightKg // Always store in kg in state
                });

                // PRIMARY: Update SQLite database with reset values
                console.log('Updating SQLite with reset nutrition goals...');
                await updateUserGoals(user.uid, {
                    targetWeight: targetWeightKg,
                    calorieGoal: resetGoals.daily_calorie_goal,
                    proteinGoal: resetGoals.protein_goal,
                    carbGoal: resetGoals.carb_goal,
                    fatGoal: resetGoals.fat_goal,
                    fitnessGoal: formValues.fitnessGoal,
                    activityLevel: formValues.activityLevel,
                    weeklyWorkouts: formValues.weeklyWorkouts,
                    stepGoal: formValues.stepGoal,
                    waterGoal: formValues.waterGoal,
                    sleepGoal: formValues.sleepGoal,
                    cheatDayEnabled: formValues.cheatDayEnabled,
                    cheatDayFrequency: formValues.cheatDayFrequency
                });

                console.log('✅ Goals updated in SQLite with reset nutrition values');

                // Update original values to prevent warning again
                setOriginalCaloricValues({
                    targetWeight: formValues.targetWeight,
                    fitnessGoal: formValues.fitnessGoal,
                    activityLevel: formValues.activityLevel
                });

                Alert.alert("Success", "Your goals have been updated and nutrition targets have been recalculated based on your new settings.");
                navigation.goBack();
            } catch (error) {
                console.error('❌ Error updating goals with reset:', error);
                Alert.alert("Error", "Failed to update goals. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const updateFormValue = (field: keyof GoalsData, value: any) => {
        // Special handling for targetWeight to allow empty values
        if (field === 'targetWeight' && (value === '' || value === null)) {
            setFormValues(prev => ({
                ...prev,
                [field]: undefined
            }));
            return;
        }

        // Special handling for calorieGoal to allow empty values
        if (field === 'calorieGoal' && (value === '' || value === null)) {
            setFormValues(prev => ({
                ...prev,
                [field]: undefined
            }));
            return;
        }

        setFormValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Function to handle resetting nutrition goals to calculated values
    const handleReset = async () => {
        Alert.alert(
            "Reset Nutrition Goals",
            "This will reset your nutrition goals to the recommended values based on your profile data. Continue?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // Calculate nutrition goals offline using user profile data
                            let resetGoals;
                            try {
                                console.log('Calculating nutrition goals offline...');

                                // Get user profile from SQLite
                                const userProfile = await getUserProfileByFirebaseUid(user.uid);
                                if (!userProfile) {
                                    throw new Error('User profile not found in local database');
                                }

                                // Use current form values for calculation
                                const profileForCalculation = {
                                    ...userProfile,
                                    weight_goal: formValues.fitnessGoal || 'maintain', // default to maintain if no fitness goal set
                                    activity_level: formValues.activityLevel || userProfile.activity_level,
                                    target_weight: formValues.targetWeight ? (isImperialUnits ? lbsToKg(formValues.targetWeight) : formValues.targetWeight) : userProfile.target_weight
                                };

                                resetGoals = calculateNutritionGoalsFromProfile(profileForCalculation);

                                if (!resetGoals) {
                                    throw new Error('Unable to calculate nutrition goals - missing required profile data');
                                }

                                console.log('✅ Nutrition goals calculated offline');
                            } catch (resetError) {
                                console.warn('⚠️ Offline calculation failed:', resetError);
                                Alert.alert("Error", "Cannot calculate nutrition goals. Please ensure your profile has height, weight, age, gender, and activity level set.");
                                return;
                            }

                            // Update form values with the reset goals
                            const updatedGoals = {
                                ...formValues,
                                calorieGoal: resetGoals.daily_calorie_goal,
                                proteinGoal: resetGoals.protein_goal,
                                carbGoal: resetGoals.carb_goal,
                                fatGoal: resetGoals.fat_goal,
                                targetWeight: resetGoals.target_weight || formValues.targetWeight,
                                fitnessGoal: resetGoals.weight_goal || formValues.fitnessGoal,
                                activityLevel: resetGoals.activity_level || formValues.activityLevel
                            };

                            // Convert weight to metric for storage if in imperial units
                            let targetWeightKg = updatedGoals.targetWeight;
                            if (isImperialUnits && updatedGoals.targetWeight) {
                                targetWeightKg = lbsToKg(updatedGoals.targetWeight);
                            }

                            // PRIMARY: Update SQLite database first
                            console.log('Updating SQLite with reset nutrition goals...');
                            await updateUserGoals(user.uid, {
                                calorieGoal: resetGoals.daily_calorie_goal,
                                proteinGoal: resetGoals.protein_goal,
                                carbGoal: resetGoals.carb_goal,
                                fatGoal: resetGoals.fat_goal,
                                targetWeight: targetWeightKg,
                                fitnessGoal: resetGoals.weight_goal || formValues.fitnessGoal,
                                activityLevel: resetGoals.activity_level || formValues.activityLevel,
                                weeklyWorkouts: formValues.weeklyWorkouts,
                                stepGoal: formValues.stepGoal,
                                waterGoal: formValues.waterGoal,
                                sleepGoal: formValues.sleepGoal,
                                cheatDayEnabled: formValues.cheatDayEnabled,
                                cheatDayFrequency: formValues.cheatDayFrequency
                            });

                            console.log('✅ Reset goals saved to SQLite successfully');

                            // Update displayed values after successful SQLite save
                            setFormValues(updatedGoals);
                            setDbGoals({
                                ...updatedGoals,
                                targetWeight: targetWeightKg // Always store in kg in state
                            });

                            Alert.alert("Success", "Your nutrition goals have been reset to the recommended values.");
                        } catch (error) {
                            console.error('Error resetting goals:', error);
                            Alert.alert("Error", "Failed to reset goals. Please try again.");
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderNutritionTab = () => {
        if (isFetchingData) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={BLUE_ACCENT} />
                    <Text style={styles.loadingText}>Loading your goals...</Text>
                </View>
            );
        }

        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Summary Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={styles.summaryTitle}>Nutrition Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {dbGoals.calorieGoal ? dbGoals.calorieGoal : "---"}
                                </Text>
                                <Text style={styles.statLabel}>Calories/day</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {isImperialUnits && dbGoals.targetWeight
                                        ? `${Math.round(kgToLbs(dbGoals.targetWeight))} lbs`
                                        : dbGoals.targetWeight
                                            ? `${dbGoals.targetWeight} kg`
                                            : "---"}
                                </Text>
                                <Text style={styles.statLabel}>Target Weight</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Weight & Calorie Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Weight & Calorie Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>
                            Target Weight {isImperialUnits ? '(lbs)' : '(kg)'}
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.targetWeight ? formValues.targetWeight.toString() : ''}
                            onChangeText={(text) => updateFormValue('targetWeight', text ? parseFloat(text) : '')}
                            placeholder={`${isImperialUnits ? 'Enter target weight in pounds' : 'Enter target weight in kilograms'} or leave empty`}
                            placeholderTextColor={GRAY}
                            keyboardType="decimal-pad"
                        />
                        <Text style={styles.inputHint}>
                            {isImperialUnits
                                ? 'Enter your target weight in pounds or leave empty'
                                : 'Enter your target weight in kilograms or leave empty'}
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.calorieGoal ? formValues.calorieGoal.toString() : ''}
                            onChangeText={(text) => updateFormValue('calorieGoal', text ? parseInt(text) : '')}
                            placeholder="Enter calorie goal or leave empty"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                        <Text style={styles.inputHint}>
                            Enter your daily calorie goal or leave empty
                        </Text>
                    </View>
                </GradientBorderBox>

                {/* Macronutrient Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Macronutrient Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Protein (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.proteinGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('proteinGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter protein goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.carbGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('carbGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter carb goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Fat (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.fatGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('fatGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter fat goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.resetButtonContainer}>
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={handleReset}
                            disabled={isLoading}
                        >
                            <Ionicons name="refresh-outline" size={14} color={GRADIENT_START} />
                            <Text style={styles.resetButtonText}>Reset to Recommended Values</Text>
                        </TouchableOpacity>
                    </View>
                </GradientBorderBox>

                {/* Activity Profile */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Activity Profile</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Fitness Goal</Text>
                        <TouchableOpacity
                            style={styles.wheelPickerButton}
                            onPress={() => setShowFitnessGoalPicker(true)}
                        >
                            <Text style={styles.wheelPickerButtonText}>
                                {getFitnessGoalLabel(formValues.fitnessGoal)}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Activity Level</Text>
                        <View style={styles.activitySliderContainer}>
                            <View style={styles.sliderLabels}>
                                <Text style={styles.sliderLabel}>Less Active</Text>
                                <Text style={styles.sliderLabel}>More Active</Text>
                            </View>
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={0}
                                maximumValue={ACTIVITY_LEVELS.length - 1}
                                step={1}
                                value={activityLevelIndex}
                                onValueChange={(value) => {
                                    setActivityLevelIndex(value);
                                    updateFormValue('activityLevel', getActivityLevelKey(value));
                                }}
                                minimumTrackTintColor={GRADIENT_START}
                                maximumTrackTintColor={LIGHT_GRAY}
                                thumbTintColor={GRADIENT_MIDDLE}
                            />
                            <View style={styles.activityLevelInfo}>
                                <Text style={styles.activityLevelTitle}>
                                    {ACTIVITY_LEVELS[activityLevelIndex]?.label}
                                </Text>
                                <Text style={styles.activityLevelDescription}>
                                    {ACTIVITY_LEVELS[activityLevelIndex]?.description}
                                </Text>
                            </View>
                        </View>
                    </View>
                </GradientBorderBox>
            </Animated.View>
        );
    };

    const renderFitnessTab = () => {
        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Summary Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={styles.summaryTitle}>Fitness Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{dbGoals.weeklyWorkouts || "---"}</Text>
                                <Text style={styles.statLabel}>Workouts/week</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{dbGoals.stepGoal || "---"}</Text>
                                <Text style={styles.statLabel}>Daily Steps</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {cheatDayProgress.enabled
                                        ? `${cheatDayProgress.daysUntilNext}d`
                                        : "Disabled"}
                                </Text>
                                <Text style={styles.statLabel}>Cheat Day</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Workout Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Workout Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Weekly Workouts</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.weeklyWorkouts?.toString() || ''}
                            onChangeText={(text) => updateFormValue('weeklyWorkouts', text ? parseInt(text) : undefined)}
                            placeholder="Workouts per week"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Step Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.stepGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('stepGoal', text ? parseInt(text) : undefined)}
                            placeholder="Target daily steps"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Health Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Health Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Water Intake (ml)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.waterGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('waterGoal', text ? parseInt(text) : undefined)}
                            placeholder="Water intake goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sleep Goal (hours)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.sleepGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('sleepGoal', text ? parseInt(text) : undefined)}
                            placeholder="Target sleep hours"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Motivation Settings */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Motivation</Text>

                    <View style={styles.inputGroup}>
                        <View style={styles.cheatDayToggleContainer}>
                            <View style={styles.cheatDayToggleContent}>
                                <Text style={styles.cheatDayToggleTitle}>Enable Cheat Days</Text>
                                <Text style={styles.cheatDayToggleDescription}>
                                    Track your progress towards scheduled cheat days
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.toggleSwitch,
                                    formValues.cheatDayEnabled && styles.toggleSwitchActive
                                ]}
                                onPress={() => updateFormValue('cheatDayEnabled', !formValues.cheatDayEnabled)}
                            >
                                <View
                                    style={[
                                        styles.toggleKnob,
                                        formValues.cheatDayEnabled && styles.toggleKnobActive
                                    ]}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {formValues.cheatDayEnabled && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Cheat Day Frequency</Text>
                            <View style={styles.frequencyOptionsContainer}>
                                {frequencyOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.frequencyOption,
                                            getSelectedFrequencyOption() === option.id && styles.selectedFrequencyOption
                                        ]}
                                        onPress={() => handleFrequencyOptionSelect(option.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.frequencyOptionText,
                                                getSelectedFrequencyOption() === option.id && styles.selectedFrequencyOptionText
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.inputHint}>
                                {getFrequencyDescription()}
                            </Text>
                        </View>
                    )}
                </GradientBorderBox>
            </Animated.View>
        );
    };

    const getActivityLevelKey = useCallback((index: number) => {
        return ACTIVITY_LEVELS[index]?.key;
    }, []);

    // Map backend weight goal to new fitness goal format
    const mapBackendWeightGoal = useCallback((weightGoal?: string) => {
        if (!weightGoal) return undefined;

        switch (weightGoal) {
            case 'lose_1': return 'lose_1';
            case 'lose_0_75': return 'lose_0_75';
            case 'lose_0_5': return 'lose_0_5';
            case 'lose_0_25': return 'lose_0_25';
            case 'maintain': return 'maintain';
            case 'gain_0_25': return 'gain_0_25';
            case 'gain_0_5': return 'gain_0_5';
            case 'gain_0_75': return 'gain_0_75';
            case 'gain_1': return 'gain_1';
            default:
                // Legacy mapping for old values
                if (weightGoal?.startsWith('lose')) return 'lose_0_5';
                if (weightGoal?.startsWith('gain')) return 'gain_0_5';
                return undefined;
        }
    }, []);

    const getFitnessGoalLabel = useCallback((id?: string) => {
        if (!id) return '---';
        const goal = FITNESS_GOALS.find(goal => goal.id === id);
        if (!goal) return '---';

        if (isImperialUnits) {
            // Convert kg/week to lbs/week for display
            const lbsValue = goal.value * 2.20462;
            if (goal.value === 0) {
                return '0 lbs/week';
            } else if (goal.value > 0) {
                return `+${lbsValue.toFixed(2)} lbs/week${goal.id === 'lose_0_5' ? ' (Recommended)' : ''}`;
            } else {
                return `${lbsValue.toFixed(2)} lbs/week${goal.id === 'lose_0_5' ? ' (Recommended)' : ''}`;
            }
        }

        return goal.label;
    }, [isImperialUnits]);

    const getActivityLevelLabel = useCallback((value?: string) => {
        if (!value) return '---';
        const level = ACTIVITY_LEVELS.find(level => level.key === value);
        return level ? `${level.label} - ${level.description}` : '---';
    }, []);

    // Helper function to get selected frequency option
    const getSelectedFrequencyOption = () => {
        const currentFreq = formValues.cheatDayFrequency || 7;
        const standardOption = frequencyOptions.find(opt => opt.days === currentFreq);
        return standardOption ? standardOption.id : 'custom';
    };

    // Handle frequency option selection
    const handleFrequencyOptionSelect = (optionId: string) => {
        const option = frequencyOptions.find(opt => opt.id === optionId);
        if (option) {
            if (option.id === 'custom') {
                setCustomFrequencyInput((formValues.cheatDayFrequency || 7).toString());
                setShowCustomFrequencyModal(true);
            } else {
                updateFormValue('cheatDayFrequency', option.days);
            }
        }
    };

    // Helper function to get frequency description
    const getFrequencyDescription = () => {
        const currentFreq = formValues.cheatDayFrequency || 7;
        const standardOption = frequencyOptions.find(opt => opt.days === currentFreq);

        if (standardOption) {
            return `You'll have a cheat day ${standardOption.label.toLowerCase()} (every ${currentFreq} days)`;
        } else {
            return `You'll have a cheat day every ${currentFreq} days (custom frequency)`;
        }
    };

    // Handle custom frequency input
    const handleCustomFrequencySubmit = () => {
        const days = parseInt(customFrequencyInput);
        if (!isNaN(days) && days > 0 && days <= 365) {
            updateFormValue('cheatDayFrequency', days);
            setShowCustomFrequencyModal(false);
            setCustomFrequencyInput('');
        } else if (isNaN(days) || customFrequencyInput.trim() === '') {
            Alert.alert('Invalid Input', 'Please enter a valid number.');
        } else if (days <= 0) {
            Alert.alert('Invalid Input', 'Frequency must be at least 1 day.');
        } else if (days > 365) {
            Alert.alert('Invalid Input', 'Frequency cannot exceed 365 days (1 year).');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['rgba(92, 0, 221, 0.3)', 'transparent']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Fitness Goals</Text>
                <View style={{ width: 28 }}></View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'nutrition' && styles.activeTab]}
                    onPress={() => setActiveTab('nutrition')}
                >
                    <Ionicons
                        name="nutrition"
                        size={24}
                        color={activeTab === 'nutrition' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'nutrition' && styles.activeTabText
                        ]}
                    >
                        Nutrition
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'fitness' && styles.activeTab]}
                    onPress={() => setActiveTab('fitness')}
                >
                    <Ionicons
                        name="barbell"
                        size={24}
                        color={activeTab === 'fitness' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'fitness' && styles.activeTabText
                        ]}
                    >
                        Fitness
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {activeTab === 'nutrition' ? renderNutritionTab() : renderFitnessTab()}

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={WHITE} />
                    ) : (
                        <LinearGradient
                            colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveButtonGradient}
                        >
                            <Text style={styles.saveButtonText}>Save Goals</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Fitness Goal Wheel Picker Modal */}
            <Modal
                visible={showFitnessGoalPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowFitnessGoalPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Fitness Goal</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowFitnessGoalPicker(false)}
                            >
                                <Ionicons name="close" size={24} color={GRAY} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.wheelPickerContainer}>
                            <WheelPicker
                                data={FITNESS_GOALS.map(goal => ({
                                    value: goal.id,
                                    label: isImperialUnits ?
                                        (goal.value === 0 ? '0 lbs/week' :
                                            goal.value > 0 ? `+${(goal.value * 2.20462).toFixed(2)} lbs/week${goal.id === 'lose_0_5' ? ' (Recommended)' : ''}` :
                                                `${(goal.value * 2.20462).toFixed(2)} lbs/week${goal.id === 'lose_0_5' ? ' (Recommended)' : ''}`) :
                                        goal.label
                                }))}
                                value={formValues.fitnessGoal}
                                onValueChanged={({ item }) => {
                                    updateFormValue('fitnessGoal', item.value);
                                }}
                                itemTextStyle={{ color: WHITE, fontSize: 16 }}
                                itemHeight={35}
                                visibleItemCount={5}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => setShowFitnessGoalPicker(false)}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Caloric Warning Modal */}
            <Modal
                visible={showCaloricWarning}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCaloricWarning(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.warningModalContent}>
                        <View style={styles.warningHeader}>
                            <Ionicons name="warning" size={32} color={ORANGE} />
                            <Text style={styles.warningTitle}>Calorie Goals Will Change</Text>
                        </View>

                        <Text style={styles.warningMessage}>
                            You've changed your target weight, fitness goal, or activity level. These changes will affect your daily calorie and macro requirements.
                        </Text>

                        <Text style={styles.warningSubMessage}>
                            Your nutrition goals will be automatically recalculated based on your new settings.
                        </Text>

                        <View style={styles.warningButtons}>
                            <TouchableOpacity
                                style={styles.cancelWarningButton}
                                onPress={() => handleCaloricWarningResponse(false)}
                            >
                                <Text style={styles.cancelWarningButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.proceedWarningButton}
                                onPress={() => handleCaloricWarningResponse(true)}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={WHITE} size="small" />
                                ) : (
                                    <Text style={styles.proceedWarningButtonText}>Update & Recalculate</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Frequency Modal */}
            <Modal
                visible={showCustomFrequencyModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCustomFrequencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Enter Custom Frequency</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowCustomFrequencyModal(false)}
                            >
                                <Ionicons name="close" size={24} color={GRAY} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Frequency (days)</Text>
                            <TextInput
                                style={styles.input}
                                value={customFrequencyInput}
                                onChangeText={(text) => setCustomFrequencyInput(text)}
                                placeholder="Enter days (1-365)"
                                placeholderTextColor={GRAY}
                                keyboardType="number-pad"
                            />
                            <Text style={styles.inputHint}>
                                Enter how many days between each cheat day (e.g., 21 for every 3 weeks)
                            </Text>
                        </View>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: LIGHT_GRAY, marginRight: 8 }]}
                                onPress={() => setShowCustomFrequencyModal(false)}
                            >
                                <Text style={styles.submitButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleCustomFrequencySubmit}
                            >
                                <Text style={styles.submitButtonText}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

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
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: GRADIENT_MIDDLE,
    },
    tabText: {
        color: GRAY,
        fontSize: 16,
        marginLeft: 8,
    },
    activeTabText: {
        color: GRADIENT_MIDDLE,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    tabContent: {
        padding: 16,
    },
    summaryCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    summaryContent: {
        alignItems: 'center',
    },
    summaryTitle: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    summaryStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    statItem: {
        alignItems: 'center',
        padding: 10,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 20,
    },
    statValue: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    statLabel: {
        color: WHITE,
        fontSize: 14,
        opacity: 0.8,
    },
    gradientBorderContainer: {
        marginBottom: 20,
        borderRadius: 16,
        position: 'relative',
        padding: 2,
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    gradientBorderInner: {
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 16,
    },
    formSection: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        color: GRAY,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        overflow: 'hidden',
    },
    segmentOption: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    segmentText: {
        color: GRAY,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: WHITE,
    },
    dropdownField: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
    },
    saveButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginVertical: 20,
        marginHorizontal: 16,
    },
    saveButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
    },
    inputHint: {
        fontSize: 12,
        color: GRAY,
        marginTop: 4,
        marginLeft: 2,
    },
    resetButtonContainer: {
        alignItems: 'flex-end',
        marginTop: 8,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    resetButtonText: {
        color: GRADIENT_START,
        fontSize: 14,
        marginLeft: 4,
    },
    wheelPickerButton: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wheelPickerButtonText: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 20,
        width: width - 40,
        maxHeight: 350,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    wheelPickerContainer: {
        height: 180,
        marginVertical: 5,
    },
    doneButton: {
        backgroundColor: GRADIENT_MIDDLE,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 15,
    },
    doneButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    activitySliderContainer: {
        marginTop: 10,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sliderLabel: {
        color: GRAY,
        fontSize: 12,
    },
    activityLevelInfo: {
        marginTop: 10,
        alignItems: 'center',
    },
    activityLevelTitle: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    activityLevelDescription: {
        color: GRAY,
        fontSize: 14,
        marginTop: 4,
    },
    warningModalContent: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 24,
        width: width - 40,
        maxWidth: 400,
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    warningTitle: {
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    warningMessage: {
        color: WHITE,
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 12,
    },
    warningSubMessage: {
        color: GRAY,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 24,
    },
    warningButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelWarningButton: {
        flex: 1,
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    cancelWarningButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    proceedWarningButton: {
        flex: 1,
        backgroundColor: ORANGE,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    proceedWarningButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cheatDayToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cheatDayToggleContent: {
        flex: 1,
        marginRight: 16,
    },
    cheatDayToggleTitle: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cheatDayToggleDescription: {
        color: GRAY,
        fontSize: 14,
    },
    toggleSwitch: {
        width: 50,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 2,
        justifyContent: 'center',
    },
    toggleSwitchActive: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    toggleKnob: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: WHITE,
        alignSelf: 'flex-start',
    },
    toggleKnobActive: {
        alignSelf: 'flex-end',
    },
    frequencyOptionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    frequencyOption: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginRight: 8,
        marginBottom: 8,
        minWidth: 70,
        alignItems: 'center',
    },
    selectedFrequencyOption: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    frequencyOptionText: {
        color: GRAY,
        fontSize: 14,
        fontWeight: '600',
    },
    selectedFrequencyOptionText: {
        color: WHITE,
        fontWeight: 'bold',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    submitButton: {
        backgroundColor: GRADIENT_MIDDLE,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        flex: 1,
    },
    submitButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
