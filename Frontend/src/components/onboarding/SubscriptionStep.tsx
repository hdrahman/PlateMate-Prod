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
    const [selectedPlan, setSelectedPlan] = useState<string>('free_trial');
    const [isLoading, setIsLoading] = useState(false);
    const navigation = useNavigation();
    const { completeOnboarding, profile: onboardingProfile } = useOnboarding();
    const { signUp } = useAuth();

    const handleSubscribe = async () => {
        // Automatically create account using collected profile data
        if (profile.email && profile.password) {
            setIsLoading(true);
            try {
                console.log('Creating account with collected profile data:', profile.email);

                // Create the account using collected info
                await signUp(profile.email, profile.password);

                console.log('Account created successfully');

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

                if (selectedPlan === 'free_trial') {
                    // Let the parent onboarding component handle navigation
                    onComplete();
                } else {
                    // Let the parent onboarding component handle navigation first
                    onComplete();

                    // Then show premium options after navigation is complete
                    setTimeout(() => {
                        Alert.alert(
                            'Upgrade to Premium',
                            'Would you like to view premium subscription options now?',
                            [
                                {
                                    text: 'Not Now',
                                    style: 'cancel'
                                },
                                {
                                    text: 'View Options',
                                    onPress: () => {
                                        // Navigate to premium screen after the main app is loaded
                                        setTimeout(() => {
                                            navigation.navigate('PremiumSubscription' as never);
                                        }, 1000);
                                    }
                                },
                            ]
                        );
                    }, 500);
                }
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
        <ScrollView
            contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.title}>Choose Your Plan</Text>
            <Text style={styles.subtitle}>Start with a free trial or upgrade now</Text>

            <View style={styles.plansContainer}>
                {subscriptionPlans.map((plan) => (
                    <TouchableOpacity
                        key={plan.id}
                        style={[
                            styles.planCard,
                            selectedPlan === plan.id && styles.selectedPlan,
                        ]}
                        onPress={() => setSelectedPlan(plan.id)}
                    >
                        {plan.isPopular && (
                            <View style={styles.popularBadge}>
                                <Text style={styles.popularText}>MOST POPULAR</Text>
                            </View>
                        )}

                        <View style={styles.planHeader}>
                            <LinearGradient
                                colors={[plan.color, plan.color + '80']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.planIcon}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        plan.id === 'free_trial'
                                            ? 'clock-outline'
                                            : plan.id === 'premium_annual'
                                                ? 'star'
                                                : 'crown'
                                    }
                                    size={24}
                                    color="#fff"
                                />
                            </LinearGradient>
                            <View style={styles.planTitleContainer}>
                                <Text style={styles.planTitle}>{plan.title}</Text>
                                <Text style={styles.planPrice}>{plan.price}</Text>
                            </View>
                            {selectedPlan === plan.id && (
                                <View style={styles.checkmark}>
                                    <Ionicons name="checkmark-circle" size={24} color="#0074dd" />
                                </View>
                            )}
                        </View>

                        <Text style={styles.planDescription}>{plan.description}</Text>

                        <View style={styles.featuresContainer}>
                            {plan.features.map((feature, index) => (
                                <View key={index} style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={16} color={plan.color} style={styles.featureIcon} />
                                    <Text style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.guaranteeContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#999" style={styles.guaranteeIcon} />
                <Text style={styles.guaranteeText}>
                    30-day money-back guarantee. Cancel anytime.
                </Text>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleSubscribe}
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
                            <Text style={styles.buttonText}>
                                {selectedPlan === 'free_trial' ? 'Start Free Trial' : 'Subscribe Now'}
                            </Text>
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
                        {profile.firstName} {profile.lastName}
                    </Text>
                    <Text style={styles.userInfoEmail}>{profile.email}</Text>
                </View>
                <View style={styles.checkmarkContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#00dd74" />
                </View>
            </View>

            <Text style={styles.termsText}>
                By continuing, you agree to our Terms of Service and Privacy Policy. We'll send a receipt to your email.
            </Text>

            <View style={styles.paymentMethodsContainer}>
                <View style={styles.paymentIconsRow}>
                    <MaterialCommunityIcons name="credit-card" size={24} color="#999" style={styles.paymentIcon} />
                    <MaterialCommunityIcons name="apple" size={24} color="#999" style={styles.paymentIcon} />
                    <MaterialCommunityIcons name="google-play" size={24} color="#999" style={styles.paymentIcon} />
                    <MaterialCommunityIcons name="currency-usd" size={24} color="#999" style={styles.paymentIcon} />
                </View>
            </View>
        </ScrollView>
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
    termsText: {
        color: '#777',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
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
});

export default SubscriptionStep; 