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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface IntroStep1Props {
    onNext: () => void;
}

const IntroStep1: React.FC<IntroStep1Props> = ({ onNext }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
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
                        duration: 3000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanAnimation, {
                        toValue: 0,
                        duration: 3000,
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
        outputRange: [0, width * 0.65],
    });

    const handleSignIn = () => {
        (navigation as any).navigate('Auth', {
            returnTo: 'onboarding',
            skipIntroSteps: true
        });
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#0a0a1e', '#1a1a38']}
                style={styles.background}
            />

            {/* Sign In Button */}
            <TouchableOpacity
                style={[styles.signInButton, { top: insets.top + 5 }]}
                onPress={handleSignIn}
                activeOpacity={0.7}
            >
                <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>

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

                {/* Food Scanner with Floating Nutrition Tags */}
                <View style={styles.scannerSection}>
                    <View style={styles.scannerFrame}>
                        <LinearGradient
                            colors={['rgba(147,51,234,0.15)', 'rgba(168,85,247,0.1)', 'rgba(196,181,253,0.05)']}
                            style={styles.frameGradient}
                        >
                            <Image
                                source={require('../../../assets/food.png')}
                                style={styles.foodImage}
                                resizeMode="contain"
                            />

                            {/* Scanning overlay */}
                            <Animated.View
                                style={[
                                    styles.scanLine,
                                    { transform: [{ translateY: scanY }] }
                                ]}
                            >
                                <LinearGradient
                                    colors={['transparent', '#9333ea', 'transparent']}
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

                            {/* Floating Nutrition Tags */}
                            {/* Top Left - Calories */}
                            <View style={styles.nutritionTag1}>
                                <View style={styles.nutritionTagContent}>
                                    <MaterialCommunityIcons name="fire" size={10} color="#dd4400" />
                                    <Text style={styles.nutritionValue}>342</Text>
                                    <Text style={styles.nutritionLabel}>Cal</Text>
                                </View>
                            </View>

                            {/* Top Right - Protein */}
                            <View style={styles.nutritionTag2}>
                                <View style={styles.nutritionTagContent}>
                                    <MaterialCommunityIcons name="dumbbell" size={10} color="#00dd74" />
                                    <Text style={styles.nutritionValue}>28g</Text>
                                    <Text style={styles.nutritionLabel}>Protein</Text>
                                </View>
                            </View>

                            {/* Bottom Left - Fat */}
                            <View style={styles.nutritionTag3}>
                                <View style={styles.nutritionTagContent}>
                                    <MaterialCommunityIcons name="circle" size={10} color="#FFD700" />
                                    <Text style={styles.nutritionValue}>12g</Text>
                                    <Text style={styles.nutritionLabel}>Fat</Text>
                                </View>
                            </View>

                            {/* Bottom Right - Carbs */}
                            <View style={styles.nutritionTag4}>
                                <View style={styles.nutritionTagContent}>
                                    <MaterialCommunityIcons name="circle" size={10} color="#5c00dd" />
                                    <Text style={styles.nutritionValue}>45g</Text>
                                    <Text style={styles.nutritionLabel}>Carbs</Text>
                                </View>
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
                        ].map((feature, index) => (
                            <View key={index} style={styles.featureCard}>
                                <View style={[styles.featureIcon, {
                                    backgroundColor: index % 2 === 0 ? '#0074dd15' : '#dd009515'
                                }]}>
                                    <MaterialCommunityIcons
                                        name={feature.icon as any}
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
                                    <MaterialCommunityIcons name={stat.icon as any} size={12} color={stat.color} />
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
        paddingTop: 0,
        paddingBottom: 40,
        justifyContent: 'flex-start',
    },
    header: {
        alignItems: 'center',
        marginBottom: 15,
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
        marginHorizontal: 20,
        paddingVertical: 0,
        marginTop: 15,
    },
    scannerFrame: {
        width: width * 0.95,
        height: width * 0.65,
        borderRadius: 20,
        overflow: 'hidden',
    },
    frameGradient: {
        flex: 1,
        borderWidth: 2,
        borderColor: 'rgba(147,51,234,0.4)',
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
        borderColor: '#9333ea',
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
    // Floating Nutrition Tags
    nutritionTag1: {
        position: 'absolute',
        top: '10%',
        left: 30,
        zIndex: 5,
    },
    nutritionTag2: {
        position: 'absolute',
        top: '10%',
        right: 30,
        zIndex: 5,
    },
    nutritionTag3: {
        position: 'absolute',
        bottom: '10%',
        left: 30,
        zIndex: 5,
    },
    nutritionTag4: {
        position: 'absolute',
        bottom: '10%',
        right: 30,
        zIndex: 5,
    },
    nutritionTagContent: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(147,51,234,0.3)',
        alignItems: 'center',
        minWidth: 60,
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    nutritionValue: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
        marginBottom: 1,
    },
    nutritionLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 8,
        fontWeight: '500',
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(147,51,234,0.3)',
    },
    analysisText: {
        color: '#9333ea',
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 5,
    },
    featuresSection: {
        marginBottom: 30,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    featureCard: {
        width: '48%',
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
        marginBottom: 12,
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
        marginTop: 25,
    },
    button: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        marginHorizontal: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    signInButton: {
        position: 'absolute',
        top: 0,
        right: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        zIndex: 1000,
    },
    signInText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.8,
    },
});

export default IntroStep1; 