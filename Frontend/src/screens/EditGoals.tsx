import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
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
import { ThemeContext } from '../ThemeContext';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserGoals, updateUserGoals, getUserProfileBySupabaseUid, getUserProfileByFirebaseUid } from '../utils/database'; // Local database functions
import { updateNutritionGoals, updateFitnessGoals, getProfile, CompleteProfile, updateProfile, resetNutritionGoals } from '../api/profileApi'; // Backend API functions
import { formatWeight, kgToLbs, lbsToKg } from '../utils/unitConversion'; // Import unit conversion utilities
import { calculateNutritionGoalsFromProfile, Gender, ActivityLevel, WeightGoal, mapWeightGoal } from '../utils/nutritionCalculator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { getCheatDaySettings, updateCheatDaySettings, getCheatDayProgress, CheatDayProgress } from '../utils/database';

// Constants for colors - matching EditProfile
const PRIMARY_BG = '#000000';
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
    preferredCheatDayOfWeek?: number; // 0-6, where 0 = Sunday, null = no preference
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
const GradientBorderBox = ({ children, style, cardBackgroundColor }: { children: React.ReactNode, style?: any, cardBackgroundColor?: string }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
            />
            <View style={[styles.gradientBorderInner, cardBackgroundColor ? { backgroundColor: cardBackgroundColor } : {}, style]}>
                {children}
            </View>
        </View>
    );
};

