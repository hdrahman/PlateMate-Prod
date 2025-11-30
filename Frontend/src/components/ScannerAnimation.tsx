import React, { useRef, useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, Image } from 'react-native';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { ThemeContext } from '../ThemeContext';

const { width, height } = Dimensions.get('window');

interface ScannerAnimationProps {
    message?: string;
    stage: 'uploading' | 'analyzing' | 'processing';
    imageUri?: string;
    progress?: number;
    onComplete?: () => void;
}

// Animation JSON for the scanner - this is a simplified version that can be embedded
// You can replace this with a more complex animation downloaded from LottieFiles
const scannerAnimation = {
    "v": "5.7.11",
    "fr": 30,
    "ip": 0,
    "op": 60,
    "w": 300,
    "h": 300,
    "nm": "Scanner",
    "ddd": 0,
    "assets": [],
    "layers": [
        {
            "ddd": 0,
            "ind": 1,
            "ty": 4,
            "nm": "Scanner Line",
            "sr": 1,
            "ks": {
                "o": { "a": 0, "k": 100 },
                "p": {
                    "a": 1,
                    "k": [
                        { "t": 0, "s": [150, 50], "e": [150, 250], "i": { "x": 0.5, "y": 0.5 }, "o": { "x": 0.5, "y": 0.5 } },
                        { "t": 30, "s": [150, 250], "e": [150, 50], "i": { "x": 0.5, "y": 0.5 }, "o": { "x": 0.5, "y": 0.5 } },
                        { "t": 60 }
                    ]
                },
                "a": { "a": 0, "k": [0, 0, 0] },
                "s": { "a": 0, "k": [100, 100, 100] }
            },
            "ao": 0,
            "shapes": [
                {
                    "ty": "gr",
                    "it": [
                        {
                            "ty": "rc",
                            "d": 1,
                            "s": { "a": 0, "k": [260, 3] },
                            "p": { "a": 0, "k": [0, 0] },
                            "r": { "a": 0, "k": 0 }
                        },
                        {
                            "ty": "fl",
                            "c": { "a": 0, "k": [0.996, 0, 0.965, 1] },
                            "o": { "a": 0, "k": 100 }
                        },
                        {
                            "ty": "tr",
                            "p": { "a": 0, "k": [0, 0] },
                            "a": { "a": 0, "k": [0, 0] },
                            "s": { "a": 0, "k": [100, 100] },
                            "r": { "a": 0, "k": 0 },
                            "o": { "a": 0, "k": 100 }
                        }
                    ],
                    "nm": "Line"
                }
            ]
        },
        {
            "ddd": 0,
            "ind": 2,
            "ty": 4,
            "nm": "Scanner Box",
            "sr": 1,
            "ks": {
                "o": { "a": 0, "k": 100 },
                "p": { "a": 0, "k": [150, 150] },
                "a": { "a": 0, "k": [0, 0, 0] },
                "s": {
                    "a": 1,
                    "k": [
                        { "t": 0, "s": [100, 100, 100], "e": [105, 105, 100], "i": { "x": 0.5, "y": 0.5 }, "o": { "x": 0.5, "y": 0.5 } },
                        { "t": 30, "s": [105, 105, 100], "e": [100, 100, 100], "i": { "x": 0.5, "y": 0.5 }, "o": { "x": 0.5, "y": 0.5 } },
                        { "t": 60 }
                    ]
                }
            },
            "ao": 0,
            "shapes": [
                {
                    "ty": "gr",
                    "it": [
                        {
                            "ty": "rc",
                            "d": 1,
                            "s": { "a": 0, "k": [260, 260] },
                            "p": { "a": 0, "k": [0, 0] },
                            "r": { "a": 0, "k": 20 }
                        },
                        {
                            "ty": "st",
                            "c": { "a": 0, "k": [0.607, 0, 1, 1] },
                            "o": { "a": 0, "k": 100 },
                            "w": { "a": 0, "k": 4 }
                        },
                        {
                            "ty": "tr",
                            "p": { "a": 0, "k": [0, 0] },
                            "a": { "a": 0, "k": [0, 0] },
                            "s": { "a": 0, "k": [100, 100] },
                            "r": { "a": 0, "k": 0 },
                            "o": { "a": 0, "k": 100 }
                        }
                    ],
                    "nm": "Box"
                }
            ]
        }
    ]
};

