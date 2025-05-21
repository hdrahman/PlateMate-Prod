import React, { useState, useEffect, useRef } from 'react';
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
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserGoals, updateUserGoals } from '../utils/database'; // Local database functions
import { updateNutritionGoals, updateFitnessGoals } from '../api/profileApi'; // Backend API functions

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
}

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

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Database values - these are the values we display and don't change until after save
    const [dbGoals, setDbGoals] = useState<GoalsData>({
        targetWeight: 0,
        calorieGoal: 0,
        proteinGoal: 0,
        carbGoal: 0,
        fatGoal: 0,
        fitnessGoal: 'maintain',
        activityLevel: 'moderate',
        weeklyWorkouts: 4,
        stepGoal: 10000,
        waterGoal: 2000,
        sleepGoal: 8
    });

    // Form values - these update as user types but don't affect display until saved
    const [formValues, setFormValues] = useState<GoalsData>({
        targetWeight: 0,
        calorieGoal: 0,
        proteinGoal: 0,
        carbGoal: 0,
        fatGoal: 0,
        fitnessGoal: 'maintain',
        activityLevel: 'moderate',
        weeklyWorkouts: 4,
        stepGoal: 10000,
        waterGoal: 2000,
        sleepGoal: 8
    });

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

        // Fetch user's goals
        const fetchUserGoals = async () => {
            setIsFetchingData(true);
            try {
                if (user) {
                    // In a real implementation, get actual data from DB
                    const userData = await getUserGoals(user.uid);

                    // Set default values if any data is missing
                    const goals = {
                        targetWeight: userData?.targetWeight || 0,
                        calorieGoal: userData?.calorieGoal || 0,
                        proteinGoal: userData?.proteinGoal || 0,
                        carbGoal: userData?.carbGoal || 0,
                        fatGoal: userData?.fatGoal || 0,
                        fitnessGoal: userData?.fitnessGoal || 'maintain',
                        activityLevel: userData?.activityLevel || 'moderate',
                        weeklyWorkouts: userData?.weeklyWorkouts || 0,
                        stepGoal: userData?.stepGoal || 0,
                        waterGoal: userData?.waterGoal || 0,
                        sleepGoal: userData?.sleepGoal || 0
                    };

                    // Update both database values and form values
                    setDbGoals(goals);
                    setFormValues({ ...goals });
                }
            } catch (error) {
                console.error('Error fetching user goals', error);
                Alert.alert('Error', 'Failed to load your goals. Please try again.');
            } finally {
                setIsFetchingData(false);
            }
        };

        if (user) {
            fetchUserGoals();
        }
    }, [user]);

    const handleSave = async () => {
        setIsLoading(true);

        try {
            if (!user) {
                throw new Error('User not authenticated');
            }

            try {
                // First try to save to the backend via the API
                // Use the profileApi functions that we've already improved with timeout handling
                if (activeTab === 'nutrition') {
                    // Format nutrition goals for the API
                    const nutritionGoals = {
                        daily_calorie_target: formValues.calorieGoal || 0,
                        protein_goal: formValues.proteinGoal || 0,
                        carb_goal: formValues.carbGoal || 0,
                        fat_goal: formValues.fatGoal || 0,
                        target_weight: formValues.targetWeight || 0,
                        weight_goal: (formValues.fitnessGoal === 'maintain' ? 'maintain' :
                            formValues.fitnessGoal === 'lose' ? 'lose_0_5' :
                                formValues.fitnessGoal === 'gain' ? 'gain_0_25' : 'maintain') as any,
                    };

                    await updateNutritionGoals(nutritionGoals);
                } else {
                    // Format fitness goals for the API
                    const fitnessGoals = {
                        activity_level: formValues.activityLevel || 'moderate',
                        weekly_workouts: formValues.weeklyWorkouts || 0,
                        step_goal: formValues.stepGoal || 0,
                        water_goal: formValues.waterGoal || 0,
                        sleep_goal: formValues.sleepGoal || 0,
                    };

                    await updateFitnessGoals(fitnessGoals);
                }

                // If we get here, backend save was successful
                console.log('Goals saved to backend successfully');
            } catch (backendError) {
                console.error('Error saving to backend, falling back to local save:', backendError);
                // Continue execution to save locally
            }

            // Always save to local database whether backend succeeds or fails
            // This ensures data is available offline
            // Use a simpler object to avoid database schema issues
            await updateUserGoals(user.uid, {
                targetWeight: formValues.targetWeight,
                calorieGoal: formValues.calorieGoal,
                proteinGoal: formValues.proteinGoal,
                carbGoal: formValues.carbGoal,
                fatGoal: formValues.fatGoal,
                fitnessGoal: formValues.fitnessGoal,
                activityLevel: formValues.activityLevel,
                weeklyWorkouts: formValues.weeklyWorkouts,
                stepGoal: formValues.stepGoal,
                waterGoal: formValues.waterGoal,
                sleepGoal: formValues.sleepGoal
            });

            // Only update display values after successful DB update
            setDbGoals({ ...formValues });

            Alert.alert('Success', 'Fitness goals updated successfully');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update goals. Please try again.');
            console.error('Goals update error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateFormValue = (field: keyof GoalsData, value: any) => {
        setFormValues(prev => ({
            ...prev,
            [field]: value
        }));
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
                                <Text style={styles.statValue}>{dbGoals.calorieGoal || 0}</Text>
                                <Text style={styles.statLabel}>Calories/day</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{dbGoals.targetWeight || 0} kg</Text>
                                <Text style={styles.statLabel}>Target Weight</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Weight & Calorie Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Weight & Calorie Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Target Weight (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.targetWeight?.toString() || ''}
                            onChangeText={(text) => updateFormValue('targetWeight', text ? parseFloat(text) : 0)}
                            placeholder="Enter target weight"
                            placeholderTextColor={GRAY}
                            keyboardType="decimal-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={formValues.calorieGoal?.toString() || ''}
                            onChangeText={(text) => updateFormValue('calorieGoal', text ? parseInt(text) : 0)}
                            placeholder="Enter calorie goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
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
                            onChangeText={(text) => updateFormValue('proteinGoal', text ? parseInt(text) : 0)}
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
                            onChangeText={(text) => updateFormValue('carbGoal', text ? parseInt(text) : 0)}
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
                            onChangeText={(text) => updateFormValue('fatGoal', text ? parseInt(text) : 0)}
                            placeholder="Enter fat goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Activity Profile */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Activity Profile</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Fitness Goal</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[styles.segmentOption, formValues.fitnessGoal === 'lose' && styles.segmentActive]}
                                onPress={() => updateFormValue('fitnessGoal', 'lose')}
                            >
                                <Text style={[styles.segmentText, formValues.fitnessGoal === 'lose' && styles.segmentTextActive]}>
                                    Lose Weight
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, formValues.fitnessGoal === 'maintain' && styles.segmentActive]}
                                onPress={() => updateFormValue('fitnessGoal', 'maintain')}
                            >
                                <Text style={[styles.segmentText, formValues.fitnessGoal === 'maintain' && styles.segmentTextActive]}>
                                    Maintain
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, formValues.fitnessGoal === 'gain' && styles.segmentActive]}
                                onPress={() => updateFormValue('fitnessGoal', 'gain')}
                            >
                                <Text style={[styles.segmentText, formValues.fitnessGoal === 'gain' && styles.segmentTextActive]}>
                                    Gain Weight
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Activity Level</Text>
                        <View style={styles.dropdownField}>
                            <Text style={styles.dropdownText}>{getActivityLevelLabel(formValues.activityLevel || 'moderate')}</Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
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
                                <Text style={styles.statValue}>{dbGoals.weeklyWorkouts || 0}</Text>
                                <Text style={styles.statLabel}>Workouts/week</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{dbGoals.stepGoal || 0}</Text>
                                <Text style={styles.statLabel}>Daily Steps</Text>
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
                            onChangeText={(text) => updateFormValue('weeklyWorkouts', text ? parseInt(text) : 0)}
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
                            onChangeText={(text) => updateFormValue('stepGoal', text ? parseInt(text) : 0)}
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
                            onChangeText={(text) => updateFormValue('waterGoal', text ? parseInt(text) : 0)}
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
                            onChangeText={(text) => updateFormValue('sleepGoal', text ? parseInt(text) : 0)}
                            placeholder="Target sleep hours"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>
            </Animated.View>
        );
    };

    // Helper function to get activity level label
    const getActivityLevelLabel = (value: string) => {
        const labels: Record<string, string> = {
            'sedentary': 'Sedentary (office job)',
            'light': 'Light Activity (1-2 days/week)',
            'moderate': 'Moderate Activity (3-5 days/week)',
            'active': 'Very Active (6-7 days/week)',
            'athletic': 'Athletic (2x per day)'
        };
        return labels[value] || 'Select activity level';
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
});
