import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
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
    const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
    const [errors, setErrors] = useState({
        firstName: '',
        dateOfBirth: '',
    });

    // Format date input as DD-MM-YYYY
    const handleDateChange = (text: string) => {
        // Remove any non-digit characters
        const cleaned = text.replace(/\D/g, '');

        // Apply DD-MM-YYYY formatting
        let formatted = cleaned;
        if (cleaned.length >= 3) {
            formatted = cleaned.substring(0, 2) + '-' + cleaned.substring(2);
        }
        if (cleaned.length >= 5) {
            formatted = cleaned.substring(0, 2) + '-' + cleaned.substring(2, 4) + '-' + cleaned.substring(4, 8);
        }

        // Limit to 10 characters (DD-MM-YYYY)
        if (formatted.length <= 10) {
            setDateOfBirth(formatted);
        }
    };

    const calculateAge = (dob: string): number | null => {
        if (!dob || !/^\d{2}-\d{2}-\d{4}$/.test(dob)) return null;

        const [day, month, year] = dob.split('-').map(Number);
        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };

    const validateForm = () => {
        let isValid = true;
        const newErrors = {
            firstName: '',
            dateOfBirth: '',
        };

        // Validate first name
        if (!firstName.trim()) {
            newErrors.firstName = 'First name is required';
            isValid = false;
        }

        // Validate date of birth format
        if (dateOfBirth && !/^\d{2}-\d{2}-\d{4}$/.test(dateOfBirth)) {
            newErrors.dateOfBirth = 'Please use DD-MM-YYYY format';
            isValid = false;
        } else if (dateOfBirth) {
            const [day, month, year] = dateOfBirth.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (isNaN(date.getTime()) || date > new Date() || year < 1900) {
                newErrors.dateOfBirth = 'Please enter a valid date';
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleNext = async () => {
        if (validateForm()) {
            const age = calculateAge(dateOfBirth);
            await updateProfile({
                firstName,
                lastName,
                dateOfBirth: dateOfBirth || null,
                age: age,
            });
            onNext();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Personal Information</Text>
                <Text style={styles.subtitle}>Let's start with the basics</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name</Text>
                    <View style={[styles.inputContainer, errors.firstName ? styles.inputError : null]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your first name"
                            placeholderTextColor="#666"
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                        />
                    </View>
                    {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Last Name <Text style={styles.optional}>(optional)</Text></Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your last name"
                            placeholderTextColor="#666"
                            value={lastName}
                            onChangeText={setLastName}
                            autoCapitalize="words"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date of Birth <Text style={styles.optional}>(optional)</Text></Text>
                    <View style={[styles.inputContainer, errors.dateOfBirth ? styles.inputError : null]}>
                        <TextInput
                            style={styles.input}
                            placeholder="DD-MM-YYYY"
                            placeholderTextColor="#666"
                            value={dateOfBirth}
                            onChangeText={handleDateChange}
                            keyboardType="numeric"
                            maxLength={10}
                        />
                        <Ionicons name="calendar-outline" size={20} color="#666" />
                    </View>
                    {errors.dateOfBirth ? <Text style={styles.errorText}>{errors.dateOfBirth}</Text> : null}
                    {dateOfBirth && calculateAge(dateOfBirth) && (
                        <Text style={styles.helpText}>Age: {calculateAge(dateOfBirth)} years</Text>
                    )}
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
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
    form: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: 24,
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 52,
    },
    inputError: {
        borderColor: '#ff3b30',
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 13,
        marginTop: 6,
        fontWeight: '500',
    },
    helpText: {
        color: '#888',
        fontSize: 13,
        marginTop: 6,
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

export default BasicInfoStep; 