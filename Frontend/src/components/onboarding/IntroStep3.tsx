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
                    <Text style={styles.subtitle}>
                        AI-powered insights transform your data into actionable health guidance.
                    </Text>
                </View>

                {/* Dashboard */}
                <View style={styles.dashboardSection}>
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

                {/* Progress */}
                <View style={styles.progressSection}>
                    <View style={styles.progressCard}>
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

                    <View style={styles.statsRow}>
                        {[
                            { day: 'M', value: 85, color: '#0074dd' },
                            { day: 'T', value: 92, color: '#5c00dd' },
                            { day: 'W', value: 78, color: '#dd0095' }
                        ].map((stat, index) => (
                            <View key={index} style={styles.stat}>
                                <Text style={styles.statDay}>{stat.day}</Text>
                                <View style={[styles.statBar, { backgroundColor: stat.color + '20' }]}>
                                    <View
                                        style={[
                                            styles.statFill,
                                            { height: `${stat.value}%`, backgroundColor: stat.color }
                                        ]}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* AI Insights */}
                <View style={styles.insightsSection}>
                    <View style={styles.insightsHeader}>
                        <MaterialCommunityIcons name="brain" size={16} color="#dd0095" />
                        <Text style={styles.insightsTitle}>AI Insights</Text>
                    </View>
                    <View style={styles.insightsList}>
                        {[
                            { icon: 'trending-up', text: 'Protein intake improved 23%', color: '#00dd74' },
                            { icon: 'flame', text: 'Burned 2,847 calories this week', color: '#dd4400' },
                        ].map((insight, index) => (
                            <View key={index} style={styles.insight}>
                                <View style={[styles.insightIcon, { backgroundColor: insight.color + '15' }]}>
                                    <Ionicons name={insight.icon} size={12} color={insight.color} />
                                </View>
                                <Text style={styles.insightText}>{insight.text}</Text>
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
                            <MaterialCommunityIcons name="rocket-launch" size={16} color="#fff" />
                            <Text style={styles.buttonText}>Begin Your Journey</Text>
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
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 100,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        flex: 0.2,
        justifyContent: 'center',
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
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 10,
    },
    dashboardSection: {
        width: width * 0.8,
        height: height * 0.18,
        alignSelf: 'center',
        flex: 0.25,
        justifyContent: 'center',
    },
    dashboardFrame: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        padding: 4,
    },
    dashboardImage: {
        width: '100%',
        height: '100%',
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
    progressSection: {
        flex: 0.25,
        justifyContent: 'center',
    },
    progressCard: {
        backgroundColor: 'rgba(0,116,221,0.08)',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 12,
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
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    stat: {
        alignItems: 'center',
    },
    statDay: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 9,
        fontWeight: '600',
        marginBottom: 6,
    },
    statBar: {
        width: 12,
        height: 30,
        borderRadius: 6,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statFill: {
        width: '100%',
        borderRadius: 4,
    },
    insightsSection: {
        flex: 0.18,
        justifyContent: 'center',
    },
    insightsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    insightsTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 5,
    },
    insightsList: {
        gap: 8,
    },
    insight: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    insightIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    insightText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 10,
        fontWeight: '500',
        flex: 1,
    },
    cta: {
        alignItems: 'center',
        flex: 0.12,
        justifyContent: 'flex-end',
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
        width: 18,
        borderRadius: 9,
    },
});

export default IntroStep3; 