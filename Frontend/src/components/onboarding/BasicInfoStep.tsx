import React, { useState, useEffect, useContext } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import { ThemeContext } from '../../ThemeContext';

interface BasicInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Password requirement indicator component
const PasswordRequirement: React.FC<{ text: string; met: boolean }> = ({ text, met }) => (
    <View style={styles.requirementRow}>
        <Ionicons
            name={met ? "checkmark-circle" : "close-circle"}
            size={16}
            color={met ? "#4ade80" : "#888"}
        />
        <Text style={[styles.requirementText, met && styles.requirementMet]}>
            {text}
        </Text>
    </View>
);

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(profile.password || '');
    const [age, setAge] = useState(profile.age?.toString() || '');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    // Only prefill email from Supabase if profile.email is empty
    useEffect(() => {
        const prefillEmail = async () => {
            if (profile.email) {
                setEmail(profile.email);
                return;
            }
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) {
                    setEmail(user.email);
                }
            } catch (err) {
                console.error('Failed to fetch user email from Supabase:', err);
            }
        };
        prefillEmail();
    }, [profile.email]);

    // Handle age input (only allow numbers)
    const handleAgeInput = (text: string) => {
        // Remove any non-digit characters
        const cleaned = text.replace(/\D/g, '');

        // Limit to reasonable age range (2 digits max)
        if (cleaned.length <= 2) {
            setAge(cleaned);
        }
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password: string): {
        isValid: boolean;
        errors: string[];
        checks: {
            minLength: boolean;
            hasLowercase: boolean;
            hasUppercase: boolean;
            hasNumber: boolean;
        }
    } => {
        const checks = {
            minLength: password.length >= 8,
            hasLowercase: /[a-z]/.test(password),
            hasUppercase: /[A-Z]/.test(password),
            hasNumber: /[0-9]/.test(password),
        };

        const errors: string[] = [];
        if (!checks.minLength) errors.push('At least 8 characters');
        if (!checks.hasLowercase) errors.push('At least one lowercase letter');
        if (!checks.hasUppercase) errors.push('At least one uppercase letter');
        if (!checks.hasNumber) errors.push('At least one number');

        return {
            isValid: Object.values(checks).every(check => check),
            errors,
            checks
        };
    };

    const validateAge = (ageStr: string): boolean => {
        const ageNum = parseInt(ageStr);
        return !isNaN(ageNum) && ageNum >= 13 && ageNum <= 120;
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

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            Alert.alert(
                'Invalid Password',
                `Your password must have:\n${passwordValidation.errors.map(e => `• ${e}`).join('\n')}`
            );
            return;
        }

        if (!age) {
            Alert.alert('Missing Information', 'Please enter your age');
            return;
        }

        if (!validateAge(age)) {
            Alert.alert('Invalid Age', 'Please enter a valid age between 13 and 120');
            return;
        }

        try {
            setIsLoading(true);

            await updateProfile({
                firstName: firstName.trim(),
                email: email.trim(),
                password: password,
                age: parseInt(age),
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to save your information. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Persist user input immediately to profile context so that navigating away and back retains values
    useEffect(() => {
        // We purposely do not await this promise to avoid blocking UI updates
        updateProfile({
            firstName,
            email,
            password,
            age: age ? parseInt(age) : null,
        }).catch(console.error);
    }, [firstName, email, password, age]);

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Let's Get Started</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Tell us a bit about yourself</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>First Name</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Enter your first name"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                        />
                    </View>
                </View>



                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Enter your email"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Password</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.input, styles.passwordInput, { color: theme.colors.text }]}
                            placeholder="Enter your password"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            onFocus={() => setPasswordTouched(true)}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Ionicons
                                name={showPassword ? "eye-off" : "eye"}
                                size={20}
                                color={theme.colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                    {passwordTouched && (
                        <View style={[styles.passwordRequirements, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <PasswordRequirement
                                text="At least 8 characters"
                                met={validatePassword(password).checks.minLength}
                            />
                            <PasswordRequirement
                                text="Contains a lowercase letter"
                                met={validatePassword(password).checks.hasLowercase}
                            />
                            <PasswordRequirement
                                text="Contains an uppercase letter"
                                met={validatePassword(password).checks.hasUppercase}
                            />
                            <PasswordRequirement
                                text="Contains a number"
                                met={validatePassword(password).checks.hasNumber}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Age</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Enter your age"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={age}
                            onChangeText={handleAgeInput}
                            keyboardType="numeric"
                        />
                    </View>
                    <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>You must be at least 13 years old</Text>
                </View>
            </View>

            <View style={[styles.infoContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                    Your information is securely stored and never shared with third parties
                </Text>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit}
                disabled={isLoading}
            >
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
    passwordInput: {
        paddingRight: 40,
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    passwordRequirements: {
        marginTop: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    requirementText: {
        color: '#888',
        fontSize: 13,
        marginLeft: 8,
    },
    requirementMet: {
        color: '#4ade80',
    },
});

export default BasicInfoStep; 