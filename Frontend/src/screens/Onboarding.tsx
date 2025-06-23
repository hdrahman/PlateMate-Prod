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
import SubscriptionStep from '../components/onboarding/SubscriptionStep';
import AccountCreationStep from '../components/onboarding/AccountCreationStep';

const { width, height } = Dimensions.get('window');

const Onboarding = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const {
        currentStep,
        totalSteps,
        profile,
        updateProfile,
        goToNextStep,
        goToPreviousStep,
        completeOnboarding,
    } = useOnboarding();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle Android back button
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                if (currentStep > 1) {
                    handleBack();
                    return true; // Prevent default behavior (exit app)
                }
                return false; // Let default behavior happen (exit app)
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [currentStep])
    );

    // Handle next step
    const handleNext = async () => {
        setError(null);
        try {
            goToNextStep();
        } catch (error) {
            console.error('Error going to next step:', error);
            setError('Failed to proceed to next step. Please try again.');
        }
    };

    // Handle previous step
    const handleBack = () => {
        setError(null);
        goToPreviousStep();
    };

    // Complete onboarding
    const handleCompleteOnboarding = async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('🎯 Starting onboarding completion process...');

            // Complete onboarding in context (saves to local database)
            await completeOnboarding();

            // Backend sync disabled - app runs in offline-only mode
            console.log('✅ Profile saved locally - backend sync disabled for offline mode');

            // Navigate to home screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' as never }],
            });

        } catch (error) {
            console.error('❌ Error completing onboarding:', error);
            setError('Failed to complete onboarding. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Skip onboarding for now
    const handleSkip = async () => {
        try {
            setIsLoading(true);
            console.log('🔄 Skipping onboarding - saving minimal profile...');
            console.log('Current user:', user?.uid);
            console.log('Current profile before update:', profile);

            // Create a minimal profile with default values
            const minimalProfile = {
                firstName: 'User',
                lastName: '',
                height: 170, // Default height in cm
                weight: 70,  // Default weight in kg
                age: 25,     // Default age
                gender: 'prefer_not_to_say',
                activityLevel: 'moderate',
                unitPreference: 'metric',
                weightGoal: 'maintain',
                dailyCalorieTarget: 2000, // Default calorie target
            };

            console.log('Minimal profile to save:', minimalProfile);

            // Update profile with minimal data
            console.log('📝 Updating profile...');
            await updateProfile(minimalProfile);
            console.log('✅ Profile updated successfully');

            // Complete onboarding
            console.log('🏁 Completing onboarding...');
            await completeOnboarding();
            console.log('✅ Onboarding completed successfully');

            console.log('✅ Onboarding skipped successfully with minimal profile');

            // Navigate to home screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' as never }],
            });
        } catch (error) {
            console.error('❌ Error skipping onboarding:', error);
            console.error('Error details:', error.message, error.stack);
            setError('Failed to skip onboarding. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Render current step
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
            case 2:
            case 3:
                return <WelcomeStep currentStep={currentStep} onNext={handleNext} />;
            case 4:
                return <GoalsStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 5:
                return <MotivationStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 6:
                return <WeightChangeRateStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 7:
                return <BasicInfoStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 8:
                return <PhysicalAttributesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 9:
                return <ActivityLevelStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 10:
                return <GenderStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 11:
                return <DietaryPreferencesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 12:
                return <FutureSelfMotivationStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 13:
                return <PredictiveInsightsStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 14:
                return <SubscriptionStep onComplete={handleNext} />;
            case 15:
                return <AccountCreationStep
                    profile={profile}
                    onComplete={handleCompleteOnboarding}
                    onSkip={handleSkip}
                />;
            default:
                return <WelcomeStep onNext={handleNext} />;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#000000', '#121212']}
                style={styles.background}
            />

            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                {/* Only show progress dots during main onboarding (steps 4-14) */}
                {currentStep > 3 && currentStep < 15 && (
                    <View style={styles.progressContainer}>
                        {Array.from({ length: 11 }).map((_, index) => ( // 11 main onboarding steps (4-14)
                            <View
                                key={index}
                                style={[
                                    styles.progressDot,
                                    index + 4 === currentStep ? styles.activeDot :
                                        index + 4 < currentStep ? styles.completedDot :
                                            styles.inactiveDot
                                ]}
                            />
                        ))}
                    </View>
                )}

                {/* Hide Back button during intro screens and account creation */}
                {currentStep > 3 && currentStep < 15 && (
                    <TouchableOpacity
                        style={[styles.backButton, { top: Math.max(insets.top + 10, 20) }]}
                        onPress={handleBack}
                        activeOpacity={0.7}
                    >
                        <View style={styles.backButtonContent}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                            <Text style={styles.backButtonText}>Back</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Hide Skip button during intro screens and account creation */}
                {currentStep > 3 && currentStep < 15 && (
                    <TouchableOpacity
                        style={[styles.skipButton, { top: Math.max(insets.top + 10, 20) }]}
                        onPress={handleSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
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
                        (currentStep <= 3 || currentStep === 15) && styles.introContent
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={currentStep > 3 && currentStep < 15} // Disable scrolling for intro screens and account creation
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
        marginTop: 10,
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
    skipButton: {
        position: 'absolute',
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        zIndex: 10,
    },
    skipText: {
        color: '#fff',
        fontSize: 14,
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