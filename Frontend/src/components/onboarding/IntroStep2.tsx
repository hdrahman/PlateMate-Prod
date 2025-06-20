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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface IntroStep2Props {
    onNext: () => void;
}

const IntroStep2: React.FC<IntroStep2Props> = ({ onNext }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background elements */}
            <LinearGradient
                colors={['#000000', '#0c0c0c', '#101010']}
                style={styles.backgroundGradient}
            />

            <View style={styles.decorationSquare1} />
            <View style={styles.decorationSquare2} />

            <View style={styles.contentWrapper} pointerEvents="box-none">
                {/* Header with subtitle */}
                <View style={styles.headerContainer}>
                    <Text style={styles.subtitleText}>FITNESS TRACKING</Text>
                </View>

                {/* Main content area */}
                <View style={styles.mainContent}>
                    <View style={styles.textContainer}>
                        <Text style={styles.titleText}>Achieve Your</Text>
                        <Text style={styles.titleAccent}>Fitness Goals</Text>
                        <LinearGradient
                            colors={['rgba(92,0,221,0.8)', 'rgba(221,0,149,0.5)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.titleUnderline}
                        />
                    </View>

                    {/* Combined image and features in one larger card */}
                    <View style={styles.imageCardContainer}>
                        <LinearGradient
                            colors={['rgba(92,0,221,0.8)', 'rgba(0,116,221,0.8)', 'rgba(0,116,221,0.5)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.cardBorder}
                        >
                            <View style={styles.cardInnerContainer}>
                                {/* Image section */}
                                <View style={styles.imageSection}>
                                    <View style={styles.imageWrapper}>
                                        <Image
                                            source={require('../../../assets/AthleticMale.png')}
                                            style={styles.image}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        style={styles.imageOverlay}
                                    />
                                </View>

                                {/* Features section at the bottom */}
                                <View style={styles.featuresSection}>
                                    <Text style={styles.featuresTitle}>Key Features</Text>

                                    <View style={styles.featuresList}>
                                        <View style={styles.featureRow}>
                                            <View style={styles.featureIconBg}>
                                                <Ionicons name="barbell-outline" size={14} color="#5c00dd" />
                                            </View>
                                            <Text style={styles.featureText}>Personalized workout plans</Text>
                                        </View>

                                        <View style={styles.featureRow}>
                                            <View style={styles.featureIconBg}>
                                                <Ionicons name="trending-up-outline" size={14} color="#0074dd" />
                                            </View>
                                            <Text style={styles.featureText}>Track progress & achievements</Text>
                                        </View>

                                        <View style={styles.featureRow}>
                                            <View style={styles.featureIconBg}>
                                                <Ionicons name="sync-outline" size={14} color="#dd0095" />
                                            </View>
                                            <Text style={styles.featureText}>Sync with nutrition data</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                </View>

                {/* Bottom navigation area */}
                <View style={styles.bottomArea}>
                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={onNext}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>Next</Text>
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
        overflow: 'hidden',
    },
    backgroundGradient: {
        position: 'absolute',
        width: width,
        height: height,
    },
    decorationSquare1: {
        position: 'absolute',
        width: width * 0.7,
        height: width * 0.7,
        transform: [{ rotate: '45deg' }],
        backgroundColor: 'rgba(0,116,221,0.04)',
        top: -width * 0.35,
        left: -width * 0.15,
    },
    decorationSquare2: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        transform: [{ rotate: '30deg' }],
        backgroundColor: 'rgba(221,0,149,0.05)',
        bottom: -width * 0.3,
        right: -width * 0.3,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: 0,
        paddingBottom: 25,
    },
    headerContainer: {
        alignItems: 'center',
        marginTop: 5,
        marginBottom: 0,
    },
    subtitleText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8a5cff',
        letterSpacing: 2,
    },
    mainContent: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 0,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    titleText: {
        fontSize: 36,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    titleAccent: {
        fontSize: 40,
        fontWeight: '800',
        marginBottom: 8,
        color: '#fff',
        textAlign: 'center',
    },
    titleUnderline: {
        height: 4,
        width: 120,
        borderRadius: 2,
    },
    // New styles for the combined card
    imageCardContainer: {
        width: width * 0.9,
        height: width * 1.25,
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 12,
        },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
        marginTop: 0,
    },
    cardBorder: {
        width: '100%',
        height: '100%',
        borderRadius: 25,
        padding: 3,
        overflow: 'hidden',
    },
    cardInnerContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    imageSection: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '130%',
        marginTop: 0,
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
    },
    featuresSection: {
        backgroundColor: 'rgba(18, 18, 18, 0.95)',
        padding: 16,
    },
    featuresTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    featuresList: {
        marginTop: 5,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    featureText: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
    },
    bottomArea: {
        alignItems: 'center',
        marginTop: 20,
    },
    nextButton: {
        width: width * 0.7,
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        marginBottom: 10,
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
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
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    buttonIcon: {
        marginLeft: 8,
    },
});

export default IntroStep2; 