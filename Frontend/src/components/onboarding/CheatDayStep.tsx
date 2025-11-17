import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import WheelPicker from '../WheelPicker';

interface CheatDayStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const CheatDayStep: React.FC<CheatDayStepProps> = ({ profile, updateProfile, onNext }) => {
    const [cheatDayEnabled, setCheatDayEnabled] = useState<boolean>(profile.cheatDayEnabled !== false);
    const [cheatDayFrequency, setCheatDayFrequency] = useState<number>(profile.cheatDayFrequency || 7);
    const [preferredCheatDay, setPreferredCheatDay] = useState<number | undefined>(profile.preferredCheatDayOfWeek);
    const [showCustomFrequencyModal, setShowCustomFrequencyModal] = useState(false);
    const [customFrequencyInput, setCustomFrequencyInput] = useState('');
    const [showDayPicker, setShowDayPicker] = useState(false);

    // Frequency options
    const frequencyOptions = [
        { id: 'weekly', label: 'Weekly', days: 7 },
        { id: 'biweekly', label: 'Biweekly', days: 14 },
        { id: 'monthly', label: 'Monthly', days: 30 },
        { id: 'custom', label: 'Custom', days: null },
    ];

    // Day names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Create picker data with "From Today" as first option
    const dayPickerData = [
        { value: undefined, label: 'From Today (Flexible)' },
        ...dayNames.map((day, index) => ({ value: index, label: day }))
    ];

    const getFrequencyDescription = () => {
        if (cheatDayFrequency === 7) {
            return "You'll have a cheat day weekly (every 7 days) with 300-500 extra calories";
        } else if (cheatDayFrequency === 14) {
            return "You'll have a cheat day biweekly (every 14 days) with 300-500 extra calories";
        } else if (cheatDayFrequency === 30) {
            return "You'll have a cheat day monthly (every 30 days) with 300-500 extra calories";
        }
        return `You'll have a cheat day every ${cheatDayFrequency} days with 300-500 extra calories`;
    };

    const handleCustomFrequencySubmit = () => {
        const weeks = parseInt(customFrequencyInput);
        if (isNaN(weeks) || weeks < 1 || weeks > 52) {
            Alert.alert('Invalid Input', 'Please enter a number between 1 and 52 weeks.');
            return;
        }
        const days = weeks * 7; // Convert weeks to days for storage
        setCheatDayFrequency(days);
        setCustomFrequencyInput('');
        setShowCustomFrequencyModal(false);
    };

    const handleFrequencyOptionSelect = (optionId: string) => {
        if (optionId === 'custom') {
            setShowCustomFrequencyModal(true);
        } else {
            const option = frequencyOptions.find(opt => opt.id === optionId);
            if (option && option.days) {
                setCheatDayFrequency(option.days);
            }
        }
    };

    const getSelectedFrequencyOption = () => {
        const standardOption = frequencyOptions.find(opt => opt.days === cheatDayFrequency);
        return standardOption ? standardOption.id : 'custom';
    };

