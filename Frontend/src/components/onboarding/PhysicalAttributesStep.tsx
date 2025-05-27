import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface PhysicalAttributesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Activity level options
const activityLevels = [
    { id: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
    { id: 'light', label: 'Lightly Active', description: '1-3 days/week' },
    { id: 'moderate', label: 'Moderately Active', description: '3-5 days/week' },
    { id: 'active', label: 'Very Active', description: '6-7 days/week' },
    { id: 'extreme', label: 'Extremely Active', description: 'Physical job or 2x training' },
];

// Gender options
const genders = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
    { id: 'other', label: 'Other' },
    { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Unit measurement systems
const units = [
    { id: 'metric', label: 'Metric (cm/kg)' },
    { id: 'imperial', label: 'Imperial (ft/in/lb)' },
];

const PhysicalAttributesStep: React.FC<PhysicalAttributesStepProps> = ({ profile, updateProfile, onNext }) => {
    const [height, setHeight] = useState<string>(profile.height?.toString() || '');
    const [weight, setWeight] = useState<string>(profile.weight?.toString() || '');
    const [age, setAge] = useState<string>(profile.age?.toString() || '');
    const [gender, setGender] = useState<string>(profile.gender || 'male');
    const [activityLevel, setActivityLevel] = useState<string>(profile.activityLevel || 'moderate');
    const [fitnessGoal, setFitnessGoal] = useState<string>(profile.fitnessGoal || 'balanced');
    const [activityLevelIndex, setActivityLevelIndex] = useState<number>(2); // Default to moderate (index 2)

    // Set initial activity level index based on profile
    useEffect(() => {
        const index = activityLevels.findIndex(level => level.id === activityLevel);
        if (index !== -1) {
            setActivityLevelIndex(index);
        }
    }, []);

    const handleActivityLevelChange = (index: number) => {
        setActivityLevelIndex(index);
        setActivityLevel(activityLevels[index].id);
    };

    const handleSubmit = async () => {
        try {
            const heightValue = height ? parseFloat(height) : undefined;
            const weightValue = weight ? parseFloat(weight) : undefined;
            const ageValue = age ? parseInt(age) : undefined;

            await updateProfile({
                height: heightValue,
                weight: weightValue,
                age: ageValue,
                gender,
                activityLevel,
                fitnessGoal,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Physical Attributes</Text>
                <Text style={styles.subtitle}>Tell us about yourself for accurate calculations</Text>

                {/* Height Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Height (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={height}
                        onChangeText={setHeight}
                        placeholder="Enter your height"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                    />
                </View>

                {/* Weight Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Weight (kg)</Text>
                    <TextInput
                        style={styles.input}
                        value={weight}
                        onChangeText={setWeight}
                        placeholder="Enter your weight"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                    />
                </View>

                {/* Age Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Age</Text>
                    <TextInput
                        style={styles.input}
                        value={age}
                        onChangeText={setAge}
                        placeholder="Enter your age"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                    />
                </View>

                {/* Gender Selection */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderContainer}>
                        <TouchableOpacity
                            style={[
                                styles.genderButton,
                                gender === 'male' && styles.selectedGender
                            ]}
                            onPress={() => setGender('male')}
                        >
                            <Ionicons
                                name="male"
                                size={20}
                                color={gender === 'male' ? '#0074dd' : '#666'}
                            />
                            <Text style={[
                                styles.genderText,
                                gender === 'male' && styles.selectedGenderText
                            ]}>Male</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.genderButton,
                                gender === 'female' && styles.selectedGender
                            ]}
                            onPress={() => setGender('female')}
                        >
                            <Ionicons
                                name="female"
                                size={20}
                                color={gender === 'female' ? '#0074dd' : '#666'}
                            />
                            <Text style={[
                                styles.genderText,
                                gender === 'female' && styles.selectedGenderText
                            ]}>Female</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Activity Level Selection with custom UI */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Activity Level</Text>
                    <View style={styles.activityContainer}>
                        <Text style={styles.activityLabel}>{activityLevels[activityLevelIndex].label}</Text>
                        <Text style={styles.activityDescription}>{activityLevels[activityLevelIndex].description}</Text>

                        <View style={styles.activitySlider}>
                            {activityLevels.map((level, index) => (
                                <TouchableOpacity
                                    key={level.id}
                                    style={[
                                        styles.activitySliderItem,
                                        activityLevelIndex === index && styles.activitySliderItemActive
                                    ]}
                                    onPress={() => handleActivityLevelChange(index)}
                                >
                                    <View style={[
                                        styles.activitySliderDot,
                                        activityLevelIndex === index && styles.activitySliderDotActive,
                                        activityLevelIndex > index && styles.activitySliderDotCompleted
                                    ]} />
                                </TouchableOpacity>
                            ))}
                            <View style={styles.activitySliderLine} />
                        </View>

                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabelText}>Less Active</Text>
                            <Text style={styles.sliderLabelText}>More Active</Text>
                        </View>
                    </View>
                </View>

                {/* Fitness Goal Selection */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Fitness Goal</Text>
                    <View style={styles.goalsContainer}>
                        <TouchableOpacity
                            style={[
                                styles.goalButton,
                                fitnessGoal === 'fat_loss' && styles.selectedGoal
                            ]}
                            onPress={() => setFitnessGoal('fat_loss')}
                        >
                            <MaterialCommunityIcons
                                name="fire"
                                size={20}
                                color={fitnessGoal === 'fat_loss' ? '#0074dd' : '#666'}
                            />
                            <Text style={[
                                styles.goalText,
                                fitnessGoal === 'fat_loss' && styles.selectedGoalText
                            ]}>Fat Loss</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.goalButton,
                                fitnessGoal === 'balanced' && styles.selectedGoal
                            ]}
                            onPress={() => setFitnessGoal('balanced')}
                        >
                            <Ionicons
                                name="fitness"
                                size={20}
                                color={fitnessGoal === 'balanced' ? '#0074dd' : '#666'}
                            />
                            <Text style={[
                                styles.goalText,
                                fitnessGoal === 'balanced' && styles.selectedGoalText
                            ]}>Balanced</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.goalButton,
                                fitnessGoal === 'muscle_gain' && styles.selectedGoal
                            ]}
                            onPress={() => setFitnessGoal('muscle_gain')}
                        >
                            <Ionicons
                                name="barbell"
                                size={20}
                                color={fitnessGoal === 'muscle_gain' ? '#0074dd' : '#666'}
                            />
                            <Text style={[
                                styles.goalText,
                                fitnessGoal === 'muscle_gain' && styles.selectedGoalText
                            ]}>Muscle Gain</Text>
                        </TouchableOpacity>
                    </View>
                </View>

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
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 60,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
    },
    genderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    genderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        flex: 0.48,
    },
    selectedGender: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    genderText: {
        color: '#aaa',
        marginLeft: 8,
        fontSize: 16,
    },
    selectedGenderText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    activityContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 16,
    },
    activityLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    activityDescription: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 16,
    },
    activitySlider: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        height: 40,
        marginVertical: 10,
    },
    activitySliderLine: {
        position: 'absolute',
        height: 3,
        backgroundColor: '#333',
        width: '100%',
        top: '50%',
        marginTop: -1.5,
        zIndex: 1,
    },
    activitySliderItem: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    activitySliderItemActive: {
        backgroundColor: 'rgba(0,116,221,0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    activitySliderDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#666',
    },
    activitySliderDotActive: {
        backgroundColor: '#0074dd',
    },
    activitySliderDotCompleted: {
        backgroundColor: 'rgba(0,116,221,0.5)',
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    sliderLabelText: {
        fontSize: 12,
        color: '#aaa',
    },
    goalsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    goalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        flex: 0.31,
    },
    selectedGoal: {
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    goalText: {
        color: '#aaa',
        marginLeft: 8,
        fontSize: 14,
    },
    selectedGoalText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    submitButton: {
        marginTop: 32,
        borderRadius: 12,
        overflow: 'hidden',
    },
    submitButtonGradient: {
        paddingVertical: 16,
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

export default PhysicalAttributesStep; 