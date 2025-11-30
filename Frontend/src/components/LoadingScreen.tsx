import React, { useEffect, useRef, useContext } from 'react';
import { View, Text, Image, Animated, Dimensions } from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from "@react-native-masked-view/masked-view";
import { Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

// Calculate responsive dimensions based on screen size
const getResponsiveDimensions = () => {
    const logoSize = Math.min(120, width * 0.28); // Adjust logo size based on screen width
    const logoRadius = logoSize * 0.2;
    const textWidth = Math.min(250, width * 0.7);
    const textHeight = Math.min(45, height * 0.05);
    const spinnerSize = Math.min(40, width * 0.1);

    return {
        logoSize,
        logoRadius,
        textWidth,
        textHeight,
        spinnerSize
    };
};

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = "Loading PlateMate..." }: LoadingScreenProps) {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    const { logoSize, logoRadius, textWidth, textHeight, spinnerSize } = getResponsiveDimensions();

    useEffect(() => {
        // Fade in and scale animation for logo
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 80,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous rotation for loading indicator
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <LinearGradient
            colors={isDarkTheme ? ['#000000', '#1a1a1a', '#000000'] : [theme.colors.background, theme.colors.background, theme.colors.background]}
            style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.colors.background,
            }}
        >
            <Animated.View
                style={{
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {/* Logo */}
                <View
                    style={{
                        marginBottom: height * 0.05,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: "#FF00F5",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.6,
                        shadowRadius: 20,
                        elevation: 10,
                    }}
                >
                    <Image
                        source={require('../../assets/icon2-edited.png')}
                        style={{
                            width: logoSize,
                            height: logoSize,
                            borderRadius: logoRadius,
                        }}
                    />
                </View>

                {/* App Name with Gradient */}
                <View
                    style={{
                        marginBottom: height * 0.06,
                        shadowColor: "#FF00F5",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 15,
                        elevation: 8,
                        alignItems: 'center',
                    }}
                >
                    <MaskedView
                        style={{
                            alignItems: "center",
                            justifyContent: "center",
                            width: textWidth,
                        }}
                        maskElement={
                            <Text
                                style={{
                                    fontSize: Math.min(32, width * 0.08),
                                    fontWeight: "700",
                                    letterSpacing: 2,
                                    textTransform: "uppercase",
                                    color: "white",
                                    textAlign: 'center',
                                }}
                            >
                                PlateMate
                            </Text>
                        }
                    >
                        <LinearGradient
                            colors={["#5A60EA", "#FF00F5", "#5A60EA"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                width: textWidth,
                                height: textHeight,
                            }}
                        />
                    </MaskedView>
                </View>

                {/* Loading Indicator */}
                <Animated.View
                    style={{
                        transform: [{ rotate: spin }],
                        marginBottom: height * 0.03,
                    }}
                >
                    <View
                        style={{
                            width: spinnerSize,
                            height: spinnerSize,
                            borderRadius: spinnerSize / 2,
                            borderWidth: 3,
                            borderColor: 'transparent',
                            borderTopColor: '#FF00F5',
                            borderRightColor: '#5A60EA',
                        }}
                    />
                </Animated.View>

                {/* Loading Message */}
                <Text
                    style={{
                        color: theme.colors.textSecondary,
                        fontSize: Math.min(16, width * 0.04),
                        textAlign: 'center',
                        letterSpacing: 1,
                        fontWeight: '400',
                    }}
                >
                    {message}
                </Text>
            </Animated.View>
        </LinearGradient>
    );
} 