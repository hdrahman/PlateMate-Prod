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
    ImageCapture: { mealType: string; photoUri?: string };
    'Food Log': undefined;
    Camera: undefined;
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
                photoUri: photo.uri
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
                    photoUri: result.assets[0].uri
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const openBarcode = () => {
        // TODO: Implement barcode scanning
        console.log('Barcode scanning to be implemented');
    };

    const openFoodLog = () => {
        navigation.navigate('Food Log');
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

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Camera</Text>
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
                        {/* Camera overlay UI */}
                    </View>
                </CameraView>
            </View>

            {/* Bottom control bar */}
            <View style={styles.controlBar}>
                <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                    <Ionicons name="images-outline" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.captureButton} onPress={handleCapturePhoto}>
                    <LinearGradient
                        colors={['#5A60EA', '#FF00F5']}
                        style={styles.captureButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="camera-outline" size={32} color="#FFFFFF" />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={openBarcode}>
                    <MaterialCommunityIcons name="barcode-scan" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Barcode</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                    <Ionicons name="document-text-outline" size={26} color="#FFFFFF" />
                    <Text style={styles.buttonLabel}>Food Log</Text>
                </TouchableOpacity>
            </View>

            {/* Camera flip button */}
            <TouchableOpacity
                style={styles.flipButton}
                onPress={toggleCameraFacing}
            >
                <Ionicons name="camera-reverse-outline" size={30} color="#FFFFFF" />
            </TouchableOpacity>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingVertical: 16,
        paddingBottom: 32, // Extra padding at bottom for better UX
    },
    controlButton: {
        alignItems: 'center',
        padding: 8,
    },
    captureButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureButtonGradient: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#FF00F5",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 8,
    },
    buttonLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
    },
    flipButton: {
        position: 'absolute',
        top: 90,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 30,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});
