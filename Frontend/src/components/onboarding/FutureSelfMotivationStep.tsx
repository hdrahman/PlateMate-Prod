import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../../ThemeContext';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { Audio } from 'expo-av';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const { width } = Dimensions.get('window');

interface FutureSelfMotivationStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const FutureSelfMotivationStep: React.FC<FutureSelfMotivationStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [messageType, setMessageType] = useState<'text' | 'voice' | 'video'>(
        (profile.futureSelfMessageType as 'text' | 'voice' | 'video') || 'text'
    );
    const [textMessage, setTextMessage] = useState<string>(profile.futureSelfMessage || '');
    const [recordingUri, setRecordingUri] = useState<string | null>(
        profile.futureSelfMessageUri || null
    );
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState<boolean>(false);
    const [recordingTimeLeft, setRecordingTimeLeft] = useState<number>(30);
    const [showCamera, setShowCamera] = useState<boolean>(false);
    const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
    const [cameraReady, setCameraReady] = useState<boolean>(false);

    // Permissions
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Audio recording and playback refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const cameraRef = useRef<any>(null);
    const videoRef = useRef<Video | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingTimeRef = useRef<NodeJS.Timeout | null>(null);

    // Configure audio session on mount
    useEffect(() => {
        (async () => {
            try {
                await Audio.requestPermissionsAsync();
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });
            } catch (error) {
                console.error('Failed to configure audio:', error);
                Alert.alert('Audio Error', 'Failed to configure audio. Voice messages may not work properly.');
            }
        })();
    }, []);

    // Request camera permissions when showing camera
    useEffect(() => {
        if (showCamera && !cameraPermission?.granted) {
            requestCameraPermission();
        }
    }, [showCamera, cameraPermission?.granted, requestCameraPermission]);

    // Auto-ready camera preview after a short delay when camera view mounts
    useEffect(() => {
        if (showCamera) {
            // reset ready state
            setCameraReady(false);
            const initTimer = setTimeout(() => setCameraReady(true), 300);
            return () => clearTimeout(initTimer);
        }
    }, [showCamera]);

    const messageTypeOptions = [
        {
            id: 'text',
            label: 'Text Message',
            icon: 'document-text-outline',
            description: 'Write yourself a motivational note',
            color: '#4CAF50'
        },
        {
            id: 'voice',
            label: 'Voice Message',
            icon: 'mic-outline',
            description: 'Record your voice for future motivation',
            color: '#2196F3'
        },
        {
            id: 'video',
            label: 'Video Message',
            icon: 'videocam-outline',
            description: 'Record a video to inspire yourself',
            color: '#FF5722'
        },
    ];

    const handleMessageTypeChange = (type: 'text' | 'voice' | 'video') => {
        setMessageType(type);
        setTextMessage('');
        setRecordingUri(null);
        setIsRecording(false);
        setShowCamera(false);
        setCameraReady(false);
        setRecordingTimeLeft(30);

        // Clear any existing timers
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (recordingTimeRef.current) {
            clearInterval(recordingTimeRef.current);
            recordingTimeRef.current = null;
        }
    };

    const startTimer = () => {
        setRecordingTimeLeft(30);
        recordingTimeRef.current = setInterval(() => {
            setRecordingTimeLeft((prev) => {
                if (prev <= 1) {
                    stopRecording();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Auto-stop after 30 seconds
        timerRef.current = setTimeout(() => {
            stopRecording();
        }, 30000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (recordingTimeRef.current) {
            clearInterval(recordingTimeRef.current);
            recordingTimeRef.current = null;
        }
    };

    const startVoiceRecording = async () => {
        try {
            const permissionResponse = await Audio.requestPermissionsAsync();
            if (!permissionResponse.granted) {
                Alert.alert('Permission required', 'Microphone permission is required for voice recording.');
                return;
            }

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            recordingRef.current = recording;
            await recording.startAsync();
            setIsRecording(true);
            startTimer();
        } catch (error) {
            console.error('Failed to start voice recording:', error);
            Alert.alert('Recording Error', 'Failed to start voice recording. Please try again.');
        }
    };

    const startVideoRecording = async () => {
        try {
            // Request camera permission
            const cameraResult = await requestCameraPermission();
            if (!cameraResult.granted) {
                Alert.alert('Permission required', 'Camera permission is required for video recording.');
                return;
            }

            // Request microphone permission via Audio API
            const micResult = await Audio.requestPermissionsAsync();
            if (!micResult.granted) {
                Alert.alert('Permission required', 'Microphone permission is required for video recording.');
                return;
            }

            // Clear any previous recording
            setRecordingUri(null);

            // Set camera to selfie mode explicitly
            setCameraFacing('front');

            // Show camera with permissions granted
            setShowCamera(true);
        } catch (error) {
            console.error('Failed to start video recording:', error);
            Alert.alert('Recording Error', 'Failed to start video recording. Please try again.');
        }
    };

    const startCameraRecording = async () => {
        try {
            if (cameraRef.current && !isRecording) {
                setIsRecording(true);
                startTimer();

                const video = await cameraRef.current.recordAsync({
                    maxDuration: 30,
                });

                if (video) {
                    // Save to permanent location
                    const fileName = `video_message_${Date.now()}.mp4`;
                    const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
                    await FileSystem.copyAsync({ from: video.uri, to: permanentUri });
                    setRecordingUri(permanentUri);
                    setIsRecording(false);
                    setShowCamera(false);
                    stopTimer();
                }
            }
        } catch (error) {
            console.error('Failed to record video:', error);
            Alert.alert('Recording Error', 'Failed to record video. Please try again.');
            setIsRecording(false);
            setShowCamera(false);
            stopTimer();
        }
    };

    const stopCameraRecording = async () => {
        try {
            if (cameraRef.current && isRecording) {
                await cameraRef.current.stopRecording();
            }
        } catch (error) {
            console.error('Failed to stop camera recording:', error);
        }
    };

    const stopRecording = async () => {
        try {
            stopTimer();
            setIsRecording(false);

            if (messageType === 'voice') {
                await recordingRef.current?.stopAndUnloadAsync();
                const uri = recordingRef.current?.getURI();
                if (uri) {
                    // Save to permanent location
                    const fileName = `voice_message_${Date.now()}.m4a`;
                    const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
                    await FileSystem.copyAsync({ from: uri, to: permanentUri });
                    setRecordingUri(permanentUri);
                }
            } else if (messageType === 'video' && cameraRef.current) {
                await cameraRef.current.stopRecording();
                setShowCamera(false);
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
            Alert.alert('Recording Error', 'Failed to stop recording. Please try again.');
        }
    };

    const deleteRecording = async () => {
        try {
            if (recordingUri) {
                // Delete the file from storage
                const fileInfo = await FileSystem.getInfoAsync(recordingUri);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(recordingUri);
                }
            }
            setRecordingUri(null);
        } catch (error) {
            console.error('Failed to delete recording:', error);
        }
    };

    const playRecording = async () => {
        try {
            if (recordingUri && messageType === 'voice') {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: recordingUri },
                    { shouldPlay: true }
                );
                soundRef.current = sound;
                setIsPlaying(true);

                // Monitor playback status
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
                        setIsPlaying(false);
                    }
                });
            }
        } catch (error) {
            console.error('Error playing recording:', error);
            setIsPlaying(false);
        }
    };

    const stopPlaying = async () => {
        try {
            await soundRef.current?.pauseAsync();
            setIsPlaying(false);
        } catch (error) {
            console.error('Error stopping playback:', error);
        }
    };

    const handleSkip = async () => {
        await updateProfile({
            futureSelfMessage: null,
            futureSelfMessageType: null,
        });
        onNext();
    };

    const handleSave = async () => {
        try {
            await updateProfile({
                futureSelfMessage: messageType === 'text' ? textMessage : '',
                futureSelfMessageType: messageType,
                futureSelfMessageUri: (messageType === 'voice' || messageType === 'video') ? recordingUri : null,
            } as Partial<UserProfile>);

            onNext();
        } catch (error) {
            console.error('Error saving future self message:', error);
        }
    };

    // Persist data when message content changes
    useEffect(() => {
        // Only persist if user has started entering data
        if (messageType === 'text' && textMessage.trim().length > 0) {
            updateProfile({
                futureSelfMessage: textMessage,
                futureSelfMessageType: 'text',
            }).catch(() => { });
        } else if ((messageType === 'voice' || messageType === 'video') && recordingUri) {
            updateProfile({
                futureSelfMessage: '',
                futureSelfMessageType: messageType,
                futureSelfMessageUri: recordingUri,
            }).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messageType, textMessage, recordingUri]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            stopTimer();
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const playVideoMessage = () => {
        setShowVideoPlayer(true);
        setIsVideoPlaying(true);
    };

    const closeVideoPlayer = () => {
        setShowVideoPlayer(false);
        setIsVideoPlaying(false);
        if (videoRef.current) {
            videoRef.current.pauseAsync();
        }
    };

    const handleVideoPlaybackStatusUpdate = (status: any) => {
        if (status.didJustFinish) {
            setIsVideoPlaying(false);
        }
    };

    if (showCamera) {
        // Determine if we have permission to show the camera
        const hasCameraPermission = cameraPermission?.granted;
        // If permission not granted yet – show friendly UI to request it
        if (!hasCameraPermission) {
            return (
                <View style={styles.cameraPermissionContainer}>
                    <Text style={styles.cameraPermissionText}>We need your permission to access the camera</Text>
                    <TouchableOpacity style={styles.cameraPermissionButton} onPress={requestCameraPermission}>
                        <Text style={styles.cameraPermissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cameraPermissionButton, { marginTop: 20 }]} onPress={() => setShowCamera(false)}>
                        <Text style={styles.cameraPermissionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={cameraFacing}
                    active={true}
                    mode="video"
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={(error) => {
                        console.error('Camera mount error:', error);
                        Alert.alert('Camera Error', 'Failed to initialize camera. Please try again.');
                        setShowCamera(false);
                    }}
                />

                <View style={styles.cameraOverlay}>
                    {/* Top Controls */}
                    <View style={styles.cameraTopBar}>
                        <TouchableOpacity
                            style={styles.cameraCloseButton}
                            onPress={() => {
                                if (isRecording) {
                                    stopCameraRecording();
                                }
                                setIsRecording(false);
                                setShowCamera(false);
                                setCameraReady(false);
                                stopTimer();
                            }}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>

                        {isRecording && (
                            <View style={styles.timerContainer}>
                                <View style={[styles.recordingIndicator, styles.recordingActive]} />
                                <Text style={styles.timerText}>
                                    {recordingTimeLeft}s
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.cameraFlipButton}
                            onPress={() => setCameraFacing(current => current === 'back' ? 'front' : 'back')}
                            disabled={isRecording}
                        >
                            <Ionicons name="camera-reverse" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Controls */}
                    <View style={styles.cameraBottomBar}>
                        {!cameraReady ? (
                            <View style={styles.cameraLoadingContainer}>
                                <Text style={styles.cameraLoadingText}>Initializing camera...</Text>
                            </View>
                        ) : (
                            <>
                                {!isRecording ? (
                                    <TouchableOpacity
                                        style={styles.modernRecordButton}
                                        onPress={startCameraRecording}
                                    >
                                        <LinearGradient
                                            colors={['#FF5722', '#E64A19']}
                                            style={styles.recordButtonGradient}
                                        >
                                            <Ionicons
                                                name="videocam"
                                                size={64}
                                                color="#fff"
                                            />
                                        </LinearGradient>
                                        <Text style={styles.modernRecordButtonText}>
                                            Start Video Recording
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.modernRecordButton}
                                        onPress={stopCameraRecording}
                                    >
                                        <LinearGradient
                                            colors={['#ff3b30', '#d32f2f']}
                                            style={styles.recordButtonGradient}
                                        >
                                            <Ionicons
                                                name="stop"
                                                size={64}
                                                color="#fff"
                                            />
                                        </LinearGradient>
                                        <Text style={styles.modernRecordButtonText}>
                                            Stop Recording
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <Text style={styles.recordingInstructions}>
                                    {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
                                </Text>
                            </>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Message to Future You</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Create a personal motivation message to help you through tough moments
                </Text>
            </View>

            <View style={styles.messageTypeContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose Message Type</Text>

                <View style={styles.optionsContainer}>
                    {messageTypeOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionCard,
                                { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border },
                                messageType === option.id && styles.selectedOption,
                                messageType === option.id && { borderColor: option.color }
                            ]}
                            onPress={() => handleMessageTypeChange(option.id as 'text' | 'voice' | 'video')}
                        >
                            <View style={[
                                styles.optionIconContainer,
                                { backgroundColor: `${option.color}20` },
                                messageType === option.id && { backgroundColor: `${option.color}30` }
                            ]}>
                                <Ionicons
                                    name={option.icon as any}
                                    size={32}
                                    color={messageType === option.id ? option.color : theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={[
                                styles.optionLabel,
                                { color: theme.colors.text },
                                messageType === option.id && { color: option.color }
                            ]}>
                                {option.label}
                            </Text>
                            <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                                {option.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.messageContentContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your message to your future self</Text>

                {messageType === 'text' && (
                    <View style={styles.textInputContainer}>
                        <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Write a motivational message</Text>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="e.g., Remember why you started this journey..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            value={textMessage}
                            onChangeText={setTextMessage}
                        />
                    </View>
                )}

                {messageType === 'voice' && (
                    <View style={styles.recordingContainer}>
                        <Text style={[styles.recordingTitle, { color: theme.colors.text }]}>
                            {recordingUri ? 'Voice message recorded!' : 'Record your voice message (max 30 seconds)'}
                        </Text>

                        {isRecording && (
                            <View style={styles.recordingStatusContainer}>
                                <View style={[styles.recordingIndicator, styles.recordingActive]} />
                                <Text style={[styles.recordingStatusText, { color: theme.colors.textSecondary }]}>
                                    Recording... {recordingTimeLeft}s left
                                </Text>
                            </View>
                        )}

                        {!recordingUri ? (
                            <View style={styles.recordingButtons}>
                                {!isRecording ? (
                                    <TouchableOpacity
                                        style={styles.modernRecordButton}
                                        onPress={startVoiceRecording}
                                    >
                                        <LinearGradient
                                            colors={['#2196F3', '#1976D2']}
                                            style={styles.recordButtonGradient}
                                        >
                                            <Ionicons
                                                name="mic"
                                                size={64}
                                                color="#fff"
                                            />
                                        </LinearGradient>
                                        <Text style={styles.modernRecordButtonText}>
                                            Start Recording
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.modernRecordButton}
                                        onPress={stopRecording}
                                    >
                                        <LinearGradient
                                            colors={['#ff3b30', '#d32f2f']}
                                            style={styles.recordButtonGradient}
                                        >
                                            <Ionicons
                                                name="stop"
                                                size={64}
                                                color="#fff"
                                            />
                                        </LinearGradient>
                                        <Text style={styles.modernRecordButtonText}>
                                            Stop Recording
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <View style={styles.recordingPreview}>
                                <Text style={styles.recordingSuccess}>Voice message saved successfully!</Text>

                                <TouchableOpacity
                                    style={[styles.playButton, isPlaying && styles.playingActive]}
                                    onPress={isPlaying ? stopPlaying : playRecording}
                                >
                                    <Ionicons
                                        name={isPlaying ? 'stop' : 'play'}
                                        size={48}
                                        color="#fff"
                                    />
                                    <Text style={styles.playButtonText}>
                                        {isPlaying ? 'Stop Playing' : 'Play Recording'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteRecordingButton}
                                    onPress={deleteRecording}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                                    <Text style={styles.deleteRecordingText}>Delete & Re-record</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {messageType === 'video' && (
                    <View style={styles.recordingContainer}>
                        <Text style={styles.recordingTitle}>
                            {recordingUri ? 'Video message recorded!' : 'Record your video message (max 30 seconds)'}
                        </Text>

                        {isRecording && (
                            <View style={styles.recordingStatusContainer}>
                                <View style={[styles.recordingIndicator, styles.recordingActive]} />
                                <Text style={styles.recordingStatusText}>
                                    Recording... {recordingTimeLeft}s left
                                </Text>
                            </View>
                        )}

                        {!recordingUri ? (
                            <TouchableOpacity
                                style={styles.modernRecordButton}
                                onPress={startVideoRecording}
                                disabled={isRecording}
                            >
                                <LinearGradient
                                    colors={['#FF5722', '#E64A19']}
                                    style={styles.recordButtonGradient}
                                >
                                    <Ionicons
                                        name="videocam"
                                        size={64}
                                        color="#fff"
                                    />
                                </LinearGradient>
                                <Text style={styles.modernRecordButtonText}>
                                    Start Video Recording
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.recordingPreview}>
                                <Text style={styles.recordingSuccess}>Video message saved successfully!</Text>

                                <TouchableOpacity
                                    style={styles.videoPreviewButton}
                                    onPress={playVideoMessage}
                                >
                                    <LinearGradient
                                        colors={['#FF5722', '#E64A19']}
                                        style={styles.videoPreviewGradient}
                                    >
                                        <Ionicons name="play" size={48} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.videoPreviewText}>Preview Video</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteRecordingButton}
                                    onPress={deleteRecording}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                                    <Text style={styles.deleteRecordingText}>Delete & Re-record</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Video Player Modal */}
            {showVideoPlayer && recordingUri && messageType === 'video' && (
                <View style={styles.videoPlayerModal}>
                    <Video
                        ref={videoRef}
                        style={styles.videoPlayer}
                        source={{ uri: recordingUri }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay={isVideoPlaying}
                        isLooping={false}
                        onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
                    />
                    <TouchableOpacity
                        style={styles.closeVideoButton}
                        onPress={closeVideoPlayer}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#888" />
                <Text style={styles.infoText}>
                    This message will be shown to you during tough moments to help you stay motivated.
                </Text>
            </View>

            <View style={styles.buttonsContainer}>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        ((messageType === 'text' && !textMessage.trim()) ||
                            ((messageType === 'voice' || messageType === 'video') && !recordingUri)) &&
                        styles.saveButtonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={(messageType === 'text' && !textMessage.trim()) ||
                        ((messageType === 'voice' || messageType === 'video') && !recordingUri)}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.saveButtonText}>
                            Continue
                        </Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 20,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        lineHeight: 22,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    messageTypeContainer: {
        marginBottom: 30,
    },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    optionCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 6,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedOption: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    optionIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 6,
    },
    optionDescription: {
        fontSize: 12,
        color: '#aaa',
        textAlign: 'center',
    },
    messageContentContainer: {
        marginBottom: 30,
    },
    textInputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 150,
        textAlignVertical: 'top',
    },
    recordingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    recordingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    recordingStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    recordingIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#666',
        marginRight: 8,
    },
    recordingStatusText: {
        color: '#ff3b30',
        fontSize: 14,
        fontWeight: '600',
    },
    recordButton: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#0074dd',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingActive: {
        backgroundColor: '#ff3b30',
    },
    recordButtonText: {
        color: '#fff',
        marginTop: 8,
        fontWeight: '500',
    },
    recordingPreview: {
        alignItems: 'center',
    },
    recordingSuccess: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 16,
    },
    deleteRecordingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderRadius: 8,
        marginTop: 12,
    },
    deleteRecordingText: {
        color: '#ff3b30',
        marginLeft: 8,
        fontWeight: '500',
    },
    playButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#28a745',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    playingActive: {
        backgroundColor: '#ff3b30',
    },
    playButtonText: {
        color: '#fff',
        marginTop: 8,
        fontWeight: '500',
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginHorizontal: 20,
    },
    infoText: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 12,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 20,
    },
    skipButton: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButtonText: {
        color: '#aaa',
        fontSize: 16,
        fontWeight: '500',
    },
    saveButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        marginLeft: 16,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    videoPlayerModal: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    videoPlayer: {
        width: '90%',
        height: '60%',
        backgroundColor: '#000',
    },
    closeVideoButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
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
    cameraTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    cameraBottomBar: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    cameraCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    timerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    cameraFlipButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    cameraLoadingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    modernRecordButton: {
        alignItems: 'center',
        marginBottom: 16,
    },
    recordButtonGradient: {
        width: 150,
        height: 150,
        borderRadius: 75,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modernRecordButtonText: {
        color: '#fff',
        marginTop: 12,
        fontWeight: '600',
        fontSize: 16,
    },
    recordingInstructions: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 8,
    },
    recordingButtons: {
        alignItems: 'center',
    },
    recordIcon: {
        position: 'absolute',
    },
    videoPreviewButton: {
        alignItems: 'center',
        marginVertical: 20,
    },
    videoPreviewGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    videoPreviewText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginTop: 12,
    },
    videoPathText: {
        color: '#888',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    cameraPermissionContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    cameraPermissionText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
    },
    cameraPermissionButton: {
        backgroundColor: '#0074dd',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    cameraPermissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default FutureSelfMotivationStep; 
