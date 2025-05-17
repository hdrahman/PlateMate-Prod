import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

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

const HealthGoalsStep: React.FC<HealthGoalsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [mainGoal, setMainGoal] = useState<'lose' | 'maintain' | 'gain'>(
        profile.weightGoal?.startsWith('lose') ? 'lose' :
            profile.weightGoal?.startsWith('gain') ? 'gain' : 'maintain'
    );
    const [detailedGoal, setDetailedGoal] = useState<string>(profile.weightGoal || 'maintain');
    const [selectedConditions, setSelectedConditions] = useState<string[]>(profile.healthConditions || []);
    const [calculatedCalories, setCalculatedCalories] = useState<number>(0);
    const [calculatedNutrients, setCalculatedNutrients] = useState<any>({});

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
            case 'extreme':
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

        // Ensure minimum calories
        const minCalories = profile.gender === 'male' ? 1500 : 1200;
        tdee = Math.max(tdee, minCalories);

        setCalculatedCalories(tdee);

        // Calculate macronutrient distribution based on goal
        let proteinPct, carbsPct, fatPct;

        if (mainGoal === 'lose') {
            proteinPct = 0.30; // Higher protein for weight loss (preserve muscle)
            carbsPct = 0.40;
            fatPct = 0.30;
        } else if (mainGoal === 'gain') {
            proteinPct = 0.25; // Balanced for muscle gain
            carbsPct = 0.50; // Higher carbs for energy
            fatPct = 0.25;
        } else { // maintain
            proteinPct = 0.25;
            carbsPct = 0.45;
            fatPct = 0.30;
        }

        // Calculate macros in grams
        // 1g protein = 4 calories, 1g carbs = 4 calories, 1g fat = 9 calories
        const proteinG = Math.round((tdee * proteinPct) / 4);
        const carbsG = Math.round((tdee * carbsPct) / 4);
        const fatG = Math.round((tdee * fatPct) / 9);
        const fiberG = Math.round(14 * (tdee / 1000)); // ~14g per 1000 calories

        // Calculate other nutrients
        const sugarsG = Math.min(Math.round(tdee * 0.10 / 4), 50); // max 50g
        const sodiumMg = 2300; // Standard recommendation

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
        });
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

        return (
            <View style={styles.detailedGoalsContainer}>
                {options.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.detailedGoalCard,
                            detailedGoal === option.id && styles.selectedDetailedGoal
                        ]}
                        onPress={() => handleDetailedGoalSelect(option.id)}
                    >
                        <View style={styles.detailedGoalContent}>
                            <Text style={[
                                styles.detailedGoalLabel,
                                detailedGoal === option.id && styles.selectedDetailedGoalText
                            ]}>
                                {option.label}
                            </Text>
                            <Text style={styles.detailedGoalDescription}>{option.description}</Text>
                        </View>
                        {detailedGoal === option.id && (
                            <View style={styles.checkIcon}>
                                <Ionicons name="checkmark-circle" size={20} color="#0074dd" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
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
    detailedGoalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 8,
    },
    selectedDetailedGoal: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    detailedGoalContent: {
        flex: 1,
    },
    detailedGoalLabel: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 4,
    },
    detailedGoalDescription: {
        fontSize: 12,
        color: '#aaa',
    },
    selectedDetailedGoalText: {
        fontWeight: 'bold',
    },
    checkIcon: {
        marginLeft: 8,
    },
    maintainContainer: {
        marginBottom: 8,
    },
    maintainCard: {
        padding: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
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
});

export default HealthGoalsStep; 