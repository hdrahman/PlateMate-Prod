import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface PersonalizedInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const PersonalizedInfoStep: React.FC<PersonalizedInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
    const [location, setLocation] = useState(profile.location || '');
    const [startingWeight, setStartingWeight] = useState(profile.startingWeight?.toString() || '');
    const [targetWeight, setTargetWeight] = useState(profile.targetWeight?.toString() || '');
    const [errors, setErrors] = useState({
        dateOfBirth: '',
        startingWeight: '',
        targetWeight: '',
    });

    const validateForm = () => {
        let isValid = true;
        const newErrors = {
            dateOfBirth: '',
            startingWeight: '',
            targetWeight: '',
        };

        // Validate date of birth (basic format check)
        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
            newErrors.dateOfBirth = 'Please use YYYY-MM-DD format';
            isValid = false;
        }

        // Validate starting weight
        if (!startingWeight.trim()) {
            newErrors.startingWeight = 'Starting weight is required for tracking progress';
            isValid = false;
        } else if (isNaN(parseFloat(startingWeight)) || parseFloat(startingWeight) <= 0) {
            newErrors.startingWeight = 'Please enter a valid weight';
            isValid = false;
        }

        // Validate target weight
        if (!targetWeight.trim()) {
            newErrors.targetWeight = 'Target weight helps us personalize your journey';
            isValid = false;
        } else if (isNaN(parseFloat(targetWeight)) || parseFloat(targetWeight) <= 0) {
            newErrors.targetWeight = 'Please enter a valid target weight';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleNext = async () => {
        if (validateForm()) {
            await updateProfile({
                dateOfBirth,
                location: location.trim(),
                startingWeight: parseFloat(startingWeight),
                targetWeight: parseFloat(targetWeight),
            });
            onNext();
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Personal Details</Text>
                <Text style={styles.subtitle}>This information helps us provide better personalized insights</Text>

                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date of Birth <Text style={styles.optional}>(optional)</Text></Text>
                        <View style={[styles.inputContainer, errors.dateOfBirth ? styles.inputError : null]}>
                            <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#666"
                                value={dateOfBirth}
                                onChangeText={setDateOfBirth}
                            />
                        </View>
                        {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
                        <Text style={styles.helpText}>Helps calculate metabolic age and better recommendations</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Location <Text style={styles.optional}>(optional)</Text></Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="City, Country"
                                placeholderTextColor="#666"
                                value={location}
                                onChangeText={setLocation}
                            />
                        </View>
                        <Text style={styles.helpText}>Helps us recommend local foods and seasonal options</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Starting Weight (kg)</Text>
                        <View style={[styles.inputContainer, errors.startingWeight ? styles.inputError : null]}>
                            <Ionicons name="fitness-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Your current weight"
                                placeholderTextColor="#666"
                                value={startingWeight}
                                onChangeText={setStartingWeight}
                                keyboardType="numeric"
                            />
                        </View>
                        {errors.startingWeight ? <Text style={styles.errorText}>{errors.startingWeight}</Text> : null}
                        <Text style={styles.helpText}>Essential for tracking your progress journey</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Target Weight (kg)</Text>
                        <View style={[styles.inputContainer, errors.targetWeight ? styles.inputError : null]}>
                            <Ionicons name="flag-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Your goal weight"
                                placeholderTextColor="#666"
                                value={targetWeight}
                                onChangeText={setTargetWeight}
                                keyboardType="numeric"
                            />
                        </View>
                        {errors.targetWeight ? <Text style={styles.errorText}>{errors.targetWeight}</Text> : null}
                        <Text style={styles.helpText}>Helps us create realistic timelines and projections</Text>
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <Ionicons name="bulb-outline" size={20} color="#FFD700" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        With this information, we can provide personalized goal projections and show you exactly when you'll reach your target!
                    </Text>
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
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
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
    formContainer: {
        width: '100%',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        color: '#fff',
        marginBottom: 8,
        fontWeight: '500',
    },
    optional: {
        color: '#999',
        fontWeight: 'normal',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
    },
    inputError: {
        borderWidth: 1,
        borderColor: '#ff3b30',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 8,
    },
    helpText: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 8,
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 32,
    },
    infoIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    infoText: {
        flex: 1,
        color: '#FFD700',
        fontSize: 14,
        lineHeight: 20,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
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

export default PersonalizedInfoStep; 