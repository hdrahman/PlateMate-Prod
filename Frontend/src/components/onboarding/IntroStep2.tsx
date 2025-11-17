import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
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

interface IntroStep2Props {
    onNext: () => void;
}

const IntroStep2: React.FC<IntroStep2Props> = ({ onNext }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isSmallScreen = height < 700;
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(20)).current;
    const progressWidth = useRef(new Animated.Value(0)).current;

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
            Animated.timing(progressWidth, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: false,
            }).start();
        }, 600);
    }, []);

    const progressInterpolated = progressWidth.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '85%'],
    });

    const handleSignIn = () => {
        (navigation as any).navigate('Auth', {
            returnTo: 'onboarding',
            skipIntroSteps: true
        });
    };

    return (
        <View style={[styles.container, { width, height }]}>
            <StatusBar backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#0a0a18', '#1a1a32']}
                style={styles.background}
            />

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: Math.max(insets.top, spacing(3)),
                        paddingBottom: spacing(35)
                    }
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
            >
                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeIn, transform: [{ translateY: slideUp }] }
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.tag}>FITNESS TRANSFORMATION</Text>
                        <Text style={styles.title}>
                            <Text style={styles.titleAccent}>Achieve</Text> Your Dream
                        </Text>
                        <Text style={styles.title}>Physique</Text>
                    </View>

                    {/* Image Container with Overlays */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={require('../../../assets/AthleticMale.png')}
                            style={styles.fullScreenImage}
                            resizeMode="cover"
                        />

                        {/* Dark overlay for better text readability */}
                        <View style={styles.imageOverlay} />

                        {/* Bottom gradient mask */}
                        <View style={styles.bottomGradientMask}>
                            <LinearGradient
                                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
                                locations={[0, 0.3, 0.7, 1]}
                                style={styles.gradientOverlay}
                            />
                        </View>

                        {/* Dynamic Stats Positioning */}
                        {/* Top Left - Fitness Goal */}
                        <View style={styles.topLeftStat}>
                            <View style={styles.statCard}>
                                <View style={styles.statHeader}>
                                    <MaterialCommunityIcons name="dumbbell" size={18} color="#0074dd" />
                                    <View style={styles.trendArrow}>
                                        <MaterialCommunityIcons name="trending-up" size={12} color="#00dd74" />
                                    </View>
                                </View>
                                <Text style={styles.statValue}>85%</Text>
                                <Text style={styles.statLabel}>Fitness Goal</Text>
                                <View style={styles.miniProgressBar}>
                                    <View style={[styles.miniProgress, { width: '85%' }]} />
                                </View>
                            </View>
                        </View>

                        {/* Top Right - Muscle Mass */}
                        <View style={styles.topRightStat}>
                            <View style={styles.statCard}>
                                <View style={styles.statHeader}>
                                    <MaterialCommunityIcons name="dumbbell" size={18} color="#dd0095" />
                                    <Text style={styles.percentageBadge}>+8 lbs</Text>
                                </View>
                                <Text style={styles.statValue}>152g</Text>
                                <Text style={styles.statLabel}>Muscle Mass</Text>
                                <View style={styles.macroBar}>
                                    <View style={styles.macroSegment} />
                                    <View style={[styles.macroSegment, { backgroundColor: '#dd0095' }]} />
                                    <View style={styles.macroSegment} />
                                </View>
                            </View>
                        </View>

                        {/* Bottom Right - Current Weight */}
                        <View style={styles.bottomRightStat}>
                            <View style={styles.statCard}>
                                <View style={styles.statHeader}>
                                    <MaterialCommunityIcons name="weight" size={18} color="#00dd74" />
                                    <Text style={styles.changeIndicator}>-15 lbs</Text>
                                </View>
                                <Text style={styles.statValue}>178</Text>
                                <Text style={styles.statLabel}>Current Weight</Text>
                                <View style={styles.sparklineContainer}>
                                    <View style={styles.sparkline}>
                                        {[1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4].map((height, index) => (
                                            <View
                                                key={index}
                                                style={[styles.sparkBar, { height: height * 15 + 3 }]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Bottom Progress Overlay */}
                        <View style={styles.bottomOverlay}>
                            <View style={styles.subtitleContainer}>
                                <Text style={styles.subtitle}>
                                    Track workouts, build muscle, and achieve your dream physique with personalized guidance.
                                </Text>
                            </View>

                            <View style={styles.quickProgress}>
                                <View style={styles.progressHeader}>
                                    <MaterialCommunityIcons name="chart-line" size={14} color="#5c00dd" />
                                    <Text style={styles.progressTitle}>Transformation Progress</Text>
                                </View>
                                <View style={styles.progressBar}>
                                    <Animated.View style={[styles.progressFill, { width: progressInterpolated }]}>
                                        <LinearGradient
                                            colors={['#0074dd', '#5c00dd', '#dd0095']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.progressGradient}
                                        />
                                    </Animated.View>
                                </View>
                                <Text style={styles.progressValue}>85% Fitness Achievement</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>

            {/* Sign In Button */}
            <TouchableOpacity
                style={[styles.signInButton, {
                    top: Math.max(insets.top, spacing(2)),
                    right: spacing(2)
                }]}
                onPress={handleSignIn}
                activeOpacity={0.7}
            >
                <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>

            {/* Fixed Button at Bottom */}
            <View
                style={[styles.fixedButtonContainer, {
                    bottom: Math.max(insets.bottom + spacing(4), spacing(4))
                }]}
                collapsable={false}
                pointerEvents="box-none"
            >
                <TouchableOpacity style={styles.button} onPress={onNext}>
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <MaterialCommunityIcons name="dumbbell" size={18} color="#fff" />
                        <Text style={styles.buttonText}>Transform Now</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing(6),
    },
    content: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing(0.5),
        marginTop: 0,
    },
    tag: {
        fontSize: fontSize('xs'),
        fontWeight: '800',
        color: '#0074dd',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: spacing(1.5),
    },
    title: {
        fontSize: fontSize('3xl'),
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        lineHeight: scale(30),
    },
    titleAccent: {
        color: '#dd0095',
    },
    imageContainer: {
        height: hp(58),
        position: 'relative',
        marginHorizontal: -spacing(6),
        marginBottom: spacing(2),
        borderRadius: borderRadius('lg'),
        overflow: 'hidden',
    },
    fullScreenImage: {
        width: '100%',
        height: '115%',
        position: 'absolute',
        top: scale(-35),
        left: 0,
        right: 0,
        bottom: scale(-40),
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    bottomGradientMask: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        zIndex: 5,
    },
    gradientOverlay: {
        width: '100%',
        height: '100%',
    },
    topLeftStat: {
        position: 'absolute',
        left: spacing(2),
        top: spacing(4),
        width: wp(24),
        zIndex: 10,
    },
    topRightStat: {
        position: 'absolute',
        right: spacing(2),
        top: spacing(11),
        width: wp(24),
        zIndex: 10,
    },
    bottomRightStat: {
        position: 'absolute',
        right: spacing(2),
        bottom: hp(23), // Responsive percentage instead of hardcoded 185px
        width: wp(24),
        zIndex: 10,
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: spacing(6),
        left: spacing(6),
        right: spacing(6),
        zIndex: 10,
    },
    subtitleContainer: {
        marginBottom: spacing(4),
        paddingHorizontal: spacing(5),
        alignItems: 'center',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: fontSize('md'),
        textAlign: 'center',
        lineHeight: scale(18),
        paddingHorizontal: 0,
        fontWeight: '500',
        marginBottom: spacing(2),
    },
    statCard: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: spacing(2),
        borderRadius: borderRadius('md'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.15)',
        marginBottom: 0,
        width: '100%',
        minHeight: scale(55),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(1) },
        shadowOpacity: 0.1,
        shadowRadius: scale(1),
        elevation: 1,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing(1.5),
    },
    trendArrow: {
        backgroundColor: 'rgba(0,221,116,0.2)',
        padding: spacing(0.5),
        borderRadius: borderRadius('sm'),
    },
    statValue: {
        color: '#fff',
        fontSize: fontSize('sm'),
        fontWeight: '700',
        marginBottom: spacing(0.75),
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: fontSize('xs'),
        fontWeight: '500',
        marginBottom: spacing(1),
    },
    miniProgressBar: {
        height: scale(2),
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: borderRadius('sm'),
        marginTop: spacing(1),
        overflow: 'hidden',
    },
    miniProgress: {
        height: '100%',
        backgroundColor: '#0074dd',
        borderRadius: borderRadius('sm'),
    },
    changeIndicator: {
        color: '#00dd74',
        fontSize: fontSize('xs'),
        fontWeight: '600',
        backgroundColor: 'rgba(0,221,116,0.15)',
        paddingHorizontal: spacing(1),
        paddingVertical: spacing(0.25),
        borderRadius: borderRadius('sm'),
    },
    percentageBadge: {
        backgroundColor: 'rgba(221,0,149,0.2)',
        color: '#dd0095',
        fontSize: fontSize('xs'),
        fontWeight: '600',
        paddingHorizontal: spacing(1),
        paddingVertical: spacing(0.25),
        borderRadius: borderRadius('sm'),
    },
    sparklineContainer: {
        height: scale(12),
        marginTop: spacing(1),
    },
    sparkline: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: '100%',
        gap: scale(1),
    },
    sparkBar: {
        flex: 1,
        backgroundColor: '#00dd74',
        borderRadius: borderRadius('sm'),
        opacity: 0.7,
    },
    macroBar: {
        flexDirection: 'row',
        height: scale(3),
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: borderRadius('sm'),
        marginTop: spacing(1),
        overflow: 'hidden',
    },
    macroSegment: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: scale(0.5),
    },
    quickProgress: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: spacing(3),
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.2)',
        marginBottom: spacing(4),
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing(2),
    },
    progressTitle: {
        color: '#fff',
        fontSize: fontSize('sm'),
        fontWeight: '600',
        marginLeft: spacing(1),
    },
    progressBar: {
        height: scale(4),
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: borderRadius('sm'),
        marginBottom: spacing(2),
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: borderRadius('sm'),
    },
    progressGradient: {
        flex: 1,
        borderRadius: borderRadius('sm'),
    },
    progressValue: {
        color: '#5c00dd',
        fontSize: fontSize('xs'),
        fontWeight: '700',
        textAlign: 'center',
    },
    fixedButtonContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: spacing(6),
        zIndex: 100,
        // Add a gradient background to prevent black bar issues on Android
        backgroundColor: 'transparent',
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
        shadowColor: '#5c00dd',
        shadowOffset: { width: 0, height: scale(6) },
        shadowOpacity: 0.3,
        shadowRadius: scale(12),
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

export default IntroStep2; 