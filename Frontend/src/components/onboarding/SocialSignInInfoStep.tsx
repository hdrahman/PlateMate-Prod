import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { useAuth } from '../../context/AuthContext';

interface SocialSignInInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const SocialSignInInfoStep: React.FC<SocialSignInInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [age, setAge] = useState(profile.age?.toString() || '');
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Pre-fill from user metadata if available
    useEffect(() => {
        const loadUserMetadata = async () => {
            if (user) {
                // Check if user has metadata from social sign-in
                const metadata = (user as any)?.user_metadata || {};

                if (metadata.first_name && !firstName) {
                    setFirstName(metadata.first_name);
                }

                console.log('📋 Pre-filled from user metadata:', {
                    firstName: metadata.first_name
                });
            }
        };

        loadUserMetadata();
    }, [user]);

    // Handle age input (only allow numbers)
    const handleAgeInput = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length <= 2) {
            setAge(cleaned);
        }
    };

    const validateForm = (): boolean => {
        if (!firstName.trim()) {
            Alert.alert('Missing Information', 'Please enter your first name');
            return false;
        }

        if (!age || parseInt(age) < 13 || parseInt(age) > 120) {
            Alert.alert('Invalid Age', 'Please enter a valid age (13-120)');
            return false;
        }

        return true;
    };

    const handleContinue = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            await updateProfile({
                firstName: firstName.trim(),
                age: parseInt(age),
                email: user?.email, // Populate email from authenticated user for data consistency
            });

            console.log('✅ Profile updated with social sign-in info, email:', user?.email);
            // NOTE: We intentionally do NOT call onNext() here.
            // After updating the profile, the parent Onboarding component will re-render.
            // Since profile.firstName and profile.age are now set, the condition
            // `user && (!profile.firstName || !profile.age)` will be false,
            // and GoalsStep will render instead of SocialSignInInfoStep (both at step 3).
            // This ensures the user sees the "What's your goal?" screen.
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            Alert.alert('Error', 'Failed to save your information. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Ionicons name="person-circle-outline" size={64} color="#0074dd" style={styles.headerIcon} />
                    <Text style={styles.title}>Complete Your Profile</Text>
                    <Text style={styles.subtitle}>
                        We need a bit more information to personalize your experience
                    </Text>
                </View>

                {/* First Name Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your first name"
                            placeholderTextColor="#666"
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                            autoComplete="name-given"
                            returnKeyType="next"
                        />
                    </View>
                </View>

                {/* Age Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Age</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="calendar-outline" size={20} color="#888" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your age"
                            placeholderTextColor="#666"
                            value={age}
                            onChangeText={handleAgeInput}
                            keyboardType="number-pad"
                            maxLength={2}
                            returnKeyType="done"
                            onSubmitEditing={handleContinue}
                        />
                        <Text style={styles.inputSuffix}>years</Text>
                    </View>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleContinue}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Privacy Note */}
                <Text style={styles.privacyNote}>
                    This information helps us customize your fitness and nutrition plan
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 40,
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    headerIcon: {
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        lineHeight: 22,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        paddingVertical: 16,
    },
    inputSuffix: {
        color: '#888',
        fontSize: 14,
        marginLeft: 8,
    },
    button: {
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    privacyNote: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginTop: 24,
        paddingHorizontal: 40,
        lineHeight: 18,
    },
});

export default SocialSignInInfoStep;
