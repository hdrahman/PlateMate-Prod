import React, { useState, useEffect, useRef } from 'react';
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

// Health conditions
const healthConditions = [
    { id: 'diabetes', label: 'Diabetes' },
    { id: 'hypertension', label: 'Hypertension' },
    { id: 'heart_disease', label: 'Heart Disease' },
    { id: 'high_cholesterol', label: 'High Cholesterol' },
    { id: 'celiac', label: 'Celiac Disease' },
    { id: 'ibs', label: 'IBS' },
    { id: 'acid_reflux', label: 'Acid Reflux' },
    { id: 'thyroid', label: 'Thyroid Condition' },
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
    const { user } = useAuth();
    const [mainGoal, setMainGoal] = useState<'lose' | 'maintain' | 'gain'>(
        profile.weightGoal?.startsWith('lose') ? 'lose' :
            profile.weightGoal?.startsWith('gain') ? 'gain' : 'maintain'
    );
    const [detailedGoal, setDetailedGoal] = useState<string>(profile.weightGoal || 'maintain');
    const [selectedConditions, setSelectedConditions] = useState<string[]>(profile.healthConditions || []);
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
        // Calculate BMR using Mifflin-St Jeor Equation
        let bmr = 0;

        if (profile.gender === 'male') {
            bmr = 10 * profile.weight! + 6.25 * profile.height! - 5 * profile.age! + 5;
        } else {
            bmr = 10 * profile.weight! + 6.25 * profile.height! - 5 * profile.age! - 161;
        }

        // Activity multiplier
        let activityMultiplier = 1.2; // Sedentary

        switch (profile.activityLevel) {
            case 'light':
                activityMultiplier = 1.375;
                break;
            case 'moderate':
                activityMultiplier = 1.55;
                break;
            case 'active':
                activityMultiplier = 1.725;
                break;
            case 'very_active':
                activityMultiplier = 1.9;
                break;
        }

        // Calculate TDEE (Total Daily Energy Expenditure)
        let tdee = Math.round(bmr * activityMultiplier);

        // Adjust based on detailed goal
        if (detailedGoal.startsWith('lose')) {
            const option = weightLossOptions.find(opt => opt.id === detailedGoal);
            if (option) {
                tdee -= option.deficit;
            }
        } else if (detailedGoal.startsWith('gain')) {
            const option = weightGainOptions.find(opt => opt.id === detailedGoal);
            if (option) {
                tdee += option.surplus;
            }
        }

        // Removed minimum calorie constraint

        setCalculatedCalories(tdee);

        // Evidence-based macronutrient distribution (2024 nutrition guidelines)
        let proteinPct, carbsPct, fatPct;

        if (mainGoal === 'lose') {
            // Higher protein for muscle preservation during weight loss
            proteinPct = 0.30; // 25-35% protein range for weight loss
            carbsPct = 0.35; // Lower carbs to support fat loss
            fatPct = 0.35;   // Adequate fat for hormone production
        } else if (mainGoal === 'gain') {
            // Balanced for muscle gain with adequate energy
            proteinPct = 0.25; // 20-30% protein for muscle building
            carbsPct = 0.50;   // Higher carbs for training energy
            fatPct = 0.25;     // Moderate fat for calorie density
        } else { // maintain
            // Balanced approach for general health
            proteinPct = 0.25; // 20-35% protein for maintenance
            carbsPct = 0.45;   // 45-65% carbs for energy
            fatPct = 0.30;     // 20-35% fat for essential functions
        }

        // Calculate macros in grams
        // 1g protein = 4 calories, 1g carbs = 4 calories, 1g fat = 9 calories
        const proteinG = Math.round((tdee * proteinPct) / 4);
        const carbsG = Math.round((tdee * carbsPct) / 4);
        const fatG = Math.round((tdee * fatPct) / 9);

        // Evidence-based fiber recommendations (2024 dietary guidelines)
        // Men: 38g/day, Women: 25g/day (or 14g per 1000 calories)
        const fiberG = profile.gender === 'male' ? 38 : 25;

        // Added sugar recommendations (WHO/AHA guidelines)
        // <10% of total calories from added sugars (WHO), <6% ideal (AHA)
        const sugarsG = Math.round(tdee * 0.06 / 4); // 6% of calories as added sugars

        // Sodium recommendations based on health conditions and age
        let sodiumMg = 2300; // Standard adult recommendation
        if (selectedConditions.includes('hypertension') || selectedConditions.includes('heart_disease')) {
            sodiumMg = 1500; // Lower for cardiovascular conditions
        } else if (profile.age && profile.age > 50) {
            sodiumMg = 1500; // Lower for adults over 50
        }

        setCalculatedNutrients({
            protein: proteinG,
            carbs: carbsG,
            fats: fatG,
            fiber: fiberG,
            sugar: sugarsG,
            sodium: sodiumMg
        });
    };

    const toggleCondition = (id: string) => {
        if (selectedConditions.includes(id)) {
            setSelectedConditions(selectedConditions.filter(item => item !== id));
        } else {
            setSelectedConditions([...selectedConditions, id]);
        }
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
            healthConditions: selectedConditions,
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
                        <View style={styles.modalContent}>
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
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.title}>Health & Fitness Goals</Text>
            <Text style={styles.subtitle}>Let's personalize your nutrition plan</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Activity Level</Text>
                <View style={styles.activitySummary}>
                    <Text style={styles.activitySummaryLabel}>
                        {activityLevels.find(level => level.id === profile.activityLevel)?.label || 'Moderately Active'}
                    </Text>
                    <Text style={styles.activitySummaryDesc}>
                        {activityLevels.find(level => level.id === profile.activityLevel)?.description || '3-5 days/week'}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's your goal?</Text>
                <View style={styles.mainGoalsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.mainGoalButton,
                            mainGoal === 'lose' && styles.selectedMainGoal
                        ]}
                        onPress={() => handleMainGoalSelect('lose')}
                    >
                        <LinearGradient
                            colors={mainGoal === 'lose' ? ["#0074dd", "#5c00dd"] : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="trending-down" size={24} color={mainGoal === 'lose' ? "#fff" : "#888"} />
                            <Text style={[styles.mainGoalText, mainGoal === 'lose' && styles.selectedMainGoalText]}>
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
                            colors={mainGoal === 'maintain' ? ["#0074dd", "#5c00dd"] : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="remove" size={24} color={mainGoal === 'maintain' ? "#fff" : "#888"} />
                            <Text style={[styles.mainGoalText, mainGoal === 'maintain' && styles.selectedMainGoalText]}>
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
                            colors={mainGoal === 'gain' ? ["#0074dd", "#5c00dd"] : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"]}
                            style={styles.mainGoalGradient}
                        >
                            <Ionicons name="trending-up" size={24} color={mainGoal === 'gain' ? "#fff" : "#888"} />
                            <Text style={[styles.mainGoalText, mainGoal === 'gain' && styles.selectedMainGoalText]}>
                                Gain Weight
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose your target rate</Text>
                {renderDetailedGoals()}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Calculated daily targets</Text>
                <View style={styles.calculatedContainer}>
                    <View style={styles.calorieCard}>
                        <Text style={styles.calorieValue}>{calculatedCalories}</Text>
                        <Text style={styles.calorieLabel}>Calories</Text>
                    </View>

                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#FF6B6B' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.protein || '-'}</Text>
                            </View>
                            <Text style={styles.macroLabel}>Protein (g)</Text>
                        </View>

                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#4ECDC4' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.carbs || '-'}</Text>
                            </View>
                            <Text style={styles.macroLabel}>Carbs (g)</Text>
                        </View>

                        <View style={styles.macroItem}>
                            <View style={[styles.macroCircle, { backgroundColor: '#FFD166' }]}>
                                <Text style={styles.macroValue}>{calculatedNutrients.fats || '-'}</Text>
                            </View>
                            <Text style={styles.macroLabel}>Fats (g)</Text>
                        </View>
                    </View>

                    <Text style={styles.nutrientNote}>
                        These values are calculated based on your profile and goals.
                        You can adjust them later in your settings.
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Any health conditions?</Text>
                <Text style={styles.sectionSubtitle}>This helps us provide appropriate recommendations</Text>
                <View style={styles.conditionsGrid}>
                    {healthConditions.map((condition) => (
                        <TouchableOpacity
                            key={condition.id}
                            style={[
                                styles.conditionButton,
                                selectedConditions.includes(condition.id) && styles.selectedCondition
                            ]}
                            onPress={() => toggleCondition(condition.id)}
                        >
                            {selectedConditions.includes(condition.id) && (
                                <View style={styles.checkMark}>
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                </View>
                            )}
                            <Text
                                style={[
                                    styles.conditionText,
                                    selectedConditions.includes(condition.id) && styles.selectedConditionText
                                ]}
                            >
                                {condition.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
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
                    <View style={styles.modalContent}>
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
        backgroundColor: '#121212',
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