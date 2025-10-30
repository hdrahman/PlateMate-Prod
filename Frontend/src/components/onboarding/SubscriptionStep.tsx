import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/user';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SubscriptionStepProps {
    profile: UserProfile;
    onComplete: () => void;
}

// Subscription plan options
const subscriptionPlans = [
    {
        id: 'free_trial',
        title: 'Free Trial',
        price: 'Free for 14 days',
        description: 'Try all premium features free for 14 days',
        features: [
            'AI-powered meal recommendations',
            'Food photo analysis',
            'Nutritional tracking',
            'Limited meal plans',
        ],
        isPopular: false,
        color: '#777',
    },
    {
        id: 'premium_monthly',
        title: 'Premium Monthly',
        price: '$9.99/month',
        description: 'Full access to all premium features',
        features: [
            'AI-powered meal recommendations',
            'Unlimited food photo analysis',
            'Comprehensive nutrition tracking',
            'Unlimited meal plans',
            'Premium recipes',
            'Priority support',
        ],
        isPopular: true,
        color: '#0074dd',
    },
    {
        id: 'premium_annual',
        title: 'Premium Annual',
        price: '$89.99/year',
        description: 'Save 25% with annual billing',
        features: [
            'All Premium Monthly features',
            '25% discount compared to monthly',
            'Exclusive annual member perks',
            'Early access to new features',
        ],
        isPopular: false,
        color: '#dd0095',
    },
];

