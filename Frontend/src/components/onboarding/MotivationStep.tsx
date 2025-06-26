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

interface MotivationStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const MotivationStep: React.FC<MotivationStepProps> = ({ profile, updateProfile, onNext }) => {
    const [selectedMotivations, setSelectedMotivations] = useState<string[]>(
        profile.motivations || []
    );

    // Persist changes immediately so navigating away without pressing Continue retains data
    useEffect(() => {
        updateProfile({ motivations: selectedMotivations }).catch(() => { });
    }, [selectedMotivations]);

    const motivations = [
        {
            id: 'health',
            label: 'Be Healthier',
            icon: 'heart-outline',
            color: '#E53935',
        },
        {
            id: 'confidence',
            label: 'Feel More Confident',
            icon: 'star-outline',
            color: '#FFB300',
        },
        {
            id: 'appearance',
            label: 'Look Better',
            icon: 'person-outline',
            color: '#43A047',
        },
        {
            id: 'energy',
            label: 'Have More Energy',
            icon: 'flash-outline',
            color: '#1E88E5',
        },
        {
            id: 'longevity',
            label: 'Live Longer',
            icon: 'timer-outline',
            color: '#8E24AA',
        },
        {
            id: 'performance',
            label: 'Perform Better',
            icon: 'trophy-outline',
            color: '#F4511E',
        },
        {
            id: 'mental_health',
            label: 'Improve Mental Health',
            icon: 'brain-outline',
            color: '#00897B',
        },
        {
            id: 'family',
            label: 'Be There for Family',
            icon: 'people-outline',
            color: '#7CB342',
        },
    ];

    const toggleMotivation = (id: string) => {
        if (selectedMotivations.includes(id)) {
            setSelectedMotivations(selectedMotivations.filter(item => item !== id));
        } else {
            // Allow up to 3 selections
            if (selectedMotivations.length < 3) {
                setSelectedMotivations([...selectedMotivations, id]);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            await updateProfile({
                motivations: selectedMotivations,
            });
            onNext();
        } catch (error) {
            console.error('Error updating motivations:', error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>What Motivates You?</Text>
                <Text style={styles.subtitle}>Choose up to 3 reasons why you want to achieve your goal</Text>
            </View>

            <View style={styles.motivationsContainer}>
                {motivations.map((motivation) => (
                    <TouchableOpacity
                        key={motivation.id}
                        style={[
                            styles.motivationCard,
                            selectedMotivations.includes(motivation.id) && styles.selectedMotivation,
                        ]}
                        onPress={() => toggleMotivation(motivation.id)}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: `${motivation.color}20` }]}>
                            <Ionicons
                                name={motivation.icon as any}
                                size={24}
                                color={selectedMotivations.includes(motivation.id) ? motivation.color : '#777'}
                            />
                        </View>
                        <Text style={[
                            styles.motivationLabel,
                            selectedMotivations.includes(motivation.id) && styles.selectedMotivationLabel
                        ]}>
                            {motivation.label}
                        </Text>
                        {selectedMotivations.includes(motivation.id) && (
                            <View style={[styles.checkCircle, { backgroundColor: motivation.color }]}>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.selectionInfo}>
                <Ionicons name="information-circle-outline" size={18} color="#888" />
                <Text style={styles.selectionInfoText}>
                    {selectedMotivations.length === 0
                        ? "Select at least one motivation to continue"
                        : `${selectedMotivations.length}/3 selected`}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.button, selectedMotivations.length === 0 && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={selectedMotivations.length === 0}
            >
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
    motivationsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    motivationCard: {
        width: '48%',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    selectedMotivation: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: '#0074dd',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    motivationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ddd',
        textAlign: 'center',
    },
    selectedMotivationLabel: {
        color: '#fff',
    },
    checkCircle: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
    },
    selectionInfoText: {
        color: '#888',
        fontSize: 14,
        marginLeft: 6,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginHorizontal: 20,
        marginTop: 20,
    },
    buttonDisabled: {
        opacity: 0.6,
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

export default MotivationStep; 