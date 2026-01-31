import React, { useState, useEffect, useContext } from 'react';
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
import { ThemeContext } from '../../ThemeContext';

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
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [firstName, setFirstName] = useState(profile.firstName || '');
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
    // The next step will be SocialSignInInfoStep to collect missing name/age
    useEffect(() => {
        if (user) {
            console.log('✅ User authenticated via social sign-in, proceeding to info collection');
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

    const handleEmailPasswordSignUp = async () => {
        if (!firstName.trim()) {
            Alert.alert('Missing Information', 'Please enter your name');
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
                email: email.trim(),
                age: parseInt(age),
                password: password,
            });

            // Create account immediately so user is authenticated for rest of onboarding
            // If they drop off, onboardingComplete flag will be false and we can redirect them back
            const displayName = firstName.trim();
            await signUp(email, password, displayName);
            console.log('✅ Account created with display name:', displayName);

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
            console.log('✅ Google Sign-In successful');
            // User will be redirected to SocialSignInInfoStep to complete their profile
            // The useEffect will handle the navigation when user state updates
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
            console.log('✅ Apple Sign-In successful');
            // User will be redirected to SocialSignInInfoStep to complete their profile
            // The useEffect will handle the navigation when user state updates
        } catch (error) {
            console.error('Apple Sign-In error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Create Your Account</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Join thousands transforming their health</Text>
                </View>

                {/* Form Fields */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.input, { color: theme.colors.text }]}
                                placeholder="Enter your name"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={firstName}
                                onChangeText={setFirstName}
                                autoCapitalize="words"
                                editable={!isLoading}
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
                                editable={!isLoading}
                            />
                        </View>
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
                                editable={!isLoading}
                            />
                        </View>
                        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>You must be at least 13 years old</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Password</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.input, styles.passwordInput, { color: theme.colors.text }]}
                                placeholder="Create a password"
                                placeholderTextColor={theme.colors.textSecondary}
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
                        <Text style={[styles.label, { color: theme.colors.text }]}>Confirm Password</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.input, styles.passwordInput, { color: theme.colors.text }]}
                                placeholder="Confirm your password"
                                placeholderTextColor={theme.colors.textSecondary}
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
                                    color={theme.colors.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Security Info */}
                <View style={[styles.infoContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
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
                        colors={[theme.colors.primary, "#5c00dd", "#dd0095"]}
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

                {/* Divider - only show on iOS where social sign-in is available */}
                {Platform.OS === 'ios' && (
                    <View style={styles.dividerContainer}>
                        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                        <Text style={[styles.orText, { color: theme.colors.textSecondary }]}>or continue with</Text>
                        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    </View>
                )}

                {/* Social Sign-In Buttons - iOS only */}
                {Platform.OS === 'ios' && (
                    <View style={styles.socialSection}>
                        {/* Google Sign-In (iOS only - disabled on Android due to OAuth config issues) */}
                        <TouchableOpacity
                            style={[styles.socialButton, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                            onPress={handleGoogleSignIn}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-google" size={20} color={theme.colors.text} style={styles.socialIcon} />
                            <Text style={[styles.socialButtonText, { color: theme.colors.text }]}>Continue with Google</Text>
                        </TouchableOpacity>

                        {isAppleAuthAvailable && (
                            <TouchableOpacity
                                style={[styles.socialButton, styles.appleButton, { borderColor: theme.colors.border }]}
                                onPress={handleAppleSignIn}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-apple" size={22} color={theme.colors.text} style={styles.socialIcon} />
                                <Text style={[styles.socialButtonText, { color: theme.colors.text }]}>Continue with Apple</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
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
        paddingHorizontal: 20,
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
