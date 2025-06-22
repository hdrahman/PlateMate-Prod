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

interface IntroStep3Props {
    onNext: () => void;
}

const IntroStep3: React.FC<IntroStep3Props> = ({ onNext }) => {
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

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#0a0a1c', '#1a1a35']}
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

                {/* CTA */}
                <View style={styles.cta}>
                    <TouchableOpacity style={styles.button} onPress={onNext}>
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
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        height: height,
        backgroundColor: 'rgba(15,15,30,1)',
        paddingTop: 0,
        paddingBottom: 80,
        paddingHorizontal: 15,
    },
    background: {
        position: 'absolute',
        width: width,
        height: height,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        paddingTop: -50,
        paddingBottom: 80,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    tag: {
        fontSize: 9,
        fontWeight: '800',
        color: '#dd0095',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 2,
    },
    titleAccent: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0074dd',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 25,
        fontWeight: '500',
        marginBottom: 8,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 25,
    },
    dashboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    leftContent: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        width: width * 0.22,
        marginRight: 15,
    },
    rightContent: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: width * 0.22,
        marginLeft: 15,
    },
    statCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        marginBottom: 18,
        width: '100%',
        minHeight: 70,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    trendArrow: {
        backgroundColor: 'rgba(0,221,116,0.2)',
        padding: 2,
        borderRadius: 3,
    },
    statValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 9,
        fontWeight: '500',
        marginBottom: 6,
    },
    dashboardContainer: {
        width: width * 0.42,
        height: height * 0.41,
        marginBottom: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dashboardFrame: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        width: width * 0.42,
        height: height * 0.41,
    },
    dashboardImage: {
        width: width * 0.42,
        height: height * 0.41,
    },
    liveIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    liveDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#dd0095',
        marginRight: 4,
    },
    liveText: {
        color: '#dd0095',
        fontSize: 8,
        fontWeight: '700',
    },
    bottomContent: {
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    quickProgress: {
        backgroundColor: 'rgba(0,116,221,0.08)',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 15,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressTitle: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 5,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressGradient: {
        flex: 1,
        borderRadius: 2,
    },
    progressValue: {
        color: '#0074dd',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    cta: {
        alignItems: 'center',
    },
    button: {
        marginBottom: 12,
        shadowColor: '#dd0095',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        minWidth: width * 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginHorizontal: 8,
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    activeDot: {
        backgroundColor: '#dd0095',
    },
    inactiveDot: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    miniProgressBar: {
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 1,
        marginTop: 4,
        overflow: 'hidden',
    },
    miniProgress: {
        height: '100%',
        backgroundColor: '#0074dd',
        borderRadius: 1,
    },
    changeIndicator: {
        color: '#00dd74',
        fontSize: 8,
        fontWeight: '600',
        backgroundColor: 'rgba(0,221,116,0.15)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    percentageBadge: {
        backgroundColor: 'rgba(0,221,116,0.2)',
        color: '#00dd74',
        fontSize: 8,
        fontWeight: '600',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    sparklineContainer: {
        height: 12,
        marginTop: 4,
    },
    sparkline: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: '100%',
        gap: 1,
    },
    sparkBar: {
        flex: 1,
        backgroundColor: '#dd4400',
        borderRadius: 1,
        opacity: 0.7,
    },
    macroBar: {
        flexDirection: 'row',
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginTop: 4,
        overflow: 'hidden',
    },
    macroSegment: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 0.5,
    },
    streakDots: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    streakDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});

export default IntroStep3; 