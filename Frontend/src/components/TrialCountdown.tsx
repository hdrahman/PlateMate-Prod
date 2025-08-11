import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubscriptionService from '../services/SubscriptionService';
import SubscriptionManager from '../utils/SubscriptionManager';
import { useAuth } from '../context/AuthContext';

interface TrialCountdownProps {
  visible?: boolean;
  style?: any;
  compact?: boolean;
}

export default function TrialCountdown({ visible = true, style, compact = false }: TrialCountdownProps) {
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAuth();
  
  const [trialStatus, setTrialStatus] = useState<{
    isInTrial: boolean;
    trialType: 'promotional' | 'store' | 'none';
    daysRemaining: number;
    trialEndDate: string | null;
    canUpgrade: boolean;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    loadTrialStatus();
    
    // Refresh trial status every minute
    const interval = setInterval(loadTrialStatus, 60000);
    
    return () => clearInterval(interval);
  }, [user]);

  const loadTrialStatus = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      
      // Get promotional trial status first
      const promoTrialStatus = await SubscriptionService.getPromotionalTrialStatus();
      const subscriptionStatus = await SubscriptionManager.getSubscriptionStatus();
      
      let status;
      
      if (promoTrialStatus.isActive) {
        // User is in 20-day promotional trial
        status = {
          isInTrial: true,
          trialType: 'promotional' as const,
          daysRemaining: promoTrialStatus.daysRemaining,
          trialEndDate: promoTrialStatus.endDate || null,
          canUpgrade: promoTrialStatus.daysRemaining <= 15, // Show upgrade after 5 days
        };
      } else if (subscriptionStatus.isInTrial) {
        // User is in 10-day store trial
        status = {
          isInTrial: true,
          trialType: 'store' as const,
          daysRemaining: subscriptionStatus.daysRemaining || 0,
          trialEndDate: null,
          canUpgrade: false, // Already subscribed
        };
      } else {
        // No trial active
        status = {
          isInTrial: false,
          trialType: 'none' as const,
          daysRemaining: 0,
          trialEndDate: null,
          canUpgrade: false,
        };
      }
      
      setTrialStatus(status);
      
      // Show upgrade prompts for promotional trial
      if (status.trialType === 'promotional' && status.canUpgrade && status.daysRemaining <= 15) {
        // Show upgrade prompt for promotional trial users
        const hasShownPrompt = await checkIfPromptShown();
        if (!hasShownPrompt) {
          setTimeout(() => {
            setShowExtensionModal(true);
          }, 2000); // Show after 2 seconds
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading trial status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfPromptShown = async (): Promise<boolean> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `extension_prompt_shown_${today}`;
      const shown = await AsyncStorage.getItem(key);
      return shown === 'true';
    } catch {
      return false;
    }
  };

  const markPromptAsShown = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `extension_prompt_shown_${today}`;
      await AsyncStorage.setItem(key, 'true');
    } catch (error) {
      console.error('Error marking prompt as shown:', error);
    }
  };

  const handleUpgradeToSubscription = () => {
    // Navigate to subscription screen for promotional trial users
    setShowExtensionModal(false);
    
    // Use the navigation to go to Premium Subscription screen
    navigation.navigate('PremiumSubscription' as never);
  };

  const handleUpgradeNow = () => {
    setShowExtensionModal(false);
    navigation.navigate('PremiumSubscription', {
      source: 'trial_countdown',
      feature: 'upgrade_from_trial',
      showTrialOffer: false,
    });
  };

  const handleDismissModal = async () => {
    await markPromptAsShown();
    setShowExtensionModal(false);
  };

  if (!visible || isLoading || !trialStatus?.isInTrial) {
    return null;
  }

  const { daysRemaining, trialType, canUpgrade } = trialStatus;
  
  const isUrgent = daysRemaining <= 3;
  const isLastDay = daysRemaining <= 1;
  
  const getStatusColor = () => {
    if (isLastDay) return '#FF4444';
    if (isUrgent) return '#FF9500';
    return '#4CAF50';
  };

  const getStatusText = () => {
    const trialTypeName = trialType === 'promotional' ? 'free access' : 'subscription trial';
    
    if (isLastDay) {
      return `${trialTypeName} expires ${daysRemaining === 0 ? 'today' : 'tomorrow'}`;
    }
    return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in ${trialTypeName}`;
  };

  const renderCompactView = () => (
    <View style={[styles.compactContainer, style]}>
      <LinearGradient
        colors={[`${getStatusColor()}20`, `${getStatusColor()}10`]}
        style={styles.compactGradient}
      >
        <View style={styles.compactContent}>
          <Ionicons name="time-outline" size={16} color={getStatusColor()} />
          <Text style={[styles.compactText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          {canUpgrade && trialType === 'promotional' && (
            <TouchableOpacity 
              onPress={handleUpgradeToSubscription}
              style={styles.extendButton}
            >
              <Text style={styles.extendButtonText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );

  const renderFullView = () => (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[`${getStatusColor()}15`, `${getStatusColor()}08`]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={isUrgent ? "alert-circle" : "time-outline"} 
              size={24} 
              color={getStatusColor()} 
            />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
            <Text style={styles.subtitleText}>
              {trialType === 'promotional' && canUpgrade
                ? 'Subscribe now to get 10 more days free!'
                : trialType === 'promotional'
                  ? 'Enjoying your free access to premium features?'
                  : 'How are you liking the premium experience?'
              }
            </Text>
          </View>
          
          <View style={styles.actionContainer}>
            {trialType === 'promotional' && canUpgrade ? (
              <TouchableOpacity 
                onPress={handleUpgradeToSubscription}
                style={[styles.actionButton, { backgroundColor: getStatusColor() }]}
              >
                <Text style={styles.actionButtonText}>Get 10 More Days</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handleUpgradeToSubscription}
                style={[styles.actionButton, { backgroundColor: getStatusColor() }]}
              >
                <Text style={styles.actionButtonText}>Subscribe Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <>
      {compact ? renderCompactView() : renderFullView()}
      
      {/* Extension Modal */}
      <Modal
        visible={showExtensionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={handleDismissModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#5A60EA', '#FF00F5']}
              style={styles.modalGradient}
            >
              <View style={styles.modalContent}>
                <Ionicons name="gift-outline" size={48} color="#FFF" />
                
                <Text style={styles.modalTitle}>
                  {trialType === 'promotional' ? 'Get 10 More Days Free! 🎉' : 'Upgrade to Premium! 🎉'}
                </Text>
                
                <Text style={styles.modalText}>
                  {trialType === 'promotional' 
                    ? 'Subscribe now and get an additional 10-day free trial before your first payment!'
                    : 'Subscribe to continue enjoying all premium features without interruption.'
                  }
                </Text>
                
                <Text style={styles.modalSubtext}>
                  {trialType === 'promotional'
                    ? 'Auto-renew required to start. Cancel anytime during trial to avoid charges.'
                    : 'Manage your subscription anytime in your account settings.'
                  }
                </Text>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    onPress={handleUpgradeToSubscription}
                    style={styles.primaryModalButton}
                  >
                    <Text style={styles.primaryModalButtonText}>
                      {trialType === 'promotional' ? 'Get 10 More Days' : 'Subscribe Now'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleDismissModal}
                    style={styles.secondaryModalButton}
                  >
                    <Text style={styles.secondaryModalButtonText}>
                      Maybe Later
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleDismissModal}
                    style={styles.dismissButton}
                  >
                    <Text style={styles.dismissButtonText}>Maybe Later</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 14,
    color: '#FFFFFF90',
  },
  actionContainer: {
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Compact styles
  compactContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  compactGradient: {
    padding: 8,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  extendButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  extendButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#FFFFFF90',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#FFFFFF70',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    width: '100%',
  },
  primaryModalButton: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryModalButtonText: {
    color: '#5A60EA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryModalButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryModalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#FFFFFF60',
    fontSize: 14,
  },
});