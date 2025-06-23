import React, { useState, useEffect, useRef } from 'react';
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
    Animated,
    Easing,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Import types from our type definitions
import '../types/expo-apple-authentication.d.ts';

// Safe import AppleAuthentication module
let AppleAuthentication: any = null;
// We've removed the Apple Authentication module, so this will always be null
console.log('Apple Authentication not available');

const { width, height } = Dimensions.get('window');

// Floating animation component
const FloatingElement = ({ children, delay = 0, duration = 4000 }: any) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animate = () => {
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(translateY, {
                        toValue: -15,
                        duration: duration / 2,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: 0,
                        duration: duration / 2,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 0.6,
                        duration: duration / 2,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.3,
                        duration: duration / 2,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ]).start(() => animate());
        };

        const timeout = setTimeout(() => animate(), delay);
        return () => clearTimeout(timeout);
    }, [translateY, opacity, delay, duration]);

    return (
        <Animated.View style={[
            { transform: [{ translateY }], opacity },
            children.props.style
        ]}>
            {children}
        </Animated.View>
    );
};

const Auth = ({ navigation, route }: any) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const { signIn, signUp, signInWithGoogle, signInWithApple, signInAnonymously, user } = useAuth();

    // Animation refs
    const logoScale = useRef(new Animated.Value(0.9)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const cardSlideY = useRef(new Animated.Value(30)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const socialButtonsOpacity = useRef(new Animated.Value(0)).current;

    // Get navigation parameters
    const returnTo = route?.params?.returnTo;
    const skipIntroSteps = route?.params?.skipIntroSteps;

    // We've removed Apple Authentication, so it's not available
    useEffect(() => {
        setIsAppleAuthAvailable(false);
    }, []);

    // Initial animations
    useEffect(() => {
        const animateIn = () => {
            Animated.sequence([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.parallel([
                    Animated.timing(logoScale, {
                        toValue: 1,
                        duration: 500,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(cardOpacity, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(cardSlideY, {
                        toValue: 0,
                        duration: 500,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.timing(socialButtonsOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        };

        const timeout = setTimeout(animateIn, 100);
        return () => clearTimeout(timeout);
    }, []);

    // Handle navigation after successful authentication
    useEffect(() => {
        if (user && returnTo) {
            console.log('User authenticated, navigating to:', returnTo);
            if (returnTo === 'onboarding' && skipIntroSteps) {
                // Navigate back to onboarding which will now start at step 4
                navigation.navigate('Onboarding');
            }
            // Add other navigation cases here if needed
        }
    }, [user, returnTo, skipIntroSteps, navigation]);

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
                navigation.navigate('Onboarding');
                setIsLoading(false);
                return;
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
        // ✅ Updated: "Sign up" navigates to onboarding, "Sign in" toggles back to login
        if (isLogin) {
            // When in login mode and user clicks "Sign up", navigate to onboarding
            navigation.navigate('Onboarding');
            return;
        } else {
            // When in signup mode and user clicks "Sign in", toggle back to login
            // Animate the transition
            Animated.sequence([
                Animated.timing(cardOpacity, {
                    toValue: 0.5,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            setIsLogin(true);
            setPassword('');
            setConfirmPassword('');
            setPasswordVisible(false);
            setConfirmPasswordVisible(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Simplified Background */}
            <LinearGradient
                colors={['#121212', '#1a1a1a', '#121212']}
                style={styles.background}
            />

            {/* Subtle Floating Background Elements */}
            <View style={styles.floatingElementsContainer}>
                <FloatingElement delay={0} duration={8000}>
                    <View style={[styles.floatingShape, styles.shape1]} />
                </FloatingElement>
                <FloatingElement delay={2000} duration={6000}>
                    <View style={[styles.floatingShape, styles.shape2]} />
                </FloatingElement>
                <FloatingElement delay={4000} duration={7000}>
                    <View style={[styles.floatingShape, styles.shape3]} />
                </FloatingElement>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo Section */}
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                opacity: logoOpacity,
                                transform: [{ scale: logoScale }]
                            }
                        ]}
                    >
                        <View style={styles.logoWrapper}>
                            <LinearGradient
                                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                style={styles.logoGradientRing}
                            />
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require('../../assets/icon2.png')}
                                    style={styles.logoImage}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>

                        <Text style={styles.title}>PlateMate</Text>
                        <Text style={styles.subtitle}>
                            Your AI-Powered Nutrition Journey
                        </Text>
                    </Animated.View>

                    {/* Form Card */}
                    <Animated.View
                        style={[
                            styles.cardContainer,
                            {
                                opacity: cardOpacity,
                                transform: [{ translateY: cardSlideY }]
                            }
                        ]}
                    >
                        <View style={styles.gradientBorderWrapper}>
                            <LinearGradient
                                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                style={styles.gradientBorder}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                            <View style={styles.card}>
                                <View style={styles.cardContent}>
                                    <Text style={styles.formTitle}>
                                        {isLogin ? 'Welcome Back' : 'Create Account'}
                                    </Text>
                                    <Text style={styles.formSubtitle}>
                                        {isLogin
                                            ? 'Sign in to continue your journey'
                                            : 'Join thousands transforming their health'}
                                    </Text>

                                    {/* Email Input */}
                                    <View style={styles.inputContainer}>
                                        <Ionicons name="mail-outline" size={20} color="#9B00FF" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Email address"
                                            placeholderTextColor="#777"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>

                                    {/* Password Input */}
                                    <View style={styles.inputContainer}>
                                        <Ionicons name="lock-closed-outline" size={20} color="#9B00FF" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Password"
                                            placeholderTextColor="#777"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!passwordVisible}
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setPasswordVisible(!passwordVisible)}
                                            style={styles.eyeIcon}
                                        >
                                            <Ionicons
                                                name={passwordVisible ? "eye-outline" : "eye-off-outline"}
                                                size={20}
                                                color="#777"
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Confirm Password Input (Sign Up only) */}
                                    {!isLogin && (
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="lock-closed-outline" size={20} color="#9B00FF" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Confirm password"
                                                placeholderTextColor="#777"
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry={!confirmPasswordVisible}
                                                autoCorrect={false}
                                            />
                                            <TouchableOpacity
                                                onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                                                style={styles.eyeIcon}
                                            >
                                                <Ionicons
                                                    name={confirmPasswordVisible ? "eye-outline" : "eye-off-outline"}
                                                    size={20}
                                                    color="#777"
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* Main Auth Button */}
                                    <TouchableOpacity
                                        style={styles.authButton}
                                        onPress={handleAuth}
                                        disabled={isLoading}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.authButtonGradient}
                                        />
                                        <View style={styles.authButtonContent}>
                                            {isLoading ? (
                                                <ActivityIndicator color="#ffffff" size="small" />
                                            ) : (
                                                <Text style={styles.authButtonText}>
                                                    {isLogin ? 'Sign In' : 'Create Account'}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>

                                    {/* Toggle Auth Mode */}
                                    <TouchableOpacity onPress={toggleAuthMode} style={styles.toggleContainer}>
                                        <Text style={styles.toggleAuthText}>
                                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                                            <Text style={styles.toggleAuthHighlight}>
                                                {isLogin ? "Sign up" : "Sign in"}
                                            </Text>
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Social Login Section */}
                    <Animated.View
                        style={[
                            styles.socialContainer,
                            { opacity: socialButtonsOpacity }
                        ]}
                    >
                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.orText}>or continue with</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={handleGoogleSignIn}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <View style={styles.socialButtonContent}>
                                <Ionicons name="logo-google" size={20} color="#FFF" style={styles.socialIcon} />
                                <Text style={styles.socialButtonText}>Continue with Google</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleAnonymousSignIn}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.guestButtonText}>
                                <Ionicons name="person-outline" size={16} color="#9B00FF" /> Continue as Guest
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    floatingElementsContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    floatingShape: {
        position: 'absolute',
        borderRadius: 50,
    },
    shape1: {
        width: 80,
        height: 80,
        backgroundColor: 'rgba(155, 0, 255, 0.05)',
        top: '15%',
        left: '10%',
    },
    shape2: {
        width: 60,
        height: 60,
        backgroundColor: 'rgba(0, 116, 221, 0.08)',
        top: '25%',
        right: '15%',
    },
    shape3: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(221, 0, 149, 0.04)',
        bottom: '20%',
        right: '10%',
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        paddingTop: Platform.OS === 'ios' ? 100 : 80,
        paddingBottom: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoWrapper: {
        position: 'relative',
        marginBottom: 20,
    },
    logoGradientRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        top: -5,
        left: -5,
        zIndex: 0,
    },
    logoCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        overflow: 'hidden',
        backgroundColor: '#1E1E1E',
        shadowColor: "#9B00FF",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 1,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#777',
        textAlign: 'center',
        lineHeight: 20,
    },
    cardContainer: {
        width: '100%',
        marginBottom: 30,
    },
    gradientBorderWrapper: {
        borderRadius: 16,
        padding: 1.5,
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 15,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    cardContent: {
        padding: 24,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        color: 'white',
    },
    formSubtitle: {
        fontSize: 15,
        color: '#777',
        marginBottom: 28,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#333',
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
    eyeIcon: {
        padding: 8,
    },
    authButton: {
        marginTop: 8,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: "#9B00FF",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    authButtonGradient: {
        borderRadius: 12,
    },
    authButtonContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
    },
    authButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    toggleContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    toggleAuthText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
    },
    toggleAuthHighlight: {
        color: '#9B00FF',
        fontWeight: '600',
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
        color: '#777',
        marginHorizontal: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    socialButton: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    socialButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    socialIcon: {
        marginRight: 12,
    },
    socialButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFF',
    },
    guestButton: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    guestButtonText: {
        fontSize: 14,
        color: '#9B00FF',
        fontWeight: '500',
    },
});

export default Auth; 