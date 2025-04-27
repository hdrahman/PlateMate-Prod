import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

// Define navigation types
type RootStackParamList = {
    ImageCapture: { mealType: string; photoUri?: string; sourcePage?: string };
    'Food Log': undefined;
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
    const cameraRef = useRef<CameraView>(null);
    const navigation = useNavigation<NavigationProp>();

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
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync();

            // Navigate to ImageCapture with the photo URI
            navigation.navigate('ImageCapture', {
                mealType: 'Snacks',
                photoUri: photo.uri,
                sourcePage: 'Camera'
            });
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
                navigation.navigate('ImageCapture', {
                    mealType: 'Snacks',
                    photoUri: result.assets[0].uri,
                    sourcePage: 'Camera'
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
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
            <View style={styles.header}>
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

            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    ref={cameraRef}
                    facing={facing}
                    flash={flashMode}
                    enableTorch={flashMode === 'on'}
                    onCameraReady={() => console.log('Camera ready')}
                >
                    <View style={styles.cameraOverlay}>
                        {/* Camera frame with corners */}
                        <View style={styles.scanFrame}>
                            {renderCorner('topLeft')}
                            {renderCorner('topRight')}
                            {renderCorner('bottomRight')}
                            {renderCorner('bottomLeft')}
                        </View>
                    </View>
                </CameraView>
            </View>

            {/* Bottom control bar */}
            <View style={styles.controlBar}>
                <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                    <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={handleCapturePhoto}>
                    <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Camera</Text>
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
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
        paddingBottom: 32, // Extra padding at bottom for better UX
        position: 'absolute',
        bottom: 0,
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
});
