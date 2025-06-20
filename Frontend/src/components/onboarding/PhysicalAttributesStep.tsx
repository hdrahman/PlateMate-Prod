import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Platform,
    KeyboardAvoidingView,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import WheelPicker from '../WheelPicker';

interface PhysicalAttributesStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const PhysicalAttributesStep: React.FC<PhysicalAttributesStepProps> = ({ profile, updateProfile, onNext }) => {
    const [useMetric, setUseMetric] = useState<boolean>(profile.useMetricSystem !== false);

    // For metric system
    const [weightKg, setWeightKg] = useState<string>(profile.weight ? String(profile.weight) : '70');
    const [heightCm, setHeightCm] = useState<string>(profile.height ? String(profile.height) : '170');

    // For imperial system
    const [weightLbs, setWeightLbs] = useState<string>(profile.weight ? String(Math.round(profile.weight * 2.20462)) : '154');
    const [heightFt, setHeightFt] = useState<string>(profile.height ? String(Math.floor((profile.height / 2.54) / 12)) : '5');
    const [heightIn, setHeightIn] = useState<string>(profile.height ? String(Math.round((profile.height / 2.54) % 12)) : '7');

    // Modal states
    const [showWeightPicker, setShowWeightPicker] = useState<boolean>(false);
    const [showHeightPicker, setShowHeightPicker] = useState<boolean>(false);

    // Generate data for pickers
    const generateWeightData = () => {
        if (useMetric) {
            return Array.from({ length: 201 }, (_, i) => ({
                id: String(i + 40),
                label: `${i + 40} kg`,
            }));
        } else {
            return Array.from({ length: 301 }, (_, i) => ({
                id: String(i + 80),
                label: `${i + 80} lbs`,
            }));
        }
    };

    const generateHeightCmData = () => {
        return Array.from({ length: 121 }, (_, i) => ({
            id: String(i + 120),
            label: `${i + 120} cm`,
        }));
    };

    const generateHeightFtData = () => {
        return Array.from({ length: 8 }, (_, i) => ({
            id: String(i + 4),
            label: `${i + 4} ft`,
        }));
    };

    const generateHeightInData = () => {
        return Array.from({ length: 12 }, (_, i) => ({
            id: String(i),
            label: `${i} in`,
        }));
    };

    // Convert between metric and imperial on toggle
    useEffect(() => {
        if (profile.weight) {
            if (useMetric) {
                // Convert lbs to kg if coming from imperial
                if (weightLbs) {
                    const kg = Math.round(parseFloat(weightLbs) / 2.20462);
                    setWeightKg(String(kg));
                }
            } else {
                // Convert kg to lbs if coming from metric
                if (weightKg) {
                    const lbs = Math.round(parseFloat(weightKg) * 2.20462);
                    setWeightLbs(String(lbs));
                }
            }
        }

        if (profile.height) {
            if (useMetric) {
                // Convert ft/in to cm if coming from imperial
                if (heightFt && heightIn) {
                    const totalInches = (parseInt(heightFt) * 12) + parseInt(heightIn);
                    const cm = Math.round(totalInches * 2.54);
                    setHeightCm(String(cm));
                }
            } else {
                // Convert cm to ft/in if coming from metric
                if (heightCm) {
                    const totalInches = Math.round(parseFloat(heightCm) / 2.54);
                    const ft = Math.floor(totalInches / 12);
                    const inches = totalInches % 12;
                    setHeightFt(String(ft));
                    setHeightIn(String(inches));
                }
            }
        }
    }, [useMetric]);

    const getWeightValue = () => {
        return useMetric ? `${weightKg} kg` : `${weightLbs} lbs`;
    };

    const getHeightValue = () => {
        return useMetric ? `${heightCm} cm` : `${heightFt}'${heightIn}"`;
    };

