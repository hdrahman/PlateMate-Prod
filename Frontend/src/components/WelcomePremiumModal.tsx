import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface WelcomePremiumModalProps {
    visible: boolean;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const WelcomePremiumModal: React.FC<WelcomePremiumModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.welcomeHeader}>
                            <LinearGradient
                                colors={['#0074dd', '#5c00dd', '#dd0095']}
                                style={styles.crownIcon}
                            >
                                <MaterialCommunityIcons name="crown" size={32} color="#fff" />
                            </LinearGradient>
                            <Text style={styles.title}>Welcome to PlateMate Premium!</Text>
                            <Text style={styles.subtitle}>We've automatically started your 20-day free trial</Text>
                        </View>

                        <View style={styles.trialCard}>
                            <View style={styles.trialHeader}>
                                <View style={styles.trialIconContainer}>
                                    <Ionicons name="time-outline" size={24} color="#0074dd" />
                                </View>
                                <Text style={styles.trialTitle}>15-Day Premium Trial</Text>
                            </View>
                            <Text style={styles.trialDescription}>
                                You now have full access to all premium features for 20 days, completely free!
                            </Text>

                            <View style={styles.featuresContainer}>
                                {[
                                    'AI-powered meal recommendations',
                                    'Unlimited food photo analysis',
                                    'Comprehensive nutrition tracking',
                                    'Unlimited meal plans',
                                    'Premium recipes & workout plans',
                                    'Priority customer support'
                                ].map((feature, index) => (
                                    <View key={index} style={styles.featureItem}>
                                        <Ionicons name="checkmark-circle" size={20} color="#0074dd" />
                                        <Text style={styles.featureText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.trialBenefitsCard}>
                            <Text style={styles.benefitsTitle}>What's Included in Your Trial</Text>

                            <View style={styles.benefitRow}>
                                <MaterialCommunityIcons name="robot" size={24} color="#5c00dd" />
                                <View style={styles.benefitTextContainer}>
                                    <Text style={styles.benefitTitle}>AI Nutrition Coach</Text>
                                    <Text style={styles.benefitDescription}>
                                        Get personalized meal recommendations based on your goals
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.benefitRow}>
                                <MaterialCommunityIcons name="camera-outline" size={24} color="#dd0095" />
                                <View style={styles.benefitTextContainer}>
                                    <Text style={styles.benefitTitle}>Smart Food Recognition</Text>
                                    <Text style={styles.benefitDescription}>
                                        Take photos of your meals for instant nutritional analysis
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.benefitRow}>
                                <MaterialCommunityIcons name="chart-line" size={24} color="#0074dd" />
                                <View style={styles.benefitTextContainer}>
                                    <Text style={styles.benefitTitle}>Advanced Analytics</Text>
                                    <Text style={styles.benefitDescription}>
                                        Track your progress with detailed charts and insights
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.startButton}
                            onPress={onClose}
                        >
                            <LinearGradient
                                colors={['#0074dd', '#5c00dd', '#dd0095']}
                                style={styles.startButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.startButtonText}>Start My Journey</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.startButtonIcon} />
                            </LinearGradient>
                        </TouchableOpacity>

                        <Text style={styles.disclaimer}>
                            No commitment required. Cancel anytime during your trial period.
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: width * 0.9,
        maxHeight: height * 0.85,
        backgroundColor: '#000',
        borderRadius: 20,
        overflow: 'hidden',
    },
    scrollContent: {
        padding: 24,
    },
    welcomeHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    crownIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    trialCard: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    trialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    trialIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    trialTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    trialDescription: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
        marginBottom: 16,
    },
    featuresContainer: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#fff',
        flex: 1,
    },
    trialBenefitsCard: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    benefitsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
    },
    benefitTextContainer: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    benefitDescription: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
    },
    startButton: {
        marginBottom: 16,
    },
    startButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    startButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    startButtonIcon: {
        marginLeft: 4,
    },
    disclaimer: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        lineHeight: 16,
    },
});

export default WelcomePremiumModal; 