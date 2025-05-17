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

interface BasicInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [lastName, setLastName] = useState(profile.lastName || '');
    const [errors, setErrors] = useState({
        firstName: '',
        lastName: '',
    });

    const validateForm = () => {
        let isValid = true;
        const newErrors = {
            firstName: '',
            lastName: '',
        };

        // Validate first name
        if (!firstName.trim()) {
            newErrors.firstName = 'First name is required';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleNext = async () => {
        if (validateForm()) {
            await updateProfile({
                firstName,
                lastName,
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
                <Text style={styles.title}>Let's Get To Know You</Text>
                <Text style={styles.subtitle}>Please tell us a little about yourself</Text>

                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name</Text>
                        <View style={[styles.inputContainer, errors.firstName ? styles.inputError : null]}>
                            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Your first name"
                                placeholderTextColor="#666"
                                value={firstName}
                                onChangeText={setFirstName}
                            />
                        </View>
                        {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name <Text style={styles.optional}>(optional)</Text></Text>
                        <View style={[styles.inputContainer, errors.lastName ? styles.inputError : null]}>
                            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Your last name"
                                placeholderTextColor="#666"
                                value={lastName}
                                onChangeText={setLastName}
                            />
                        </View>
                        {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={20} color="#999" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        Your information helps us personalize your experience. We keep your data secure and never share it without your permission.
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
        marginBottom: 20,
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
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
        color: '#999',
        fontSize: 14,
        lineHeight: 20,
    },
    button: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 8,
    },
});

export default BasicInfoStep; 