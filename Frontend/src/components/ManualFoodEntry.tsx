import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    Alert,
    Platform,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    clamp
} from 'react-native-reanimated';
import { FoodItem } from '../services/BarcodeService';

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#0074dd';
const PURPLE_ACCENT = '#AA00FF';

// GradientBorderCard component for consistent card styling
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
    return (
        <View style={[styles.gradientBorderContainer, style]}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 10,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1,
                    borderRadius: 9,
                    backgroundColor: '#121212',
                    padding: 16,
                }}
            >
                {children}
            </View>
        </View>
    );
};

interface ManualFoodEntryProps {
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

export default function ManualFoodEntry({ visible, onClose, onAddFood }: ManualFoodEntryProps) {
    const [foodName, setFoodName] = useState<string>('');
    const [calories, setCalories] = useState<string>('');
    const [proteins, setProteins] = useState<string>('0');
    const [carbs, setCarbs] = useState<string>('0');
    const [fats, setFats] = useState<string>('0');
    const [selectedMeal, setSelectedMeal] = useState<string>('Breakfast');
    const [quantity, setQuantity] = useState<string>('1');
    const [servingUnit, setServingUnit] = useState<string>('serving');

    // Optional nutrients with default value 0
    const [fiber, setFiber] = useState<string>('0');
    const [sugar, setSugar] = useState<string>('0');

    // Health rating state and animation values
    const [healthRating, setHealthRating] = useState<number>(5);
    const sliderOffset = useSharedValue(0);
    const indicatorRadius = 8; // Half of indicator width (16/2)
    const sliderWidth = 280 - (indicatorRadius * 2); // Account for indicator size on both ends

    // Initialize slider position based on current rating
    React.useEffect(() => {
        const position = ((healthRating - 1) / 9) * sliderWidth;
        sliderOffset.value = position;
    }, [healthRating, sliderWidth]);

    // Update health rating from gesture
    const updateHealthRating = (newRating: number) => {
        setHealthRating(newRating);
    };

    // Pan gesture for smooth slider interaction
    const panGesture = Gesture.Pan()
        .onStart(() => {
            // Store the current position when starting the gesture
        })
        .onUpdate((event) => {
            // Use x coordinate but account for indicator radius padding
            const adjustedX = event.x - indicatorRadius;
            const currentX = Math.max(0, Math.min(sliderWidth, adjustedX));
            const percentage = currentX / sliderWidth;
            const rawRating = 1 + (percentage * 9);
            const newRating = Math.max(1, Math.min(10, Math.round(rawRating)));

            // Update the visual position immediately
            sliderOffset.value = currentX;

            // Update the rating state
            runOnJS(updateHealthRating)(newRating);
        })
        .onEnd((event) => {
            // Snap to the final position based on the final rating
            const adjustedX = event.x - indicatorRadius;
            const currentX = Math.max(0, Math.min(sliderWidth, adjustedX));
            const percentage = currentX / sliderWidth;
            const rawRating = 1 + (percentage * 9);
            const newRating = Math.max(1, Math.min(10, Math.round(rawRating)));
            const finalPosition = ((newRating - 1) / 9) * sliderWidth;
            sliderOffset.value = finalPosition;
        });

    // Animated style for the slider indicator
    const sliderIndicatorStyle = useAnimatedStyle(() => ({
        left: sliderOffset.value + indicatorRadius,
    }));

    // Check if form is valid (has food name and calories)
    const isFormValid = foodName.trim() !== '' && calories.trim() !== '' && parseFloat(calories) > 0;

    // Meal options
    const mealOptions = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    // Get color based on healthiness rating
    const getHealthinessColor = (rating: number): string => {
        if (rating <= 4) return '#FF5252'; // Red for unhealthy (0-4)
        if (rating <= 7) return '#FFD740'; // Yellow for moderate (5-7)
        return '#4CAF50'; // Green for healthy (8-10)
    };

    // Get health rating label
    const getHealthRatingLabel = (rating: number): string => {
        if (rating <= 2) return 'Very Poor';
        if (rating <= 4) return 'Poor';
        if (rating <= 6) return 'Fair';
        if (rating <= 7) return 'Good';
        if (rating <= 8.5) return 'Very Good';
        return 'Excellent';
    };

    // Reset form
    const resetForm = () => {
        setFoodName('');
        setCalories('');
        setProteins('0');
        setCarbs('0');
        setFats('0');
        setFiber('0');
        setSugar('0');
        setSelectedMeal('Breakfast');
        setQuantity('1');
        setServingUnit('serving');
        setHealthRating(5);
    };

    // Handle save
    const handleSave = () => {
        // Validate required fields
        if (!foodName.trim()) {
            Alert.alert('Error', 'Please enter a food name');
            return;
        }

        if (!calories.trim() || parseFloat(calories) <= 0) {
            Alert.alert('Error', 'Please enter valid calories');
            return;
        }

        // Parse numeric values, defaulting to 0 if invalid
        const parsedCalories = parseFloat(calories) || 0;
        const parsedProteins = parseFloat(proteins) || 0;
        const parsedCarbs = parseFloat(carbs) || 0;
        const parsedFats = parseFloat(fats) || 0;
        const parsedFiber = parseFloat(fiber) || 0;
        const parsedSugar = parseFloat(sugar) || 0;
        const parsedQuantity = parseFloat(quantity) || 1;

        // Create food item
        const manualFoodItem: FoodItem = {
            food_name: foodName,
            calories: parsedCalories,
            proteins: parsedProteins,
            carbs: parsedCarbs,
            fats: parsedFats,
            fiber: parsedFiber,
            sugar: parsedSugar,
            saturated_fat: 0,
            polyunsaturated_fat: 0,
            monounsaturated_fat: 0,
            trans_fat: 0,
            cholesterol: 0,
            sodium: 0,
            potassium: 0,
            vitamin_a: 0,
            vitamin_c: 0,
            calcium: 0,
            iron: 0,
            image: '',
            serving_unit: servingUnit,
            serving_weight_grams: 0,
            serving_qty: parsedQuantity,
            healthiness_rating: healthRating, // Use selected health rating
        };

        // Add food to log
        onAddFood(manualFoodItem, selectedMeal, parsedQuantity);

        // Reset form and close modal
        resetForm();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={WHITE} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Manual Food Entry</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView style={styles.content}>
                        {/* Meal Type Selector - Moved to top */}
                        <GradientBorderCard style={styles.section}>
                            <Text style={styles.sectionTitle}>Add to Meal</Text>
                            <View style={styles.mealOptions}>
                                {mealOptions.map((meal, index) => {
                                    const isBreakfast = meal === 'Breakfast';
                                    return (
                                        <TouchableOpacity
                                            key={meal}
                                            style={[
                                                styles.mealOption,
                                                selectedMeal === meal && styles.selectedMealOption,
                                                index === mealOptions.length - 1 && { marginRight: 0 },
                                                isBreakfast && { flex: 1.2 } // Give more space to "Breakfast"
                                            ]}
                                            onPress={() => setSelectedMeal(meal)}
                                        >
                                            <Text
                                                style={[
                                                    styles.mealOptionText,
                                                    selectedMeal === meal && styles.selectedMealOptionText
                                                ]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {meal}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </GradientBorderCard>

                        {/* Basic Info */}
                        <GradientBorderCard style={styles.section}>
                            <Text style={styles.sectionTitle}>Basic Information</Text>

                            {/* Food Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Food Name*</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter food name"
                                    placeholderTextColor={GRAY}
                                    value={foodName}
                                    onChangeText={setFoodName}
                                />
                            </View>

                            {/* Serving Info */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                    <Text style={styles.label}>Quantity</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="1"
                                        placeholderTextColor={GRAY}
                                        value={quantity}
                                        onChangeText={setQuantity}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1.5 }]}>
                                    <Text style={styles.label}>Unit</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="serving"
                                        placeholderTextColor={GRAY}
                                        value={servingUnit}
                                        onChangeText={setServingUnit}
                                    />
                                </View>
                            </View>
                        </GradientBorderCard>

                        {/* Nutrition Facts */}
                        <GradientBorderCard style={styles.section}>
                            <Text style={styles.sectionTitle}>Nutrition Facts</Text>

                            {/* Calories */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Calories*</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter calories"
                                    placeholderTextColor={GRAY}
                                    value={calories}
                                    onChangeText={setCalories}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Macronutrients Grid */}
                            <Text style={styles.subSectionTitle}>Macronutrients (g)</Text>
                            <View style={styles.macroRow}>
                                <View style={[styles.macroInputGroup, { marginRight: 10 }]}>
                                    <Text style={styles.macroLabel}>Protein</Text>
                                    <TextInput
                                        style={styles.macroInput}
                                        placeholder="0"
                                        placeholderTextColor={GRAY}
                                        value={proteins}
                                        onChangeText={setProteins}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.macroInputGroup, { marginRight: 10 }]}>
                                    <Text style={styles.macroLabel}>Carbs</Text>
                                    <TextInput
                                        style={styles.macroInput}
                                        placeholder="0"
                                        placeholderTextColor={GRAY}
                                        value={carbs}
                                        onChangeText={setCarbs}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.macroInputGroup}>
                                    <Text style={styles.macroLabel}>Fat</Text>
                                    <TextInput
                                        style={styles.macroInput}
                                        placeholder="0"
                                        placeholderTextColor={GRAY}
                                        value={fats}
                                        onChangeText={setFats}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {/* Additional Nutrients */}
                            <Text style={styles.subSectionTitle}>Additional (g)</Text>
                            <View style={styles.macroRow}>
                                <View style={[styles.macroInputGroup, { marginRight: 10 }]}>
                                    <Text style={styles.macroLabel}>Fiber</Text>
                                    <TextInput
                                        style={styles.macroInput}
                                        placeholder="0"
                                        placeholderTextColor={GRAY}
                                        value={fiber}
                                        onChangeText={setFiber}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.macroInputGroup, { marginRight: 10 }]}>
                                    <Text style={styles.macroLabel}>Sugar</Text>
                                    <TextInput
                                        style={styles.macroInput}
                                        placeholder="0"
                                        placeholderTextColor={GRAY}
                                        value={sugar}
                                        onChangeText={setSugar}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.macroInputGroup}>
                                    <Text style={styles.macroLabel}></Text>
                                </View>
                            </View>
                        </GradientBorderCard>

                        {/* Health Rating */}
                        <GradientBorderCard style={styles.section}>
                            <Text style={styles.sectionTitle}>Health Rating</Text>
                            <Text style={styles.healthRatingSubtitle}>How nutritious is this food?</Text>

                            {/* Health Rating Card */}
                            <View style={[styles.healthRatingCard, { backgroundColor: `${getHealthinessColor(healthRating)}15` }]}>
                                {/* Rating Display Header */}
                                <View style={styles.healthRatingHeader}>
                                    <View style={styles.healthRatingMainDisplay}>
                                        <Text style={[styles.healthRatingScore, { color: getHealthinessColor(healthRating) }]}>
                                            {Math.round(healthRating)}
                                        </Text>
                                        <Text style={styles.healthRatingMaxScore}>/10</Text>
                                    </View>
                                    <View style={styles.healthRatingStatus}>
                                        <View style={[styles.healthRatingIndicator, { backgroundColor: getHealthinessColor(healthRating) }]} />
                                        <Text style={[styles.healthRatingStatusText, { color: getHealthinessColor(healthRating) }]}>
                                            {getHealthRatingLabel(healthRating)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Visual Rating Bar */}
                                <View style={styles.healthRatingBarContainer}>
                                    <GestureDetector gesture={panGesture}>
                                        <View style={styles.healthRatingBarBackground}>
                                            <LinearGradient
                                                colors={['#FF5252', '#FFD740', '#4CAF50']}
                                                style={styles.healthRatingBarGradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                            />
                                            <Animated.View style={[
                                                styles.healthRatingBarIndicator,
                                                sliderIndicatorStyle
                                            ]} />
                                        </View>
                                    </GestureDetector>
                                    <View style={styles.healthRatingBarLabels}>
                                        <Text style={styles.healthRatingBarLabel}>Poor</Text>
                                        <Text style={styles.healthRatingBarLabel}>Good</Text>
                                        <Text style={styles.healthRatingBarLabel}>Excellent</Text>
                                    </View>
                                </View>

                                {/* Rating Guidelines */}
                                <View style={styles.healthRatingGuidelines}>
                                    <Text style={styles.healthRatingGuidelinesTitle}>Rating Guide</Text>
                                    <View style={styles.healthRatingGuidelinesList}>
                                        <View style={styles.healthRatingGuideline}>
                                            <View style={[styles.healthRatingGuidelineDot, { backgroundColor: '#FF5252' }]} />
                                            <Text style={styles.healthRatingGuidelineText}>1-4: Processed, high sugar/sodium</Text>
                                        </View>
                                        <View style={styles.healthRatingGuideline}>
                                            <View style={[styles.healthRatingGuidelineDot, { backgroundColor: '#FFD740' }]} />
                                            <Text style={styles.healthRatingGuidelineText}>5-7: Moderate nutrition value</Text>
                                        </View>
                                        <View style={styles.healthRatingGuideline}>
                                            <View style={[styles.healthRatingGuidelineDot, { backgroundColor: '#4CAF50' }]} />
                                            <Text style={styles.healthRatingGuidelineText}>8-10: Whole foods, nutrient-dense</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </GradientBorderCard>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={!isFormValid}
                        >
                            <LinearGradient
                                colors={isFormValid ? ["#0074dd", "#5c00dd", "#dd0095"] : ["#444444", "#333333", "#222222"]}
                                style={[
                                    styles.saveGradient,
                                    !isFormValid && styles.disabledButton
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={[
                                    styles.saveButtonText,
                                    !isFormValid && styles.disabledButtonText
                                ]}>Save Food</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 16,
    },
    subSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginTop: 16,
        marginBottom: 8,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: WHITE,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mealOptions: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    mealOption: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        marginRight: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
    },
    selectedMealOption: {
        backgroundColor: PURPLE_ACCENT,
    },
    mealOptionText: {
        color: WHITE,
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    selectedMealOptionText: {
        fontWeight: 'bold',
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroInputGroup: {
        flex: 1,
    },
    macroLabel: {
        color: WHITE,
        fontSize: 14,
        marginBottom: 8,
    },
    macroInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    // Health Rating Styles
    healthRatingSubtitle: {
        fontSize: 14,
        color: GRAY,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    healthRatingCard: {
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
    },
    healthRatingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    healthRatingMainDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    healthRatingScore: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    healthRatingMaxScore: {
        fontSize: 18,
        color: GRAY,
        marginLeft: 4,
    },
    healthRatingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    healthRatingIndicator: {
        position: 'absolute',
        top: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: WHITE,
        borderWidth: 3,
        borderColor: '#333',
        marginLeft: -8,
    },
    healthRatingStatusText: {
        fontSize: 16,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    healthRatingBarContainer: {
        marginBottom: 24,
    },
    healthRatingBarBackground: {
        height: 8,
        borderRadius: 4,
        position: 'relative',
        marginBottom: 16,
        marginHorizontal: 8,
    },
    healthRatingBarGradient: {
        flex: 1,
        borderRadius: 4,
    },
    healthRatingBarIndicator: {
        position: 'absolute',
        top: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: WHITE,
        borderWidth: 3,
        borderColor: '#333',
        marginLeft: -8,
    },
    healthRatingBarLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginTop: 4,
    },
    healthRatingBarLabel: {
        fontSize: 12,
        color: GRAY,
        fontWeight: '500',
    },
    healthRatingSliderSection: {
        marginBottom: 24,
    },
    healthRatingSliderTitle: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '600',
        marginBottom: 16,
    },
    healthRatingSliderContainer: {
        marginBottom: 16,
    },
    healthRatingSliderTrack: {
        marginBottom: 16,
    },
    healthRatingSlider: {
        width: '100%',
        height: 40,
    },
    healthRatingSliderNumbers: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    healthRatingNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    healthRatingNumberActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    healthRatingNumberText: {
        fontSize: 12,
        color: GRAY,
        fontWeight: '600',
    },
    healthRatingGuidelines: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 16,
    },
    healthRatingGuidelinesTitle: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '600',
        marginBottom: 12,
    },
    healthRatingGuidelinesList: {
        gap: 8,
    },
    healthRatingGuideline: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    healthRatingGuidelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12,
    },
    healthRatingGuidelineText: {
        fontSize: 13,
        color: GRAY,
        flex: 1,
    },
    sliderContainer: {
        marginBottom: 8,
    },
    sliderWrapper: {
        flex: 1,
        marginHorizontal: 8,
    },
    sliderTrackBackground: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        marginTop: -3,
        zIndex: 0,
    },
    sliderGradientTrack: {
        position: 'absolute',
        top: '50%',
        left: 0,
        height: 6,
        borderRadius: 3,
        marginTop: -3,
        zIndex: 1,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    saveButton: {
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        marginVertical: 24,
    },
    saveGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    gradientBorderContainer: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    disabledButton: {
        opacity: 0.5,
    },
    disabledButtonText: {
        color: 'rgba(255, 255, 255, 0.5)',
    },
}); 