// Constants for animation
const BOX_SIZE = Math.min(width * 0.85, 340); // Make box larger but cap at 340px
const GRID_LINES = 10; // Increased number of grid lines
const RIPPLE_DELAY = 150; // Delay between ripple animations
const ANIMATION_DURATION = 3000; // Longer animation for more fluid effect

// Stage timing configurations (in milliseconds)
const stageTiming = {
    uploading: 5000,    // Image processing & upload: ~5 seconds
    analyzing: 10000,   // OpenAI analysis: ~10 seconds
    processing: 5000    // Data processing & DB operations: ~5 seconds
};

// Stage progress ranges (0-1)
const stageProgressRanges = {
    uploading: [0, 0.3],      // 0% to 30% 
    analyzing: [0.3, 0.9],    // 30% to 90%
    processing: [0.9, 1.0]    // 90% to 100%
};

// Dynamic comments for each stage
const stageComments = {
    uploading: [
        "Preparing image data...",
        "Optimizing for analysis...",
        "Initiating upload sequence...",
        "Establishing secure connection...",
        "Compressing image data..."
    ],
    analyzing: [
        "Identifying food items...",
        "Analyzing color patterns...",
        "Detecting ingredients...",
        "Measuring portion sizes...",
        "Running nutritional model...",
        "Extracting visual features..."
    ],
    processing: [
        "Calculating macronutrients...",
        "Estimating caloric content...",
        "Mapping nutritional profile...",
        "Generating dietary insights...",
        "Finalizing analysis results..."
    ]
};

