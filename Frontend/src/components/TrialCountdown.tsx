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
import TrialManager from '../services/TrialManager';
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
    trialType: 'initial' | 'extended' | 'none';
    daysRemaining: number;
    trialEndDate: string | null;
    canExtendTrial: boolean;
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
      
      // Get unified subscription status (includes automatic trials)
      const subscriptionStatus = await SubscriptionManager.getSubscriptionStatus();
      
      // Convert to trial status format for this component
      const status = {
        isInTrial: subscriptionStatus.isInTrial,
        trialType: subscriptionStatus.tier === 'trial' ? 'initial' as const : 'none' as const,
        daysRemaining: subscriptionStatus.daysRemaining || 0,
        trialEndDate: null, // We don't need exact date for this component
        canExtendTrial: subscriptionStatus.canExtendTrial || false,
      };
      
      setTrialStatus(status);
      
      // Show auto-renew prompt if conditions are met (for automatic trials)
      if (status.canExtendTrial && status.isInTrial && status.daysRemaining <= 5) {
        // Only show once per session to avoid spam
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

  const handleExtendTrial = async () => {
    if (!user?.uid) return;

    try {
      setIsExtending(true);
      
      // For automatic trials, use our new extension logic
      const success = await SubscriptionManager.extendAutoTrial(user.uid);
      
      if (success) {
        // Refresh trial status
        await loadTrialStatus();
        
        setShowExtensionModal(false);
        
        Alert.alert(
          'Trial Extended! 🎉',
          'Your trial has been extended to 30 days total. You now have 10 additional days to explore all premium features!',
          [{ text: 'Awesome!', style: 'default' }]
        );
      } else {
        throw new Error('Extension failed');
      }
      
    } catch (error: any) {
      console.error('❌ Error extending trial:', error);
      
      let errorMessage = 'Unable to extend trial. Please try again later.';
      
      if (error.message?.includes('already')) {
        errorMessage = 'Your trial has already been extended to the maximum duration.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'No active trial found to extend.';
      }
      
      Alert.alert('Extension Error', errorMessage);
    } finally {
      setIsExtending(false);
    }
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

  const { daysRemaining, trialType, canExtendTrial } = trialStatus;
  
  const isUrgent = daysRemaining <= 3;
  const isLastDay = daysRemaining <= 1;
  
  const getStatusColor = () => {
    if (isLastDay) return '#FF4444';
    if (isUrgent) return '#FF9500';
    return '#4CAF50';
  };

  const getStatusText = () => {
    if (isLastDay) {
      return `Trial expires ${daysRemaining === 0 ? 'today' : 'tomorrow'}`;
    }
    return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in trial`;
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
          {canExtendTrial && (
            <TouchableOpacity 
              onPress={() => setShowExtensionModal(true)}
              style={styles.extendButton}
            >
              <Text style={styles.extendButtonText}>Extend</Text>
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
              {trialType === 'initial' && canExtendTrial
                ? 'Add payment method to extend to 30 days'
                : 'Enjoying the premium experience?'
              }
            </Text>
          </View>
          
          <View style={styles.actionContainer}>
            {canExtendTrial && trialType === 'initial' ? (
              <TouchableOpacity 
                onPress={() => setShowExtensionModal(true)}
                style={[styles.actionButton, { backgroundColor: getStatusColor() }]}
              >
                <Text style={styles.actionButtonText}>Extend Trial</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={handleUpgradeNow}
                style={[styles.actionButton, { backgroundColor: getStatusColor() }]}
              >
                <Text style={styles.actionButtonText}>Upgrade Now</Text>
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
                  Extend Your Trial! 🎉
                </Text>
                
                <Text style={styles.modalText}>
                  Love what you're seeing? Add a payment method now to extend your trial from 20 to 30 days total.
                </Text>
                
                <Text style={styles.modalSubtext}>
                  You won't be charged until your trial ends. Cancel anytime.
                </Text>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    onPress={handleExtendTrial}
                    style={styles.primaryModalButton}
                    disabled={isExtending}
                  >
                    {isExtending ? (
                      <ActivityIndicator color="#5A60EA" size="small" />
                    ) : (
                      <Text style={styles.primaryModalButtonText}>
                        Extend to 30 Days
                      </Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleUpgradeNow}
                    style={styles.secondaryModalButton}
                  >
                    <Text style={styles.secondaryModalButtonText}>
                      Subscribe Now
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