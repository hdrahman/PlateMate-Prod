import React, { useState, useCallback } from 'react';
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
import apiService from '../utils/apiService';

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

// Separate component for health rating slider to isolate animations
interface HealthRatingSliderProps {
    healthRating: number;
    onRatingChange: (rating: number) => void;
}

const HealthRatingSlider = React.memo(({ healthRating, onRatingChange }: HealthRatingSliderProps) => {
    const sliderOffset = useSharedValue(0);
    const indicatorRadius = 8;
    const sliderWidth = 280 - (indicatorRadius * 2);

    // Initialize slider position based on current rating
    React.useEffect(() => {
        const position = ((healthRating - 1) / 9) * sliderWidth;
        sliderOffset.value = position;
    }, [healthRating, sliderWidth]);

    // Memoized callback to prevent recreation on every render
    const updateHealthRating = useCallback((newRating: number) => {
        onRatingChange(newRating);
    }, [onRatingChange]);

    // Memoized pan gesture
    const panGesture = React.useMemo(() => 
        Gesture.Pan()
            .onStart(() => {})
            .onUpdate((event) => {
                const adjustedX = event.x - indicatorRadius;
                const currentX = Math.max(0, Math.min(sliderWidth, adjustedX));
                const percentage = currentX / sliderWidth;
                const rawRating = 1 + (percentage * 9);
                const newRating = Math.max(1, Math.min(10, Math.round(rawRating)));
                
                sliderOffset.value = currentX;
                runOnJS(updateHealthRating)(newRating);
            })
            .onEnd((event) => {
                const adjustedX = event.x - indicatorRadius;
                const currentX = Math.max(0, Math.min(sliderWidth, adjustedX));
                const percentage = currentX / sliderWidth;
                const rawRating = 1 + (percentage * 9);
                const newRating = Math.max(1, Math.min(10, Math.round(rawRating)));
                const finalPosition = ((newRating - 1) / 9) * sliderWidth;
                sliderOffset.value = finalPosition;
            })
    , [sliderWidth, indicatorRadius, updateHealthRating]);

    // Memoized animated style
    const sliderIndicatorStyle = useAnimatedStyle(() => ({
        left: sliderOffset.value + indicatorRadius,
    }), []);

    // Memoized color calculation
    const getHealthinessColor = useCallback((rating: number): string => {
        if (rating <= 4) return '#FF5252';
        if (rating <= 7) return '#FFD740';
        return '#4CAF50';
    }, []);

    // Memoized rating label
    const getHealthRatingLabel = useCallback((rating: number): string => {
        if (rating <= 2) return 'Very Poor';
        if (rating <= 4) return 'Poor';
        if (rating <= 6) return 'Fair';
        if (rating <= 7) return 'Good';
        if (rating <= 8.5) return 'Very Good';
        return 'Excellent';
    }, []);

    const healthColor = getHealthinessColor(healthRating);
    const healthLabel = getHealthRatingLabel(healthRating);

    return (
        <View style={[styles.healthRatingCard, { backgroundColor: `${healthColor}15` }]}>
            {/* Rating Display Header */}
            <View style={styles.healthRatingHeader}>
                <View style={styles.healthRatingMainDisplay}>
                    <Text style={[styles.healthRatingScore, { color: healthColor }]}>
                        {Math.round(healthRating)}
                    </Text>
                    <Text style={styles.healthRatingMaxScore}>/10</Text>
                </View>
                <View style={styles.healthRatingStatus}>
                    <View style={[styles.healthRatingIndicator, { backgroundColor: healthColor }]} />
                    <Text style={[styles.healthRatingStatusText, { color: healthColor }]}>
                        {healthLabel}
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
    );
});

