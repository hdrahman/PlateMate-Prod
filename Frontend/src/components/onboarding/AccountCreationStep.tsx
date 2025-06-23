import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface AccountCreationStepProps {
    profile: any;
    onComplete: () => void;
    onSkip: () => void;
}

const AccountCreationStep: React.FC<AccountCreationStepProps> = ({
    profile,
    onComplete,
    onSkip
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { signUp } = useAuth();

    const handleCreateAccount = async () => {
        // Validation
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (!email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Creating account with email:', email);

            // Create the account
            await signUp(email, password);

            console.log('Account created successfully');
            // Account created, now complete onboarding
            onComplete();
        } catch (error) {
            console.error('Account creation error:', error);
            Alert.alert('Error', 'Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipForNow = () => {
        Alert.alert(
            'Continue Without Account?',
            'You can create an account later to sync your data across devices.',
            [
                { text: 'Create Account', style: 'default' },
                {
                    text: 'Skip for Now',
                    style: 'destructive',
                    onPress: onSkip
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <LinearGradient
                colors={['#000000', '#0a0a1c', '#1a1a35']}
                style={styles.background}
            />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <MaterialIcons name="account-circle" size={60} color="#0074dd" />
                    </View>
                    <Text style={styles.title}>Create Your Account</Text>
                    <Text style={styles.subtitle}>
                        Save your personalized profile and sync across all your devices
                    </Text>
                </View>

                {/* Benefits */}
                <View style={styles.benefitsContainer}>
                    <View style={styles.benefit}>
                        <Ionicons name="cloud-upload-outline" size={20} color="#00dd74" />
                        <Text style={styles.benefitText}>Sync across devices</Text>
                    </View>
                    <View style={styles.benefit}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#00dd74" />
                        <Text style={styles.benefitText}>Secure data backup</Text>
                    </View>
                    <View style={styles.benefit}>
                        <Ionicons name="analytics-outline" size={20} color="#00dd74" />
                        <Text style={styles.benefitText}>Track your progress</Text>
                    </View>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email address"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, styles.passwordInput]}
                            placeholder="Password (min. 6 characters)"
                            placeholderTextColor="#666"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoComplete="new-password"
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

                    <View style={styles.inputContainer}>
                        <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, styles.passwordInput]}
                            placeholder="Confirm password"
                            placeholderTextColor="#666"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoComplete="new-password"
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

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={handleCreateAccount}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.createButtonGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.createButtonText}>Create Account</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkipForNow}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipButtonText}>Skip for now</Text>
                    </TouchableOpacity>
                </View>

                {/* Terms */}
                <Text style={styles.termsText}>
                    By creating an account, you agree to our Terms of Service and Privacy Policy
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: width,
    },
    background: {
        position: 'absolute',
        width: width,
        height: height,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        paddingVertical: 40,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    iconContainer: {
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    benefitsContainer: {
        marginBottom: 30,
    },
    benefit: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    benefitText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    form: {
        marginBottom: 30,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    inputIcon: {
        marginLeft: 16,
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 50,
        color: '#fff',
        fontSize: 16,
        paddingRight: 16,
    },
    passwordInput: {
        paddingRight: 50,
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        padding: 4,
    },
    actions: {
        marginBottom: 20,
    },
    createButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    createButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginRight: 8,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipButtonText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '500',
    },
    termsText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 16,
    },
});

export default AccountCreationStep; 