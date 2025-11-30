import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';
import { useAuth } from '../context/AuthContext';
import SubscriptionService, { PRODUCT_IDS } from '../services/SubscriptionService';
import TrialStatusCard from '../components/TrialStatusCard';
import { SubscriptionDetails } from '../types/user';

interface SubscriptionPlan {
    id: string;
    title: string;
    price: string;
    originalPrice?: string;
    period: string;
    features: string[];
    isPopular?: boolean;
    discount?: string;
    productId: string;
}

const SubscriptionManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [isLoading, setIsLoading] = useState(false);
    const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
    const [products, setProducts] = useState<any[]>([]);

    const subscriptionPlans: SubscriptionPlan[] = [
        {
            id: 'monthly',
            title: 'Premium Monthly',
            price: '$9.99',
            period: 'per month',
            productId: PRODUCT_IDS.MONTHLY,
            features: [
                'Unlimited food photo analysis',
                'AI-powered meal recommendations',
                'Advanced nutrition tracking',
                'Premium recipes & meal plans',
                'Priority customer support',
                'Export data & reports',
            ],
        },
        {
            id: 'annual',
            title: 'Premium Annual',
            price: '$89.99',
            originalPrice: '$119.88',
            period: 'per year',
            discount: 'Save 25%',
            isPopular: true,
            productId: PRODUCT_IDS.ANNUAL,
            features: [
                'All Premium Monthly features',
                '25% discount (save $30/year)',
                'Exclusive annual member perks',
                'Early access to new features',
                'Extended customer support',
                'Advanced analytics & insights',
            ],
        },
    ];

    useEffect(() => {
        loadSubscriptionData();
    }, [user]);

    const loadSubscriptionData = async () => {
        if (!user?.uid) return;

        try {
            setIsLoading(true);

            // Initialize subscription service
            await SubscriptionService.initialize(user.uid);

            // Load current subscription info
            const customerInfo = await SubscriptionService.getCustomerInfo();
            if (customerInfo) {
                setSubscriptionDetails(SubscriptionService.customerInfoToSubscriptionDetails(customerInfo));
            }

            // Load available products
            const availableProducts = await SubscriptionService.getProducts();
            setProducts(availableProducts);

        } catch (error) {
            console.error('Error loading subscription data:', error);
            Alert.alert('Error', 'Failed to load subscription information');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtendTrial = async () => {
        if (!user?.uid) return;

        try {
            setIsLoading(true);

            // Show payment method selection (this would integrate with your payment provider)
            Alert.alert(
                'Payment Method Required',
                'To extend your trial, we need to add a payment method. You won\'t be charged until after your extended trial ends.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Add Card',
                        onPress: async () => {
                            try {
                                // This would normally open a payment method form
                                // For now, we'll simulate adding a payment method
                                // Trial extension now handled by RevenueCat
                                const success = await SubscriptionService.setupAutoRenewForTrialExtension();
                                if (!success) {
                                    throw new Error('Failed to extend trial');
                                }

                                Alert.alert(
                                    'Trial Extended!',
                                    'Your trial has been extended by 10 days. You now have 30 days total to try all premium features.',
                                    [{ text: 'Great!', onPress: loadSubscriptionData }]
                                );
                            } catch (error) {
                                console.error('Error extending trial:', error);
                                Alert.alert('Error', 'Failed to extend trial. Please try again.');
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error in extend trial flow:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        if (!user?.uid) return;

        try {
            // Get the product for purchase
            const product = products.find(p => p.identifier === plan.productId);
            if (!product) {
                Alert.alert('Error', 'Product not available');
                return;
            }

            // Show purchase confirmation
            Alert.alert(
                'Confirm Subscription',
                `Subscribe to ${plan.title} for ${plan.price}${plan.period}?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    },
                    {
                        text: 'Subscribe',
                        onPress: async () => {
                            try {
                                // Set loading state when user actually confirms purchase
                                setIsLoading(true);

                                // Attempt purchase through RevenueCat
                                const { customerInfo } = await SubscriptionService.purchaseProduct(plan.productId);

                                // Clear trial data since user is now subscribed
                                // Trial data clearing handled by RevenueCat

                                // Update local state
                                setSubscriptionDetails(SubscriptionService.customerInfoToSubscriptionDetails(customerInfo));

                                Alert.alert(
                                    'Subscription Activated!',
                                    `Welcome to PlateMate Premium! Your ${plan.title} subscription is now active.`,
                                    [{ text: 'Great!', onPress: () => navigation.goBack() }]
                                );
                                setIsLoading(false);
                            } catch (error: any) {
                                console.error('Purchase failed:', error);

                                // Check if user cancelled (don't show error for cancellation)
                                if ((error.message || '').toLowerCase().includes('cancel')) {
                                    setIsLoading(false);
                                    return;
                                }

                                // Use the enhanced error message from SubscriptionService
                                const errorMessage = error.message || 'There was an issue processing your subscription. Please try again.';
                                const shouldRetry = error.shouldRetry !== false;

                                // Reset loading state before showing any alert
                                setIsLoading(false);

                                if (shouldRetry) {
                                    // Show error with retry option
                                    Alert.alert(
                                        'Purchase Failed',
                                        errorMessage,
                                        [
                                            {
                                                text: 'Cancel',
                                                style: 'cancel'
                                            },
                                            {
                                                text: 'Retry',
                                                onPress: () => handleSubscribe(plan)
                                            }
                                        ]
                                    );
                                } else {
                                    Alert.alert('Purchase Failed', errorMessage);
                                }
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Error initiating purchase:', error);
            Alert.alert('Error', 'Failed to initiate purchase. Please try again.');
        }
    };

    const handleRestorePurchases = async () => {
        try {
            setIsLoading(true);

            const customerInfo = await SubscriptionService.restorePurchases();
            setSubscriptionDetails(SubscriptionService.customerInfoToSubscriptionDetails(customerInfo));

            if (SubscriptionService.hasActiveSubscription(customerInfo)) {
                Alert.alert('Purchases Restored', 'Your premium subscription has been restored!');
            } else {
                Alert.alert('No Purchases Found', 'No active subscriptions were found to restore.');
            }
        } catch (error) {
            console.error('Error restoring purchases:', error);
            Alert.alert('Error', 'Failed to restore purchases');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelSubscription = () => {
        Alert.alert(
            'Cancel Subscription',
            'Are you sure you want to cancel your subscription? You\'ll lose access to premium features at the end of your billing period.',
            [
                { text: 'Keep Subscription', style: 'cancel' },
                {
                    text: 'Cancel Subscription',
                    style: 'destructive',
                    onPress: () => {
                        // This would typically handle cancellation through the app store
                        Alert.alert(
                            'Subscription Cancellation',
                            Platform.OS === 'ios'
                                ? 'To cancel your subscription, please go to Settings > Apple ID > Subscriptions on your device.'
                                : 'To cancel your subscription, please go to Google Play Store > Account > Subscriptions.',
                            [{ text: 'OK' }]
                        );
                    },
                },
            ]
        );
    };

    const renderPlanCard = (plan: SubscriptionPlan) => (
        <View key={plan.id} style={[styles.planCard, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }, plan.isPopular && [styles.popularPlan, { borderColor: theme.colors.primary }]]}>
            {plan.isPopular && (
                <View style={[styles.popularBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.popularBadgeText, { color: theme.colors.text }]}>MOST POPULAR</Text>
                </View>
            )}

            <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: theme.colors.text }]}>{plan.title}</Text>
                {plan.discount && (
                    <View style={[styles.discountBadge, { backgroundColor: theme.colors.success }]}>
                        <Text style={[styles.discountText, { color: theme.colors.text }]}>{plan.discount}</Text>
                    </View>
                )}
            </View>

            <View style={styles.priceContainer}>
                <Text style={[styles.price, { color: theme.colors.primary }]}>{plan.price}</Text>
                {plan.originalPrice && (
                    <Text style={[styles.originalPrice, { color: theme.colors.textSecondary }]}>{plan.originalPrice}</Text>
                )}
                <Text style={[styles.period, { color: theme.colors.textSecondary }]}>{plan.period}</Text>
            </View>

            <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                        <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>{feature}</Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: theme.colors.border, borderColor: theme.colors.border }, plan.isPopular && [styles.popularButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]]}
                onPress={() => handleSubscribe(plan)}
                disabled={isLoading}
            >
                <Text style={[styles.subscribeButtonText, { color: theme.colors.text }, plan.isPopular && styles.popularButtonText]}>
                    Choose {plan.title}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Premium Subscription</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Trial Status Card */}
                <TrialStatusCard
                    onExtendTrial={handleExtendTrial}
                    onSubscribe={() => {
                        // Scroll to subscription plans or show modal
                    }}
                />

                {/* Premium Features Overview */}
                <View style={styles.featuresOverview}>
                    <LinearGradient
                        colors={[theme.colors.primary, '#5c00dd']}
                        style={styles.featuresHeader}
                    >
                        <MaterialCommunityIcons name="crown" size={32} color="#ffd700" />
                        <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>Premium Features</Text>
                        <Text style={styles.featuresSubtitle}>
                            Unlock the full potential of PlateMate
                        </Text>
                    </LinearGradient>
                </View>

                {/* Subscription Plans */}
                <View style={styles.plansContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose Your Plan</Text>
                    {subscriptionPlans.map(renderPlanCard)}
                </View>

                {/* Restore Purchases Button */}
                <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={handleRestorePurchases}
                    disabled={isLoading}
                >
                    <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                    <Text style={[styles.restoreButtonText, { color: theme.colors.primary }]}>Restore Purchases</Text>
                </TouchableOpacity>

                {/* Current Subscription Management */}
                {subscriptionDetails && ['premium_monthly', 'premium_annual'].includes(subscriptionDetails.status) && (
                    <View style={styles.managementContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Manage Subscription</Text>
                        <TouchableOpacity
                            style={[styles.cancelButton, { borderColor: theme.colors.error }]}
                            onPress={handleCancelSubscription}
                        >
                            <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
                            <Text style={[styles.cancelButtonText, { color: theme.colors.error }]}>Cancel Subscription</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* FAQ Section */}
                <View style={styles.faqContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Frequently Asked Questions</Text>

                    <View style={[styles.faqItem, { backgroundColor: theme.colors.cardBackground }]}>
                        <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>How does the free trial work?</Text>
                        <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
                            Get 20 days free to try all premium features. Add a payment method to extend to 30 days total. You won't be charged until after your trial ends.
                        </Text>
                    </View>

                    <View style={[styles.faqItem, { backgroundColor: theme.colors.cardBackground }]}>
                        <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>Can I cancel anytime?</Text>
                        <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
                            Yes! Cancel anytime through your device settings. You'll keep access until the end of your billing period.
                        </Text>
                    </View>

                    <View style={[styles.faqItem, { backgroundColor: theme.colors.cardBackground }]}>
                        <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>What happens to my data if I cancel?</Text>
                        <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>
                            Your data is always safe with us. You'll lose access to premium features but can still use the free version of the app.
                        </Text>
                    </View>
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

                <View style={styles.bottomSpacing} />
            </ScrollView>

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 12,
    },
    scrollView: {
        flex: 1,
    },
    featuresOverview: {
        margin: 16,
        marginTop: 0,
    },
    featuresHeader: {
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
    },
    featuresTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
    },
    featuresSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
        textAlign: 'center',
    },
    plansContainer: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    planCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#333',
    },
    popularPlan: {
        borderColor: '#0074dd',
        transform: [{ scale: 1.02 }],
    },
    popularBadge: {
        position: 'absolute',
        top: -1,
        left: 20,
        right: 20,
        backgroundColor: '#0074dd',
        paddingVertical: 4,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        alignItems: 'center',
    },
    popularBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginTop: 8,
    },
    planTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    discountBadge: {
        backgroundColor: '#00aa44',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    discountText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
        gap: 8,
    },
    price: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0074dd',
    },
    originalPrice: {
        fontSize: 16,
        color: '#888',
        textDecorationLine: 'line-through',
    },
    period: {
        fontSize: 16,
        color: '#ccc',
    },
    featuresContainer: {
        marginBottom: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#ccc',
        flex: 1,
    },
    subscribeButton: {
        backgroundColor: '#333',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#555',
    },
    popularButton: {
        backgroundColor: '#0074dd',
        borderColor: '#0074dd',
    },
    subscribeButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    popularButtonText: {
        color: '#fff',
    },
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    restoreButtonText: {
        fontSize: 16,
        color: '#0074dd',
        fontWeight: '600',
    },
    managementContainer: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2a1a1a',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff4444',
        gap: 8,
    },
    cancelButtonText: {
        fontSize: 16,
        color: '#ff4444',
        fontWeight: '600',
    },
    faqContainer: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    faqItem: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
    },
    faqQuestion: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    faqAnswer: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
    },
    // Legal links styles
    legalLinksContainer: {
        marginTop: 24,
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    legalLinksText: {
        color: '#888',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    legalLink: {
        color: '#0074dd',
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
    bottomSpacing: {
        height: 40,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SubscriptionManagementScreen;
