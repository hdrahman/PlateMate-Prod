import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import { syncUnitPreferenceFields, parseUnitPreference } from '../../utils/unitConversion';

interface PersonalizedInfoStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const PersonalizedInfoStep: React.FC<PersonalizedInfoStepProps> = ({ profile, updateProfile, onNext }) => {
    const [location, setLocation] = useState(profile.location || '');
    // Parse unit preference consistently from profile
    const initialUseMetric = parseUnitPreference(profile);
    const [unitPreference, setUnitPreference] = useState<'metric' | 'imperial'>(
        initialUseMetric ? 'metric' : 'imperial'
    );
    const [weightGoal, setWeightGoal] = useState(profile.weightGoal || 'maintain');
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // Countries list
    const countries = [
        'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
        'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain',
        'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
        'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
        'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada',
        'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
        'Congo (Congo-Brazzaville)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
        'Czech Republic (Czechia)', 'Democratic Republic of the Congo', 'Denmark',
        'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
        'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
        'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
        'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Holy See',
        'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
        'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait',
        'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
        'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
        'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
        'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
        'Myanmar (Burma)', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
        'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
        'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
        'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
        'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
        'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
        'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
        'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
        'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
        'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
        'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
        'United Arab Emirates', 'United Kingdom', 'United States of America', 'Uruguay',
        'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
    ].sort();

    // Unit preferences
    const unitOptions = [
        { id: 'metric', label: 'Metric', description: 'kg, cm, °C' },
        { id: 'imperial', label: 'Imperial', description: 'lb, ft/in, °F' },
    ];

    // Weight goals
    const weightGoals = [
        { id: 'lose', label: 'Lose Weight', icon: 'trending-down', description: 'Create a calorie deficit' },
        { id: 'maintain', label: 'Maintain Weight', icon: 'remove', description: 'Stay at current weight' },
        { id: 'gain', label: 'Gain Weight', icon: 'trending-up', description: 'Build muscle or gain mass' },
    ];

    const handleNext = async () => {
        // Sync both unit preference fields to prevent desynchronization
        const useMetric = unitPreference === 'metric';
        const unitFields = syncUnitPreferenceFields(useMetric);
        
        await updateProfile({
            location: location.trim() || null,
            weightGoal,
            ...unitFields, // Includes both useMetricSystem and unitPreference
        });
        onNext();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Preferences</Text>
                <Text style={styles.subtitle}>Customize your experience</Text>
            </View>

            <View style={styles.form}>
                {/* Location Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <Text style={styles.sectionSubtitle}>Help us recommend local foods and seasonal options</Text>

                    <TouchableOpacity
                        style={styles.locationButton}
                        onPress={() => setShowLocationPicker(true)}
                    >
                        <Ionicons name="location-outline" size={20} color="#666" />
                        <Text style={[styles.locationText, !location && styles.placeholderText]}>
                            {location || 'Select your country'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Unit Preference */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Unit System</Text>
                    <Text style={styles.sectionSubtitle}>Choose your preferred measurement system</Text>

                    <View style={styles.optionsContainer}>
                        {unitOptions.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                style={[
                                    styles.optionCard,
                                    unitPreference === option.id && styles.selectedOption
                                ]}
                                onPress={() => setUnitPreference(option.id)}
                            >
                                <View style={styles.optionContent}>
                                    <Text style={[
                                        styles.optionLabel,
                                        unitPreference === option.id && styles.selectedOptionText
                                    ]}>
                                        {option.label}
                                    </Text>
                                    <Text style={[
                                        styles.optionDescription,
                                        unitPreference === option.id && styles.selectedOptionDescription
                                    ]}>
                                        {option.description}
                                    </Text>
                                </View>
                                {unitPreference === option.id && (
                                    <Ionicons name="checkmark-circle" size={20} color="#0074dd" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Weight Goal */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weight Goal</Text>
                    <Text style={styles.sectionSubtitle}>What's your primary objective?</Text>

                    <View style={styles.goalsContainer}>
                        {weightGoals.map((goal) => (
                            <TouchableOpacity
                                key={goal.id}
                                style={[
                                    styles.goalCard,
                                    weightGoal === goal.id && styles.selectedGoal
                                ]}
                                onPress={() => setWeightGoal(goal.id)}
                            >
                                <View style={styles.goalIcon}>
                                    <Ionicons
                                        name={goal.icon as any}
                                        size={24}
                                        color={weightGoal === goal.id ? '#0074dd' : '#666'}
                                    />
                                </View>
                                <View style={styles.goalContent}>
                                    <Text style={[
                                        styles.goalLabel,
                                        weightGoal === goal.id && styles.selectedGoalText
                                    ]}>
                                        {goal.label}
                                    </Text>
                                    <Text style={[
                                        styles.goalDescription,
                                        weightGoal === goal.id && styles.selectedGoalDescription
                                    ]}>
                                        {goal.description}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
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

            {/* Country Picker Modal */}
            <Modal
                visible={showLocationPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowLocationPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Country</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowLocationPicker(false)}
                            >
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.countryList}>
                            {countries.map((country, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.countryOption, location === country && styles.selectedCountry]}
                                    onPress={() => {
                                        setLocation(country);
                                        setShowLocationPicker(false);
                                    }}
                                >
                                    <Text style={[styles.countryText, location === country && styles.selectedCountryText]}>
                                        {country}
                                    </Text>
                                    {location === country && <Ionicons name="checkmark" size={20} color="#0074dd" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
    },
    header: {
        marginBottom: 32,
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
    form: {
        flex: 1,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 16,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
    },
    locationText: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    placeholderText: {
        color: '#666',
    },
    optionsContainer: {
        gap: 12,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
    },
    selectedOption: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    optionContent: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedOptionText: {
        color: '#fff',
    },
    optionDescription: {
        fontSize: 14,
        color: '#888',
    },
    selectedOptionDescription: {
        color: '#aaa',
    },
    goalsContainer: {
        gap: 12,
    },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
    },
    selectedGoal: {
        borderColor: '#0074dd',
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    goalIcon: {
        width: 40,
        alignItems: 'center',
        marginRight: 16,
    },
    goalContent: {
        flex: 1,
    },
    goalLabel: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedGoalText: {
        color: '#fff',
    },
    goalDescription: {
        fontSize: 14,
        color: '#888',
    },
    selectedGoalDescription: {
        color: '#aaa',
    },
    button: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 20,
    },
    buttonGradient: {
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    countryList: {
        flex: 1,
    },
    countryOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    selectedCountry: {
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    countryText: {
        fontSize: 16,
        color: '#fff',
    },
    selectedCountryText: {
        color: '#0074dd',
        fontWeight: '600',
    },
});

export default PersonalizedInfoStep; 