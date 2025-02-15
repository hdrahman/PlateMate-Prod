import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { launchImageLibraryAsync, launchCameraAsync, MediaTypeOptions } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function App() {
    const [permission, requestPermission] = useCameraPermissions();
    const navigation = useNavigation();
    const [image, setImage] = useState(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    useEffect(() => {
        console.log('Camera permissions:', permission);
    }, [permission]);

    const BACKEND_URL = process.env.REACT_APP_MACHINE_IP
        ? `http://${process.env.REACT_APP_MACHINE_IP}:8000`
        : "http://172.31.153.15:8000";  // Fallback to hardcoded IP


    const handleTakePhoto = async () => {
        const result = await launchCameraAsync({
            mediaTypes: MediaTypeOptions.Images,
            quality: 1,
        });

        if (!result.canceled) {
            const fileUri = result.assets[0].uri;
            const fileInfo = await FileSystem.getInfoAsync(fileUri);

            const formData = new FormData();
            formData.append('user_id', '1');
            formData.append('image', {
                uri: fileUri,
                type: 'image/jpeg',
                name: fileInfo.uri.split('/').pop(),
            } as any);

            try {
                const response = await fetch(`${BACKEND_URL}/images/upload-image`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'multipart/form-data',
                    },
                    body: formData,
                });


                const data = await response.json();
                console.log('✅ Upload success:', data);
                setAnalysisResult(JSON.stringify(data.nutrition_data, null, 2)); // Display in UI

            } catch (error) {
                console.error('Upload failed:', error);
            }
        }
    };


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
            </View>
            <CameraView style={styles.camera} facing={'back'}>
            </CameraView>
            <View style={styles.buttonContainer}>
                <Button title="Take Photo" onPress={handleTakePhoto} />
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
});
