import React, { useState, useEffect, useRef, useContext } from 'react';
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
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import LoadingScreen from '../components/LoadingScreen';

// Import types from our type definitions
import '../types/expo-apple-authentication.d.ts';

// Safe import AppleAuthentication module
let AppleAuthentication: any = null;
try {
    if (Platform.OS === 'ios') {
        AppleAuthentication = require('expo-apple-authentication');
        console.log('Apple Authentication module loaded');
    }
} catch (error) {
    console.log('Apple Authentication not available', error);
}

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
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [showSignedInState, setShowSignedInState] = useState(false);
    const { signIn, signUp, signInWithGoogle, signInWithApple, signOut, user } = useAuth();

    // Animation refs
    const logoScale = useRef(new Animated.Value(0.9)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const cardSlideY = useRef(new Animated.Value(30)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const socialButtonsOpacity = useRef(new Animated.Value(0)).current;

    // Get navigation parameters
    const returnTo = route?.params?.returnTo;
    const skipIntroSteps = route?.params?.skipIntroSteps;

    // Check if Apple Authentication is available (iOS only)
    useEffect(() => {
        const checkAppleAuth = async () => {
            if (AppleAuthentication && Platform.OS === 'ios') {
                try {
                    const isAvailable = await AppleAuthentication.isAvailableAsync();
                    setIsAppleAuthAvailable(isAvailable);
                    console.log('Apple Authentication available:', isAvailable);
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

    // Detect if user is already signed in but stuck on Auth screen
    useEffect(() => {
        // If user exists but we're still on Auth screen after a delay, show signed-in state
        if (user) {
            const timer = setTimeout(() => {
                setShowSignedInState(true);
            }, 2000); // Wait 2 seconds to allow normal navigation to complete
            return () => clearTimeout(timer);
        } else {
            setShowSignedInState(false);
        }
    }, [user]);

    const handleAuth = async () => {
        // If user is already signed in, sign them out
        if (showSignedInState) {
            setIsLoading(true);
            try {
                await signOut();
                setShowSignedInState(false);
            } catch (error) {
                console.error('Error signing out:', error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

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
        console.log('🔵 Google Sign-In button pressed');
        setIsLoading(true);
        try {
            console.log('🔵 Calling signInWithGoogle...');
            const result = await signInWithGoogle();
            console.log('🔵 Google Sign-In result:', result);
        } catch (error) {
            console.error('🔴 Google Sign-In error in Auth component:', error);
            // Error is already handled in auth context
        } finally {
            setIsLoading(false);
            console.log('🔵 Google Sign-In process completed');
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

    // Show loading screen if user is authenticated and navigation is expected
    // Don't show loading if we're in the stuck state (showSignedInState = true)
    if (user && !showSignedInState) {
        return <LoadingScreen message="Signing you in..." />;
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

            {/* Simplified Background */}
            <LinearGradient
                colors={isDarkTheme ? ['#121212', '#1a1a1a', '#121212'] : [theme.colors.background, theme.colors.cardBackground, theme.colors.background]}
                style={styles.background}
            />

            {/* Subtle Floating Background Elements */}
            <View style={styles.floatingElementsContainer}>
                <FloatingElement delay={0} duration={8000}>
                    <View style={[styles.floatingShape, styles.shape1, { backgroundColor: isDarkTheme ? 'rgba(155, 0, 255, 0.05)' : 'rgba(155, 0, 255, 0.1)' }]} />
                </FloatingElement>
                <FloatingElement delay={2000} duration={6000}>
                    <View style={[styles.floatingShape, styles.shape2, { backgroundColor: isDarkTheme ? 'rgba(0, 116, 221, 0.08)' : 'rgba(0, 116, 221, 0.12)' }]} />
                </FloatingElement>
                <FloatingElement delay={4000} duration={7000}>
                    <View style={[styles.floatingShape, styles.shape3, { backgroundColor: isDarkTheme ? 'rgba(221, 0, 149, 0.04)' : 'rgba(221, 0, 149, 0.08)' }]} />
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
                            <View style={[styles.logoCircle, { backgroundColor: theme.colors.cardBackground }]}>
                                <Image
                                    source={require('../../assets/icon2-edited.png')}
                                    style={styles.logoImage}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>

                        <Text style={[styles.title, { color: theme.colors.text }]}>PlateMate</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
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
                            <View style={[styles.card, { backgroundColor: theme.colors.cardBackground }]}>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.formTitle, { color: theme.colors.text }]}>
                                        {showSignedInState ? 'Already Signed In' : (isLogin ? 'Welcome Back' : 'Create Account')}
                                    </Text>
                                    <Text style={[styles.formSubtitle, { color: theme.colors.textSecondary }]}>
                                        {showSignedInState
                                            ? 'You are currently signed in. Sign out to switch accounts or try onboarding again.'
                                            : (isLogin
                                                ? 'Sign in to continue your journey'
                                                : 'Join thousands transforming their health')}
                                    </Text>

                                    {!showSignedInState && (
                                        <>
                                            {/* Email Input */}
                                            <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                                <Ionicons name="mail-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                                                <TextInput
                                                    style={[styles.input, { color: theme.colors.text }]}
                                                    placeholder="Email address"
                                                    placeholderTextColor={theme.colors.textSecondary}
                                                    value={email}
                                                    onChangeText={setEmail}
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    autoCorrect={false}
                                                />
                                            </View>

                                            {/* Password Input */}
                                            <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                                                <TextInput
                                                    style={[styles.input, { color: theme.colors.text }]}
                                                    placeholder="Password"
                                                    placeholderTextColor={theme.colors.textSecondary}
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
                                                        color={theme.colors.textSecondary}
                                                    />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Forgot Password Link (Sign In only) */}
                                            {isLogin && (
                                                <TouchableOpacity
                                                    onPress={() => navigation.navigate('ForgotPassword')}
                                                    style={styles.forgotPasswordButton}
                                                >
                                                    <Text style={[styles.forgotPasswordText, { color: theme.colors.primary }]}>Forgot Password?</Text>
                                                </TouchableOpacity>
                                            )}

                                            {/* Confirm Password Input (Sign Up only) */}
                                            {!isLogin && (
                                                <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                                                    <TextInput
                                                        style={[styles.input, { color: theme.colors.text }]}
                                                        placeholder="Confirm password"
                                                        placeholderTextColor={theme.colors.textSecondary}
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
                                                            color={theme.colors.textSecondary}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </>
                                    )}

                                    {/* Main Auth Button */}
                                    <TouchableOpacity
                                        style={styles.authButton}
                                        onPress={handleAuth}
                                        disabled={isLoading}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={showSignedInState ? ["#dd0095", "#9B00FF", "#dd0095"] : ["#0074dd", "#5c00dd", "#dd0095"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.authButtonGradient}
                                        />
                                        <View style={styles.authButtonContent}>
                                            {isLoading ? (
                                                <ActivityIndicator color="#ffffff" size="small" />
                                            ) : (
                                                <Text style={styles.authButtonText}>
                                                    {showSignedInState ? 'Sign Out' : (isLogin ? 'Sign In' : 'Create Account')}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>

                                    {/* Toggle Auth Mode - only show if not in signed-in state */}
                                    {!showSignedInState && (
                                        <TouchableOpacity onPress={toggleAuthMode} style={styles.toggleContainer}>
                                            <Text style={[styles.toggleAuthText, { color: theme.colors.textSecondary }]}>
                                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                                <Text style={[styles.toggleAuthHighlight, { color: theme.colors.primary }]}>
                                                    {isLogin ? "Sign up" : "Sign in"}
                                                </Text>
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Social Login Section - only show if not in signed-in state */}
                    {!showSignedInState && (
                        <Animated.View
                            style={[
                                styles.socialContainer,
                                { opacity: socialButtonsOpacity }
                            ]}
                        >
                            <View style={styles.dividerContainer}>
                                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                                <Text style={[styles.orText, { color: theme.colors.textSecondary }]}>or continue with</Text>
                                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                            </View>

                            <TouchableOpacity
                                style={[styles.socialButton, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                                onPress={handleGoogleSignIn}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                <View style={styles.socialButtonContent}>
                                    <Ionicons name="logo-google" size={20} color={theme.colors.text} style={styles.socialIcon} />
                                    <Text style={[styles.socialButtonText, { color: theme.colors.text }]}>Continue with Google</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Apple Sign-In (iOS only) */}
                            {isAppleAuthAvailable && (
                                <TouchableOpacity
                                    style={[styles.socialButton, styles.appleButton, { borderColor: theme.colors.border }]}
                                    onPress={handleAppleSignIn}
                                    disabled={isLoading}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.socialButtonContent}>
                                        <Ionicons name="logo-apple" size={22} color="#FFF" style={styles.socialIcon} />
                                        <Text style={styles.socialButtonText}>Continue with Apple</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        top: '15%',
        left: '10%',
    },
    shape2: {
        width: 60,
        height: 60,
        top: '25%',
        right: '15%',
    },
    shape3: {
        width: 100,
        height: 100,
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
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 16,
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
    },
    formSubtitle: {
        fontSize: 15,
        marginBottom: 28,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 8,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: 8,
        marginBottom: 8,
        paddingVertical: 4,
    },
    forgotPasswordText: {
        fontSize: 14,
        fontWeight: '600',
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
        textAlign: 'center',
    },
    toggleAuthHighlight: {
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
    },
    orText: {
        fontSize: 12,
        marginHorizontal: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    socialButton: {
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    appleButton: {
        backgroundColor: '#000',
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
    },
});

export default Auth; 