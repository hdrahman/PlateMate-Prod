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

interface IntroStep2Props {
    onNext: () => void;
}

const IntroStep2: React.FC<IntroStep2Props> = ({ onNext }) => {
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

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#0a0a18', '#1a1a32']}
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
                    <Text style={styles.tag}>FITNESS TRANSFORMATION</Text>
                    <Text style={styles.title}>
                        <Text style={styles.titleAccent}>Achieve</Text> Your Dream
                    </Text>
                    <Text style={styles.title}>Physique</Text>
                </View>

                {/* Athlete Section */}
                <View style={styles.athleteSection}>
                    <View style={styles.athleteContainer}>
                        <LinearGradient
                            colors={['rgba(0,116,221,0.15)', 'rgba(92,0,221,0.1)', 'rgba(221,0,149,0.05)']}
                            style={styles.athleteFrame}
                        >
                            <Image
                                source={require('../../../assets/AthleticMale.png')}
                                style={styles.athleteImage}
                                resizeMode="cover"
                            />

                            {/* Achievement badges */}
                            <View style={styles.badge1}>
                                <View style={styles.badgeContent}>
                                    <MaterialCommunityIcons name="medal" size={10} color="#FFD700" />
                                    <Text style={styles.badgeText}>First Mile</Text>
                                </View>
                            </View>

                            <View style={styles.badge2}>
                                <View style={styles.badgeContent}>
                                    <MaterialCommunityIcons name="food" size={10} color="#0074dd" />
                                    <Text style={styles.badgeText}>Protein Goal</Text>
                                </View>
                            </View>

                            <View style={styles.badge3}>
                                <View style={styles.badgeContent}>
                                    <MaterialCommunityIcons name="trophy" size={10} color="#dd0095" />
                                    <Text style={styles.badgeText}>Week Streak</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                </View>

                {/* Progress Panel */}
                <View style={styles.progressSection}>
                    <View style={styles.progressPanel}>
                        <View style={styles.progressHeader}>
                            <MaterialCommunityIcons name="chart-line" size={16} color="#0074dd" />
                            <Text style={styles.progressTitle}>Your Progress</Text>
                        </View>

                        <View style={styles.mainProgress}>
                            <Text style={styles.progressLabel}>Fitness Goal</Text>
                            <View style={styles.progressBarContainer}>
                                <Animated.View style={[styles.progressBar, { width: progressInterpolated }]}>
                                    <LinearGradient
                                        colors={['#0074dd', '#5c00dd', '#dd0095']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.progressFill}
                                    />
                                </Animated.View>
                            </View>
                            <Text style={styles.progressValue}>85%</Text>
                        </View>

                        <View style={styles.metricsGrid}>
                            {[
                                { label: 'Calories', value: '2,847', color: '#0074dd' },
                                { label: 'Weight Lost', value: '15 lbs', color: '#5c00dd' },
                                { label: 'Muscle', value: '8 lbs', color: '#dd0095' },
                                { label: 'Streak', value: '42', color: '#00dd74' },
                            ].map((metric, index) => (
                                <View key={index} style={styles.metricCard}>
                                    <View style={[styles.metricIcon, { backgroundColor: metric.color + '15' }]}>
                                        <View style={[styles.iconDot, { backgroundColor: metric.color }]} />
                                    </View>
                                    <Text style={styles.metricValue}>{metric.value}</Text>
                                    <Text style={styles.metricLabel}>{metric.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.featuresSection}>
                    <View style={styles.featuresRow}>
                        {[
                            { title: 'Smart Goal', subtitle: 'Setting' },
                            { title: 'Achievement', subtitle: 'System' },
                            { title: 'Progress', subtitle: 'Tracking' }
                        ].map((feature, index) => (
                            <View key={index} style={styles.featureCard}>
                                <View style={styles.featureIcon}>
                                    <View style={[styles.iconDot, {
                                        backgroundColor: index === 0 ? '#0074dd' : index === 1 ? '#5c00dd' : '#dd0095'
                                    }]} />
                                </View>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
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
                            <MaterialCommunityIcons name="dumbbell" size={18} color="#fff" />
                            <Text style={styles.buttonText}>Transform Now</Text>
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
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        width: width,
        height: height,
    },
    content: {
        flex: 1,
        paddingHorizontal: 25,
        paddingTop: 20,
        paddingBottom: 80,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    tag: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0074dd',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 30,
    },
    titleAccent: {
        color: '#dd0095',
    },
    athleteSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    athleteContainer: {
        position: 'relative',
        width: 170,
        height: 240,
        alignSelf: 'center',
    },
    athleteFrame: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    athleteImage: {
        width: '100%',
        height: '100%',
    },
    badge1: {
        position: 'absolute',
        top: -8,
        right: -20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    badge2: {
        position: 'absolute',
        bottom: 90,
        left: -25,
        borderRadius: 12,
        overflow: 'hidden',
    },
    badge3: {
        position: 'absolute',
        top: 130,
        right: -22,
        borderRadius: 12,
        overflow: 'hidden',
    },
    badgeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    badgeText: {
        color: '#fff',
        fontSize: 7,
        fontWeight: '600',
        marginLeft: 3,
    },
    progressSection: {
        marginBottom: 15,
    },
    progressPanel: {
        backgroundColor: 'rgba(15,15,28,0.95)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    progressTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    mainProgress: {
        marginBottom: 16,
    },
    progressLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 8,
    },
    progressBarContainer: {
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2.5,
        marginBottom: 8,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2.5,
    },
    progressFill: {
        flex: 1,
        borderRadius: 2.5,
    },
    progressValue: {
        color: '#0074dd',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    metricCard: {
        width: '47%',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    metricIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
    },
    iconDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    metricValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    metricLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 8,
        textAlign: 'center',
        fontWeight: '500',
    },
    featuresSection: {
        marginBottom: 15,
    },
    featuresRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
    },
    featureCard: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 3,
    },
    featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,116,221,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    featureTitle: {
        color: '#fff',
        fontSize: 11,
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
    cta: {
        alignItems: 'center',
    },
    button: {
        shadowColor: '#5c00dd',
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

export default IntroStep2; 