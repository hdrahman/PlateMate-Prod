import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Achievement {
    id: number;
    name: string;
    description: string;
    icon?: string;
    xp_reward: number;
}

interface AchievementPopupProps {
    achievement: Achievement | null;
    visible: boolean;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const COLORS = {
    WHITE: '#FFFFFF',
    BLACK: '#000000',
    GRAY: '#8E8E93',
    GRADIENT_START: '#FF6B6B',
    GRADIENT_MIDDLE: '#4ECDC4',
    GRADIENT_END: '#45B7D1',
    GOLD: '#FFD700',
    DARK_GRAY: '#2C2C2E',
    LIGHT_GRAY: '#F2F2F7',
};

const AchievementPopup: React.FC<AchievementPopupProps> = ({
    achievement,
    visible,
    onClose,
}) => {
    const [scaleAnim] = useState(new Animated.Value(0));
    const [rotateAnim] = useState(new Animated.Value(0));
    const [opacityAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible && achievement) {
            // Reset animations
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            opacityAnim.setValue(0);

            // Start entrance animation
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 50,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto close after 3 seconds
            const timer = setTimeout(() => {
                handleClose();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [visible, achievement]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    if (!achievement) return null;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[COLORS.GRADIENT_START, COLORS.GRADIENT_MIDDLE, COLORS.GRADIENT_END]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.content}
                    >
                        {/* Close button */}
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Ionicons name="close" size={24} color={COLORS.WHITE} />
                        </TouchableOpacity>

                        {/* Achievement unlocked text */}
                        <Text style={styles.unlockedText}>🎉 Achievement Unlocked! 🎉</Text>

                        {/* Achievement icon */}
                        <Animated.View
                            style={[
                                styles.iconContainer,
                                {
                                    transform: [{ rotate: spin }],
                                },
                            ]}
                        >
                            <LinearGradient
                                colors={[COLORS.GOLD, '#FFA500', COLORS.GOLD]}
                                style={styles.iconGradient}
                            >
                                <Ionicons
                                    name={achievement.icon as any || 'trophy'}
                                    size={60}
                                    color={COLORS.WHITE}
                                />
                            </LinearGradient>
                        </Animated.View>

                        {/* Achievement details */}
                        <View style={styles.detailsContainer}>
                            <Text style={styles.achievementName}>{achievement.name}</Text>
                            <Text style={styles.achievementDescription}>
                                {achievement.description}
                            </Text>

                            {/* XP reward */}
                            <View style={styles.xpContainer}>
                                <Ionicons name="star" size={20} color={COLORS.GOLD} />
                                <Text style={styles.xpText}>+{achievement.xp_reward} XP</Text>
                            </View>
                        </View>

                        {/* Celebration particles */}
                        <View style={styles.particlesContainer}>
                            {[...Array(8)].map((_, index) => (
                                <Animated.View
                                    key={index}
                                    style={[
                                        styles.particle,
                                        {
                                            transform: [
                                                {
                                                    translateX: Math.sin(index * 45 * Math.PI / 180) * 50,
                                                },
                                                {
                                                    translateY: Math.cos(index * 45 * Math.PI / 180) * 50,
                                                },
                                                { scale: scaleAnim },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.particleText}>✨</Text>
                                </Animated.View>
                            ))}
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.85,
        maxWidth: 350,
        borderRadius: 20,
        overflow: 'hidden',
    },
    content: {
        padding: 30,
        alignItems: 'center',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 15,
    },
    unlockedText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        marginBottom: 20,
        textAlign: 'center',
    },
    iconContainer: {
        marginBottom: 20,
    },
    iconGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.BLACK,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    detailsContainer: {
        alignItems: 'center',
    },
    achievementName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        textAlign: 'center',
        marginBottom: 10,
    },
    achievementDescription: {
        fontSize: 16,
        color: COLORS.WHITE,
        textAlign: 'center',
        marginBottom: 15,
        opacity: 0.9,
    },
    xpContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    xpText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        marginLeft: 5,
    },
    particlesContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 1,
        height: 1,
    },
    particle: {
        position: 'absolute',
    },
    particleText: {
        fontSize: 20,
    },
});

export default AchievementPopup; 