const SubscriptionStep: React.FC<SubscriptionStepProps> = ({ profile, onComplete }) => {
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(false);
    const [showTrialPopup, setShowTrialPopup] = useState(true);
    const navigation = useNavigation();
    const { completeOnboarding, updateProfile } = useOnboarding();
    const { signUp } = useAuth();

    const handleStartTrial = async () => {
        // Automatically create account and start 20-day premium trial
        if (profile.email && profile.password) {
            setIsLoading(true);
            try {
                console.log('Creating account with collected profile data:', profile.email);

                // Create the account using collected info
                await signUp(profile.email, profile.password);

                console.log('Account created successfully');

                // Calculate trial end date (20 days from now)
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 20);

                // Auto-start 20-day premium trial
                await updateProfile({
                    premium: true,
                    trialEndDate: trialEndDate.toISOString(),
                });

                console.log('✅ 20-day premium trial activated');

                // Wait for auth state to fully propagate
                console.log('⏳ Waiting for auth state to propagate...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

                // Retry mechanism for completing onboarding
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries) {
                    try {
                        await completeOnboarding();
                        console.log('✅ Onboarding completed successfully');
                        break;
                    } catch (error) {
                        retryCount++;
                        console.log(`⚠️ Onboarding completion attempt ${retryCount} failed:`, error);

                        if (retryCount < maxRetries) {
                            console.log(`🔄 Retrying in ${retryCount} seconds...`);
                            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
                        } else {
                            throw error;
                        }
                    }
                }

                onComplete();
            } catch (error) {
                console.error('Account creation error:', error);
                Alert.alert('Error', 'Failed to create account. Please try again.');
            } finally {
                setIsLoading(false);
            }
        } else {
            Alert.alert('Error', 'Missing account information. Please go back and complete your profile.');
        }
    };

    const handleSkipAccount = async () => {
        Alert.alert(
            'Continue Without Account?',
            'You can create an account later to sync your data across devices.',
            [
                { text: 'Create Account', style: 'default' },
                {
                    text: 'Skip for Now',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Complete onboarding without account
                            await completeOnboarding();

                            // Let the parent component handle navigation
                            onComplete();
                        } catch (error) {
                            console.error('Error completing onboarding:', error);
                            Alert.alert('Error', 'Failed to complete setup. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <>
            <ScrollView
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.welcomeHeader}>
                    <LinearGradient
                        colors={['#0074dd', '#5c00dd', '#dd0095']}
                        style={styles.crownIcon}
                    >
                        <MaterialCommunityIcons name="crown" size={32} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.title}>Welcome to PlateMate Premium!</Text>
                    <Text style={styles.subtitle}>We've automatically started your 20-day free trial</Text>
                </View>

                <View style={styles.trialCard}>
                    <View style={styles.trialHeader}>
                        <View style={styles.trialIconContainer}>
                            <Ionicons name="time-outline" size={24} color="#0074dd" />
                        </View>
                        <Text style={styles.trialTitle}>20-Day Premium Trial</Text>
                    </View>
                    <Text style={styles.trialDescription}>
                        You now have full access to all premium features for 20 days, completely free!
                    </Text>

                    <View style={styles.featuresContainer}>
                        {[
                            'AI-powered meal recommendations',
                            'Unlimited food photo analysis',
                            'Comprehensive nutrition tracking',
                            'Premium recipes & meal plans',
                            'Priority support'
                        ].map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#0074dd" style={styles.featureIcon} />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.extendTrialCard}>
                    <View style={styles.extendHeader}>
                        <Ionicons name="card-outline" size={20} color="#ff6b35" />
                        <Text style={styles.extendTitle}>Want another 10 days?</Text>
                    </View>
                    <Text style={styles.extendDescription}>
                        Add your credit card to extend your trial to 30 days total. No charge until after the trial ends.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleStartTrial}
                    disabled={isLoading}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.buttonText}>Get Started with Free Trial</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Show collected user info */}
                <View style={styles.userInfoContainer}>
                    <View style={styles.profileIconContainer}>
                        <Ionicons name="person-circle" size={40} color="#0074dd" />
                    </View>
                    <View style={styles.userInfoTextContainer}>
                        <Text style={styles.userInfoText}>
                            {profile.firstName}
                        </Text>
                        <Text style={styles.userInfoEmail}>{profile.email}</Text>
                    </View>
                    <View style={styles.checkmarkContainer}>
                        <Ionicons name="checkmark-circle" size={24} color="#00dd74" />
                    </View>
                </View>

                <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>
                        By continuing, you agree to our{' '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => (navigation as any).navigate('LegalTerms')}
                        >
                            Terms of Service
                        </Text>
                        {' '}and{' '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => (navigation as any).navigate('PrivacyPolicy')}
                        >
                            Privacy Policy
                        </Text>
                        .
                    </Text>
                </View>
            </ScrollView>

            {/* Trial Notification Popup */}
            {showTrialPopup && (
                <View style={styles.popupOverlay}>
                    <View style={styles.popupContainer}>
                        <LinearGradient
                            colors={['#0074dd', '#5c00dd']}
                            style={styles.popupHeader}
                        >
                            <MaterialCommunityIcons name="gift" size={40} color="#fff" />
                            <Text style={styles.popupTitle}>Welcome Gift!</Text>
                        </LinearGradient>
                        <View style={styles.popupContent}>
                            <Text style={styles.popupText}>
                                🎉 Congratulations! We've automatically activated your 20-day Premium trial.
                            </Text>
                            <Text style={styles.popupSubtext}>
                                Enjoy all premium features free for 20 days. If you want to extend it to 30 days total, just add your credit card anytime.
                            </Text>
                            <TouchableOpacity
                                style={styles.popupButton}
                                onPress={() => setShowTrialPopup(false)}
                            >
                                <Text style={styles.popupButtonText}>Awesome, Thanks!</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 32,
        textAlign: 'center',
    },
    plansContainer: {
        marginBottom: 24,
        width: '100%',
    },
    planCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        width: '100%',
    },
    selectedPlan: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    popularBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: '#0074dd',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    planIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    planTitleContainer: {
        flex: 1,
    },
    planTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    planPrice: {
        color: '#aaa',
        fontSize: 14,
    },
    checkmark: {
        marginLeft: 12,
    },
    planDescription: {
        color: '#ddd',
        fontSize: 14,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    featuresContainer: {
        marginBottom: 8,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureIcon: {
        marginRight: 8,
    },
    featureText: {
        color: '#ddd',
        fontSize: 14,
    },
    guaranteeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    guaranteeIcon: {
        marginRight: 8,
    },
    guaranteeText: {
        color: '#999',
        fontSize: 14,
    },
    button: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    buttonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    termsContainer: {
        width: '100%',
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    termsText: {
        color: '#777',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    termsLink: {
        color: '#0074dd',
        textDecorationLine: 'underline',
    },
    paymentMethodsContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    paymentIconsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentIcon: {
        marginHorizontal: 10,
    },
    // Account creation form styles
    accountHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    backToPlansButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1,
    },
    backToPlansText: {
        color: '#0074dd',
        fontSize: 16,
        marginLeft: 4,
    },
    accountIconContainer: {
        marginBottom: 16,
    },
    benefitsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    benefit: {
        alignItems: 'center',
        flex: 1,
    },
    benefitText: {
        color: '#00dd74',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    form: {
        marginBottom: 32,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        paddingVertical: 16,
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
        marginBottom: 16,
    },
    skipButton: {
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 12,
    },
    skipButtonText: {
        color: '#999',
        fontSize: 16,
    },
    userInfoContainer: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileIconContainer: {
        marginRight: 12,
    },
    userInfoTextContainer: {
        flex: 1,
    },
    userInfoText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    userInfoEmail: {
        color: '#aaa',
        fontSize: 14,
    },
    checkmarkContainer: {
        marginLeft: 12,
    },
    // New auto-trial UI styles
    welcomeHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    crownIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    trialCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.3)',
        width: '100%',
    },
    trialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    trialIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    trialTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    trialDescription: {
        color: '#ddd',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    extendTrialCard: {
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 53, 0.3)',
        width: '100%',
    },
    extendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    extendTitle: {
        color: '#ff6b35',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    extendDescription: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 18,
    },
    // Popup styles
    popupOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    popupContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 20,
        maxWidth: 350,
        width: '100%',
    },
    popupHeader: {
        padding: 24,
        alignItems: 'center',
    },
    popupTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 12,
    },
    popupContent: {
        padding: 24,
        paddingTop: 0,
    },
    popupText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 22,
    },
    popupSubtext: {
        color: '#aaa',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    popupButton: {
        backgroundColor: '#0074dd',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    popupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SubscriptionStep; 