import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    StatusBar,
    BackHandler,
    Platform,
    KeyboardAvoidingView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { isLikelyOffline, isBackendAvailable } from '../utils/networkUtils';
import * as userApi from '../api/userApi';

// Onboarding step components
import WelcomeStep from '../components/onboarding/WelcomeStep';
import GoalsStep from '../components/onboarding/GoalsStep';
import MotivationStep from '../components/onboarding/MotivationStep';
import WeightChangeRateStep from '../components/onboarding/WeightChangeRateStep';
import BasicInfoStep from '../components/onboarding/BasicInfoStep';
import PhysicalAttributesStep from '../components/onboarding/PhysicalAttributesStep';
import ActivityLevelStep from '../components/onboarding/ActivityLevelStep';
import GenderStep from '../components/onboarding/GenderStep';
import DietaryPreferencesStep from '../components/onboarding/DietaryPreferencesStep';
import FutureSelfMotivationStep from '../components/onboarding/FutureSelfMotivationStep';
import PredictiveInsightsStep from '../components/onboarding/PredictiveInsightsStep';

const { width, height } = Dimensions.get('window');

const Onboarding = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const {
        totalSteps,
        currentStep,
        profile,
        updateProfile,
        goToNextStep,
        goToPreviousStep,
        completeOnboarding,
    } = useOnboarding();

    // Track selected fitness goal from GoalsStep
    const [selectedFitnessGoal, setSelectedFitnessGoal] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [hasShownOfflineWarning, setHasShownOfflineWarning] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                if (currentStep > 1) {
                    handleBack();
                    return true;
                }
                // For the welcome step, we might want to let the default back behavior (exit app) happen.
                // Or handle it inside WelcomeStep if it has internal navigation.
                return currentStep === 1; // Prevent back from step 1 if it's the initial screen.
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [currentStep])
    );

    // Check network connectivity when user starts onboarding steps
    useEffect(() => {
        const checkConnectivity = async () => {
            if (currentStep === 2 && !hasShownOfflineWarning) { // After welcome step
                const offline = await isLikelyOffline();
                setIsOffline(offline);

                if (offline) {
                    setHasShownOfflineWarning(true);
                    Alert.alert(
                        'No Internet Connection',
                        'You appear to be offline. While you can continue with the setup, some features may not work properly until you connect to the internet.',
                        [
                            { text: 'Continue Anyway', style: 'default' },
                            {
                                text: 'Check Connection',
                                style: 'cancel',
                                onPress: () => {
                                    // User can manually check and try again
                                    setHasShownOfflineWarning(false);
                                }
                            }
                        ]
                    );
                }
            }
        };

        checkConnectivity();
    }, [currentStep, hasShownOfflineWarning]);

    // Handle moving to the next step; for GoalsStep, receive the selected fitnessGoal
    const handleNext = async (selectedGoal?: string) => {
        if (currentStep === 2 && selectedGoal) {
            setSelectedFitnessGoal(selectedGoal);
            await updateProfile({ fitnessGoal: selectedGoal });
        }
        goToNextStep();
    };

    const handleBack = () => {
        // We don't want to go back into the welcome steps from the first real onboarding step
        if (currentStep > 1) {
            goToPreviousStep();
        }
    };

    const handleCompleteOnboarding = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await completeOnboarding();
            console.log('✅ Onboarding completed successfully, app will navigate automatically');
            // Don't navigate here - let the app automatically handle this
            // The AuthenticatedContent component will check onboardingComplete and navigate appropriately
        } catch (error) {
            console.error('❌ Onboarding completion failed:', error);
            setError('Failed to complete onboarding. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return <WelcomeStep onNext={handleNext} />;
            case 2:
                return <GoalsStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 3:
                return <MotivationStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 4:
                return (
                    <WeightChangeRateStep
                        profile={profile}
                        updateProfile={updateProfile}
                        onNext={handleNext}
                        fitnessGoalOverride={selectedFitnessGoal || undefined}
                    />
                );
            case 5:
                return <BasicInfoStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 6:
                return <GenderStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 7:
                return <PhysicalAttributesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 8:
                return <PredictiveInsightsStep profile={profile} updateProfile={updateProfile} onComplete={handleCompleteOnboarding} />;
            default:
                // This case should ideally not be reached if totalSteps is accurate.
                // Fallback to the first step.
                return <WelcomeStep onNext={handleNext} />;
        }
    };

    const TOTAL_ONBOARDING_STEPS = 7; // Number of steps after the welcome screen

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={(currentStep === 6 || currentStep === 11) ? ['#000000', '#000000'] : ['#000000', '#121212']}
                style={styles.background}
            />
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : Math.max(insets.top, 20) }]}>
                {currentStep > 1 && currentStep <= 8 && (
                    <View style={styles.progressContainer}>
                        {Array.from({ length: TOTAL_ONBOARDING_STEPS }).map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.progressDot,
                                    index + 2 === currentStep ? styles.activeDot :
                                        index + 2 < currentStep ? styles.completedDot :
                                            styles.inactiveDot
                                ]}
                            />
                        ))}
                    </View>
                )}
                {currentStep > 1 && currentStep < 12 && (
                    <TouchableOpacity
                        style={[styles.backButton, { top: Math.max(insets.top, 20) }]}
                        onPress={handleBack}
                        activeOpacity={0.7}
                    >
                        <View style={styles.backButtonContent}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                            <Text style={styles.backButtonText}>Back</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        (currentStep === 1 || currentStep === 12) && styles.introContent,
                        currentStep === 10 && { flexGrow: 1 },
                        (currentStep === 6 || currentStep === 11) && { paddingHorizontal: 0, paddingBottom: 0 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={currentStep > 1 && currentStep < 12}
                >
                    {renderCurrentStep()}
                </ScrollView>
            </KeyboardAvoidingView>
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#0074DD" />
                    <Text style={styles.loadingText}>Saving your profile...</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        marginBottom: 20,
        position: 'relative',
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 14,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: '#0074DD',
        width: 10,
        height: 10,
    },
    completedDot: {
        backgroundColor: '#5c00dd',
    },
    inactiveDot: {
        backgroundColor: '#444',
    },
    backButton: {
        position: 'absolute',
        left: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        zIndex: 10,
    },
    backButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 2,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    introContent: {
        paddingHorizontal: 0,
        paddingBottom: 0,
        paddingTop: 0,
        flex: 1
    },
    errorContainer: {
        backgroundColor: '#FF3B30',
        padding: 10,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 8,
    },
    errorText: {
        color: '#fff',
        textAlign: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
    },
});

export default Onboarding; 