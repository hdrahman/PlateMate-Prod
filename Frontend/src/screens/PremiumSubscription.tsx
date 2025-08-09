import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    Text,
    StyleSheet,
    View,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
    Animated,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getSubscriptionStatus,
    updateSubscriptionStatus,
    cancelSubscription
} from '../utils/database';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';
import SubscriptionService from '../services/SubscriptionService';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

// Define subscription plan type
interface PlanOption {
    id: string;
    title: string;
    monthlyPrice: number;
    annualPrice: number;
    gradient: string[];
    features: string[];
    bestValue?: boolean;
    subscriptionType: SubscriptionStatus;
    imageUploads: string;
}

const { width } = Dimensions.get('window');

const PremiumSubscription = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isAnnual, setIsAnnual] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionDetails | null>(null);
    const [revenueCatOfferings, setRevenueCatOfferings] = useState<PurchasesOffering | null>(null);
    const [isRevenueCatLoading, setIsRevenueCatLoading] = useState(true);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));

    const plans: PlanOption[] = [
        {
            id: 'free',
            title: 'Free',
            monthlyPrice: 0,
            annualPrice: 0,
            gradient: ['#333333', '#1A1A1A'],
            subscriptionType: 'expired', // Free users are technically expired
            imageUploads: '1 image upload per day',
            features: [
                'Unlimited food search',
                'Barcode scanning support',
                'Basic nutrition tracking',
                'Manual food logging',
                'Basic meal insights'
            ]
        },
        {
            id: 'premium',
            title: 'Premium',
            monthlyPrice: 6.99,  // Updated pricing
            annualPrice: 59.99,  // Updated pricing
            gradient: ['#5A60EA', '#FF00F5'],
            subscriptionType: isAnnual ? 'premium_annual' : 'premium_monthly',
            bestValue: true,
            imageUploads: 'Unlimited image uploads',
            features: [
                'Unlimited AI-powered food analysis',
                'Advanced meal planning with recipes',
                'Context-aware AI health coaching',
                'Unlimited image uploads',
                'Personalized nutrition insights',
                'Custom meal recommendations',
                '20-day free trial (30 days with payment method)',
                'Priority support'
            ]
        }
    ];

    useEffect(() => {
        const loadSubscriptionData = async () => {
            try {
                if (user?.uid) {
                    // Initialize RevenueCat if not already done
                    await SubscriptionService.initialize(user.uid);
                    
                    // Load RevenueCat offerings
                    setIsRevenueCatLoading(true);
                    const offerings = await SubscriptionService.getOfferings();
                    setRevenueCatOfferings(offerings);
                    
                    // Get current subscription status from RevenueCat
                    const customerInfo = await SubscriptionService.getCustomerInfo();
                    const revenueCatStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
                    setSubscriptionStatus(revenueCatStatus);

                    // Pre-select current plan based on RevenueCat status
                    if (revenueCatStatus?.status) {
                        let planId;
                        if (['premium_monthly', 'premium_annual', 'free_trial', 'free_trial_extended'].includes(revenueCatStatus.status)) {
                            planId = 'premium';
                        } else {
                            planId = 'free';
                        }
                        setSelectedPlan(planId);
                    } else {
                        // Default to premium for new users (they'll get the trial)
                        setSelectedPlan('premium');
                    }
                    
                    setIsRevenueCatLoading(false);
                }
            } catch (error) {
                console.error('Error loading subscription data:', error);
                setIsRevenueCatLoading(false);
            }
        };

        loadSubscriptionData();

        // Animate entrance
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true
            })
        ]).start();
    }, [user]);

    const handleSubscribe = async () => {
        if (!selectedPlan) {
            Alert.alert('Error', 'Please select a subscription plan');
            return;
        }

        const selectedPlanObj = plans.find(p => p.id === selectedPlan);
        if (!selectedPlanObj) {
            Alert.alert('Error', 'Invalid plan selected');
            return;
        }

        if (selectedPlan === 'free' && subscriptionStatus?.status === 'expired') {
            Alert.alert('Already on Free Plan', 'You are already using the free version of PlateMate.');
            return;
        }

        // Handle free plan selection
        if (selectedPlan === 'free') {
            Alert.alert(
                'Downgrade Confirmation',
                'Are you sure you want to downgrade to the free plan? You will lose access to premium features.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Downgrade', 
                        style: 'destructive',
                        onPress: () => handleCancelSubscription()
                    }
                ]
            );
            return;
        }

        setIsLoading(true);

        try {
            // Handle premium subscription with RevenueCat
            if (!revenueCatOfferings || !revenueCatOfferings.availablePackages) {
                throw new Error('No subscription packages available. Please try again.');
            }

            // Find the appropriate package
            let packageToPurchase: PurchasesPackage | null = null;
            
            if (isAnnual) {
                packageToPurchase = revenueCatOfferings.availablePackages.find(
                    pkg => pkg.identifier.includes('annual')
                ) || revenueCatOfferings.annual;
            } else {
                packageToPurchase = revenueCatOfferings.availablePackages.find(
                    pkg => pkg.identifier.includes('monthly')
                ) || revenueCatOfferings.monthly;
            }

            // Fallback to any available package
            if (!packageToPurchase) {
                packageToPurchase = revenueCatOfferings.availablePackages[0];
            }

            if (!packageToPurchase) {
                throw new Error('No subscription package found');
            }

            console.log('🛒 Attempting to purchase package:', packageToPurchase.identifier);
            
            // Purchase through RevenueCat
            const { customerInfo, productIdentifier } = await SubscriptionService.purchasePackage(packageToPurchase);
            
            console.log('✅ Purchase successful:', productIdentifier);
            
            // Update local subscription status
            const updatedStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
            setSubscriptionStatus(updatedStatus);

            // Store subscription info in AsyncStorage for quick access
            await AsyncStorage.setItem('subscription_plan', 'premium');

            Alert.alert(
                'Welcome to Premium!',
                'Your subscription is now active. Enjoy unlimited access to all premium features!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Error subscribing:', error);
            
            let errorMessage = 'There was an error processing your subscription. Please try again.';
            
            if (error.message?.includes('user cancelled') || error.code === '1') {
                // User cancelled the purchase, no need to show error
                return;
            } else if (error.message?.includes('network') || error.code === '2') {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message?.includes('payment') || error.code === '3') {
                errorMessage = 'Payment method error. Please check your payment information.';
            }
            
            Alert.alert('Subscription Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!subscriptionStatus || subscriptionStatus.status === 'free') {
            Alert.alert('Error', 'You do not have an active premium subscription to cancel.');
            return;
        }

        Alert.alert(
            'Cancel Subscription',
            'Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await cancelSubscription(user?.uid);

                            // Update local state
                            setSubscriptionStatus({
                                ...subscriptionStatus,
                                canceledAt: new Date().toISOString(),
                                autoRenew: false
                            });

                            Alert.alert(
                                'Subscription Canceled',
                                'Your subscription has been canceled. You will have access until the end of your current billing period.',
                                [{ text: 'OK', onPress: () => navigation.goBack() }]
                            );
                        } catch (error) {
                            console.error('Error canceling subscription:', error);
                            Alert.alert('Error', 'There was an error canceling your subscription. Please try again.');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderPlanCard = (plan: PlanOption) => {
        const isSelected = selectedPlan === plan.id;
        const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
        const priceText = price === 0 ? 'Free' : `$${price.toFixed(2)}`;
        const period = isAnnual ? '/year' : '/month';

        // Calculate monthly equivalent for annual plan
        const monthlyEquivalent = plan.id !== 'free' && isAnnual
            ? plan.id === 'basic' ? '$4.99/month' : '$6.99/month'
            : null;

        // Check if user is currently on this plan
        const isPlanActive =
            (plan.id === 'free' && subscriptionStatus?.status === 'free') ||
            (plan.id === 'basic' && subscriptionStatus?.status === 'standard') ||
            (plan.id === 'premium' && (subscriptionStatus?.status === 'premium' || subscriptionStatus?.status === 'premium_annual'));

        return (
            <TouchableOpacity
                key={plan.id}
                style={[
                    styles.planCard,
                    isSelected && styles.selectedPlan,
                    plan.bestValue && styles.bestValueCard
                ]}
                onPress={() => setSelectedPlan(plan.id)}
            >
                <LinearGradient
                    colors={plan.gradient as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.planGradient}
                >
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>{plan.title}</Text>
                        {plan.bestValue && (
                            <View style={styles.bestValueBadge}>
                                <Text style={styles.bestValueText}>BEST VALUE</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.planPricing}>
                        <Text style={styles.planPrice}>{priceText}</Text>
                        {price > 0 && period && <Text style={styles.planPeriod}>{period}</Text>}
                    </View>

                    {monthlyEquivalent && (
                        <Text style={styles.monthlyEquivalent}>
                            {monthlyEquivalent}
                        </Text>
                    )}
                    
                    {plan.id === 'premium' && (
                        <View style={styles.trialInfo}>
                            <Ionicons name="time-outline" size={16} color="#4CAF50" />
                            <Text style={styles.trialText}>
                                Start with 20 days free • Extend to 30 days
                            </Text>
                        </View>
                    )}

                    <View style={styles.planHighlight}>
                        <Ionicons name="image-outline" size={18} color="#FFF" style={styles.featureIcon} />
                        <Text style={[styles.featureText, styles.highlightText]}>{plan.imageUploads}</Text>
                    </View>

                    <View style={styles.planDivider} />

                    <View style={styles.planFeatures}>
                        {plan.features.map((feature, index) => (
                            <View key={index} style={styles.featureItem}>
                                <Ionicons name="checkmark-circle" size={18} color="#FFF" style={styles.featureIcon} />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>

                    {isSelected && (
                        <View style={styles.selectedIndicator}>
                            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                        </View>
                    )}

                    {isPlanActive && !isSelected && (
                        <View style={styles.currentPlanIndicator}>
                            <Text style={styles.currentPlanText}>CURRENT PLAN</Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Premium Subscription</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }}>
                    <View style={styles.heroSection}>
                        <LinearGradient
                            colors={['#5A60EA', '#FF00F5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.heroGradient}
                        >
                            <View style={styles.heroContent}>
                                <Ionicons name="star" size={40} color="#FFD700" />
                                <Text style={styles.heroTitle}>Upgrade Your Experience</Text>
                                <Text style={styles.heroText}>
                                    Get more image uploads, AI-powered analysis, and personalized nutrition insights
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    <View style={styles.billingToggle}>
                        <Text style={[styles.billingOption, !isAnnual && styles.activeBillingOption]}>Monthly</Text>
                        <TouchableOpacity
                            style={styles.toggleSwitch}
                            onPress={() => setIsAnnual(!isAnnual)}
                        >
                            <View style={[styles.toggleBall, isAnnual && styles.toggleBallRight]} />
                        </TouchableOpacity>
                        <Text style={[styles.billingOption, isAnnual && styles.activeBillingOption]}>Annual</Text>
                        <View style={styles.savingsPill}>
                            <Text style={styles.savingsPillText}>Save up to 30%</Text>
                        </View>
                    </View>

                    <View style={styles.plansContainer}>
                        {plans.map(plan => renderPlanCard(plan))}
                    </View>

                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={[
                                styles.subscribeButton,
                                (!selectedPlan || isLoading) && styles.disabledButton
                            ]}
                            onPress={handleSubscribe}
                            disabled={!selectedPlan || isLoading}
                        >
                            <LinearGradient
                                colors={['#5A60EA', '#FF00F5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.subscribeButtonGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.subscribeButtonText}>
                                        {isRevenueCatLoading
                                            ? 'Loading...'
                                            : isPlanActive(selectedPlan, subscriptionStatus)
                                                ? 'Current Plan'
                                                : selectedPlan === 'free'
                                                    ? 'Continue with Free Plan'
                                                    : subscriptionStatus?.status === 'free_trial' || subscriptionStatus?.status === 'free_trial_extended'
                                                        ? 'Manage Subscription'
                                                        : 'Start Free Trial'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {subscriptionStatus && subscriptionStatus.status !== 'free' && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelSubscription}
                                disabled={isLoading}
                            >
                                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.guaranteeSection}>
                        <Ionicons name="shield-checkmark" size={24} color="#5A60EA" />
                        <Text style={styles.guaranteeText}>
                            30-Day Money-Back Guarantee
                        </Text>
                    </View>

                    <View style={styles.faqSection}>
                        <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

                        <View style={styles.faqItem}>
                            <Text style={styles.faqQuestion}>What happens when I reach my daily image upload limit?</Text>
                            <Text style={styles.faqAnswer}>
                                You can still use all other features of the app, including manual food logging and barcode scanning. Your upload limit resets every 24 hours.
                            </Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={styles.faqQuestion}>How do I cancel my subscription?</Text>
                            <Text style={styles.faqAnswer}>
                                You can cancel anytime from this screen. You'll continue to have access until the end of your billing period.
                            </Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={styles.faqQuestion}>Will I lose my data if I downgrade?</Text>
                            <Text style={styles.faqAnswer}>
                                No, your data will be preserved. However, you may lose access to premium features and AI-powered analysis.
                            </Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
};

// Helper function to check if the selected plan is the active plan
const isPlanActive = (selectedPlan: string | null, subscriptionStatus: SubscriptionDetails | null) => {
    if (!selectedPlan || !subscriptionStatus) return false;

    return (
        (selectedPlan === 'free' && subscriptionStatus.status === 'free') ||
        (selectedPlan === 'basic' && subscriptionStatus.status === 'standard') ||
        (selectedPlan === 'premium' && (subscriptionStatus.status === 'premium' || subscriptionStatus.status === 'premium_annual'))
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        paddingTop: 10,
        paddingBottom: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
        paddingTop: 40,
    },
    heroSection: {
        marginBottom: 25,
    },
    heroGradient: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    heroContent: {
        padding: 24,
        alignItems: 'center',
    },
    heroTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    heroText: {
        color: '#FFF',
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.9,
    },
    billingToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 25,
    },
    billingOption: {
        color: '#AAA',
        fontSize: 16,
        marginHorizontal: 10,
    },
    activeBillingOption: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        backgroundColor: '#333',
        borderRadius: 14,
        padding: 3,
    },
    toggleBall: {
        width: 22,
        height: 22,
        backgroundColor: '#FFF',
        borderRadius: 11,
    },
    toggleBallRight: {
        marginLeft: 22,
    },
    savingsPill: {
        backgroundColor: '#5A60EA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 10,
    },
    savingsPillText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    plansContainer: {
        marginBottom: 25,
    },
    planCard: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#FF00F5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    selectedPlan: {
        borderWidth: 2,
        borderColor: '#FF00F5',
    },
    bestValueCard: {
        borderColor: '#5A60EA',
        borderWidth: 2,
    },
    planGradient: {
        padding: 20,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    planTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    bestValueBadge: {
        backgroundColor: '#FF00F5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    bestValueText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    planPricing: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPrice: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    planPeriod: {
        color: '#FFF',
        opacity: 0.8,
        fontSize: 16,
        marginLeft: 4,
    },
    monthlyEquivalent: {
        color: '#FF00F5',
        fontSize: 14,
        marginTop: 4,
    },
    planHighlight: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 10,
        borderRadius: 8,
    },
    highlightText: {
        fontWeight: 'bold',
    },
    planDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 12,
    },
    planFeatures: {
        marginTop: 10,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureIcon: {
        marginRight: 8,
    },
    featureText: {
        color: '#FFF',
        fontSize: 14,
    },
    selectedIndicator: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    currentPlanIndicator: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    currentPlanText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    actionContainer: {
        marginTop: 10,
        marginBottom: 25,
    },
    subscribeButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    subscribeButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        opacity: 0.7,
    },
    subscribeButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    cancelButtonText: {
        color: '#FF00F5',
        fontSize: 16,
    },
    guaranteeSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        backgroundColor: 'rgba(90, 96, 234, 0.1)',
        padding: 15,
        borderRadius: 12,
    },
    guaranteeText: {
        color: '#5A60EA',
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
    },
    faqSection: {
        marginBottom: 20,
    },
    faqTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    faqItem: {
        marginBottom: 16,
    },
    faqQuestion: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    faqAnswer: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
    },
    trialInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
        marginBottom: 8,
    },
    trialText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 6,
        flex: 1,
    },
});

export default PremiumSubscription;
