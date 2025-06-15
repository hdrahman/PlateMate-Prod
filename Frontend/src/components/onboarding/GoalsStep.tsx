import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface GoalsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const GoalsStep: React.FC<GoalsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [fitnessGoal, setFitnessGoal] = useState<string>(profile.fitnessGoal || 'balanced');
    const [dailyCalorieTarget, setDailyCalorieTarget] = useState<string>(
        profile.dailyCalorieTarget?.toString() || ''
    );

    // Fitness goals
    const fitnessGoals = [
        {
            id: 'fat_loss',
            label: 'Fat Loss',
            description: 'Reduce body fat while maintaining muscle',
            icon: 'flame',
            color: '#ff6b35',
        },
        {
            id: 'balanced',
            label: 'Balanced Health',
            description: 'Maintain overall health and wellness',
            icon: 'fitness',
            color: '#0074dd',
        },
        {
            id: 'muscle_gain',
            label: 'Muscle Gain',
            description: 'Build lean muscle mass and strength',
            icon: 'dumbbell',
            color: '#28a745',
        },
        {
            id: 'endurance',
            label: 'Endurance',
            description: 'Improve cardiovascular fitness',
            icon: 'bicycle',
            color: '#6f42c1',
        },
    ];

    // Calculate suggested calorie target based on profile
    const calculateSuggestedCalories = () => {
        if (!profile.weight || !profile.height || !profile.age || !profile.gender) {
            return 2000; // Default fallback
        }

        // Basic BMR calculation using Mifflin-St Jeor Equation
        let bmr;
        if (profile.gender === 'male') {
            bmr = 88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age);
        } else {
            bmr = 447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age);
        }

        // Activity level multipliers
        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            extreme: 1.9,
        };

        const multiplier = activityMultipliers[profile.activityLevel as keyof typeof activityMultipliers] || 1.55;
        let tdee = bmr * multiplier;

        // Adjust based on weight goal
        if (profile.weightGoal === 'lose') {
            tdee -= 500; // 500 calorie deficit for ~1lb/week loss
        } else if (profile.weightGoal === 'gain') {
            tdee += 300; // 300 calorie surplus for gradual gain
        }

        return Math.round(tdee);
    };

    const suggestedCalories = calculateSuggestedCalories();

    useEffect(() => {
        if (!dailyCalorieTarget) {
            setDailyCalorieTarget(suggestedCalories.toString());
        }
    }, [suggestedCalories]);

    const handleSubmit = async () => {
        try {
            const calorieTarget = dailyCalorieTarget ? parseInt(dailyCalorieTarget) : suggestedCalories;

            console.log('🎯 GoalsStep - Saving goals:', {
                fitnessGoal,
                dailyCalorieTarget: calorieTarget,
                calculatedCalories: suggestedCalories,
                userProfile: {
                    height: profile.height,
                    weight: profile.weight,
                    age: profile.age,
                    gender: profile.gender,
                    activityLevel: profile.activityLevel
                }
            });

            await updateProfile({
                fitnessGoal,
                dailyCalorieTarget: calorieTarget,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Your Goals</Text>
                <Text style={styles.subtitle}>Define your fitness objectives</Text>
            </View>

            <View style={styles.form}>
                {/* Fitness Goal Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Primary Focus</Text>
                    <Text style={styles.sectionSubtitle}>What's your main fitness objective?</Text>

                    <View style={styles.goalsContainer}>
                        {fitnessGoals.map((goal) => (
                            <TouchableOpacity
                                key={goal.id}
                                style={[
                                    styles.goalCard,
                                    fitnessGoal === goal.id && styles.selectedGoal
                                ]}
                                onPress={() => setFitnessGoal(goal.id)}
                            >
                                <View style={[styles.goalIcon, { backgroundColor: `${goal.color}20` }]}>
                                    <MaterialCommunityIcons
                                        name={goal.icon as any}
                                        size={24}
                                        color={fitnessGoal === goal.id ? goal.color : '#666'}
                                    />
                                </View>
                                <View style={styles.goalContent}>
                                    <Text style={[
                                        styles.goalLabel,
                                        fitnessGoal === goal.id && styles.selectedGoalText
                                    ]}>
                                        {goal.label}
                                    </Text>
                                    <Text style={[
                                        styles.goalDescription,
                                        fitnessGoal === goal.id && styles.selectedGoalDescription
                                    ]}>
                                        {goal.description}
                                    </Text>
                                </View>
                                {fitnessGoal === goal.id && (
                                    <Ionicons name="checkmark-circle" size={20} color={goal.color} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Daily Calorie Target */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Daily Calorie Target</Text>
                    <Text style={styles.sectionSubtitle}>
                        Based on your profile, we suggest {suggestedCalories} calories/day
                    </Text>

                    <View style={styles.calorieInputContainer}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder={suggestedCalories.toString()}
                                placeholderTextColor="#666"
                                value={dailyCalorieTarget}
                                onChangeText={setDailyCalorieTarget}
                                keyboardType="numeric"
                            />
                            <Text style={styles.inputSuffix}>cal/day</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.suggestedButton}
                            onPress={() => setDailyCalorieTarget(suggestedCalories.toString())}
                        >
                            <Text style={styles.suggestedButtonText}>Use Suggested</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.calorieInfo}>
                        <Ionicons name="information-circle-outline" size={16} color="#888" />
                        <Text style={styles.calorieInfoText}>
                            You can always adjust this later based on your progress
                        </Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Complete Setup</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        lineHeight: 22,
    },
    form: {
        flex: 1,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 16,
    },
    goalsContainer: {
        gap: 12,
    },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
    },
    selectedGoal: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    goalIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    goalContent: {
        flex: 1,
    },
    goalLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedGoalText: {
        color: '#fff',
    },
    goalDescription: {
        fontSize: 14,
        color: '#888',
    },
    selectedGoalDescription: {
        color: '#aaa',
    },
    calorieInputContainer: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 52,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    inputSuffix: {
        color: '#888',
        fontSize: 14,
        marginLeft: 8,
    },
    suggestedButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
        borderRadius: 8,
    },
    suggestedButtonText: {
        color: '#0074dd',
        fontSize: 14,
        fontWeight: '600',
    },
    calorieInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    calorieInfoText: {
        flex: 1,
        color: '#888',
        fontSize: 13,
        lineHeight: 18,
    },
    button: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 20,
    },
    buttonGradient: {
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default GoalsStep; 