import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    StatusBar,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodItem } from '../services/BarcodeService';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';
import { ThemeContext } from '../ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface FoodDetailsProps {
    food: FoodItem;
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

// Theme colors matching FoodDetail.tsx
const MACRO_COLORS = {
    carbs: '#4FC3F7',
    protein: '#66BB6A',
    fat: '#FFB74D'
};

export default function FoodDetails({ food, visible, onClose, onAddFood }: FoodDetailsProps) {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [quantity, setQuantity] = useState('1');
    const [selectedMealType, setSelectedMealType] = useState('Breakfast');
    const [notes, setNotes] = useState('');

    // Calculate nutrient based on quantity
    const calculateNutrient = (value: number) => {
        const qtyValue = parseFloat(quantity) || 1;
        return Math.round(value * qtyValue);
    };

    // Helper function to get color based on healthiness rating
    const getHealthinessColor = (rating: number): string => {
        if (rating <= 4) return theme.colors.error; // Red for unhealthy (0-4)
        if (rating <= 7) return theme.colors.warning; // Yellow for moderate (5-7)
        return theme.colors.success; // Green for healthy (8-10)
    };

    // Helper function to format macro percentages
    const getMacroPercentages = () => {
        const totalCals = calculateNutrient(food.calories);
        if (totalCals === 0) return { carbs: 0, fat: 0, protein: 0 };

        const carbCals = calculateNutrient(food.carbs) * 4;
        const fatCals = calculateNutrient(food.fats) * 9;
        const proteinCals = calculateNutrient(food.proteins) * 4;

        return {
            carbs: Math.round((carbCals / totalCals) * 100),
            fat: Math.round((fatCals / totalCals) * 100),
            protein: Math.round((proteinCals / totalCals) * 100)
        };
    };

    // Daily value percentages (simplified estimates)
    const getDailyValuePercentage = (nutrient: string, value: number): number => {
        const dailyValues: { [key: string]: number } = {
            fiber: 25,
            sugar: 50,
            saturated_fat: 20,
            cholesterol: 300,
            sodium: 2300,
            potassium: 3500,
            vitamin_a: 900,
            vitamin_c: 90,
            calcium: 1000,
            iron: 18
        };

        const dv = dailyValues[nutrient];
        if (!dv) return 0;
        return Math.min(Math.round((value / dv) * 100), 100);
    };

    // Render nutrient row with progress bar
    const renderNutrientRowWithProgress = (
        icon: string,
        label: string,
        value: number,
        unit: string = 'g',
        color: string = theme.colors.textSecondary,
        showProgress: boolean = false,
        nutrientKey?: string
    ) => {
        const calcValue = calculateNutrient(value);
        const percentage = nutrientKey ? getDailyValuePercentage(nutrientKey, calcValue) : 0;

        if (!hasNutritionalValue(value)) return null;

        return (
            <View style={styles.nutrientRowWithProgress}>
                <View style={styles.nutrientRowHeader}>
                    <View style={styles.nutrientRowLeft}>
                        <Ionicons name={icon as any} size={16} color={color} style={styles.nutrientIcon} />
                        <Text style={[styles.nutrientLabel, { color: theme.colors.text }]}>{label}</Text>
                    </View>
                    <View style={styles.nutrientRowRight}>
                        <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>
                            {formatNutritionalValue(calcValue, unit, calcValue < 1 && calcValue > 0 ? 1 : 0)}
                        </Text>
                        {showProgress && percentage > 0 && (
                            <Text style={[styles.percentageText, { color: theme.colors.textSecondary }]}>{percentage}%</Text>
                        )}
                    </View>
                </View>
                {showProgress && percentage > 0 && (
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarBackground, { backgroundColor: theme.colors.border }]}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${percentage}%`, backgroundColor: color }
                                ]}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // Render macro circle (matching FoodDetail.tsx exactly)
    const renderMacroCircle = (label: string, value: number, unit: string, percentage: number, color: string) => (
        <View style={styles.macroCircle}>
            <View style={[styles.macroCircleInner, { borderColor: color }]}>
                <Text style={[styles.macroValue, { color: theme.colors.text }]}>{formatNutritionalValue(calculateNutrient(value), unit)}</Text>
                {hasNutritionalValue(value) && (
                    <Text style={[styles.macroPercentage, { color: theme.colors.textSecondary }]}>{percentage}%</Text>
                )}
            </View>
            <Text style={[styles.macroLabel, { color: theme.colors.text }]}>{label}</Text>
        </View>
    );

    const handleAddFood = () => {
        const qtyValue = parseFloat(quantity) || 1;

        const adjustedFood = {
            ...food,
            calories: calculateNutrient(food.calories),
            proteins: calculateNutrient(food.proteins),
            carbs: calculateNutrient(food.carbs),
            fats: calculateNutrient(food.fats),
            fiber: calculateNutrient(food.fiber),
            sugar: calculateNutrient(food.sugar),
            saturated_fat: calculateNutrient(food.saturated_fat),
            polyunsaturated_fat: calculateNutrient(food.polyunsaturated_fat),
            monounsaturated_fat: calculateNutrient(food.monounsaturated_fat),
            trans_fat: calculateNutrient(food.trans_fat),
            cholesterol: calculateNutrient(food.cholesterol),
            sodium: calculateNutrient(food.sodium),
            potassium: calculateNutrient(food.potassium),
            vitamin_a: calculateNutrient(food.vitamin_a),
            vitamin_c: calculateNutrient(food.vitamin_c),
            calcium: calculateNutrient(food.calcium),
            iron: calculateNutrient(food.iron),
            serving_qty: qtyValue,
            notes: notes
        };

        onAddFood(adjustedFood, selectedMealType, qtyValue);
    };

    const macroPercentages = getMacroPercentages();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Image Section (Dark Background with Controls) - Matching FoodDetail.tsx */}
                    <View style={styles.imageSection}>
                        <LinearGradient
                            colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']}
                            style={styles.imageSectionGradient}
                        />

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', theme.colors.background]}
                            style={styles.bottomGradient}
                        />

                        {/* Header with safe area padding */}
                        <SafeAreaView style={styles.headerContainer} edges={['top']}>
                            <View style={styles.header}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={styles.headerButton}
                                >
                                    <View style={[styles.headerButtonBackground, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                                <TouchableOpacity style={styles.headerButton}>
                                    <View style={[styles.headerButtonBackground, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Ionicons name="heart-outline" size={22} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>

                        {/* Food Details Overlay - Centered Name + Brand */}
                        <View style={styles.foodInfoOverlay}>
                            <Text style={styles.foodName}>{food.food_name}</Text>
                            {food.brand_name && (
                                <Text style={styles.brandName}>{food.brand_name}</Text>
                            )}
                        </View>
                    </View>

                    {/* Main Content Container */}
                    <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
                        {/* Calories Section */}
                        <View style={styles.calorieSection}>
                            <View style={styles.calorieAlignmentContainer}>
                                <View style={styles.calorieRow}>
                                    <Text style={[styles.calorieNumber, { color: theme.colors.text }]}>{calculateNutrient(food.calories)}</Text>
                                    <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>calories</Text>
                                </View>
                            </View>
                        </View>

                        {/* Quantity controls and Add button row - inline (below calories) */}
                        <View style={styles.quantityAndAddRow}>
                            <View style={styles.quantityControlsInline}>
                                <TouchableOpacity
                                    style={[styles.quantityButtonInline, { backgroundColor: theme.colors.border }]}
                                    onPress={() => setQuantity(String(Math.max(0.25, parseFloat(quantity) - 0.25)))}
                                >
                                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.quantityInputInline, { backgroundColor: theme.colors.border, color: theme.colors.text }]}
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    keyboardType="decimal-pad"
                                    selectTextOnFocus
                                />
                                <TouchableOpacity
                                    style={[styles.quantityButtonInline, { backgroundColor: theme.colors.border }]}
                                    onPress={() => setQuantity(String(parseFloat(quantity) + 0.25))}
                                >
                                    <Ionicons name="add" size={18} color={theme.colors.text} />
                                </TouchableOpacity>
                                <Text style={[styles.unitTextInline, { color: theme.colors.text }]}>{food.serving_unit}</Text>
                            </View>

                            {/* Add button on the right */}
                            <TouchableOpacity
                                style={[styles.addButtonInline, { backgroundColor: theme.colors.success }]}
                                onPress={handleAddFood}
                            >
                                <Ionicons name="add" size={18} color="#FFFFFF" />
                                <Text style={styles.addButtonInlineText}>Add</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Macros Visual Section with Circular Progress */}
                        <View style={styles.macrosSection}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="fitness" size={20} color={theme.colors.primary} />
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Macronutrients</Text>
                            </View>
                            <View style={styles.macrosRow}>
                                {renderMacroCircle('Carbs', food.carbs, 'g', macroPercentages.carbs, MACRO_COLORS.carbs)}
                                {renderMacroCircle('Protein', food.proteins, 'g', macroPercentages.protein, MACRO_COLORS.protein)}
                                {renderMacroCircle('Fat', food.fats, 'g', macroPercentages.fat, MACRO_COLORS.fat)}
                            </View>
                        </View>

                        {/* Enhanced Nutrition Facts */}
                        <View style={styles.detailsSection}>
                            {/* Main Macros with Progress */}
                            <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                                {renderNutrientRowWithProgress('leaf', 'Total Carbohydrates', food.carbs, 'g', MACRO_COLORS.carbs)}
                                {renderNutrientRowWithProgress('git-branch', 'Dietary Fiber', food.fiber, 'g', '#8BC34A', true, 'fiber')}
                                {renderNutrientRowWithProgress('cafe', 'Total Sugars', food.sugar, 'g', '#FF7043', true, 'sugar')}
                                {renderNutrientRowWithProgress('fitness', 'Protein', food.proteins, 'g', MACRO_COLORS.protein)}
                                {renderNutrientRowWithProgress('water', 'Total Fat', food.fats, 'g', MACRO_COLORS.fat)}
                            </View>

                            {/* Fat Breakdown */}
                            {(hasNutritionalValue(food.saturated_fat) || hasNutritionalValue(food.trans_fat) || hasNutritionalValue(food.polyunsaturated_fat) || hasNutritionalValue(food.monounsaturated_fat)) && (
                                <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                                    <View style={styles.subSectionHeader}>
                                        <Ionicons name="ellipse" size={16} color={MACRO_COLORS.fat} />
                                        <Text style={[styles.subSectionTitle, { color: theme.colors.primary }]}>Fat Breakdown</Text>
                                    </View>
                                    {renderNutrientRowWithProgress('warning', 'Saturated Fat', food.saturated_fat, 'g', '#FF5722', true, 'saturated_fat')}
                                    {renderNutrientRowWithProgress('close', 'Trans Fat', food.trans_fat, 'g', '#F44336')}
                                    {renderNutrientRowWithProgress('leaf', 'Polyunsaturated Fat', food.polyunsaturated_fat, 'g', '#FF9800')}
                                    {renderNutrientRowWithProgress('leaf-outline', 'Monounsaturated Fat', food.monounsaturated_fat, 'g', '#FFC107')}
                                </View>
                            )}

                            {/* Vitamins & Minerals with Progress */}
                            {(hasNutritionalValue(food.cholesterol) || hasNutritionalValue(food.sodium) || hasNutritionalValue(food.potassium) || hasNutritionalValue(food.vitamin_a) || hasNutritionalValue(food.vitamin_c) || hasNutritionalValue(food.calcium) || hasNutritionalValue(food.iron)) && (
                                <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                                    <View style={styles.subSectionHeader}>
                                        <Ionicons name="sparkles" size={16} color="#FFA726" />
                                        <Text style={[styles.subSectionTitle, { color: theme.colors.primary }]}>Vitamins & Minerals</Text>
                                    </View>
                                    {renderNutrientRowWithProgress('heart', 'Cholesterol', food.cholesterol, 'mg', '#E91E63', true, 'cholesterol')}
                                    {renderNutrientRowWithProgress('water', 'Sodium', food.sodium, 'mg', '#2196F3', true, 'sodium')}
                                    {renderNutrientRowWithProgress('flash', 'Potassium', food.potassium, 'mg', '#9C27B0', true, 'potassium')}
                                    {renderNutrientRowWithProgress('eye', 'Vitamin A', food.vitamin_a, 'mcg', '#FF7043', true, 'vitamin_a')}
                                    {renderNutrientRowWithProgress('sunny', 'Vitamin C', food.vitamin_c, 'mg', '#FFA726', true, 'vitamin_c')}
                                    {renderNutrientRowWithProgress('diamond', 'Calcium', food.calcium, 'mg', '#AB47BC', true, 'calcium')}
                                    {renderNutrientRowWithProgress('magnet', 'Iron', food.iron, 'mg', '#EF5350', true, 'iron')}
                                </View>
                            )}
                        </View>

                        {/* Notes Section */}
                        <View style={[styles.notesInputSection, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="create" size={20} color={theme.colors.primary} />
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes (Optional)</Text>
                            </View>
                            <TextInput
                                style={[styles.notesTextInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Add any notes about this food..."
                                placeholderTextColor={theme.colors.textSecondary}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    // Image Section Styles (matching FoodDetail.tsx)
    imageSection: {
        width: screenWidth,
        height: 280,
        position: 'relative',
        backgroundColor: '#000000',
    },
    imageSectionGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    bottomGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 150,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    headerButton: {
        padding: 8,
    },
    headerButtonBackground: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        flex: 1,
    },
    foodInfoOverlay: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        zIndex: 5,
    },
    foodName: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    brandName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#CCCCCC',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    // Content Container Styles
    contentContainer: {
        paddingTop: 0,
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    quantityAndAddRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        marginTop: 0,
        paddingHorizontal: 8,
    },
    quantityControlsInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    quantityButtonInline: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityInputInline: {
        width: 60,
        height: 40,
        borderRadius: 20,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        paddingHorizontal: 8,
    },
    unitTextInline: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    addButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 6,
    },
    addButtonInlineText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Calorie Section
    calorieSection: {
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 16,
    },
    calorieAlignmentContainer: {
        alignItems: 'center',
    },
    calorieRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    calorieNumber: {
        fontSize: 56,
        fontWeight: '800',
        lineHeight: 64,
    },
    calorieLabel: {
        fontSize: 18,
        fontWeight: '500',
        marginBottom: 4,
    },
    // Macros Section with Circular Progress
    macrosSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    macroCircle: {
        alignItems: 'center',
    },
    macroCircleInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    macroPercentage: {
        fontSize: 12,
        fontWeight: '600',
    },
    macroLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    // Details Section
    detailsSection: {
        gap: 16,
        marginBottom: 20,
    },
    nutrientGroup: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    subSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    nutrientRowWithProgress: {
        marginBottom: 12,
    },
    nutrientRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    nutrientRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    nutrientIcon: {
        width: 20,
    },
    nutrientLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    nutrientRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    percentageText: {
        fontSize: 12,
        fontWeight: '600',
        minWidth: 35,
        textAlign: 'right',
    },
    progressBarContainer: {
        width: '100%',
    },
    progressBarBackground: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    // Notes Section
    notesInputSection: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    notesTextInput: {
        fontSize: 14,
        padding: 12,
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
