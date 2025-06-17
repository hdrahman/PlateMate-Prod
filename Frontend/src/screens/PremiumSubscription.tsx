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
    Image,
    Dimensions,
    ColorValue
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getSubscriptionStatus,
    updateSubscriptionStatus,
    cancelSubscription
} from '../utils/database';
import { SubscriptionDetails } from '../types/user';

// Define window width for responsive design
const windowWidth = Dimensions.get('window').width;

// Define subscription plan type
interface PlanOption {
    id: string;
    title: string;
    monthlyPrice: string;
    annualPrice: string;
    gradient: [ColorValue, ColorValue];
    features: string[];
    description: string;
    isFree?: boolean;
}

// Define subscription status type
type SubscriptionStatus = null | {
    plan: string;
    startDate: string;
    endDate: string | null;
    autoRenew: boolean;
    paymentMethod: string;
    canceledAt?: string | null;
    trialEndsAt?: string | null;
};

const PremiumSubscription = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isAnnual, setIsAnnual] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    const [activeTab, setActiveTab] = useState('plans'); // 'plans' or 'manage'
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

    // Trial period calculations
    useEffect(() => {
        // Check if user is in trial period
        if (subscriptionStatus?.trialEndsAt) {
            const trialEnd = new Date(subscriptionStatus.trialEndsAt);
            const now = new Date();
            const diffTime = trialEnd.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setTrialDaysLeft(diffDays > 0 ? diffDays : 0);
        } else if (!subscriptionStatus) {
            // Assume new users get a 5-day trial
            setTrialDaysLeft(5);
        }
    }, [subscriptionStatus]);

    // Fetch subscription status
    useEffect(() => {
        const loadSubscriptionStatus = async () => {
            try {
                if (user && user.uid) {
                    const dbStatus = await getSubscriptionStatus(user.uid);
                    if (dbStatus) {
                        setSubscriptionStatus({
                            plan: dbStatus.status === 'free' || dbStatus.status === 'free_trial' ? 'basic' : dbStatus.status,
                            startDate: dbStatus.startDate,
                            endDate: dbStatus.endDate || null,
                            autoRenew: dbStatus.autoRenew,
                            paymentMethod: dbStatus.paymentMethod || 'Credit Card',
                            trialEndsAt: dbStatus.trialEndsAt,
                            canceledAt: dbStatus.canceledAt
                        });

                        // If user has an active subscription, select that plan
                        if (dbStatus.status !== 'free' && dbStatus.status !== 'free_trial') {
                            setSelectedPlan(dbStatus.status);
                            setActiveTab('manage');
                        } else {
                            setSelectedPlan('basic');
                        }
                    } else {
                        // Default to basic plan for new users
                        setSelectedPlan('basic');
                    }
                }
            } catch (error) {
                console.error('Error fetching subscription status:', error);
            }
        };

        loadSubscriptionStatus();
    }, [user]);

    // Premium plan options
    const plans: PlanOption[] = [
        {
            id: 'basic',
            title: 'Basic',
            monthlyPrice: 'Free',
            annualPrice: 'Free',
            gradient: ['#717171', '#505050'] as [ColorValue, ColorValue],
            description: 'Limited access with basic features',
            isFree: true,
            features: [
                '1 Image Upload Per Day',
                '5-Day Free Trial Initially',
                'Basic Nutrition Tracking',
                'No AI Coach Access',
                'Guaranteed Customer Support',
            ]
        },
        {
            id: 'standard',
            title: 'Standard',
            monthlyPrice: '5.99',
            annualPrice: '4.99',
            gradient: ['#0088FF', '#0055CC'] as [ColorValue, ColorValue],
            description: 'Enhanced features for dedicated users',
            features: [
                '6 Image Uploads Per Day',
                'AI Coach & Nutrition Advice',
                'Custom Meal Recommendations',
                'Progress Tracking',
                'Guaranteed Customer Support',
            ]
        },
        {
            id: 'premium',
            title: 'Premium',
            monthlyPrice: '9.99',
            annualPrice: '6.99',
            gradient: ['#9B00FF', '#6600CC'] as [ColorValue, ColorValue],
            description: 'Unlimited access with premium features',
            features: [
                'Unlimited Image Uploads',
                'Advanced AI Nutrition Analysis',
                'Custom Progress Notifications',
                'Detailed Insights & Reports',
                'Priority Customer Support',
            ]
        },
    ];

    const handleSubscribe = async () => {
        if (!selectedPlan) {
            Alert.alert('Error', 'Please select a subscription plan');
            return;
        }

        if (selectedPlan === 'basic' && subscriptionStatus?.plan === 'basic') {
            Alert.alert('Already Subscribed', 'You are already on the Basic plan');
            return;
        }

        setIsLoading(true);

        try {
            const plan = plans.find(p => p.id === selectedPlan);
            const startDate = new Date().toISOString();

            // Calculate end date based on subscription type
            let endDate = null;
            if (selectedPlan !== 'basic') {
                const endDateObj = new Date();
                if (isAnnual) {
                    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
                } else {
                    endDateObj.setMonth(endDateObj.getMonth() + 1);
                }
                endDate = endDateObj.toISOString();
            }

            // Calculate trial end date for basic users
            let trialEndsAt = null;
            if (selectedPlan === 'basic' && trialDaysLeft === 5) {
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 5);
                trialEndsAt = trialEndDate.toISOString();
            }

            // Create subscription data
            const subscriptionData = {
                status: selectedPlan as any,
                startDate,
                endDate,
                autoRenew: selectedPlan !== 'basic',
                paymentMethod: selectedPlan === 'basic' ? null : 'Credit Card',
                trialEndsAt
            };

            // Update subscription in database
            if (user && user.uid) {
                await updateSubscriptionStatus(user.uid, subscriptionData);
            }

            // Update local state
            setSubscriptionStatus({
                plan: selectedPlan,
                startDate,
                endDate,
                autoRenew: selectedPlan !== 'basic',
                paymentMethod: selectedPlan === 'basic' ? null : 'Credit Card',
                trialEndsAt
            });

            // Show appropriate message
            const message = selectedPlan === 'basic'
                ? 'You are now on the Basic plan with limited features.'
                : `You've successfully subscribed to the ${plan?.title} plan!`;

            Alert.alert(
                'Subscription Updated',
                message,
                [{ text: 'OK' }]
            );

            setActiveTab('manage');
        } catch (error) {
            console.error('Subscription error:', error);
            Alert.alert('Error', 'Failed to process subscription. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleBillingCycle = () => {
        setIsAnnual(!isAnnual);
    };

    const renderBillingToggle = () => {
        if (selectedPlan === 'basic') return null;

        return (
            <View style={styles.billingToggle}>
                <Text style={styles.billingLabel}>Billing Cycle:</Text>
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleOption, !isAnnual && styles.toggleOptionActive]}
                        onPress={() => setIsAnnual(false)}
                    >
                        <Text style={[styles.toggleText, !isAnnual && styles.toggleTextActive]}>Monthly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleOption, isAnnual && styles.toggleOptionActive]}
                        onPress={() => setIsAnnual(true)}
                    >
                        <Text style={[styles.toggleText, isAnnual && styles.toggleTextActive]}>Annual</Text>
                        <View style={styles.savingBadge}>
                            <Text style={styles.savingText}>Save</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderPlans = () => {
        return (
            <>
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={['#9B00FF', '#6600CC'] as [ColorValue, ColorValue]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroGradient}
                    >
                        <View style={styles.heroContent}>
                            <Ionicons name="rocket" size={40} color="#FFF" />
                            <Text style={styles.heroTitle}>Upgrade Your PlateMate Experience</Text>
                            <Text style={styles.heroSubtitle}>Choose the plan that fits your nutrition goals</Text>
                        </View>
                    </LinearGradient>
                </View>

                {renderBillingToggle()}

                {trialDaysLeft !== null && trialDaysLeft > 0 && (
                    <View style={styles.trialBanner}>
                        <Ionicons name="time-outline" size={20} color="#FFF" />
                        <Text style={styles.trialText}>
                            {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left in your free trial
                        </Text>
                    </View>
                )}

                <View style={styles.plansContainer}>
                    {plans.map(plan => {
                        const isSelected = selectedPlan === plan.id;
                        const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
                        const period = plan.isFree ? '' : (isAnnual ? '/year' : '/month');

                        return (
                            <TouchableOpacity
                                key={plan.id}
                                style={[
                                    styles.planCard,
                                    isSelected && styles.selectedPlan
                                ]}
                                onPress={() => setSelectedPlan(plan.id)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={plan.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.planHeader}
                                >
                                    <View>
                                        <Text style={styles.planTitle}>{plan.title}</Text>
                                        <Text style={styles.planDescription}>{plan.description}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.selectedBadge}>
                                            <Ionicons name="checkmark" size={18} color="#FFF" />
                                        </View>
                                    )}
                                </LinearGradient>

                                <View style={styles.planBody}>
                                    <View style={styles.priceContainer}>
                                        {!plan.isFree && <Text style={styles.currencySign}>$</Text>}
                                        <Text style={styles.priceAmount}>{price}</Text>
                                        <Text style={styles.pricePeriod}>{period}</Text>
                                    </View>

                                    <View style={styles.featuresContainer}>
                                        {plan.features.map((feature, index) => (
                                            <View key={index} style={styles.featureItem}>
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={18}
                                                    color={plan.gradient[0]}
                                                    style={styles.featureIcon}
                                                />
                                                <Text style={styles.featureText}>{feature}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={[
                        styles.subscribeButton,
                        !selectedPlan && styles.subscribeButtonDisabled
                    ]}
                    onPress={handleSubscribe}
                    disabled={isLoading || !selectedPlan}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.subscribeButtonText}>
                            {selectedPlan === 'basic' ? 'Continue with Basic' : 'Subscribe Now'}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.guaranteeSection}>
                    <Ionicons name="shield-checkmark" size={20} color="#9B00FF" />
                    <Text style={styles.guaranteeText}>
                        Cancel anytime. 30-day money-back guarantee.
                    </Text>
                </View>
            </>
        );
    };

    const renderManageSubscription = () => {
        if (!subscriptionStatus) {
            return (
                <View style={styles.emptyStateContainer}>
                    <Ionicons name="alert-circle-outline" size={60} color="#777" />
                    <Text style={styles.emptyStateTitle}>No Active Subscription</Text>
                    <Text style={styles.emptyStateText}>Choose a plan to get started with PlateMate</Text>
                    <TouchableOpacity
                        style={styles.emptyStateButton}
                        onPress={() => setActiveTab('plans')}
                    >
                        <Text style={styles.emptyStateButtonText}>View Plans</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        const plan = plans.find(p => p.id === subscriptionStatus.plan);
        const isPaid = subscriptionStatus.plan !== 'basic';
        const isInTrial = subscriptionStatus.trialEndsAt && new Date(subscriptionStatus.trialEndsAt) > new Date();

        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        };

        return (
            <View style={styles.manageContainer}>
                <LinearGradient
                    colors={plan?.gradient || ['#717171', '#505050'] as [ColorValue, ColorValue]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.currentPlanBanner}
                >
                    <View>
                        <Text style={styles.currentPlanLabel}>Current Plan</Text>
                        <Text style={styles.currentPlanTitle}>{plan?.title || 'Basic'}</Text>
                    </View>
                    {isPaid && (
                        <View style={styles.currentPlanPriceBadge}>
                            <Text style={styles.currentPlanPrice}>
                                ${subscriptionStatus.endDate && subscriptionStatus.startDate ?
                                    (new Date(subscriptionStatus.endDate).getFullYear() - new Date(subscriptionStatus.startDate).getFullYear() >= 1 ?
                                        plan?.annualPrice : plan?.monthlyPrice) :
                                    plan?.monthlyPrice}
                            </Text>
                        </View>
                    )}
                </LinearGradient>

                {isInTrial && (
                    <View style={styles.trialInfoCard}>
                        <Ionicons name="time-outline" size={24} color="#9B00FF" />
                        <View style={styles.trialInfoTextContainer}>
                            <Text style={styles.trialInfoTitle}>Free Trial Active</Text>
                            <Text style={styles.trialInfoText}>
                                Your trial ends on {formatDate(subscriptionStatus.trialEndsAt!)}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.subscriptionInfoCard}>
                    <View style={styles.infoSection}>
                        <Text style={styles.infoSectionTitle}>Subscription Details</Text>

                        <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={20} color="#999" />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Started on</Text>
                                <Text style={styles.infoValue}>{formatDate(subscriptionStatus.startDate)}</Text>
                            </View>
                        </View>

                        {subscriptionStatus.endDate && (
                            <View style={styles.infoRow}>
                                <Ionicons
                                    name={subscriptionStatus.autoRenew ? "refresh-circle-outline" : "calendar-outline"}
                                    size={20}
                                    color="#999"
                                />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>
                                        {subscriptionStatus.autoRenew ? "Renews on" : "Expires on"}
                                    </Text>
                                    <Text style={styles.infoValue}>{formatDate(subscriptionStatus.endDate)}</Text>
                                </View>
                            </View>
                        )}

                        {isPaid && (
                            <View style={styles.infoRow}>
                                <Ionicons name="card-outline" size={20} color="#999" />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Payment method</Text>
                                    <Text style={styles.infoValue}>{subscriptionStatus.paymentMethod}</Text>
                                </View>
                            </View>
                        )}

                        {isPaid && (
                            <View style={styles.infoRow}>
                                <Ionicons
                                    name={subscriptionStatus.autoRenew ? "toggle" : "toggle-outline"}
                                    size={20}
                                    color={subscriptionStatus.autoRenew ? "#4CAF50" : "#999"}
                                />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>Auto-renewal</Text>
                                    <Text style={[
                                        styles.infoValue,
                                        { color: subscriptionStatus.autoRenew ? "#4CAF50" : "#FF3B30" }
                                    ]}>
                                        {subscriptionStatus.autoRenew ? "On" : "Off"}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {isPaid && (
                    <View style={styles.manageButtonsContainer}>
                        <TouchableOpacity
                            style={styles.changePlanButton}
                            onPress={() => setActiveTab('plans')}
                        >
                            <Text style={styles.changePlanButtonText}>Change Plan</Text>
                        </TouchableOpacity>

                        {subscriptionStatus.autoRenew && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowCancelConfirmation(true)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel Auto-Renewal</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {!isPaid && (
                    <TouchableOpacity
                        style={styles.upgradePlanButton}
                        onPress={() => setActiveTab('plans')}
                    >
                        <LinearGradient
                            colors={['#9B00FF', '#6600CC'] as [ColorValue, ColorValue]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.upgradeGradient}
                        >
                            <Text style={styles.upgradePlanButtonText}>Upgrade Your Plan</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderCancelConfirmation = () => {
        if (!showCancelConfirmation) return null;

        return (
            <View style={styles.cancelConfirmationOverlay}>
                <View style={styles.cancelConfirmationCard}>
                    <Ionicons name="warning" size={50} color="#FFB800" style={styles.cancelWarningIcon} />
                    <Text style={styles.cancelTitle}>Cancel Subscription?</Text>
                    <Text style={styles.cancelText}>
                        You'll continue to have access to all premium features until your current billing period ends on{' '}
                        {subscriptionStatus?.endDate ? new Date(subscriptionStatus.endDate).toLocaleDateString() : 'your expiration date'}.
                    </Text>
                    <View style={styles.cancelButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.cancelConfirmButton, styles.cancelKeepButton]}
                            onPress={() => setShowCancelConfirmation(false)}
                        >
                            <Text style={styles.cancelKeepButtonText}>Keep Subscription</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cancelConfirmButton, styles.cancelConfirmButtonRed]}
                            onPress={handleCancelSubscription}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.cancelConfirmButtonText}>Cancel</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const handleCancelSubscription = async () => {
        setIsLoading(true);
        try {
            if (!user || !user.uid || !subscriptionStatus) {
                throw new Error('No active subscription or user');
            }

            // Cancel subscription in database
            await cancelSubscription(user.uid, true);

            // Update local state
            setSubscriptionStatus({
                ...subscriptionStatus,
                autoRenew: false,
                canceledAt: new Date().toISOString()
            });

            setShowCancelConfirmation(false);
            Alert.alert(
                'Subscription Updated',
                'Auto-renewal has been turned off. You can continue using your subscription until it expires.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            Alert.alert('Error', 'Failed to cancel subscription. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['#000', '#111'] as [ColorValue, ColorValue]}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>PlateMate Subscription</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                {activeTab === 'plans' ? renderPlans() : renderManageSubscription()}
            </ScrollView>

            {renderCancelConfirmation()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        paddingTop: 10,
        paddingBottom: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
        marginBottom: 15,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    heroGradient: {
        borderRadius: 16,
    },
    heroContent: {
        padding: 24,
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 10,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 16,
        color: '#BBB',
        textAlign: 'center',
        maxWidth: '90%',
        lineHeight: 22,
    },
    billingToggle: {
        marginBottom: 24,
    },
    billingLabel: {
        color: '#DDD',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 12,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        padding: 4,
    },
    toggleOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    toggleOptionActive: {
        backgroundColor: '#333',
    },
    toggleText: {
        color: '#AAA',
        fontSize: 15,
        fontWeight: '500',
    },
    toggleTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    savingBadge: {
        backgroundColor: '#9B00FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    savingText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    trialBanner: {
        backgroundColor: '#444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 24,
    },
    trialText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
    plansContainer: {
        marginBottom: 24,
    },
    planCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    selectedPlan: {
        borderColor: '#9B00FF',
        borderWidth: 2,
    },
    planHeader: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    planTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    planDescription: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
    },
    selectedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    planBody: {
        padding: 16,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    currencySign: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 2,
    },
    priceAmount: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    pricePeriod: {
        color: '#AAA',
        fontSize: 16,
        marginLeft: 4,
    },
    featuresContainer: {
        marginTop: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    featureIcon: {
        marginRight: 8,
    },
    featureText: {
        color: '#DDD',
        fontSize: 14,
        flex: 1,
    },
    subscribeButton: {
        backgroundColor: '#9B00FF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
    },
    subscribeButtonDisabled: {
        backgroundColor: '#444',
    },
    subscribeButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    guaranteeSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    guaranteeText: {
        color: '#AAA',
        fontSize: 14,
        marginLeft: 8,
    },

    // Manage subscription styles
    manageContainer: {
        marginTop: 24,
    },
    currentPlanBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
    },
    currentPlanLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        marginBottom: 4,
    },
    currentPlanTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    currentPlanPriceBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    currentPlanPrice: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    trialInfoCard: {
        backgroundColor: 'rgba(155, 0, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(155, 0, 255, 0.3)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    trialInfoTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    trialInfoTitle: {
        color: '#9B00FF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    trialInfoText: {
        color: '#BBB',
        fontSize: 14,
    },
    subscriptionInfoCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        marginBottom: 24,
        overflow: 'hidden',
    },
    infoSection: {
        padding: 16,
    },
    infoSectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    infoTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    infoLabel: {
        color: '#999',
        fontSize: 14,
    },
    infoValue: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
        marginTop: 2,
    },
    manageButtonsContainer: {
        marginVertical: 8,
    },
    changePlanButton: {
        backgroundColor: '#333',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    changePlanButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.3)',
    },
    cancelButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '600',
    },
    upgradePlanButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
    upgradeGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    upgradePlanButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyStateTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        color: '#AAA',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyStateButton: {
        backgroundColor: '#9B00FF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    emptyStateButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelConfirmationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    cancelConfirmationCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 24,
        width: windowWidth - 48,
        alignItems: 'center',
    },
    cancelWarningIcon: {
        marginBottom: 16,
    },
    cancelTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    cancelText: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    cancelButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    cancelConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
    },
    cancelKeepButton: {
        backgroundColor: '#333',
    },
    cancelKeepButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    cancelConfirmButtonRed: {
        backgroundColor: '#FF3B30',
    },
    cancelConfirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});

export default PremiumSubscription;
