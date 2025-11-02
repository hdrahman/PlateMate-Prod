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
    ScrollView,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, spacing, fontSize, wp, hp, size, borderRadius } from '../../utils/responsive';

// Module-level dimensions for StyleSheet (styles are created once at module load)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IntroStep1Props {
    onNext: () => void;
}

const IntroStep1: React.FC<IntroStep1Props> = ({ onNext }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions(); // Use hook for dynamic calculations
    const isSmallScreen = height < 700; // Calculate inside component
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
        outputRange: [0, wp(95) * 0.65], // Scale proportionally with scanner frame height
    });

    const handleSignIn = () => {
        (navigation as any).navigate('Auth', {
            returnTo: 'onboarding',
            skipIntroSteps: true
        });
    };

    return (
        <View style={styles.container}>
            {/* Make status bar transparent so background shows instead of black overlay */}
            <StatusBar backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#0a0a1e', '#1a1a38']}
                style={styles.background}
            />

            {/* Sign In Button */}
            <TouchableOpacity
                style={[styles.signInButton, {
                    top: Platform.OS === 'ios' ? insets.top + spacing(-50) : spacing(2)
                }]}
                onPress={handleSignIn}
                activeOpacity={0.7}
            >
                <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: Platform.OS === 'ios' ? insets.top + spacing(-700) : Math.max(insets.top, spacing(10)),
                        paddingBottom: Platform.OS === 'ios' ? spacing(15) : spacing(16)
                    }
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
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
                </Animated.View>
            </ScrollView>

            {/* Fixed Button at Bottom */}
            <View style={[styles.fixedButtonContainer, {
                bottom: Platform.OS === 'ios'
                    ? Math.max(insets.bottom + spacing(35), spacing(4))
                    : spacing(30)
            }]}>
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing(5),
    },
    content: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing(1),
        marginTop: 0,
    },
    tag: {
        fontSize: fontSize('xs'),
        fontWeight: '800',
        color: '#dd0095',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: spacing(1.5),
    },
    title: {
        fontSize: fontSize('3xl'),
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: spacing(0.5),
    },
    titleAccent: {
        fontSize: fontSize('3xl'),
        fontWeight: '900',
        color: '#0074dd',
        textAlign: 'center',
        marginBottom: spacing(1.5),
    },
    subtitle: {
        fontSize: fontSize('md'),
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: scale(20),
        paddingHorizontal: spacing(5),
    },
    scannerSection: {
        alignItems: 'center',
        marginBottom: spacing(2),
        marginHorizontal: spacing(5),
        paddingVertical: 0,
        marginTop: 0,
    },
    scannerFrame: {
        width: wp(95),
        height: wp(95) * 0.65,
        borderRadius: borderRadius('lg'),
        overflow: 'hidden',
    },
    frameGradient: {
        flex: 1,
        borderWidth: scale(2),
        borderColor: 'rgba(147,51,234,0.4)',
        borderRadius: borderRadius('lg'),
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
        height: scale(2),
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
        width: size(20),
        height: size(20),
        borderColor: '#9333ea',
        borderWidth: scale(2),
    },
    topLeft: {
        top: spacing(2),
        left: spacing(2),
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderTopLeftRadius: borderRadius('md'),
    },
    topRight: {
        top: spacing(2),
        right: spacing(2),
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderTopRightRadius: borderRadius('md'),
    },
    bottomLeft: {
        bottom: spacing(2),
        left: spacing(2),
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomLeftRadius: borderRadius('md'),
    },
    bottomRight: {
        bottom: spacing(2),
        right: spacing(2),
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomRightRadius: borderRadius('md'),
    },
    // Floating Nutrition Tags
    nutritionTag1: {
        position: 'absolute',
        top: '10%',
        left: spacing(7),
        zIndex: 5,
    },
    nutritionTag2: {
        position: 'absolute',
        top: '10%',
        right: spacing(7),
        zIndex: 5,
    },
    nutritionTag3: {
        position: 'absolute',
        bottom: '10%',
        left: spacing(7),
        zIndex: 5,
    },
    nutritionTag4: {
        position: 'absolute',
        bottom: '10%',
        right: spacing(7),
        zIndex: 5,
    },
    nutritionTagContent: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing(2),
        paddingVertical: spacing(2),
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(147,51,234,0.3)',
        alignItems: 'center',
        minWidth: scale(60),
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: scale(3) },
        shadowOpacity: 0.4,
        shadowRadius: scale(6),
        elevation: 6,
    },
    nutritionValue: {
        color: '#fff',
        fontSize: fontSize('sm'),
        fontWeight: '700',
        marginTop: spacing(0.5),
        marginBottom: spacing(0.25),
    },
    nutritionLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: fontSize('xs'),
        fontWeight: '500',
    },
    analysisOverlay: {
        position: 'absolute',
        bottom: spacing(3),
        left: spacing(3),
        right: spacing(3),
        alignItems: 'center',
        zIndex: 3,
    },
    analysisLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing(2),
        paddingVertical: spacing(1),
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(147,51,234,0.3)',
    },
    analysisText: {
        color: '#9333ea',
        fontSize: fontSize('sm'),
        fontWeight: '600',
        marginLeft: spacing(1),
    },
    featuresSection: {
        marginBottom: spacing(2),
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: spacing(3),
    },
    featureCard: {
        width: '48%',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: spacing(3),
        paddingHorizontal: spacing(2),
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.08)',
    },
    featureIcon: {
        width: size(28),
        height: size(28),
        borderRadius: size(14),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing(1.5),
    },
    featureTitle: {
        color: '#fff',
        fontSize: fontSize('xs'),
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: spacing(0.5),
    },
    featureSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: fontSize('xs'),
        fontWeight: '500',
        textAlign: 'center',
    },
    statsSection: {
        marginBottom: spacing(1),
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
        width: size(24),
        height: size(24),
        borderRadius: size(12),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing(1.5),
    },
    statValue: {
        color: '#fff',
        fontSize: fontSize('sm'),
        fontWeight: '700',
        marginBottom: spacing(0.5),
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: fontSize('xs'),
        fontWeight: '500',
        textAlign: 'center',
    },
    fixedButtonContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: spacing(5),
        zIndex: 100,
    },
    cta: {
        alignItems: 'center',
        marginTop: spacing(6),
    },
    button: {
        width: '100%',
        height: scale(56),
        borderRadius: scale(28),
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing(5),
        gap: spacing(2),
    },
    buttonText: {
        color: '#fff',
        fontSize: fontSize('lg'),
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    signInButton: {
        position: 'absolute',
        top: 0,
        right: spacing(1),
        paddingHorizontal: spacing(2),
        paddingVertical: spacing(1),
        borderRadius: borderRadius('lg'),
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: scale(1),
        borderColor: 'rgba(255, 255, 255, 0.2)',
        zIndex: 1000,
    },
    signInText: {
        color: '#fff',
        fontSize: fontSize('sm'),
        fontWeight: '500',
        opacity: 0.8,
    },
});

export default IntroStep1; 