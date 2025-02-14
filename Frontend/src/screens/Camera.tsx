import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

export default function App() {
    const [permission, requestPermission] = useCameraPermissions();
    const navigation = useNavigation();

    useEffect(() => {
        console.log('Camera permissions:', permission);
    }, [permission]);

    if (!permission) {// Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {// Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    console.log('Rendering CameraView');

    return (
        <View style={styles.cameraContainer}>
            <View style={[styles.header]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>
            <CameraView style={styles.camera} facing={'back'}>
            </CameraView>
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
    headerTitle: {
        fontSize: 20
    },
});
