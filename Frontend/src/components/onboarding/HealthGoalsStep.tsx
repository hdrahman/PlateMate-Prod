import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../../ThemeContext';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
    Image,
    SafeAreaView,
    Modal,
    Animated,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import WheelPicker from '../WheelPicker';
import { initializeCheatDaySettings } from '../../utils/database';
import { useAuth } from '../../context/AuthContext';
import { calculateNutritionGoals } from '../../utils/nutritionCalculator';

interface HealthGoalsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Weight goal detailed options with weekly rates
const weightLossOptions = [
    { id: 'lose_extreme', label: 'Lose 1 kg per week', description: 'Significant calorie deficit', deficit: 1000 },
    { id: 'lose_heavy', label: 'Lose 0.75 kg per week', description: 'Major calorie deficit', deficit: 750 },
    { id: 'lose_moderate', label: 'Lose 0.5 kg per week', description: 'Moderate calorie deficit', deficit: 500 },
    { id: 'lose_light', label: 'Lose 0.25 kg per week', description: 'Slight calorie deficit', deficit: 250 },
];

const weightGainOptions = [
    { id: 'gain_light', label: 'Gain 0.25 kg per week', description: 'Slight calorie surplus', surplus: 250 },
    { id: 'gain_moderate', label: 'Gain 0.5 kg per week', description: 'Moderate calorie surplus', surplus: 500 },
];


// Nutrient focus options (with default daily values)
const nutrientFocus = [
    { id: 'protein', label: 'Protein', default: 100, unit: 'g' },
    { id: 'carbs', label: 'Carbs', default: 200, unit: 'g' },
    { id: 'fats', label: 'Fats', default: 65, unit: 'g' },
    { id: 'fiber', label: 'Fiber', default: 30, unit: 'g' },
    { id: 'sugar', label: 'Sugar', default: 25, unit: 'g' },
    { id: 'sodium', label: 'Sodium', default: 2300, unit: 'mg' },
];

