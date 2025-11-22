import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface StepTrackingPermissionModalProps {
    visible: boolean;
    onEnableTracking: () => void;
    onSkip: () => void;
}

const StepTrackingPermissionModal: React.FC<StepTrackingPermissionModalProps> = ({
    visible,
    onEnableTracking,
    onSkip
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onSkip}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Header Icon */}
                        <View style={styles.iconContainer}>
                            <LinearGradient
                                colors={['#FF00F5', '#00D9FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="walk" size={48} color="#fff" />
                            </LinearGradient>
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>Step Tracking Feature</Text>

                        {/* Description */}
                        <Text style={styles.description}>
                            Track your daily steps automatically to stay motivated and reach your fitness goals.
                        </Text>

                        {/* How It Works Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>How It Works:</Text>

                            <View style={styles.featureItem}>
                                <View style={styles.featureIcon}>
                                    <Ionicons name="phone-portrait-outline" size={20} color="#FF00F5" />
                                </View>
                                <Text style={styles.featureText}>
                                    Uses your device's Motion & Fitness sensors
                                </Text>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={styles.featureIcon}>
                                    <Ionicons name="refresh-outline" size={20} color="#FF00F5" />
                                </View>
                                <Text style={styles.featureText}>
                                    Counts steps automatically throughout the day
                                </Text>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={styles.featureIcon}>
                                    <Ionicons name="time-outline" size={20} color="#FF00F5" />
                                </View>
                                <Text style={styles.featureText}>
                                    Works in the background while app is closed
                                </Text>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={styles.featureIcon}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#FF00F5" />
                                </View>
                                <Text style={styles.featureText}>
                                    Data stored privately and securely
                                </Text>
                            </View>
                        </View>

                        {/* Technical Details Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Technical Details:</Text>
                            <Text style={styles.technicalText}>
                                {Platform.OS === 'ios'
                                    ? '• iOS: Uses Core Motion (CMPedometer) API'
                                    : '• Android: Uses built-in step counter sensor'}
                            </Text>
                            <Text style={styles.technicalText}>
                                • Does NOT access HealthKit or health records
                            </Text>
                            <Text style={styles.technicalText}>
                                • Only reads step count data from motion sensors
                            </Text>
                            <Text style={styles.technicalText}>
                                • Data used solely for fitness tracking features
                            </Text>
                        </View>

                        {/* Permission Required Section */}
                        <View style={styles.permissionBox}>
                            <Ionicons name="information-circle" size={24} color="#00D9FF" style={styles.permissionIcon} />
                            <View style={styles.permissionTextContainer}>
                                <Text style={styles.permissionTitle}>Permission Required</Text>
                                <Text style={styles.permissionText}>
                                    {Platform.OS === 'ios'
                                        ? 'iOS will ask for "Motion & Fitness" access to read step count data from your device\'s motion sensors.'
                                        : 'Android will ask for "Physical Activity" permission to access your device\'s step counter sensor.'}
                                </Text>
                            </View>
                        </View>

                        {/* Privacy Notice */}
                        <Text style={styles.privacyNotice}>
                            Your step data is stored privately on your device and our secure servers.
                            We never share your data with third parties without your explicit consent.
                        </Text>
                    </ScrollView>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.enableButton}
                            onPress={onEnableTracking}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#FF00F5', '#00D9FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.enableButtonGradient}
                            >
                                <Text style={styles.enableButtonText}>Enable Step Tracking</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={onSkip}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.skipButtonText}>Skip for Now</Text>
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
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    iconGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: '#bbb',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 0, 245, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        flex: 1,
        fontSize: 15,
        color: '#ddd',
        lineHeight: 20,
    },
    technicalText: {
        fontSize: 14,
        color: '#999',
        marginBottom: 6,
        lineHeight: 20,
    },
    permissionBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.3)',
    },
    permissionIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    permissionTextContainer: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#00D9FF',
        marginBottom: 6,
    },
    permissionText: {
        fontSize: 14,
        color: '#bbb',
        lineHeight: 20,
    },
    privacyNotice: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        lineHeight: 18,
        fontStyle: 'italic',
    },
    buttonContainer: {
        padding: 20,
        paddingTop: 0,
        gap: 12,
    },
    enableButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    enableButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    enableButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    skipButton: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: '#333',
    },
    skipButtonText: {
        color: '#999',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default StepTrackingPermissionModal;

