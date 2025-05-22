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
import { FoodItem } from '../api/nutritionix';

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
    const [calories, setCalories] = useState<string>('0');
    const [proteins, setProteins] = useState<string>('0');
    const [carbs, setCarbs] = useState<string>('0');
    const [fats, setFats] = useState<string>('0');
    const [selectedMeal, setSelectedMeal] = useState<string>('Breakfast');
    const [quantity, setQuantity] = useState<string>('1');
    const [servingUnit, setServingUnit] = useState<string>('serving');

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
                            {mealOptions.map((meal, index) => (
                                <TouchableOpacity
                                    key={meal}
                                    style={[
                                        styles.mealOption,
                                        selectedMeal === meal && styles.selectedMealOption,
                                        index === mealOptions.length - 1 && { marginRight: 0 }
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
                            ))}
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
                            <Text style={styles.label}>Calories</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
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

                    {/* Save Button */}
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            style={styles.saveGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.saveButtonText}>Save Food</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
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
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        marginRight: 8,
        alignItems: 'center',
    },
    selectedMealOption: {
        backgroundColor: PURPLE_ACCENT,
    },
    mealOptionText: {
        color: WHITE,
        fontSize: 13,
        textAlign: 'center',
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
}); 