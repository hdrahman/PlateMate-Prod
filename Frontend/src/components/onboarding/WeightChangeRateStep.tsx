import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface WeightChangeRateStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const WeightChangeRateStep: React.FC<WeightChangeRateStepProps> = ({ profile, updateProfile, onNext }) => {
    const [weightGoal, setWeightGoal] = useState<string>(profile.weightGoal || 'maintain');
    const [cheatDayEnabled, setCheatDayEnabled] = useState<boolean>(profile.cheatDayEnabled !== false);
    const [cheatDayFrequency, setCheatDayFrequency] = useState<number>(profile.cheatDayFrequency || 7);
    const [preferredCheatDay, setPreferredCheatDay] = useState<number>(profile.preferredCheatDayOfWeek || 6); // Default to Saturday

    // Set appropriate weight goal based on fitness goal
    useEffect(() => {
        if (profile.fitnessGoal) {
            if (profile.fitnessGoal === 'fat_loss') {
                setWeightGoal('lose_0_5'); // Default to moderate weight loss
            } else if (profile.fitnessGoal === 'muscle_gain') {
                setWeightGoal('gain_0_25'); // Default to moderate weight gain
            } else {
                setWeightGoal('maintain'); // Default to maintain for balanced
            }
        }
    }, [profile.fitnessGoal]);

    // Weight goal options based on fitness goal
    const getWeightGoalOptions = () => {
        if (profile.fitnessGoal === 'fat_loss') {
            return [
                { id: 'lose_1', label: 'Aggressive', description: 'Lose 1kg per week', color: '#ff6b35', icon: 'flash' },
                { id: 'lose_0_75', label: 'Moderate-High', description: 'Lose 0.75kg per week', color: '#ff9f1c', icon: 'trending-down' },
                { id: 'lose_0_5', label: 'Moderate', description: 'Lose 0.5kg per week', color: '#ffbf69', icon: 'remove-circle' },
                { id: 'lose_0_25', label: 'Gentle', description: 'Lose 0.25kg per week', color: '#8ac926', icon: 'leaf' },
            ];
        } else if (profile.fitnessGoal === 'muscle_gain') {
            return [
                { id: 'gain_0_5', label: 'Aggressive', description: 'Gain 0.5kg per week', color: '#28a745', icon: 'trending-up' },
                { id: 'gain_0_25', label: 'Moderate', description: 'Gain 0.25kg per week', color: '#8ac926', icon: 'add-circle' },
            ];
        } else {
            // Balanced/recomp
            return [
                { id: 'lose_0_25', label: 'Slight Deficit', description: 'Lose 0.25kg per week', color: '#8ac926', icon: 'arrow-down' },
                { id: 'maintain', label: 'Maintain', description: 'Keep current weight', color: '#0074dd', icon: 'swap-horizontal' },
                { id: 'gain_0_25', label: 'Slight Surplus', description: 'Gain 0.25kg per week', color: '#8ac926', icon: 'arrow-up' },
            ];
        }
    };

    const getDayName = (dayIndex: number): string => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayIndex];
    };

    const handleCheatDayFrequencyChange = (increase: boolean) => {
        setCheatDayFrequency(prev => {
            if (increase && prev < 14) {
                return prev + 1;
            } else if (!increase && prev > 1) {
                return prev - 1;
            }
            return prev;
        });
    };

    const handleCheatDayChange = (dayIndex: number) => {
        setPreferredCheatDay(dayIndex);
    };

    const handleSubmit = async () => {
        try {
            await updateProfile({
                weightGoal,
                cheatDayEnabled,
                cheatDayFrequency,
                preferredCheatDayOfWeek: preferredCheatDay,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Set Your Pace</Text>
                <Text style={styles.subtitle}>
                    Based on your goal of "{profile.fitnessGoal === 'fat_loss' ? 'weight loss' :
                        profile.fitnessGoal === 'muscle_gain' ? 'muscle gain' : 'balanced fitness'}",
                    choose a comfortable rate of progress
                </Text>
            </View>

            <View style={styles.rateContainer}>
                {getWeightGoalOptions().map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.rateCard,
                            weightGoal === option.id && styles.selectedRate,
                            weightGoal === option.id && { borderColor: option.color }
                        ]}
                        onPress={() => setWeightGoal(option.id)}
                    >
                        <View style={[styles.rateIconContainer, { backgroundColor: `${option.color}20` }]}>
                            <Ionicons
                                name={option.icon as any}
                                size={24}
                                color={option.color}
                            />
                        </View>
                        <View style={styles.rateContent}>
                            <Text style={[
                                styles.rateLabel,
                                weightGoal === option.id && { color: option.color }
                            ]}>
                                {option.label}
                            </Text>
                            <Text style={[
                                styles.rateDescription,
                                weightGoal === option.id && styles.selectedRateDescription
                            ]}>
                                {option.description}
                            </Text>
                        </View>
                        {weightGoal === option.id && (
                            <Ionicons name="checkmark-circle" size={24} color={option.color} style={styles.checkIcon} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#0074dd" />
                <Text style={styles.infoText}>
                    Your pace determines how aggressive your calorie deficit or surplus will be.
                    Slower rates are more sustainable long-term.
                </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.cheatDaySection}>
                <View style={styles.cheatDayHeader}>
                    <Text style={styles.sectionTitle}>Cheat Day Options</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#0074dd' }}
                        thumbColor={cheatDayEnabled ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => setCheatDayEnabled(!cheatDayEnabled)}
                        value={cheatDayEnabled}
                    />
                </View>

                {cheatDayEnabled && (
                    <>
                        <Text style={styles.cheatDayDescription}>
                            Cheat days can help maintain motivation and make your plan more sustainable
                        </Text>

                        <View style={styles.daySelectionContainer}>
                            <Text style={styles.daySelectionLabel}>Preferred day:</Text>
                            <View style={styles.daysContainer}>
                                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                                    <TouchableOpacity
                                        key={dayIndex}
                                        style={[
                                            styles.dayButton,
                                            preferredCheatDay === dayIndex && styles.selectedDay
                                        ]}
                                        onPress={() => handleCheatDayChange(dayIndex)}
                                    >
                                        <Text
                                            style={[
                                                styles.dayText,
                                                preferredCheatDay === dayIndex && styles.selectedDayText
                                            ]}
                                        >
                                            {getDayName(dayIndex).substring(0, 3)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#888" />
                <Text style={styles.infoText}>
                    You can always adjust these settings later in your profile
                </Text>
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
    rateContainer: {
        marginBottom: 30,
    },
    rateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedRate: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    rateIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    rateContent: {
        flex: 1,
    },
    rateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    rateDescription: {
        fontSize: 14,
        color: '#aaa',
    },
    selectedRateDescription: {
        color: '#fff',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 24,
        marginHorizontal: 20,
    },
    cheatDaySection: {
        marginBottom: 30,
        marginHorizontal: 20,
    },
    cheatDayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    cheatDayDescription: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
        lineHeight: 20,
    },
    daySelectionContainer: {
        marginBottom: 16,
    },
    daySelectionLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: '13%',
        aspectRatio: 1,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    selectedDay: {
        backgroundColor: '#0074dd',
    },
    dayText: {
        fontSize: 12,
        color: '#aaa',
        fontWeight: '500',
    },
    selectedDayText: {
        color: '#fff',
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginHorizontal: 20,
    },
    infoText: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 12,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginHorizontal: 20,
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
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
});

export default WeightChangeRateStep; 