import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface LifestyleHabitsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const sleepOptions = [
    { id: 'poor', label: 'Poor (4-5 hrs)', icon: 'moon-outline' },
    { id: 'fair', label: 'Fair (5-6 hrs)', icon: 'partly-sunny-outline' },
    { id: 'good', label: 'Good (6-7 hrs)', icon: 'sunny-outline' },
    { id: 'excellent', label: 'Excellent (7-9 hrs)', icon: 'star-outline' },
];

const stressLevels = [
    { id: 'low', label: 'Low Stress', color: '#4CAF50' },
    { id: 'moderate', label: 'Moderate Stress', color: '#FF9800' },
    { id: 'high', label: 'High Stress', color: '#F44336' },
];

const eatingHabits = [
    { id: 'regular_meals', label: 'Regular 3 meals', icon: 'restaurant-outline' },
    { id: 'frequent_small', label: 'Frequent small meals', icon: 'apps-outline' },
    { id: 'intermittent_fasting', label: 'Intermittent fasting', icon: 'time-outline' },
    { id: 'irregular_schedule', label: 'Irregular schedule', icon: 'shuffle-outline' },
];

const motivationReasons = [
    { id: 'health', label: 'Improve Health', icon: 'heart-outline' },
    { id: 'confidence', label: 'Boost Confidence', icon: 'happy-outline' },
    { id: 'energy', label: 'Increase Energy', icon: 'flash-outline' },
    { id: 'appearance', label: 'Look Better', icon: 'eye-outline' },
    { id: 'performance', label: 'Athletic Performance', icon: 'trophy-outline' },
    { id: 'medical', label: 'Medical Reasons', icon: 'medical-outline' },
];

const fitnessGoals = [
    { id: 'step_goal', label: 'Daily Steps', placeholder: '10000', unit: 'steps' },
    { id: 'water_goal', label: 'Water Intake', placeholder: '2000', unit: 'ml' },
    { id: 'workout_frequency', label: 'Workouts per Week', placeholder: '3', unit: 'times' },
    { id: 'sleep_goal', label: 'Sleep Hours', placeholder: '8', unit: 'hours' },
];

