import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodItem } from '../services/BarcodeService';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';

// App theme colors - matching Manual.tsx
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#0074dd';

interface FoodDetailsProps {
    food: FoodItem;
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

// GradientBorderCard component matching the app's design system
const GradientBorderCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => {
    return (
        <View style={[styles.gradientBorderContainer, style]}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={styles.gradientBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View style={styles.gradientBorderInner}>
                {children}
            </View>
        </View>
    );
};

export default function FoodDetails({ food, visible, onClose, onAddFood }: FoodDetailsProps) {
    const [quantity, setQuantity] = useState('1');
    const [selectedMeal, setSelectedMeal] = useState('Breakfast');
    const [notes, setNotes] = useState('');

    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    // Calculate nutrient based on quantity
    const calculateNutrient = (value: number) => {
        const qtyValue = parseFloat(quantity) || 1;
        return Math.round(value * qtyValue);
    };

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

        onAddFood(adjustedFood, selectedMeal, qtyValue);
    };

    // Check if a value is present (using our helper function)
    const hasValue = (value: number) => hasNutritionalValue(value);

    // Calculate macro percentages
    const totalMacroCalories = (food.proteins * 4) + (food.carbs * 4) + (food.fats * 9);
    const proteinPercent = totalMacroCalories > 0 ? Math.round((food.proteins * 4 / totalMacroCalories) * 100) : 0;
    const carbPercent = totalMacroCalories > 0 ? Math.round((food.carbs * 4 / totalMacroCalories) * 100) : 0;
    const fatPercent = totalMacroCalories > 0 ? Math.round((food.fats * 9 / totalMacroCalories) * 100) : 0;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <LinearGradient
                colors={[PRIMARY_BG, CARD_BG]}
                style={styles.container}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Nutrition Facts</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Combined Food Info & Controls Card */}
                    <GradientBorderCard style={styles.cardMargin}>
                        <View style={styles.combinedSection}>

