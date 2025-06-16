import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    StatusBar,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { addFoodLog } from '../utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import {
    getSuggestedUnitsForFood,
    convertFoodUnit,
    recalculateNutrition,
    formatUnitName,
    isValidUnitForFood,
    FoodUnit
} from '../utils/foodUnitConversion';
import { getUserGoals, UserGoals } from '../utils/database';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// Navigation types
type RootStackParamList = {
    'Food Log': { refresh?: number };
    BarcodeResults: { foodData: any; mealType?: string };
    BarcodeScanner: undefined;
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'BarcodeResults'>;

// Modern color scheme inspired by MyFitnessPal and Calai
const PRIMARY_BG = '#000000';
const SECONDARY_BG = '#111111';
const CARD_BG = '#1a1a1a';
const WHITE = '#FFFFFF';
const GRAY_LIGHT = '#B0B0B0';
const GRAY_MEDIUM = '#808080';
const GRAY_DARK = '#333333';
const ACCENT_BLUE = '#0084ff';
const ACCENT_GREEN = '#32D74B';
const ACCENT_ORANGE = '#FF9500';
const ACCENT_RED = '#FF3B30';
const ACCENT_PURPLE = '#AF52DE';
const ACCENT_PINK = '#FF2D92';

const BarcodeResults: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { user } = useAuth();
    const { foodData, mealType: initialMealType } = route.params as { foodData: any; mealType?: string };

    // State management
    const [mealType, setMealType] = useState(initialMealType || 'Breakfast');
    const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
    const [quantity, setQuantity] = useState(foodData?.serving_qty ? String(foodData.serving_qty) : '1');
    const [servingUnit, setServingUnit] = useState(foodData?.serving_unit || 'serving');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [availableUnits, setAvailableUnits] = useState<FoodUnit[]>([]);
    const [currentNutrition, setCurrentNutrition] = useState(foodData);
    const [dailyGoals, setDailyGoals] = useState<UserGoals | null>(null);

    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    // Fetch user's daily goals
    useEffect(() => {
        const fetchDailyGoals = async () => {
            if (user?.uid) {
                try {
                    const goals = await getUserGoals(user.uid);
                    setDailyGoals(goals);
                } catch (error) {
                    console.error('Error fetching daily goals:', error);
                    // Set default goals if fetch fails
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
        setAvailableUnits(units);

        // Ensure current unit is in available units, if not add it
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

    // Calculate nutrition values based on current quantity and unit
    const calories = currentNutrition?.calories || 0;
    const proteins = currentNutrition?.proteins || 0;
    const carbs = currentNutrition?.carbs || 0;
    const fats = currentNutrition?.fats || 0;

    // Handle unit change
    const handleUnitChange = (newUnit: string) => {
        const foodName = foodData?.food_name || '';

        // Validate if the unit is appropriate for this food
        if (!isValidUnitForFood(foodName, newUnit)) {
            Alert.alert(
                'Invalid Unit',
                `${newUnit} is not a suitable measurement unit for ${foodName}. Please choose a different unit.`,
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            // Convert current quantity to new unit
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
        } catch (error) {
            console.error('Error converting units:', error);
            Alert.alert('Conversion Error', 'Unable to convert to the selected unit.');
        }
    };

    // Increment/decrement with smart step sizes
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

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Macronutrient data for pie chart
    const macroData = [
        {
            name: 'Carbs',
            population: carbs * 4, // 4 cal per gram
            color: ACCENT_BLUE,
            legendFontColor: GRAY_LIGHT,
            legendFontSize: 12,
        },
        {
            name: 'Protein',
            population: proteins * 4, // 4 cal per gram
            color: ACCENT_GREEN,
            legendFontColor: GRAY_LIGHT,
            legendFontSize: 12,
        },
        {
            name: 'Fat',
            population: fats * 9, // 9 cal per gram
            color: ACCENT_ORANGE,
            legendFontColor: GRAY_LIGHT,
            legendFontSize: 12,
        },
    ].filter(item => item.population > 0);

    // Progress data for individual macro circles
    const progressData = {
        labels: ['Carbs', 'Protein', 'Fat'],
        data: [
            carbs / Math.max(carbs, proteins, fats, 50), // Normalize to highest value or minimum 50g
            proteins / Math.max(carbs, proteins, fats, 50),
            fats / Math.max(carbs, proteins, fats, 50),
        ],
        colors: [ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE]
    };

    // Chart configuration
    const chartConfig = {
        backgroundColor: 'transparent',
        backgroundGradientFrom: 'transparent',
        backgroundGradientTo: 'transparent',
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        strokeWidth: 3,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Get user ID from storage
            const userId = await AsyncStorage.getItem('user_id');
            if (!userId) {
                Alert.alert('Error', 'Please log in to continue');
                return;
            }

            // Prepare food log entry
            const foodLogEntry = {
                user_id: parseInt(userId),
                meal_type: mealType,
                food_name: foodData.food_name || 'Unknown Food',
                brand_name: foodData.brand_name || '',
                quantity: `${quantity} ${servingUnit}`,
                calories: calories,
                proteins: proteins,
                carbs: carbs,
                fats: fats,
                notes: notes ? `${notes} | Scanned barcode` : 'Scanned barcode',
                timestamp: new Date().toISOString(),
            };

            console.log('Adding food log entry:', foodLogEntry);

            // Add to database
            const result = await addFoodLog(foodLogEntry);

            if (result) {
                // Automatically navigate to Food Log
                navigation.navigate('Food Log', { refresh: Date.now() });
            } else {
                throw new Error('Failed to add food log entry');
            }
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleMealTypeSelect = (type: string) => {
        setMealType(type);
        setShowMealTypeDropdown(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                <TouchableOpacity style={styles.headerButton}>
                    <Ionicons name="bookmark-outline" size={24} color={GRAY_LIGHT} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Single Main Nutrition Card */}
                <View style={styles.mainCard}>
                    <LinearGradient
                        colors={[CARD_BG, SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        {/* Product Header Section */}
                        <View style={styles.productSection}>
                            <View style={styles.productInfo}>
                                <Text style={styles.productName} numberOfLines={2}>
                                    {foodData.food_name || 'Unknown Product'}
                                </Text>
                                {foodData.brand_name && (
                                    <Text style={styles.brandName}>{foodData.brand_name}</Text>
                                )}

                                {/* Serving Controls - Inline */}
                                <View style={styles.servingControls}>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => adjustQuantity(false)}
                                    >
                                        <Ionicons name="remove" size={14} color={ACCENT_BLUE} />
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
                                        onPress={() => adjustQuantity(true)}
                                    >
                                        <Ionicons name="add" size={14} color={ACCENT_BLUE} />
                                    </TouchableOpacity>
                                    <Text style={styles.servingUnit}>{servingUnit}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.sectionDivider} />

                        {/* Calories & Macros Section */}
                        <View style={styles.nutritionSection}>
                            {/* Large Calorie Display */}
                            <View style={styles.caloriesContainer}>
                                <Text style={styles.caloriesValue}>{calories}</Text>
                                <Text style={styles.caloriesLabel}>calories</Text>
                            </View>

                            {/* Macros Row */}
                            <View style={styles.macrosRow}>
                                <View style={styles.macroItem}>
                                    <Text style={styles.macroValue}>{carbs}g</Text>
                                    <Text style={styles.macroLabel}>Carbs</Text>
                                    <View style={[styles.macroBar, { backgroundColor: ACCENT_BLUE + '30' }]}>
                                        <View style={[styles.macroProgress, {
                                            width: `${Math.min(100, (carbs / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                            backgroundColor: ACCENT_BLUE
                                        }]} />
                                    </View>
                                </View>

                                <View style={styles.macroItem}>
                                    <Text style={styles.macroValue}>{proteins}g</Text>
                                    <Text style={styles.macroLabel}>Protein</Text>
                                    <View style={[styles.macroBar, { backgroundColor: ACCENT_GREEN + '30' }]}>
                                        <View style={[styles.macroProgress, {
                                            width: `${Math.min(100, (proteins / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                            backgroundColor: ACCENT_GREEN
                                        }]} />
                                    </View>
                                </View>

                                <View style={styles.macroItem}>
                                    <Text style={styles.macroValue}>{fats}g</Text>
                                    <Text style={styles.macroLabel}>Fat</Text>
                                    <View style={[styles.macroBar, { backgroundColor: ACCENT_ORANGE + '30' }]}>
                                        <View style={[styles.macroProgress, {
                                            width: `${Math.min(100, (fats / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                            backgroundColor: ACCENT_ORANGE
                                        }]} />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Additional Nutrients - Compact */}
                        {(foodData.fiber || foodData.sugar || foodData.sodium) && (
                            <>
                                <View style={styles.sectionDivider} />
                                <View style={styles.additionalNutrients}>
                                    <Text style={styles.sectionSubtitle}>Additional Info</Text>
                                    <View style={styles.nutrientGrid}>
                                        {foodData.fiber && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{currentNutrition?.fiber || 0}g</Text>
                                                <Text style={styles.nutrientLabel}>Fiber</Text>
                                            </View>
                                        )}
                                        {foodData.sugar && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{currentNutrition?.sugar || 0}g</Text>
                                                <Text style={styles.nutrientLabel}>Sugar</Text>
                                            </View>
                                        )}
                                        {foodData.sodium && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{currentNutrition?.sodium || 0}mg</Text>
                                                <Text style={styles.nutrientLabel}>Sodium</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Divider */}
                        <View style={styles.sectionDivider} />

                        {/* Enhanced Serving Controls */}
                        <View style={styles.servingSection}>
                            <Text style={styles.sectionSubtitle}>Serving Size</Text>
                            <View style={styles.servingControls}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => adjustQuantity(false)}
                                >
                                    <Ionicons name="remove" size={14} color={ACCENT_BLUE} />
                                </TouchableOpacity>

                                <View style={styles.quantityInputContainer}>
                                    <TextInput
                                        style={styles.quantityInput}
                                        value={quantity}
                                        onChangeText={setQuantity}
                                        keyboardType="decimal-pad"
                                        selectTextOnFocus
                                    />
                                </View>

                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => adjustQuantity(true)}
                                >
                                    <Ionicons name="add" size={14} color={ACCENT_BLUE} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.unitSelector}
                                    onPress={() => setShowUnitModal(true)}
                                >
                                    <Text style={styles.servingUnit}>
                                        {formatUnitName(servingUnit, parseFloat(quantity) || 1)}
                                    </Text>
                                    <Ionicons name="chevron-down" size={12} color={GRAY_LIGHT} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Meal Selection & Notes - Compact */}
                        <View style={styles.bottomSection}>
                            <View style={styles.mealSelection}>
                                <Text style={styles.sectionSubtitle}>Add to</Text>
                                <TouchableOpacity
                                    style={styles.mealSelector}
                                    onPress={() => setShowMealTypeDropdown(true)}
                                >
                                    <MaterialIcons
                                        name={
                                            mealType === 'Breakfast' ? 'wb-sunny' :
                                                mealType === 'Lunch' ? 'lunch-dining' :
                                                    mealType === 'Dinner' ? 'dinner-dining' : 'local-cafe'
                                        }
                                        size={16}
                                        color={ACCENT_BLUE}
                                    />
                                    <Text style={styles.mealText}>{mealType}</Text>
                                    <Ionicons name="chevron-down" size={16} color={GRAY_LIGHT} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.notesSection}>
                                <Text style={styles.sectionSubtitle}>Notes</Text>
                                <TextInput
                                    style={styles.notesInput}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Optional notes..."
                                    placeholderTextColor={GRAY_MEDIUM}
                                    multiline
                                    numberOfLines={2}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Daily Goals Progress */}
                {dailyGoals && (
                    <View style={styles.dailyGoalsCard}>
                        <LinearGradient
                            colors={[CARD_BG, SECONDARY_BG]}
                            style={styles.cardGradient}
                        >
                            <Text style={styles.sectionTitle}>Impact on Daily Goals</Text>

                            {/* Circular Progress for Calories */}
                            <View style={styles.calorieProgressContainer}>
                                <View style={styles.circularProgress}>
                                    <View style={styles.circularProgressInner}>
                                        <Text style={styles.calorieProgressValue}>{calories}</Text>
                                        <Text style={styles.calorieProgressLabel}>Cal</Text>
                                    </View>
                                </View>
                                <View style={styles.calorieProgressInfo}>
                                    <Text style={styles.calorieGoalText}>
                                        {Math.round(((calories / (dailyGoals.calorieGoal || 2000)) * 100))}% of daily goal
                                    </Text>
                                    <Text style={styles.calorieGoalSubtext}>
                                        {dailyGoals.calorieGoal || 2000} cal target
                                    </Text>
                                </View>
                            </View>

                            {/* Macro Progress Bars */}
                            <View style={styles.macroProgressSection}>
                                <View style={styles.macroProgressItem}>
                                    <View style={styles.macroProgressHeader}>
                                        <Text style={styles.macroProgressLabel}>Carbs</Text>
                                        <Text style={styles.macroProgressValue}>
                                            {Math.round(((carbs / (dailyGoals.carbGoal || 250)) * 100))}%
                                        </Text>
                                    </View>
                                    <View style={styles.macroProgressBarContainer}>
                                        <View
                                            style={[
                                                styles.macroProgressBar,
                                                {
                                                    width: `${Math.min(100, (carbs / (dailyGoals.carbGoal || 250)) * 100)}%`,
                                                    backgroundColor: ACCENT_BLUE
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.macroProgressSubtext}>
                                        {carbs}g / {dailyGoals.carbGoal || 250}g
                                    </Text>
                                </View>

                                <View style={styles.macroProgressItem}>
                                    <View style={styles.macroProgressHeader}>
                                        <Text style={styles.macroProgressLabel}>Protein</Text>
                                        <Text style={styles.macroProgressValue}>
                                            {Math.round(((proteins / (dailyGoals.proteinGoal || 100)) * 100))}%
                                        </Text>
                                    </View>
                                    <View style={styles.macroProgressBarContainer}>
                                        <View
                                            style={[
                                                styles.macroProgressBar,
                                                {
                                                    width: `${Math.min(100, (proteins / (dailyGoals.proteinGoal || 100)) * 100)}%`,
                                                    backgroundColor: ACCENT_GREEN
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.macroProgressSubtext}>
                                        {proteins}g / {dailyGoals.proteinGoal || 100}g
                                    </Text>
                                </View>

                                <View style={styles.macroProgressItem}>
                                    <View style={styles.macroProgressHeader}>
                                        <Text style={styles.macroProgressLabel}>Fat</Text>
                                        <Text style={styles.macroProgressValue}>
                                            {Math.round(((fats / (dailyGoals.fatGoal || 67)) * 100))}%
                                        </Text>
                                    </View>
                                    <View style={styles.macroProgressBarContainer}>
                                        <View
                                            style={[
                                                styles.macroProgressBar,
                                                {
                                                    width: `${Math.min(100, (fats / (dailyGoals.fatGoal || 67)) * 100)}%`,
                                                    backgroundColor: ACCENT_ORANGE
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.macroProgressSubtext}>
                                        {fats}g / {dailyGoals.fatGoal || 67}g
                                    </Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* Bottom spacing for fixed button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fixed Bottom Action */}
            <View style={styles.bottomContainer}>
                <LinearGradient
                    colors={[PRIMARY_BG + 'F0', PRIMARY_BG]}
                    style={styles.bottomGradient}
                >
                    <TouchableOpacity
                        style={[styles.addButton, loading && styles.addButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={loading ? [GRAY_MEDIUM, GRAY_DARK] : [ACCENT_BLUE, ACCENT_PURPLE]}
                            style={styles.addButtonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={WHITE} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={20} color={WHITE} />
                                    <Text style={styles.addButtonText}>Add to {mealType}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </View>

            {/* Meal Type Modal */}
            <Modal
                visible={showMealTypeDropdown}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMealTypeDropdown(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMealTypeDropdown(false)}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={() => { }}
                    >
                        <LinearGradient
                            colors={[CARD_BG, SECONDARY_BG]}
                            style={styles.modalGradient}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Meal</Text>
                                <TouchableOpacity onPress={() => setShowMealTypeDropdown(false)}>
                                    <Ionicons name="close" size={24} color={GRAY_LIGHT} />
                                </TouchableOpacity>
                            </View>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.modalOption,
                                        mealType === type && styles.selectedModalOption
                                    ]}
                                    onPress={() => handleMealTypeSelect(type)}
                                >
                                    <View style={styles.modalOptionContent}>
                                        <MaterialIcons
                                            name={
                                                type === 'Breakfast' ? 'wb-sunny' :
                                                    type === 'Lunch' ? 'lunch-dining' :
                                                        type === 'Dinner' ? 'dinner-dining' : 'local-cafe'
                                            }
                                            size={20}
                                            color={mealType === type ? ACCENT_BLUE : GRAY_MEDIUM}
                                        />
                                        <Text style={[
                                            styles.modalOptionText,
                                            mealType === type && styles.selectedModalOptionText
                                        ]}>
                                            {type}
                                        </Text>
                                    </View>
                                    {mealType === type && (
                                        <Ionicons name="checkmark" size={20} color={ACCENT_BLUE} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </LinearGradient>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Unit Selection Modal */}
            <Modal
                visible={showUnitModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowUnitModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowUnitModal(false)}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={() => { }}
                    >
                        <LinearGradient
                            colors={[CARD_BG, SECONDARY_BG]}
                            style={styles.modalGradient}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Unit</Text>
                                <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                                    <Ionicons name="close" size={24} color={GRAY_LIGHT} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.unitsList}>
                                {availableUnits.map((unit) => (
                                    <TouchableOpacity
                                        key={unit.key}
                                        style={[
                                            styles.modalOption,
                                            servingUnit === unit.key && styles.selectedModalOption
                                        ]}
                                        onPress={() => handleUnitChange(unit.key)}
                                    >
                                        <Text style={[
                                            styles.modalOptionText,
                                            servingUnit === unit.key && styles.selectedModalOptionText
                                        ]}>
                                            {unit.label}
                                        </Text>
                                        {servingUnit === unit.key && (
                                            <Ionicons name="checkmark" size={20} color={ACCENT_BLUE} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </LinearGradient>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

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
        paddingVertical: 12,
        backgroundColor: PRIMARY_BG,
        borderBottomWidth: 1,
        borderBottomColor: GRAY_DARK,
    },
    headerButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: WHITE,
    },
    scrollView: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },

    // Single Main Nutrition Card
    mainCard: {
        margin: 16,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    cardGradient: {
        padding: 16,
    },
    productSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    productInfo: {
        flex: 1,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 16,
        fontWeight: '700',
        color: WHITE,
        lineHeight: 20,
        marginBottom: 4,
    },
    brandName: {
        fontSize: 12,
        color: GRAY_LIGHT,
        fontWeight: '500',
        marginBottom: 8,
    },
    servingControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quantityButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: ACCENT_BLUE + '20',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: ACCENT_BLUE + '40',
    },
    quantityInput: {
        width: 40,
        height: 28,
        backgroundColor: GRAY_DARK,
        borderRadius: 6,
        marginHorizontal: 6,
        textAlign: 'center',
        color: WHITE,
        fontSize: 14,
        fontWeight: '600',
    },
    servingUnit: {
        fontSize: 12,
        color: GRAY_LIGHT,
        fontWeight: '500',
        marginLeft: 6,
    },

    // Section Divider
    sectionDivider: {
        height: 1,
        backgroundColor: GRAY_DARK,
        marginVertical: 16,
    },

    // Nutrition Section
    nutritionSection: {
        marginBottom: 16,
    },
    caloriesContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    caloriesValue: {
        fontSize: 36,
        fontWeight: '800',
        color: WHITE,
        lineHeight: 42,
    },
    caloriesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: GRAY_LIGHT,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: 16,
        fontWeight: '700',
        color: WHITE,
        marginBottom: 4,
    },
    macroLabel: {
        fontSize: 11,
        color: GRAY_LIGHT,
        fontWeight: '500',
        marginBottom: 6,
    },
    macroBar: {
        width: 60,
        height: 4,
        borderRadius: 2,
        backgroundColor: GRAY_DARK,
        overflow: 'hidden',
    },
    macroProgress: {
        height: '100%',
        borderRadius: 2,
    },

    // Additional Nutrients
    additionalNutrients: {
        marginBottom: 16,
    },
    sectionSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 12,
    },
    nutrientGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    nutrientItem: {
        alignItems: 'center',
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 2,
    },
    nutrientLabel: {
        fontSize: 11,
        color: GRAY_LIGHT,
        fontWeight: '500',
    },

    // Bottom Section
    bottomSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    mealSelection: {
        flex: 1,
        marginRight: 16,
    },
    mealSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: GRAY_DARK,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
    },
    mealText: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '600',
        marginHorizontal: 8,
    },
    notesSection: {
        flex: 1,
    },
    notesInput: {
        backgroundColor: GRAY_DARK,
        borderRadius: 8,
        padding: 10,
        color: WHITE,
        fontSize: 13,
        minHeight: 60,
        textAlignVertical: 'top',
    },

    // Bottom Container
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 20,
    },
    bottomGradient: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    addButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: WHITE,
        marginLeft: 8,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    modalGradient: {
        paddingTop: 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: WHITE,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginVertical: 4,
    },
    selectedModalOption: {
        backgroundColor: ACCENT_BLUE + '20',
        borderColor: ACCENT_BLUE + '40',
        borderWidth: 1,
    },
    modalOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    modalOptionText: {
        fontSize: 16,
        color: WHITE,
        marginLeft: 12,
        fontWeight: '500',
    },
    selectedModalOptionText: {
        color: ACCENT_BLUE,
        fontWeight: '600',
    },

    // Serving Section
    servingSection: {
        marginBottom: 16,
    },
    quantityInputContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: ACCENT_BLUE + '40',
        borderRadius: 6,
        marginHorizontal: 6,
    },
    unitSelector: {
        padding: 10,
        borderWidth: 1,
        borderColor: ACCENT_BLUE + '40',
        borderRadius: 6,
    },

    // Unit Modal
    unitsList: {
        maxHeight: height * 0.4,
    },

    // Daily Goals Progress
    dailyGoalsCard: {
        margin: 16,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: WHITE,
        marginBottom: 16,
    },
    calorieProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    circularProgress: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: GRAY_DARK,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circularProgressInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: GRAY_DARK,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calorieProgressValue: {
        fontSize: 24,
        fontWeight: '800',
        color: WHITE,
        lineHeight: 28,
    },
    calorieProgressLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: GRAY_LIGHT,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    calorieProgressInfo: {
        marginLeft: 16,
    },
    calorieGoalText: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 4,
    },
    calorieGoalSubtext: {
        fontSize: 12,
        color: GRAY_LIGHT,
        fontWeight: '500',
    },
    macroProgressSection: {
        marginBottom: 16,
    },
    macroProgressItem: {
        marginBottom: 8,
    },
    macroProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    macroProgressLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: WHITE,
    },
    macroProgressValue: {
        fontSize: 14,
        fontWeight: '700',
        color: WHITE,
    },
    macroProgressBarContainer: {
        height: 12,
        borderRadius: 6,
        backgroundColor: GRAY_DARK,
        overflow: 'hidden',
        marginVertical: 4,
    },
    macroProgressBar: {
        height: '100%',
        borderRadius: 6,
    },
    macroProgressSubtext: {
        fontSize: 12,
        color: GRAY_LIGHT,
        fontWeight: '500',
    },
});

export default BarcodeResults; 