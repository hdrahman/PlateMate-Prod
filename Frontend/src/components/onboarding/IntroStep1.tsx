import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface IntroStep1Props {
    onNext: () => void;
}

const IntroStep1: React.FC<IntroStep1Props> = ({ onNext }) => {
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(20)).current;
    const scanAnimation = useRef(new Animated.Value(0)).current;
    const particleOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideUp, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();

        setTimeout(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanAnimation, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanAnimation, {
                        toValue: 0,
                        duration: 100,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(particleOpacity, {
                        toValue: 0.8,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(particleOpacity, {
                        toValue: 0.2,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }, 600);
    }, []);

    const scanY = scanAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 150],
    });

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#0a0a1e', '#1a1a38']}
                style={styles.background}
            />

            <Animated.View
                style={[
                    styles.content,
                    { opacity: fadeIn, transform: [{ translateY: slideUp }] }
                ]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.tag}>SMART FOOD RECOGNITION</Text>
                    <Text style={styles.title}>Instant AI-Powered</Text>
                    <Text style={styles.titleAccent}>Nutrition Analysis</Text>
                    <Text style={styles.subtitle}>
                        Simply snap a photo and get complete nutritional insights in seconds.
                    </Text>
                </View>

                {/* Food Scanner */}
                <View style={styles.scannerSection}>
                    <View style={styles.scannerFrame}>
                        <LinearGradient
                            colors={['rgba(0,116,221,0.15)', 'rgba(92,0,221,0.1)', 'rgba(221,0,149,0.05)']}
                            style={styles.frameGradient}
                        >
                            <Image
                                source={require('../../../assets/food.png')}
                                style={styles.foodImage}
                                resizeMode="cover"
                            />

                            {/* Scanning overlay */}
                            <Animated.View
                                style={[
                                    styles.scanLine,
                                    { transform: [{ translateY: scanY }] }
                                ]}
                            >
                                <LinearGradient
                                    colors={['transparent', '#0074dd', 'transparent']}
                                    style={styles.scanGradient}
                                />
                            </Animated.View>

                            {/* Corner indicators */}
                            <View style={styles.corners}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>

                            {/* Analysis overlay */}
                            <View style={styles.analysisOverlay}>
                                <Animated.View
                                    style={[styles.analysisLabel, { opacity: particleOpacity }]}
                                >
                                    <MaterialCommunityIcons name="brain" size={12} color="#0074dd" />
                                    <Text style={styles.analysisText}>AI Analyzing...</Text>
                                </Animated.View>
                            </View>
                        </LinearGradient>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.featuresSection}>
                    <View style={styles.featuresGrid}>
                        {[
                            { icon: 'food-apple', title: 'Instant Nutrition', subtitle: 'Facts' },
                            { icon: 'camera', title: 'Smart Photo', subtitle: 'Recognition' },
                            { icon: 'flash', title: 'Real-time', subtitle: 'Analysis' },
                            { icon: 'star', title: 'AI-Powered', subtitle: 'Accuracy' },
                        ].map((feature, index) => (
                            <View key={index} style={styles.featureCard}>
                                <View style={[styles.featureIcon, {
                                    backgroundColor: index % 2 === 0 ? '#0074dd15' : '#dd009515'
                                }]}>
                                    <MaterialCommunityIcons
                                        name={feature.icon}
                                        size={14}
                                        color={index % 2 === 0 ? '#0074dd' : '#dd0095'}
                                    />
                                </View>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsSection}>
                    <View style={styles.statsRow}>
                        {[
                            { value: '99.2%', label: 'Accuracy', color: '#0074dd', icon: 'target' },
                            { value: '<3s', label: 'Analysis', color: '#dd0095', icon: 'speedometer' },
                            { value: '10K+', label: 'Foods', color: '#5c00dd', icon: 'database' },
                        ].map((stat, index) => (
                            <View key={index} style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                                    <MaterialCommunityIcons name={stat.icon} size={12} color={stat.color} />
                                </View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* CTA */}
                <View style={styles.cta}>
                    <TouchableOpacity style={styles.button} onPress={onNext}>
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                            <Text style={styles.buttonText}>Start Scanning</Text>
                            <Ionicons name="arrow-forward" size={14} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        height: height,
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        width: width,
        height: height,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 100,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    tag: {
        fontSize: 10,
        fontWeight: '800',
        color: '#dd0095',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
    },
    titleAccent: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0074dd',
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    scannerSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    scannerFrame: {
        width: width * 0.65,
        height: width * 0.65,
        borderRadius: 20,
        overflow: 'hidden',
    },
    frameGradient: {
        flex: 1,
        borderWidth: 2,
        borderColor: 'rgba(0,116,221,0.3)',
        borderRadius: 18,
        position: 'relative',
        overflow: 'hidden',
    },
    foodImage: {
        width: '100%',
        height: '100%',
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        zIndex: 2,
    },
    scanGradient: {
        flex: 1,
    },
    corners: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: '#0074dd',
        borderWidth: 2,
    },
    topLeft: {
        top: 10,
        left: 10,
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderTopLeftRadius: 8,
    },
    topRight: {
        top: 10,
        right: 10,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderTopRightRadius: 8,
    },
    bottomLeft: {
        bottom: 10,
        left: 10,
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomLeftRadius: 8,
    },
    bottomRight: {
        bottom: 10,
        right: 10,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomRightRadius: 8,
    },
    analysisOverlay: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        alignItems: 'center',
        zIndex: 3,
    },
    analysisLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,116,221,0.3)',
    },
    analysisText: {
        color: '#0074dd',
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 5,
    },
    featuresSection: {
        marginBottom: 25,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    featureCard: {
        width: '47%',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    featureIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    featureTitle: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 2,
    },
    featureSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 8,
        fontWeight: '500',
        textAlign: 'center',
    },
    statsSection: {
        marginBottom: 25,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statCard: {
        alignItems: 'center',
        flex: 1,
    },
    statIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    statValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 9,
        fontWeight: '500',
        textAlign: 'center',
    },
    cta: {
        alignItems: 'center',
    },
    button: {
        shadowColor: '#dd0095',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 26,
        minWidth: width * 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginHorizontal: 10,
    },
});

export default IntroStep1; 