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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import * as userApi from '../api/userApi';

// Onboarding step components
import WelcomeStep from '../components/onboarding/WelcomeStep';
import BasicInfoStep from '../components/onboarding/BasicInfoStep';
import PhysicalAttributesStep from '../components/onboarding/PhysicalAttributesStep';
import DietaryPreferencesStep from '../components/onboarding/DietaryPreferencesStep';
import HealthGoalsStep from '../components/onboarding/HealthGoalsStep';
import SubscriptionStep from '../components/onboarding/SubscriptionStep';

const { width, height } = Dimensions.get('window');

const Onboarding = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
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

    // Submit profile to backend when onboarding is complete
    const handleCompleteOnboarding = async () => {
        if (!user) return;

        setIsLoading(true);
        setError(null);

        try {
            // Check if user already exists in backend
            const existingUser = await userApi.getUserProfile(user.uid);

            if (existingUser) {
                // Update existing user
                const backendData = userApi.convertProfileToBackendFormat(profile);
                await userApi.updateUserProfile(user.uid, backendData);
            } else {
                // Create new user
                await userApi.createUser({
                    email: user.email || '',
                    firebase_uid: user.uid,
                    first_name: profile.firstName,
                    last_name: profile.lastName,
                    phone_number: '', // Removed phone number field
                });

                // Then update with full profile data
                const backendData = userApi.convertProfileToBackendFormat(profile);
                await userApi.updateUserProfile(user.uid, backendData);
            }

            // Mark onboarding as complete
            await completeOnboarding();

            // Navigate to home screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' as never }],
            });
        } catch (err: any) {
            setError(err.message || 'An error occurred while saving your profile');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle next step button
    const handleNext = () => {
        if (currentStep < totalSteps) {
            goToNextStep();
        } else {
            handleCompleteOnboarding();
        }
    };

    // Handle back button
    const handleBack = () => {
        if (currentStep > 1) {
            goToPreviousStep();
        }
    };

    // Skip onboarding for now
    const handleSkip = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' as never }],
        });
    };

    // Render current step
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return <WelcomeStep onNext={handleNext} />;
            case 2:
                return <BasicInfoStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 3:
                return <PhysicalAttributesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 4:
                return <DietaryPreferencesStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 5:
                return <HealthGoalsStep profile={profile} updateProfile={updateProfile} onNext={handleNext} />;
            case 6:
                return <SubscriptionStep onComplete={handleCompleteOnboarding} />;
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

            <View style={[styles.header, Platform.OS === 'ios' && styles.iosHeader]}>
                <View style={styles.progressContainer}>
                    {Array.from({ length: totalSteps }).map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.progressDot,
                                index + 1 === currentStep ? styles.activeDot :
                                    index + 1 < currentStep ? styles.completedDot :
                                        styles.inactiveDot
                            ]}
                        />
                    ))}
                </View>

                {currentStep > 1 && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        activeOpacity={0.7}
                    >
                        <View style={styles.backButtonContent}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                            <Text style={styles.backButtonText}>Back</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {currentStep < totalSteps && (
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {renderCurrentStep()}
            </ScrollView>

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
        paddingTop: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iosHeader: {
        paddingTop: 10, // Less padding for iOS since SafeAreaView already provides space
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
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
        top: 16,
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
        top: 16,
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
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 40,
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