export default function EditGoals() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [activeTab, setActiveTab] = useState('nutrition');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [isImperialUnits, setIsImperialUnits] = useState(false);

    // Helper function to map fitnessGoal to weight_goal constraint values
    const mapFitnessGoalToWeightGoal = (fitnessGoal?: string): string => {
        if (!fitnessGoal) return 'maintain';

        // Direct mapping for new format values
        const validWeightGoals = ['lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'];
        if (validWeightGoals.includes(fitnessGoal)) {
            return fitnessGoal;
        }

        // Legacy mapping for old values
        switch (fitnessGoal) {
            case 'lose':
            case 'lose_moderate':
            case 'fat_loss':
                return 'lose_0_5';
            case 'lose_light':
                return 'lose_0_25';
            case 'lose_heavy':
            case 'lose_extreme':
                return 'lose_0_75';
            case 'lose_aggressive':
                return 'lose_1';
            case 'gain':
            case 'gain_moderate':
            case 'muscle_gain':
                return 'gain_0_5';
            case 'gain_light':
                return 'gain_0_25';
            case 'maintain':
            case 'balanced':
            default:
                return 'maintain';
        }
    };

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

    // Frequency options data with research-based calorie recommendations
    const frequencyOptions = [
        { id: 'weekly', label: 'Weekly', days: 7, extraCalories: '300-500' },
        { id: 'biweekly', label: 'Biweekly', days: 14, extraCalories: '400-600' },
        { id: 'monthly', label: 'Monthly', days: 30, extraCalories: '500-700' },
        { id: 'custom', label: 'Custom', days: null, extraCalories: 'Variable' }
    ];

    // State for custom cheat day frequency
    const [showCustomFrequencyModal, setShowCustomFrequencyModal] = useState(false);
    const [customFrequencyInput, setCustomFrequencyInput] = useState('');
    const [showCheatDayInfoModal, setShowCheatDayInfoModal] = useState(false);

    // State for preferred day of week
    const [showPreferredDayModal, setShowPreferredDayModal] = useState(false);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Create picker data with "From Today" as first option
    const dayPickerData = [
        { value: undefined, label: 'From Today (Flexible)' },
        ...dayNames.map((day, index) => ({ value: index, label: day }))
    ];

    // Track values that affect caloric requirements
    const [originalCaloricValues, setOriginalCaloricValues] = useState<{
        targetWeight?: number;
        fitnessGoal?: string;
        activityLevel?: string;
    }>({});
    const [showCaloricWarning, setShowCaloricWarning] = useState(false);
    const [stepTrackingMode, setStepTrackingMode] = useState<'disabled' | 'with_calories' | 'without_calories'>('disabled');

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
                        cheatDayFrequency: userData?.cheatDayFrequency,
                        preferredCheatDayOfWeek: userData?.preferredCheatDayOfWeek
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
                                cheatDayFrequency: cheatDaySettings.frequency,
                                preferredCheatDayOfWeek: cheatDaySettings.preferredDayOfWeek
                            }));
                            setDbGoals(prev => ({
                                ...prev,
                                cheatDayEnabled: cheatDaySettings.enabled,
                                cheatDayFrequency: cheatDaySettings.frequency,
                                preferredCheatDayOfWeek: cheatDaySettings.preferredDayOfWeek
                            }));
                        } else {
                            // No cheat day settings exist yet, use defaults (disabled)
                            setFormValues(prev => ({
                                ...prev,
                                cheatDayEnabled: false,
                                cheatDayFrequency: 7,
                                preferredCheatDayOfWeek: undefined
                            }));
                            setDbGoals(prev => ({
                                ...prev,
                                cheatDayEnabled: false,
                                cheatDayFrequency: 7,
                                preferredCheatDayOfWeek: undefined
                            }));
                        }

                        // Load step tracking mode
                        const profile = await getUserProfileByFirebaseUid(user.uid);
                        if (profile?.step_tracking_calorie_mode) {
                            setStepTrackingMode(profile.step_tracking_calorie_mode as 'disabled' | 'with_calories' | 'without_calories');
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
    // NOTE: Target weight is NOT included because it doesn't affect calorie calculations
    // (target weight is only used for progress tracking display)
    const hasCaloricValuesChanged = () => {
        return (
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
            if (formValues.cheatDayEnabled !== undefined || formValues.cheatDayFrequency !== undefined || formValues.preferredCheatDayOfWeek !== undefined) {
                try {
                    console.log('Updating cheat day settings:', {
                        enabled: formValues.cheatDayEnabled,
                        frequency: formValues.cheatDayFrequency,
                        preferredDayOfWeek: formValues.preferredCheatDayOfWeek
                    });

                    await updateCheatDaySettings(user.uid, {
                        enabled: formValues.cheatDayEnabled || false,
                        frequency: formValues.cheatDayFrequency || 7,
                        preferredDayOfWeek: formValues.preferredCheatDayOfWeek
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

            // Backend sync disabled - app runs in offline-only mode
            console.log('✅ Goals saved locally - backend sync disabled for offline mode');

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
                    const userProfile = await getUserProfileBySupabaseUid(user.uid);
                    if (!userProfile) {
                        throw new Error('User profile not found in local database');
                    }

                    // Use current form values for calculation
                    const profileForCalculation = {
                        ...userProfile,
                        weight_goal: mapFitnessGoalToWeightGoal(formValues.fitnessGoal), // map to constraint values
                        activity_level: formValues.activityLevel || userProfile.activity_level,
                        target_weight: targetWeightKg || userProfile.target_weight
                    };

                    resetGoals = calculateNutritionGoalsFromProfile(profileForCalculation);

                    if (!resetGoals) {
                        // Check what's actually missing for better error messaging
                        const missingFields = [];
                        if (!profileForCalculation.weight) missingFields.push('current weight');
                        if (!profileForCalculation.height) missingFields.push('height');
                        if (!profileForCalculation.age) missingFields.push('age');
                        if (!profileForCalculation.gender) missingFields.push('gender');
                        if (!profileForCalculation.activity_level) missingFields.push('activity level');

                        console.log('❌ Nutrition goals calculation failed. Missing fields:', missingFields);
                        console.log('📋 Profile data available:', {
                            currentWeight: profileForCalculation.weight,
                            targetWeight: profileForCalculation.target_weight,
                            height: profileForCalculation.height,
                            age: profileForCalculation.age,
                            gender: profileForCalculation.gender,
                            activityLevel: profileForCalculation.activity_level
                        });

                        throw new Error(`Unable to calculate nutrition goals. Missing required fields: ${missingFields.join(', ')}. Note: Target weight is optional.`);
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
                                const userProfile = await getUserProfileBySupabaseUid(user.uid);
                                if (!userProfile) {
                                    throw new Error('User profile not found in local database');
                                }

                                console.log('Profile data for calculation:', {
                                    weight: userProfile.weight,
                                    height: userProfile.height,
                                    age: userProfile.age,
                                    gender: userProfile.gender,
                                    activity_level: userProfile.activity_level
                                });

                                // Use current form values for calculation
                                const profileForCalculation = {
                                    ...userProfile,
                                    weight_goal: mapFitnessGoalToWeightGoal(formValues.fitnessGoal), // map to constraint values
                                    activity_level: formValues.activityLevel || userProfile.activity_level,
                                    target_weight: formValues.targetWeight ? (isImperialUnits ? lbsToKg(formValues.targetWeight) : formValues.targetWeight) : userProfile.target_weight
                                };

                                console.log('Final profile for calculation:', {
                                    weight: profileForCalculation.weight,
                                    height: profileForCalculation.height,
                                    age: profileForCalculation.age,
                                    gender: profileForCalculation.gender,
                                    activity_level: profileForCalculation.activity_level
                                });

                                resetGoals = calculateNutritionGoalsFromProfile(profileForCalculation);

                                if (!resetGoals) {
                                    const missingFields = [];
                                    if (!profileForCalculation.weight) missingFields.push('weight');
                                    if (!profileForCalculation.height) missingFields.push('height');
                                    if (!profileForCalculation.age) missingFields.push('age');
                                    if (!profileForCalculation.gender) missingFields.push('gender');
                                    if (!profileForCalculation.activity_level) missingFields.push('activity level');

                                    throw new Error(`Unable to calculate nutrition goals. Missing: ${missingFields.join(', ')}`);
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
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading your goals...</Text>
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
                    colors={[theme.colors.primary, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Nutrition Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                                    {dbGoals.calorieGoal ? dbGoals.calorieGoal : "---"}
                                </Text>
                                <Text style={[styles.statLabel, { color: theme.colors.text }]}>Calories/day</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                                    {isImperialUnits && dbGoals.targetWeight
                                        ? `${Math.round(kgToLbs(dbGoals.targetWeight))} lbs`
                                        : dbGoals.targetWeight
                                            ? `${dbGoals.targetWeight} kg`
                                            : "---"}
                                </Text>
                                <Text style={[styles.statLabel, { color: theme.colors.text }]}>Target Weight</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Weight & Calorie Goals */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Weight & Calorie Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                            Target Weight {isImperialUnits ? '(lbs)' : '(kg)'}
                        </Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.targetWeight ? formValues.targetWeight.toString() : ''}
                            onChangeText={(text) => updateFormValue('targetWeight', text ? parseFloat(text) : '')}
                            placeholder={`${isImperialUnits ? 'Enter target weight in pounds' : 'Enter target weight in kilograms'} or leave empty`}
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="decimal-pad"
                        />
                        <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                            {isImperialUnits
                                ? 'Enter your target weight in pounds or leave empty'
                                : 'Enter your target weight in kilograms or leave empty'}
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Daily Calorie Goal</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.calorieGoal ? formValues.calorieGoal.toString() : ''}
                            onChangeText={(text) => updateFormValue('calorieGoal', text ? parseInt(text) : '')}
                            placeholder="Enter calorie goal or leave empty"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                        <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                            Enter your daily calorie goal or leave empty
                        </Text>
                    </View>
                </GradientBorderBox>

                {/* Macronutrient Goals */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Macronutrient Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Protein (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.proteinGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('proteinGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter protein goal"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Carbohydrates (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.carbGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('carbGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter carb goal"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Fat (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.fatGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('fatGoal', text ? parseInt(text) : undefined)}
                            placeholder="Enter fat goal"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.resetButtonContainer}>
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={handleReset}
                            disabled={isLoading}
                        >
                            <Ionicons name="refresh-outline" size={14} color={theme.colors.primary} />
                            <Text style={[styles.resetButtonText, { color: theme.colors.primary }]}>Reset to Recommended Values</Text>
                        </TouchableOpacity>
                    </View>
                </GradientBorderBox>

                {/* Activity Profile */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activity Profile</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Fitness Goal</Text>
                        <TouchableOpacity
                            style={[styles.wheelPickerButton, { backgroundColor: theme.colors.inputBackground }]}
                            onPress={() => setShowFitnessGoalPicker(true)}
                        >
                            <Text style={[styles.wheelPickerButtonText, { color: theme.colors.text }]}>
                                {getFitnessGoalLabel(formValues.fitnessGoal)}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Activity Level</Text>
                        <View style={styles.activitySliderContainer}>
                            <View style={styles.sliderLabels}>
                                <Text style={[styles.sliderLabel, { color: theme.colors.textSecondary }]}>Less Active</Text>
                                <Text style={[styles.sliderLabel, { color: theme.colors.textSecondary }]}>More Active</Text>
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
                                minimumTrackTintColor={theme.colors.primary}
                                maximumTrackTintColor={theme.colors.border}
                                thumbTintColor={theme.colors.primary}
                            />
                            <View style={styles.activityLevelInfo}>
                                <Text style={[styles.activityLevelTitle, { color: theme.colors.text }]}>
                                    {ACTIVITY_LEVELS[activityLevelIndex]?.label}
                                </Text>
                                <Text style={[styles.activityLevelDescription, { color: theme.colors.textSecondary }]}>
                                    {ACTIVITY_LEVELS[activityLevelIndex]?.description}
                                </Text>
                            </View>
                        </View>

                        {/* Step Tracking Mode Info */}
                        {stepTrackingMode !== 'disabled' && (
                            <View style={[styles.stepTrackingInfo, { borderColor: `${theme.colors.primary}4D` }]}>
                                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                                <Text style={[styles.stepTrackingInfoText, { color: theme.colors.primary }]}>
                                    {stepTrackingMode === 'with_calories'
                                        ? 'Step tracking is enabled with dynamic calories. Your base calories use a sedentary level, but protein and macros are calculated based on your selected activity level above.'
                                        : 'Step tracking is enabled without calorie adjustments. Your steps are tracked for motivation, and all calculations use your selected activity level.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </GradientBorderBox>

                {/* Motivation Settings */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <View style={styles.sectionTitleContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Motivation</Text>
                        <TouchableOpacity
                            style={styles.infoIconContainer}
                            onPress={() => setShowCheatDayInfoModal(true)}
                        >
                            <Ionicons name="information-circle-outline" size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.cheatDayToggleContainer}>
                            <View style={styles.cheatDayToggleContent}>
                                <Text style={[styles.cheatDayToggleTitle, { color: theme.colors.text }]}>Enable Cheat Days</Text>
                                <Text style={[styles.cheatDayToggleDescription, { color: theme.colors.textSecondary }]}>
                                    Track your progress towards scheduled cheat days
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.toggleSwitch,
                                    formValues.cheatDayEnabled && [styles.toggleSwitchActive, { backgroundColor: theme.colors.primary }]
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
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Cheat Day Frequency</Text>
                            <View style={styles.frequencyOptionsContainer}>
                                {frequencyOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.frequencyOption,
                                            getSelectedFrequencyOption() === option.id && [styles.selectedFrequencyOption, { backgroundColor: theme.colors.primary }]
                                        ]}
                                        onPress={() => handleFrequencyOptionSelect(option.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.frequencyOptionText,
                                                { color: theme.colors.textSecondary },
                                                getSelectedFrequencyOption() === option.id && [styles.selectedFrequencyOptionText, { color: theme.colors.text }]
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                {getFrequencyDescription()}
                            </Text>
                        </View>
                    )}

                    {formValues.cheatDayEnabled && (
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={[styles.daySelector, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={() => setShowPreferredDayModal(true)}
                            >
                                <Text style={[styles.daySelectorText, { color: theme.colors.text }]}>
                                    {formValues.preferredCheatDayOfWeek !== undefined
                                        ? dayNames[formValues.preferredCheatDayOfWeek]
                                        : 'From Today'
                                    }
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                {formValues.preferredCheatDayOfWeek !== undefined
                                    ? `Your cheat days will always fall on ${dayNames[formValues.preferredCheatDayOfWeek]}s`
                                    : 'Choose a specific day of the week for your cheat days, or leave as "From Today" for flexible scheduling'
                                }
                            </Text>
                        </View>
                    )}
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
                    colors={[theme.colors.primary, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Fitness Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.text }]}>{dbGoals.weeklyWorkouts || "---"}</Text>
                                <Text style={[styles.statLabel, { color: theme.colors.text }]}>Workouts/week</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.text }]}>{dbGoals.stepGoal || "---"}</Text>
                                <Text style={[styles.statLabel, { color: theme.colors.text }]}>Daily Steps</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                                    {cheatDayProgress.enabled
                                        ? `${cheatDayProgress.daysUntilNext}d`
                                        : "Disabled"}
                                </Text>
                                <Text style={[styles.statLabel, { color: theme.colors.text }]}>Cheat Day</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Workout Goals */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Workout Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Weekly Workouts</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.weeklyWorkouts?.toString() || ''}
                            onChangeText={(text) => updateFormValue('weeklyWorkouts', text ? parseInt(text) : undefined)}
                            placeholder="Workouts per week"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Daily Step Goal</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.stepGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('stepGoal', text ? parseInt(text) : undefined)}
                            placeholder="Target daily steps"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Health Goals */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Health Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Daily Water Intake (ml)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.waterGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('waterGoal', text ? parseInt(text) : undefined)}
                            placeholder="Water intake goal"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Sleep Goal (hours)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            value={formValues.sleepGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('sleepGoal', text ? parseInt(text) : undefined)}
                            placeholder="Target sleep hours"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Motivation Settings */}
                <GradientBorderBox cardBackgroundColor={theme.colors.cardBackground}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Motivation</Text>

                    <View style={styles.inputGroup}>
                        <View style={styles.cheatDayToggleContainer}>
                            <View style={styles.cheatDayToggleContent}>
                                <Text style={[styles.cheatDayToggleTitle, { color: theme.colors.text }]}>Enable Cheat Days</Text>
                                <Text style={[styles.cheatDayToggleDescription, { color: theme.colors.textSecondary }]}>
                                    Track your progress towards scheduled cheat days
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.toggleSwitch,
                                    formValues.cheatDayEnabled && [styles.toggleSwitchActive, { backgroundColor: theme.colors.primary }]
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
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Cheat Day Frequency</Text>
                            <View style={styles.frequencyOptionsContainer}>
                                {frequencyOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.frequencyOption,
                                            getSelectedFrequencyOption() === option.id && [styles.selectedFrequencyOption, { backgroundColor: theme.colors.primary }]
                                        ]}
                                        onPress={() => handleFrequencyOptionSelect(option.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.frequencyOptionText,
                                                { color: theme.colors.textSecondary },
                                                getSelectedFrequencyOption() === option.id && [styles.selectedFrequencyOptionText, { color: theme.colors.text }]
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                {getFrequencyDescription()}
                            </Text>
                        </View>
                    )}

                    {formValues.cheatDayEnabled && (
                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={[styles.daySelector, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={() => setShowPreferredDayModal(true)}
                            >
                                <Text style={[styles.daySelectorText, { color: theme.colors.text }]}>
                                    {formValues.preferredCheatDayOfWeek !== undefined
                                        ? dayNames[formValues.preferredCheatDayOfWeek]
                                        : 'From Today'
                                    }
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                {formValues.preferredCheatDayOfWeek !== undefined
                                    ? `Your cheat days will always fall on ${dayNames[formValues.preferredCheatDayOfWeek]}s`
                                    : 'Choose a specific day of the week for your cheat days, or leave as "From Today" for flexible scheduling'
                                }
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

    // Helper function to calculate extra calories for custom frequency
    const calculateCustomExtraCalories = (days: number) => {
        if (days < 7) return '0'; // Minimum 7 days required
        const weeks = days / 7;
        const baseCalories = 300;
        const extraCalories = Math.round(baseCalories + (50 * weeks));
        return `${extraCalories}`;
    };

    // Helper function to get extra calories description
    const getExtraCaloriesForFrequency = (frequency: number) => {
        const standardOption = frequencyOptions.find(opt => opt.days === frequency);
        if (standardOption) {
            return standardOption.extraCalories;
        } else {
            // Custom frequency
            return calculateCustomExtraCalories(frequency);
        }
    };

    // Helper function to get frequency description
    const getFrequencyDescription = () => {
        const currentFreq = formValues.cheatDayFrequency || 7;
        const standardOption = frequencyOptions.find(opt => opt.days === currentFreq);
        const extraCalories = getExtraCaloriesForFrequency(currentFreq);

        if (standardOption) {
            return `You'll have a cheat day ${standardOption.label.toLowerCase()} (every ${currentFreq} days) with ${extraCalories} extra calories`;
        } else {
            return `You'll have a cheat day every ${currentFreq} days (custom frequency) with ${extraCalories} extra calories`;
        }
    };

    // Handle custom frequency input with minimum 7 days validation
    const handleCustomFrequencySubmit = () => {
        const days = parseInt(customFrequencyInput);
        if (!isNaN(days) && days >= 7 && days <= 365) {
            updateFormValue('cheatDayFrequency', days);
            setShowCustomFrequencyModal(false);
            setCustomFrequencyInput('');
        } else if (isNaN(days) || customFrequencyInput.trim() === '') {
            Alert.alert('Invalid Input', 'Please enter a valid number.');
        } else if (days < 7) {
            Alert.alert('Invalid Input', 'Frequency must be at least 7 days for optimal metabolic benefits.');
        } else if (days > 365) {
            Alert.alert('Invalid Input', 'Frequency cannot exceed 365 days (1 year).');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "left", "right"]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            {/* Header */}
            <LinearGradient
                colors={[`${theme.colors.primary}4D`, 'transparent']}
                style={[styles.header, { borderBottomColor: theme.colors.border }]}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Fitness Goals</Text>
                <View style={{ width: 28 }}></View>
            </LinearGradient>

            {/* Tabs */}
            <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'nutrition' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => setActiveTab('nutrition')}
                >
                    <Ionicons
                        name="nutrition"
                        size={24}
                        color={activeTab === 'nutrition' ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: theme.colors.textSecondary },
                            activeTab === 'nutrition' && [styles.activeTabText, { color: theme.colors.primary }]
                        ]}
                    >
                        Nutrition
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'fitness' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]]}
                    onPress={() => setActiveTab('fitness')}
                >
                    <Ionicons
                        name="barbell"
                        size={24}
                        color={activeTab === 'fitness' ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: theme.colors.textSecondary },
                            activeTab === 'fitness' && [styles.activeTabText, { color: theme.colors.primary }]
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
                        <ActivityIndicator color={theme.colors.text} />
                    ) : (
                        <LinearGradient
                            colors={[theme.colors.primary, GRADIENT_MIDDLE, GRADIENT_END]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveButtonGradient}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.colors.text }]}>Save Goals</Text>
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
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Fitness Goal</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowFitnessGoalPicker(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
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
                                itemTextStyle={{ color: theme.colors.text, fontSize: 16 }}
                                itemHeight={35}
                                visibleItemCount={5}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setShowFitnessGoalPicker(false)}
                        >
                            <Text style={[styles.doneButtonText, { color: theme.colors.text }]}>Done</Text>
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
                    <View style={[styles.warningModalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.warningHeader}>
                            <Ionicons name="warning" size={32} color={ORANGE} />
                            <Text style={[styles.warningTitle, { color: theme.colors.text }]}>Calorie Goals Will Change</Text>
                        </View>

                        <Text style={[styles.warningMessage, { color: theme.colors.text }]}>
                            You've changed your target weight, fitness goal, or activity level. These changes will affect your daily calorie and macro requirements.
                        </Text>

                        <Text style={[styles.warningSubMessage, { color: theme.colors.textSecondary }]}>
                            Your nutrition goals will be automatically recalculated based on your new settings.
                        </Text>

                        <View style={styles.warningButtons}>
                            <TouchableOpacity
                                style={[styles.cancelWarningButton, { backgroundColor: theme.colors.inputBackground }]}
                                onPress={() => handleCaloricWarningResponse(false)}
                            >
                                <Text style={[styles.cancelWarningButtonText, { color: theme.colors.text }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.proceedWarningButton}
                                onPress={() => handleCaloricWarningResponse(true)}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={theme.colors.text} size="small" />
                                ) : (
                                    <Text style={[styles.proceedWarningButtonText, { color: theme.colors.text }]}>Update & Recalculate</Text>
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
                animationType="fade"
                onRequestClose={() => setShowCustomFrequencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Enter Custom Frequency</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowCustomFrequencyModal(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Frequency (days)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                value={customFrequencyInput}
                                onChangeText={(text) => setCustomFrequencyInput(text)}
                                placeholder="Enter days (7-365)"
                                placeholderTextColor={theme.colors.textSecondary}
                                keyboardType="number-pad"
                            />
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                Enter how many days between each cheat day (minimum 7 days for optimal metabolic benefits)
                            </Text>
                        </View>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: theme.colors.inputBackground, marginRight: 8 }]}
                                onPress={() => setShowCustomFrequencyModal(false)}
                            >
                                <Text style={[styles.submitButtonText, { color: theme.colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
                                onPress={handleCustomFrequencySubmit}
                            >
                                <Text style={[styles.submitButtonText, { color: theme.colors.text }]}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Preferred Day Modal */}
            <Modal
                visible={showPreferredDayModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPreferredDayModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowPreferredDayModal(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.wheelPickerContainer}>
                            <WheelPicker
                                data={dayPickerData}
                                value={formValues.preferredCheatDayOfWeek}
                                onValueChanged={({ item }) => {
                                    updateFormValue('preferredCheatDayOfWeek', item.value);
                                }}
                                itemTextStyle={{ color: theme.colors.text, fontSize: 16 }}
                                itemHeight={35}
                                visibleItemCount={5}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setShowPreferredDayModal(false)}
                        >
                            <Text style={[styles.doneButtonText, { color: theme.colors.text }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Cheat Day Info Modal */}
            <Modal
                visible={showCheatDayInfoModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCheatDayInfoModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.infoModalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Cheat Day Science</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowCheatDayInfoModal(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.infoModalScroll} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.infoModalSubtitle, { color: theme.colors.text }]}>Extra Calories on Cheat Days</Text>
                            <View style={styles.infoCaloriesList}>
                                <View style={styles.infoCalorieItem}>
                                    <Text style={[styles.infoCalorieLabel, { color: theme.colors.textSecondary }]}>Weekly (7 days):</Text>
                                    <Text style={[styles.infoCalorieValue, { color: theme.colors.primary }]}>+300-500 calories</Text>
                                </View>
                                <View style={styles.infoCalorieItem}>
                                    <Text style={[styles.infoCalorieLabel, { color: theme.colors.textSecondary }]}>Biweekly (14 days):</Text>
                                    <Text style={[styles.infoCalorieValue, { color: theme.colors.primary }]}>+400-600 calories</Text>
                                </View>
                                <View style={styles.infoCalorieItem}>
                                    <Text style={[styles.infoCalorieLabel, { color: theme.colors.textSecondary }]}>Monthly (30 days):</Text>
                                    <Text style={[styles.infoCalorieValue, { color: theme.colors.primary }]}>+500-700 calories</Text>
                                </View>
                                <View style={styles.infoCalorieItem}>
                                    <Text style={[styles.infoCalorieLabel, { color: theme.colors.textSecondary }]}>Custom frequency:</Text>
                                    <Text style={[styles.infoCalorieValue, { color: theme.colors.primary }]}>Calculated based on duration</Text>
                                </View>
                            </View>

                            <Text style={[styles.infoModalSubtitle, { color: theme.colors.text }]}>The Science Behind Cheat Days</Text>
                            <Text style={[styles.infoModalText, { color: theme.colors.textSecondary }]}>
                                Research shows that strategic refeed days can provide several benefits during weight loss:
                            </Text>

                            <View style={styles.infoBenefitsList}>
                                <View style={styles.infoBenefitItem}>
                                    <Text style={[styles.infoBenefitBullet, { color: theme.colors.primary }]}>•</Text>
                                    <Text style={[styles.infoBenefitText, { color: theme.colors.textSecondary }]}>
                                        <Text style={[styles.infoBenefitBold, { color: theme.colors.text }]}>Leptin Boost:</Text> Increases the hunger-regulating hormone that controls metabolism and appetite
                                    </Text>
                                </View>
                                <View style={styles.infoBenefitItem}>
                                    <Text style={[styles.infoBenefitBullet, { color: theme.colors.primary }]}>•</Text>
                                    <Text style={[styles.infoBenefitText, { color: theme.colors.textSecondary }]}>
                                        <Text style={[styles.infoBenefitBold, { color: theme.colors.text }]}>Glycogen Replenishment:</Text> Restores muscle energy for better workout performance
                                    </Text>
                                </View>
                                <View style={styles.infoBenefitItem}>
                                    <Text style={[styles.infoBenefitBullet, { color: theme.colors.primary }]}>•</Text>
                                    <Text style={[styles.infoBenefitText, { color: theme.colors.textSecondary }]}>
                                        <Text style={[styles.infoBenefitBold, { color: theme.colors.text }]}>Psychological Relief:</Text> Improves long-term diet adherence and reduces binge eating risk
                                    </Text>
                                </View>
                                <View style={styles.infoBenefitItem}>
                                    <Text style={[styles.infoBenefitBullet, { color: theme.colors.primary }]}>•</Text>
                                    <Text style={[styles.infoBenefitText, { color: theme.colors.textSecondary }]}>
                                        <Text style={[styles.infoBenefitBold, { color: theme.colors.text }]}>Metabolic Support:</Text> Helps counteract adaptive thermogenesis during prolonged dieting
                                    </Text>
                                </View>
                            </View>

                            <Text style={[styles.infoModalNote, { color: theme.colors.textSecondary, borderLeftColor: theme.colors.primary }]}>
                                <Text style={[styles.infoModalNoteBold, { color: theme.colors.primary }]}>Best Practice:</Text> Focus on carbohydrate-rich foods during your cheat day for optimal leptin response and metabolic benefits.
                            </Text>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setShowCheatDayInfoModal(false)}
                        >
                            <Text style={[styles.doneButtonText, { color: theme.colors.text }]}>Got It!</Text>
                        </TouchableOpacity>
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
        backgroundColor: '#121212', // Overridden by theme.colors.cardBackground inline
        borderRadius: 14,
        padding: 16,
    },
    formSection: {
        backgroundColor: '#121212', // Overridden by theme.colors.cardBackground inline
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
        backgroundColor: '#121212', // Overridden by theme.colors.cardBackground inline
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
    stepTrackingInfo: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.3)',
        alignItems: 'flex-start',
    },
    stepTrackingInfoText: {
        flex: 1,
        color: '#0074dd',
        fontSize: 13,
        lineHeight: 18,
        marginLeft: 8,
    },
    warningModalContent: {
        backgroundColor: '#121212', // Overridden by theme.colors.cardBackground inline
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
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoIconContainer: {
        padding: 4,
    },
    infoModalContent: {
        backgroundColor: '#121212', // Overridden by theme.colors.cardBackground inline
        borderRadius: 16,
        padding: 20,
        width: width - 40,
        maxWidth: 400,
        maxHeight: 600,
    },
    infoModalScroll: {
        marginBottom: 20,
        maxHeight: 450,
    },
    infoModalSubtitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        marginTop: 16,
    },
    infoCaloriesList: {
        marginBottom: 20,
    },
    infoCalorieItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    infoCalorieLabel: {
        color: GRAY,
        fontSize: 14,
    },
    infoCalorieValue: {
        color: '#8B4FE6',
        fontSize: 14,
        fontWeight: 'bold',
    },
    infoModalText: {
        color: GRAY,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    infoBenefitsList: {
        marginBottom: 20,
    },
    infoBenefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    infoBenefitBullet: {
        color: GRADIENT_MIDDLE,
        fontSize: 16,
        marginRight: 8,
        marginTop: 2,
    },
    infoBenefitText: {
        color: GRAY,
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
    infoBenefitBold: {
        color: WHITE,
        fontWeight: 'bold',
    },
    infoModalNote: {
        color: GRAY,
        fontSize: 14,
        lineHeight: 20,
        backgroundColor: 'rgba(139, 79, 230, 0.15)',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#8B4FE6',
    },
    infoModalNoteBold: {
        color: '#8B4FE6',
        fontWeight: 'bold',
    },
    daySelector: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    daySelectorText: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
    },
    dayOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: LIGHT_GRAY,
    },
    dayOptionText: {
        color: GRAY,
        fontSize: 16,
        flex: 1,
    },
    selectedDayOption: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    selectedDayOptionText: {
        color: WHITE,
        fontWeight: 'bold',
    },
});
