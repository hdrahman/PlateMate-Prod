import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Animated, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultMealType } from '../utils/mealTypeUtils';
import SubscriptionManager from '../utils/SubscriptionManager';

// Define navigation types
type RootStackParamList = {
    ImageCapture: { mealType: string; photoUri?: string; sourcePage?: string };
    FoodLog: undefined;
    Camera: undefined;
    BarcodeScanner: undefined;
    MainTabs: { screen: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function CameraScreen() {
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();

    // Animation values for pulse effect
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.8)).current;

    // Start pulse animation when camera is ready
    useEffect(() => {
        if (isCameraReady) {
            const startPulseAnimation = () => {
                Animated.loop(
                    Animated.sequence([
                        Animated.parallel([
                            Animated.timing(pulseAnim, {
                                toValue: 1.08,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                            Animated.timing(opacityAnim, {
                                toValue: 1,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                        ]),
                        Animated.parallel([
                            Animated.timing(pulseAnim, {
                                toValue: 1,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                            Animated.timing(opacityAnim, {
                                toValue: 0.8,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                        ]),
                    ])
                ).start();
            };
            startPulseAnimation();
        }
    }, [isCameraReady, pulseAnim, opacityAnim]);

    // Request camera permissions when component mounts
    useEffect(() => {
        (async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
        })();
    }, []);

    // Handle screen focus events - this is crucial for camera management
    useFocusEffect(
        React.useCallback(() => {
            setIsCameraReady(false);

            const timer = setTimeout(() => {
                setIsCameraReady(true);
            }, 300);

            return () => {
                clearTimeout(timer);
                setIsCameraReady(false);
            };
        }, [])
    );

    if (!permission) {
        // Camera permissions are still loading
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleCapturePhoto = async () => {
        if (!cameraRef.current || !isCameraReady) {
            console.warn('Camera not ready or ref not available');
            return;
        }

        // Check if user can upload image (daily limit for free users)
        await SubscriptionManager.handleImageUpload(
            navigation,
            async () => {
                try {
                    // Add a small delay to ensure camera is fully ready
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const photo = await cameraRef.current.takePictureAsync({
                        quality: 0.95,
                        base64: false,
                        exif: false,
                    });

                    // Navigate to ImageCapture with the photo URI
                    navigation.navigate('ImageCapture', {
                        mealType: getDefaultMealType(),
                        photoUri: photo.uri,
                        sourcePage: 'Camera'
                    });
                } catch (error) {
                    console.error('Error taking photo:', error);
                }
            },
            'camera'
        );
    };

    const openGallery = async () => {
        // Check if user can upload image (daily limit for free users)
        await SubscriptionManager.handleImageUpload(
            navigation,
            async () => {
                try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 1,
                        allowsEditing: false,
                    });

                    if (!result.canceled && result.assets && result.assets.length > 0) {
                        navigation.navigate('ImageCapture', {
                            mealType: getDefaultMealType(),
                            photoUri: result.assets[0].uri,
                            sourcePage: 'Camera'
                        });
                    }
                } catch (error) {
                    console.error('Error picking image:', error);
                }
            },
            'gallery'
        );
    };

    const openBarcode = () => {
        // Navigate to the barcode scanner screen
        navigation.navigate('BarcodeScanner');
    };

    const openFoodLog = () => {
        navigation.navigate('Manual');
    };

    const toggleFlashMode = () => {
        setFlashMode(current =>
            current === 'off' ? 'on' : 'off'
        );
    };

    const toggleCameraFacing = () => {
        setFacing(current =>
            current === 'back' ? 'front' : 'back'
        );
    };

    // Render a corner with gradient
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.cameraContainer}>
                {isCameraReady && (
                    <CameraView
                        style={styles.camera}
                        ref={cameraRef}
                        facing={facing}
                        flash={flashMode}
                        enableTorch={flashMode === 'on'}
                        onCameraReady={() => console.log('Camera ready')}
                        onMountError={(error) => console.error('Camera mount error:', error)}
                    >
                        {/* Overlay elements positioned inside the camera */}
                        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top + 8 }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={28} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Scanner</Text>
                            <TouchableOpacity onPress={toggleFlashMode} style={styles.flashButton}>
                                <Ionicons
                                    name={flashMode === 'on' ? "flash" : "flash-off"}
                                    size={24}
                                    color="#FFF"
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.cameraOverlay}>
                            {/* Animated Camera frame with corners */}
                            <Animated.View
                                style={[
                                    styles.scanFrame,
                                    {
                                        transform: [{ scale: pulseAnim }],
                                        opacity: opacityAnim,
                                    }
                                ]}
                            >
                                {renderCorner('topLeft')}
                                {renderCorner('topRight')}
                                {renderCorner('bottomRight')}
                                {renderCorner('bottomLeft')}
                            </Animated.View>

                            {/* Options control bar - moved above capture button */}
                            <View style={styles.controlBar}>
                                <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                                    <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                                    <Text style={styles.buttonLabel}>Gallery</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.controlButton, styles.activeControlButton]}>
                                    <Ionicons name="camera-outline" size={32} color="#FF00F5" />
                                    <Text style={[styles.buttonLabel, { color: '#FF00F5' }]}>Camera</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.controlButton} onPress={openBarcode}>
                                    <MaterialCommunityIcons name="barcode-scan" size={26} color="#FFFFFF" />
                                    <Text style={styles.buttonLabel}>Barcode</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                                    <Ionicons name="document-text-outline" size={26} color="#FFFFFF" />
                                    <Text style={styles.buttonLabel}>Manual</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Capture Button - moved below options */}
                            <TouchableOpacity
                                style={[styles.captureButton, { bottom: insets.bottom + 20 }]}
                                onPress={handleCapturePhoto}
                            >
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        </View>
                    </CameraView>
                )}

                {!isCameraReady && (
                    <View style={styles.loadingCamera}>
                        <Text style={styles.loadingText}>Initializing Camera...</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'transparent',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    backButton: {
        padding: 8,
    },
    flashButton: {
        padding: 8,
    },
    headerTitle: {
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    message: {
        color: '#FFFFFF',
        textAlign: 'center',
        paddingHorizontal: 20,
        marginTop: 40,
        fontSize: 16,
    },
    permissionButton: {
        backgroundColor: '#FF00F5',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 20,
        alignSelf: 'center',
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 120,
    },
    // Scanner frame styles
    scanFrame: {
        width: 280,
        height: 380,
        position: 'relative',
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
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingVertical: 16,
        position: 'absolute',
        bottom: 170,
        left: 0,
        right: 0,
    },
    controlButton: {
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 12,
        width: 70,
        height: 70,
        justifyContent: 'center',
    },
    buttonLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captureButton: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(155, 0, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
    },
    loadingCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    activeControlButton: {
        backgroundColor: 'rgba(255, 0, 245, 0.5)',
    },
});
