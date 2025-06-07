import React, { useState } from 'react';
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

interface FutureSelfMotivationStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const motivationTemplates = [
    {
        id: 'tough_times',
        title: 'For Tough Times',
        template: 'Hey future me, remember why you started this journey. When things get hard, remember that every small step counts and you\'re stronger than you think.',
        icon: 'shield-outline'
    },
    {
        id: 'temptation',
        title: 'During Temptation',
        template: 'When you\'re tempted to give up on healthy choices, remember how amazing you felt when you stuck to your goals. You deserve to feel that good every day.',
        icon: 'flash-outline'
    },
    {
        id: 'progress',
        title: 'Celebrating Progress',
        template: 'Look how far you\'ve come! Every healthy choice you made led to this moment. Be proud of your dedication and keep going.',
        icon: 'trophy-outline'
    },
    {
        id: 'motivation',
        title: 'Daily Motivation',
        template: 'You are capable of incredible things. Your health journey is not just about your body, but about proving to yourself that you can achieve anything you set your mind to.',
        icon: 'heart-outline'
    }
];

const FutureSelfMotivationStep: React.FC<FutureSelfMotivationStepProps> = ({ profile, updateProfile, onNext }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);

    const handleTemplateSelect = (templateId: string) => {
        const template = motivationTemplates.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(templateId);
            setCustomMessage(template.template);
            setIsCustomMode(false);
        }
    };

    const handleCustomMode = () => {
        setIsCustomMode(true);
        setSelectedTemplate(null);
        setCustomMessage('');
    };

    const handleSkip = async () => {
        await updateProfile({
            futureSelfMessage: null,
            futureSelfMessageType: null,
        });
        onNext();
    };

    const handleSave = async () => {
        if (!customMessage.trim()) {
            Alert.alert('Message Required', 'Please write a message for your future self');
            return;
        }

        await updateProfile({
            futureSelfMessage: customMessage.trim(),
            futureSelfMessageType: selectedTemplate || 'custom',
            futureSelfMessageCreatedAt: new Date().toISOString(),
        });

        Alert.alert(
            'Message Saved! 💝',
            'Your message has been saved and will be available as your personal motivation tool whenever you need it.',
            [{ text: 'Continue', onPress: onNext }]
        );
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Ionicons name="mail-outline" size={32} color="#FFD700" />
                <Text style={styles.title}>Message to Future You</Text>
                <Text style={styles.subtitle}>
                    Leave yourself a personal motivation message for tough moments on your journey
                </Text>
            </View>

            <View style={styles.benefitsContainer}>
                <Text style={styles.benefitsTitle}>Your Personal Panic Button</Text>
                <View style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.benefitText}>Available during difficult days</Text>
                </View>
                <View style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.benefitText}>Reminds you of your "why"</Text>
                </View>
                <View style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.benefitText}>Personalized encouragement</Text>
                </View>
            </View>

            {!isCustomMode && (
                <View style={styles.templatesSection}>
                    <Text style={styles.sectionTitle}>Choose a Template</Text>
                    <Text style={styles.sectionSubtitle}>Or scroll down to write your own</Text>

                    {motivationTemplates.map((template) => (
                        <TouchableOpacity
                            key={template.id}
                            style={[
                                styles.templateCard,
                                selectedTemplate === template.id && styles.selectedTemplate
                            ]}
                            onPress={() => handleTemplateSelect(template.id)}
                        >
                            <View style={styles.templateHeader}>
                                <Ionicons
                                    name={template.icon as any}
                                    size={24}
                                    color={selectedTemplate === template.id ? '#0074dd' : '#999'}
                                />
                                <Text style={[
                                    styles.templateTitle,
                                    selectedTemplate === template.id && styles.selectedTemplateTitle
                                ]}>
                                    {template.title}
                                </Text>
                            </View>
                            <Text style={[
                                styles.templateText,
                                selectedTemplate === template.id && styles.selectedTemplateText
                            ]}>
                                {template.template}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.customSection}>
                <Text style={styles.sectionTitle}>
                    {isCustomMode ? 'Your Personal Message' : 'Or Write Your Own'}
                </Text>

                {!isCustomMode && (
                    <TouchableOpacity
                        style={styles.customButton}
                        onPress={handleCustomMode}
                    >
                        <Ionicons name="create-outline" size={20} color="#0074dd" />
                        <Text style={styles.customButtonText}>Write Custom Message</Text>
                    </TouchableOpacity>
                )}

                {(isCustomMode || selectedTemplate) && (
                    <View style={styles.messageContainer}>
                        <TextInput
                            style={styles.messageInput}
                            placeholder="Write a message to your future self..."
                            placeholderTextColor="#666"
                            value={customMessage}
                            onChangeText={setCustomMessage}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                        />
                        <Text style={styles.characterCount}>{customMessage.length}/500</Text>
                    </View>
                )}
            </View>

            <View style={styles.exampleContainer}>
                <Text style={styles.exampleTitle}>💡 Example Messages</Text>
                <Text style={styles.exampleText}>
                    "Remember that feeling when you decided to change your life? That strength is still in you."
                </Text>
                <Text style={styles.exampleText}>
                    "You've overcome challenges before. This is just another one you'll conquer."
                </Text>
            </View>

            <View style={styles.actionContainer}>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip This Step</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.saveButton, (!customMessage.trim()) && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={!customMessage.trim()}
                >
                    <LinearGradient
                        colors={customMessage.trim() ? ["#0074dd", "#5c00dd", "#dd0095"] : ["#666", "#666"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        <Ionicons name="heart" size={20} color="#fff" />
                        <Text style={styles.saveButtonText}>Save My Message</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View style={styles.privacyNote}>
                <Ionicons name="lock-closed-outline" size={16} color="#999" />
                <Text style={styles.privacyText}>
                    Your message is private and only accessible by you
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
        lineHeight: 24,
    },
    benefitsContainer: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 32,
    },
    benefitsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFD700',
        marginBottom: 12,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    benefitText: {
        color: '#fff',
        fontSize: 14,
        marginLeft: 12,
    },
    templatesSection: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 16,
    },
    templateCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedTemplate: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    templateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 12,
    },
    selectedTemplateTitle: {
        color: '#0074dd',
    },
    templateText: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 20,
    },
    selectedTemplateText: {
        color: '#fff',
    },
    customSection: {
        marginBottom: 24,
    },
    customButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#0074dd',
        marginBottom: 16,
    },
    customButtonText: {
        color: '#0074dd',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    messageContainer: {
        marginTop: 16,
    },
    messageInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 150,
        maxHeight: 200,
    },
    characterCount: {
        color: '#999',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 8,
    },
    exampleContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 32,
    },
    exampleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFD700',
        marginBottom: 12,
    },
    exampleText: {
        fontSize: 14,
        color: '#aaa',
        fontStyle: 'italic',
        marginBottom: 8,
        lineHeight: 20,
    },
    actionContainer: {
        gap: 12,
    },
    skipButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    skipText: {
        color: '#999',
        fontSize: 16,
    },
    saveButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    disabledButton: {
        opacity: 0.5,
    },
    saveButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    privacyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    privacyText: {
        color: '#999',
        fontSize: 12,
        marginLeft: 8,
    },
});

export default FutureSelfMotivationStep; 