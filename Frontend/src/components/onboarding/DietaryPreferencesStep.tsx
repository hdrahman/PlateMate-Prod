import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UserProfile } from '../../types/user';

interface DietaryPreferencesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const DietaryPreferencesStep: React.FC<DietaryPreferencesStepProps> = ({ profile, updateProfile, onNext }) => {
    const handleSubmit = async () => {
        // Just pass minimal data for testing
        await updateProfile({
            dietaryRestrictions: [],
            foodAllergies: [],
            cuisinePreferences: [],
            spiceTolerance: null,
        });
        onNext();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Dietary Preferences</Text>
            <Text style={styles.subtitle}>This is a simplified version for testing</Text>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 32,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#0074dd',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default DietaryPreferencesStep; 