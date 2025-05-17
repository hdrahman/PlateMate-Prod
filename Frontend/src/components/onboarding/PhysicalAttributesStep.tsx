import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';

interface PhysicalAttributesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

// Activity level options
const activityLevels = [
    { id: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
    { id: 'light', label: 'Lightly Active', description: '1-3 days/week' },
    { id: 'moderate', label: 'Moderately Active', description: '3-5 days/week' },
    { id: 'active', label: 'Very Active', description: '6-7 days/week' },
    { id: 'extreme', label: 'Extremely Active', description: 'Physical job or 2x training' },
];

// Gender options
const genders = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
    { id: 'other', label: 'Other' },
    { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Unit measurement systems
const units = [
    { id: 'metric', label: 'Metric (cm/kg)' },
    { id: 'imperial', label: 'Imperial (ft/in/lb)' },
];

const PhysicalAttributesStep: React.FC<PhysicalAttributesStepProps> = ({ profile, updateProfile, onNext }) => {
    // For metric units
    const [height, setHeight] = useState(profile.height !== null ? profile.height.toString() : '');
    const [weight, setWeight] = useState(profile.weight !== null ? profile.weight.toString() : '');

    // For imperial units
    const [heightFeet, setHeightFeet] = useState('');
    const [heightInches, setHeightInches] = useState('');
    const [weightLbs, setWeightLbs] = useState('');

    const [age, setAge] = useState(profile.age !== null ? profile.age.toString() : '');
    const [gender, setGender] = useState(profile.gender || null);
    const [activityLevel, setActivityLevel] = useState(profile.activityLevel || null);
    const [unitSystem, setUnitSystem] = useState(profile.unitPreference || 'metric');

    // Initialize imperial values if needed
    useEffect(() => {
        if (unitSystem === 'imperial' && profile.height) {
            // Convert cm to feet and inches
            const totalInches = profile.height / 2.54;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);

            setHeightFeet(feet.toString());
            setHeightInches(inches.toString());
        }

        if (unitSystem === 'imperial' && profile.weight) {
            // Convert kg to lbs
            const lbs = Math.round(profile.weight * 2.20462);
            setWeightLbs(lbs.toString());
        }
    }, [unitSystem, profile.height, profile.weight]);

    const handleSubmit = async () => {
        let heightValue = null;
        let weightValue = null;

        if (unitSystem === 'metric') {
            heightValue = height ? parseFloat(height) : null;
            weightValue = weight ? parseFloat(weight) : null;
        } else {
            // Convert imperial to metric for storage
            if (heightFeet && heightInches) {
                const totalInches = (parseInt(heightFeet, 10) * 12) + parseInt(heightInches, 10);
                heightValue = Math.round(totalInches * 2.54);
            }

            if (weightLbs) {
                weightValue = Math.round(parseInt(weightLbs, 10) / 2.20462 * 10) / 10;
            }
        }

        await updateProfile({
            height: heightValue,
            weight: weightValue,
            age: age ? parseInt(age, 10) : null,
            gender,
            activityLevel,
            unitPreference: unitSystem,
        });
        onNext();
    };

    const renderHeightWeightInputs = () => {
        if (unitSystem === 'metric') {
            return (
                <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Height (cm)</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="175"
                                placeholderTextColor="#666"
                                value={height}
                                onChangeText={setHeight}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Weight (kg)</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="70"
                                placeholderTextColor="#666"
                                value={weight}
                                onChangeText={setWeight}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </View>
            );
        } else {
            return (
                <>
                    <View style={styles.inputRow}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Height (ft)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="5"
                                    placeholderTextColor="#666"
                                    value={heightFeet}
                                    onChangeText={setHeightFeet}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                            <Text style={styles.label}>Height (in)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="10"
                                    placeholderTextColor="#666"
                                    value={heightInches}
                                    onChangeText={setHeightInches}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Weight (lbs)</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="154"
                                placeholderTextColor="#666"
                                value={weightLbs}
                                onChangeText={setWeightLbs}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </>
            );
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Physical Details</Text>
                <Text style={styles.subtitle}>This helps us customize your nutrition plan</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferred Units</Text>
                    <View style={styles.unitsContainer}>
                        {units.map((unit) => (
                            <TouchableOpacity
                                key={unit.id}
                                style={[
                                    styles.unitButton,
                                    unitSystem === unit.id && styles.selectedUnit,
                                ]}
                                onPress={() => setUnitSystem(unit.id)}
                            >
                                <Text style={[
                                    styles.unitLabel,
                                    unitSystem === unit.id && styles.selectedUnitText,
                                ]}>
                                    {unit.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Body Measurements</Text>

                    {renderHeightWeightInputs()}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Age</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="30"
                                placeholderTextColor="#666"
                                value={age}
                                onChangeText={setAge}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Gender</Text>
                    <View style={styles.optionsContainer}>
                        {genders.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.optionButton,
                                    gender === item.id && styles.selectedOption,
                                ]}
                                onPress={() => setGender(item.id)}
                            >
                                <Text style={[
                                    styles.optionLabel,
                                    gender === item.id && styles.selectedOptionText,
                                ]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Level</Text>
                    <View style={styles.activityContainer}>
                        {activityLevels.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.activityButton,
                                    activityLevel === item.id && styles.selectedActivity,
                                ]}
                                onPress={() => setActivityLevel(item.id)}
                            >
                                <View style={styles.activityContent}>
                                    <Text style={[
                                        styles.activityLabel,
                                        activityLevel === item.id && styles.selectedActivityText,
                                    ]}>
                                        {item.label}
                                    </Text>
                                    <Text style={styles.activityDescription}>{item.description}</Text>
                                </View>
                                {activityLevel === item.id && (
                                    <View style={styles.checkContainer}>
                                        <Ionicons name="checkmark-circle" size={20} color="#0074dd" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={20} color="#999" style={styles.infoIcon} />
                    <Text style={styles.infoText}>
                        This information helps us calculate your daily calorie and nutrient needs. You can always update it later.
                    </Text>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.buttonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        paddingBottom: 40,
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
    section: {
        marginBottom: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    inputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputGroup: {
        flex: 1,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#ccc',
        marginBottom: 8,
    },
    inputContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    input: {
        color: '#fff',
        fontSize: 16,
    },
    unitsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    unitButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    selectedUnit: {
        backgroundColor: 'rgba(0, 116, 221, 0.3)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    unitLabel: {
        color: '#ddd',
        fontSize: 14,
    },
    selectedUnitText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -5,
    },
    optionButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 5,
        marginBottom: 10,
        minWidth: '45%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedOption: {
        backgroundColor: 'rgba(0, 116, 221, 0.3)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    optionLabel: {
        color: '#ddd',
        fontSize: 14,
    },
    selectedOptionText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    activityContainer: {
        marginBottom: 10,
    },
    activityButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 8,
    },
    selectedActivity: {
        backgroundColor: 'rgba(0, 116, 221, 0.3)',
        borderWidth: 1,
        borderColor: '#0074dd',
    },
    activityContent: {
        flex: 1,
    },
    activityLabel: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 4,
    },
    activityDescription: {
        color: '#aaa',
        fontSize: 12,
    },
    selectedActivityText: {
        fontWeight: 'bold',
    },
    checkContainer: {
        marginLeft: 10,
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 24,
    },
    infoIcon: {
        marginRight: 8,
    },
    infoText: {
        color: '#aaa',
        fontSize: 14,
        flex: 1,
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
});

export default PhysicalAttributesStep; 