import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import SubscriptionService from '../services/SubscriptionService';
import TrialManager from '../services/TrialManager';
import { SubscriptionDetails } from '../types/user';

interface TrialStatusCardProps {
  onExtendTrial: () => void;
  onSubscribe: () => void;
}

const TrialStatusCard: React.FC<TrialStatusCardProps> = ({ onExtendTrial, onSubscribe }) => {
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
      const [status, subscription] = await Promise.all([
        TrialManager.getTrialStatus(user.uid),
        SubscriptionService.getCustomerInfo(),
      ]);

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
    return `Free Trial: ${trialStatus.daysRemaining} days left`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0074dd" />
        <Text style={styles.loadingText}>Loading subscription status...</Text>
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
        colors={['#0074dd', '#5c00dd']}
        style={styles.premiumCard}
      >
        <View style={styles.premiumHeader}>
          <MaterialCommunityIcons name="crown" size={24} color="#ffd700" />
          <Text style={styles.premiumTitle}>PlateMate Premium</Text>
        </View>
        <Text style={styles.premiumStatus}>
          {subscriptionDetails.status === 'premium_annual' ? 'Annual Plan' : 'Monthly Plan'}
        </Text>
        <Text style={styles.premiumExpiry}>
          {subscriptionDetails.endDate 
            ? `Renews ${new Date(subscriptionDetails.endDate).toLocaleDateString()}`
            : 'Active Subscription'
          }
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={trialStatus.isInTrial ? ['#0074dd', '#5c00dd'] : ['#ff4444', '#cc3333']}
        style={styles.trialCard}
      >
        <View style={styles.trialHeader}>
          <View style={styles.statusIndicator}>
            <Ionicons 
              name={trialStatus.isInTrial ? "time-outline" : "alert-circle-outline"} 
              size={24} 
              color="#fff" 
            />
          </View>
          <View style={styles.trialInfo}>
            <Text style={styles.trialTitle}>{getTrialStatusText()}</Text>
            <Text style={styles.trialSubtitle}>
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
              style={styles.extendButton} 
              onPress={handleExtendTrial}
            >
              <Ionicons name="card-outline" size={20} color="#0074dd" />
              <Text style={styles.extendButtonText}>Get 10 More Days Free</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[
              styles.subscribeButton,
              !trialStatus.isInTrial && styles.subscribeButtonUrgent
            ]} 
            onPress={onSubscribe}
          >
            <MaterialCommunityIcons name="crown" size={20} color="#fff" />
            <Text style={styles.subscribeButtonText}>
              {trialStatus.isInTrial ? 'Subscribe Now' : 'Reactivate Premium'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {trialStatus.isInTrial && trialStatus.daysRemaining <= 3 && (
        <View style={styles.urgentBanner}>
          <Ionicons name="warning" size={20} color="#ff8800" />
          <Text style={styles.urgentText}>
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
    color: '#666',
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
    color: '#fff',
    marginBottom: 4,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  trialSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  premiumStatus: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  premiumExpiry: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  extendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0074dd',
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
    borderColor: '#fff',
    gap: 8,
  },
  subscribeButtonUrgent: {
    backgroundColor: '#ff8800',
    borderColor: '#ff8800',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
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
    color: '#856404',
    fontWeight: '500',
  },
});

export default TrialStatusCard;
