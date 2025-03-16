import { Camera, useCameraPermissions, CameraType } from 'expo-camera';
import { Button, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState, useRef } from 'react';
import * as FileSystem from 'expo-file-system';

export default function App() {
    const [permission, requestPermission] = useCameraPermissions();
    const navigation = useNavigation();
    const [image, setImage] = useState(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const cameraRef = useRef<any>(null);

    useEffect(() => {
        console.log('Camera permissions:', permission);
    }, [permission]);

    const BACKEND_URL = process.env.REACT_APP_MACHINE_IP
        ? `http://${process.env.REACT_APP_MACHINE_IP}:8000`
        : "http://172.31.153.15:8000";  // Fallback to hardcoded IP

    console.log('Using BACKEND_URL:', BACKEND_URL);  // Log the backend URL to ensure it's correct

    async function handleCapturePhoto() {
        if (!cameraRef.current) {
            console.log('Camera not ready');
            return;
        }
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
            const fileUri = photo.uri;
            const fileInfo = await FileSystem.getInfoAsync(fileUri);

            const formData = new FormData();
            formData.append('user_id', '1');
            formData.append('image', {
                uri: fileUri,
                type: 'image/jpeg',
                name: fileUri.split('/').pop(),
            } as any);

            console.log('📤 Uploading image to backend...');
            console.log('? Backend URL:', BACKEND_URL);
            console.log('📤 FormData:', formData);

            const response = await fetch(`${BACKEND_URL}/images/upload-image`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Upload success:', data);
            // Optionally update state if needed
            // setAnalysisResult(JSON.stringify(data.nutrition_data, null, 2));
        } catch (error) {
            console.error('❌ Upload failed:', error);
        }
    }

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="Grant Permission" />
            </View>
        );
    }

    return (
        <View style={styles.cameraContainer}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Breakfast</Text> {/* Re-added Breakfast tab */}
            </View>
            <Camera style={styles.camera} type={CameraType.back} ref={cameraRef}>
            </Camera>
            <View style={styles.buttonContainer}>
                <Button title="Take Photo" onPress={handleCapturePhoto} />
                {analysisResult && (
                    <Text style={styles.resultText}>{analysisResult}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
    },
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'transparent',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    backButton: {
        marginRight: 10,
    },
    buttonContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        margin: 20,
    },
    resultText: {
        marginTop: 20,
        fontSize: 16,
        textAlign: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 20,
        color: '#FFF',
    },
});
