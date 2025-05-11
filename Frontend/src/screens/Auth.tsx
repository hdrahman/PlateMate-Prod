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
    Dimensions,
    StatusBar,
    ImageBackground,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaskedView from '@react-native-masked-view/masked-view';

// Import types from our type definitions
import '../types/expo-apple-authentication.d.ts';

// Safe import AppleAuthentication module
let AppleAuthentication: any = null;
// We've removed the Apple Authentication module, so this will always be null
console.log('Apple Authentication not available');

const { width, height } = Dimensions.get('window');

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
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#000000', '#121212']}
                style={styles.background}
            />

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.logoGradient}
                        >
                            <Image
                                source={require('../../assets/Cropped2.jpg')}
                                style={styles.logoImage}
                                resizeMode="cover"
                            />
                        </LinearGradient>
                        <Text style={styles.title}>PlateMate</Text>
                        <Text style={styles.subtitle}>AI-Powered Nutrition & Fitness Tracker</Text>
                    </View>

                    <View style={styles.cardWrapper}>
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.cardGradient}
                        />
                        <View style={styles.card}>
                            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
                            <Text style={styles.formSubtitle}>
                                {isLogin
                                    ? 'Sign in to continue tracking your nutrition journey'
                                    : 'Join PlateMate to start your health transformation'}
                            </Text>

                            <View style={styles.inputContainer}>
                                <Ionicons name="mail-outline" size={22} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="#999"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={22} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#999"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            {!isLogin && (
                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed-outline" size={22} color="#999" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm Password"
                                        placeholderTextColor="#999"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.authButton}
                                onPress={handleAuth}
                                disabled={isLoading}
                            >
                                <LinearGradient
                                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.authButtonGradient}
                                />
                                {isLoading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator color="#5c00dd" />
                                    </View>
                                ) : (
                                    <View style={styles.authButtonContent}>
                                        <MaskedView
                                            style={{ flex: 1, height: 50 }}
                                            maskElement={
                                                <View style={styles.gradientTextContainer}>
                                                    <Text style={styles.authButtonText}>
                                                        {isLogin ? 'Sign In' : 'Sign Up'}
                                                    </Text>
                                                </View>
                                            }
                                        >
                                            <LinearGradient
                                                colors={["#00ccff", "#ff00aa"]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={{ flex: 1 }}
                                            />
                                        </MaskedView>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={toggleAuthMode}>
                                <Text style={styles.toggleAuthText}>
                                    {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.socialContainer}>
                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.orText}>OR CONTINUE WITH</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <View style={styles.socialButtonInner}>
                                <Ionicons name="logo-google" size={20} color="#DD4B39" style={styles.socialIcon} />
                                <MaskedView
                                    style={{ flex: 1, height: 20 }}
                                    maskElement={
                                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                                    }
                                >
                                    <LinearGradient
                                        colors={["#DD4B39", "#EB5E56"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ flex: 1 }}
                                    />
                                </MaskedView>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingTop: 80,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    logoImage: {
        width: 76,
        height: 76,
        borderRadius: 38,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        maxWidth: '80%',
    },
    cardWrapper: {
        width: '100%',
        marginBottom: 30,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    cardGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    card: {
        margin: 1,
        borderRadius: 15,
        backgroundColor: '#121212',
        padding: 24,
    },
    formTitle: {
        fontSize: 30,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        color: 'white',
        letterSpacing: 0.5,
    },
    formSubtitle: {
        fontSize: 15,
        color: '#aaa',
        marginBottom: 28,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: 'white',
        paddingVertical: 16,
        fontSize: 16,
    },
    authButton: {
        borderRadius: 12,
        marginTop: 8,
        overflow: 'hidden',
        position: 'relative',
        height: 50,
    },
    authButtonGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 12,
    },
    authButtonContent: {
        flex: 1,
        margin: 1.5,
        borderRadius: 10,
        backgroundColor: '#1a1a1a',
        position: 'relative',
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        margin: 1.5,
        borderRadius: 10,
        backgroundColor: '#1a1a1a',
    },
    gradientTextContainer: {
        flex: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    authButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.8,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
    },
    toggleAuthText: {
        marginTop: 20,
        textAlign: 'center',
        color: '#0074dd',
        fontSize: 15,
    },
    socialContainer: {
        width: '100%',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#333',
    },
    orText: {
        fontSize: 12,
        color: '#999',
        marginHorizontal: 10,
    },
    socialButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    socialIcon: {
        marginRight: 12,
    },
    socialButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    googleButton: {
        marginBottom: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#DD4B39',
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
    },
});

export default Auth; 