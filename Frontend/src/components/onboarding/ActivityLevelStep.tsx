import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { ThemeContext } from '../../ThemeContext';

interface ActivityLevelStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const ActivityLevelStep: React.FC<ActivityLevelStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [activityLevel, setActivityLevel] = useState<string>(profile.activityLevel || 'sedentary');

    // Activity levels with concise descriptions
    const activityLevels = [
        {
            id: 'sedentary',
            label: 'Sedentary',
            description: 'Desk job, little to no exercise, and mostly sitting throughout the day',
            icon: 'bed-outline',
            color: '#ff5722',
        },
        {
            id: 'light',
            label: 'Lightly Active',
            description: 'Light exercise or sports 1-3 days/week, mostly standing job or daily walking',
            icon: 'walk-outline',
            color: '#66bb6a',
        },
        {
            id: 'moderate',
            label: 'Moderately Active',
            description: 'Moderate exercise or sports 3-5 days/week or physically demanding job',
            icon: 'bicycle-outline',
            color: '#42a5f5',
        },
        {
            id: 'active',
            label: 'Very Active',
            description: 'Hard exercise or sports 6-7 days/week or very physically demanding job',
            icon: 'fitness-outline',
            color: '#7e57c2',
        },
        {
            id: 'very_active',
            label: 'Extremely Active',
            description: 'Professional athlete level, physical labor job plus training, or 2x daily workouts',
            icon: 'barbell-outline',
            color: '#ff7043',
        },
    ];

    const handleSubmit = async () => {
        try {
            await updateProfile({
                activityLevel,
            });
            onNext();
        } catch (error) {
            console.error('Error updating activity level:', error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Activity Level</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>How active are you in your daily life?</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.activityContainer}>
                    {activityLevels.map((level) => (
                        <TouchableOpacity
                            key={level.id}
                            style={[
                                styles.activityCard,
                                { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border },
                                activityLevel === level.id && [styles.selectedActivity, { borderColor: theme.colors.primary }]
                            ]}
                            onPress={() => {
                                setActivityLevel(level.id);
                                updateProfile({ activityLevel: level.id }).catch(console.error);
                            }}
                        >
                            <View style={[styles.activityIcon, { backgroundColor: `${level.color}20` }]}>
                                <Ionicons
                                    name={level.icon as any}
                                    size={24}
                                    color={activityLevel === level.id ? level.color : theme.colors.textSecondary}
                                />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={[
                                    styles.activityLabel,
                                    { color: theme.colors.text },
                                    activityLevel === level.id && { color: level.color }
                                ]}>
                                    {level.label}
                                </Text>
                                <Text style={[styles.activityDescription, { color: theme.colors.textSecondary }]}>
                                    {level.description}
                                </Text>
                            </View>
                            {activityLevel === level.id && (
                                <Ionicons name="checkmark-circle" size={22} color={level.color} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.infoContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                        Your activity level helps us calculate your daily calorie needs. You can leave it at sedentary and the app will track your steps for accurate calorie targets.
                    </Text>
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <LinearGradient
                    colors={[theme.colors.primary, "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
        justifyContent: 'space-between',
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 24,
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    activityContainer: {
        marginBottom: 8,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedActivity: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: '#0074dd',
    },
    activityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    activityContent: {
        flex: 1,
    },
    activityLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    activityDescription: {
        fontSize: 13,
        color: '#aaa',
        lineHeight: 18,
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
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
        marginBottom: 20,
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

export default ActivityLevelStep; 