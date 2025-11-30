import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';
import { createFeatureRequest, FeatureRequestCreate } from '../api/features';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Draft storage key
const DRAFT_STORAGE_KEY = 'feature_request_draft';

// Character limits
const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;
const TITLE_MIN_LENGTH = 3;
const DESCRIPTION_MIN_LENGTH = 10;

// Guidelines for good feature requests
const GUIDELINES = [
    "Be specific about the problem you're trying to solve",
    "Describe how this feature would benefit you and other users",
    "Include examples or use cases when possible",
    "Search existing requests to avoid duplicates",
    "Keep it focused - one feature per request"
];

const GuidelineItem: React.FC<{ text: string; index: number; theme: any }> = ({ text, index, theme }) => (
    <View style={styles.guidelineItem}>
        <View style={[styles.guidelineNumber, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.guidelineNumberText, { color: theme.colors.text }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.guidelineText, { color: theme.colors.textSecondary }]}>{text}</Text>
    </View>
);

const CharacterCounter: React.FC<{
    current: number;
    max: number;
    min?: number;
    showMin?: boolean;
    theme: any;
}> = ({ current, max, min = 0, showMin = false, theme }) => {
    const isOverLimit = current > max;
    const isUnderMin = showMin && current < min;
    const percentage = (current / max) * 100;

    return (
        <View style={styles.characterCounterContainer}>
            <View style={[styles.characterCounterBar, { backgroundColor: theme.colors.border }]}>
                <View
                    style={[
                        styles.characterCounterFill,
                        {
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: isOverLimit ? theme.colors.error : isUnderMin ? '#FF9500' : theme.colors.primary
                        }
                    ]}
                />
            </View>
            <Text style={[
                styles.characterCounterText,
                { color: theme.colors.textSecondary },
                isOverLimit && { color: theme.colors.error },
                isUnderMin && styles.characterCounterTextWarning
            ]}>
                {current} / {max}
                {showMin && current < min && ` (min ${min})`}
            </Text>
        </View>
    );
};

const CreateFeatureRequestScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGuidelines, setShowGuidelines] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Refs
    const titleInputRef = useRef<TextInput>(null);
    const descriptionInputRef = useRef<TextInput>(null);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load draft on mount
    useEffect(() => {
        loadDraft();
    }, []);

    // Auto-save changes
    useEffect(() => {
        if (title || description) {
            setHasUnsavedChanges(true);

            // Clear existing timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            // Set new timeout for auto-save
            autoSaveTimeoutRef.current = setTimeout(() => {
                saveDraft();
            }, 2000); // Auto-save after 2 seconds of inactivity
        }

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [title, description]);

    // Load draft from storage
    const loadDraft = useCallback(async () => {
        try {
            const draftJson = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
            if (draftJson) {
                const draft = JSON.parse(draftJson);
                setTitle(draft.title || '');
                setDescription(draft.description || '');
                setHasUnsavedChanges(true);
            }
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }, []);

    // Save draft to storage
    const saveDraft = useCallback(async () => {
        try {
            if (title.trim() || description.trim()) {
                const draft = { title: title.trim(), description: description.trim() };
                await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
            }
        } catch (error) {
            console.error('Error saving draft:', error);
        }
    }, [title, description]);

    // Clear draft from storage
    const clearDraft = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error clearing draft:', error);
        }
    }, []);

    // Validation
    const isFormValid = useCallback(() => {
        const trimmedTitle = title.trim();
        const trimmedDescription = description.trim();

        return (
            trimmedTitle.length >= TITLE_MIN_LENGTH &&
            trimmedTitle.length <= TITLE_MAX_LENGTH &&
            trimmedDescription.length >= DESCRIPTION_MIN_LENGTH &&
            trimmedDescription.length <= DESCRIPTION_MAX_LENGTH
        );
    }, [title, description]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        if (hasUnsavedChanges && (title.trim() || description.trim())) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. What would you like to do?',
                [
                    {
                        text: 'Save Draft',
                        onPress: async () => {
                            await saveDraft();
                            navigation.goBack();
                        }
                    },
                    {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: async () => {
                            await clearDraft();
                            navigation.goBack();
                        }
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    }
                ]
            );
        } else {
            navigation.goBack();
        }
    }, [hasUnsavedChanges, title, description, navigation, saveDraft, clearDraft]);

    // Handle form submission
    const handleSubmit = useCallback(async () => {
        if (!isFormValid() || isSubmitting) return;

        const trimmedTitle = title.trim();
        const trimmedDescription = description.trim();

        if (!user) {
            Alert.alert('Error', 'You must be logged in to submit a feature request.');
            return;
        }

        setIsSubmitting(true);

        try {
            const requestData: FeatureRequestCreate = {
                title: trimmedTitle,
                description: trimmedDescription
            };

            const result = await createFeatureRequest(requestData);

            if (result.success) {
                // Clear draft and form
                await clearDraft();
                setTitle('');
                setDescription('');

                Alert.alert(
                    'Success!',
                    'Your feature request has been submitted successfully. Thank you for your feedback!',
                    [
                        {
                            text: 'View Requests',
                            onPress: () => {
                                navigation.navigate('FeatureRequests');
                            }
                        },
                        {
                            text: 'Create Another',
                            onPress: () => {
                                // Stay on current screen
                            }
                        }
                    ]
                );
            } else {
                throw new Error(result.message || 'Failed to submit feature request');
            }
        } catch (error) {
            console.error('Error submitting feature request:', error);

            // Provide specific error messages based on error type
            let errorTitle = 'Submission Failed';
            let errorMessage = 'An error occurred while submitting your request. Please try again.';

            if (error instanceof Error) {
                const errorStr = error.message.toLowerCase();

                if (errorStr.includes('authentication error') || errorStr.includes('user not properly registered')) {
                    errorTitle = 'Authentication Issue';
                    errorMessage = 'There was an authentication problem. Please try logging out and back in, then try again.';
                } else if (errorStr.includes('foreign key constraint') || errorStr.includes('constraint')) {
                    errorTitle = 'Account Setup Required';
                    errorMessage = 'Your account needs to be properly set up in our system. Please contact support or try again later.';
                } else if (errorStr.includes('permission denied')) {
                    errorTitle = 'Permission Error';
                    errorMessage = 'You don\'t have permission to submit feature requests. Please check your account status.';
                } else if (errorStr.includes('network') || errorStr.includes('connection')) {
                    errorTitle = 'Connection Error';
                    errorMessage = 'Please check your internet connection and try again.';
                } else if (errorStr.includes('validation') || errorStr.includes('invalid')) {
                    errorTitle = 'Validation Error';
                    errorMessage = 'Please check that your title and description meet the requirements and try again.';
                } else {
                    errorMessage = error.message;
                }
            }

            Alert.alert(errorTitle, errorMessage, [
                { text: 'OK' },
                ...(errorTitle === 'Authentication Issue' ? [{
                    text: 'Logout & Login',
                    onPress: () => {
                        // Note: You would need to implement logout functionality
                        // For now, just show a message
                        Alert.alert('Logout Required', 'Please manually logout and login again from the settings menu.');
                    }
                }] : [])
            ]);
        } finally {
            setIsSubmitting(false);
        }
    }, [isFormValid, isSubmitting, title, description, user, clearDraft, navigation]);

    // Handle clear form
    const handleClearForm = useCallback(() => {
        Alert.alert(
            'Clear Form',
            'Are you sure you want to clear all content? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        setTitle('');
                        setDescription('');
                        await clearDraft();
                        Keyboard.dismiss();
                    }
                }
            ]
        );
    }, [clearDraft]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "left", "right"]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Feature Request</Text>
                <TouchableOpacity
                    onPress={handleClearForm}
                    style={[styles.clearButton, (!title && !description) && styles.clearButtonDisabled]}
                    disabled={!title && !description}
                >
                    <Ionicons name="trash-outline" size={24} color={(!title && !description) ? theme.colors.textSecondary : theme.colors.error} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Guidelines Section */}
                    {showGuidelines && (
                        <LinearGradient
                            colors={[`${theme.colors.primary}15`, `${theme.colors.primary}05`]}
                            style={[styles.guidelinesContainer, { borderColor: `${theme.colors.primary}30` }]}
                        >
                            <View style={styles.guidelinesHeader}>
                                <View style={styles.guidelinesHeaderLeft}>
                                    <Ionicons name="bulb-outline" size={20} color={theme.colors.primary} />
                                    <Text style={[styles.guidelinesTitle, { color: theme.colors.primary }]}>Writing Great Feature Requests</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowGuidelines(false)}>
                                    <Ionicons name="close-outline" size={20} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {GUIDELINES.map((guideline, index) => (
                                <GuidelineItem key={index} text={guideline} index={index} theme={theme} />
                            ))}
                        </LinearGradient>
                    )}

                    {/* Form Section */}
                    <View style={styles.formContainer}>
                        {/* Title Input */}
                        <View style={styles.inputContainer}>
                            <View style={styles.inputHeader}>
                                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                                    Title <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
                                </Text>
                                <CharacterCounter
                                    current={title.length}
                                    max={TITLE_MAX_LENGTH}
                                    min={TITLE_MIN_LENGTH}
                                    showMin={title.length > 0}
                                    theme={theme}
                                />
                            </View>

                            <LinearGradient
                                colors={[theme.colors.inputBackground || theme.colors.cardBackground, theme.colors.cardBackground]}
                                style={[
                                    styles.inputWrapper,
                                    { borderColor: theme.colors.border },
                                    title.length > TITLE_MAX_LENGTH && { borderColor: theme.colors.error }
                                ]}
                            >
                                <TextInput
                                    ref={titleInputRef}
                                    style={[styles.titleInput, { color: theme.colors.text }]}
                                    placeholder="What feature would you like to see?"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={title}
                                    onChangeText={setTitle}
                                    maxLength={TITLE_MAX_LENGTH + 50} // Allow some overflow for UX
                                    multiline={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => descriptionInputRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                            </LinearGradient>

                            {title.length > 0 && title.length < TITLE_MIN_LENGTH && (
                                <Text style={styles.validationHint}>
                                    Title must be at least {TITLE_MIN_LENGTH} characters
                                </Text>
                            )}
                        </View>

                        {/* Description Input */}
                        <View style={styles.inputContainer}>
                            <View style={styles.inputHeader}>
                                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                                    Description <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
                                </Text>
                                <CharacterCounter
                                    current={description.length}
                                    max={DESCRIPTION_MAX_LENGTH}
                                    min={DESCRIPTION_MIN_LENGTH}
                                    showMin={description.length > 0}
                                    theme={theme}
                                />
                            </View>

                            <LinearGradient
                                colors={[theme.colors.inputBackground || theme.colors.cardBackground, theme.colors.cardBackground]}
                                style={[
                                    styles.inputWrapper,
                                    styles.descriptionWrapper,
                                    { borderColor: theme.colors.border },
                                    description.length > DESCRIPTION_MAX_LENGTH && { borderColor: theme.colors.error }
                                ]}
                            >
                                <TextInput
                                    ref={descriptionInputRef}
                                    style={[styles.descriptionInput, { color: theme.colors.text }]}
                                    placeholder="Describe the feature in detail. What problem does it solve? How would it work? Who would benefit from it?"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={description}
                                    onChangeText={setDescription}
                                    maxLength={DESCRIPTION_MAX_LENGTH + 100} // Allow some overflow for UX
                                    multiline={true}
                                    numberOfLines={8}
                                    textAlignVertical="top"
                                />
                            </LinearGradient>

                            {description.length > 0 && description.length < DESCRIPTION_MIN_LENGTH && (
                                <Text style={styles.validationHint}>
                                    Description must be at least {DESCRIPTION_MIN_LENGTH} characters
                                </Text>
                            )}
                        </View>

                        {/* Auto-save indicator */}
                        {hasUnsavedChanges && (
                            <View style={styles.autoSaveIndicator}>
                                <Ionicons name="cloud-outline" size={14} color={theme.colors.textSecondary} />
                                <Text style={[styles.autoSaveText, { color: theme.colors.textSecondary }]}>Draft saved automatically</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Submit Button */}
                <View style={[styles.submitContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            !isFormValid() && styles.submitButtonDisabled,
                            isSubmitting && styles.submitButtonSubmitting
                        ]}
                        onPress={handleSubmit}
                        disabled={!isFormValid() || isSubmitting}
                    >
                        <LinearGradient
                            colors={
                                isFormValid() && !isSubmitting
                                    ? [theme.colors.primary, '#7000FF']
                                    : [theme.colors.border, theme.colors.cardBackground]
                            }
                            style={styles.submitButtonGradient}
                        >
                            {isSubmitting ? (
                                <View style={styles.submitButtonContent}>
                                    <ActivityIndicator size="small" color={theme.colors.text} />
                                    <Text style={[styles.submitButtonTextSubmitting, { color: theme.colors.text }]}>Submitting...</Text>
                                </View>
                            ) : (
                                <View style={styles.submitButtonContent}>
                                    <Ionicons name="send-outline" size={20} color={theme.colors.text} />
                                    <Text style={[styles.submitButtonText, { color: theme.colors.text }]}>Submit Feature Request</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    clearButton: {
        padding: 5,
    },
    clearButtonDisabled: {
        opacity: 0.3,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    guidelinesContainer: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
    },
    guidelinesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    guidelinesHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    guidelinesTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    guidelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    guidelineNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    guidelineNumberText: {
        fontSize: 12,
        fontWeight: '700',
    },
    guidelineText: {
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
    formContainer: {
        gap: 24,
    },
    inputContainer: {
        gap: 8,
    },
    inputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    required: {
    },
    characterCounterContainer: {
        alignItems: 'flex-end',
        gap: 4,
    },
    characterCounterBar: {
        width: 60,
        height: 2,
        borderRadius: 1,
        overflow: 'hidden',
    },
    characterCounterFill: {
        height: '100%',
        borderRadius: 1,
    },
    characterCounterText: {
        fontSize: 11,
        fontWeight: '500',
    },
    characterCounterTextError: {
    },
    characterCounterTextWarning: {
        color: '#FF9500',
    },
    inputWrapper: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 1,
    },
    inputWrapperError: {
    },
    descriptionWrapper: {
        minHeight: 120,
    },
    titleInput: {
        fontSize: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    descriptionInput: {
        fontSize: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
        minHeight: 100,
    },
    validationHint: {
        color: '#FF9500',
        fontSize: 12,
        marginTop: 4,
    },
    autoSaveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    autoSaveText: {
        fontSize: 12,
        marginLeft: 6,
    },
    submitContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        borderTopWidth: 1,
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonSubmitting: {
        opacity: 0.8,
    },
    submitButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    submitButtonTextSubmitting: {
        fontSize: 16,
        fontWeight: '700',
    },
});

export default CreateFeatureRequestScreen; 