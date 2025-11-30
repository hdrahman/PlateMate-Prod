import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';

const { width } = Dimensions.get('window');

interface StepTrackingModeModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectMode: (mode: 'with_calories' | 'without_calories') => void;
    currentMode?: 'with_calories' | 'without_calories';
}

const StepTrackingModeModal: React.FC<StepTrackingModeModalProps> = ({
    visible,
    onClose,
    onSelectMode,
    currentMode = 'with_calories',
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [selectedMode, setSelectedMode] = useState<'with_calories' | 'without_calories'>(currentMode);
    const [showInfo, setShowInfo] = useState(false);

    const handleConfirm = () => {
        onSelectMode(selectedMode);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.5)' }]}>
                <View style={[styles.modalContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Step Tracking Mode</Text>
                        <TouchableOpacity
                            style={styles.infoButton}
                            onPress={() => setShowInfo(!showInfo)}
                        >
                            <Ionicons
                                name={showInfo ? "close-circle" : "information-circle-outline"}
                                size={24}
                                color={theme.colors.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        How should we track your steps?
                    </Text>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Info Section */}
                        {showInfo && (
                            <View style={styles.infoBox}>
                                <Ionicons name="bulb-outline" size={20} color="#FFA726" />
                                <Text style={styles.infoText}>
                                    To help you reach your fitness goals, PlateMate uses your device's Motion & Fitness sensors (Pedometer) to track your daily step count.
                                    {'\n\n'}
                                    This data is used solely for displaying your activity progress and calculating calorie adjustments. Your step data is stored securely and is never shared with third parties for marketing purposes.
                                    {'\n\n'}
                                    You can choose how this data affects your nutrition goals below.
                                </Text>
                            </View>
                        )}

                        {/* Option 1: Steps + Calories (Recommended) */}
                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                { borderColor: theme.colors.border },
                                selectedMode === 'with_calories' && [styles.optionCardSelected, { borderColor: theme.colors.primary }],
                            ]}
                            onPress={() => setSelectedMode('with_calories')}
                        >
                            <View style={styles.optionHeader}>
                                <View style={styles.optionIconContainer}>
                                    <Ionicons name="walk" size={28} color="#4CAF50" />
                                </View>
                                <View style={styles.optionTitleContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Steps + Calories</Text>
                                    <View style={styles.recommendedBadge}>
                                        <Text style={styles.recommendedText}>RECOMMENDED</Text>
                                    </View>
                                </View>
                                {selectedMode === 'with_calories' && (
                                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                                )}
                            </View>
                            <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                                Your steps add bonus calories to your daily goal. We'll use a sedentary base for calories
                                but calculate protein and macros based on your actual activity level for optimal nutrition.
                            </Text>
                            <View style={styles.exampleBox}>
                                <Text style={[styles.exampleLabel, { color: theme.colors.textSecondary }]}>Example:</Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • Base calories: ~1,900 (sedentary)
                                </Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • + Step calories: variable
                                </Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • Protein: 180g (based on your actual activity)
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Option 2: Steps Only */}
                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                { borderColor: theme.colors.border },
                                selectedMode === 'without_calories' && [styles.optionCardSelected, { borderColor: theme.colors.primary }],
                            ]}
                            onPress={() => setSelectedMode('without_calories')}
                        >
                            <View style={styles.optionHeader}>
                                <View style={styles.optionIconContainer}>
                                    <Ionicons name="footsteps" size={28} color="#2196F3" />
                                </View>
                                <View style={styles.optionTitleContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Steps Only</Text>
                                </View>
                                {selectedMode === 'without_calories' && (
                                    <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                                )}
                            </View>
                            <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                                Track steps for motivation and progress tracking only. Your calories and macros are based
                                on your selected activity level, without step-based adjustments to your daily goal.
                            </Text>
                            <View style={styles.exampleBox}>
                                <Text style={[styles.exampleLabel, { color: theme.colors.textSecondary }]}>Example:</Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • Daily calories: ~2,400 (fixed based on activity level)
                                </Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • Protein: 180g (based on your activity level)
                                </Text>
                                <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                                    • Steps tracked but don't affect calorie goal
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>


                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={[styles.cancelButton, { backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} onPress={onClose}>
                            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <LinearGradient
                                colors={['#0074dd', '#5c00dd', '#dd0095']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.confirmButtonGradient}
                            >
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View >
        </Modal >
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        borderRadius: 20,
        width: Math.min(width - 40, 500),
        maxHeight: '85%',
        overflow: 'hidden',
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        flex: 1,
    },
    infoButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 16,
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    content: {
        paddingHorizontal: 24,
        maxHeight: 500,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 167, 38, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.3)',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#FFA726',
        marginLeft: 12,
        lineHeight: 20,
    },
    optionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
    },
    optionCardSelected: {
        backgroundColor: 'rgba(0, 116, 221, 0.1)',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    optionTitleContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    recommendedBadge: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    recommendedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4CAF50',
        letterSpacing: 0.5,
    },
    optionDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    exampleBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    exampleLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    exampleText: {
        fontSize: 13,
        marginBottom: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: 24,
        paddingTop: 16,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    confirmButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default StepTrackingModeModal;


