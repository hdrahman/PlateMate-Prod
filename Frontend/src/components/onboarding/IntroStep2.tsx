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
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
        letterSpacing: 1.5,
        opacity: 0.7,
        textTransform: 'uppercase',
        marginBottom: 5,
        marginTop: 40,
    },
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 0,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    titleText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    titleAccent: {
        fontSize: 32,
        fontWeight: '700',
        color: '#5c00dd',
        textAlign: 'center',
        marginBottom: 8,
    },
    titleUnderline: {
        height: 3,
        width: 60,
        borderRadius: 4,
    },
    imageCardContainer: {
        width: width * 0.9,
        alignSelf: 'center',
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 15,
    },
    cardBorder: {
        borderRadius: 18,
        padding: 2.5,
        width: '100%',
    },
    cardInnerContainer: {
        backgroundColor: 'rgba(15, 15, 15, 0.95)',
        borderRadius: 16,
        overflow: 'hidden',
    },
    imageSection: {
        width: '100%',
        height: height * 0.35,
        position: 'relative',
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    featuresSection: {
        padding: 20,
    },
    featuresTitle: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 15,
    },
    featuresList: {
        paddingHorizontal: 5,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    featureIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(15, 15, 15, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#eee',
        fontWeight: '500',
        flex: 1,
    },
    bottomArea: {
        alignItems: 'center',
        paddingBottom: 0,
    },
    nextButton: {
        width: width * 0.5,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        marginBottom: 20,
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
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    buttonIcon: {
        marginLeft: 8,
    },
});

export default IntroStep2; 