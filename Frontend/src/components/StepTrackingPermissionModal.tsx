import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface StepTrackingPermissionModalProps {
    visible: boolean;
    onEnableTracking: () => void | Promise<void>;
    onSkip: () => void | Promise<void>;
}

const StepTrackingPermissionModal: React.FC<StepTrackingPermissionModalProps> = ({
    visible,
    onEnableTracking,
    onSkip,
}) => {
    const handleRequestClose = () => {
        Promise.resolve(onSkip()).catch((error) => {
            console.error('Error in onSkip callback (back button):', error);
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleRequestClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Enable Step Tracking</Text>
                    </View>

                    {/* Motion & Fitness Badge */}
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Ionicons name="fitness" size={16} color="#00D9FF" />
                            <Text style={styles.badgeText}>Motion & Fitness</Text>
                        </View>
                    </View>

                    <Text style={styles.subtitle}>
                        Track your daily steps automatically to stay motivated.
                    </Text>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Info Section - Privacy/Data Usage */}
                        <View style={styles.infoBox}>
                            <Ionicons name="shield-checkmark-outline" size={20} color="#00D9FF" />
                            <Text style={styles.infoText}>
                                PlateMate uses your device's Motion & Fitness sensors to track steps.
                                {'\n\n'}
                                This data is used solely for your fitness goals. It is stored securely and never shared with third parties.
                            </Text>
                        </View>

                        {/* Feature Card 1: How it works */}
                        <View style={styles.featureCard}>
                            <View style={styles.featureHeader}>
                                <View style={styles.featureIconContainer}>
                                    <Ionicons name="walk" size={24} color="#FF00F5" />
                                </View>
                                <Text style={styles.featureTitle}>Automatic Tracking</Text>
                            </View>
                            <Text style={styles.featureDescription}>
                                • Counts steps in the background{'\n'}
                                • Works while phone is in your pocket{'\n'}
                                • Low battery usage
                            </Text>
                        </View>

                        {/* Feature Card 2: Technical */}
                        <View style={styles.featureCard}>
                            <View style={styles.featureHeader}>
                                <View style={styles.featureIconContainer}>
                                    <Ionicons name="hardware-chip-outline" size={24} color="#00D9FF" />
                                </View>
                                <Text style={styles.featureTitle}>Device Sensors</Text>
                            </View>
                            <Text style={styles.featureDescription}>
                                {Platform.OS === 'ios'
                                    ? '• Uses Core Motion (CMPedometer)\n• No HealthKit access required'
                                    : '• Uses built-in step counter\n• No extra permissions needed'}
                            </Text>
                        </View>

                    </ScrollView>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                Promise.resolve(onSkip()).catch((error) => {
                                    console.error('Error in onSkip callback:', error);
                                });
                            }}
                        >
                            <Text style={styles.cancelButtonText}>Don't track my steps</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => {
                                Promise.resolve(onEnableTracking()).catch((error) => {
                                    console.error('Error in onEnableTracking callback:', error);
                                });
                            }}
                        >
                            <LinearGradient
                                colors={['#0074dd', '#5c00dd', '#dd0095']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.confirmButtonGradient}
                            >
                                <Text style={styles.confirmButtonText}>Enable Step Tracking</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        width: Math.min(width - 40, 500),
        maxHeight: '85%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
    },
    badgeContainer: {
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0, 217, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.4)',
        gap: 6,
    },
    badgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#00D9FF',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    content: {
        paddingHorizontal: 24,
        maxHeight: 500,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.3)',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#00D9FF',
        marginLeft: 12,
        lineHeight: 20,
    },
    featureCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    featureHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    featureDescription: {
        fontSize: 14,
        color: '#bbb',
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'column', // Stacked buttons for better touch targets on mobile
        padding: 24,
        paddingTop: 16,
        gap: 12,
    },
    cancelButton: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: '#aaa',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    confirmButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default StepTrackingPermissionModal;
