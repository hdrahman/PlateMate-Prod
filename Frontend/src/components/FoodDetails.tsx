import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    Modal,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodItem } from '../api/nutritionix';
import { BACKEND_URL } from '../utils/config';
import axios from 'axios';

// Define theme colors
const WHITE = '#FFFFFF';
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';
const GREEN = '#4CAF50';
const YELLOW = '#FFC107';
const RED = '#F44336';

interface FoodDetailsProps {
    food: FoodItem;
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

export default function FoodDetails({ food, visible, onClose, onAddFood }: FoodDetailsProps) {
    const [quantity, setQuantity] = useState<string>(food.serving_qty.toString());
    const [selectedMeal, setSelectedMeal] = useState<string>('Breakfast');
    const [notes, setNotes] = useState<string>('');

    // Meal options
    const mealOptions = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    // Calculate nutrient values based on quantity
    const calculateNutrient = (value: number): number => {
        const qtyMultiplier = parseFloat(quantity) / food.serving_qty;
        return Math.round(value * qtyMultiplier);
    };

    // Handle adding food to log
    const handleAddFood = () => {
        const qtyValue = parseFloat(quantity);

        if (isNaN(qtyValue) || qtyValue <= 0) {
            Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
            return;
        }

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

    // Get color based on healthiness rating
    const getHealthinessColor = (rating?: number) => {
        if (!rating) return GRAY;
        if (rating >= 7) return GREEN;
        if (rating >= 4) return YELLOW;
        return RED;
    };

    // Check if a value is present
    const hasValue = (value: number) => value > 0;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Food Details</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content}>
                    {/* Food Image and Title */}
                    <View style={styles.foodHeader}>
                        <View style={styles.imageContainer}>
                            {food.image ? (
                                <Image source={{ uri: food.image }} style={styles.foodImage} />
                            ) : (
                                <View style={styles.placeholderImage}>
                                    <Ionicons name="restaurant-outline" size={40} color={GRAY} />
                                </View>
                            )}
                        </View>
                        <View style={styles.foodTitleContainer}>
                            <Text style={styles.foodName}>{food.food_name}</Text>
                            {food.brand_name && (
                                <Text style={styles.brandName}>{food.brand_name}</Text>
                            )}
                            <View style={styles.servingInfo}>
                                <Text style={styles.servingText}>
                                    {food.serving_qty} {food.serving_unit}
                                    {food.serving_weight_grams > 0 ? ` (${food.serving_weight_grams}g)` : ''}
                                </Text>
                            </View>
                            <View style={[styles.healthinessIndicator, { backgroundColor: getHealthinessColor(food.healthiness_rating) }]}>
                                <Text style={styles.healthinessText}>{food.healthiness_rating || '?'}</Text>
                                <Text style={styles.healthinessLabel}>Health</Text>
                            </View>
                        </View>
                    </View>

                    {/* Quantity Selector */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => {
                                    const currentQty = parseFloat(quantity);
                                    if (!isNaN(currentQty) && currentQty > 0.5) {
                                        setQuantity((currentQty - 0.5).toString());
                                    }
                                }}
                            >
                                <Ionicons name="remove" size={24} color={WHITE} />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.quantityInput}
                                value={quantity}
                                onChangeText={setQuantity}
                                keyboardType="numeric"
                                selectTextOnFocus
                            />

                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => {
                                    const currentQty = parseFloat(quantity);
                                    if (!isNaN(currentQty)) {
                                        setQuantity((currentQty + 0.5).toString());
                                    } else {
                                        setQuantity('1');
                                    }
                                }}
                            >
                                <Ionicons name="add" size={24} color={WHITE} />
                            </TouchableOpacity>

                            <Text style={styles.servingUnitText}>{food.serving_unit}</Text>
                        </View>
                    </View>

                    {/* Meal Type Selector */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Add to Meal</Text>
                        <View style={styles.mealOptions}>
                            {mealOptions.map((meal) => (
                                <TouchableOpacity
                                    key={meal}
                                    style={[
                                        styles.mealOption,
                                        selectedMeal === meal && styles.selectedMealOption
                                    ]}
                                    onPress={() => setSelectedMeal(meal)}
                                >
                                    <Text
                                        style={[
                                            styles.mealOptionText,
                                            selectedMeal === meal && styles.selectedMealOptionText
                                        ]}
                                    >
                                        {meal}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notes */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Add notes about this food..."
                            placeholderTextColor={GRAY}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                        />
                    </View>

                    {/* Nutrition Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Nutrition Information</Text>

                        {/* Main Macros */}
                        <View style={styles.macrosContainer}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{calculateNutrient(food.calories)}</Text>
                                <Text style={styles.macroLabel}>Calories</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{calculateNutrient(food.proteins)}g</Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{calculateNutrient(food.carbs)}g</Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{calculateNutrient(food.fats)}g</Text>
                                <Text style={styles.macroLabel}>Fat</Text>
                            </View>
                        </View>

                        {/* Detailed Nutrition */}
                        <View style={styles.detailedNutrition}>
                            {/* Carbs breakdown */}
                            <View style={styles.nutritionCategory}>
                                <Text style={styles.categoryTitle}>Carbohydrates</Text>
                                <View style={styles.nutrientRow}>
                                    <Text style={styles.nutrientName}>Dietary Fiber</Text>
                                    <Text style={styles.nutrientValue}>{calculateNutrient(food.fiber)}g</Text>
                                </View>
                                <View style={styles.nutrientRow}>
                                    <Text style={styles.nutrientName}>Sugars</Text>
                                    <Text style={styles.nutrientValue}>{calculateNutrient(food.sugar)}g</Text>
                                </View>
                            </View>

                            {/* Fats breakdown */}
                            <View style={styles.nutritionCategory}>
                                <Text style={styles.categoryTitle}>Fats</Text>
                                <View style={styles.nutrientRow}>
                                    <Text style={styles.nutrientName}>Saturated Fat</Text>
                                    <Text style={styles.nutrientValue}>{calculateNutrient(food.saturated_fat)}g</Text>
                                </View>
                                {hasValue(food.polyunsaturated_fat) && (
                                    <View style={styles.nutrientRow}>
                                        <Text style={styles.nutrientName}>Polyunsaturated</Text>
                                        <Text style={styles.nutrientValue}>{calculateNutrient(food.polyunsaturated_fat)}g</Text>
                                    </View>
                                )}
                                {hasValue(food.monounsaturated_fat) && (
                                    <View style={styles.nutrientRow}>
                                        <Text style={styles.nutrientName}>Monounsaturated</Text>
                                        <Text style={styles.nutrientValue}>{calculateNutrient(food.monounsaturated_fat)}g</Text>
                                    </View>
                                )}
                                {hasValue(food.trans_fat) && (
                                    <View style={styles.nutrientRow}>
                                        <Text style={styles.nutrientName}>Trans Fat</Text>
                                        <Text style={styles.nutrientValue}>{calculateNutrient(food.trans_fat)}g</Text>
                                    </View>
                                )}
                                {hasValue(food.cholesterol) && (
                                    <View style={styles.nutrientRow}>
                                        <Text style={styles.nutrientName}>Cholesterol</Text>
                                        <Text style={styles.nutrientValue}>{calculateNutrient(food.cholesterol)}mg</Text>
                                    </View>
                                )}
                            </View>

                            {/* Minerals */}
                            <View style={styles.nutritionCategory}>
                                <Text style={styles.categoryTitle}>Vitamins & Minerals</Text>
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
                                {hasValue(food.vitamin_a) && (
                                    <View style={styles.nutrientRow}>
                                        <Text style={styles.nutrientName}>Vitamin A</Text>
                                        <Text style={styles.nutrientValue}>{calculateNutrient(food.vitamin_a)}IU</Text>
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
                    </View>
                </ScrollView>

                {/* Add Food Button */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddFood}>
                        <LinearGradient
                            colors={["#5A60EA", "#FF00F5"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.addButtonGradient}
                        >
                            <Text style={styles.addButtonText}>ADD TO FOOD LOG</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
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
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: CARD_BG,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    content: {
        flex: 1,
    },
    foodHeader: {
        backgroundColor: CARD_BG,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        marginRight: 16,
        backgroundColor: LIGHT_GRAY,
    },
    foodImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    foodTitleContainer: {
        flex: 1,
    },
    foodName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 4,
    },
    brandName: {
        fontSize: 14,
        color: GRAY,
        marginBottom: 4,
    },
    servingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    servingText: {
        fontSize: 14,
        color: GRAY,
    },
    healthinessIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    healthinessText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: WHITE,
        marginRight: 4,
    },
    healthinessLabel: {
        fontSize: 12,
        color: WHITE,
    },
    section: {
        backgroundColor: CARD_BG,
        padding: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 12,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quantityButton: {
        width: 40,
        height: 40,
        backgroundColor: LIGHT_GRAY,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    quantityInput: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 8,
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        minWidth: 60,
    },
    servingUnitText: {
        color: WHITE,
        fontSize: 16,
        marginLeft: 8,
    },
    mealOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    mealOption: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 12,
        margin: 4,
        alignItems: 'center',
    },
    selectedMealOption: {
        backgroundColor: BLUE_ACCENT,
    },
    mealOptionText: {
        color: WHITE,
        fontWeight: '500',
    },
    selectedMealOptionText: {
        fontWeight: 'bold',
    },
    notesInput: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 4,
    },
    macroLabel: {
        fontSize: 14,
        color: GRAY,
    },
    detailedNutrition: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 16,
    },
    nutritionCategory: {
        marginBottom: 16,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: CARD_BG,
        paddingBottom: 4,
    },
    nutrientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    nutrientName: {
        fontSize: 14,
        color: GRAY,
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '500',
        color: WHITE,
    },
    bottomBar: {
        backgroundColor: CARD_BG,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: LIGHT_GRAY,
    },
    addButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    addButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    addButtonText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
}); 