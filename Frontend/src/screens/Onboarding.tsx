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
import * as userApi from '../api/userApi';

// Onboarding step components
import WelcomeStep from '../components/onboarding/WelcomeStep';
import AccountCreationStep from '../components/onboarding/AccountCreationStep';
import GoalsStep from '../components/onboarding/GoalsStep';
import MotivationStep from '../components/onboarding/MotivationStep';
import WeightChangeRateStep from '../components/onboarding/WeightChangeRateStep';
import CheatDayStep from '../components/onboarding/CheatDayStep';
import PhysicalAttributesStep from '../components/onboarding/PhysicalAttributesStep';
import ActivityLevelStep from '../components/onboarding/ActivityLevelStep';
import GenderStep from '../components/onboarding/GenderStep';
import PredictiveInsightsStep from '../components/onboarding/PredictiveInsightsStep';
import SocialSignInInfoStep from '../components/onboarding/SocialSignInInfoStep';

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

    // Handle moving to the next step; for GoalsStep (step 3), receive the selected fitnessGoal
    const handleNext = async (selectedGoal?: string) => {
        if (currentStep === 3 && selectedGoal) {
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
                return <AccountCreationStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 3:
                // Check if user signed in via social auth and is missing name/age
                if (user && (!profile.firstName || !profile.age)) {
                    return <SocialSignInInfoStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
                }
                return <GoalsStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 4:
                return <MotivationStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 5:
                return (
                    <WeightChangeRateStep
                        profile={profile}
                        updateProfile={updateProfile}
                        onNext={handleNext}
                        fitnessGoalOverride={selectedFitnessGoal || undefined}
                    />
                );
            case 6:
                return <ActivityLevelStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 7:
                return <CheatDayStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 8:
                return <GenderStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 9:
                return <PhysicalAttributesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 10:
                return <PredictiveInsightsStep profile={profile} updateProfile={updateProfile} onComplete={handleCompleteOnboarding} />;
            default:
                // This case should ideally not be reached if totalSteps is accurate.
                // Fallback to the first step.
                return <WelcomeStep onNext={handleNext} />;
        }
    };

    const TOTAL_ONBOARDING_STEPS = 9; // Number of steps after the welcome screen (AccountCreation + Goals + Motivation + WeightChangeRate + ActivityLevel + CheatDay + Gender + PhysicalAttributes + PredictiveInsights)

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={(currentStep === 6) ? ['#000000', '#000000'] : ['#000000', '#121212']}
                style={styles.background}
            />
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : Math.max(insets.top, 20) }]}>
                {currentStep > 1 && currentStep <= 9 && (
                    <View style={styles.progressContainer}>
                        {Array.from({ length: TOTAL_ONBOARDING_STEPS }).map((_, index) => {
                            // Adjust progress calculation for authenticated users starting at step 3
                            // For authenticated users: step 3 shows as first dot (index 0)
                            // For unauthenticated users: step 2 shows as first dot (index 0)
                            const isAuthenticated = user && user.id;
                            const effectiveStep = isAuthenticated ? currentStep - 2 : currentStep - 1;
                            const dotPosition = index + 1;

                            return (
                                <View
                                    key={index}
                                    style={[
                                        styles.progressDot,
                                        dotPosition === effectiveStep ? styles.activeDot :
                                            dotPosition < effectiveStep ? styles.completedDot :
                                                styles.inactiveDot
                                    ]}
                                />
                            );
                        })}
                    </View>
                )}
                {/* Hide back button if user is authenticated and at step 3 (their first real step) */}
                {currentStep > 1 && currentStep < 10 && !(user && user.id && currentStep === 3) && (
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
                        currentStep === 1 && styles.introContent,
                        (currentStep === 6) && { paddingHorizontal: 0, paddingBottom: 0 }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={currentStep > 1 && currentStep < 10}
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