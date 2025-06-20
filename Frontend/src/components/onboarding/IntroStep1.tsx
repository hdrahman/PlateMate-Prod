import React from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface IntroStep1Props {
    onNext: () => void;
}

const IntroStep1: React.FC<IntroStep1Props> = ({ onNext }) => {
    const insets = useSafeAreaInsets();

    // Render a corner with gradient for camera frame overlay
    const renderCorner = (position) => {
        return (
            <View style={[
                styles.corner,
                position === 'topLeft' && styles.topLeft,
                position === 'topRight' && styles.topRight,
                position === 'bottomRight' && styles.bottomRight,
                position === 'bottomLeft' && styles.bottomLeft,
            ]}>
                {/* Vertical part */}
                <View style={[
                    styles.cornerVertical,
                    position === 'topLeft' && styles.cornerVerticalTopLeft,
                    position === 'topRight' && styles.cornerVerticalTopRight,
                    position === 'bottomRight' && styles.cornerVerticalBottomRight,
                    position === 'bottomLeft' && styles.cornerVerticalBottomLeft,
                ]}>
                    <LinearGradient
                        colors={['#9B00FF', '#FF00F5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cornerGradient}
                    />
                </View>

                {/* Horizontal part */}
                <View style={[
                    styles.cornerHorizontal,
                    position === 'topLeft' && styles.cornerHorizontalTopLeft,
                    position === 'topRight' && styles.cornerHorizontalTopRight,
                    position === 'bottomRight' && styles.cornerHorizontalBottomRight,
                    position === 'bottomLeft' && styles.cornerHorizontalBottomLeft,
                ]}>
                    <LinearGradient
                        colors={['#9B00FF', '#FF00F5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cornerGradient}
                    />
                </View>
            </View>
        );
    };

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

                                {/* Camera frame overlay - inset from edges */}
                                <View style={styles.scanFrame}>
                                    {renderCorner('topLeft')}
                                    {renderCorner('topRight')}
                                    {renderCorner('bottomRight')}
                                    {renderCorner('bottomLeft')}
                                </View>
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
        width: width * 0.8,
        aspectRatio: 1,
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
    // Scanner frame styles - inset from edges
    scanFrame: {
        position: 'absolute',
        top: '10%',
        left: '10%',
        right: '10%',
        bottom: '10%',
        width: '80%',
        height: '80%',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
    },
    cornerVertical: {
        position: 'absolute',
        width: 3,
        height: 25,
    },
    cornerHorizontal: {
        position: 'absolute',
        height: 3,
        width: 25,
    },
    cornerVerticalTopLeft: {
        top: 0,
        left: 0,
    },
    cornerHorizontalTopLeft: {
        top: 0,
        left: 0,
    },
    cornerVerticalTopRight: {
        top: 0,
        right: 0,
    },
    cornerHorizontalTopRight: {
        top: 0,
        right: 0,
    },
    cornerVerticalBottomRight: {
        bottom: 0,
        right: 0,
    },
    cornerHorizontalBottomRight: {
        bottom: 0,
        right: 0,
    },
    cornerVerticalBottomLeft: {
        bottom: 0,
        left: 0,
    },
    cornerHorizontalBottomLeft: {
        bottom: 0,
        left: 0,
    },
    cornerGradient: {
        width: '100%',
        height: '100%',
    },
    topLeft: {
        top: 0,
        left: 0,
    },
    topRight: {
        top: 0,
        right: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
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
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 18,
        marginRight: 8,
    },
    buttonIcon: {
        marginLeft: 4,
    },
});

export default IntroStep1; 