import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import SubscriptionService from '../services/SubscriptionService';
import SubscriptionManager from '../utils/SubscriptionManager';
import { SubscriptionDetails } from '../types/user';

interface TrialStatusCardProps {
    onExtendTrial: () => void;
    onSubscribe: () => void;
}

const TrialStatusCard: React.FC<TrialStatusCardProps> = ({ onExtendTrial, onSubscribe }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { user } = useAuth();
    const [trialStatus, setTrialStatus] = useState<{
        isInTrial: boolean;
        daysRemaining: number;
        isExtended: boolean;
        canExtend: boolean;
        endDate: Date;
    } | null>(null);
    const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTrialStatus();
    }, [user]);

    const loadTrialStatus = async () => {
        if (!user?.uid) return;

        try {
            setIsLoading(true);
            const [subscriptionStatus, subscription] = await Promise.all([
                SubscriptionManager.getSubscriptionStatus(),
                SubscriptionService.getCustomerInfo(),
            ]);

            // Convert SubscriptionStatus to trial status format
            const status = {
                isInTrial: subscriptionStatus.isInTrial,
                daysRemaining: subscriptionStatus.daysRemaining || 0,
                isExtended: false, // Extended trial info not needed with RevenueCat
                canExtend: subscriptionStatus.canExtendTrial || false,
                endDate: new Date(), // Placeholder, not used in UI
            };

            setTrialStatus(status);
            if (subscription) {
                setSubscriptionDetails(SubscriptionService.customerInfoToSubscriptionDetails(subscription));
            }
        } catch (error) {
            console.error('Error loading trial status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtendTrial = async () => {
        if (!user?.uid || !trialStatus?.canExtend) return;

        Alert.alert(
            'Extend Your Trial',
            'Add a payment method to get 10 additional days free. You won\'t be charged until after the extended trial ends, and you can cancel anytime.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add Payment Method',
                    onPress: () => {
                        // This would typically open a payment method selector
                        // For now, we'll simulate adding a payment method
                        onExtendTrial();
                    },
                },
            ]
        );
    };

    const getTrialStatusColor = () => {
        if (!trialStatus?.isInTrial) return '#ff4444';
        if (trialStatus.daysRemaining <= 3) return '#ff8800';
        return '#00aa44';
    };

    const getTrialStatusText = () => {
        if (!trialStatus?.isInTrial) return 'Trial Expired';
        if (trialStatus.isExtended) return `Extended Trial: ${trialStatus.daysRemaining} days left`;
        return `Trial: ${trialStatus.daysRemaining} days left`;
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading subscription status...</Text>
            </View>
        );
    }

    if (!trialStatus) {
        return null;
    }

    // Show premium status if user has active subscription
    if (subscriptionDetails && ['premium_monthly', 'premium_annual'].includes(subscriptionDetails.status)) {
        return (
            <LinearGradient
                colors={[theme.colors.primary, '#5c00dd']}
                style={[styles.premiumCard, { backgroundColor: theme.colors.cardBackground }]}
            >
                <View style={styles.premiumHeader}>
                    <MaterialCommunityIcons name="crown" size={24} color="#ffd700" />
                    <Text style={[styles.premiumTitle, { color: theme.colors.text }]}>PlateMate Premium</Text>
                </View>
                <Text style={[styles.premiumStatus, { color: theme.colors.text }]}>
                    {subscriptionDetails.status === 'premium_annual' ? 'Annual Plan' : 'Monthly Plan'}
                </Text>
                <Text style={[styles.premiumExpiry, { color: theme.colors.textSecondary }]}>
                    {subscriptionDetails.endDate
                        ? `Renews ${new Date(subscriptionDetails.endDate).toLocaleDateString()}`
                        : 'Active Subscription'
                    }
                </Text>
            </LinearGradient>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={trialStatus.isInTrial ? [theme.colors.primary, '#5c00dd'] : ['#ff4444', '#cc3333']}
                style={[styles.trialCard, { backgroundColor: theme.colors.cardBackground }]}
            >
                <View style={styles.trialHeader}>
                    <View style={styles.statusIndicator}>
                        <Ionicons
                            name={trialStatus.isInTrial ? "time-outline" : "alert-circle-outline"}
                            size={24}
                            color={theme.colors.text}
                        />
                    </View>
                    <View style={styles.trialInfo}>
                        <Text style={[styles.trialTitle, { color: theme.colors.text }]}>{getTrialStatusText()}</Text>
                        <Text style={[styles.trialSubtitle, { color: theme.colors.textSecondary }]}>
                            {trialStatus.isInTrial
                                ? `Expires ${trialStatus.endDate.toLocaleDateString()}`
                                : 'Subscribe to continue using premium features'
                            }
                        </Text>
                    </View>
                </View>

                {trialStatus.isInTrial && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${Math.max(10, (trialStatus.daysRemaining / (trialStatus.isExtended ? 30 : 20)) * 100)}%`,
                                        backgroundColor: getTrialStatusColor()
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {trialStatus.daysRemaining} of {trialStatus.isExtended ? 30 : 20} days remaining
                        </Text>
                    </View>
                )}

                <View style={styles.actionContainer}>
                    {trialStatus.canExtend && (
                        <TouchableOpacity
                            style={[styles.extendButton, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={handleExtendTrial}
                        >
                            <Ionicons name="card-outline" size={20} color={theme.colors.primary} />
                            <Text style={[styles.extendButtonText, { color: theme.colors.primary }]}>Get 10 More Days Free</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.subscribeButton,
                            !trialStatus.isInTrial && styles.subscribeButtonUrgent
                        ]}
                        onPress={onSubscribe}
                    >
                        <MaterialCommunityIcons name="crown" size={20} color={theme.colors.text} />
                        <Text style={[styles.subscribeButtonText, { color: theme.colors.text }]}>
                            {trialStatus.isInTrial ? 'Subscribe Now' : 'Reactivate Premium'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {trialStatus.isInTrial && trialStatus.daysRemaining <= 3 && (
                <View style={[styles.urgentBanner, { backgroundColor: isDarkTheme ? theme.colors.cardBackground : '#fff3cd' }]}>
                    <Ionicons name="warning" size={20} color="#ff8800" />
                    <Text style={[styles.urgentText, { color: isDarkTheme ? theme.colors.text : '#856404' }]}>
                        Your trial ends soon! Subscribe now to keep all your premium features.
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    trialCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
    },
    premiumCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
    },
    trialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    premiumHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusIndicator: {
        marginRight: 12,
    },
    trialInfo: {
        flex: 1,
    },
    trialTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    premiumTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    trialSubtitle: {
        fontSize: 14,
    },
    premiumStatus: {
        fontSize: 16,
        marginBottom: 4,
    },
    premiumExpiry: {
        fontSize: 14,
    },
    progressContainer: {
        marginBottom: 16,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
    actionContainer: {
        gap: 12,
    },
    extendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
    },
    extendButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    subscribeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        gap: 8,
    },
    subscribeButtonUrgent: {
        backgroundColor: '#ff8800',
        borderColor: '#ff8800',
    },
    subscribeButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    urgentBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff8800',
        gap: 12,
    },
    urgentText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
});

export default TrialStatusCard;
