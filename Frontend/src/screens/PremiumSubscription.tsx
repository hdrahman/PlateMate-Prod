import React, { useState, useEffect, useContext } from 'react';
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
    Animated,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const { subscription, refreshSubscription } = useSubscription();
    const insets = useSafeAreaInsets();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionDetails | null>(null);
    const [revenueCatOfferings, setRevenueCatOfferings] = useState<PurchasesOffering | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));

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
            monthlyPrice: 5.99,
            annualPrice: 0,
            gradient: ['#5856D6', '#007AFF'],
            subscriptionType: 'premium_monthly',
            imageUploads: 'Monthly billing',
            features: ['Unlimited AI uploads', 'Cancel anytime']
        },
        {
            id: 'premium_annual',
            title: 'Premium Annual',
            monthlyPrice: 0,
            annualPrice: 19.99,
            gradient: ['#FF2D92', '#9B00FF'],
            subscriptionType: 'premium_annual',
            bestValue: true,
            imageUploads: 'Annual billing',
            features: ['Save 72% vs monthly', 'Best value']
        }
    ];

    // Derive current plan info from subscription context (auto-updates)
    const currentPlanInfo = React.useMemo(() => {
        const tier = subscription.tier;

        if (tier === 'vip_lifetime') {
            return {
                planName: 'VIP Lifetime Access',
                isActive: true,
                statusText: 'VIP Member • Lifetime Access',
                statusColor: theme.colors.warning,
                showUpgradePrompt: false
            };
        }

        return {
            planName: tier === 'premium_monthly' ? 'Premium Monthly' :
                tier === 'premium_annual' ? 'Premium Annual' :
                    tier === 'promotional_trial' ? 'Free Trial' :
                        tier === 'extended_trial' ? 'Extended Trial' : 'Free Plan',
            isActive: ['premium_monthly', 'premium_annual', 'promotional_trial', 'extended_trial'].includes(tier),
            statusText: tier === 'premium_monthly' ? 'Renews monthly' :
                tier === 'premium_annual' ? 'Renews annually - Save 72%' :
                    tier === 'promotional_trial' ? `${subscription.daysRemaining || 0} days remaining` :
                        tier === 'extended_trial' ? `${subscription.daysRemaining || 0} days remaining` :
                            'Limited to 1 image upload per day',
            statusColor: ['premium_monthly', 'premium_annual'].includes(tier) ? theme.colors.success :
                ['promotional_trial', 'extended_trial'].includes(tier) ? theme.colors.warning : theme.colors.error,
            showUpgradePrompt: !['premium_monthly', 'premium_annual', 'vip_lifetime'].includes(tier)
        };
    }, [subscription.tier, subscription.daysRemaining, theme]);

    useEffect(() => {
        // Load RevenueCat offerings in background for purchase flow
        const loadOfferingsInBackground = async () => {
            if (!user?.uid || subscription.tier === 'vip_lifetime') return;

            try {
                const offerings = await SubscriptionService.getOfferings();
                setRevenueCatOfferings(offerings);

                const customerInfo = await SubscriptionService.getCustomerInfo();
                const revenueCatStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
                setSubscriptionStatus(revenueCatStatus);
            } catch (error: any) {
                console.error('Failed to load RevenueCat offerings:', error);
            }
        };

        loadOfferingsInBackground();

        // Pre-select plan based on current tier
        if (subscription.tier === 'premium_monthly') {
            setSelectedPlan('premium_monthly');
        } else if (subscription.tier === 'premium_annual') {
            setSelectedPlan('premium_annual');
        } else {
            setSelectedPlan('premium_monthly'); // Default to monthly
        }

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
    }, [user, subscription.tier]);

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

            // Force refresh subscription context - this will update ALL UI automatically
            console.log('🔄 Refreshing subscription context after purchase...');
            await refreshSubscription();
            console.log('✅ Subscription context refreshed');

            // Show success alert
            Alert.alert(
                'Welcome to Premium!',
                'Your subscription is now active. Enjoy unlimited access to all premium features!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            setIsLoading(false);
        } catch (error: any) {
            console.error('Error subscribing:', error);

            // Check if user cancelled (don't show error for cancellation)
            if ((error.message || '').toLowerCase().includes('cancel')) {
                setIsLoading(false);
                return;
            }

            // Use the enhanced error message from SubscriptionService
            const errorMessage = error.message || 'There was an error processing your subscription. Please try again.';
            const shouldRetry = error.shouldRetry !== false; // Default to true if not specified

            // Reset loading state before showing any alert
            setIsLoading(false);

            if (shouldRetry) {
                // Show error with retry option
                Alert.alert(
                    'Subscription Error',
                    errorMessage,
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel'
                        },
                        {
                            text: 'Retry',
                            onPress: () => {
                                // Retry will set loading state when handleSubscribe is called
                                handleSubscribe(planToUse);
                            }
                        }
                    ]
                );
            } else {
                // Show error without retry
                Alert.alert('Subscription Error', errorMessage);
            }
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

    const handleRestorePurchases = async () => {
        setIsLoading(true);
        try {
            console.log('🔄 Restoring purchases...');

            // Restore purchases via RevenueCat
            const customerInfo = await SubscriptionService.restorePurchases();

            // Update local state
            const revenueCatStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
            setSubscriptionStatus(revenueCatStatus);

            // Force refresh subscription context
            await refreshSubscription();

            // Check if any active subscriptions were restored
            if (SubscriptionService.hasActiveSubscription(customerInfo)) {
                Alert.alert(
                    'Purchases Restored!',
                    'Your premium subscription has been successfully restored.',
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    'No Purchases Found',
                    'No active subscriptions were found to restore. If you believe this is an error, please contact support.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            console.error('Error restoring purchases:', error);
            Alert.alert(
                'Restore Failed',
                'There was an error restoring your purchases. Please try again or contact support if this persists.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
        }
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
        const monthlyEquivalent = plan.id === 'premium_annual' ? '$1.67/month' : null;

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

                        {/* Trial bonus - visible but subordinate to price */}
                        <View style={styles.trialBonusContainer}>
                            <Ionicons name="gift-outline" size={14} color="#4CAF50" />
                            <Text style={styles.trialBonusText}>+14 days free trial</Text>
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
                                {isPlanActive ? 'Current Plan' : `Subscribe ${priceText}${period}`}
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
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 10, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Premium Subscription</Text>
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
                                    AI-powered nutrition tracking with unlimited photo analysis
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Current Plan Status Card - IMPROVED UX */}
                    {currentPlanInfo && (
                        <View style={[styles.currentPlanCard, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={[styles.currentPlanHeader, { backgroundColor: currentPlanInfo.statusColor + '20', borderBottomColor: theme.colors.border }]}>
                                <Ionicons
                                    name={currentPlanInfo.planName.includes('VIP') ? "shield-checkmark" : currentPlanInfo.isActive ? "checkmark-circle" : "information-circle"}
                                    size={20}
                                    color={currentPlanInfo.statusColor}
                                />
                                <Text style={[styles.currentPlanLabel, { color: theme.colors.textSecondary }]}>
                                    {currentPlanInfo.planName.includes('VIP') ? "VIP Status" : currentPlanInfo.isActive ? "Current Plan" : "Plan Status"}
                                </Text>
                            </View>
                            <View style={styles.currentPlanBody}>
                                <Text style={[styles.currentPlanName, { color: theme.colors.text }]}>{currentPlanInfo.planName}</Text>
                                <Text style={[styles.currentPlanStatus, { color: currentPlanInfo.statusColor }]}>
                                    {currentPlanInfo.statusText}
                                </Text>
                                {currentPlanInfo.showUpgradePrompt && (
                                    <Text style={[styles.upgradePrompt, { color: theme.colors.primary }]}>
                                        Upgrade for unlimited features
                                    </Text>
                                )}
                                {currentPlanInfo.planName.includes('VIP') && (
                                    <Text style={styles.vipMessage}>
                                        ✨ You have full access to all premium features with no subscription required!
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Only show subscription plans for non-VIP users */}
                    {(!currentPlanInfo || !currentPlanInfo.planName.includes('VIP')) && (
                        <>
                            <View style={styles.plansContainer}>
                                {plans.map(plan => renderPlanCard(plan))}
                            </View>

                            {/* Restore Purchases Button - Required for App Review */}
                            <TouchableOpacity
                                style={[styles.restorePurchasesButton, { backgroundColor: `${theme.colors.primary}15`, borderColor: `${theme.colors.primary}4D` }]}
                                onPress={handleRestorePurchases}
                                disabled={isLoading}
                            >
                                <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                                <Text style={[styles.restorePurchasesText, { color: theme.colors.primary }]}>Restore Purchases</Text>
                            </TouchableOpacity>

                            {/* Trial bonus highlight */}
                            <View style={[styles.trialHighlightSection, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: 'rgba(76, 175, 80, 0.3)' }]}>
                                <View style={styles.trialHighlightHeader}>
                                    <Ionicons name="gift" size={20} color="#4CAF50" />
                                    <Text style={[styles.trialHighlightTitle, { color: '#4CAF50' }]}>Up to 28 Days Free!</Text>
                                </View>
                                <Text style={[styles.trialHighlightText, { color: theme.colors.textSecondary }]}>
                                    New users get 14 days free automatically. Subscribe to unlock an additional 14-day trial (28 days total free).
                                </Text>
                            </View>

                            {/* Store-compliant pricing disclaimer */}
                            <View style={[styles.trialDisclaimerSection, { backgroundColor: `${theme.colors.primary}0D`, borderColor: `${theme.colors.primary}26` }]}>
                                <Text style={[styles.trialDisclaimerText, { color: theme.colors.textSecondary }]}>
                                    Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Cancel anytime in Settings.
                                </Text>
                            </View>

                            {/* Legal links */}
                            <View style={styles.legalLinksContainer}>
                                <Text style={[styles.legalLinksText, { color: theme.colors.textSecondary }]}>
                                    By subscribing, you agree to our{' '}
                                    <Text
                                        style={[styles.legalLink, { color: theme.colors.primary }]}
                                        onPress={() => navigation.navigate('LegalTerms' as never)}
                                    >
                                        Terms of Use
                                    </Text>
                                    {' '}and{' '}
                                    <Text
                                        style={[styles.legalLink, { color: theme.colors.primary }]}
                                        onPress={() => navigation.navigate('PrivacyPolicy' as never)}
                                    >
                                        Privacy Policy
                                    </Text>
                                    .
                                </Text>
                            </View>
                        </>
                    )}

                    <View style={[styles.featuresSection, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>Premium Features</Text>
                        <View style={styles.featuresGrid}>
                            {premiumFeatures.map((feature, index) => (
                                <View key={index} style={styles.featureItem}>
                                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={styles.featureIcon} />
                                    <Text style={[styles.featureText, { color: theme.colors.text }]}>{feature}</Text>
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
                                <Text style={[styles.cancelButtonText, { color: theme.colors.primary }]}>Cancel Subscription</Text>
                            </TouchableOpacity>
                        </View>
                    )}


                    <View style={[styles.guaranteeSection, { backgroundColor: `${theme.colors.primary}15` }]}>
                        <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
                        <Text style={[styles.guaranteeText, { color: theme.colors.primary }]}>
                            30-Day Money-Back Guarantee
                        </Text>
                    </View>

                    <View style={styles.faqSection}>
                        <Text style={[styles.faqTitle, { color: theme.colors.text }]}>Frequently Asked Questions</Text>

                        <View style={styles.faqItem}>
                            <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>What happens when I reach my daily image upload limit?</Text>
                            <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
                                You can still use all other features of the app, including manual food logging and barcode scanning. Your upload limit resets every 24 hours.
                            </Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>How do I cancel my subscription?</Text>
                            <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
                                You can cancel anytime from this screen. You'll continue to have access until the end of your billing period.
                            </Text>
                        </View>

                        <View style={styles.faqItem}>
                            <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>Will I lose my data if I downgrade?</Text>
                            <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
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
        flex: 1,
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
        fontSize: 34,
        fontWeight: 'bold',
    },
    planPeriod: {
        color: '#FFF',
        opacity: 0.9,
        fontSize: 16,
        marginLeft: 2,
        fontWeight: '600',
    },
    trialBonusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    trialBonusText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    monthlyEquivalent: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
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
        borderRadius: 16,
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
    vipMessage: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        fontStyle: 'italic',
    },
    // Trial highlight section styles
    trialHighlightSection: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    trialHighlightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    trialHighlightTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    trialHighlightText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    // Store-compliant pricing disclaimer styles
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
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center',
    },
    // Legal links styles
    legalLinksContainer: {
        marginTop: 12,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    legalLinksText: {
        color: '#888',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    legalLink: {
        color: '#5A60EA',
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
    restorePurchasesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(90, 96, 234, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(90, 96, 234, 0.3)',
        gap: 8,
    },
    restorePurchasesText: {
        color: '#5A60EA',
        fontSize: 15,
        fontWeight: '600',
    },
});

export default PremiumSubscription;
