import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../../ThemeContext';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import WheelPicker from '../WheelPicker';
import {
    roundToOneDecimal,
    convertAndRoundLbsToKg,
    convertAndRoundInchesToCm,
    syncUnitPreferenceFields,
    parseUnitPreference
} from '../../utils/unitConversion';

interface PhysicalAttributesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const PhysicalAttributesStep: React.FC<PhysicalAttributesStepProps> = ({ profile, updateProfile, onNext }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    // Use the helper to parse unit preference consistently
    const [useMetric, setUseMetric] = useState(parseUnitPreference(profile));

    // For metric system
    const [weightKg, setWeightKg] = useState<number>(profile.weight ? Math.round(profile.weight) : 70);
    const [heightCm, setHeightCm] = useState<number>(profile.height ? Math.round(profile.height) : 170);
    const [targetWeightKg, setTargetWeightKg] = useState<number>(profile.targetWeight ? Math.round(profile.targetWeight) : 65);

    // For imperial system
    const [weightLbs, setWeightLbs] = useState<number>(profile.weight ? Math.round(profile.weight * 2.20462) : 154);
    const [heightFt, setHeightFt] = useState<number>(profile.height ? Math.floor((profile.height / 2.54) / 12) : 5);
    const [heightIn, setHeightIn] = useState<number>(profile.height ? Math.round((profile.height / 2.54) % 12) : 9);
    const [targetWeightLbs, setTargetWeightLbs] = useState<number>(profile.targetWeight ? Math.round(profile.targetWeight * 2.20462) : 143);

    // Modal states
    const [showWeightPicker, setShowWeightPicker] = useState(false);
    const [showHeightPicker, setShowHeightPicker] = useState(false);
    const [showTargetWeightPicker, setShowTargetWeightPicker] = useState(false);

    // Generate data for pickers
    const generateWeightData = (isMetric: boolean) => {
        const min = isMetric ? 30 : 66; // 30kg or 66lbs
        const max = isMetric ? 200 : 440; // 200kg or 440lbs
        return Array.from({ length: max - min + 1 }, (_, i) => ({
            id: String(min + i),
            label: `${min + i}${isMetric ? ' kg' : ' lbs'}`
        }));
    };

    const generateHeightCmData = () => {
        return Array.from({ length: 101 }, (_, i) => ({
            id: String(140 + i),
            label: `${140 + i} cm`
        }));
    };

    const generateFeetData = () => {
        return Array.from({ length: 6 }, (_, i) => ({
            id: String(3 + i),
            label: `${3 + i} ft`
        }));
    };

    const generateInchesData = () => {
        return Array.from({ length: 12 }, (_, i) => ({
            id: String(i),
            label: `${i} in`
        }));
    };

    // Generate combined imperial height data
    const generateImperialHeightData = () => {
        const data = [];
        for (let ft = 3; ft <= 8; ft++) {
            for (let inch = 0; inch < 12; inch++) {
                const id = `${ft}-${inch}`;
                const label = `${ft}' ${inch}"`;
                data.push({ id, label });
            }
        }
        return data;
    };

    // Convert between metric and imperial on toggle
    useEffect(() => {
        if (profile.height) {
            if (useMetric) {
                // Convert ft/in to cm if coming from imperial
                const totalInches = (heightFt * 12) + heightIn;
                const cm = Math.round(totalInches * 2.54);
                setHeightCm(cm);
            } else {
                // Convert cm to ft/in if coming from metric
                const totalInches = Math.round(heightCm / 2.54);
                const feet = Math.floor(totalInches / 12);
                const inches = totalInches % 12;
                setHeightFt(feet);
                setHeightIn(inches);
            }
        }

        if (profile.weight) {
            if (useMetric) {
                // Convert lbs to kg if coming from imperial
                const kg = Math.round(weightLbs / 2.20462);
                setWeightKg(kg);
            } else {
                // Convert kg to lbs if coming from metric
                const lbs = Math.round(weightKg * 2.20462);
                setWeightLbs(lbs);
            }
        }

        if (profile.targetWeight) {
            if (useMetric) {
                // Convert target weight lbs to kg if coming from imperial
                const kg = Math.round(targetWeightLbs / 2.20462);
                setTargetWeightKg(kg);
            } else {
                // Convert target weight kg to lbs if coming from metric
                const lbs = Math.round(targetWeightKg * 2.20462);
                setTargetWeightLbs(lbs);
            }
        }
    }, [useMetric]);

    const handleNext = async () => {
        try {
            let finalWeight: number;
            let finalHeight: number;
            let finalTargetWeight: number;

            if (useMetric) {
                if (weightKg <= 0 || weightKg > 300) {
                    Alert.alert('Invalid Weight', 'Please enter a valid weight between 1-300 kg');
                    return;
                }

                if (heightCm <= 0 || heightCm > 250) {
                    Alert.alert('Invalid Height', 'Please enter a valid height between 1-250 cm');
                    return;
                }

                if (targetWeightKg <= 0 || targetWeightKg > 300) {
                    Alert.alert('Invalid Target Weight', 'Please enter a valid target weight between 1-300 kg');
                    return;
                }

                // Round to 1 decimal place for clean storage
                finalWeight = roundToOneDecimal(weightKg);
                finalHeight = roundToOneDecimal(heightCm);
                finalTargetWeight = roundToOneDecimal(targetWeightKg);
            } else {
                if (weightLbs <= 0 || weightLbs > 660) {
                    Alert.alert('Invalid Weight', 'Please enter a valid weight between 1-660 lbs');
                    return;
                }

                if (heightFt < 3 || heightFt > 8) {
                    Alert.alert('Invalid Height', 'Please enter a valid height between 3-8 feet');
                    return;
                }

                if (heightIn < 0 || heightIn >= 12) {
                    Alert.alert('Invalid Height', 'Please enter valid inches between 0-11');
                    return;
                }

                if (targetWeightLbs <= 0 || targetWeightLbs > 660) {
                    Alert.alert('Invalid Target Weight', 'Please enter a valid target weight between 1-660 lbs');
                    return;
                }

                // Convert to metric for storage and round to 1 decimal place
                finalWeight = convertAndRoundLbsToKg(weightLbs);
                const totalInches = (heightFt * 12) + heightIn;
                finalHeight = convertAndRoundInchesToCm(totalInches);
                finalTargetWeight = convertAndRoundLbsToKg(targetWeightLbs);
            }

            // Sync both unit preference fields to prevent desynchronization
            const unitFields = syncUnitPreferenceFields(useMetric);

            await updateProfile({
                weight: finalWeight,
                height: finalHeight,
                targetWeight: finalTargetWeight,
                ...unitFields,
            });

            onNext();
        } catch (error) {
            console.error('Error updating physical attributes:', error);
            Alert.alert('Error', 'Failed to save physical attributes. Please try again.');
        }
    };

    const getWeightDisplay = () => {
        return useMetric ? `${weightKg} kg` : `${weightLbs} lbs`;
    };

    const getHeightDisplay = () => {
        return useMetric ? `${heightCm} cm` : `${heightFt}' ${heightIn}"`;
    };

    const getTargetWeightDisplay = () => {
        return useMetric ? `${targetWeightKg} kg` : `${targetWeightLbs} lbs`;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Physical Attributes</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Help us personalize your experience
                    </Text>
                </View>

                {/* Metric/Imperial Toggle */}
                <View style={[styles.toggleContainer, { backgroundColor: theme.colors.cardBackground }]}>
                    <TouchableOpacity
                        style={[styles.toggleButton, useMetric && styles.activeToggle]}
                        onPress={() => setUseMetric(true)}
                    >
                        <Text style={[styles.toggleText, { color: theme.colors.textSecondary }, useMetric && styles.activeToggleText]}>
                            Metric
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleButton, !useMetric && styles.activeToggle]}
                        onPress={() => setUseMetric(false)}
                    >
                        <Text style={[styles.toggleText, { color: theme.colors.textSecondary }, !useMetric && styles.activeToggleText]}>
                            Imperial
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.attributesSection}>
                    {/* Weight Display */}
                    <View style={styles.attributeGroup}>
                        <Text style={[styles.attributeLabel, { color: theme.colors.textSecondary }]}>Current Weight</Text>
                        <TouchableOpacity
                            style={[styles.attributeSelector, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                            onPress={() => setShowWeightPicker(true)}
                        >
                            <Text style={[styles.attributeValue, { color: theme.colors.text }]}>{getWeightDisplay()}</Text>
                            <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Target Weight Display */}
                    <View style={styles.attributeGroup}>
                        <Text style={[styles.attributeLabel, { color: theme.colors.textSecondary }]}>Target Weight</Text>
                        <TouchableOpacity
                            style={[styles.attributeSelector, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                            onPress={() => setShowTargetWeightPicker(true)}
                        >
                            <Text style={[styles.attributeValue, { color: theme.colors.text }]}>{getTargetWeightDisplay()}</Text>
                            <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Height Display */}
                    <View style={styles.attributeGroup}>
                        <Text style={[styles.attributeLabel, { color: theme.colors.textSecondary }]}>Height</Text>
                        <TouchableOpacity
                            style={[styles.attributeSelector, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                            onPress={() => setShowHeightPicker(true)}
                        >
                            <Text style={[styles.attributeValue, { color: theme.colors.text }]}>{getHeightDisplay()}</Text>
                            <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.infoContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                        Your measurements help us calculate accurate nutrition goals and recommendations
                    </Text>
                </View>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleNext}
                >
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Weight Picker Modal */}
            <Modal
                visible={showWeightPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowWeightPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Current Weight</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowWeightPicker(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <WheelPicker
                            data={generateWeightData(useMetric)}
                            selectedValue={String(useMetric ? weightKg : weightLbs)}
                            onValueChange={(value: string) => {
                                const numValue = parseInt(value);
                                if (useMetric) {
                                    setWeightKg(numValue);
                                } else {
                                    setWeightLbs(numValue);
                                }
                            }}
                            containerStyle={styles.wheelPickerContainer}
                            itemHeight={50}
                            defaultValue={String(useMetric ? weightKg : weightLbs)}
                        />
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowWeightPicker(false)}
                        >
                            <Text style={styles.modalButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Target Weight Picker Modal */}
            <Modal
                visible={showTargetWeightPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTargetWeightPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Target Weight</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowTargetWeightPicker(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <WheelPicker
                            data={generateWeightData(useMetric)}
                            selectedValue={String(useMetric ? targetWeightKg : targetWeightLbs)}
                            onValueChange={(value: string) => {
                                const numValue = parseInt(value);
                                if (useMetric) {
                                    setTargetWeightKg(numValue);
                                } else {
                                    setTargetWeightLbs(numValue);
                                }
                            }}
                            containerStyle={styles.wheelPickerContainer}
                            itemHeight={50}
                            defaultValue={String(useMetric ? targetWeightKg : targetWeightLbs)}
                        />
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowTargetWeightPicker(false)}
                        >
                            <Text style={styles.modalButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Height Picker Modal */}
            <Modal
                visible={showHeightPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowHeightPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Height</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowHeightPicker(false)}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {useMetric ? (
                            <WheelPicker
                                data={generateHeightCmData()}
                                selectedValue={String(heightCm)}
                                onValueChange={(value: string) => setHeightCm(parseInt(value))}
                                containerStyle={styles.wheelPickerContainer}
                                itemHeight={50}
                                defaultValue={String(heightCm)}
                            />
                        ) : (
                            <WheelPicker
                                data={generateImperialHeightData()}
                                selectedValue={`${heightFt}-${heightIn}`}
                                onValueChange={(value: string) => {
                                    const [ft, inch] = value.split('-').map(Number);
                                    setHeightFt(ft);
                                    setHeightIn(inch);
                                }}
                                containerStyle={styles.wheelPickerContainer}
                                itemHeight={50}
                                defaultValue={`${heightFt}-${heightIn}`}
                            />
                        )}
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowHeightPicker(false)}
                        >
                            <Text style={styles.modalButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    header: {
        marginBottom: 24,
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
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 3,
        marginBottom: 20,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    toggleButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 9,
        minWidth: 100,
        alignItems: 'center',
    },
    activeToggle: {
        backgroundColor: '#5c00dd',
    },
    toggleText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#aaa',
    },
    activeToggleText: {
        color: '#fff',
        fontWeight: '700',
    },
    attributesSection: {
        marginBottom: 20,
    },
    attributeGroup: {
        marginBottom: 16,
    },
    attributeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    attributeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 0,
    },
    attributeValue: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '600',
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 12,
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    nextButton: {
        backgroundColor: '#5c00dd',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#5c00dd',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        width: '100%',
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    wheelPickerContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        marginBottom: 12,
        overflow: 'hidden',
    },
    modalButton: {
        backgroundColor: '#5c00dd',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 20,
        marginHorizontal: 20,
        marginBottom: 20,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default PhysicalAttributesStep; 