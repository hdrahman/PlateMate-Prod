import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    StatusBar,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { getUserProfileBySupabaseUid, updateUserProfile } from '../utils/database';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

const COLORS = {
    PRIMARY_BG: '#000000',
    CARD_BG: '#1C1C1E',
    WHITE: '#FFFFFF',
    SUBDUED: '#AAAAAA',
    PURPLE_ACCENT: '#AA00FF',
    SUCCESS: '#4CAF50',
    ERROR: '#F44336',
};

type MessageKind = 'text' | 'voice' | 'video';

const FutureSelfRecordingSimple: React.FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation();

    // State
    const [loading, setLoading] = useState<boolean>(true);
    const [messageType, setMessageType] = useState<MessageKind>('text');
    const [textMessage, setTextMessage] = useState<string>('');
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [recordingTimeLeft, setRecordingTimeLeft] = useState<number>(30);
    const [showCamera, setShowCamera] = useState<boolean>(false);
    const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
    const [cameraReady, setCameraReady] = useState<boolean>(false);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const cameraRef = useRef<CameraView | null>(null);
    const videoRef = useRef<Video | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Permissions
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Load existing profile data
    useEffect(() => {
        const load = async () => {
            if (!user?.uid) {
                setLoading(false);
                return;
            }
            try {
                const profile: any = await getUserProfileBySupabaseUid(user.uid);
                if (profile) {
                    setMessageType((profile.future_self_message_type as MessageKind) || 'text');
                    setTextMessage(profile.future_self_message || '');
                    setRecordingUri(profile.future_self_message_uri || null);
                }
            } catch (err) {
                console.error('Failed to load message', err);
            } finally {
                setLoading(false);
            }
        };
        load();

        // Cleanup on unmount
        return () => {
            cleanup();
        };
    }, [user?.uid]);

    const cleanup = async () => {
        try {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (recordingRef.current) {
                await recordingRef.current.stopAndUnloadAsync();
            }
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    };

    /* -------------------------------------------------- */
    /*                   AUDIO RECORDING                  */
    /* -------------------------------------------------- */

    const startAudioRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', 'Please grant microphone access to record a voice message.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            });

            recordingRef.current = recording;
            await recording.startAsync();
            setIsRecording(true);
            setRecordingTimeLeft(30);

            // Start countdown timer
            timerRef.current = setInterval(() => {
                setRecordingTimeLeft((prev) => {
                    if (prev <= 1) {
                        stopAudioRecording();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording', error);
            Alert.alert('Error', 'Could not start recording.');
        }
    };

    const stopAudioRecording = async () => {
        try {
            if (!recordingRef.current) return;

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();

            if (uri) {
                // Save to permanent location
                const fileName = `voice_message_${Date.now()}.m4a`;
                const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.copyAsync({ from: uri, to: permanentUri });
                setRecordingUri(permanentUri);
            }

            setIsRecording(false);
            recordingRef.current = null;
        } catch (error) {
            console.error('Failed to stop recording', error);
            Alert.alert('Error', 'Could not stop recording.');
        }
    };

    const playAudio = async () => {
        if (!recordingUri) return;
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
            soundRef.current = sound;
            setIsPlaying(true);

            sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });

            await sound.playAsync();
        } catch (error) {
            console.error('Playback error', error);
            setIsPlaying(false);
        }
    };

    const stopAudio = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            setIsPlaying(false);
        }
    };

    /* -------------------------------------------------- */
    /*                   VIDEO RECORDING                  */
    /* -------------------------------------------------- */

    const startVideoRecording = async () => {
        try {
            // Request permissions
            const cam = await requestCameraPermission();
            const mic = await Audio.requestPermissionsAsync();
            if (!cam.granted || !mic.granted) {
                Alert.alert('Permission needed', 'Camera and microphone permissions are required.');
                return;
            }

            setRecordingUri(null);
            setShowCamera(true);
            setCameraReady(false);
        } catch (error) {
            console.error('startVideoRecording error', error);
        }
    };

    const beginCameraRecording = async () => {
        if (!cameraRef.current || !cameraReady) return;

        try {
            setIsRecording(true);
            setRecordingTimeLeft(30);

            // Start countdown timer
            timerRef.current = setInterval(() => {
                setRecordingTimeLeft((prev) => {
                    if (prev <= 1) {
                        stopCameraRecording();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            const videoData = await cameraRef.current.recordAsync({
                maxDuration: 30,
            });

            if (videoData?.uri) {
                // Save to permanent location
                const fileName = `video_message_${Date.now()}.mp4`;
                const dest = FileSystem.documentDirectory + fileName;
                await FileSystem.copyAsync({ from: videoData.uri, to: dest });
                setRecordingUri(dest);
            }
        } catch (error) {
            console.error('recordAsync error', error);
        } finally {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setIsRecording(false);
            setShowCamera(false);
            setCameraReady(false);
        }
    };

    const stopCameraRecording = async () => {
        try {
            if (cameraRef.current && isRecording) {
                await cameraRef.current.stopRecording();
            }
        } catch (error) {
            console.error('stopCameraRecording error', error);
        }
    };

    /* -------------------------------------------------- */
    /*                   DELETE & SAVE                    */
    /* -------------------------------------------------- */

    const deleteRecording = async () => {
        Alert.alert(
            'Delete Recording',
            'Are you sure you want to delete this recording?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (recordingUri) {
                            try {
                                const info = await FileSystem.getInfoAsync(recordingUri);
                                if (info.exists) {
                                    await FileSystem.deleteAsync(recordingUri, { idempotent: true });
                                }
                            } catch { }
                        }
                        setRecordingUri(null);
                        if (soundRef.current) {
                            await soundRef.current.unloadAsync();
                            soundRef.current = null;
                        }
                    },
                },
            ]
        );
    };

    const handleSave = async () => {
        if (!user?.uid) {
            Alert.alert('Not signed in', 'Please sign in again.');
            return;
        }

        if (messageType === 'text' && textMessage.trim() === '') {
            Alert.alert('Empty message', 'Please write a message first.');
            return;
        }
        if ((messageType === 'voice' || messageType === 'video') && !recordingUri) {
            Alert.alert('No recording', `Please record a ${messageType} message first.`);
            return;
        }

        try {
            await updateUserProfile(user.uid, {
                future_self_message: messageType === 'text' ? textMessage : '',
                future_self_message_type: messageType,
                future_self_message_uri: (messageType === 'voice' || messageType === 'video') ? recordingUri : null,
                future_self_message_created_at: new Date().toISOString(),
            });
            Alert.alert(
                'Success!',
                'Your future self message has been saved. You can access it anytime from Settings.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Save failed', error);
            Alert.alert('Error', 'Could not save your message.');
        }
    };

    /* -------------------------------------------------- */
    /*                       RENDER                       */
    /* -------------------------------------------------- */

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={COLORS.PURPLE_ACCENT} size="large" />
            </View>
        );
    }

    // Camera overlay screen
    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_BG} />
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={cameraFacing}
                    onCameraReady={() => setCameraReady(true)}
                />

                <View style={styles.cameraOverlay}>
                    <View style={styles.cameraHeader}>
                        <TouchableOpacity
                            style={styles.flipButton}
                            onPress={() => setCameraFacing(cameraFacing === 'back' ? 'front' : 'back')}
                        >
                            <Ionicons name="camera-reverse" size={24} color={COLORS.WHITE} />
                        </TouchableOpacity>

                        {isRecording && (
                            <View style={styles.timerContainer}>
                                <Text style={styles.timerText}>{recordingTimeLeft}s</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => {
                                if (isRecording) {
                                    stopCameraRecording();
                                } else {
                                    setShowCamera(false);
                                    setCameraReady(false);
                                }
                            }}
                        >
                            <Ionicons name="close" size={24} color={COLORS.WHITE} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cameraFooter}>
                        {!cameraReady ? (
                            <View style={styles.cameraLoadingContainer}>
                                <ActivityIndicator color={COLORS.WHITE} size="large" />
                                <Text style={styles.cameraLoadingText}>Camera loading...</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.recordButton, isRecording && styles.recordingButton]}
                                onPress={isRecording ? stopCameraRecording : beginCameraRecording}
                            >
                                <View style={[styles.recordButtonInner, isRecording && styles.recordingButtonInner]} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    // Main UI
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_BG} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Future Self Message</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Record a Message to Your Future Self</Text>
                    <Text style={styles.sectionSubtitle}>
                        Create a motivational message to help you stay on track when things get tough.
                    </Text>
                </View>

                {/* Message Type Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Choose your message type:</Text>
                    <View style={styles.messageTypeContainer}>
                        {[
                            { type: 'text', icon: 'document-text', label: 'Text' },
                            { type: 'voice', icon: 'mic', label: 'Voice' },
                            { type: 'video', icon: 'videocam', label: 'Video' },
                        ].map((option) => (
                            <TouchableOpacity
                                key={option.type}
                                style={[
                                    styles.messageTypeButton,
                                    messageType === option.type && styles.messageTypeButtonActive,
                                ]}
                                onPress={() => setMessageType(option.type as MessageKind)}
                            >
                                <Ionicons
                                    name={option.icon as any}
                                    size={24}
                                    color={messageType === option.type ? COLORS.WHITE : COLORS.SUBDUED}
                                />
                                <Text
                                    style={[
                                        styles.messageTypeLabel,
                                        messageType === option.type && styles.messageTypeLabelActive,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Text Message Input */}
                {messageType === 'text' && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Your message:</Text>
                        <TextInput
                            style={styles.textInput}
                            value={textMessage}
                            onChangeText={setTextMessage}
                            placeholder="Write a message to remind yourself why this journey matters..."
                            placeholderTextColor={COLORS.SUBDUED}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                        />
                    </View>
                )}

                {/* Audio/Video Recording Section */}
                {(messageType === 'voice' || messageType === 'video') && (
                    <View style={styles.section}>
                        {!recordingUri ? (
                            <View style={styles.recordingSection}>
                                <TouchableOpacity
                                    style={styles.recordButton2}
                                    onPress={messageType === 'voice' ? startAudioRecording : startVideoRecording}
                                    disabled={isRecording}
                                >
                                    <LinearGradient
                                        colors={isRecording ? [COLORS.ERROR, '#d32f2f'] : [COLORS.SUCCESS, '#45a049']}
                                        style={styles.recordButtonGradient}
                                    >
                                        <Ionicons
                                            name={messageType === 'video' ? 'videocam' : 'mic'}
                                            size={24}
                                            color={COLORS.WHITE}
                                        />
                                        <Text style={styles.recordButtonText}>
                                            {isRecording ? `Recording... ${recordingTimeLeft}s` : `Record ${messageType}`}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                {isRecording && messageType === 'voice' && (
                                    <TouchableOpacity
                                        style={styles.stopButton}
                                        onPress={stopAudioRecording}
                                    >
                                        <Ionicons name="stop" size={24} color={COLORS.WHITE} />
                                        <Text style={styles.stopButtonText}>Stop Recording</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={styles.playbackSection}>
                                <Text style={styles.label}>Your {messageType} message:</Text>

                                {messageType === 'voice' ? (
                                    <View style={styles.audioPlayer}>
                                        <TouchableOpacity
                                            style={styles.playButton}
                                            onPress={isPlaying ? stopAudio : playAudio}
                                        >
                                            <Ionicons
                                                name={isPlaying ? 'pause' : 'play'}
                                                size={24}
                                                color={COLORS.WHITE}
                                            />
                                        </TouchableOpacity>
                                        <Text style={styles.audioLabel}>
                                            {isPlaying ? 'Playing...' : 'Tap to play'}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.videoPlayer}>
                                        <Video
                                            ref={videoRef}
                                            style={styles.video}
                                            source={{ uri: recordingUri }}
                                            useNativeControls
                                            resizeMode={ResizeMode.CONTAIN}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={deleteRecording}
                                >
                                    <Ionicons name="trash" size={20} color={COLORS.ERROR} />
                                    <Text style={styles.deleteButtonText}>Delete & Re-record</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.CARD_BG,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.PURPLE_ACCENT,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 16,
        color: COLORS.SUBDUED,
        lineHeight: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 12,
    },
    messageTypeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    messageTypeButton: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        backgroundColor: COLORS.CARD_BG,
        minWidth: 80,
    },
    messageTypeButtonActive: {
        backgroundColor: COLORS.PURPLE_ACCENT,
    },
    messageTypeLabel: {
        marginTop: 8,
        fontSize: 14,
        color: COLORS.SUBDUED,
    },
    messageTypeLabelActive: {
        color: COLORS.WHITE,
    },
    textInput: {
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 12,
        padding: 16,
        color: COLORS.WHITE,
        fontSize: 16,
        minHeight: 120,
    },
    recordingSection: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    recordButton2: {
        borderRadius: 50,
        overflow: 'hidden',
        marginBottom: 16,
    },
    recordButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    recordButtonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.ERROR,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
    },
    stopButtonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    playbackSection: {
        alignItems: 'center',
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    playButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.PURPLE_ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    audioLabel: {
        fontSize: 16,
        color: COLORS.WHITE,
    },
    videoPlayer: {
        width: '100%',
        marginBottom: 16,
    },
    video: {
        width: '100%',
        height: 200,
        borderRadius: 12,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    deleteButtonText: {
        marginLeft: 8,
        fontSize: 14,
        color: COLORS.ERROR,
    },
    bottomSpacer: {
        height: 40,
    },

    // Camera styles
    cameraContainer: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
    },
    cameraHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    flipButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerContainer: {
        backgroundColor: 'rgba(255,0,0,0.8)',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    timerText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraFooter: {
        alignItems: 'center',
        paddingBottom: 50,
    },
    cameraLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    cameraLoadingText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '500',
        marginTop: 12,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingButton: {
        backgroundColor: 'rgba(255,0,0,0.8)',
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.WHITE,
    },
    recordingButtonInner: {
        backgroundColor: COLORS.ERROR,
        borderRadius: 5,
        width: 30,
        height: 30,
    },
});

export default FutureSelfRecordingSimple;