                            {/* Food Info */}
                            <View style={styles.foodInfoSection}>
                                <Text style={styles.foodName}>{food.food_name}</Text>
                                {food.brand_name && (
                                    <Text style={styles.brandName}>{food.brand_name}</Text>
                                )}
                                <View style={styles.servingContainer}>
                                    <Text style={styles.servingLabel}>Per serving:</Text>
                                    <Text style={styles.servingText}>
                                        {food.serving_qty} {food.serving_unit}
                                        {food.serving_weight_grams > 0 ? ` (${food.serving_weight_grams}g)` : ''}
                                    </Text>
                                </View>
                            </View>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* Controls */}
                            <View style={styles.controlsSection}>
                                {/* Quantity */}
                                <View style={styles.controlRow}>
                                    <Text style={styles.controlLabel}>Quantity</Text>
                                    <View style={styles.quantityContainer}>
                                        <TouchableOpacity
                                            style={styles.quantityButton}
                                            onPress={() => setQuantity(String(Math.max(0.25, parseFloat(quantity) - 0.25)))}
                                        >
                                            <Ionicons name="remove" size={18} color={WHITE} />
                                        </TouchableOpacity>
                                        <TextInput
                                            style={styles.quantityInput}
                                            value={quantity}
                                            onChangeText={setQuantity}
                                            keyboardType="numeric"
                                            textAlign="center"
                                        />
                                        <TouchableOpacity
                                            style={styles.quantityButton}
                                            onPress={() => setQuantity(String(parseFloat(quantity) + 0.25))}
                                        >
                                            <Ionicons name="add" size={18} color={WHITE} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Meal Selection */}
                                <View style={styles.controlRow}>
                                    <Text style={styles.controlLabel}>Meal</Text>
                                    <View style={styles.mealContainer}>
                                        {meals.map((meal) => (
                                            <TouchableOpacity
                                                key={meal}
                                                style={[
                                                    styles.mealOption,
                                                    selectedMeal === meal && styles.selectedMealOption
                                                ]}
                                                onPress={() => setSelectedMeal(meal)}
                                            >
                                                <Text style={[
                                                    styles.mealOptionText,
                                                    selectedMeal === meal && styles.selectedMealOptionText
                                                ]}>
                                                    {meal}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Notes */}
                                <View style={styles.notesContainer}>
                                    <Text style={styles.controlLabel}>Notes (Optional)</Text>
                                    <TextInput
                                        style={styles.notesInput}
                                        value={notes}
                                        onChangeText={setNotes}
                                        placeholder="Add notes..."
                                        placeholderTextColor={GRAY}
                                        multiline
                                    />
                                </View>

                                {/* Add Button */}
                                <TouchableOpacity style={styles.addButton} onPress={handleAddFood}>
                                    <LinearGradient
                                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.addButtonGradient}
                                    >
                                        <Ionicons name="add" size={20} color={WHITE} />
                                        <Text style={styles.addButtonText}>Add to {selectedMeal}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </GradientBorderCard>

                    {/* Calories & Macros Card */}
                    <GradientBorderCard style={styles.cardMargin}>
                        <View style={styles.nutritionSection}>
                            <Text style={styles.sectionTitle}>Calories & Macronutrients</Text>

                            {/* Calories */}
                            <View style={styles.caloriesContainer}>
                                <Text style={styles.caloriesValue}>{calculateNutrient(food.calories)}</Text>
                                <Text style={styles.caloriesLabel}>calories</Text>
                            </View>

                            {/* Macro Breakdown */}
                            <View style={styles.macrosGrid}>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: '#32D74B' }]} />
                                    <Text style={styles.macroValue}>{calculateNutrient(food.proteins)}g</Text>
                                    <Text style={styles.macroLabel}>Protein</Text>
                                    <Text style={styles.macroPercent}>{proteinPercent}%</Text>
                                    <Text style={styles.macroCalories}>{Math.round(calculateNutrient(food.proteins) * 4)} cal</Text>
                                </View>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: '#0084ff' }]} />
                                    <Text style={styles.macroValue}>{calculateNutrient(food.carbs)}g</Text>
                                    <Text style={styles.macroLabel}>Carbs</Text>
                                    <Text style={styles.macroPercent}>{carbPercent}%</Text>
                                    <Text style={styles.macroCalories}>{Math.round(calculateNutrient(food.carbs) * 4)} cal</Text>
                                </View>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: '#FF9500' }]} />
                                    <Text style={styles.macroValue}>{calculateNutrient(food.fats)}g</Text>
                                    <Text style={styles.macroLabel}>Fat</Text>
                                    <Text style={styles.macroPercent}>{fatPercent}%</Text>
                                    <Text style={styles.macroCalories}>{Math.round(calculateNutrient(food.fats) * 9)} cal</Text>
                                </View>
                            </View>
                        </View>
                    </GradientBorderCard>

                    {/* Detailed Nutrition Card */}
                    <GradientBorderCard style={styles.cardMargin}>
                        <View style={styles.detailedSection}>
                            <Text style={styles.sectionTitle}>Detailed Nutrition</Text>

                            {/* Carbohydrate Details */}
                            {(hasValue(food.fiber) || hasValue(food.sugar)) && (
                                <View style={styles.nutritionCategory}>
                                    <Text style={styles.categoryTitle}>Carbohydrates</Text>
                                    <View style={styles.categoryContent}>
                                        <View style={styles.nutrientRow}>
                                            <Text style={styles.nutrientName}>Total Carbohydrates</Text>
                                            <Text style={styles.nutrientValue}>{calculateNutrient(food.carbs)}g</Text>
                                        </View>
                                        {hasValue(food.fiber) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Dietary Fiber</Text>
                                                <Text style={styles.nutrientValue}>{formatNutritionalValue(calculateNutrient(food.fiber), 'g')}</Text>
                                            </View>
                                        )}
                                        {hasValue(food.sugar) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Total Sugars</Text>
                                                <Text style={styles.nutrientValue}>{formatNutritionalValue(calculateNutrient(food.sugar), 'g')}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Fat Details */}
                            {(hasValue(food.saturated_fat) || hasValue(food.polyunsaturated_fat) || hasValue(food.monounsaturated_fat) || hasValue(food.trans_fat)) && (
                                <View style={styles.nutritionCategory}>
                                    <Text style={styles.categoryTitle}>Fats</Text>
                                    <View style={styles.categoryContent}>
                                        <View style={styles.nutrientRow}>
                                            <Text style={styles.nutrientName}>Total Fat</Text>
                                            <Text style={styles.nutrientValue}>{calculateNutrient(food.fats)}g</Text>
                                        </View>
                                        {hasValue(food.saturated_fat) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Saturated Fat</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.saturated_fat)}g</Text>
                                            </View>
                                        )}
                                        {hasValue(food.polyunsaturated_fat) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Polyunsaturated Fat</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.polyunsaturated_fat)}g</Text>
                                            </View>
                                        )}
                                        {hasValue(food.monounsaturated_fat) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Monounsaturated Fat</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.monounsaturated_fat)}g</Text>
                                            </View>
                                        )}
                                        {hasValue(food.trans_fat) && (
                                            <View style={styles.nutrientRowIndented}>
                                                <Text style={styles.nutrientNameSub}>Trans Fat</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.trans_fat)}g</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Other Nutrients */}
                            {(hasValue(food.cholesterol) || hasValue(food.sodium) || hasValue(food.potassium)) && (
                                <View style={styles.nutritionCategory}>
                                    <Text style={styles.categoryTitle}>Other</Text>
                                    <View style={styles.categoryContent}>
                                        {hasValue(food.cholesterol) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Cholesterol</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.cholesterol)}mg</Text>
                                            </View>
                                        )}
                                        {hasValue(food.sodium) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Sodium</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.sodium)}mg</Text>
                                            </View>
                                        )}
                                        {hasValue(food.potassium) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Potassium</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.potassium)}mg</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Vitamins & Minerals */}
                            {(hasValue(food.vitamin_a) || hasValue(food.vitamin_c) || hasValue(food.calcium) || hasValue(food.iron)) && (
                                <View style={styles.nutritionCategory}>
                                    <Text style={styles.categoryTitle}>Vitamins & Minerals</Text>
                                    <View style={styles.categoryContent}>
                                        {hasValue(food.vitamin_a) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Vitamin A</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.vitamin_a)}mcg</Text>
                                            </View>
                                        )}
                                        {hasValue(food.vitamin_c) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Vitamin C</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.vitamin_c)}mg</Text>
                                            </View>
                                        )}
                                        {hasValue(food.calcium) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Calcium</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.calcium)}mg</Text>
                                            </View>
                                        )}
                                        {hasValue(food.iron) && (
                                            <View style={styles.nutrientRow}>
                                                <Text style={styles.nutrientName}>Iron</Text>
                                                <Text style={styles.nutrientValue}>{calculateNutrient(food.iron)}mg</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </GradientBorderCard>
                </ScrollView>
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: LIGHT_GRAY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        width: 36,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    scrollViewContent: {
        paddingBottom: 60,
        flexGrow: 1,
    },
    cardMargin: {
        marginBottom: 16,
    },
    gradientBorderContainer: {
        borderRadius: 10,
        position: 'relative',
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 10,
    },
    gradientBorderInner: {
        margin: 1,
        borderRadius: 9,
        backgroundColor: CARD_BG,
        padding: 16,
    },
    combinedSection: {
        gap: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: WHITE,
        textAlign: 'center',
        flex: 1,
        letterSpacing: 0.5,
    },
    foodInfoSection: {
        alignItems: 'center',
    },
    foodName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        textAlign: 'center',
        marginBottom: 6,
    },
    brandName: {
        fontSize: 14,
        color: GRAY,
        textAlign: 'center',
        marginBottom: 8,
    },
    servingContainer: {
        alignItems: 'center',
    },
    servingLabel: {
        fontSize: 12,
        color: GRAY,
        marginBottom: 4,
    },
    servingText: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: LIGHT_GRAY,
        marginVertical: 8,
    },
    controlsSection: {
        gap: 16,
    },
    controlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    controlLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    quantityButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: LIGHT_GRAY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityInput: {
        width: 70,
        height: 36,
        backgroundColor: LIGHT_GRAY,
        borderRadius: 18,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        paddingHorizontal: 8,
    },
    mealContainer: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    mealOption: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: LIGHT_GRAY,
    },
    selectedMealOption: {
        backgroundColor: BLUE_ACCENT,
    },
    mealOptionText: {
        fontSize: 12,
        fontWeight: '500',
        color: GRAY,
    },
    selectedMealOptionText: {
        color: WHITE,
    },
    notesContainer: {
        gap: 8,
    },
    notesInput: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: WHITE,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    addButton: {
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 4,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: WHITE,
        marginLeft: 6,
    },
    nutritionSection: {
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 16,
        textAlign: 'center',
    },
    caloriesContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 20,
    },
    caloriesValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: WHITE,
    },
    caloriesLabel: {
        fontSize: 16,
        color: GRAY,
        marginLeft: 8,
    },
    macrosGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
    },
    macroCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
    },
    macroDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 2,
    },
    macroLabel: {
        fontSize: 12,
        color: GRAY,
        marginBottom: 4,
    },
    macroPercent: {
        fontSize: 11,
        color: BLUE_ACCENT,
        fontWeight: '600',
        marginBottom: 2,
    },
    macroCalories: {
        fontSize: 10,
        color: GRAY,
    },
    detailedSection: {
        gap: 16,
    },
    nutritionCategory: {
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
        paddingBottom: 12,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    categoryContent: {
        gap: 6,
    },
    nutrientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    nutrientRowIndented: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
        paddingLeft: 16,
    },
    nutrientName: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '500',
    },
    nutrientNameSub: {
        fontSize: 13,
        color: GRAY,
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
    },
});