// Add activityLevels constant below the other constants
const activityLevels = [
    { id: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
    { id: 'light', label: 'Lightly Active', description: '1-3 days/week' },
    { id: 'moderate', label: 'Moderately Active', description: '3-5 days/week' },
    { id: 'active', label: 'Very Active', description: '6-7 days/week' },
    { id: 'very_active', label: 'Extremely Active', description: 'Physical job or 2x training' },
];

const HealthGoalsStep: React.FC<HealthGoalsStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { user } = useAuth();
    const [mainGoal, setMainGoal] = useState<'lose' | 'maintain' | 'gain'>(
        profile.weightGoal?.startsWith('lose') ? 'lose' :
            profile.weightGoal?.startsWith('gain') ? 'gain' : 'maintain'
    );
    const [detailedGoal, setDetailedGoal] = useState<string>(profile.weightGoal || 'maintain');
    const [calculatedCalories, setCalculatedCalories] = useState<number>(0);
    const [calculatedNutrients, setCalculatedNutrients] = useState<any>({});
    const [showFitnessGoalPicker, setShowFitnessGoalPicker] = useState(false);

    // Cheat day preferences state
    const [cheatDayEnabled, setCheatDayEnabled] = useState<boolean>(profile.cheatDayEnabled ?? false);
    const [cheatDayFrequency, setCheatDayFrequency] = useState<number>(profile.cheatDayFrequency ?? 7);
    const [preferredCheatDayOfWeek, setPreferredCheatDayOfWeek] = useState<number | undefined>(profile.preferredCheatDayOfWeek);
    const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
    const [showPreferredDayPicker, setShowPreferredDayPicker] = useState(false);

    // Frequency options
    const frequencyOptions = [
        { id: 'weekly', label: 'Weekly', days: 7 },
        { id: 'biweekly', label: 'Biweekly', days: 14 },
        { id: 'monthly', label: 'Monthly', days: 30 },
    ];

    // Day names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Create picker data with "From Today" as first option
    const dayPickerData = [
        { value: undefined, label: 'From Today (Flexible)' },
        ...dayNames.map((day, index) => ({ value: index, label: day }))
    ];

    // Calculate recommended calories and nutrients based on profile and goals
    useEffect(() => {
        if (profile.weight && profile.height && profile.age && profile.gender && profile.activityLevel) {
            calculateNutrition();
        }
    }, [mainGoal, detailedGoal, profile]);

    const calculateNutrition = () => {
        // Build a UserProfile with the selected goal
        const profileWithGoal: UserProfile = {
            ...profile,
            weightGoal: detailedGoal,
            fitnessGoal: detailedGoal,
        };

        // Use canonical calculator
        const goals = calculateNutritionGoals(profileWithGoal);

        setCalculatedCalories(goals.calories);

        // Evidence-based fiber recommendations (2024 dietary guidelines)
        // Men: 38g/day, Women: 25g/day (or 14g per 1000 calories)
        const fiberG = profile.gender === 'male' ? 38 : 25;

        // Added sugar recommendations (WHO/AHA guidelines)
        // <10% of total calories from added sugars (WHO), <6% ideal (AHA)
        const sugarsG = Math.round(goals.calories * 0.06 / 4); // 6% of calories as added sugars

        // Sodium recommendations (conservative approach since we don't track health conditions)
        // Using 2000mg as default instead of 2300mg to be more health-conscious
        let sodiumMg = 2000; // Conservative general recommendation
        if (profile.age && profile.age > 50) {
            sodiumMg = 1500; // Lower for adults over 50 (higher cardiovascular risk)
        } else if (profile.age && profile.age > 40) {
            sodiumMg = 1800; // Moderately lower for 40-50 age group
        }

        setCalculatedNutrients({
            protein: goals.protein,
            carbs: goals.carbs,
            fats: goals.fat,
            fiber: fiberG,
            sugar: sugarsG,
            sodium: sodiumMg
        });
    };

    const handleMainGoalSelect = (goal: 'lose' | 'maintain' | 'gain') => {
        setMainGoal(goal);

        // When switching main goal, set a default detailed goal
        if (goal === 'lose') {
            setDetailedGoal('lose_moderate');
        } else if (goal === 'gain') {
            setDetailedGoal('gain_light');
        } else {
            setDetailedGoal('maintain');
        }
    };

    const handleDetailedGoalSelect = (goalId: string) => {
        setDetailedGoal(goalId);
    };

    const handleSubmit = async () => {
        await updateProfile({
            weightGoal: detailedGoal,
            dailyCalorieTarget: calculatedCalories,
            nutrientFocus: calculatedNutrients,
            cheatDayEnabled: cheatDayEnabled,
            cheatDayFrequency: cheatDayFrequency,
            preferredCheatDayOfWeek: preferredCheatDayOfWeek,
        });

        // Initialize cheat day settings in database if enabled
        if (cheatDayEnabled && user?.id) {
            try {
                await initializeCheatDaySettings(user.id, cheatDayFrequency, preferredCheatDayOfWeek);
            } catch (error) {
                console.error('Error initializing cheat day settings:', error);
                // Continue with onboarding even if cheat day initialization fails
            }
        }

        onNext();
    };

    const renderDetailedGoals = () => {
        if (mainGoal === 'maintain') {
            return (
                <View style={styles.maintainContainer}>
                    <View style={styles.maintainCard}>
                        <Text style={styles.maintainTitle}>Maintain Current Weight</Text>
                        <Text style={styles.maintainDescription}>
                            Based on your profile, we recommend {calculatedCalories} calories per day to maintain your current weight.
                        </Text>
                    </View>
                </View>
            );
        }

        const options = mainGoal === 'lose' ? weightLossOptions : weightGainOptions;
        const selectedOption = options.find(option => option.id === detailedGoal);

        return (
            <View style={styles.detailedGoalsContainer}>
                <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => setShowFitnessGoalPicker(true)}
                >
                    <View style={styles.goalPickerContent}>
                        <Text style={styles.goalPickerLabel}>{selectedOption?.label || 'Select rate'}</Text>
                        <Text style={styles.goalPickerDescription}>{selectedOption?.description || ''}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={24} color="#0074dd" />
                </TouchableOpacity>

                <Modal
                    visible={showFitnessGoalPicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowFitnessGoalPicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select your target rate</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => setShowFitnessGoalPicker(false)}
                                >
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <WheelPicker
                                data={options}
                                selectedValue={detailedGoal}
                                onValueChange={(value) => {
                                    handleDetailedGoalSelect(value);
                                }}
                                containerStyle={styles.wheelPicker}
                            />

                            <TouchableOpacity
                                style={styles.modalDoneButton}
                                onPress={() => setShowFitnessGoalPicker(false)}
                            >
                                <Text style={styles.modalDoneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    };

    return (
        <ScrollView
            contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={[styles.title, { color: theme.colors.text }]}>Health & Fitness Goals</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Let's personalize your nutrition plan</Text>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activity Level</Text>
                <View style={[styles.activitySummary, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <Text style={[styles.activitySummaryLabel, { color: theme.colors.text }]}>
                        {activityLevels.find(level => level.id === profile.activityLevel)?.label || 'Moderately Active'}
                    </Text>
                    <Text style={[styles.activitySummaryDesc, { color: theme.colors.textSecondary }]}>
                        {activityLevels.find(level => level.id === profile.activityLevel)?.description || '3-5 days/week'}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>What's your goal?</Text>
                <View style={styles.mainGoalsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.mainGoalButton,
                            mainGoal === 'lose' && styles.selectedMainGoal
                        ]}
                        onPress={() => handleMainGoalSelect('lose')}
                    >
                        <LinearGradient
                            colors={mainGoal === 'lose' ? ["#0074dd", "#5c00dd"] : [theme.colors.cardBackground, theme.colors.cardBackground]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="trending-down" size={24} color={mainGoal === 'lose' ? "#fff" : theme.colors.textSecondary} />
                            <Text style={[styles.mainGoalText, { color: theme.colors.text }, mainGoal === 'lose' && styles.selectedMainGoalText]}>
                                Lose Weight
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.mainGoalButton,
                            mainGoal === 'maintain' && styles.selectedMainGoal
                        ]}
                        onPress={() => handleMainGoalSelect('maintain')}
                    >
                        <LinearGradient
                            colors={mainGoal === 'maintain' ? ["#0074dd", "#5c00dd"] : [theme.colors.cardBackground, theme.colors.cardBackground]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="remove" size={24} color={mainGoal === 'maintain' ? "#fff" : theme.colors.textSecondary} />
                            <Text style={[styles.mainGoalText, { color: theme.colors.text }, mainGoal === 'maintain' && styles.selectedMainGoalText]}>
                                Maintain
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.mainGoalButton,
                            mainGoal === 'gain' && styles.selectedMainGoal
                        ]}
                        onPress={() => handleMainGoalSelect('gain')}
                    >
                        <LinearGradient
                            colors={mainGoal === 'gain' ? ["#0074dd", "#5c00dd"] : [theme.colors.cardBackground, theme.colors.cardBackground]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="trending-up" size={24} color={mainGoal === 'gain' ? "#fff" : theme.colors.textSecondary} />
                            <Text style={[styles.mainGoalText, { color: theme.colors.text }, mainGoal === 'gain' && styles.selectedMainGoalText]}>
                                Gain Weight
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose your target rate</Text>
                {renderDetailedGoals()}
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Calculated daily targets</Text>
                <View style={[styles.calculatedContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <View style={styles.calorieCard}>
                        <Text style={[styles.calorieValue, { color: theme.colors.text }]}>{calculatedCalories}</Text>
                        <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>Calories</Text>
                    </View>

                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#FF6B6B' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.protein || '-'}</Text>
                            </View>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Protein (g)</Text>
                        </View>

                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#4ECDC4' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.carbs || '-'}</Text>
                            </View>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Carbs (g)</Text>
                        </View>

                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#FFD166' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.fats || '-'}</Text>
                            </View>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Fats (g)</Text>
                        </View>
                    </View>

                    <Text style={[styles.nutrientNote, { color: theme.colors.textSecondary }]}>
                        These values are calculated based on your profile and goals.
                        You can adjust them later in your settings.
                    </Text>
                </View>
            </View>


            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cheat Day Preferences</Text>
                <Text style={styles.sectionSubtitle}>Set up your cheat day schedule to stay motivated</Text>

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
                            cheatDayEnabled && styles.toggleSwitchActive
                        ]}
                        onPress={() => setCheatDayEnabled(!cheatDayEnabled)}
                    >
                        <View
                            style={[
                                styles.toggleKnob,
                                cheatDayEnabled && styles.toggleKnobActive
                            ]}
                        />
                    </TouchableOpacity>
                </View>

                {cheatDayEnabled && (
                    <>
                        <View style={styles.cheatDayFrequencyContainer}>
                            <Text style={styles.cheatDayFrequencyTitle}>Cheat Day Frequency</Text>
                            <View style={styles.frequencyOptionsContainer}>
                                {frequencyOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.frequencyOption,
                                            cheatDayFrequency === option.days && styles.selectedFrequencyOption
                                        ]}
                                        onPress={() => setCheatDayFrequency(option.days)}
                                    >
                                        <Text
                                            style={[
                                                styles.frequencyOptionText,
                                                cheatDayFrequency === option.days && styles.selectedFrequencyOptionText
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.cheatDayFrequencyDescription}>
                                {cheatDayFrequency === 7 && "You'll have a cheat day weekly (every 7 days) with 300-500 extra calories"}
                                {cheatDayFrequency === 14 && "You'll have a cheat day biweekly (every 14 days) with 600-900 extra calories"}
                                {cheatDayFrequency === 30 && "You'll have a cheat day monthly (every 30 days) with 1200-2000 extra calories"}
                            </Text>
                        </View>

                        <View style={styles.cheatDayFrequencyContainer}>
                            <Text style={styles.cheatDayFrequencyTitle}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={styles.daySelector}
                                onPress={() => setShowPreferredDayPicker(true)}
                            >
                                <Text style={styles.daySelectorText}>
                                    {preferredCheatDayOfWeek !== undefined
                                        ? dayNames[preferredCheatDayOfWeek]
                                        : 'From Today (Flexible)'
                                    }
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.dayHintText}>
                                {preferredCheatDayOfWeek !== undefined
                                    ? `Your cheat days will always fall on ${dayNames[preferredCheatDayOfWeek]}s`
                                    : 'Choose a specific day of the week for your cheat days, or leave flexible'
                                }
                            </Text>
                        </View>
                    </>
                )}
            </View>

            <View style={[styles.section, styles.submitSection]}>
                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#0074dd', '#5c00dd']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.submitButtonGradient}
                    >
                        <Text style={styles.submitButtonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Preferred Day Picker Modal */}
            <Modal
                visible={showPreferredDayPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPreferredDayPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowPreferredDayPicker(false)}
                            >
                                <Ionicons name="close" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.dayList}>
                            {dayPickerData.map((day, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.dayOption, preferredCheatDayOfWeek === day.value && styles.selectedDay]}
                                    onPress={() => {
                                        setPreferredCheatDayOfWeek(day.value);
                                        setShowPreferredDayPicker(false);
                                    }}
                                >
                                    <Text style={[styles.dayText, preferredCheatDayOfWeek === day.value && styles.selectedDayText]}>
                                        {day.label}
                                    </Text>
                                    {preferredCheatDayOfWeek === day.value && <Ionicons name="checkmark" size={20} color="#0074dd" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 100, // Extra padding at bottom to ensure all content is visible
        paddingTop: Platform.OS === 'ios' ? 0 : 20, // Add padding for Android
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 32,
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 16,
    },
    mainGoalsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    mainGoalButton: {
        flex: 1,
        height: 90,
        borderRadius: 12,
        overflow: 'hidden',
        marginHorizontal: 4,
    },
    selectedMainGoal: {
        borderWidth: 2,
        borderColor: '#0074dd',
    },
    mainGoalGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    mainGoalText: {
        fontSize: 14,
        color: '#ccc',
        marginTop: 8,
        textAlign: 'center',
    },
    selectedMainGoalText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    detailedGoalsContainer: {
        marginBottom: 8,
    },
    goalPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.5)',
    },
    goalPickerContent: {
        flex: 1,
    },
    goalPickerLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    goalPickerDescription: {
        fontSize: 12,
        color: '#aaa',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalCloseButton: {
        padding: 5,
    },
    modalDoneButton: {
        backgroundColor: '#0074dd',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    modalDoneButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    wheelPicker: {
        alignSelf: 'center',
        width: '90%',
        borderRadius: 15,
    },
    activitySummary: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.5)',
    },
    activitySummaryLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    activitySummaryDesc: {
        fontSize: 14,
        color: '#aaa',
    },
    calculatedContainer: {
        alignItems: 'center',
    },
    calorieCard: {
        backgroundColor: 'rgba(0, 116, 221, 0.15)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    calorieValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    calorieLabel: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 4,
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 16,
    },
    macroItem: {
        alignItems: 'center',
        width: '30%',
    },
    macroCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    macroLabel: {
        fontSize: 12,
        color: '#aaa',
        textAlign: 'center',
    },
    nutrientNote: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
    },
    conditionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    conditionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 4,
        marginBottom: 8,
        minWidth: '45%',
    },
    selectedCondition: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    checkMark: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#0074dd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    conditionText: {
        color: '#ddd',
        fontSize: 14,
    },
    selectedConditionText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    submitSection: {
        marginTop: 20,
        backgroundColor: 'transparent',
    },
    submitButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    submitButtonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
    maintainContainer: {
        marginBottom: 8,
    },
    maintainCard: {
        padding: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.5)',
    },
    maintainTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    maintainDescription: {
        fontSize: 14,
        color: '#ddd',
    },
    cheatDayToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cheatDayToggleContent: {
        flex: 1,
    },
    cheatDayToggleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    cheatDayToggleDescription: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 12,
        lineHeight: 20,
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
        backgroundColor: '#5c00dd',
    },
    toggleKnob: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignSelf: 'flex-start',
    },
    toggleKnobActive: {
        alignSelf: 'flex-end',
    },
    cheatDayFrequencyContainer: {
        marginTop: 16,
    },
    cheatDayFrequencyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    frequencyOptionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    frequencyOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginRight: 8,
        marginBottom: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    selectedFrequencyOption: {
        backgroundColor: '#5c00dd',
    },
    frequencyOptionText: {
        color: '#aaa',
        fontSize: 14,
        fontWeight: '600',
    },
    selectedFrequencyOptionText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    cheatDayFrequencyDescription: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 12,
        lineHeight: 20,
    },
    preferredDayContainer: {
        marginTop: 16,
    },
    daySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    daySelectorText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    dayHintText: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 12,
        lineHeight: 20,
    },
    dayList: {
        maxHeight: 300,
    },
    dayOption: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectedDay: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderBottomColor: '#0074dd',
    },
    dayText: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    selectedDayText: {
        color: '#0074dd',
        fontWeight: '600',
    },
});

export default HealthGoalsStep; 