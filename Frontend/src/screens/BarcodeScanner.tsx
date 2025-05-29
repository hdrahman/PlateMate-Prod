import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, TextInput } from 'react-native';
import { CameraView, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { addFoodLog } from '../utils/database';
import { fetchFoodByBarcode } from '../api/fatSecret';
import * as ImagePicker from 'expo-image-picker';

// Define navigation types
type RootStackParamList = {
    ImageCapture: { mealType: string; foodData?: any; photoUri?: string; sourcePage?: string };
    'Food Log': { refresh?: number };
    Camera: undefined;
    BarcodeScanner: undefined;
    MainTabs: { screen: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function BarcodeScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [barcodeText, setBarcodeText] = useState('');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const navigation = useNavigation<NavigationProp>();

    // Request camera permissions when component mounts
    useEffect(() => {
        (async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
        })();
    }, []);

    // Handle screen focus events
    useFocusEffect(
        React.useCallback(() => {
            // Reset camera state when screen is focused
            setIsCameraReady(false);
            setScanned(false);

            // Small delay to ensure camera initializes properly
            const timer = setTimeout(() => {
                setIsCameraReady(true);
            }, 300);

            return () => {
                clearTimeout(timer);
            };
        }, [])
    );

    const handleBarCodeScanned = (result: BarcodeScanningResult) => {
        if (scanned) return;

        setScanned(true);
        setLoading(true);

        // Extract type and data from scanning result
        const { type, data } = result;

        // Process the barcode data
        processBarcode(type, data);
    };

    const processBarcode = async (type: string, data: string) => {
        try {
            // UPC/EAN barcode detected
            console.log(`Bar code with type ${type} and data ${data} has been scanned!`);

            // Look up nutrition data using FatSecret API
            const foodData = await fetchFoodByBarcode(data);

            if (foodData) {
                // Navigate to ImageCapture with the nutrition data with sourcePage parameter
                navigation.navigate('ImageCapture', {
                    mealType: 'Snacks',
                    foodData,
                    sourcePage: 'BarcodeScanner'
                });
            } else {
                Alert.alert(
                    'Barcode Not Found',
                    'The scanned barcode was not found in our database. Would you like to try again?',
                    [
                        {
                            text: 'Cancel',
                            onPress: () => navigation.goBack(),
                            style: 'cancel',
                        },
                        { text: 'Try Again', onPress: () => setScanned(false) },
                    ]
                );
            }
        } catch (error) {
            console.error('Error processing barcode:', error);
            Alert.alert(
                'Error',
                'There was an error scanning the barcode. Please try again.',
                [
                    {
                        text: 'Cancel',
                        onPress: () => navigation.goBack(),
                        style: 'cancel',
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

    const toggleTorch = () => {
        setTorchOn(!torchOn);
    };

    // Navigation functions
    const openGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                navigation.navigate('ImageCapture', {
                    mealType: 'Snacks',
                    photoUri: result.assets[0].uri,
                    sourcePage: 'BarcodeScanner'
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const handleCapturePhoto = () => {
        navigation.navigate('MainTabs', { screen: 'Camera' });
    };

    const openFoodLog = () => {
        navigation.navigate('Manual');
    };

    // If user denies camera permission
    if (permission?.granted === false) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>Camera permission is required to scan barcodes</Text>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestPermission}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.controlBar}>
                    <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                        <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                        <Text style={styles.buttonLabel}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlButton} onPress={handleCapturePhoto}>
                        <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
                        <Text style={styles.buttonLabel}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlButton} onPress={() => { }}>
                        <MaterialCommunityIcons name="barcode-scan" size={26} color="#FFFFFF" />
                        <Text style={styles.buttonLabel}>Barcode</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                        <Ionicons name="document-text-outline" size={26} color="#FFFFFF" />
                        <Text style={styles.buttonLabel}>Manual</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {isCameraReady && (
                <CameraView
                    style={styles.camera}
                    ref={cameraRef}
                    facing="back"
                    enableTorch={torchOn}
                    barcodeScannerSettings={{
                        barcodeTypes: [
                            "ean13",
                            "ean8",
                            "upc_e",
                            "upc_a"
                        ]
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    onCameraReady={() => console.log('Camera is ready')}
                    onMountError={(error) => console.error('Camera mount error:', error)}
                >
                    {!loading && (
                        <View style={styles.cameraOverlay}>
                            {/* Semi-transparent overlay with a clear rectangle in the middle */}
                            <View style={styles.overlay}>
                                <View style={styles.transparentWindow} />
                            </View>
                            {/* Barcode scanning rectangle */}
                            <View style={styles.scanRectangle} />
                            <Text style={styles.guideText}>Align the barcode within the rectangle</Text>

                            {/* Text input for barcode entry */}
                            <View style={styles.textInputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter barcode here"
                                    placeholderTextColor="#999"
                                    value={barcodeText}
                                    onChangeText={setBarcodeText}
                                    keyboardType="number-pad"
                                    returnKeyType="search"
                                    onSubmitEditing={handleManualSubmit}
                                />
                            </View>
                        </View>
                    )}
                </CameraView>
            )}

            {!isCameraReady && (
                <View style={styles.loadingCamera}>
                    <ActivityIndicator size="large" color="#FF00F5" />
                    <Text style={styles.loadingText}>Initializing camera...</Text>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scanner</Text>
                <TouchableOpacity onPress={toggleTorch} style={styles.flashButton}>
                    <Ionicons
                        name={torchOn ? "flash" : "flash-off"}
                        size={24}
                        color="#FFF"
                    />
                </TouchableOpacity>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FF00F5" />
                    <Text style={styles.loadingText}>Looking up product information...</Text>
                </View>
            )}

            {scanned && !loading && (
                <View style={styles.scanAgainContainer}>
                    <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
                        <LinearGradient
                            colors={['#5A60EA', '#FF00F5']}
                            style={styles.gradientButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.buttonText}>Scan Again</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Navigation Control Bar */}
            <View style={styles.controlBar}>
                <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                    <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={handleCapturePhoto}>
                    <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={() => { }}>
                    <MaterialCommunityIcons name="barcode-scan" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Barcode</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                    <Ionicons name="document-text-outline" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Manual</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // Set to black as fallback
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: StatusBar.currentHeight || 16,
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
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    loadingCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent overlay
    },
    transparentWindow: {
        position: 'absolute',
        width: 300, // Slightly wider than before
        height: 150, // Slightly taller than before
        left: '50%',
        top: '50%',
        marginLeft: -150, // Half the width
        marginTop: -75, // Half the height
        backgroundColor: 'transparent',
    },
    scanRectangle: {
        width: 300, // Wider for barcode
        height: 150, // Taller for barcode
        borderWidth: 2,
        borderColor: '#FF00F5',
        borderRadius: 16,
        marginBottom: 16,
    },
    guideText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        marginTop: 8,
    },
    textInputContainer: {
        position: 'absolute',
        width: '90%',
        bottom: 20,
    },
    textInput: {
        width: '100%',
        height: 35, // Thinner height
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontSize: 16,
    },
    scanAgainContainer: {
        position: 'absolute',
        top: '60%',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 15,
    },
    scanAgainButton: {
        width: '80%',
        borderRadius: 8,
        overflow: 'hidden',
    },
    gradientButton: {
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingVertical: 16,
        paddingBottom: 32, // Extra padding at bottom for better UX
        position: 'absolute',
        bottom: 70, // Moved up from bottom: 0
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
        textShadowRadius: 3,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    permissionText: {
        color: '#FFFFFF',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#FF00F5',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});