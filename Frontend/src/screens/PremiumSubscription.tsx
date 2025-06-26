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
    const [fadeAnim] = useState(new Animated.Value(0));
    const [slideAnim] = useState(new Animated.Value(50));

    const plans: PlanOption[] = [
        {
            id: 'free',
            title: 'Free',
            monthlyPrice: 0,
            annualPrice: 0,
            gradient: ['#333333', '#1A1A1A'],
            subscriptionType: 'free',
            imageUploads: '1 image upload per day',
            features: [
                'Unlimited food search',
                'Barcode scanning support',
                'Basic meal planning',
                'Calorie tracking',
                'Weekly progress reports',
                'Ad-supported experience'
            ]
        },
        {
            id: 'basic',
            title: 'Basic',
            monthlyPrice: 5.99,
            annualPrice: 59.88, // 4.99 x 12
            gradient: ['#5A60EA', '#3940B8'],
            subscriptionType: 'standard',
            imageUploads: '3 image uploads per day',
            features: [
                'Everything in Free plan',
                'Advanced meal planning',
                'Limited AI food analysis',
                'Personalized nutrition tips',
                'Ad-free experience',
                'Email support'
            ]
        },
        {
            id: 'premium',
            title: 'Premium',
            monthlyPrice: 9.99,
            annualPrice: 83.88, // 6.99 x 12
            gradient: ['#5A60EA', '#FF00F5'],
            subscriptionType: isAnnual ? 'premium_annual' : 'premium',
            bestValue: true,
            imageUploads: 'Unlimited image uploads',
            features: [
                'Everything in Basic plan',
                'Unlimited AI food analysis',
                'Advanced nutrition insights',
                'Custom meal recommendations',
                'Personalized coaching',
                'Priority support',
                'Early access to new features'
            ]
        }
    ];

    useEffect(() => {
        const loadSubscriptionStatus = async () => {
            try {
                if (user?.uid) {
                    const status = await getSubscriptionStatus(user.uid);
                    setSubscriptionStatus(status);

                    // Pre-select current plan if user has one
                    if (status?.status) {
                        let planId;
                        if (status.status === 'premium' || status.status === 'premium_annual') {
                            planId = 'premium';
                        } else if (status.status === 'standard') {
                            planId = 'basic';
                        } else {
                            planId = 'free';
                        }
                        setSelectedPlan(planId);
                    } else {
                        // Default to basic for new users
                        setSelectedPlan('basic');
                    }
                }
            } catch (error) {
                console.error('Error loading subscription status:', error);
            }
        };

        loadSubscriptionStatus();

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

        if (selectedPlan === 'free' && subscriptionStatus?.status === 'free') {
            Alert.alert('Already Subscribed', 'You are already on the Free plan');
            return;
        }

        setIsLoading(true);

        try {
            const startDate = new Date().toISOString();

            // Calculate end date based on subscription type
            let endDate = null;
            if (selectedPlan !== 'free') {
                const endDateObj = new Date();
                if (isAnnual) {
                    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
                } else {
                    endDateObj.setMonth(endDateObj.getMonth() + 1);
                }
                endDate = endDateObj.toISOString();
            }

            // Mock payment process
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Determine subscription status based on selected plan
            const subscriptionType = selectedPlanObj.subscriptionType;

            // Update subscription in database
            await updateSubscriptionStatus(user?.uid, {
                status: subscriptionType,
                startDate,
                endDate,
                autoRenew: true,
                paymentMethod: selectedPlan === 'free' ? 'None' : 'Credit Card',
            });

            // Update local state
            setSubscriptionStatus({
                status: subscriptionType,
                startDate,
                endDate,
                autoRenew: true,
                paymentMethod: selectedPlan === 'free' ? 'None' : 'Credit Card',
                canceledAt: null,
                trialEndsAt: null,
            });

            // Store subscription info in AsyncStorage for quick access
            await AsyncStorage.setItem('subscription_plan', selectedPlan);

            Alert.alert(
                'Subscription Successful',
                `You are now subscribed to the ${selectedPlanObj.title} plan!`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Error subscribing:', error);
            Alert.alert('Subscription Error', 'There was an error processing your subscription. Please try again.');
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
                        {price > 0 && <Text style={styles.planPeriod}>{period}</Text>}
                    </View>

                    {monthlyEquivalent && (
                        <Text style={styles.monthlyEquivalent}>
                            {monthlyEquivalent} billed annually
                        </Text>
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
                                        {isPlanActive(selectedPlan, subscriptionStatus)
                                            ? 'You are subscribed to this plan'
                                            : selectedPlan === 'free'
                                                ? 'Continue with Free Plan'
                                                : 'Subscribe Now'}
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
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
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
    }
});

export default PremiumSubscription;
