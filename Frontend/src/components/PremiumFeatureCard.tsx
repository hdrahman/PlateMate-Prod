import React, { useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
    Dimensions
} from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface PremiumFeatureCardProps {
    visible: boolean;
    onClose: () => void;
    onUpgrade: () => void;
    title: string;
    subtitle: string;
    features: string[];
    icon: keyof typeof Ionicons.glyphMap;
    trialText?: string;
}

const { width } = Dimensions.get('window');

const PremiumFeatureCard: React.FC<PremiumFeatureCardProps> = ({
    visible,
    onClose,
    onUpgrade,
    title,
    subtitle,
    features,
    icon,
    trialText = "10 days free • Cancel anytime"
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {Platform.OS === 'ios' ? (
                    <BlurView
                        intensity={15}
                        tint="dark"
                        style={styles.blurOverlay}
                    >
                        <View style={[styles.blurBackdrop, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)' }]} />
                        <View style={styles.cardContent}>
                            <LinearGradient
                                colors={['#5A60EA', '#FF00F5']}
                                style={styles.cardGradient}
                            >
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={onClose}
                                >
                                    <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.8)" />
                                </TouchableOpacity>

                                <Ionicons name={icon} size={64} color="#FFF" />
                                <Text style={styles.cardTitle}>{title}</Text>
                                <Text style={styles.cardSubtitle}>{subtitle}</Text>

                                <View style={styles.featuresContainer}>
                                    {features.map((feature, index) => (
                                        <View key={index} style={styles.featureRow}>
                                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                            <Text style={styles.featureText}>{feature}</Text>
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={styles.upgradeButton}
                                    onPress={onUpgrade}
                                >
                                    <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
                                </TouchableOpacity>

                                <Text style={styles.trialText}>{trialText}</Text>
                            </LinearGradient>
                        </View>
                    </BlurView>
                ) : (
                    <View style={[styles.blurOverlay, styles.androidBlurOverlay, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)' }]}>
                        <View style={styles.cardContent}>
                            <LinearGradient
                                colors={['#5A60EA', '#FF00F5']}
                                style={styles.cardGradient}
                            >
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={onClose}
                                >
                                    <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.8)" />
                                </TouchableOpacity>

                                <Ionicons name={icon} size={64} color="#FFF" />
                                <Text style={styles.cardTitle}>{title}</Text>
                                <Text style={styles.cardSubtitle}>{subtitle}</Text>

                                <View style={styles.featuresContainer}>
                                    {features.map((feature, index) => (
                                        <View key={index} style={styles.featureRow}>
                                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                            <Text style={styles.featureText}>{feature}</Text>
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={styles.upgradeButton}
                                    onPress={onUpgrade}
                                >
                                    <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
                                </TouchableOpacity>

                                <Text style={styles.trialText}>{trialText}</Text>
                            </LinearGradient>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    blurOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    blurBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    androidBlurOverlay: {
    },
    cardContent: {
        width: '100%',
        maxWidth: 350,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    cardGradient: {
        padding: 32,
        alignItems: 'center',
        position: 'relative',
        borderRadius: 20,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    cardTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    cardSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    featuresContainer: {
        width: '100%',
        marginBottom: 24,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        fontSize: 16,
        color: '#FFF',
        marginLeft: 12,
        fontWeight: '500',
    },
    upgradeButton: {
        backgroundColor: '#FFF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 25,
        marginBottom: 12,
        minWidth: 200,
        alignItems: 'center',
    },
    upgradeButtonText: {
        color: '#5A60EA',
        fontSize: 18,
        fontWeight: 'bold',
    },
    trialText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
});

export default PremiumFeatureCard;