    const handleSubmit = async () => {
        try {
            let weight = 0;
            let height = 0;

            // Calculate weight in kg (stored value)
            if (useMetric) {
                weight = parseFloat(weightKg);
            } else {
                weight = Math.round(parseFloat(weightLbs) / 2.20462);
            }

            // Calculate height in cm (stored value)
            if (useMetric) {
                height = parseFloat(heightCm);
            } else {
                const totalInches = (parseInt(heightFt) * 12) + parseInt(heightIn);
                height = Math.round(totalInches * 2.54);
            }

            await updateProfile({
                weight,
                height,
                useMetricSystem: useMetric,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    const isFormValid = () => {
        if (useMetric) {
            return weightKg !== '' && heightCm !== '';
        } else {
            return weightLbs !== '' && heightFt !== '' && heightIn !== '';
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>Your Physical Profile</Text>
                    <Text style={styles.subtitle}>Help us personalize your nutrition and fitness plan</Text>
                </View>

                <View style={styles.unitToggleContainer}>
                    <Text style={styles.unitLabel}>Imperial</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#0074dd' }}
                        thumbColor={useMetric ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => setUseMetric(!useMetric)}
                        value={useMetric}
                        style={styles.switch}
                    />
                    <Text style={styles.unitLabel}>Metric</Text>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Weight</Text>
                    <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowWeightPicker(true)}
                    >
                        <Text style={styles.pickerButtonText}>{getWeightValue()}</Text>
                        <Ionicons name="chevron-down" size={24} color="#0074dd" />
                    </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Height</Text>
                    <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowHeightPicker(true)}
                    >
                        <Text style={styles.pickerButtonText}>{getHeightValue()}</Text>
                        <Ionicons name="chevron-down" size={24} color="#0074dd" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.button, !isFormValid() && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={!isFormValid()}
                >
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

            {/* Weight Picker Modal */}
            <Modal
                visible={showWeightPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowWeightPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Weight</Text>
                            <TouchableOpacity onPress={() => setShowWeightPicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <WheelPicker
                            data={generateWeightData()}
                            selectedValue={useMetric ? weightKg : weightLbs}
                            onValueChange={(value) => {
                                if (useMetric) {
                                    setWeightKg(value);
                                } else {
                                    setWeightLbs(value);
                                }
                            }}
                            itemHeight={50}
                            containerHeight={250}
                        />

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowWeightPicker(false)}
                        >
                            <Text style={styles.modalButtonText}>Confirm</Text>
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
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Height</Text>
                            <TouchableOpacity onPress={() => setShowHeightPicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {useMetric ? (
                            <WheelPicker
                                data={generateHeightCmData()}
                                selectedValue={heightCm}
                                onValueChange={(value) => setHeightCm(value)}
                                itemHeight={50}
                                containerHeight={250}
                            />
                        ) : (
                            <View style={styles.imperialHeightPickers}>
                                <View style={styles.ftPickerContainer}>
                                    <WheelPicker
                                        data={generateHeightFtData()}
                                        selectedValue={heightFt}
                                        onValueChange={(value) => setHeightFt(value)}
                                        itemHeight={50}
                                        containerHeight={250}
                                        containerStyle={{ flex: 1, marginRight: 10 }}
                                    />
                                </View>
                                <View style={styles.inPickerContainer}>
                                    <WheelPicker
                                        data={generateHeightInData()}
                                        selectedValue={heightIn}
                                        onValueChange={(value) => setHeightIn(value)}
                                        itemHeight={50}
                                        containerHeight={250}
                                        containerStyle={{ flex: 1, marginLeft: 10 }}
                                    />
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowHeightPicker(false)}
                        >
                            <Text style={styles.modalButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 20,
        paddingBottom: 40,
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
    unitToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    unitLabel: {
        fontSize: 16,
        color: '#fff',
        marginHorizontal: 10,
    },
    switch: {
        transform: [{ scale: 1.1 }],
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
        fontWeight: '600',
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    pickerButtonText: {
        fontSize: 18,
        color: '#fff',
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 24,
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
    buttonDisabled: {
        opacity: 0.6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    modalButton: {
        backgroundColor: '#0074dd',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    imperialHeightPickers: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    ftPickerContainer: {
        flex: 1,
        marginRight: 10,
    },
    inPickerContainer: {
        flex: 1,
        marginLeft: 10,
    },
});

export default PhysicalAttributesStep; 