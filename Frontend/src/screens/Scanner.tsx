import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Animated, Platform, ActivityIndicator, Alert, TextInput, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultMealType } from '../utils/mealTypeUtils';
import SubscriptionManager from '../utils/SubscriptionManager';
import { barcodeService } from '../services/BarcodeService';
import * as Haptics from 'expo-haptics';
import tokenManager from '../utils/tokenManager';

const { width } = Dimensions.get('window');

// Modern color scheme
const COLORS = {
    PRIMARY_BG: '#000000',
    SECONDARY_BG: '#111111',
    CARD_BG: '#1a1a1a',
    WHITE: '#FFFFFF',
    GRAY_LIGHT: '#B0B0B0',
    GRAY_MEDIUM: '#808080',
    GRAY_DARK: '#333333',
    ACCENT_BLUE: '#0084ff',
    ACCENT_GREEN: '#32D74B',
    ACCENT_ORANGE: '#FF9500',
    ACCENT_RED: '#FF3B30',
    ACCENT_PURPLE: '#AF52DE',
    ACCENT_PINK: '#FF2D92',
    GLASS: 'rgba(255, 255, 255, 0.1)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
};

// Define navigation types
type RootStackParamList = {
    ImageCapture: { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
    ScannedProduct: { foodData: any; mealType?: string };
    FoodLog: { refresh?: number };
    Scanner: { mode?: 'camera' | 'barcode' };
    MainTabs: { screen: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;
type ScannerRouteProp = RouteProp<RootStackParamList, 'Scanner'>;

type ScannerMode = 'camera' | 'barcode';

// To ensure Firebase token is ready when the screen is shown
const prefetchAuthToken = () => {
    tokenManager.getToken('supabase').then(() => {
        console.log('Auth token prefetched for barcode scanning');
    }).catch(error => {
        console.error('Failed to prefetch auth token:', error);
    });
};

export default function ScannerScreen() {
    const route = useRoute<ScannerRouteProp>();
    const [mode, setMode] = useState<ScannerMode>(route.params?.mode || 'camera');
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [torchOn, setTorchOn] = useState(false);

    // Barcode specific state
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [barcodeText, setBarcodeText] = useState('');

    const cameraRef = useRef<CameraView>(null);
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();

    // Animation values for pulse effect (camera mode)
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.8)).current;

    // Start pulse animation when camera is ready and in camera mode
    useEffect(() => {
        if (isCameraReady && mode === 'camera') {
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
    }, [isCameraReady, mode, pulseAnim, opacityAnim]);

    // Request camera permissions when component mounts
    useEffect(() => {
        (async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
            // Prefetch auth token for barcode mode
            if (mode === 'barcode') {
                prefetchAuthToken();
            }
        })();
    }, []);

    // Handle screen focus events
    useFocusEffect(
        React.useCallback(() => {
            setIsCameraReady(false);
            setScanned(false);

            const timer = setTimeout(() => {
                setIsCameraReady(true);
                // Prefetch auth token when screen comes into focus in barcode mode
                if (mode === 'barcode') {
                    prefetchAuthToken();
                }
            }, 300);

            return () => {
                clearTimeout(timer);
                setIsCameraReady(false);
            };
        }, [mode])
    );

    // Handle mode changes
    const handleModeChange = (newMode: ScannerMode) => {
        if (newMode === mode) return;

        setMode(newMode);
        setScanned(false);
        setLoading(false);
        setBarcodeText('');

        // Prefetch token if switching to barcode mode
        if (newMode === 'barcode') {
            prefetchAuthToken();
        }
    };

    // Camera mode: Capture photo
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
                        sourcePage: 'Scanner'
                    });
                } catch (error) {
                    console.error('Error taking photo:', error);
                }
            },
            'camera'
        );
    };

    // Barcode mode: Handle barcode scan
    const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
        if (scanned) return;

        if (!barcodeService.validateScanResult(result)) {
            console.warn('Invalid barcode scan result');
            return;
        }

        setScanned(true);
        setLoading(true);

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { type, data } = result;
        processBarcode(type, data);
    };

    const processBarcode = async (type: string, data: string) => {
        try {
            console.log(`Bar code with type ${type} and data ${data} has been scanned!`);

            const foodData = await barcodeService.lookupBarcode(data);

            if (foodData) {
                console.log('Successfully retrieved food data:', foodData.food_name);

                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Navigate to the ScannedProduct screen
                navigation.navigate('ScannedProduct', {
                    foodData,
                    mealType: getDefaultMealType()
                });
            } else {
                console.log('No food data found in any API');

                // Error haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                Alert.alert(
                    'Product Not Found',
                    'This barcode wasn\'t found in our database. Try scanning another product or add it manually.',
                    [
                        {
                            text: 'Manual Entry',
                            onPress: () => navigation.navigate('Manual'),
                            style: 'default',
                        },
                        { text: 'Try Again', onPress: () => setScanned(false) },
                    ]
                );
            }
        } catch (error) {
            console.error('Error processing barcode:', error);

            // Error haptic
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert(
                'Scan Error',
                'Unable to process the barcode. Please check your connection and try again.',
                [
                    {
                        text: 'Manual Entry',
                        onPress: () => navigation.navigate('Manual'),
                        style: 'default',
                    },
                    { text: 'Try Again', onPress: () => setScanned(false) },
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = () => {
        if (barcodeText.trim()) {
            processBarcode('manual', barcodeText.trim());
        }
    };

    // Navigation functions
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
                            sourcePage: 'Scanner'
                        });
                    }
                } catch (error) {
                    console.error('Error picking image:', error);
                }
            },
            'gallery'
        );
    };

    const openFoodLog = () => {
        navigation.navigate('Manual');
    };

    const toggleFlash = async () => {
        if (mode === 'camera') {
            setFlashMode(current => current === 'off' ? 'on' : 'off');
        } else {
            setTorchOn(!torchOn);
        }
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const toggleCameraFacing = () => {
        setFacing(current => current === 'back' ? 'front' : 'back');
    };

    // Render a corner with gradient (camera mode)
    const renderCorner = (position: string) => {
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

    // Render control bar
    const renderControlBar = () => (
        <View style={styles.controlBar}>
            <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                <Ionicons name="images-outline" size={26} color={COLORS.WHITE} />
                <Text style={styles.buttonLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.controlButton, mode === 'camera' && styles.activeControlButton]}
                onPress={() => handleModeChange('camera')}
            >
                <Ionicons name="camera-outline" size={32} color={mode === 'camera' ? '#FF00F5' : COLORS.WHITE} />
                <Text style={[styles.buttonLabel, mode === 'camera' && { color: '#FF00F5' }]}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.controlButton, mode === 'barcode' && styles.activeControlButton]}
                onPress={() => handleModeChange('barcode')}
            >
                <MaterialCommunityIcons name="barcode-scan" size={26} color={mode === 'barcode' ? '#FF00F5' : COLORS.WHITE} />
                <Text style={[styles.buttonLabel, mode === 'barcode' && { color: '#FF00F5' }]}>Barcode</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                <Ionicons name="document-text-outline" size={26} color={COLORS.WHITE} />
                <Text style={styles.buttonLabel}>Manual</Text>
            </TouchableOpacity>
        </View>
    );

    // If user denies camera permission
    if (permission?.granted === false) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                <LinearGradient colors={[COLORS.PRIMARY_BG, COLORS.SECONDARY_BG]} style={styles.container}>
                    <View style={styles.permissionContainer}>
                        <MaterialIcons name="camera-alt" size={80} color={COLORS.GRAY_MEDIUM} />
                        <Text style={styles.permissionTitle}>Camera Access Required</Text>
                        <Text style={styles.permissionSubtitle}>
                            Allow camera access to {mode === 'camera' ? 'capture food photos' : 'scan product barcodes'} and discover nutrition information
                        </Text>
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <LinearGradient colors={[COLORS.ACCENT_PURPLE, COLORS.ACCENT_PINK]} style={styles.gradientButton}>
                                <Text style={styles.permissionButtonText}>Enable Camera</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                    {renderControlBar()}
                </LinearGradient>
            </SafeAreaView>
        );
    }

    if (!permission) {
        return <View />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.cameraContainer}>
                {isCameraReady && (
                    <CameraView
                        style={styles.camera}
                        ref={cameraRef}
                        facing={facing}
                        flash={mode === 'camera' ? flashMode : 'off'}
                        enableTorch={mode === 'barcode' ? torchOn : (flashMode === 'on')}
                        barcodeScannerSettings={mode === 'barcode' ? {
                            barcodeTypes: [
                                "ean13",
                                "ean8",
                                "upc_e",
                                "upc_a"
                            ]
                        } : undefined}
                        onBarcodeScanned={mode === 'barcode' && !scanned ? handleBarCodeScanned : undefined}
                        onCameraReady={() => console.log('Camera is ready')}
                        onMountError={(error) => console.error('Camera mount error:', error)}
                    >
                        {/* Header */}
                        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top + 8 }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={28} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Scanner</Text>
                            <TouchableOpacity onPress={toggleFlash} style={styles.flashButton}>
                                <Ionicons
                                    name={mode === 'camera' ? (flashMode === 'on' ? "flash" : "flash-off") : (torchOn ? "flash" : "flash-off")}
                                    size={24}
                                    color="#FFF"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Mode-specific overlays */}
                        {mode === 'camera' && (
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

                                {/* Capture Button */}
                                <TouchableOpacity
                                    style={[styles.captureButton, { bottom: insets.bottom + 20 }]}
                                    onPress={handleCapturePhoto}
                                >
                                    <View style={styles.captureButtonInner} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {mode === 'barcode' && !loading && (
                            <View style={styles.barcodeOverlay}>
                                {/* Barcode scanning frame */}
                                <View style={styles.scanningFrame}>
                                    <View style={styles.scanLineContainer}>
                                        <View style={styles.scanLine} />
                                    </View>
                                    {renderCorner('topLeft')}
                                    {renderCorner('topRight')}
                                    {renderCorner('bottomLeft')}
                                    {renderCorner('bottomRight')}
                                </View>

                                <View style={styles.instructionContainer}>
                                    <Text style={styles.instructionText}>Point camera at barcode</Text>
                                    <Text style={styles.subInstructionText}>Keep barcode in frame for automatic scanning</Text>
                                </View>

                                {/* Manual barcode input */}
                                <View style={styles.manualInputContainer}>
                                    <BlurView intensity={30} style={styles.manualInputBlur}>
                                        <TextInput
                                            style={styles.manualInput}
                                            placeholder="Enter barcode manually"
                                            placeholderTextColor={COLORS.GRAY_MEDIUM}
                                            value={barcodeText}
                                            onChangeText={setBarcodeText}
                                            keyboardType="number-pad"
                                            returnKeyType="search"
                                            onSubmitEditing={handleManualSubmit}
                                        />
                                        <TouchableOpacity
                                            style={styles.manualSubmitButton}
                                            onPress={handleManualSubmit}
                                        >
                                            <Ionicons name="search" size={20} color={COLORS.WHITE} />
                                        </TouchableOpacity>
                                    </BlurView>
                                </View>
                            </View>
                        )}

                        {/* Control Bar */}
                        {renderControlBar()}
                    </CameraView>
                )}

                {!isCameraReady && (
                    <LinearGradient colors={[COLORS.PRIMARY_BG, COLORS.SECONDARY_BG]} style={styles.loadingCamera}>
                        <View style={styles.loadingContent}>
                            <View style={styles.loadingAnimation}>
                                <ActivityIndicator size="large" color={COLORS.ACCENT_PINK} />
                            </View>
                            <Text style={styles.loadingTitle}>Initializing Scanner</Text>
                            <Text style={styles.loadingSubtitle}>Preparing camera for {mode === 'camera' ? 'photo capture' : 'barcode detection'}</Text>
                        </View>
                    </LinearGradient>
                )}
            </View>

            {/* Loading overlay (barcode mode) */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView intensity={50} style={styles.loadingBlur}>
                        <View style={styles.loadingContent}>
                            <ActivityIndicator size="large" color={COLORS.ACCENT_PINK} />
                            <Text style={styles.loadingTitle}>Analyzing Product</Text>
                            <Text style={styles.loadingSubtitle}>Fetching nutrition information...</Text>
                        </View>
                    </BlurView>
                </View>
            )}

            {/* Scan again button (barcode mode) */}
            {scanned && !loading && mode === 'barcode' && (
                <View style={styles.scanCompleteContainer}>
                    <BlurView intensity={30} style={styles.scanCompleteBlur}>
                        <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
                            <LinearGradient
                                colors={[COLORS.ACCENT_PURPLE, COLORS.ACCENT_PINK]}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="refresh" size={20} color={COLORS.WHITE} />
                                <Text style={styles.scanAgainText}>Scan Another</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        ...StyleSheet.absoluteFillObject,
    },

    // Header Styles
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

    // Camera mode overlay
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 120,
    },

    // Barcode mode overlay
    barcodeOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 150,
        paddingBottom: 180,
    },

    // Camera mode: Scanner frame with corners
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

    // Barcode mode: Scanning frame
    scanningFrame: {
        width: width * 0.75,
        height: width * 0.45,
        position: 'relative',
        backgroundColor: 'transparent',
        borderRadius: 16,
    },
    scanLineContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanLine: {
        width: '90%',
        height: 3,
        backgroundColor: '#9B00FF',
        borderRadius: 2,
        opacity: 0.8,
        shadowColor: '#9B00FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
    },

    // Instruction Styles (barcode mode)
    instructionContainer: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    instructionText: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    subInstructionText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

    // Manual Input Styles (barcode mode)
    manualInputContainer: {
        position: 'absolute',
        bottom: 80,
        left: 20,
        right: 20,
    },
    manualInputBlur: {
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    manualInput: {
        flex: 1,
        color: COLORS.WHITE,
        fontSize: 14,
        paddingVertical: 4,
    },
    manualSubmitButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF00F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },

    // Control Bar Styles
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
        zIndex: 100,
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
    activeControlButton: {
        backgroundColor: 'rgba(255, 0, 245, 0.5)',
    },
    buttonLabel: {
        color: COLORS.WHITE,
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },

    // Capture Button (camera mode)
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

    // Loading Styles
    loadingCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingAnimation: {
        marginBottom: 20,
    },
    loadingTitle: {
        color: COLORS.WHITE,
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    loadingSubtitle: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
    },
    loadingBlur: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Scan Complete Styles (barcode mode)
    scanCompleteContainer: {
        position: 'absolute',
        top: '60%',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 150,
    },
    scanCompleteBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    scanAgainButton: {
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 160,
    },
    scanAgainText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Permission Styles
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 200,
    },
    permissionTitle: {
        color: COLORS.WHITE,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 16,
    },
    permissionSubtitle: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    permissionButton: {
        borderRadius: 16,
        overflow: 'hidden',
        minWidth: 200,
    },
    permissionButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },

    // Common Styles
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
    },
});
