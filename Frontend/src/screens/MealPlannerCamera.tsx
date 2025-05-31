import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

// Define navigation types
type RootStackParamList = {
    MealPlannerResults: { imageUri: string };
    MealPlanner: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function MealPlannerCamera() {
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [processingImage, setProcessingImage] = useState(false);
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
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>We need your permission to show the camera</Text>
                <TouchableOpacity
                    style={styles.errorButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.errorButtonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleCapturePhoto = async () => {
        if (!cameraRef.current || !isCameraReady) {
            console.warn('Camera not ready or ref not available');
            return;
        }

        try {
            // Add a small delay to ensure camera is fully ready
            await new Promise(resolve => setTimeout(resolve, 100));

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                exif: false,
            });

            setCapturedImage(photo.uri);
            setProcessingImage(true);

            // Navigate to results screen after a short delay
            setTimeout(() => {
                navigation.navigate('MealPlannerResults', {
                    imageUri: photo.uri
                });
            }, 1500);
        } catch (error) {
            console.error('Error taking photo:', error);
        }
    };

    const openGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setCapturedImage(result.assets[0].uri);
                setProcessingImage(true);

                // Navigate to results screen after a short delay
                setTimeout(() => {
                    navigation.navigate('MealPlannerResults', {
                        imageUri: result.assets[0].uri
                    });
                }, 1500);
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
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

    const handleBack = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {capturedImage && processingImage ? (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: capturedImage }} style={styles.previewImage} />
                    <View style={styles.loadingOverlay}>
                        <Text style={styles.processingText}>Processing your pantry items...</Text>
                    </View>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Scan Your Pantry</Text>
                        <TouchableOpacity onPress={toggleFlashMode} style={styles.flashButton}>
                            <Ionicons
                                name={flashMode === 'on' ? "flash" : "flash-off"}
                                size={24}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cameraContainer}>
                        {isCameraReady && (
                            <CameraView
                                style={styles.camera}
                                ref={cameraRef}
                                facing={facing}
                                flash={flashMode}
                                enableTorch={flashMode === 'on'}
                                onCameraReady={() => console.log('MealPlanner Camera ready')}
                                onMountError={(error) => console.error('MealPlanner Camera mount error:', error)}
                            >
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']}
                                    style={styles.gradient}
                                />

                                <View style={styles.instructionsContainer}>
                                    <Text style={styles.instructionsText}>
                                        Take a photo of your pantry items to generate personalized meal suggestions
                                    </Text>
                                </View>
                            </CameraView>
                        )}

                        {!isCameraReady && (
                            <View style={styles.loadingCamera}>
                                <Text style={styles.loadingText}>Initializing Camera...</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.controlBar}>
                        <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
                            <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
                            <Text style={styles.buttonLabel}>Flip</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.captureButton} onPress={handleCapturePhoto}>
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                            <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                            <Text style={styles.buttonLabel}>Gallery</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
        justifyContent: 'space-between',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
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
        color: 'white',
        fontWeight: 'bold',
    },
    instructionsContainer: {
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
        marginHorizontal: 20,
        marginTop: 80,
    },
    instructionsText: {
        color: 'white',
        textAlign: 'center',
        fontSize: 16,
    },
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingVertical: 20,
    },
    controlButton: {
        alignItems: 'center',
    },
    buttonLabel: {
        color: 'white',
        marginTop: 4,
        fontSize: 12,
    },
    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
    },
    previewContainer: {
        flex: 1,
        position: 'relative',
    },
    previewImage: {
        flex: 1,
        resizeMode: 'cover',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
    },
    errorText: {
        color: 'white',
        fontSize: 18,
        marginBottom: 20,
    },
    errorButton: {
        backgroundColor: '#FF00F5',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    errorButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
}); 