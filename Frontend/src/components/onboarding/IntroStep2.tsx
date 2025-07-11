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

interface IntroStep2Props {
    onNext: () => void;
}

const IntroStep2: React.FC<IntroStep2Props> = ({ onNext }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
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
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#0a0a18', '#1a1a32']}
                style={styles.background}
            />

            {/* Sign In Button */}
            <TouchableOpacity
                style={[styles.signInButton, { top: 0 }]}
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
        paddingTop: 0,
        paddingBottom: 40,
        justifyContent: 'flex-start',
        // Remove negative offset to reveal small tagline
        marginTop: 0,
    },
    header: {
        alignItems: 'center',
        marginBottom: 10,
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
    imageContainer: {
        height: height * 0.6,
        position: 'relative',
        marginHorizontal: -25,
        marginBottom: 50,
        borderRadius: 20,
        overflow: 'hidden',
    },
    fullScreenImage: {
        width: '100%',
        height: '115%',
        position: 'absolute',
        top: -35,
        left: 0,
        right: 0,
        bottom: -40,
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
        left: 8,
        top: 15,
        width: width * 0.24,
        zIndex: 10,
    },
    topRightStat: {
        position: 'absolute',
        right: 8,
        top: 45,
        width: width * 0.24,
        zIndex: 10,
    },
    bottomRightStat: {
        position: 'absolute',
        right: 8,
        bottom: 185,
        width: width * 0.24,
        zIndex: 10,
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 25,
        left: 25,
        right: 25,
        zIndex: 10,
    },
    subtitleContainer: {
        marginBottom: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 0,
        fontWeight: '500',
        marginBottom: 8,
    },
    statCard: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        marginBottom: 0,
        width: '100%',
        minHeight: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
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
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 3,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 8,
        fontWeight: '500',
        marginBottom: 4,
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
        backgroundColor: 'rgba(221,0,149,0.2)',
        color: '#dd0095',
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
        backgroundColor: '#00dd74',
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
    quickProgress: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
        color: '#5c00dd',
        fontSize: 10,
        fontWeight: '700',
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
        shadowColor: '#5c00dd',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
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

export default IntroStep2; 