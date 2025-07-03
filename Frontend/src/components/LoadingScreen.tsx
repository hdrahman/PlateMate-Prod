import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from "@react-native-masked-view/masked-view";
import { Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = "Loading PlateMate..." }: LoadingScreenProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

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
            colors={['#000000', '#1a1a1a', '#000000']}
            style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
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
                        marginBottom: 40,
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
                        source={require('../../assets/icon2 - Edited.png')}
                        style={{
                            width: 120,
                            height: 120,
                            borderRadius: 25,
                        }}
                    />
                </View>

                {/* App Name with Gradient */}
                <View
                    style={{
                        marginBottom: 50,
                        shadowColor: "#FF00F5",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 15,
                        elevation: 8,
                    }}
                >
                    <MaskedView
                        style={{ alignItems: "center", justifyContent: "center" }}
                        maskElement={
                            <Text
                                style={{
                                    fontSize: 32,
                                    fontWeight: "700",
                                    letterSpacing: 2,
                                    textTransform: "uppercase",
                                    color: "white",
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
                                width: 250,
                                height: 45,
                            }}
                        />
                    </MaskedView>
                </View>

                {/* Loading Indicator */}
                <Animated.View
                    style={{
                        transform: [{ rotate: spin }],
                        marginBottom: 30,
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
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
                        color: '#888',
                        fontSize: 16,
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