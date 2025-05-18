import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodItem } from '../api/nutritionix';

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#2196F3';

interface ManualFoodEntryProps {
    visible: boolean;
    onClose: () => void;
    onAddFood: (food: FoodItem, mealType: string, quantity: number) => void;
}

export default function ManualFoodEntry({ visible, onClose, onAddFood }: ManualFoodEntryProps) {
    const [foodName, setFoodName] = useState<string>('');
    const [calories, setCalories] = useState<string>('0');
    const [proteins, setProteins] = useState<string>('0');
    const [carbs, setCarbs] = useState<string>('0');
    const [fats, setFats] = useState<string>('0');
    const [selectedMeal, setSelectedMeal] = useState<string>('Breakfast');
    const [quantity, setQuantity] = useState<string>('1');
    const [servingUnit, setServingUnit] = useState<string>('serving');
    const [notes, setNotes] = useState<string>('');

    // Optional nutrients with default value 0
    const [fiber, setFiber] = useState<string>('0');
    const [sugar, setSugar] = useState<string>('0');

    // Meal options
    const mealOptions = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    // Reset form
    const resetForm = () => {
        setFoodName('');
        setCalories('0');
        setProteins('0');
        setCarbs('0');
        setFats('0');
        setFiber('0');
        setSugar('0');
        setSelectedMeal('Breakfast');
        setQuantity('1');
        setServingUnit('serving');
        setNotes('');
    };

    // Handle save
    const handleSave = () => {
        // Validate required fields
        if (!foodName.trim()) {
            Alert.alert('Error', 'Please enter a food name');
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
            healthiness_rating: 5, // Default middle value
            notes: notes ? notes + ' (Manual Entry)' : '(Manual Entry)'
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
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Manual Food Entry</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.content}>
                    {/* Basic Info */}
                    <View style={styles.section}>
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

                    {/* Nutrition Facts */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Nutrition Facts</Text>

                        {/* Calories */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Calories*</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                placeholderTextColor={GRAY}
                                value={calories}
                                onChangeText={setCalories}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Macros Row */}
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>Protein (g)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={GRAY}
                                    value={proteins}
                                    onChangeText={setProteins}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>Carbs (g)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={GRAY}
                                    value={carbs}
                                    onChangeText={setCarbs}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Fat (g)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={GRAY}
                                    value={fats}
                                    onChangeText={setFats}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Additional Macros */}
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>Fiber (g)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={GRAY}
                                    value={fiber}
                                    onChangeText={setFiber}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Sugar (g)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    placeholderTextColor={GRAY}
                                    value={sugar}
                                    onChangeText={setSugar}
                                    keyboardType="numeric"
                                />
                            </View>
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

                    {/* Save Button */}
                    <TouchableOpacity style={styles.addButton} onPress={handleSave}>
                        <LinearGradient
                            colors={['#2196F3', '#673AB7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.addButtonGradient}
                        >
                            <Text style={styles.addButtonText}>ADD TO FOOD LOG</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
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
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    label: {
        color: GRAY,
        fontSize: 14,
        marginBottom: 4,
    },
    input: {
        backgroundColor: CARD_BG,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
        color: WHITE,
        padding: 10,
        fontSize: 16,
    },
    mealOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    mealOption: {
        width: '48%',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    selectedMealOption: {
        borderColor: BLUE_ACCENT,
        backgroundColor: 'rgba(33, 150, 243, 0.15)',
    },
    mealOptionText: {
        color: GRAY,
        fontSize: 16,
    },
    selectedMealOptionText: {
        color: WHITE,
        fontWeight: 'bold',
    },
    notesInput: {
        backgroundColor: CARD_BG,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
        color: WHITE,
        padding: 10,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    addButton: {
        marginVertical: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    addButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
}); 