interface ManualFoodEntryProps {
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

// Memoize the main component to prevent unnecessary re-renders
const ManualFoodEntry = React.memo(({ visible, onClose, onAddFood }: ManualFoodEntryProps) => {
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

    // AI estimation state
    const [isEstimating, setIsEstimating] = useState<boolean>(false);

    // Health rating state
    const [healthRating, setHealthRating] = useState<number>(5);

    // Memoized form validation
    const isFormValid = React.useMemo(() => 
        foodName.trim() !== '' && calories.trim() !== '' && parseFloat(calories) > 0,
        [foodName, calories]
    );

    // Memoized meal options
    const mealOptions = React.useMemo(() => ['Breakfast', 'Lunch', 'Dinner', 'Snack'], []);

    // Memoized reset form function
    const resetForm = useCallback(() => {
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
        setIsEstimating(false);
    }, []);

    // Memoized AI estimation handler
    const handleAIEstimation = useCallback(async () => {
        if (!foodName.trim()) {
            Alert.alert('Error', 'Please enter a food name first');
            return;
        }

        if (isEstimating) {
            return; // Already estimating
        }

        setIsEstimating(true);

        try {
            console.log('Starting AI nutrition estimation for:', foodName);

            // Make API call to estimate nutrition using apiService
            const response = await apiService.post('/gpt/estimate-nutrition', {
                food_name: foodName.trim(),
                quantity: quantity || '1',
                serving_unit: servingUnit || 'serving'
            });

            if (response) {
                const estimation = response;
                console.log('AI estimation received:', estimation);

                // Update form fields with AI estimation
                setCalories(estimation.calories.toString());
                setProteins(estimation.proteins.toString());
                setCarbs(estimation.carbs.toString());
                setFats(estimation.fats.toString());
                setFiber(estimation.fiber.toString());
                setSugar(estimation.sugar.toString());
                setHealthRating(estimation.healthiness_rating);

                // Show success message with confidence level
                const confidenceMessage = estimation.confidence === 'high'
                    ? 'High confidence in estimates'
                    : estimation.confidence === 'medium'
                        ? 'Moderate confidence - please verify values'
                        : 'Low confidence - please double-check values';

                Alert.alert(
                    'AI Estimation Complete',
                    `Nutritional values have been estimated for "${foodName}". ${confidenceMessage}. You can still modify any values as needed.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error estimating nutrition:', error);

            let errorMessage = 'Failed to estimate nutrition. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Authentication failed. Please sign in again.';
            } else if (error.response?.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setIsEstimating(false);
        }
    }, [foodName, quantity, servingUnit]);

    // Memoized save handler
    const handleSave = useCallback(() => {
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
            brand_name: '', // Default empty brand name
            calories: parsedCalories,
            proteins: parsedProteins,
            carbs: parsedCarbs,
            fats: parsedFats,
            fiber: parsedFiber,
            sugar: parsedSugar,
            saturated_fat: -1, // Use -1 for fields not collected in manual entry (shows as "-")
            polyunsaturated_fat: -1,
            monounsaturated_fat: -1,
            trans_fat: -1,
            cholesterol: -1,
            sodium: -1,
            potassium: -1,
            vitamin_a: -1,
            vitamin_c: -1,
            calcium: -1,
            iron: -1,
            image: '', // Empty image for manual entry
            serving_unit: servingUnit,
            serving_weight_grams: 0,
            serving_qty: parsedQuantity,
            healthiness_rating: healthRating, // Use selected health rating
            notes: '' // Default empty notes
        };

        // Add food to log - let parent handle navigation and modal closing
        onAddFood(manualFoodItem, selectedMeal, parsedQuantity);

        // Reset form for next use
        resetForm();
    }, [foodName, calories, proteins, carbs, fats, fiber, sugar, quantity, servingUnit, selectedMeal, healthRating, onAddFood, resetForm]);

    // Memoized health rating change handler
    const handleHealthRatingChange = useCallback((newRating: number) => {
        setHealthRating(newRating);
    }, []);

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

                    <ScrollView
                        style={styles.content}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    >
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
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Basic Information</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.aiButton,
                                        (!foodName.trim() || isEstimating) && styles.aiButtonDisabled
                                    ]}
                                    onPress={handleAIEstimation}
                                    disabled={!foodName.trim() || isEstimating}
                                >
                                    {isEstimating ? (
                                        <View style={styles.aiButtonContent}>
                                            <Text style={styles.aiButtonText}>...</Text>
                                        </View>
                                    ) : (
                                        <LinearGradient
                                            colors={['#0074dd', '#5c00dd', '#dd0095']}
                                            style={styles.aiButtonGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            <Text style={styles.aiButtonText}>AI</Text>
                                        </LinearGradient>
                                    )}
                                </TouchableOpacity>
                            </View>

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
                            <HealthRatingSlider 
                                healthRating={healthRating}
                                onRatingChange={handleHealthRatingChange}
                            />
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
});

export default ManualFoodEntry;

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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    aiButton: {
        width: 40,
        height: 30,
        borderRadius: 15,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    aiButtonDisabled: {
        opacity: 0.5,
    },
    aiButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiButtonContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 15,
    },
    aiButtonText: {
        color: WHITE,
        fontSize: 12,
        fontWeight: 'bold',
    },
}); 