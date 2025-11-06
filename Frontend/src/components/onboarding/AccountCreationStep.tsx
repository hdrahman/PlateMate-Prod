import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { useAuth } from '../../context/AuthContext';

// Safe import AppleAuthentication module at top level (like Auth.tsx)
let AppleAuthentication: any = null;
try {
    if (Platform.OS === 'ios') {
        AppleAuthentication = require('expo-apple-authentication');
        console.log('Apple Authentication module loaded in AccountCreationStep');
    }
} catch (error) {
    console.log('Apple Authentication not available in AccountCreationStep', error);
}

interface AccountCreationStepProps {
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

const AccountCreationStep: React.FC<AccountCreationStepProps> = ({ profile, updateProfile, onNext }) => {
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [lastName, setLastName] = useState(profile.lastName || '');
    const [email, setEmail] = useState(profile.email || '');
    const [age, setAge] = useState(profile.age?.toString() || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

    const { signUp, signInWithGoogle, signInWithApple, user } = useAuth();

    // Check if Apple Authentication is available (iOS only)
    useEffect(() => {
        const checkAppleAuth = async () => {
            if (AppleAuthentication && Platform.OS === 'ios') {
                try {
                    const isAvailable = await AppleAuthentication.isAvailableAsync();
                    setIsAppleAuthAvailable(isAvailable);
                    console.log('Apple Authentication available in AccountCreationStep:', isAvailable);
                } catch (error) {
                    console.log('Error checking Apple Authentication availability:', error);
                    setIsAppleAuthAvailable(false);
                }
            } else {
                setIsAppleAuthAvailable(false);
            }
        };
        checkAppleAuth();
    }, []);

    // If user is already authenticated (via social sign-in), proceed to next step
    useEffect(() => {
        if (user) {
            // User authenticated via social sign-in, proceed to next step
            onNext();
        }
    }, [user]);

    // Handle age input (only allow numbers)
    const handleAgeInput = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
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
            hasUppercase: boolean;
            hasLowercase: boolean;
            hasNumber: boolean;
            hasSpecialChar: boolean;
        }
    } => {
        const checks = {
            minLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[^A-Za-z0-9]/.test(password),
        };

        const errors: string[] = [];
        if (!checks.minLength) errors.push('At least 8 characters');
        if (!checks.hasUppercase) errors.push('One uppercase letter');
        if (!checks.hasLowercase) errors.push('One lowercase letter');
        if (!checks.hasNumber) errors.push('One number');
        if (!checks.hasSpecialChar) errors.push('One special character');

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

    const handleEmailPasswordSignUp = async () => {
        if (!firstName.trim()) {
            Alert.alert('Missing Information', 'Please enter your first name');
            return;
        }

        if (!lastName.trim()) {
            Alert.alert('Missing Information', 'Please enter your last name');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address');
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

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            Alert.alert(
                'Invalid Password',
                `Your password must have:\n${passwordValidation.errors.map(e => `• ${e}`).join('\n')}`
            );
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Passwords do not match');
            return;
        }

        try {
            setIsLoading(true);

            // Save user data to profile first
            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                age: parseInt(age),
                password: password,
            });

            // Create account immediately so user is authenticated for rest of onboarding
            // If they drop off, onboardingComplete flag will be false and we can redirect them back
            const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
            await signUp(email, password, displayName);

            // Proceed to next onboarding step
            onNext();
        } catch (error: any) {
            console.error('Error creating account:', error);

            // Handle specific error cases
            if (error?.message?.includes('already registered')) {
                Alert.alert('Account Exists', 'This email is already registered. Please sign in instead.');
            } else if (error?.message?.includes('Network request failed')) {
                Alert.alert('Network Error', 'Please check your internet connection and try again.');
            } else {
                Alert.alert('Error', 'Failed to create your account. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            const result = await signInWithGoogle();

            // Extract name from Google sign-in result if available
            if (result?.userInfo) {
                const { firstName: googleFirstName, lastName: googleLastName } = result.userInfo;
                
                // Pre-fill the form fields if we got name from Google
                if (googleFirstName) setFirstName(googleFirstName);
                if (googleLastName) setLastName(googleLastName);
                
                console.log('✅ Pre-filled name from Google:', googleFirstName, googleLastName);
            }

            // Collect manual data after social sign-in
            if (!firstName.trim() || !lastName.trim() || !age) {
                // Show alert to collect missing data
                Alert.alert(
                    'Complete Your Profile',
                    'Please enter your name and age to continue',
                    [{ text: 'OK' }]
                );
                setIsLoading(false);
                return;
            }

            // Update profile with manual data
            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: parseInt(age),
            });

            // Proceed to next step (will be handled by useEffect when user is set)
        } catch (error) {
            console.error('Google Sign-In error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        setIsLoading(true);
        try {
            const result = await signInWithApple();

            // Extract name from Apple sign-in result if available (only on first sign-in)
            if (result?.userInfo) {
                const { firstName: appleFirstName, lastName: appleLastName } = result.userInfo;
                
                // Pre-fill the form fields if we got name from Apple
                if (appleFirstName) setFirstName(appleFirstName);
                if (appleLastName) setLastName(appleLastName);
                
                console.log('✅ Pre-filled name from Apple:', appleFirstName, appleLastName);
            } else {
                console.log('⚠️ No name from Apple (normal after first sign-in)');
            }

            // Collect manual data after social sign-in
            if (!firstName.trim() || !lastName.trim() || !age) {
                Alert.alert(
                    'Complete Your Profile',
                    'Please enter your name and age to continue',
                    [{ text: 'OK' }]
                );
                setIsLoading(false);
                return;
            }

            // Update profile with manual data
            await updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: parseInt(age),
            });

            // Proceed to next step (will be handled by useEffect when user is set)
        } catch (error) {
            console.error('Apple Sign-In error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Create Your Account</Text>
                    <Text style={styles.subtitle}>Join thousands transforming their health</Text>
                </View>

                {/* Form Fields */}
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
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your last name"
                                placeholderTextColor="#666"
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                                editable={!isLoading}
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
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Age</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your age"
                                placeholderTextColor="#666"
                                value={age}
                                onChangeText={handleAgeInput}
                                keyboardType="numeric"
                                editable={!isLoading}
                            />
                        </View>
                        <Text style={styles.hint}>You must be at least 13 years old</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Create a password"
                                placeholderTextColor="#666"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setPasswordTouched(true)}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? "eye-off" : "eye"}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>
                        {passwordTouched && (
                            <View style={styles.passwordRequirements}>
                                <PasswordRequirement
                                    text="At least 8 characters"
                                    met={validatePassword(password).checks.minLength}
                                />
                                <PasswordRequirement
                                    text="One uppercase letter"
                                    met={validatePassword(password).checks.hasUppercase}
                                />
                                <PasswordRequirement
                                    text="One lowercase letter"
                                    met={validatePassword(password).checks.hasLowercase}
                                />
                                <PasswordRequirement
                                    text="One number"
                                    met={validatePassword(password).checks.hasNumber}
                                />
                                <PasswordRequirement
                                    text="One special character (!@#$%^&*)"
                                    met={validatePassword(password).checks.hasSpecialChar}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Confirm your password"
                                placeholderTextColor="#666"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Ionicons
                                    name={showConfirmPassword ? "eye-off" : "eye"}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Security Info */}
                <View style={styles.infoContainer}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#888" />
                    <Text style={styles.infoText}>
                        Your information is securely stored and never shared with third parties
                    </Text>
                </View>

                {/* Create Account Button */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleEmailPasswordSignUp}
                    disabled={isLoading}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Create Account</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.orText}>or continue with</Text>
                    <View style={styles.divider} />
                </View>

                {/* Social Sign-In Buttons */}
                <View style={styles.socialSection}>
                    <TouchableOpacity
                        style={styles.socialButton}
                        onPress={handleGoogleSignIn}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="logo-google" size={20} color="#FFF" style={styles.socialIcon} />
                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </TouchableOpacity>

                    {isAppleAuthAvailable && (
                        <TouchableOpacity
                            style={[styles.socialButton, styles.appleButton]}
                            onPress={handleAppleSignIn}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-apple" size={22} color="#FFF" style={styles.socialIcon} />
                            <Text style={styles.socialButtonText}>Continue with Apple</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 20,
        paddingBottom: 150,
    },
    header: {
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
    socialSection: {
        marginBottom: 30,
        marginTop: 10,
    },
    socialButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    appleButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    socialIcon: {
        marginRight: 10,
    },
    socialButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    orText: {
        color: '#888',
        fontSize: 14,
        marginHorizontal: 12,
    },
    form: {
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
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
    passwordInput: {
        paddingRight: 40,
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    hint: {
        color: '#888',
        fontSize: 12,
        marginTop: 6,
        marginLeft: 4,
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
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
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

export default AccountCreationStep;
