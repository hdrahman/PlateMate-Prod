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
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { addFoodLog, getUserGoals, UserGoals } from '../utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const { width, height } = Dimensions.get('window');

// Modern color scheme
const COLORS = {
    PRIMARY_BG: '#000000',
    SECONDARY_BG: '#111111',
    CARD_BG: '#1a1a1a',
    WHITE: '#FFFFFF',
    GRAY_LIGHT: '#B0B0B0',
    GRAY_MEDIUM: '#808080',
    GRAY_DARK: '#333333',
    ACCENT_BLUE: '#0084ff',
    ACCENT_GREEN: '#32D74B',
    ACCENT_ORANGE: '#FF9500',
    ACCENT_RED: '#FF3B30',
    ACCENT_PURPLE: '#AF52DE',
    ACCENT_PINK: '#FF2D92',
    GLASS: 'rgba(255, 255, 255, 0.1)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
};

// Navigation types
type RootStackParamList = {
    'Food Log': { refresh?: number };
    BarcodeScanner: undefined;
    ScannedProduct: { foodData: any; mealType?: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'ScannedProduct'>;

const ScannedProduct: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { user } = useAuth();
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

    const mealTypes = [
        { name: 'Breakfast', icon: 'sunny-outline', color: COLORS.ACCENT_ORANGE },
        { name: 'Lunch', icon: 'restaurant-outline', color: COLORS.ACCENT_GREEN },
        { name: 'Dinner', icon: 'moon-outline', color: COLORS.ACCENT_BLUE },
        { name: 'Snacks', icon: 'cafe-outline', color: COLORS.ACCENT_PINK }
    ];

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
            // Add current unit to the list if it's valid for this food
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
    const fiber = currentNutrition?.fiber || null;
    const sugar = currentNutrition?.sugar || null;
    const sodium = currentNutrition?.sodium || null;

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
                notes: notes ? `${notes} | Scanned product` : 'Scanned product',
                timestamp: new Date().toISOString(),
            };

            console.log('Adding food log entry:', foodLogEntry);

            // Add to database
            const result = await addFoodLog(foodLogEntry);

            if (result) {
                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_BG} />

            {/* Header */}
            <BlurView intensity={30} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                <TouchableOpacity style={styles.headerButton}>
                    <Ionicons name="bookmark-outline" size={24} color={COLORS.GRAY_LIGHT} />
                </TouchableOpacity>
            </BlurView>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Enhanced Product Header with Image */}
                <View style={styles.productHeaderCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <View style={styles.productSection}>
                            <View style={styles.productInfoSection}>
                                <Text style={styles.productName} numberOfLines={2}>
                                    {foodData.food_name || 'Unknown Product'}
                                </Text>
                                {foodData.brand_name && (
                                    <Text style={styles.brandName}>{foodData.brand_name}</Text>
                                )}

                                {/* Enhanced Serving Controls */}
                                <View style={styles.servingControls}>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => adjustQuantity(false)}
                                    >
                                        <Ionicons name="remove" size={16} color={COLORS.WHITE} />
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
                                        <Ionicons name="add" size={16} color={COLORS.WHITE} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.unitSelector}
                                        onPress={() => setShowUnitModal(true)}
                                    >
                                        <Text style={styles.servingUnitText}>
                                            {formatUnitName(servingUnit, parseFloat(quantity) || 1)}
                                        </Text>
                                        <Ionicons name="chevron-down" size={14} color={COLORS.GRAY_LIGHT} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Enhanced Nutrition Display */}
                <View style={styles.nutritionCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        {/* Large Calorie Display */}
                        <View style={styles.caloriesContainer}>
                            <Text style={styles.caloriesValue}>{calories}</Text>
                            <Text style={styles.caloriesLabel}>calories</Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.sectionDivider} />

                        {/* Enhanced Macros with Progress Bars */}
                        <View style={styles.macrosRow}>
                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{carbs}g</Text>
                                    <Text style={styles.macroLabel}>Carbs</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_BLUE + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (carbs / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_BLUE
                                    }]} />
                                </View>
                            </View>

                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{proteins}g</Text>
                                    <Text style={styles.macroLabel}>Protein</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_GREEN + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (proteins / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_GREEN
                                    }]} />
                                </View>
                            </View>

                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{fats}g</Text>
                                    <Text style={styles.macroLabel}>Fat</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_ORANGE + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (fats / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_ORANGE
                                    }]} />
                                </View>
                            </View>
                        </View>

                        {/* Additional Nutrients - Compact */}
                        {(fiber || sugar || sodium) && (
                            <>
                                <View style={styles.sectionDivider} />
                                <View style={styles.additionalNutrients}>
                                    <Text style={styles.sectionSubtitle}>Additional Info</Text>
                                    <View style={styles.nutrientGrid}>
                                        {fiber && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{fiber}g</Text>
                                                <Text style={styles.nutrientLabel}>Fiber</Text>
                                            </View>
                                        )}
                                        {sugar && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{sugar}g</Text>
                                                <Text style={styles.nutrientLabel}>Sugar</Text>
                                            </View>
                                        )}
                                        {sodium && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{sodium}mg</Text>
                                                <Text style={styles.nutrientLabel}>Sodium</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </>
                        )}
                    </LinearGradient>
                </View>

                {/* Daily Goals Progress */}
                {dailyGoals && (
                    <View style={styles.dailyGoalsCard}>
                        <LinearGradient
                            colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
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
                                                    backgroundColor: COLORS.ACCENT_BLUE
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
                                                    backgroundColor: COLORS.ACCENT_GREEN
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
                                                    backgroundColor: COLORS.ACCENT_ORANGE
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

                {/* Enhanced Meal Type Selection */}
                <View style={styles.mealCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <Text style={styles.sectionTitle}>Add to Meal</Text>
                        <View style={styles.mealTypeGrid}>
                            {mealTypes.map((meal) => (
                                <TouchableOpacity
                                    key={meal.name}
                                    style={[
                                        styles.mealTypeButton,
                                        mealType === meal.name && styles.activeMealType
                                    ]}
                                    onPress={() => setMealType(meal.name)}
                                >
                                    <Ionicons
                                        name={meal.icon as any}
                                        size={24}
                                        color={mealType === meal.name ? COLORS.WHITE : meal.color}
                                    />
                                    <Text style={[
                                        styles.mealTypeText,
                                        mealType === meal.name && styles.activeMealTypeText
                                    ]}>
                                        {meal.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </LinearGradient>
                </View>

                {/* Enhanced Notes */}
                <View style={styles.notesCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add any notes about this food..."
                            placeholderTextColor={COLORS.GRAY_MEDIUM}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            maxLength={200}
                        />
                    </LinearGradient>
                </View>

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
                            style={styles.unitModalContent}
                            activeOpacity={1}
                            onPress={() => { }}
                        >
                            <LinearGradient
                                colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                                style={styles.modalGradient}
                            >
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Select Unit</Text>
                                    <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                                        <Ionicons name="close" size={24} color={COLORS.GRAY_LIGHT} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.unitsList}>
                                    {availableUnits.map((unit) => (
                                        <TouchableOpacity
                                            key={unit.key}
                                            style={[
                                                styles.unitOption,
                                                servingUnit === unit.key && styles.selectedUnitOption
                                            ]}
                                            onPress={() => handleUnitChange(unit.key)}
                                        >
                                            <Text style={[
                                                styles.unitOptionText,
                                                servingUnit === unit.key && styles.selectedUnitOptionText
                                            ]}>
                                                {unit.label}
                                            </Text>
                                            {servingUnit === unit.key && (
                                                <Ionicons name="checkmark" size={20} color={COLORS.ACCENT_BLUE} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </LinearGradient>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

                {/* Bottom spacing for fixed button */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Fixed Bottom Action */}
            <View style={styles.bottomContainer}>
                <LinearGradient
                    colors={[COLORS.PRIMARY_BG + 'F0', COLORS.PRIMARY_BG]}
                    style={styles.bottomGradient}
                >
                    <TouchableOpacity
                        style={[styles.addButton, loading && styles.addButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={loading ? [COLORS.GRAY_MEDIUM, COLORS.GRAY_DARK] : [COLORS.ACCENT_BLUE, COLORS.ACCENT_PURPLE]}
                            style={styles.addButtonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={COLORS.WHITE} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={20} color={COLORS.WHITE} />
                                    <Text style={styles.addButtonText}>Add to {mealType}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.GRAY_DARK,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.GLASS,
        borderWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.WHITE,
    },
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },

    // Card Styles
    productHeaderCard: {
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    nutritionCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    mealCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    notesCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    cardGradient: {
        padding: 20,
    },

    // Product Section
    productSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productInfoSection: {
        flex: 1,
    },
    productName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.WHITE,
        lineHeight: 24,
        marginBottom: 4,
    },
    brandName: {
        fontSize: 14,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
        marginBottom: 16,
    },

    // Serving Controls
    servingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    quantityButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.ACCENT_PINK,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInputContainer: {
        marginHorizontal: 8, // Reduced from 16 to 8 for closer spacing
        minWidth: 60,
    },
    quantityInput: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    unitSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginLeft: 8,
    },
    servingUnitText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '500',
        marginRight: 4,
    },

    // Calories Section
    caloriesContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    caloriesValue: {
        fontSize: 48,
        fontWeight: '800',
        color: COLORS.WHITE,
        lineHeight: 56,
    },
    caloriesLabel: {
        fontSize: 16,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
        marginTop: 4,
    },

    // Divider
    sectionDivider: {
        height: 1,
        backgroundColor: COLORS.GRAY_DARK,
        marginVertical: 20,
    },

    // Macros
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    macroItem: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    macroHeader: {
        alignItems: 'center',
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.WHITE,
        marginBottom: 2,
    },
    macroLabel: {
        fontSize: 12,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },
    macroBar: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    macroProgress: {
        height: '100%',
        borderRadius: 3,
    },

    // Additional Nutrients
    additionalNutrients: {
        marginTop: 20,
    },
    sectionSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 12,
    },
    nutrientGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    nutrientItem: {
        width: '30%',
        alignItems: 'center',
        marginBottom: 8,
    },
    nutrientValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.WHITE,
        marginBottom: 2,
    },
    nutrientLabel: {
        fontSize: 12,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },

    // Meal Selection
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 16,
    },
    mealTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    mealTypeButton: {
        width: '48%',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activeMealType: {
        backgroundColor: COLORS.ACCENT_PINK,
        borderColor: COLORS.ACCENT_PINK,
    },
    mealTypeText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    activeMealTypeText: {
        color: COLORS.WHITE,
    },

    // Notes
    notesInput: {
        color: COLORS.WHITE,
        fontSize: 16,
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // Bottom Action
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    bottomGradient: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 32,
    },
    addButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    addButtonText: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 8,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    unitModalContent: {
        maxHeight: height * 0.6,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    modalGradient: {
        padding: 20,
        minHeight: 200,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    unitsList: {
        maxHeight: height * 0.4,
    },
    unitOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginVertical: 2,
        borderRadius: 12,
        backgroundColor: COLORS.GRAY_DARK,
    },
    selectedUnitOption: {
        backgroundColor: COLORS.ACCENT_BLUE + '20',
        borderWidth: 1,
        borderColor: COLORS.ACCENT_BLUE,
    },
    unitOptionText: {
        fontSize: 16,
        color: COLORS.WHITE,
        fontWeight: '500',
    },
    selectedUnitOptionText: {
        color: COLORS.ACCENT_BLUE,
        fontWeight: '600',
    },

    // Daily Goals Progress
    dailyGoalsCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    calorieProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    circularProgress: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: COLORS.GRAY_DARK,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circularProgressInner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    calorieProgressValue: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.WHITE,
    },
    calorieProgressLabel: {
        fontSize: 16,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },
    calorieProgressInfo: {
        marginLeft: 20,
    },
    calorieGoalText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 4,
    },
    calorieGoalSubtext: {
        fontSize: 14,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },
    macroProgressSection: {
        marginBottom: 20,
    },
    macroProgressItem: {
        marginBottom: 12,
    },
    macroProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    macroProgressLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    macroProgressValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.WHITE,
    },
    macroProgressBarContainer: {
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: COLORS.GRAY_DARK,
    },
    macroProgressBar: {
        height: '100%',
        borderRadius: 6,
    },
    macroProgressSubtext: {
        fontSize: 14,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },
});

export default ScannedProduct; 