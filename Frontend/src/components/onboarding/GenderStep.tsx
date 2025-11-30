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

interface GenderStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const GenderStep: React.FC<GenderStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [gender, setGender] = useState<string>(profile.gender || 'male');

    // Gender options
    const genders = [
        {
            id: 'male',
            label: 'Male',
            icon: 'male',
            color: '#42a5f5',
        },
        {
            id: 'female',
            label: 'Female',
            icon: 'female',
            color: '#ec407a',
        },
    ];

    const handleSubmit = async () => {
        try {
            await updateProfile({
                gender,
            });
            onNext();
        } catch (error) {
            console.error('Error updating gender:', error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Select Your Gender</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>This helps us calculate your nutrition needs accurately</Text>
            </View>

            <View style={styles.gendersContainer}>
                {genders.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.genderCard,
                            { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border },
                            gender === option.id && styles.selectedGender,
                            gender === option.id && { borderColor: option.color }
                        ]}
                        onPress={() => {
                            setGender(option.id);
                            updateProfile({ gender: option.id }).catch(console.error);
                        }}
                    >
                        <View style={[
                            styles.genderIconContainer,
                            { backgroundColor: theme.colors.inputBackground },
                            gender === option.id && { backgroundColor: `${option.color}20` }
                        ]}>
                            <Ionicons
                                name={option.icon as any}
                                size={40}
                                color={gender === option.id ? option.color : theme.colors.textSecondary}
                            />
                        </View>
                        <Text style={[
                            styles.genderLabel,
                            { color: theme.colors.text },
                            gender === option.id && { color: option.color }
                        ]}
                            numberOfLines={1}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={[styles.infoContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                    We use this information to calculate your basal metabolic rate (BMR) and nutritional needs
                </Text>
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
    },
    header: {
        marginBottom: 40,
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
    gendersContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    genderCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 6,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minHeight: 140,
    },
    selectedGender: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    genderIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    genderLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        width: '100%',
        paddingHorizontal: 2,
        flexWrap: 'nowrap',
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 40,
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
});

export default GenderStep; 