import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

// Import types from our type definitions
import '../types/expo-apple-authentication.d.ts';

// Safe import AppleAuthentication module
let AppleAuthentication: any = null;
// We've removed the Apple Authentication module, so this will always be null
console.log('Apple Authentication not available');

const Auth = ({ navigation }: any) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
    const { signIn, signUp, signInWithGoogle, signInWithApple, signInAnonymously } = useAuth();

    // We've removed Apple Authentication, so it's not available
    useEffect(() => {
        setIsAppleAuthAvailable(false);
    }, []);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Email and password are required');
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                await signUp(email, password);
            }
        } catch (error) {
            // Error is already handled in auth context
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            // Error is already handled in auth context
        } finally {
            setIsLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithApple();
        } catch (error) {
            // Error is already handled in auth context
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnonymousSignIn = async () => {
        setIsLoading(true);
        try {
            await signInAnonymously();
        } catch (error) {
            // Error is already handled in auth context
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAuthMode = () => {
        setIsLogin(!isLogin);
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>PlateMate</Text>
                    <Text style={styles.subtitle}>AI-Powered Nutrition & Fitness Tracker</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.formTitle}>{isLogin ? 'Sign In' : 'Create Account'}</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    {!isLogin && (
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    )}

                    <TouchableOpacity
                        style={styles.authButton}
                        onPress={handleAuth}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.authButtonText}>
                                {isLogin ? 'Sign In' : 'Sign Up'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleAuthMode}>
                        <Text style={styles.toggleAuthText}>
                            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.socialContainer}>
                    <Text style={styles.orText}>OR</Text>

                    <TouchableOpacity
                        style={[styles.socialButton, styles.googleButton]}
                        onPress={handleGoogleSignIn}
                        disabled={isLoading}
                    >
                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </TouchableOpacity>

                    {/* Apple Authentication button removed */}

                    <TouchableOpacity
                        style={[styles.socialButton, styles.guestButton]}
                        onPress={handleAnonymousSignIn}
                        disabled={isLoading}
                    >
                        <Text style={styles.socialButtonText}>Continue as Guest</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContainer: {
        flexGrow: 1,
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 30,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
    },
    authButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 5,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    authButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    toggleAuthText: {
        marginTop: 20,
        textAlign: 'center',
        color: '#4CAF50',
        fontSize: 14,
    },
    socialContainer: {
        alignItems: 'center',
    },
    orText: {
        marginVertical: 20,
        fontSize: 16,
        color: '#666',
    },
    socialButton: {
        width: '100%',
        padding: 15,
        borderRadius: 5,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    googleButton: {
        backgroundColor: '#DB4437',
    },
    appleButton: {
        width: '100%',
        height: 50,
        marginBottom: 15,
    },
    guestButton: {
        backgroundColor: '#666',
    },
    socialButtonText: {
        color: 'white',
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default Auth; 