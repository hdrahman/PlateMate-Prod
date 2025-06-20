import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { auth } from '../../utils/firebase';

interface BasicInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [lastName, setLastName] = useState(profile.lastName || '');
    const [email, setEmail] = useState(auth.currentUser?.email || profile.email || '');
    const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '');
    const [isLoading, setIsLoading] = useState(false);

    // Handle DOB formatting
    const formatDateOfBirth = (text: string) => {
        // Remove any non-digit characters
        const cleaned = text.replace(/\D/g, '');

        // Format with slashes
        if (cleaned.length <= 2) {
            setDateOfBirth(cleaned);
        } else if (cleaned.length <= 4) {
            setDateOfBirth(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
        } else if (cleaned.length <= 8) {
            setDateOfBirth(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`);
        }
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateDateOfBirth = (dob: string): boolean => {
        // Basic format validation (MM/DD/YYYY)
        const dobRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
        if (!dobRegex.test(dob)) {
            return false;
        }

        // Check if it's a valid date and user is at least 13 years old
        const parts = dob.split('/');
        const birthDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);

        if (isNaN(birthDate.getTime())) {
            return false;
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age >= 13;
    };

    const handleSubmit = async () => {
        if (!firstName.trim()) {
            Alert.alert('Missing Information', 'Please enter your first name');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address');
            return;
        }

        if (!dateOfBirth) {
            Alert.alert('Missing Information', 'Please enter your date of birth');
            return;
        }

        if (!validateDateOfBirth(dateOfBirth)) {
            Alert.alert('Invalid Date of Birth', 'Please enter a valid date (MM/DD/YYYY) and ensure you are at least 13 years old');
            return;
        }

        try {
            setIsLoading(true);

            // Calculate age if date of birth is provided
            let age = null;
            if (dateOfBirth) {
                const parts = dateOfBirth.split('/');
                const birthDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();

                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                dateOfBirth: dateOfBirth,
                age: age,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to save your information. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Let's Get Started</Text>
                <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your first name"
                            placeholderTextColor="#666"
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                        />
                    </View>
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
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date of Birth</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="MM/DD/YYYY"
                            placeholderTextColor="#666"
                            value={dateOfBirth}
                            onChangeText={formatDateOfBirth}
                            keyboardType="numeric"
                        />
                    </View>
                    <Text style={styles.hint}>You must be at least 13 years old</Text>
                </View>
            </View>

            <View style={styles.infoContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#888" />
                <Text style={styles.infoText}>
                    Your information is securely stored and never shared with third parties
                </Text>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit}
                disabled={isLoading}
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
    form: {
        marginBottom: 30,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
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
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        justifyContent: 'center',
    },
    input: {
        color: '#fff',
        fontSize: 16,
    },
    hint: {
        color: '#888',
        fontSize: 12,
        marginTop: 6,
        marginLeft: 4,
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
});

export default BasicInfoStep; 