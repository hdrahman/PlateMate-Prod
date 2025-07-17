import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    TextInput,
    Alert,
    ViewStyle,
    TextStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateToString } from '../utils/dateUtils';
import { addWaterIntake, WATER_CONTAINER_TYPES, getUserProfile, getCurrentUserIdAsync } from '../utils/database';

interface WaterIntakeModalProps {
    visible: boolean;
    onClose: () => void;
    onWaterAdded: () => void;
    currentDate: Date;
}

// Constants for colors
const PRIMARY_BG = '#000000';
const WHITE = '#FFFFFF';
const PURPLE_ACCENT = '#AA00FF';
const CARD_BG = '#1C1C1E';
const SUBDUED = '#AAAAAA';

const WaterIntakeModal: React.FC<WaterIntakeModalProps> = ({
    visible,
    onClose,
    onWaterAdded,
    currentDate
}) => {
    // State variables
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
    const [customAmount, setCustomAmount] = useState('250');
    const [isCustomEntry, setIsCustomEntry] = useState(false);
    const [loading, setLoading] = useState(false);
    const [waterGoal, setWaterGoal] = useState(2000); // Default 2L goal

    // Load user's water goal from profile
    useEffect(() => {
        const loadWaterGoal = async () => {
            try {
                const uid = await getCurrentUserIdAsync();
                const profile: any = await getUserProfile(uid);

                if (profile && typeof profile.water_goal === 'number' && profile.water_goal > 0) {
                    setWaterGoal(profile.water_goal);
                } else {
                    // Set default based on best practices
                    setWaterGoal(2500); // 2.5L default for adults
                }
            } catch (error) {
                console.error('❌ Error loading water goal:', error);
            }
        };

        loadWaterGoal();
    }, []);

    // Function to reset form
    const resetForm = () => {
        setSelectedContainer(null);
        setCustomAmount('250');
        setIsCustomEntry(false);
    };

    // Function to handle modal close
    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Function to handle water intake submission
    const handleAddWaterIntake = async () => {
        console.log('handleAddWaterIntake called', { selectedContainer, isCustomEntry, customAmount });

        if (!selectedContainer && !isCustomEntry) {
            console.log('No container selected and not custom entry');
            Alert.alert('Error', 'Please select a container or enter a custom amount');
            return;
        }

        const amountMl = isCustomEntry ? parseInt(customAmount) : WATER_CONTAINER_TYPES[selectedContainer as keyof typeof WATER_CONTAINER_TYPES].ml;
        console.log('Amount calculated:', amountMl);

        if (amountMl <= 0 || amountMl > 3000) {
            Alert.alert('Error', 'Please enter a valid amount between 1ml and 3000ml');
            return;
        }

        setLoading(true);
        try {
            const containerType = isCustomEntry ? 'custom' : selectedContainer || 'custom';
            console.log('Adding water intake:', { amountMl, containerType });
            await addWaterIntake(amountMl, containerType);

            Alert.alert('Success', `${amountMl}ml of water added!`);
            onWaterAdded();
            handleClose();
        } catch (error) {
            console.error('❌ Error adding water intake:', error);
            Alert.alert('Error', 'Failed to add water intake. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Function to get better icons for containers
    const getContainerIcon = (type: string) => {
        switch (type) {
            case 'GLASS':
                return 'wine-outline';
            case 'BOTTLE':
                return 'beaker-outline'; // Use beaker-outline for bottle
            case 'LARGE_BOTTLE':
                return 'pint-outline'; // Use pint-outline for large bottle
            case 'CUP':
                return 'cafe-outline';
            default:
                return 'water-outline';
        }
    };

    // Function to render container button
    const renderContainerButton = (type: string, container: typeof WATER_CONTAINER_TYPES[keyof typeof WATER_CONTAINER_TYPES]) => {
        const isSelected = selectedContainer === type;

        return (
            <TouchableOpacity
                key={type}
                style={[
                    styles.containerButton,
                    isSelected && styles.selectedContainer
                ]}
                onPress={() => {
                    setSelectedContainer(type);
                    setIsCustomEntry(false);
                    setCustomAmount('');
                }}
            >
                <Ionicons name={getContainerIcon(type)} size={32} color={isSelected ? PURPLE_ACCENT : WHITE} />
                <Text style={styles.containerName}>{container.name}</Text>
                <Text style={styles.containerAmount}>{container.ml}ml</Text>
            </TouchableOpacity>
        );
    };

    // Calculate recommended daily intake based on best practices
    const getDailyRecommendation = () => {
        // Based on research: 35ml per kg of body weight, minimum 2L
        return Math.max(2000, waterGoal);
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                {/* Backdrop touchable area */}
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Text style={styles.headerTitle}>Add Water Intake</Text>
                            <Text style={styles.headerSubtitle}>
                                {formatDateToString(currentDate)}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={WHITE} />
                        </TouchableOpacity>
                    </View>

                    {/* Daily Goal Info */}
                    <View style={styles.goalInfo}>
                        <Ionicons name="water" size={20} color={PURPLE_ACCENT} />
                        <Text style={styles.goalText}>
                            Daily Goal: {getDailyRecommendation()}ml ({(getDailyRecommendation() / 1000).toFixed(1)}L)
                        </Text>
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {/* Quick Add Containers */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Quick Add</Text>
                            <View style={styles.containerGrid}>
                                {/* Cup (top left), Glass (top right), Bottle (bottom left), Large Bottle (bottom right) */}
                                <View style={styles.gridRow}>
                                    {renderContainerButton('CUP', WATER_CONTAINER_TYPES['CUP'])}
                                    {renderContainerButton('GLASS', WATER_CONTAINER_TYPES['GLASS'])}
                                </View>
                                <View style={styles.gridRow}>
                                    {renderContainerButton('BOTTLE', WATER_CONTAINER_TYPES['BOTTLE'])}
                                    {renderContainerButton('LARGE_BOTTLE', WATER_CONTAINER_TYPES['LARGE_BOTTLE'])}
                                </View>
                            </View>
                        </View>

                        {/* Custom Amount - Integrated with Quick Add */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Custom Amount</Text>
                            <View style={styles.customSection}>
                                <View style={[
                                    styles.customInputWrapper,
                                    isCustomEntry && styles.selectedContainer
                                ]}>
                                    <TextInput
                                        style={styles.customInput}
                                        value={customAmount}
                                        onChangeText={(text) => {
                                            console.log('Custom input changed:', text);
                                            setCustomAmount(text);
                                        }}
                                        placeholder="Enter amount"
                                        placeholderTextColor={SUBDUED}
                                        keyboardType="numeric"
                                        onFocus={() => {
                                            console.log('Custom input focused');
                                            setIsCustomEntry(true);
                                            setSelectedContainer(null);
                                        }}
                                    />
                                    <Text style={styles.unitText}>ml</Text>
                                </View>
                            </View>
                        </View>

                        {/* Hydration Tips - Compact */}
                        <View style={styles.tipsSection}>
                            <View style={styles.tipsTitleContainer}>
                                <Ionicons name="bulb-outline" size={16} color={PURPLE_ACCENT} />
                                <Text style={styles.tipsTitle}>Quick Tips</Text>
                            </View>
                            <Text style={styles.compactTips}>
                                Drink before meals • Start your day with water • Keep hydrated during exercise
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Add Button */}
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            loading && styles.disabledButton
                        ]}
                        onPress={handleAddWaterIntake}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#AA00FF', '#6200FF']}
                            style={styles.gradientButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.addButtonText}>
                                {loading ? 'Adding...' : 'Add Water Intake'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        minHeight: 600,
        maxHeight: '92%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        color: SUBDUED,
    },
    closeButton: {
        padding: 4,
    },
    goalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(170, 0, 255, 0.1)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 16,
    },
    goalText: {
        color: WHITE,
        fontSize: 13,
        marginLeft: 8,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 10,
    },
    containerGrid: {
        marginHorizontal: -2,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    containerButton: {
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        width: '48%',
        minHeight: 90,
        marginBottom: 8,
        marginHorizontal: 2,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedContainer: {
        borderColor: PURPLE_ACCENT,
        backgroundColor: 'rgba(170, 0, 255, 0.1)',
    },
    containerName: {
        color: WHITE,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
        marginTop: 8,
    },
    containerAmount: {
        color: SUBDUED,
        fontSize: 12,
    },
    customSection: {
        alignItems: 'center',
    },
    customInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    customInput: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
        textAlign: 'center',
    },
    selectedCustomInput: {
        borderColor: PURPLE_ACCENT,
    },
    unitText: {
        color: SUBDUED,
        fontSize: 16,
        marginLeft: 8,
    },
    tipsSection: {
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    tipsTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    tipsTitle: {
        color: WHITE,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    compactTips: {
        color: SUBDUED,
        fontSize: 12,
        lineHeight: 16,
    },
    addButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    disabledButton: {
        opacity: 0.5,
    },
    gradientButton: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default WaterIntakeModal;
