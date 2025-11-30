import React, { useEffect, useRef, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ThemeContext } from '../ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ElegantAlertProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'premium' | 'rate_limit' | 'info' | 'success' | 'warning' | 'error';
    icon?: string;
    primaryButtonText?: string;
    secondaryButtonText?: string;
    onPrimaryPress?: () => void;
    onSecondaryPress?: () => void;
    showCloseButton?: boolean;
    autoClose?: number; // Auto close after N milliseconds
}

const ElegantAlert: React.FC<ElegantAlertProps> = ({
    visible,
    onClose,
    title,
    message,
    type = 'info',
    icon,
    primaryButtonText,
    secondaryButtonText = 'Not Now',
    onPrimaryPress,
    onSecondaryPress,
    showCloseButton = true,
    autoClose,
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            // Animate in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto close if specified
            if (autoClose) {
                const timer = setTimeout(() => {
                    handleClose();
                }, autoClose);
                return () => clearTimeout(timer);
            }
        } else {
            // Animate out
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.8,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 30,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, autoClose]);

    const handleClose = () => {
        onClose();
    };

    const handlePrimaryPress = () => {
        if (onPrimaryPress) {
            onPrimaryPress();
        } else {
            handleClose();
        }
    };

    const handleSecondaryPress = () => {
        if (onSecondaryPress) {
            onSecondaryPress();
        } else {
            handleClose();
        }
    };

    const getTypeConfig = () => {
        switch (type) {
            case 'premium':
                return {
                    icon: icon || 'diamond-outline',
                    iconColor: theme.colors.primary,
                    gradient: ['#5A60EA', theme.colors.primary],
                    primaryButton: primaryButtonText || 'Upgrade Now',
                };
            case 'rate_limit':
                return {
                    icon: icon || 'time-outline',
                    iconColor: theme.colors.warning,
                    gradient: [theme.colors.warning, '#FF5722'],
                    primaryButton: primaryButtonText || 'Upgrade for More',
                };
            case 'success':
                return {
                    icon: icon || 'checkmark-circle-outline',
                    iconColor: theme.colors.success,
                    gradient: [theme.colors.success, '#2E7D32'],
                    primaryButton: primaryButtonText || 'Continue',
                };
            case 'warning':
                return {
                    icon: icon || 'warning-outline',
                    iconColor: theme.colors.warning,
                    gradient: [theme.colors.warning, '#F57C00'],
                    primaryButton: primaryButtonText || 'Understand',
                };
            case 'error':
                return {
                    icon: icon || 'alert-circle-outline',
                    iconColor: theme.colors.error,
                    gradient: [theme.colors.error, '#D32F2F'],
                    primaryButton: primaryButtonText || 'Try Again',
                };
            default:
                return {
                    icon: icon || 'information-circle-outline',
                    iconColor: '#2196F3',
                    gradient: ['#2196F3', '#1976D2'],
                    primaryButton: primaryButtonText || 'OK',
                };
        }
    };

    const typeConfig = getTypeConfig();

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="none"
            onRequestClose={handleClose}
        >
            <Animated.View
                style={[
                    styles.overlay,
                    {
                        opacity: fadeAnim,
                    },
                ]}
            >
                <BlurView intensity={30} style={StyleSheet.absoluteFill}>
                    <TouchableOpacity
                        style={styles.overlayTouch}
                        activeOpacity={1}
                        onPress={handleClose}
                    />
                </BlurView>

                <Animated.View
                    style={[
                        styles.alertContainer,
                        {
                            transform: [
                                { scale: scaleAnim },
                                { translateY: slideAnim },
                            ],
                        },
                    ]}
                >
                    {/* Close button */}
                    {showCloseButton && (
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={handleClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    )}

                    {/* Content Card */}
                    <LinearGradient
                        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                        style={[styles.contentCard, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                    >
                        {/* Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: typeConfig.iconColor + '20' }]}>
                            <Ionicons
                                name={typeConfig.icon as any}
                                size={32}
                                color={typeConfig.iconColor}
                            />
                        </View>

                        {/* Title */}
                        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>

                        {/* Message */}
                        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            {/* Primary Button */}
                            <TouchableOpacity
                                style={styles.primaryButtonContainer}
                                onPress={handlePrimaryPress}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={typeConfig.gradient}
                                    style={styles.primaryButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={[styles.primaryButtonText, { color: theme.colors.text }]}>
                                        {typeConfig.primaryButton}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Secondary Button */}
                            {(onSecondaryPress || secondaryButtonText !== 'Not Now') && (
                                <TouchableOpacity
                                    style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                                    onPress={handleSecondaryPress}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
                                        {secondaryButtonText}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </LinearGradient>

                    {/* Subtle decorative elements */}
                    <View style={[styles.decorativeCircle, styles.decorativeCircle1, { backgroundColor: theme.colors.primary + '1A' }]} />
                    <View style={[styles.decorativeCircle, styles.decorativeCircle2, { backgroundColor: theme.colors.primary + '0D' }]} />
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 20,
    },
    overlayTouch: {
        ...StyleSheet.absoluteFillObject,
    },
    alertContainer: {
        width: '100%',
        maxWidth: 340,
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: -10,
        right: -10,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    contentCard: {
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 28,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        paddingHorizontal: 4,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    primaryButtonContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    primaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        minHeight: 52,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
    },
    decorativeCircle: {
        position: 'absolute',
        borderRadius: 50,
    },
    decorativeCircle1: {
        width: 100,
        height: 100,
        top: -30,
        left: -30,
        zIndex: -1,
    },
    decorativeCircle2: {
        width: 60,
        height: 60,
        bottom: -20,
        right: -20,
        zIndex: -1,
    },
});

export default ElegantAlert;