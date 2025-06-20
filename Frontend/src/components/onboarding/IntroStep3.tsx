import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface IntroStep3Props {
    onNext: () => void;
}

const IntroStep3: React.FC<IntroStep3Props> = ({ onNext }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background elements */}
            <LinearGradient
                colors={['#000000', '#0a0a0a', '#111111']}
                style={styles.backgroundGradient}
            />

            {/* Decorative background elements */}
            <View style={styles.circlesContainer}>
                <View style={[styles.circle, styles.circle1]} />
                <View style={[styles.circle, styles.circle2]} />
                <View style={[styles.circle, styles.circle3]} />
            </View>

            <View style={styles.contentWrapper}>
                {/* Main content - Removed logo as requested and moved image to top */}
                <View style={styles.mainContent}>
                    {/* Food image at the top */}
                    <View style={styles.topImageContainer}>
                        <Image
                            source={require('../../../assets/food.png')}
                            style={styles.topImage}
                            resizeMode="cover"
                        />
                        <View style={styles.imageOverlay} />
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={styles.welcomeText}>Your Journey Begins</Text>
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.divider}
                        />
                        <Text style={styles.descriptionText}>
                            Join thousands who've transformed their health with PlateMate's
                            AI-powered nutrition tracking and personalized insights.
                        </Text>
                    </View>

                    <View style={styles.featuresContainer}>
                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(0,116,221,0.2)", "rgba(0,116,221,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <Ionicons name="camera-outline" size={20} color="#0074dd" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Photo Food Recognition</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(92,0,221,0.2)", "rgba(92,0,221,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#5c00dd" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Health Analytics</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(221,0,149,0.2)", "rgba(221,0,149,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <Ionicons name="fitness-outline" size={20} color="#dd0095" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Fitness Integration</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom area with button */}
                <View style={styles.bottomContent}>
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={onNext}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>Get Started</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width,
        backgroundColor: '#000',
    },
    backgroundGradient: {
        position: 'absolute',
        width: width,
        height: height,
    },
    circlesContainer: {
        position: 'absolute',
        width: width,
        height: height,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        borderWidth: 1,
        borderStyle: 'solid',
    },
    circle1: {
        width: width * 1.3,
        height: width * 1.3,
        borderRadius: width * 0.65,
        borderColor: 'rgba(0,116,221,0.1)',
        top: -width * 0.8,
        left: -width * 0.15,
    },
    circle2: {
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        borderColor: 'rgba(92,0,221,0.08)',
        bottom: -width * 0.4,
        right: -width * 0.3,
    },
    circle3: {
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        borderColor: 'rgba(221,0,149,0.1)',
        top: height * 0.3,
        left: -width * 0.4,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'space-between',
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 30,
        paddingHorizontal: 30,
    },
    topImageContainer: {
        width: width * 0.85,
        height: width * 0.6,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 30,
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 15,
    },
    topImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    welcomeText: {
        fontSize: 34,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    divider: {
        height: 3,
        width: 60,
        borderRadius: 1.5,
        marginBottom: 15,
    },
    descriptionText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#ddd',
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    featuresContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        marginTop: 20,
    },
    featureItem: {
        alignItems: 'center',
        width: '30%',
    },
    featureIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    featureText: {
        fontSize: 13,
        color: '#fff',
        textAlign: 'center',
        fontWeight: '500',
    },
    bottomContent: {
        alignItems: 'center',
        marginBottom: 40,
    },
    startButton: {
        width: width * 0.8,
        height: 58,
        borderRadius: 29,
        overflow: 'hidden',
        shadowColor: "#dd0095",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 15,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    buttonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    buttonIcon: {
        marginLeft: 10,
    },
});

export default IntroStep3; 