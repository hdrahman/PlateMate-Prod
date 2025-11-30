import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodItem } from '../services/BarcodeService';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';
import { ThemeContext } from '../ThemeContext';

interface FoodDetailsProps {
    food: FoodItem;
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

// GradientBorderCard component matching the app's design system
const GradientBorderCard: React.FC<{ children: React.ReactNode; style?: any; cardBackground: string }> = ({ children, style, cardBackground }) => {
    return (
        <View style={[styles.gradientBorderContainer, style]}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={styles.gradientBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View style={[styles.gradientBorderInner, { backgroundColor: cardBackground }]}>
                {children}
            </View>
        </View>
    );
};

export default function FoodDetails({ food, visible, onClose, onAddFood }: FoodDetailsProps) {
    const { theme, isDarkTheme } = useContext(ThemeContext);
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
                colors={[theme.colors.background, theme.colors.cardBackground]}
                style={styles.container}
            >
                <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                    <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.border }]} onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Nutrition Facts</Text>
                        <View style={styles.placeholder} />
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollViewContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Combined Food Info & Controls Card */}
                        <GradientBorderCard style={styles.cardMargin} cardBackground={theme.colors.cardBackground}>
                            <View style={styles.combinedSection}>

                                {/* Food Info */}
                                <View style={styles.foodInfoSection}>
                                    <Text style={[styles.foodName, { color: theme.colors.text }]}>{food.food_name}</Text>
                                    {food.brand_name && (
                                        <Text style={[styles.brandName, { color: theme.colors.textSecondary }]}>{food.brand_name}</Text>
                                    )}
                                    <View style={styles.servingContainer}>
                                        <Text style={[styles.servingLabel, { color: theme.colors.textSecondary }]}>Per serving:</Text>
                                        <Text style={[styles.servingText, { color: theme.colors.text }]}>
                                            {food.serving_qty} {food.serving_unit}
                                            {food.serving_weight_grams > 0 ? ` (${food.serving_weight_grams}g)` : ''}
                                        </Text>
                                    </View>
                                </View>

                                {/* Divider */}
                                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                                {/* Controls */}
                                <View style={styles.controlsSection}>
                                    {/* Quantity */}
                                    <View style={styles.controlRow}>
                                        <Text style={[styles.controlLabel, { color: theme.colors.text }]}>Quantity</Text>
                                        <View style={styles.quantityContainer}>
                                            <TouchableOpacity
                                                style={[styles.quantityButton, { backgroundColor: theme.colors.border }]}
                                                onPress={() => setQuantity(String(Math.max(0.25, parseFloat(quantity) - 0.25)))}
                                            >
                                                <Ionicons name="remove" size={18} color={theme.colors.text} />
                                            </TouchableOpacity>
                                            <TextInput
                                                style={[styles.quantityInput, { backgroundColor: theme.colors.border, color: theme.colors.text }]}
                                                value={quantity}
                                                onChangeText={setQuantity}
                                                keyboardType="numeric"
                                                textAlign="center"
                                            />
                                            <TouchableOpacity
                                                style={[styles.quantityButton, { backgroundColor: theme.colors.border }]}
                                                onPress={() => setQuantity(String(parseFloat(quantity) + 0.25))}
                                            >
                                                <Ionicons name="add" size={18} color={theme.colors.text} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Meal Selection */}
                                    <View style={styles.controlRow}>
                                        <Text style={[styles.controlLabel, { color: theme.colors.text }]}>Meal</Text>
                                        <View style={styles.mealContainer}>
                                            {meals.map((meal) => (
                                                <TouchableOpacity
                                                    key={meal}
                                                    style={[
                                                        styles.mealOption,
                                                        { backgroundColor: theme.colors.border },
                                                        selectedMeal === meal && { backgroundColor: theme.colors.primary }
                                                    ]}
                                                    onPress={() => setSelectedMeal(meal)}
                                                >
                                                    <Text style={[
                                                        styles.mealOptionText,
                                                        { color: theme.colors.textSecondary },
                                                        selectedMeal === meal && { color: theme.colors.text }
                                                    ]}>
                                                        {meal}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Notes */}
                                    <View style={styles.notesContainer}>
                                        <Text style={[styles.controlLabel, { color: theme.colors.text }]}>Notes (Optional)</Text>
                                        <TextInput
                                            style={[styles.notesInput, { backgroundColor: theme.colors.border, color: theme.colors.text }]}
                                            value={notes}
                                            onChangeText={setNotes}
                                            placeholder="Add notes..."
                                            placeholderTextColor={theme.colors.textSecondary}
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
                                            <Ionicons name="add" size={20} color="#FFFFFF" />
                                            <Text style={styles.addButtonText}>Add to {selectedMeal}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </GradientBorderCard>

                        {/* Calories & Macros Card */}
                        <GradientBorderCard style={styles.cardMargin} cardBackground={theme.colors.cardBackground}>
                            <View style={styles.nutritionSection}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Calories & Macronutrients</Text>

                                {/* Calories */}
                                <View style={styles.caloriesContainer}>
                                    <Text style={[styles.caloriesValue, { color: theme.colors.text }]}>{calculateNutrient(food.calories)}</Text>
                                    <Text style={[styles.caloriesLabel, { color: theme.colors.textSecondary }]}>calories</Text>
                                </View>

                                {/* Macro Breakdown */}
                                <View style={styles.macrosGrid}>
                                    <View style={[styles.macroCard, { backgroundColor: theme.colors.border }]}>
                                        <View style={[styles.macroDot, { backgroundColor: '#32D74B' }]} />
                                        <Text style={[styles.macroValue, { color: theme.colors.text }]}>{calculateNutrient(food.proteins)}g</Text>
                                        <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Protein</Text>
                                        <Text style={[styles.macroPercent, { color: theme.colors.primary }]}>{proteinPercent}%</Text>
                                        <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(calculateNutrient(food.proteins) * 4)} cal</Text>
                                    </View>
                                    <View style={[styles.macroCard, { backgroundColor: theme.colors.border }]}>
                                        <View style={[styles.macroDot, { backgroundColor: '#0084ff' }]} />
                                        <Text style={[styles.macroValue, { color: theme.colors.text }]}>{calculateNutrient(food.carbs)}g</Text>
                                        <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Carbs</Text>
                                        <Text style={[styles.macroPercent, { color: theme.colors.primary }]}>{carbPercent}%</Text>
                                        <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(calculateNutrient(food.carbs) * 4)} cal</Text>
                                    </View>
                                    <View style={[styles.macroCard, { backgroundColor: theme.colors.border }]}>
                                        <View style={[styles.macroDot, { backgroundColor: '#FF9500' }]} />
                                        <Text style={[styles.macroValue, { color: theme.colors.text }]}>{calculateNutrient(food.fats)}g</Text>
                                        <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Fat</Text>
                                        <Text style={[styles.macroPercent, { color: theme.colors.primary }]}>{fatPercent}%</Text>
                                        <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(calculateNutrient(food.fats) * 9)} cal</Text>
                                    </View>
                                </View>
                            </View>
                        </GradientBorderCard>

                        {/* Detailed Nutrition Card */}
                        <GradientBorderCard style={styles.cardMargin} cardBackground={theme.colors.cardBackground}>
                            <View style={styles.detailedSection}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Detailed Nutrition</Text>

                                {/* Carbohydrate Details */}
                                {(hasValue(food.fiber) || hasValue(food.sugar)) && (
                                    <View style={[styles.nutritionCategory, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Carbohydrates</Text>
                                        <View style={styles.categoryContent}>
                                            <View style={styles.nutrientRow}>
                                                <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Total Carbohydrates</Text>
                                                <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.carbs)}g</Text>
                                            </View>
                                            {hasValue(food.fiber) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Dietary Fiber</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{formatNutritionalValue(calculateNutrient(food.fiber), 'g')}</Text>
                                                </View>
                                            )}
                                            {hasValue(food.sugar) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Total Sugars</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{formatNutritionalValue(calculateNutrient(food.sugar), 'g')}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Fat Details */}
                                {(hasValue(food.saturated_fat) || hasValue(food.polyunsaturated_fat) || hasValue(food.monounsaturated_fat) || hasValue(food.trans_fat)) && (
                                    <View style={[styles.nutritionCategory, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Fats</Text>
                                        <View style={styles.categoryContent}>
                                            <View style={styles.nutrientRow}>
                                                <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Total Fat</Text>
                                                <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.fats)}g</Text>
                                            </View>
                                            {hasValue(food.saturated_fat) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Saturated Fat</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.saturated_fat)}g</Text>
                                                </View>
                                            )}
                                            {hasValue(food.polyunsaturated_fat) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Polyunsaturated Fat</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.polyunsaturated_fat)}g</Text>
                                                </View>
                                            )}
                                            {hasValue(food.monounsaturated_fat) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Monounsaturated Fat</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.monounsaturated_fat)}g</Text>
                                                </View>
                                            )}
                                            {hasValue(food.trans_fat) && (
                                                <View style={styles.nutrientRowIndented}>
                                                    <Text style={[styles.nutrientNameSub, { color: theme.colors.textSecondary }]}>Trans Fat</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.trans_fat)}g</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Other Nutrients */}
                                {(hasValue(food.cholesterol) || hasValue(food.sodium) || hasValue(food.potassium)) && (
                                    <View style={[styles.nutritionCategory, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Other</Text>
                                        <View style={styles.categoryContent}>
                                            {hasValue(food.cholesterol) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Cholesterol</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.cholesterol)}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(food.sodium) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Sodium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.sodium)}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(food.potassium) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Potassium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.potassium)}mg</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Vitamins & Minerals */}
                                {(hasValue(food.vitamin_a) || hasValue(food.vitamin_c) || hasValue(food.calcium) || hasValue(food.iron)) && (
                                    <View style={[styles.nutritionCategory, { borderBottomColor: theme.colors.border }]}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Vitamins & Minerals</Text>
                                        <View style={styles.categoryContent}>
                                            {hasValue(food.vitamin_a) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Vitamin A</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.vitamin_a)}mcg</Text>
                                                </View>
                                            )}
                                            {hasValue(food.vitamin_c) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Vitamin C</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.vitamin_c)}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(food.calcium) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Calcium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.calcium)}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(food.iron) && (
                                                <View style={styles.nutrientRow}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Iron</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{calculateNutrient(food.iron)}mg</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </GradientBorderCard>
                    </ScrollView>
                </SafeAreaView>
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
        paddingTop: 10,
        paddingBottom: 20,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        padding: 16,
    },
    combinedSection: {
        gap: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
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
        textAlign: 'center',
        marginBottom: 6,
    },
    brandName: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    servingContainer: {
        alignItems: 'center',
    },
    servingLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    servingText: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityInput: {
        width: 70,
        height: 36,
        borderRadius: 18,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
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
    },
    selectedMealOption: {
        // Now handled dynamically with theme.colors.primary
    },
    mealOptionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    selectedMealOptionText: {
        // Now handled dynamically with theme.colors.text
    },
    notesContainer: {
        gap: 8,
    },
    notesInput: {
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
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
        color: '#FFFFFF',
        marginLeft: 6,
    },
    nutritionSection: {
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
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
    },
    caloriesLabel: {
        fontSize: 16,
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
        marginBottom: 2,
    },
    macroLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    macroPercent: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    macroCalories: {
        fontSize: 10,
    },
    detailedSection: {
        gap: 16,
    },
    nutritionCategory: {
        borderBottomWidth: 1,
        paddingBottom: 12,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
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
        fontWeight: '500',
    },
    nutrientNameSub: {
        fontSize: 13,
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '600',
    },
});