const ScannerAnimation: React.FC<ScannerAnimationProps> = ({
    message = 'Analyzing your food...',
    stage = 'analyzing',
    imageUri,
    progress,
    onComplete
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    // Animation references
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scannerGlowAnim = useRef(new Animated.Value(0)).current;
    const gridLineAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const lottieRef = useRef<LottieView>(null);

    // Create multiple animation values for grid lines to create ripple effect
    const horizontalGridAnims = useRef(
        Array(GRID_LINES).fill(0).map(() => new Animated.Value(0))
    ).current;

    const verticalGridAnims = useRef(
        Array(GRID_LINES).fill(0).map(() => new Animated.Value(0))
    ).current;

    // State for dynamic comments
    const [commentIndex, setCommentIndex] = useState(0);
    const comments = stageComments[stage];

    // Messages for different stages
    const stageMessages = {
        uploading: 'Uploading your image...',
        analyzing: 'Analyzing your food...',
        processing: 'Processing nutritional data...'
    };

    // Function to get current progress based on stage
    const getCurrentProgress = () => {
        // If external progress is provided, use it
        if (progress !== undefined) {
            return progress;
        }

        // Otherwise use stage-based default timing
        const [min, max] = stageProgressRanges[stage];
        return min; // Start at minimum progress for this stage
    };

    // Run the animations
    useEffect(() => {
        // Reset progress when stage changes
        progressAnim.setValue(getCurrentProgress());

        // Scanner line animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                    easing: Easing.linear
                }),
                Animated.timing(scanLineAnim, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true
                })
            ])
        ).start();

        // Pulse animation for outer ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                    easing: Easing.ease
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                    easing: Easing.ease
                })
            ])
        ).start();

        // Scanner box glow animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(scannerGlowAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.cubic)
                }),
                Animated.timing(scannerGlowAnim, {
                    toValue: 0.3,
                    duration: 1500,
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.cubic)
                })
            ])
        ).start();

        // Create ripple effect for grid lines
        const createRippleAnimation = (index: number, isHorizontal: boolean) => {
            const gridAnim = isHorizontal ? horizontalGridAnims[index] : verticalGridAnims[index];

            // Randomize starting time for each line to create more chaos
            const randomDelay = Math.random() * 1000;

            // Ripple outward with delay based on position
            const positionDelay = index * RIPPLE_DELAY;

            // Combined delay
            const totalDelay = randomDelay + positionDelay;

            return Animated.sequence([
                Animated.delay(totalDelay),
                Animated.timing(gridAnim, {
                    toValue: 1,
                    duration: ANIMATION_DURATION * (0.5 + Math.random() * 0.5), // Random duration
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.cubic)
                }),
                Animated.timing(gridAnim, {
                    toValue: 0.2,
                    duration: ANIMATION_DURATION * (0.5 + Math.random() * 0.5),
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.cubic)
                })
            ]);
        };

        // Start grid animations
        const startGridAnimations = () => {
            // Create animations for horizontal lines
            const horizontalAnimations = horizontalGridAnims.map((_, index) =>
                createRippleAnimation(index, true)
            );

            // Create animations for vertical lines
            const verticalAnimations = verticalGridAnims.map((_, index) =>
                createRippleAnimation(index, false)
            );

            // Combine all animations and loop
            const allGridAnimations = [...horizontalAnimations, ...verticalAnimations];

            Animated.loop(
                Animated.parallel(allGridAnimations)
            ).start();
        };

        startGridAnimations();

        // Grid animation - subtle pulsing
        Animated.loop(
            Animated.sequence([
                Animated.timing(gridLineAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.quad)
                }),
                Animated.timing(gridLineAnim, {
                    toValue: 0.3,
                    duration: 1500,
                    useNativeDriver: false,
                    easing: Easing.inOut(Easing.quad)
                })
            ])
        ).start();

        // Progress bar animation based on current stage
        const [startProgress, endProgress] = stageProgressRanges[stage];
        const duration = stageTiming[stage];

        // Animate to the end of this stage's progress range
        Animated.timing(progressAnim, {
            toValue: endProgress,
            duration: duration,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.quad)
        }).start(({ finished }) => {
            if (finished && onComplete) {
                onComplete();
            }
        });

        // Play Lottie animation
        if (lottieRef.current) {
            lottieRef.current.play();
        }

        // Cycle through comments
        const commentInterval = setInterval(() => {
            setCommentIndex(prevIndex => (prevIndex + 1) % comments.length);
        }, 3000); // Change comment every 3 seconds

        return () => {
            clearInterval(commentInterval);
        };
    }, [stage, comments, progress]); // Re-run when stage or progress changes

    // Update progress when external progress prop changes
    useEffect(() => {
        if (progress !== undefined) {
            progressAnim.setValue(progress);
        }
    }, [progress]);

    // Generate dynamic grid styles
    const getGridLineStyle = (index: number, isHorizontal: boolean) => {
        const animValue = isHorizontal
            ? horizontalGridAnims[index]
            : verticalGridAnims[index];

        return {
            opacity: animValue,
            shadowColor: '#9B00FF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: animValue,
            shadowRadius: 3,
            elevation: 5
        };
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Main scanner view */}
            <Animated.View style={styles.scannerContainer}>
                <Animated.View
                    style={[
                        styles.scannerOutline,
                        {
                            backgroundColor: isDarkTheme ? 'rgba(10, 10, 15, 0.7)' : 'rgba(255, 255, 255, 0.85)',
                            shadowOpacity: scannerGlowAnim,
                            borderColor: scannerGlowAnim.interpolate({
                                inputRange: [0.3, 1],
                                outputRange: ['#9B00FF', '#FF00F5']
                            })
                        }
                    ]}
                >
                    {/* Image background */}
                    {imageUri && (
                        <Image source={{ uri: imageUri }} style={styles.backgroundImage} />
                    )}

                    {/* Grid overlay with ripple effect */}
                    <View style={styles.gridOverlay}>
                        {/* Horizontal grid lines */}
                        {horizontalGridAnims.map((_, i) => (
                            <Animated.View
                                key={`h-${i}`}
                                style={[
                                    styles.gridLine,
                                    styles.horizontalLine,
                                    { top: (i + 1) * (BOX_SIZE / (GRID_LINES + 1)) },
                                    getGridLineStyle(i, true)
                                ]}
                            />
                        ))}

                        {/* Vertical grid lines */}
                        {verticalGridAnims.map((_, i) => (
                            <Animated.View
                                key={`v-${i}`}
                                style={[
                                    styles.gridLine,
                                    styles.verticalLine,
                                    { left: (i + 1) * (BOX_SIZE / (GRID_LINES + 1)) },
                                    getGridLineStyle(i, false)
                                ]}
                            />
                        ))}
                    </View>

                    {/* Lottie animation in the center */}
                    <View style={styles.lottieContainer}>
                        <LottieView
                            ref={lottieRef}
                            source={scannerAnimation}
                            autoPlay
                            loop
                            style={[styles.lottieAnimation, { width: BOX_SIZE, height: BOX_SIZE }]}
                        />
                    </View>

                    {/* Animated scan line with enhanced gradient */}
                    <Animated.View
                        style={[
                            styles.scanLine,
                            {
                                transform: [
                                    {
                                        translateY: scanLineAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, BOX_SIZE - 20]
                                        })
                                    }
                                ]
                            }
                        ]}
                    >
                        <LinearGradient
                            colors={['transparent', '#FF00F5', '#00CFFF', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.scanLineGradient}
                        />
                    </Animated.View>
                </Animated.View>

                {/* Enhanced pulse rings around the scanner */}
                <Animated.View
                    style={[
                        styles.pulseRing,
                        {
                            width: 280,
                            height: 280,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: '#9B00FF',
                            transform: [{ scale: pulseAnim }],
                            opacity: pulseAnim.interpolate({
                                inputRange: [1, 1.2],
                                outputRange: [0.3, 0]
                            })
                        }
                    ]}
                />
            </Animated.View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBackground, { backgroundColor: isDarkTheme ? 'rgba(50, 50, 50, 0.5)' : 'rgba(200, 200, 200, 0.5)' }]}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%']
                                })
                            }
                        ]}
                    />
                </View>
            </View>

            {/* Dynamic analysis comment */}
            <View style={styles.commentContainer}>
                <Animated.Text style={styles.commentText}>
                    {comments[commentIndex]}
                </Animated.Text>
            </View>

            {/* Stage message with gradient text */}
            <View style={styles.messageContainer}>
                <MaskedView
                    maskElement={
                        <Text style={styles.message}>
                            {message || stageMessages[stage]}
                        </Text>
                    }
                >
                    <LinearGradient
                        colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: 28 }}
                    />
                </MaskedView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        paddingBottom: 0,
        width: '100%',
        height: '100%', // Ensure full height
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    },
    scannerContainer: {
        flex: 1,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    },
    scannerOutline: {
        width: BOX_SIZE,
        height: BOX_SIZE,
        position: 'relative',
        borderRadius: 12,
        borderColor: '#9B00FF',
        borderWidth: 2.5,
        overflow: 'hidden',
        shadowColor: '#9B00FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
        elevation: 10
    },
    backgroundImage: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    gridOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 1
    },
    gridLine: {
        position: 'absolute',
        backgroundColor: 'rgba(155, 0, 255, 0.7)'
    },
    horizontalLine: {
        height: 1.5,
        width: '100%'
    },
    verticalLine: {
        width: 1.5,
        height: '100%'
    },
    lottieContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1
    },
    lottieAnimation: {
        width: BOX_SIZE,
        height: BOX_SIZE
    },
    scanLine: {
        position: 'absolute',
        width: '100%',
        height: 4,
        zIndex: 3
    },
    scanLineGradient: {
        width: '100%',
        height: '100%'
    },
    pulseRing: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#9B00FF',
        zIndex: -1
    },
    progressContainer: {
        width: 260,
        marginTop: 20,
        alignItems: 'center'
    },
    progressBackground: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#00CFFF',
        borderRadius: 3
    },
    commentContainer: {
        marginTop: 15,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    commentText: {
        color: '#FF00F5',
        fontSize: 16,
        fontWeight: '600'
    },
    messageContainer: {
        marginTop: 30,
        marginBottom: 40,
        alignItems: 'center'
    },
    message: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: 'transparent'
    }
});

export default ScannerAnimation; 