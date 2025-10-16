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
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    cancelSubscription
} from '../utils/database';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';
import SubscriptionService from '../services/SubscriptionService';

// Define types locally to avoid importing from react-native-purchases
type PurchasesOffering = any;
type PurchasesPackage = any;

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


const PremiumSubscription = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionDetails | null>(null);
    const [revenueCatOfferings, setRevenueCatOfferings] = useState<PurchasesOffering | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));
    
    // Current plan status for prominent display - IMPROVED UX
    const [currentPlanInfo, setCurrentPlanInfo] = useState<{
        planName: string;
        isActive: boolean;
        statusText: string;
        statusColor: string;
        showUpgradePrompt: boolean;
    } | null>(null);

    // Premium features that apply to both plans
    const premiumFeatures = [
        'AI-powered food recognition & analysis',
        'Unlimited photo uploads',
        'Smart nutrition tracking',
        'Personalized meal recommendations',
        'Advanced macro & calorie insights',
        'Custom dietary goal setting',
        'Barcode scanning',
        'Recipe suggestions',
        'Health trend analytics',
        'Priority customer support'
    ];

    const plans: PlanOption[] = [
        {
            id: 'premium_monthly',
            title: 'Premium Monthly',
            monthlyPrice: 6.99,
            annualPrice: 0,
            gradient: ['#5A60EA', '#4A90E2'],
            subscriptionType: 'premium_monthly',
            imageUploads: 'Monthly billing',
            features: ['10-day free trial']
        },
        {
            id: 'premium_annual',
            title: 'Premium Annual',
            monthlyPrice: 0,
            annualPrice: 59.99,
            gradient: ['#FF00F5', '#5A60EA'],
            subscriptionType: 'premium_annual',
            bestValue: true,
            imageUploads: 'Annual billing',
            features: ['10-day free trial', 'Save 30% vs monthly plan']
        }
    ];

    useEffect(() => {
        const loadSubscriptionData = async () => {
            try {
                if (user?.uid) {
                    // Initialize RevenueCat if not already done
                    await SubscriptionService.initialize(user.uid);
                    
                    // Load RevenueCat offerings
                    const offerings = await SubscriptionService.getOfferings();
                    setRevenueCatOfferings(offerings);
                    
                    // Get current subscription status from RevenueCat
                    const customerInfo = await SubscriptionService.getCustomerInfo();
                    const revenueCatStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
                    setSubscriptionStatus(revenueCatStatus);
                    
                    // Set current plan info for prominent display
                    if (revenueCatStatus) {
                        const planInfo = {
                            planName: revenueCatStatus.status === 'premium_monthly' ? 'Premium Monthly' :
                                     revenueCatStatus.status === 'premium_annual' ? 'Premium Annual' :
                                     revenueCatStatus.status === 'free_trial' ? 'Free Trial' :
                                     revenueCatStatus.status === 'free_trial_extended' ? 'Extended Trial' : 'Free Plan',
                            isActive: ['premium_monthly', 'premium_annual', 'free_trial', 'free_trial_extended'].includes(revenueCatStatus.status),
                            statusText: revenueCatStatus.status === 'premium_monthly' ? 'Renews monthly' :
                                       revenueCatStatus.status === 'premium_annual' ? 'Renews annually - Save 30%' :
                                       revenueCatStatus.status === 'free_trial' ? 'Trial active' :
                                       revenueCatStatus.status === 'free_trial_extended' ? 'Extended trial active' :
                                       'Limited to 1 image upload per day',
                            statusColor: ['premium_monthly', 'premium_annual'].includes(revenueCatStatus.status) ? '#00aa44' :
                                        ['free_trial', 'free_trial_extended'].includes(revenueCatStatus.status) ? '#ff8800' : '#ff4444',
                            showUpgradePrompt: !['premium_monthly', 'premium_annual'].includes(revenueCatStatus.status)
                        };
                        setCurrentPlanInfo(planInfo);
                    }

                    // Pre-select current plan based on RevenueCat status
                    if (revenueCatStatus?.status) {
                        let planId: string;
                        if (revenueCatStatus.status === 'premium_monthly') {
                            planId = 'premium_monthly';
                        } else if (revenueCatStatus.status === 'premium_annual') {
                            planId = 'premium_annual';
                        } else {
                            planId = 'premium_monthly'; // Default to monthly for new users
                        }
                        setSelectedPlan(planId);
                    } else {
                        // Default to monthly for new users (they'll get the trial)
                        setSelectedPlan('premium_monthly');
                    }
                }
            } catch (error) {
                console.error('Error loading subscription data:', error);
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

    const handleSubscribe = async (planId?: string) => {
        const planToUse = planId || selectedPlan;
        if (!planToUse) {
            Alert.alert('Error', 'Please select a subscription plan');
            return;
        }

        const selectedPlanObj = plans.find(p => p.id === planToUse);
        if (!selectedPlanObj) {
            Alert.alert('Error', 'Invalid plan selected');
            return;
        }


        setIsLoading(true);

        try {
            // Handle premium subscription with RevenueCat
            if (!revenueCatOfferings || !revenueCatOfferings.availablePackages) {
                throw new Error('No subscription packages available. Please try again.');
            }

            // Find the appropriate package based on selected plan
            let packageToPurchase: PurchasesPackage | null = null;
            
            if (planToUse === 'premium_annual') {
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
        if (!subscriptionStatus || subscriptionStatus.status === 'expired') {
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

    const handlePlanPurchase = async (planId: string) => {
        setSelectedPlan(planId);
        await handleSubscribe(planId);
    };

    const renderPlanCard = (plan: PlanOption) => {
        const price = plan.id === 'premium_annual' ? plan.annualPrice : plan.monthlyPrice;
        const priceText = `$${price.toFixed(2)}`;
        const period = plan.id === 'premium_annual' ? '/year' : '/month';

        // Calculate monthly equivalent for annual plan
        const monthlyEquivalent = plan.id === 'premium_annual' ? '$5.00/month' : null;

        // Check if user is currently on this plan
        const isPlanActive =
            (plan.id === 'premium_monthly' && subscriptionStatus?.status === 'premium_monthly') ||
            (plan.id === 'premium_annual' && subscriptionStatus?.status === 'premium_annual');

        return (
            <TouchableOpacity
                key={plan.id}
                style={[
                    styles.planCard,
                    plan.bestValue && styles.bestValueCard,
                    isPlanActive && styles.planCardActive
                ]}
                onPress={() => !isPlanActive && handlePlanPurchase(plan.id)}
                disabled={isLoading || isPlanActive}
            >
                <LinearGradient
                    colors={plan.gradient as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.planGradient}
                >
                    <View style={styles.planTopContent}>
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
                            <Text style={styles.planPeriod}>{period}</Text>
                        </View>

                        {monthlyEquivalent && (
                            <Text style={styles.monthlyEquivalent}>
                                {monthlyEquivalent}
                            </Text>
                        )}

                        <View style={styles.planFeatures}>
                            {plan.features.map((feature, index) => (
                                <View key={index} style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={styles.featureIcon} />
                                    <Text style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={[
                        styles.planStatus,
                        isPlanActive && styles.planStatusActive
                    ]}>
                        {isLoading && selectedPlan === plan.id ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Text style={[
                                styles.planStatusText,
                                isPlanActive && styles.planStatusTextActive
                            ]}>
                                {isPlanActive ? 'Current Plan' : 'Tap to Start Trial'}
                            </Text>
                        )}
                    </View>

                    {isPlanActive && (
                        <View style={styles.currentPlanIndicator}>
                            <Text style={styles.currentPlanText}>ACTIVE</Text>
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
                                <Ionicons name="nutrition" size={40} color="#FFD700" />
                                <Text style={styles.heroTitle}>Unlock Premium Features</Text>
                                <Text style={styles.heroText}>
                                    Experience AI-powered nutrition tracking with a 10-day free trial
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Current Plan Status Card - IMPROVED UX */}
                    {currentPlanInfo && (
                        <View style={styles.currentPlanCard}>
                            <View style={[styles.currentPlanHeader, { backgroundColor: currentPlanInfo.statusColor + '20' }]}>
                                <Ionicons 
                                    name={currentPlanInfo.isActive ? "checkmark-circle" : "information-circle"} 
                                    size={20} 
                                    color={currentPlanInfo.statusColor} 
                                />
                                <Text style={styles.currentPlanLabel}>
                                    {currentPlanInfo.isActive ? "Current Plan" : "Plan Status"}
                                </Text>
                            </View>
                            <View style={styles.currentPlanBody}>
                                <Text style={styles.currentPlanName}>{currentPlanInfo.planName}</Text>
                                <Text style={[styles.currentPlanStatus, { color: currentPlanInfo.statusColor }]}>
                                    {currentPlanInfo.statusText}
                                </Text>
                                {currentPlanInfo.showUpgradePrompt && (
                                    <Text style={styles.upgradePrompt}>
                                        Upgrade for unlimited features
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    <View style={styles.plansContainer}>
                        {plans.map(plan => renderPlanCard(plan))}
                    </View>

                    {/* Store-compliant trial disclaimer */}
                    <View style={styles.trialDisclaimerSection}>
                        <Text style={styles.trialDisclaimerText}>
                            Start a 10-day free trial (auto-renew required to start). Cancel anytime during the trial to avoid being charged. Access lasts until the trial ends.
                        </Text>
                    </View>

                    <View style={styles.featuresSection}>
                        <Text style={styles.featuresTitle}>Premium Features</Text>
                        <View style={styles.featuresGrid}>
                            {premiumFeatures.map((feature, index) => (
                                <View key={index} style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={20} color="#5A60EA" style={styles.featureIcon} />
                                    <Text style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {subscriptionStatus && subscriptionStatus.status !== 'expired' && (
                        <View style={styles.cancelSection}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelSubscription}
                                disabled={isLoading}
                            >
                                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                            </TouchableOpacity>
                        </View>
                    )}


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
        paddingTop: 20,
    },
    heroSection: {
        marginBottom: 30,
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
    featuresSection: {
        marginBottom: 30,
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    featuresTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    featuresGrid: {
        gap: 12,
    },
    plansContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
    },
    planCard: {
        flex: 1,
        minHeight: 280,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    selectedPlan: {
        borderWidth: 3,
        borderColor: '#FF00F5',
        transform: [{ scale: 1.02 }],
    },
    bestValueCard: {
        borderColor: '#FFD700',
        borderWidth: 2,
    },
    planGradient: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    planTopContent: {
        flex: 1,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    planTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    bestValueBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    bestValueText: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
    planPricing: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPrice: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    planPeriod: {
        color: '#FFF',
        opacity: 0.8,
        fontSize: 14,
        marginLeft: 2,
    },
    monthlyEquivalent: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    planFeatures: {
        marginTop: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    featureIcon: {
        marginRight: 6,
        marginTop: 1,
    },
    featureText: {
        color: '#FFF',
        fontSize: 12,
        flex: 1,
        lineHeight: 16,
    },
    planCardActive: {
        opacity: 0.7,
    },
    planStatus: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 0,
        minHeight: 36,
        width: '100%',
    },
    planStatusActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    planStatusText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    planStatusTextActive: {
        opacity: 0.7,
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
    cancelSection: {
        alignItems: 'center',
        marginBottom: 20,
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
    // Current Plan Status Card Styles - IMPROVED UX
    currentPlanCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
    },
    currentPlanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    currentPlanLabel: {
        color: '#CCC',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    currentPlanBody: {
        padding: 16,
    },
    currentPlanName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    currentPlanStatus: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    upgradePrompt: {
        color: '#FF00F5',
        fontSize: 13,
        fontStyle: 'italic',
    },
    // Store-compliant trial disclaimer styles
    trialDisclaimerSection: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: 'rgba(90, 96, 234, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(90, 96, 234, 0.15)',
    },
    trialDisclaimerText: {
        color: '#AAA',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
});

export default PremiumSubscription;