    const handleSubmit = async () => {
        try {
            await updateProfile({
                cheatDayEnabled,
                cheatDayFrequency,
                preferredCheatDayOfWeek: preferredCheatDay,
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    // Persist changes whenever relevant fields change
    useEffect(() => {
        updateProfile({
            cheatDayEnabled,
            cheatDayFrequency,
            preferredCheatDayOfWeek: preferredCheatDay,
        }).catch(() => { });
    }, [cheatDayEnabled, cheatDayFrequency, preferredCheatDay]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Motivation</Text>
                <Text style={styles.subtitle}>
                    Stay motivated with scheduled cheat days to balance your diet and enjoy occasional treats
                </Text>
            </View>

            <View style={styles.content}>
                <View style={styles.cheatDayToggleContainer}>
                    <View style={styles.cheatDayToggleContent}>
                        <Text style={styles.cheatDayToggleTitle}>Enable Cheat Days</Text>
                        <Text style={styles.cheatDayToggleDescription}>
                            Track your progress towards scheduled cheat days
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.toggleSwitch,
                            cheatDayEnabled && styles.toggleSwitchActive
                        ]}
                        onPress={() => setCheatDayEnabled(!cheatDayEnabled)}
                    >
                        <View
                            style={[
                                styles.toggleKnob,
                                cheatDayEnabled && styles.toggleKnobActive
                            ]}
                        />
                    </TouchableOpacity>
                </View>

                {cheatDayEnabled && (
                    <>
                        <View style={styles.frequencyContainer}>
                            <Text style={styles.frequencyTitle}>Cheat Day Frequency</Text>
                            <View style={styles.frequencyOptionsContainer}>
                                {frequencyOptions.map((option) => {
                                    const isSelected = getSelectedFrequencyOption() === option.id;
                                    const displayText = option.id === 'custom' && isSelected
                                        ? `${Math.round(cheatDayFrequency / 7)}w`
                                        : option.label;

                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.frequencyOption,
                                                isSelected && styles.selectedFrequencyOption
                                            ]}
                                            onPress={() => handleFrequencyOptionSelect(option.id)}
                                        >
                                            <Text
                                                style={[
                                                    styles.frequencyOptionText,
                                                    isSelected && styles.selectedFrequencyOptionText
                                                ]}
                                            >
                                                {displayText}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={styles.frequencyDescription}>
                                {getFrequencyDescription()}
                            </Text>
                        </View>

                        <View style={styles.preferredDayContainer}>
                            <Text style={styles.frequencyTitle}>Preferred Cheat Day</Text>
                            <TouchableOpacity style={styles.daySelector} onPress={() => setShowDayPicker(true)}>
                                <Text style={styles.daySelectorText}>
                                    {preferredCheatDay !== undefined ? dayNames[preferredCheatDay] : 'From Today (Flexible)'}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.dayHintText}>
                                {preferredCheatDay !== undefined
                                    ? `Your cheat days will always fall on ${dayNames[preferredCheatDay]}s`
                                    : 'Choose a specific day of the week for your cheat days, or leave flexible'
                                }
                            </Text>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={20} color="#888" />
                <Text style={styles.infoText}>
                    You can always adjust these settings later in your profile
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
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Custom Frequency Modal */}
            <Modal
                visible={showCustomFrequencyModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCustomFrequencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Custom Frequency</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowCustomFrequencyModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.customFrequencyContent}>
                            <Text style={styles.customFrequencyLabel}>Enter number of weeks between cheat days:</Text>
                            <TextInput
                                style={styles.customFrequencyInput}
                                value={customFrequencyInput}
                                onChangeText={setCustomFrequencyInput}
                                placeholder="e.g., 2"
                                placeholderTextColor="#999"
                                keyboardType="number-pad"
                                autoFocus={true}
                            />
                            <Text style={styles.customFrequencyHint}>
                                Enter a value between 1 and 52 weeks
                            </Text>
                            <View style={styles.customFrequencyButtons}>
                                <TouchableOpacity
                                    style={styles.customFrequencyCancelButton}
                                    onPress={() => setShowCustomFrequencyModal(false)}
                                >
                                    <Text style={styles.customFrequencyCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.customFrequencySubmitButton}
                                    onPress={handleCustomFrequencySubmit}
                                >
                                    <Text style={styles.customFrequencySubmitText}>Set Frequency</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Day Picker Modal */}
            <Modal
                visible={showDayPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDayPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Preferred Cheat Day</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowDayPicker(false)}
                            >
                                <Ionicons name="close" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>
                        <WheelPicker
                            data={dayPickerData.map((day, index) => ({ id: index.toString(), label: day.label }))}
                            selectedValue={preferredCheatDay !== undefined ? (preferredCheatDay + 1).toString() : '0'}
                            onValueChange={(value: string) => {
                                const index = parseInt(value);
                                const selectedValue = dayPickerData[index].value;
                                setPreferredCheatDay(selectedValue);
                            }}
                            itemHeight={50}
                            containerStyle={styles.wheelPickerContainer}
                        />
                        <TouchableOpacity style={styles.modalButton} onPress={() => setShowDayPicker(false)}>
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
        paddingTop: 20,
        justifyContent: 'space-between',
    },
    header: {
        marginBottom: 32,
        paddingHorizontal: 20,
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    cheatDayToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    cheatDayToggleContent: {
        flex: 1,
        marginRight: 16,
    },
    cheatDayToggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    cheatDayToggleDescription: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 20,
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 2,
        justifyContent: 'center',
    },
    toggleSwitchActive: {
        backgroundColor: '#5c00dd',
    },
    toggleKnob: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignSelf: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleKnobActive: {
        alignSelf: 'flex-end',
    },
    frequencyContainer: {
        marginBottom: 20,
    },
    frequencyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    frequencyOptionsContainer: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 8,
    },
    frequencyOption: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    selectedFrequencyOption: {
        backgroundColor: '#5c00dd',
    },
    frequencyOptionText: {
        fontSize: 14,
        color: '#aaa',
        fontWeight: '600',
    },
    selectedFrequencyOptionText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    frequencyDescription: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 8,
        lineHeight: 20,
    },
    preferredDayContainer: {
        marginBottom: 20,
    },
    daySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        marginBottom: 8,
    },
    daySelectorText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    dayHintText: {
        fontSize: 14,
        color: '#aaa',
        marginTop: 8,
        lineHeight: 20,
    },
    infoContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginHorizontal: 20,
    },
    infoText: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 12,
    },
    button: {
        borderRadius: 12,
        overflow: 'hidden',
        marginHorizontal: 20,
        marginBottom: 20,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
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
    customFrequencyContent: {
        padding: 20,
    },
    customFrequencyLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    customFrequencyInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        marginBottom: 12,
    },
    customFrequencyHint: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
    },
    customFrequencyButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    customFrequencyCancelButton: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    customFrequencyCancelText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    customFrequencySubmitButton: {
        flex: 1,
        backgroundColor: '#5c00dd',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    customFrequencySubmitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
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

export default CheatDayStep;
