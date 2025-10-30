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

interface IntroStep3Props {
    onNext: () => void;
}

const IntroStep3: React.FC<IntroStep3Props> = ({ onNext }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions(); // Use hook for dynamic calculations
    const isSmallScreen = height < 700; // Calculate inside component
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

    const chartWidth = progressWidth.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '78%'],
    });

    const handleBeginJourney = () => {
        onNext();
    };

    const handleSignIn = () => {
        (navigation as any).navigate('Auth', {
            returnTo: 'onboarding',
            skipIntroSteps: true
        });
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#0a0a1c', '#1a1a35']}
                style={styles.background}
            />

            {/* Sign In Button */}
            <TouchableOpacity
                style={[styles.signInButton, { top: spacing(2) }]}
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
                        paddingTop: Platform.OS === 'ios' ? 0 : Math.max(insets.top, spacing(10)),
                        paddingBottom: scale(70)
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
                        <Text style={styles.tag}>SMART ANALYTICS</Text>
                        <Text style={styles.title}>Your Health</Text>
                        <Text style={styles.titleAccent}>Intelligence Hub</Text>
                    </View>

                    {/* Central Dashboard - Hero Section */}
                    <View style={styles.heroSection}>
                        <View style={styles.dashboardRow}>
                            {/* Left Side Content */}
                            <View style={styles.leftContent}>
                                <View style={styles.statCard}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="chart-line" size={18} color="#0074dd" />
                                        <View style={styles.trendArrow}>
                                            <MaterialCommunityIcons name="trending-up" size={12} color="#00dd74" />
                                        </View>
                                    </View>
                                    <Text style={styles.statValue}>78%</Text>
                                    <Text style={styles.statLabel}>Weekly Goal</Text>
                                    <View style={styles.miniProgressBar}>
                                        <View style={[styles.miniProgress, { width: '78%' }]} />
                                    </View>
                                </View>
                                <View style={styles.statCard}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="fire" size={18} color="#dd4400" />
                                        <Text style={styles.changeIndicator}>+247</Text>
                                    </View>
                                    <Text style={styles.statValue}>2,847</Text>
                                    <Text style={styles.statLabel}>Calories Today</Text>
                                    <View style={styles.sparklineContainer}>
                                        <View style={styles.sparkline}>
                                            {[0.3, 0.7, 0.4, 0.9, 0.6, 0.8, 1.0].map((height, index) => (
                                                <View
                                                    key={index}
                                                    style={[styles.sparkBar, { height: height * 15 + 3 }]}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Central Dashboard */}
                            <View style={styles.dashboardContainer}>
                                <LinearGradient
                                    colors={['rgba(15,15,30,0.95)', 'rgba(25,25,45,0.9)']}
                                    style={styles.dashboardFrame}
                                >
                                    <Image
                                        source={require('../../../assets/home.png')}
                                        style={styles.dashboardImage}
                                        resizeMode="contain"
                                    />
                                    <View style={styles.liveIndicator}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveText}>LIVE</Text>
                                    </View>
                                </LinearGradient>
                            </View>

                            {/* Right Side Content */}
                            <View style={styles.rightContent}>
                                <View style={styles.statCard}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="trending-up" size={18} color="#00dd74" />
                                        <Text style={styles.percentageBadge}>+23%</Text>
                                    </View>
                                    <Text style={styles.statValue}>127g</Text>
                                    <Text style={styles.statLabel}>Protein</Text>
                                    <View style={styles.macroBar}>
                                        <View style={styles.macroSegment} />
                                        <View style={[styles.macroSegment, { backgroundColor: '#00dd74' }]} />
                                        <View style={styles.macroSegment} />
                                    </View>
                                </View>
                                <View style={styles.statCard}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="trophy" size={18} color="#dd0095" />
                                        <MaterialCommunityIcons name="fire-circle" size={14} color="#ffaa00" />
                                    </View>
                                    <Text style={styles.statValue}>42</Text>
                                    <Text style={styles.statLabel}>Day Streak</Text>
                                    <View style={styles.streakDots}>
                                        {[1, 1, 1, 1, 1, 0, 1].map((active, index) => (
                                            <View
                                                key={index}
                                                style={[styles.streakDot, active ? styles.activeDot : styles.inactiveDot]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Subtitle positioned below dashboard */}
                        <Text style={styles.subtitle}>
                            AI-powered insights transform your data into actionable health guidance.
                        </Text>
                    </View>

                    {/* Bottom Content - Progress & Insights */}
                    <View style={styles.bottomContent}>
                        {/* Quick Progress Indicator */}
                        <View style={styles.quickProgress}>
                            <View style={styles.progressHeader}>
                                <MaterialCommunityIcons name="chart-line" size={14} color="#0074dd" />
                                <Text style={styles.progressTitle}>Weekly Progress</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <Animated.View style={[styles.progressFill, { width: chartWidth }]}>
                                    <LinearGradient
                                        colors={['#0074dd', '#5c00dd', '#dd0095']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.progressGradient}
                                    />
                                </Animated.View>
                            </View>
                            <Text style={styles.progressValue}>78% Goal Achievement</Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>

            {/* Fixed Button at Bottom */}
            <View style={[styles.fixedButtonContainer, { bottom: Math.max(insets.bottom, spacing(3)) + spacing(25) }]}>
                <TouchableOpacity style={styles.button} onPress={handleBeginJourney}>
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <MaterialCommunityIcons name="rocket-launch" size={18} color="#fff" />
                        <Text style={styles.buttonText}>Begin Your Journey</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
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
        backgroundColor: 'rgba(15,15,30,1)',
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
        paddingHorizontal: spacing(7),
    },
    content: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing(1.5),
        marginTop: 0,
    },
    tag: {
        fontSize: fontSize('xs'),
        fontWeight: '800',
        color: '#dd0095',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: spacing(1),
    },
    title: {
        fontSize: fontSize('2xl'),
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: spacing(0.5),
    },
    titleAccent: {
        fontSize: fontSize('2xl'),
        fontWeight: '900',
        color: '#0074dd',
        textAlign: 'center',
        marginBottom: spacing(1),
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: fontSize('md'),
        textAlign: 'center',
        lineHeight: scale(18),
        paddingHorizontal: spacing(6),
        fontWeight: '500',
        marginBottom: spacing(1),
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: spacing(1.5),
    },
    dashboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing(5),
        marginBottom: spacing(4),
    },
    leftContent: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        width: wp(22),
        marginRight: spacing(4),
    },
    rightContent: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: wp(22),
        marginLeft: spacing(4),
    },
    statCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: spacing(3),
        borderRadius: borderRadius('md'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.15)',
        marginBottom: spacing(4),
        width: '100%',
        minHeight: scale(70),
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
        fontSize: fontSize('md'),
        fontWeight: '700',
        marginBottom: spacing(1),
    },
    statLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: fontSize('xs'),
        fontWeight: '500',
        marginBottom: spacing(1.5),
    },
    dashboardContainer: {
        width: wp(42),
        height: hp(41),
        marginBottom: spacing(4),
        justifyContent: 'center',
        alignItems: 'center',
    },
    dashboardFrame: {
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        width: wp(42),
        height: hp(41),
    },
    dashboardImage: {
        width: wp(42),
        height: hp(41),
    },
    liveIndicator: {
        position: 'absolute',
        top: spacing(2),
        right: spacing(2),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: spacing(1.5),
        paddingVertical: spacing(0.5),
        borderRadius: borderRadius('md'),
    },
    liveDot: {
        width: size(4),
        height: size(4),
        borderRadius: size(2),
        backgroundColor: '#dd0095',
        marginRight: spacing(1),
    },
    liveText: {
        color: '#dd0095',
        fontSize: fontSize('xs'),
        fontWeight: '700',
    },
    bottomContent: {
        marginBottom: spacing(2),
        paddingHorizontal: spacing(5),
    },
    quickProgress: {
        backgroundColor: 'rgba(0,116,221,0.08)',
        padding: spacing(3),
        borderRadius: borderRadius('lg'),
        borderWidth: scale(1),
        borderColor: 'rgba(255,255,255,0.08)',
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
        color: '#0074dd',
        fontSize: fontSize('xs'),
        fontWeight: '700',
        textAlign: 'center',
    },
    fixedButtonContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: spacing(7),
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
        shadowColor: '#dd0095',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.25,
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
    activeDot: {
        backgroundColor: '#dd0095',
    },
    inactiveDot: {
        backgroundColor: 'rgba(255,255,255,0.2)',
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
        backgroundColor: 'rgba(0,221,116,0.2)',
        color: '#00dd74',
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
        backgroundColor: '#dd4400',
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
    streakDots: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing(1),
    },
    streakDot: {
        width: size(6),
        height: size(6),
        borderRadius: size(3),
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

export default IntroStep3; 