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

interface LevelUpPopupProps {
    visible: boolean;
    newLevel: number;
    newRank: string;
    levelsGained?: number;
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
    PURPLE: '#8A2BE2',
    ORANGE: '#FF8C00',
};

const LevelUpPopup: React.FC<LevelUpPopupProps> = ({
    visible,
    newLevel,
    newRank,
    levelsGained = 1,
    onClose,
}) => {
    const [scaleAnim] = useState(new Animated.Value(0));
    const [pulseAnim] = useState(new Animated.Value(1));
    const [slideAnim] = useState(new Animated.Value(-100));
    const [opacityAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0);
            pulseAnim.setValue(1);
            slideAnim.setValue(-100);
            opacityAnim.setValue(0);

            // Start entrance animation
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 60,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        tension: 50,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                ]),
                // Pulsing animation for level number
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.2,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                    ]),
                    { iterations: 3 }
                ),
            ]).start();

            // Auto close after 4 seconds
            const timer = setTimeout(() => {
                handleClose();
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

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
            Animated.timing(slideAnim, {
                toValue: 100,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const getRankColor = (rank: string) => {
        const rankColors: { [key: string]: string[] } = {
            'Beginner': [COLORS.GRAY, '#A8A8A8'],
            'Novice': ['#CD7F32', '#DEB887'],
            'Amateur': ['#C0C0C0', '#E8E8E8'],
            'Intermediate': [COLORS.GOLD, '#FFF700'],
            'Advanced': [COLORS.ORANGE, '#FFB347'],
            'Expert': [COLORS.PURPLE, '#DA70D6'],
            'Master': ['#FF1493', '#FF69B4'],
            'Elite': ['#00CED1', '#48D1CC'],
            'Champion': ['#FF4500', '#FF6347'],
            'Legend': ['#FFD700', '#FFFF00'],
            'Mythic': ['#8A2BE2', '#9932CC'],
            'Immortal': ['#DC143C', '#FF1493'],
            'Divine': ['#00BFFF', '#87CEEB'],
            'Transcendent': ['#FF00FF', '#DA70D6'],
            'Omnipotent': ['#FFFFFF', '#F0F8FF'],
        };
        return rankColors[rank] || [COLORS.GOLD, '#FFF700'];
    };

    const rankColors = getRankColor(newRank);

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
                            transform: [
                                { scale: scaleAnim },
                                { translateY: slideAnim }
                            ],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={rankColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.content}
                    >
                        {/* Close button */}
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Ionicons name="close" size={24} color={COLORS.WHITE} />
                        </TouchableOpacity>

                        {/* Level up text */}
                        <Text style={styles.levelUpText}>
                            {levelsGained > 1 ? '🚀 MULTI LEVEL UP! 🚀' : '⭐ LEVEL UP! ⭐'}
                        </Text>

                        {/* Level display */}
                        <Animated.View
                            style={[
                                styles.levelContainer,
                                {
                                    transform: [{ scale: pulseAnim }],
                                },
                            ]}
                        >
                            <View style={styles.levelBadge}>
                                <Text style={styles.levelText}>LEVEL</Text>
                                <Text style={styles.levelNumber}>{newLevel}</Text>
                            </View>
                        </Animated.View>

                        {/* Rank display */}
                        <View style={styles.rankContainer}>
                            <Text style={styles.rankText}>"{newRank}"</Text>
                        </View>

                        {/* Congratulations message */}
                        <Text style={styles.congratsText}>
                            {levelsGained > 1
                                ? `Amazing! You gained ${levelsGained} levels!`
                                : 'Congratulations on your progress!'
                            }
                        </Text>

                        {/* Sparkle effects */}
                        <View style={styles.sparkleContainer}>
                            {[...Array(12)].map((_, index) => (
                                <Animated.View
                                    key={index}
                                    style={[
                                        styles.sparkle,
                                        {
                                            left: `${10 + (index * 7)}%`,
                                            top: `${15 + Math.sin(index) * 20}%`,
                                            transform: [
                                                {
                                                    rotate: `${index * 30}deg`,
                                                },
                                                { scale: scaleAnim },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.sparkleText}>✨</Text>
                                </Animated.View>
                            ))}
                        </View>

                        {/* Progress indicator */}
                        <View style={styles.progressContainer}>
                            <Ionicons name="trending-up" size={24} color={COLORS.WHITE} />
                            <Text style={styles.progressText}>Keep up the great work!</Text>
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.9,
        maxWidth: 400,
        borderRadius: 25,
        overflow: 'hidden',
    },
    content: {
        padding: 40,
        alignItems: 'center',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        width: 35,
        height: 35,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 17.5,
    },
    levelUpText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        marginBottom: 25,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    levelContainer: {
        marginBottom: 20,
    },
    levelBadge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.BLACK,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    levelText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.GRAY,
        marginBottom: 5,
    },
    levelNumber: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.BLACK,
    },
    rankContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        marginBottom: 20,
    },
    rankText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    congratsText: {
        fontSize: 16,
        color: COLORS.WHITE,
        textAlign: 'center',
        marginBottom: 20,
        opacity: 0.9,
    },
    sparkleContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
    },
    sparkle: {
        position: 'absolute',
    },
    sparkleText: {
        fontSize: 16,
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 5,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    progressText: {
        fontSize: 14,
        color: COLORS.WHITE,
        marginLeft: 8,
        fontWeight: '600',
    },
});

export default LevelUpPopup; 