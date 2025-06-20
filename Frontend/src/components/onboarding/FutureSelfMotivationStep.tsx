import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { Audio } from 'expo-av';

interface FutureSelfMotivationStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const FutureSelfMotivationStep: React.FC<FutureSelfMotivationStepProps> = ({ profile, updateProfile, onNext }) => {
    const [messageType, setMessageType] = useState<'text' | 'voice' | 'video'>('text');
    const [textMessage, setTextMessage] = useState<string>(profile.futureSelfMessage || '');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [showPreview, setShowPreview] = useState<boolean>(false);

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
    };

    const startRecording = async () => {
        // This would integrate with expo-av or react-native-audio-recorder-player
        // For now, we'll simulate the recording process
        setIsRecording(true);

        // Simulate recording for demo purposes
        setTimeout(() => {
            setIsRecording(false);
            setRecordingUri(`${messageType}_recording_${Date.now()}.${messageType === 'voice' ? 'm4a' : 'mp4'}`);
        }, 3000);
    };

    const stopRecording = () => {
        setIsRecording(false);
    };

    const deleteRecording = () => {
        setRecordingUri(null);
    };

    const handleSkip = async () => {
        await updateProfile({
            futureSelfMessage: null,
            futureSelfMessageType: null,
        });
        onNext();
    };

    const playRecording = async () => {
        if (recordingUri) {
            try {
                if (sound) {
                    await sound.unloadAsync();
                }

                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: recordingUri },
                    { shouldPlay: true }
                );

                setSound(newSound);
                setIsPlaying(true);

                newSound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlaying(false);
                    }
                });
            } catch (error) {
                console.error('Error playing recording:', error);
                setIsPlaying(false);
            }
        }
    };

    const stopPlaying = async () => {
        if (sound) {
            await sound.stopAsync();
            setIsPlaying(false);
        }
    };

    const togglePreview = () => {
        setShowPreview(!showPreview);
    };

    const handleSave = async () => {
        try {
            if (showPreview) {
                onNext();
                return;
            }

            if (messageType === 'text' && textMessage.trim()) {
                setShowPreview(true);
                return;
            } else if (messageType === 'voice' && recordingUri) {
                setShowPreview(true);
                return;
            }

            await updateProfile({
                futureSelfMessage: messageType === 'text' ? textMessage : '',
                futureSelfMessageType: messageType,
                futureSelfMessageUri: messageType === 'voice' ? recordingUri : null,
            } as Partial<UserProfile>);

            onNext();
        } catch (error) {
            console.error('Error saving future self message:', error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Message to Future You</Text>
                <Text style={styles.subtitle}>
                    Create a personal motivation message to help you through tough moments
                </Text>
            </View>

            {!showPreview ? (
                <>
                    <View style={styles.messageTypeContainer}>
                        <Text style={styles.sectionTitle}>Choose Message Type</Text>

                        <View style={styles.optionsContainer}>
                            {messageTypeOptions.map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[
                                        styles.optionCard,
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
                                            color={messageType === option.id ? option.color : '#777'}
                                        />
                                    </View>
                                    <Text style={[
                                        styles.optionLabel,
                                        messageType === option.id && { color: option.color }
                                    ]}>
                                        {option.label}
                                    </Text>
                                    <Text style={styles.optionDescription}>
                                        {option.description}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.messageContentContainer}>
                        <Text style={styles.sectionTitle}>Your message to your future self</Text>

                        {messageType === 'text' && (
                            <View style={styles.textInputContainer}>
                                <Text style={styles.inputLabel}>Write a motivational message</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g., Remember why you started this journey..."
                                    placeholderTextColor="#666"
                                    multiline
                                    value={textMessage}
                                    onChangeText={setTextMessage}
                                />
                            </View>
                        )}

                        {messageType === 'voice' && (
                            <View style={styles.recordingContainer}>
                                <Text style={styles.recordingTitle}>
                                    {recordingUri ? 'Recording saved!' : 'Record your voice message'}
                                </Text>

                                {!recordingUri ? (
                                    <TouchableOpacity
                                        style={[styles.recordButton, isRecording && styles.recordingActive]}
                                        onPress={isRecording ? stopRecording : startRecording}
                                    >
                                        <Ionicons
                                            name={isRecording ? 'stop' : 'mic'}
                                            size={64}
                                            color="#fff"
                                        />
                                        <Text style={styles.recordButtonText}>
                                            {isRecording ? 'Stop Recording' : 'Start Recording'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.recordingPreview}>
                                        <Text style={styles.recordingSuccess}>Recording saved successfully!</Text>

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
                            <View style={styles.comingSoonContainer}>
                                <Ionicons name="videocam" size={64} color="#666" />
                                <Text style={styles.comingSoonText}>Video messages coming soon!</Text>
                                <Text style={styles.comingSoonSubtext}>
                                    This feature is under development. Please use text or voice for now.
                                </Text>
                            </View>
                        )}
                    </View>
                </>
            ) : (
                <View style={styles.previewContainer}>
                    <Text style={styles.previewTitle}>Preview Your Message</Text>

                    {messageType === 'text' && (
                        <View style={styles.textPreviewContainer}>
                            <Text style={styles.previewLabel}>Your message to future self:</Text>
                            <View style={styles.textPreviewBox}>
                                <Text style={styles.previewText}>{textMessage}</Text>
                            </View>
                        </View>
                    )}

                    {messageType === 'voice' && (
                        <View style={styles.voicePreviewContainer}>
                            <Text style={styles.previewLabel}>Your voice message:</Text>
                            <TouchableOpacity
                                style={[styles.playPreviewButton, isPlaying && styles.playingActive]}
                                onPress={isPlaying ? stopPlaying : playRecording}
                            >
                                <Ionicons
                                    name={isPlaying ? 'stop' : 'play'}
                                    size={48}
                                    color="#fff"
                                />
                                <Text style={styles.playPreviewText}>
                                    {isPlaying ? 'Stop Playing' : 'Play Recording'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={togglePreview}
                        >
                            <Ionicons name="arrow-back" size={20} color="#fff" />
                            <Text style={styles.editButtonText}>Edit Message</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleSave}
                        >
                            <Text style={styles.confirmButtonText}>Confirm & Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
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
                            (messageType === 'voice' && !recordingUri)) &&
                        styles.saveButtonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={(messageType === 'text' && !textMessage.trim()) ||
                        (messageType === 'voice' && !recordingUri)}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.saveButtonText}>
                            {showPreview ? 'Continue' : 'Preview'}
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
    },
    deleteRecordingText: {
        color: '#ff3b30',
        marginLeft: 8,
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
    previewContainer: {
        marginBottom: 30,
    },
    previewTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 20,
    },
    textPreviewContainer: {
        marginBottom: 24,
    },
    previewLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
        marginBottom: 12,
    },
    textPreviewBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    previewText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#fff',
    },
    voicePreviewContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    playPreviewButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#28a745',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    playPreviewText: {
        color: '#fff',
        marginTop: 8,
        fontWeight: '500',
    },
    previewActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    editButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: '500',
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#0074dd',
    },
    confirmButtonText: {
        color: '#fff',
        marginRight: 8,
        fontWeight: '500',
    },
    comingSoonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: 20,
    },
    comingSoonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#aaa',
        marginTop: 16,
    },
    comingSoonSubtext: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default FutureSelfMotivationStep; 