const LifestyleHabitsStep: React.FC<LifestyleHabitsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [sleepQuality, setSleepQuality] = useState(profile.sleepQuality || '');
    const [stressLevel, setStressLevel] = useState(profile.stressLevel || '');
    const [eatingPattern, setEatingPattern] = useState(profile.eatingPattern || '');
    const [motivations, setMotivations] = useState<string[]>(profile.motivations || []);
    const [whyMotivation, setWhyMotivation] = useState(profile.whyMotivation || '');

    // Fitness goals
    const [stepGoal, setStepGoal] = useState(profile.stepGoal?.toString() || '10000');
    const [waterGoal, setWaterGoal] = useState(profile.waterGoal?.toString() || '2000');
    const [workoutFrequency, setWorkoutFrequency] = useState(profile.workoutFrequency?.toString() || '3');
    const [sleepGoal, setSleepGoal] = useState(profile.sleepGoal?.toString() || '8');

    const toggleMotivation = (motivationId: string) => {
        setMotivations(prev =>
            prev.includes(motivationId)
                ? prev.filter(id => id !== motivationId)
                : [...prev, motivationId]
        );
    };

    const handleNext = async () => {
        await updateProfile({
            sleepQuality,
            stressLevel,
            eatingPattern,
            motivations,
            whyMotivation,
            stepGoal: stepGoal ? parseInt(stepGoal) : null,
            waterGoal: waterGoal ? parseInt(waterGoal) : null,
            workoutFrequency: workoutFrequency ? parseInt(workoutFrequency) : null,
            sleepGoal: sleepGoal ? parseInt(sleepGoal) : null,
        });
        onNext();
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.title}>Lifestyle & Motivation</Text>
            <Text style={styles.subtitle}>Help us understand your habits and what drives you</Text>

            {/* Sleep Quality */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sleep Quality</Text>
                <View style={styles.optionsGrid}>
                    {sleepOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionCard,
                                sleepQuality === option.id && styles.selectedOption
                            ]}
                            onPress={() => setSleepQuality(option.id)}
                        >
                            <Ionicons
                                name={option.icon as any}
                                size={24}
                                color={sleepQuality === option.id ? '#0074dd' : '#999'}
                            />
                            <Text style={[
                                styles.optionText,
                                sleepQuality === option.id && styles.selectedOptionText
                            ]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Stress Level */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stress Level</Text>
                <View style={styles.optionsRow}>
                    {stressLevels.map((level) => (
                        <TouchableOpacity
                            key={level.id}
                            style={[
                                styles.stressOption,
                                stressLevel === level.id && { borderColor: level.color }
                            ]}
                            onPress={() => setStressLevel(level.id)}
                        >
                            <View style={[
                                styles.stressIndicator,
                                { backgroundColor: level.color },
                                stressLevel === level.id && styles.selectedStressIndicator
                            ]} />
                            <Text style={[
                                styles.optionText,
                                stressLevel === level.id && { color: level.color }
                            ]}>
                                {level.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Eating Patterns */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Eating Pattern</Text>
                <View style={styles.optionsGrid}>
                    {eatingHabits.map((habit) => (
                        <TouchableOpacity
                            key={habit.id}
                            style={[
                                styles.optionCard,
                                eatingPattern === habit.id && styles.selectedOption
                            ]}
                            onPress={() => setEatingPattern(habit.id)}
                        >
                            <Ionicons
                                name={habit.icon as any}
                                size={24}
                                color={eatingPattern === habit.id ? '#0074dd' : '#999'}
                            />
                            <Text style={[
                                styles.optionText,
                                eatingPattern === habit.id && styles.selectedOptionText
                            ]}>
                                {habit.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Motivation Reasons */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>What motivates you? (Select all that apply)</Text>
                <View style={styles.motivationGrid}>
                    {motivationReasons.map((reason) => (
                        <TouchableOpacity
                            key={reason.id}
                            style={[
                                styles.motivationCard,
                                motivations.includes(reason.id) && styles.selectedMotivation
                            ]}
                            onPress={() => toggleMotivation(reason.id)}
                        >
                            <Ionicons
                                name={reason.icon as any}
                                size={20}
                                color={motivations.includes(reason.id) ? '#0074dd' : '#999'}
                            />
                            <Text style={[
                                styles.motivationText,
                                motivations.includes(reason.id) && styles.selectedMotivationText
                            ]}>
                                {reason.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Why Question */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's your deeper "why"?</Text>
                <Text style={styles.sectionSubtitle}>This will help us motivate you during tough moments</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Example: I want to be healthy and energetic for my kids..."
                    placeholderTextColor="#666"
                    value={whyMotivation}
                    onChangeText={setWhyMotivation}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                />
            </View>

            {/* Fitness Goals */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fitness Goals</Text>
                <Text style={styles.sectionSubtitle}>Set specific targets to track your progress</Text>

                {fitnessGoals.map((goal) => (
                    <View key={goal.id} style={styles.goalItem}>
                        <Text style={styles.goalLabel}>{goal.label}</Text>
                        <View style={styles.goalInputContainer}>
                            <TextInput
                                style={styles.goalInput}
                                placeholder={goal.placeholder}
                                placeholderTextColor="#666"
                                value={
                                    goal.id === 'step_goal' ? stepGoal :
                                        goal.id === 'water_goal' ? waterGoal :
                                            goal.id === 'workout_frequency' ? workoutFrequency :
                                                sleepGoal
                                }
                                onChangeText={(value) => {
                                    if (goal.id === 'step_goal') setStepGoal(value);
                                    else if (goal.id === 'water_goal') setWaterGoal(value);
                                    else if (goal.id === 'workout_frequency') setWorkoutFrequency(value);
                                    else setSleepGoal(value);
                                }}
                                keyboardType="numeric"
                            />
                            <Text style={styles.goalUnit}>{goal.unit}</Text>
                        </View>
                    </View>
                ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 40,
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
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 16,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    optionCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedOption: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    optionText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    selectedOptionText: {
        color: '#0074dd',
        fontWeight: '600',
    },
    stressOption: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    stressIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginBottom: 8,
    },
    selectedStressIndicator: {
        transform: [{ scale: 1.2 }],
    },
    motivationGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    motivationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedMotivation: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    motivationText: {
        color: '#fff',
        fontSize: 14,
        marginLeft: 8,
    },
    selectedMotivationText: {
        color: '#0074dd',
        fontWeight: '600',
    },
    textArea: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 100,
    },
    goalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    goalLabel: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    goalInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    goalInput: {
        color: '#fff',
        fontSize: 16,
        paddingVertical: 12,
        minWidth: 60,
        textAlign: 'center',
    },
    goalUnit: {
        color: '#999',
        fontSize: 14,
        marginLeft: 8,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 16,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default LifestyleHabitsStep; 