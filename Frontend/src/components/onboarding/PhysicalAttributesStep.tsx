import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface PhysicalAttributesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Activity levels for users to choose from
const activityLevels = [
    {
        id: 'sedentary',
        label: 'Sedentary',
        description: 'Little to no exercise',
        icon: 'bed-outline',
    },
    {
        id: 'light',
        label: 'Lightly Active',
        description: '1-3 days/week',
        icon: 'walk-outline',
    },
    {
        id: 'moderate',
        label: 'Moderately Active',
        description: '3-5 days/week',
        icon: 'bicycle-outline',
    },
    {
        id: 'active',
        label: 'Very Active',
        description: '6-7 days/week',
        icon: 'fitness-outline',
    },
    {
        id: 'extreme',
        label: 'Extremely Active',
        description: 'Physical job or 2x training',
        icon: 'barbell-outline',
    },
];

// Gender options
const genders = [
    { id: 'male', label: 'Male', icon: 'male' },
    { id: 'female', label: 'Female', icon: 'female' },
    { id: 'other', label: 'Other', icon: 'person' },
];

const PhysicalAttributesStep: React.FC<PhysicalAttributesStepProps> = ({ profile, updateProfile, onNext }) => {
    const [height, setHeight] = useState<string>(profile.height?.toString() || '');
    const [currentWeight, setCurrentWeight] = useState<string>(profile.weight?.toString() || profile.startingWeight?.toString() || '');
    const [targetWeight, setTargetWeight] = useState<string>(profile.targetWeight?.toString() || '');
    const [gender, setGender] = useState<string>(profile.gender || 'male');
    const [activityLevel, setActivityLevel] = useState<string>(profile.activityLevel || 'moderate');

    const handleSubmit = async () => {
        try {
            const heightValue = height ? parseFloat(height) : undefined;
            const currentWeightValue = currentWeight ? parseFloat(currentWeight) : undefined;
            const targetWeightValue = targetWeight ? parseFloat(targetWeight) : undefined;

            await updateProfile({
                height: heightValue,
                weight: currentWeightValue, // Current weight
                startingWeight: currentWeightValue, // Same as current weight
                targetWeight: targetWeightValue,
                gender,
                activityLevel,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Physical Profile</Text>
                <Text style={styles.subtitle}>Help us personalize your nutrition plan</Text>
            </View>

            <View style={styles.form}>
                {/* Physical Measurements */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Measurements</Text>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                            <Text style={styles.label}>Height (cm)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="170"
                                    placeholderTextColor="#666"
                                    value={height}
                                    onChangeText={setHeight}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                            <Text style={styles.label}>Current Weight (kg)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="70"
                                    placeholderTextColor="#666"
                                    value={currentWeight}
                                    onChangeText={setCurrentWeight}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Target Weight (kg) <Text style={styles.optional}>(optional)</Text></Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="65"
                                placeholderTextColor="#666"
                                value={targetWeight}
                                onChangeText={setTargetWeight}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </View>

                {/* Gender Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Gender</Text>
                    <View style={styles.optionsRow}>
                        {genders.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                style={[
                                    styles.optionCard,
                                    gender === option.id && styles.selectedOption
                                ]}
                                onPress={() => setGender(option.id)}
                            >
                                <Ionicons
                                    name={option.icon as any}
                                    size={20}
                                    color={gender === option.id ? '#0074dd' : '#666'}
                                />
                                <Text style={[
                                    styles.optionText,
                                    gender === option.id && styles.selectedOptionText
                                ]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Activity Level Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Level</Text>
                    <Text style={styles.sectionSubtitle}>How active are you on a typical day?</Text>

                    <View style={styles.activityContainer}>
                        {activityLevels.map((level) => (
                            <TouchableOpacity
                                key={level.id}
                                style={[
                                    styles.activityCard,
                                    activityLevel === level.id && styles.selectedActivity
                                ]}
                                onPress={() => setActivityLevel(level.id)}
                            >
                                <View style={styles.activityIcon}>
                                    <Ionicons
                                        name={level.icon as any}
                                        size={22}
                                        color={activityLevel === level.id ? '#0074dd' : '#666'}
                                    />
                                </View>
                                <View style={styles.activityContent}>
                                    <Text style={[
                                        styles.activityLabel,
                                        activityLevel === level.id && styles.selectedActivityText
                                    ]}>
                                        {level.label}
                                    </Text>
                                    <Text style={[
                                        styles.activityDescription,
                                        activityLevel === level.id && styles.selectedActivityDescription
                                    ]}>
                                        {level.description}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
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
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 15,
        color: '#fff',
        marginBottom: 8,
        fontWeight: '500',
    },
    optional: {
        color: '#888',
        fontWeight: '400',
        fontSize: 14,
    },
    inputContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 52,
        justifyContent: 'center',
    },
    input: {
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    optionCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        gap: 8,
    },
    selectedOption: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    optionText: {
        color: '#aaa',
        fontSize: 15,
        fontWeight: '500',
    },
    selectedOptionText: {
        color: '#fff',
    },
    activityContainer: {
        gap: 12,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
    },
    selectedActivity: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    activityIcon: {
        width: 40,
        alignItems: 'center',
        marginRight: 16,
    },
    activityContent: {
        flex: 1,
    },
    activityLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedActivityText: {
        color: '#fff',
    },
    activityDescription: {
        fontSize: 14,
        color: '#888',
    },
    selectedActivityDescription: {
        color: '#aaa',
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

export default PhysicalAttributesStep; 