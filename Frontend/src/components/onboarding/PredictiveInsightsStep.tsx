import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface PredictiveInsightsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const { width } = Dimensions.get('window');

const PredictiveInsightsStep: React.FC<PredictiveInsightsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [projectedDate, setProjectedDate] = useState<string>('');
    const [metabolicAge, setMetabolicAge] = useState<number>(0);
    const [weeklyProgress, setWeeklyProgress] = useState<number>(0);
    const [estimatedDuration, setEstimatedDuration] = useState<number>(0);

    useEffect(() => {
        calculatePredictiveInsights();
    }, [profile]);

    const calculatePredictiveInsights = () => {
        if (!profile.weight || !profile.targetWeight || !profile.age) return;

        // Calculate weight difference
        const weightDifference = Math.abs(profile.weight - profile.targetWeight);

        // Determine weekly rate based on weight goal
        let weeklyRate = 0.5; // Default to 0.5kg per week
        if (profile.weightGoal?.includes('lose_1')) weeklyRate = 1.0;
        else if (profile.weightGoal?.includes('lose_0_75')) weeklyRate = 0.75;
        else if (profile.weightGoal?.includes('lose_0_5')) weeklyRate = 0.5;
        else if (profile.weightGoal?.includes('lose_0_25')) weeklyRate = 0.25;
        else if (profile.weightGoal?.includes('gain_0_25')) weeklyRate = 0.25;
        else if (profile.weightGoal?.includes('gain_0_5')) weeklyRate = 0.5;

        setWeeklyProgress(weeklyRate);

        // Calculate estimated duration in weeks
        const weeks = Math.ceil(weightDifference / weeklyRate);
        setEstimatedDuration(weeks);

        // Calculate projected completion date
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + (weeks * 7));
        setProjectedDate(projectedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));

        // Calculate metabolic age based on multiple factors
        const baseAge = profile.age;
        let metabolicAgeModifier = 0;

        // Activity level adjustment
        if (profile.activityLevel === 'sedentary') metabolicAgeModifier += 5;
        else if (profile.activityLevel === 'light') metabolicAgeModifier += 2;
        else if (profile.activityLevel === 'moderate') metabolicAgeModifier += 0;
        else if (profile.activityLevel === 'active') metabolicAgeModifier -= 3;
        else if (profile.activityLevel === 'extreme') metabolicAgeModifier -= 5;

        // BMI adjustment
        if (profile.height) {
            const bmi = profile.weight / Math.pow(profile.height / 100, 2);
            if (bmi < 18.5) metabolicAgeModifier += 2;
            else if (bmi > 25 && bmi < 30) metabolicAgeModifier += 3;
            else if (bmi >= 30) metabolicAgeModifier += 7;
        }

        // Sleep quality adjustment (if available)
        if (profile.sleepQuality === 'poor') metabolicAgeModifier += 4;
        else if (profile.sleepQuality === 'fair') metabolicAgeModifier += 2;
        else if (profile.sleepQuality === 'excellent') metabolicAgeModifier -= 2;

        // Stress level adjustment (if available)
        if (profile.stressLevel === 'high') metabolicAgeModifier += 3;
        else if (profile.stressLevel === 'low') metabolicAgeModifier -= 1;

        const calculatedMetabolicAge = Math.max(18, baseAge + metabolicAgeModifier);
        setMetabolicAge(Math.round(calculatedMetabolicAge));
    };

    const getMotivationalMessage = () => {
        if (!profile.targetWeight || !profile.weight) return "Your journey starts now!";

        const isLosingWeight = profile.weight > profile.targetWeight;
        const difference = Math.abs(profile.weight - profile.targetWeight);

        if (isLosingWeight) {
            return `You're on track to lose ${difference.toFixed(1)}kg and transform your health!`;
        } else {
            return `You're building towards gaining ${difference.toFixed(1)}kg of healthy weight!`;
        }
    };

    const getTimelineSteps = () => {
        const weeks = estimatedDuration;
        const milestones = [];

        if (weeks <= 4) {
            milestones.push(
                { week: 1, title: "Initial Changes", description: "Energy levels improve" },
                { week: 2, title: "Momentum Building", description: "Habits start forming" },
                { week: Math.min(4, weeks), title: "Goal Achievement", description: "Target reached!" }
            );
        } else if (weeks <= 12) {
            milestones.push(
                { week: 2, title: "Early Progress", description: "First visible changes" },
                { week: 6, title: "Halfway Point", description: "Significant improvements" },
                { week: weeks, title: "Goal Achievement", description: "Target reached!" }
            );
        } else {
            milestones.push(
                { week: 4, title: "Foundation Built", description: "Healthy habits established" },
                { week: 12, title: "Major Milestone", description: "Noticeable transformation" },
                { week: weeks, title: "Goal Achievement", description: "Complete transformation!" }
            );
        }

        return milestones;
    };

    const handleNext = async () => {
        // Save the insights to profile
        await updateProfile({
            projectedCompletionDate: projectedDate,
            estimatedMetabolicAge: metabolicAge,
            estimatedDurationWeeks: estimatedDuration,
        });
        onNext();
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.title}>Your Personalized Journey</Text>
            <Text style={styles.subtitle}>Based on your profile, here's what we predict for your health journey</Text>

            {/* Goal Projection Card */}
            <View style={styles.insightCard}>
                <LinearGradient
                    colors={['#0074dd', '#5c00dd']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cardGradient}
                >
                    <View style={styles.cardHeader}>
                        <Ionicons name="flag" size={24} color="#fff" />
                        <Text style={styles.cardTitle}>Goal Projection</Text>
                    </View>
                    <Text style={styles.projectionText}>
                        {getMotivationalMessage()}
                    </Text>
                    <Text style={styles.dateText}>
                        Estimated completion: {projectedDate}
                    </Text>
                    <Text style={styles.weeklyText}>
                        Progress rate: {weeklyProgress}kg per week
                    </Text>
                </LinearGradient>
            </View>

            {/* Metabolic Age Card */}
            <View style={styles.insightCard}>
                <LinearGradient
                    colors={['#dd0095', '#ff6b6b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cardGradient}
                >
                    <View style={styles.cardHeader}>
                        <Ionicons name="body" size={24} color="#fff" />
                        <Text style={styles.cardTitle}>Metabolic Age</Text>
                    </View>
                    <Text style={styles.metabolicAgeText}>
                        {metabolicAge} years old
                    </Text>
                    <Text style={styles.metabolicSubtext}>
                        {metabolicAge < profile.age!
                            ? `${profile.age! - metabolicAge} years younger than your actual age!`
                            : metabolicAge > profile.age!
                                ? `${metabolicAge - profile.age!} years older - let's improve this!`
                                : 'Right on track with your actual age'
                        }
                    </Text>
                </LinearGradient>
            </View>

            {/* Timeline Preview */}
            <View style={styles.timelineCard}>
                <Text style={styles.timelineTitle}>Your Transformation Timeline</Text>
                <Text style={styles.timelineSubtitle}>Key milestones on your journey</Text>

                <View style={styles.timelineContainer}>
                    {getTimelineSteps().map((step, index) => (
                        <View key={index} style={styles.timelineItem}>
                            <View style={styles.timelineMarker}>
                                <Text style={styles.timelineWeek}>Week {step.week}</Text>
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineItemTitle}>{step.title}</Text>
                                <Text style={styles.timelineItemDescription}>{step.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Encouragement Section */}
            <View style={styles.encouragementCard}>
                <Ionicons name="heart" size={32} color="#ff6b6b" style={styles.heartIcon} />
                <Text style={styles.encouragementTitle}>You've Got This!</Text>
                <Text style={styles.encouragementText}>
                    Your personalized plan is designed specifically for your lifestyle and goals.
                    Stay consistent, and you'll see amazing results!
                </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Start My Journey</Text>
                    <Ionicons name="rocket" size={20} color="#fff" />
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
    insightCard: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardGradient: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 12,
    },
    projectionText: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
        lineHeight: 24,
    },
    dateText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    weeklyText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    metabolicAgeText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    metabolicSubtext: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    timelineCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    timelineTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    timelineSubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
    },
    timelineContainer: {
        paddingLeft: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    timelineMarker: {
        backgroundColor: '#0074dd',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 16,
    },
    timelineWeek: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    timelineContent: {
        flex: 1,
    },
    timelineItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    timelineItemDescription: {
        fontSize: 14,
        color: '#aaa',
    },
    encouragementCard: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 32,
    },
    heartIcon: {
        marginBottom: 12,
    },
    encouragementTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    encouragementText: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
        lineHeight: 24,
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

export default PredictiveInsightsStep; 