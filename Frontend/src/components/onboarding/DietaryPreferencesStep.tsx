import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface DietaryPreferencesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Diet types with descriptions
const dietTypes = [
    {
        id: 'classic',
        label: 'Classic',
        description: 'No specific dietary restrictions',
        icon: 'restaurant-outline',
    },
    {
        id: 'pescatarian',
        label: 'Pescatarian',
        description: 'Fish but no other meat',
        icon: 'fish-outline',
    },
    {
        id: 'vegetarian',
        label: 'Vegetarian',
        description: 'No meat or fish',
        icon: 'leaf-outline',
    },
    {
        id: 'vegan',
        label: 'Vegan',
        description: 'No animal products',
        icon: 'nutrition-outline',
    },
    {
        id: 'keto',
        label: 'Keto',
        description: 'Low carb, high fat',
        icon: 'flame-outline',
    },
    {
        id: 'paleo',
        label: 'Paleo',
        description: 'Whole foods based diet',
        icon: 'egg-outline',
    },
    {
        id: 'mediterranean',
        label: 'Mediterranean',
        description: 'Rich in healthy fats and produce',
        icon: 'wine-outline',
    },
];

// Common food allergies
const commonAllergies = [
    { id: 'dairy', label: 'Dairy' },
    { id: 'eggs', label: 'Eggs' },
    { id: 'peanuts', label: 'Peanuts' },
    { id: 'tree_nuts', label: 'Tree Nuts' },
    { id: 'soy', label: 'Soy' },
    { id: 'wheat', label: 'Wheat/Gluten' },
    { id: 'fish', label: 'Fish' },
    { id: 'shellfish', label: 'Shellfish' },
];

const DietaryPreferencesStep: React.FC<DietaryPreferencesStepProps> = ({ profile, updateProfile, onNext }) => {
    const [selectedDiet, setSelectedDiet] = useState<string>(profile.dietType || 'classic');

    useEffect(() => {
        updateProfile({
            dietType: selectedDiet,
        }).catch(() => { });
    }, [selectedDiet]);

    const handleSubmit = async () => {
        try {
            await updateProfile({
                dietType: selectedDiet,
            });
            onNext();
        } catch (error) {
            console.error('Error updating dietary preferences:', error);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Dietary Preferences</Text>
                <Text style={styles.subtitle}>Tell us about your eating habits</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Do you follow a specific diet?</Text>

                <View style={styles.dietList}>
                    {dietTypes.map((diet) => (
                        <TouchableOpacity
                            key={diet.id}
                            style={[
                                styles.dietCard,
                                selectedDiet === diet.id && styles.selectedDiet
                            ]}
                            onPress={() => setSelectedDiet(diet.id)}
                        >
                            <View style={styles.dietIconContainer}>
                                <Ionicons
                                    name={diet.icon as any}
                                    size={24}
                                    color={selectedDiet === diet.id ? '#0074dd' : '#777'}
                                />
                            </View>
                            <View style={styles.dietInfo}>
                                <Text style={[
                                    styles.dietLabel,
                                    selectedDiet === diet.id && styles.selectedDietText
                                ]}>
                                    {diet.label}
                                </Text>
                                <Text style={styles.dietDescription}>{diet.description}</Text>
                            </View>
                            {selectedDiet === diet.id && (
                                <Ionicons name="checkmark-circle" size={22} color="#0074dd" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
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
        marginBottom: 30,
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
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 16,
    },
    dietList: {
        marginTop: 16,
    },
    dietCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedDiet: {
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
        borderColor: '#0074dd',
    },
    dietIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    dietInfo: {
        flex: 1,
    },
    dietLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    selectedDietText: {
        color: '#0074dd',
    },
    dietDescription: {
        fontSize: 14,
        color: '#aaa',
    },
    allergiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    allergyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 10,
        marginBottom: 10,
    },
    selectedAllergyChip: {
        backgroundColor: '#0074dd',
    },
    allergyLabel: {
        color: '#ddd',
        fontSize: 14,
        fontWeight: '500',
    },
    selectedAllergyLabel: {
        color: '#fff',
    },
    allergyIcon: {
        marginLeft: 6,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 20,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default DietaryPreferencesStep; 