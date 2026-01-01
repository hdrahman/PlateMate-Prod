import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    StatusBar,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { addFoodLog, getUserGoals, UserGoals } from '../utils/database';
import * as Haptics from 'expo-haptics';
import {
    getSuggestedUnitsForFood,
    convertFoodUnit,
    recalculateNutrition,
    formatUnitName,
    isValidUnitForFood,
    FoodUnit
} from '../utils/foodUnitConversion';
import { useAuth } from '../context/AuthContext';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';
import { ThemeContext } from '../ThemeContext';
import { Serving } from '../services/BarcodeService';

const { width: screenWidth } = Dimensions.get('window');

// Theme colors matching FoodDetail.tsx
const MACRO_COLORS = {
    carbs: '#4FC3F7',
    protein: '#66BB6A',
    fat: '#FFB74D'
};

// Navigation types
type RootStackParamList = {
    FoodLog: { refresh?: number };
    Scanner: { mode?: 'camera' | 'barcode' };
    ScannedProduct: { foodData: any; mealType?: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'ScannedProduct'>;

const ScannedProduct: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { foodData, mealType: initialMealType } = route.params as { foodData: any; mealType?: string };

    // State management
    const [mealType, setMealType] = useState(initialMealType || 'Breakfast');
    const [quantity, setQuantity] = useState(foodData?.serving_qty ? String(foodData.serving_qty) : '1');
    const [servingUnit, setServingUnit] = useState(foodData?.serving_unit || 'serving');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [availableUnits, setAvailableUnits] = useState<FoodUnit[]>([]);
    const [currentNutrition, setCurrentNutrition] = useState(foodData);
    const [dailyGoals, setDailyGoals] = useState<UserGoals | null>(null);
    const [selectedServing, setSelectedServing] = useState<Serving | null>(null);
    const [apiServings, setApiServings] = useState<Serving[]>([]);

    // Fetch user's daily goals
    useEffect(() => {
        const fetchDailyGoals = async () => {
            if (user?.uid) {
                try {
                    const goals = await getUserGoals(user.uid);
                    setDailyGoals(goals);
                } catch (error) {
                    console.error('Error fetching daily goals:', error);
                    setDailyGoals({
                        calorieGoal: 2000,
                        proteinGoal: 100,
                        carbGoal: 250,
                        fatGoal: 67
                    });
                }
            }
        };

        fetchDailyGoals();
    }, [user]);

    // Initialize available units and nutrition on mount
    useEffect(() => {
        const foodName = foodData?.food_name || '';
        const units = getSuggestedUnitsForFood(foodName);
        
        // Extract API servings if available
        if (foodData?.all_servings && Array.isArray(foodData.all_servings) && foodData.all_servings.length > 0) {
            setApiServings(foodData.all_servings);
            
            const defaultServing = foodData.all_servings.find((s: Serving) => s.is_default);
            setSelectedServing(defaultServing || foodData.all_servings[0]);
        }
        
        setAvailableUnits(units);

        const currentUnitExists = units.some(unit => unit.key === servingUnit);
        if (!currentUnitExists && servingUnit) {
            if (isValidUnitForFood(foodName, servingUnit)) {
                const allUnits = getSuggestedUnitsForFood(foodName);
                const currentUnitObj = allUnits.find(unit => unit.key === servingUnit);
                if (currentUnitObj) {
                    setAvailableUnits([currentUnitObj, ...units]);
                }
            }
        }
    }, [foodData, servingUnit]);

    // Update nutrition when quantity or unit changes
    useEffect(() => {
        if (foodData) {
            const baseQuantity = foodData.serving_qty || 1;
            const baseUnit = foodData.serving_unit || 'serving';
            const currentQuantityNum = parseFloat(quantity) || 1;

            const newNutrition = recalculateNutrition(
                foodData,
                baseQuantity,
                baseUnit,
                currentQuantityNum,
                servingUnit,
                foodData.food_name || '',
                foodData.serving_weight_grams
            );

            setCurrentNutrition(newNutrition);
        }
    }, [quantity, servingUnit, foodData]);

    // Calculate nutrition values
    const calculateNutrient = (value: number) => {
        return Math.round(value || 0);
    };

    const calories = currentNutrition?.calories || 0;
    const proteins = currentNutrition?.proteins || 0;
    const carbs = currentNutrition?.carbs || 0;
    const fats = currentNutrition?.fats || 0;

    // Helper function to get color based on healthiness rating
    const getHealthinessColor = (rating: number): string => {
        if (rating <= 4) return theme.colors.error;
        if (rating <= 7) return theme.colors.warning;
        return theme.colors.success;
    };

    // Helper function to format macro percentages
    const getMacroPercentages = () => {
        const totalCals = calories;
        if (totalCals === 0) return { carbs: 0, fat: 0, protein: 0 };

        const carbCals = carbs * 4;
        const fatCals = fats * 9;
        const proteinCals = proteins * 4;

        return {
            carbs: Math.round((carbCals / totalCals) * 100),
            fat: Math.round((fatCals / totalCals) * 100),
            protein: Math.round((proteinCals / totalCals) * 100)
        };
    };

    // Daily value percentages
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

    // Render macro circle
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

    // Handle unit change
    const handleUnitChange = (newUnit: string) => {
        const foodName = foodData?.food_name || '';

        if (!isValidUnitForFood(foodName, newUnit)) {
            Alert.alert(
                'Invalid Unit',
                `${newUnit} is not a suitable measurement unit for ${foodName}. Please choose a different unit.`,
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            const currentQuantityNum = parseFloat(quantity) || 1;
            const convertedQuantity = convertFoodUnit(
                currentQuantityNum,
                servingUnit,
                newUnit,
                foodName,
                foodData?.serving_weight_grams
            );

            setQuantity(convertedQuantity.toFixed(2).replace(/\.?0+$/, ''));
            setServingUnit(newUnit);
            setShowUnitModal(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.error('Error converting units:', error);
            Alert.alert('Conversion Error', 'Unable to convert to the selected unit.');
        }
    };

    // Increment/decrement quantity
    const getStepSize = (unit: string): number => {
        const stepSizes: Record<string, number> = {
            'tsp': 0.25,
            'tbsp': 0.25,
            'fl oz': 0.5,
            'cup': 0.25,
            'g': 5,
            'oz': 0.25,
            'ml': 10,
            'piece': 1,
            'slice': 1,
            'serving': 0.5,
        };
        return stepSizes[unit] || 0.5;
    };

    const adjustQuantity = (increment: boolean) => {
        const currentQty = parseFloat(quantity) || 0;
        const step = getStepSize(servingUnit);
        const newQty = increment ? currentQty + step : Math.max(step, currentQty - step);
        setQuantity(newQty.toString().replace(/\.?0+$/, ''));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const foodLog = {
                meal_id: Date.now().toString(),
                food_name: foodData.food_name || 'Unknown Food',
                brand_name: foodData.brand_name || '',
                meal_type: mealType,
                date: formattedDate,
                quantity: `${quantity} ${servingUnit}`,
                weight: null,
                weight_unit: 'g',
                calories: calories || 0,
                proteins: proteins || -1,
                carbs: carbs || -1,
                fats: fats || -1,
                fiber: currentNutrition?.fiber || -1,
                sugar: currentNutrition?.sugar || -1,
                saturated_fat: currentNutrition?.saturated_fat || -1,
                polyunsaturated_fat: currentNutrition?.polyunsaturated_fat || -1,
                monounsaturated_fat: currentNutrition?.monounsaturated_fat || -1,
                trans_fat: currentNutrition?.trans_fat || -1,
                cholesterol: currentNutrition?.cholesterol || -1,
                sodium: currentNutrition?.sodium || -1,
                potassium: currentNutrition?.potassium || -1,
                vitamin_a: currentNutrition?.vitamin_a || -1,
                vitamin_c: currentNutrition?.vitamin_c || -1,
                calcium: currentNutrition?.calcium || -1,
                iron: currentNutrition?.iron || -1,
                healthiness_rating: foodData.healthiness_rating || 5,
                notes: notes ? `${notes} | Scanned product` : 'Scanned product',
                image_url: foodData.image || '',
                file_key: 'default_key'
            };

            const refreshTimestamp = Date.now();
            navigation.navigate('FoodLog', { refresh: refreshTimestamp });

            await addFoodLog(foodLog);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const macroPercentages = getMacroPercentages();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Image Section (Dark Background with Controls) */}
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
                                onPress={() => navigation.goBack()}
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
                        <Text style={styles.foodName}>{foodData.food_name || 'Unknown Product'}</Text>
                        {foodData.brand_name && (
                            <Text style={styles.brandName}>{foodData.brand_name}</Text>
                        )}
                    </View>
                </View>

                {/* Main Content Container */}
                <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
                    {/* Calories Section */}
                    <View style={styles.calorieSection}>
                        <View style={styles.calorieAlignmentContainer}>
                            <View style={styles.calorieRow}>
                                <Text style={[styles.calorieNumber, { color: theme.colors.text }]}>{calories}</Text>
                                <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>calories</Text>
                            </View>
                        </View>
                    </View>

                    {/* Quantity controls and Add button row - inline (below calories) */}
                    <View style={styles.quantityAndAddRow}>
                        <View style={styles.quantityControlsInline}>
                            <TouchableOpacity
                                style={[styles.quantityButtonInline, { backgroundColor: theme.colors.border }]}
                                onPress={() => adjustQuantity(false)}
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
                                onPress={() => adjustQuantity(true)}
                            >
                                <Ionicons name="add" size={18} color={theme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.unitSelectorInline, { backgroundColor: theme.colors.border }]}
                                onPress={() => setShowUnitModal(true)}
                            >
                                <Text style={[styles.unitTextInline, { color: theme.colors.text }]}>
                                    {formatUnitName(servingUnit, parseFloat(quantity) || 1)}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Add button on the right */}
                        <TouchableOpacity
                            style={[styles.addButtonInline, { borderColor: theme.colors.success }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={theme.colors.success} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={18} color={theme.colors.success} />
                                    <Text style={[styles.addButtonInlineText, { color: theme.colors.success }]}>Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Macros Visual Section with Circular Progress */}
                    <View style={styles.macrosSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="fitness" size={20} color={theme.colors.primary} />
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Macronutrients</Text>
                        </View>
                        <View style={styles.macrosRow}>
                            {renderMacroCircle('Carbs', carbs, 'g', macroPercentages.carbs, MACRO_COLORS.carbs)}
                            {renderMacroCircle('Protein', proteins, 'g', macroPercentages.protein, MACRO_COLORS.protein)}
                            {renderMacroCircle('Fat', fats, 'g', macroPercentages.fat, MACRO_COLORS.fat)}
                        </View>
                    </View>

                    {/* Enhanced Nutrition Facts */}
                    <View style={styles.detailsSection}>
                        {/* Main Macros with Progress */}
                        <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            {renderNutrientRowWithProgress('leaf', 'Total Carbohydrates', carbs, 'g', MACRO_COLORS.carbs)}
                            {renderNutrientRowWithProgress('git-branch', 'Dietary Fiber', currentNutrition?.fiber, 'g', '#8BC34A', true, 'fiber')}
                            {renderNutrientRowWithProgress('cafe', 'Total Sugars', currentNutrition?.sugar, 'g', '#FF7043', true, 'sugar')}
                            {renderNutrientRowWithProgress('fitness', 'Protein', proteins, 'g', MACRO_COLORS.protein)}
                            {renderNutrientRowWithProgress('water', 'Total Fat', fats, 'g', MACRO_COLORS.fat)}
                        </View>

                        {/* Fat Breakdown */}
                        {(hasNutritionalValue(currentNutrition?.saturated_fat) || hasNutritionalValue(currentNutrition?.trans_fat) || 
                          hasNutritionalValue(currentNutrition?.polyunsaturated_fat) || hasNutritionalValue(currentNutrition?.monounsaturated_fat)) && (
                            <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                                <View style={styles.subSectionHeader}>
                                    <Ionicons name="ellipse" size={16} color={MACRO_COLORS.fat} />
                                    <Text style={[styles.subSectionTitle, { color: theme.colors.primary }]}>Fat Breakdown</Text>
                                </View>
                                {renderNutrientRowWithProgress('warning', 'Saturated Fat', currentNutrition?.saturated_fat, 'g', '#FF5722', true, 'saturated_fat')}
                                {renderNutrientRowWithProgress('close', 'Trans Fat', currentNutrition?.trans_fat, 'g', '#F44336')}
                                {renderNutrientRowWithProgress('leaf', 'Polyunsaturated Fat', currentNutrition?.polyunsaturated_fat, 'g', '#FF9800')}
                                {renderNutrientRowWithProgress('leaf-outline', 'Monounsaturated Fat', currentNutrition?.monounsaturated_fat, 'g', '#FFC107')}
                            </View>
                        )}

                        {/* Vitamins & Minerals with Progress */}
                        {(hasNutritionalValue(currentNutrition?.cholesterol) || hasNutritionalValue(currentNutrition?.sodium) || 
                          hasNutritionalValue(currentNutrition?.potassium) || hasNutritionalValue(currentNutrition?.vitamin_a) || 
                          hasNutritionalValue(currentNutrition?.vitamin_c) || hasNutritionalValue(currentNutrition?.calcium) || 
                          hasNutritionalValue(currentNutrition?.iron)) && (
                            <View style={[styles.nutrientGroup, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                                <View style={styles.subSectionHeader}>
                                    <Ionicons name="sparkles" size={16} color="#FFA726" />
                                    <Text style={[styles.subSectionTitle, { color: theme.colors.primary }]}>Vitamins & Minerals</Text>
                                </View>
                                {renderNutrientRowWithProgress('heart', 'Cholesterol', currentNutrition?.cholesterol, 'mg', '#E91E63', true, 'cholesterol')}
                                {renderNutrientRowWithProgress('water', 'Sodium', currentNutrition?.sodium, 'mg', '#2196F3', true, 'sodium')}
                                {renderNutrientRowWithProgress('flash', 'Potassium', currentNutrition?.potassium, 'mg', '#9C27B0', true, 'potassium')}
                                {renderNutrientRowWithProgress('eye', 'Vitamin A', currentNutrition?.vitamin_a, 'mcg', '#FF7043', true, 'vitamin_a')}
                                {renderNutrientRowWithProgress('sunny', 'Vitamin C', currentNutrition?.vitamin_c, 'mg', '#FFA726', true, 'vitamin_c')}
                                {renderNutrientRowWithProgress('diamond', 'Calcium', currentNutrition?.calcium, 'mg', '#AB47BC', true, 'calcium')}
                                {renderNutrientRowWithProgress('magnet', 'Iron', currentNutrition?.iron, 'mg', '#EF5350', true, 'iron')}
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

            {/* Unit Selection Modal */}
            <Modal
                visible={showUnitModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowUnitModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Unit</Text>
                            <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll}>
                            {availableUnits.map((unit) => (
                                <TouchableOpacity
                                    key={unit.key}
                                    style={[
                                        styles.unitOption,
                                        { borderBottomColor: theme.colors.border },
                                        servingUnit === unit.key && { backgroundColor: theme.colors.border }
                                    ]}
                                    onPress={() => handleUnitChange(unit.key)}
                                >
                                    <Text style={[
                                        styles.unitOptionText,
                                        { color: theme.colors.text },
                                        servingUnit === unit.key && { fontWeight: '700' }
                                    ]}>
                                        {unit.name}
                                    </Text>
                                    {servingUnit === unit.key && (
                                        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
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
    unitSelectorInline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 4,
    },
    unitTextInline: {
        fontSize: 14,
        fontWeight: '600',
    },
    addButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        gap: 6,
    },
    addButtonInlineText: {
        fontSize: 16,
        fontWeight: '700',
    },
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalScroll: {
        maxHeight: 400,
    },
    unitOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    unitOptionText: {
        fontSize: 16,
        fontWeight: '500',
    },
});

export default ScannedProduct;
