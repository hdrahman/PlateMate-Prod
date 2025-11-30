import React, { useContext } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';

interface FirstFoodLogPopupProps {
    visible: boolean;
    onClose: () => void;
    onRecordNow: () => void;
    onRecordLater: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const FirstFoodLogPopup: React.FC<FirstFoodLogPopupProps> = ({
    visible,
    onClose,
    onRecordNow,
    onRecordLater,
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
                <View style={styles.modalContainer}>
                    <LinearGradient
                        colors={isDarkTheme ? [theme.colors.cardBackground, '#2d2d2d'] : [theme.colors.cardBackground, theme.colors.background]}
                        style={styles.modalContent}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}15` }]}>
                                <Ionicons name="videocam" size={32} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: theme.colors.text }]}>Message to Future You</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <View style={styles.content}>
                            <Text style={[styles.message, { color: theme.colors.text }]}>
                                🎉 Congrats on logging your first meal!
                            </Text>

                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                Research shows that people who record a motivational video message to their future self are{' '}
                                <Text style={[styles.highlight, { color: theme.colors.primary }]}>3x more likely</Text> to stick with their health goals when the journey gets tough.
                            </Text>

                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                Take a moment to remind your future self why this journey matters to you.
                                It could be the motivation you need on challenging days ahead.
                            </Text>
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={onRecordNow}
                            >
                                <LinearGradient
                                    colors={[theme.colors.primary, theme.colors.primary]}
                                    style={styles.buttonGradient}
                                >
                                    <Ionicons name="videocam" size={20} color={theme.colors.text} />
                                    <Text style={[styles.primaryButtonText, { color: theme.colors.text }]}>Record Now</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.secondaryButton, { backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
                                onPress={onRecordLater}
                            >
                                <Ionicons name="time" size={16} color={theme.colors.textSecondary} />
                                <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>Maybe Later</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
                            You can always record your message later in Settings
                        </Text>
                    </LinearGradient>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        width: Math.min(screenWidth - 40, 380),
        borderRadius: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    modalContent: {
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        marginBottom: 24,
    },
    message: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 16,
    },
    highlight: {
        fontWeight: '700',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    buttonContainer: {
        gap: 12,
        marginBottom: 12,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 8,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 6,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

export default FirstFoodLogPopup;
