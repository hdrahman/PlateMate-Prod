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

interface IntroStep1Props {
    onNext: () => void;
}

const IntroStep1: React.FC<IntroStep1Props> = ({ onNext }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background gradient with animated overlay */}
            <LinearGradient
                colors={['#000000', '#0f0f0f', '#121212']}
                style={styles.backgroundGradient}
            />

            <View style={styles.decorationCircle1} />
            <View style={styles.decorationCircle2} />

            <View style={styles.contentWrapper} pointerEvents="box-none">
                {/* App logo at the top */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoWrapper}>
                        <Image
                            source={require('../../../assets/icon2.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.logoText}>PlateMate</Text>
                </View>

                {/* Main content area */}
                <View style={styles.mainContent}>
                    <View style={styles.imageOuterContainer}>
                        <LinearGradient
                            colors={['rgba(0,116,221,0.8)', 'rgba(92,0,221,0.8)', 'rgba(221,0,149,0.8)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.imageBorder}
                        >
                            <View style={styles.imageContainer}>
                                <Image
                                    source={require('../../../assets/food.png')}
                                    style={styles.image}
                                    resizeMode="cover"
                                />
                                <View style={styles.imageOverlay} />
                            </View>
                        </LinearGradient>
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={styles.titleText}>Discover Food</Text>
                        <Text style={styles.titleAccent}>with AI Precision</Text>
                        <Text style={styles.descriptionText}>
                            Take a photo of any meal and instantly get accurate nutrition information. PlateMate's advanced AI detects, analyzes and tracks everything for you.
                        </Text>
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
    decorationCircle1: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        backgroundColor: 'rgba(92,0,221,0.06)',
        top: -width * 0.6,
        left: -width * 0.2,
    },
    decorationCircle2: {
        position: 'absolute',
        width: width * 1.4,
        height: width * 1.4,
        borderRadius: width * 0.7,
        backgroundColor: 'rgba(0,116,221,0.08)',
        bottom: -width * 0.8,
        right: -width * 0.4,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: 30,
        paddingBottom: 40,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 10,
    },
    logoWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        padding: 2,
        backgroundColor: '#000',
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    logoImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginLeft: 8,
        letterSpacing: 0.5,
    },
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    imageOuterContainer: {
        width: width * 0.85,
        aspectRatio: 1.2,
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 15,
    },
    imageBorder: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        padding: 3,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#000',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)', // subtle darkening
    },
    textContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 20,
    },
    titleText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 0.5,
        marginBottom: 5,
    },
    titleAccent: {
        fontSize: 26,
        fontWeight: '600',
        marginBottom: 16,
        // Gradient text implementation
        backgroundColor: 'transparent',
        textAlign: 'center',
        color: '#5c00dd',
        textShadowColor: 'rgba(92,0,221,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    descriptionText: {
        fontSize: 16,
        color: '#ddd',
        textAlign: 'center',
        lineHeight: 24,
        letterSpacing: 0.3,
    },
    bottomArea: {
        alignItems: 'center',
        marginTop: 30,
    },
    nextButton: {
        width: width * 0.7,
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        marginBottom: 30,
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

export default IntroStep1; 