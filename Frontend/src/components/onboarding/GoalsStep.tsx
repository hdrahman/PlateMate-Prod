import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface GoalsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: (selectedGoal?: string) => void;
}

const GoalsStep: React.FC<GoalsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [fitnessGoal, setFitnessGoal] = useState<string>(profile.fitnessGoal || 'fat_loss');

    useEffect(() => {
        setFitnessGoal(profile.fitnessGoal || 'fat_loss');
    }, [profile.fitnessGoal]);

    // Fitness goals
    const fitnessGoals = [
        {
            id: 'fat_loss',
            label: 'Weight Loss',
            description: 'Reduce body fat while maintaining muscle',
            icon: 'flame',
            color: '#ff6b35',
        },
        {
            id: 'balanced',
            label: 'Body Recomposition',
            description: 'Lose fat and build muscle simultaneously',
            icon: 'sync',
            color: '#0074dd',
        },
        {
            id: 'muscle_gain',
            label: 'Muscle Gain',
            description: 'Build lean muscle mass and strength',
            icon: 'barbell',
            color: '#28a745',
        },
    ];

    const handleSubmit = async () => {
        try {
            await updateProfile({ fitnessGoal });
            onNext(fitnessGoal);
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>What's Your Goal?</Text>
                <Text style={styles.subtitle}>Choose your primary fitness objective</Text>
            </View>

            <View style={styles.goalsContainer}>
                {fitnessGoals.map((goal) => (
                    <TouchableOpacity
                        key={goal.id}
                        style={[
                            styles.goalCard,
                            fitnessGoal === goal.id && styles.selectedGoal,
                            fitnessGoal === goal.id && { borderColor: goal.color }
                        ]}
                        onPress={() => {
                            setFitnessGoal(goal.id);
                            // Persist selection immediately
                            updateProfile({ fitnessGoal: goal.id }).catch(console.error);
                        }}
                    >
                        <View style={styles.goalLogoContainer}>
                            <View style={[styles.goalIcon, { backgroundColor: `${goal.color}20` }]}>
                                <Ionicons
                                    name={goal.icon as any}
                                    size={32}
                                    color={fitnessGoal === goal.id ? goal.color : '#666'}
                                />
                            </View>
                        </View>
                        <View style={styles.goalContent}>
                            <Text style={[
                                styles.goalLabel,
                                fitnessGoal === goal.id && { color: goal.color }
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
                            <Ionicons name="checkmark-circle" size={24} color={goal.color} style={styles.checkIcon} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 20,
        paddingBottom: 40,
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
    goalsContainer: {
        marginBottom: 40,
    },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedGoal: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    goalIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 20,
    },
    goalLogoContainer: {
        marginRight: 20,
    },
    goalLogo: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    goalContent: {
        flex: 1,
    },
    goalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 6,
    },
    selectedGoalText: {
        color: '#fff',
    },
    goalDescription: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 20,
    },
    selectedGoalDescription: {
        color: '#ddd',
    },
    checkIcon: {
        marginLeft: 10,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginHorizontal: 20,
        marginTop: 20,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default GoalsStep; 