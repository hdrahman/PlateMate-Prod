import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { addFoodLog, addMultipleFoodLogs } from '../utils/database';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';
import { navigateToFoodLog } from '../navigation/RootNavigation';
import { ThemeContext } from '../ThemeContext';



// Navigation types
type RootStackParamList = {
    FoodLog: { refresh?: number };
    NutritionFactsResult: {
        nutritionData: any[];
        mealId: string;
        mealType: string;
        brandName?: string;
        quantity?: string;
        notes?: string;
        foodName?: string;
        localImagePaths?: string[];
    };
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'NutritionFactsResult'>;

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

export default function NutritionFactsResult() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const {
        nutritionData,
        mealId,
        mealType: initialMealType,
        brandName = '',
        quantity = '',
        notes = '',
        foodName = '',
        localImagePaths = []
    } = route.params as any;

    const [selectedMeal, setSelectedMeal] = useState(initialMealType);
    const [userNotes, setUserNotes] = useState(notes);
    const [loading, setLoading] = useState(false);
    const { theme, isDarkTheme } = useContext(ThemeContext);

    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    // Use the first item for display (for single items) or combined data for multiple
    const displayFood = nutritionData[0] || {};
    const isMultipleItems = nutritionData.length > 1;

    // Calculate total nutrition if multiple items
    const totalNutrition = isMultipleItems ? {
        calories: nutritionData.reduce((sum, item) => sum + (item.calories || 0), 0),
        proteins: nutritionData.reduce((sum, item) => sum + (item.proteins || 0), 0),
        carbs: nutritionData.reduce((sum, item) => sum + (item.carbs || 0), 0),
        fats: nutritionData.reduce((sum, item) => sum + (item.fats || 0), 0),
        fiber: nutritionData.reduce((sum, item) => sum + (item.fiber || 0), 0),
        sugar: nutritionData.reduce((sum, item) => sum + (item.sugar || 0), 0),
        saturated_fat: nutritionData.reduce((sum, item) => sum + (item.saturated_fat || 0), 0),
        sodium: nutritionData.reduce((sum, item) => sum + (item.sodium || 0), 0),
        cholesterol: nutritionData.reduce((sum, item) => sum + (item.cholesterol || 0), 0),
        potassium: nutritionData.reduce((sum, item) => sum + (item.potassium || 0), 0),
        vitamin_a: nutritionData.reduce((sum, item) => sum + (item.vitamin_a || 0), 0),
        vitamin_c: nutritionData.reduce((sum, item) => sum + (item.vitamin_c || 0), 0),
        calcium: nutritionData.reduce((sum, item) => sum + (item.calcium || 0), 0),
        iron: nutritionData.reduce((sum, item) => sum + (item.iron || 0), 0),
    } : displayFood;

    // Handle adding food to log
    const handleAddFood = async () => {
        try {
            setLoading(true);

            // Format current date as ISO string (YYYY-MM-DD)
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            if (isMultipleItems) {
                // Handle multiple food items
                const foodLogsToInsert = [];

                for (let index = 0; index < nutritionData.length; index++) {
                    const item = nutritionData[index];
                    const primaryImagePath = localImagePaths && localImagePaths.length > 0
                        ? localImagePaths[0]
                        : '';

                    const foodLog = {
                        meal_id: mealId,
                        food_name: foodName || item.food_name || 'Unknown Food',
                        calories: item.calories || 0,
                        proteins: item.proteins || 0,
                        carbs: item.carbs || 0,
                        fats: item.fats || 0,
                        fiber: item.fiber || 0,
                        sugar: item.sugar || 0,
                        saturated_fat: item.saturated_fat || 0,
                        polyunsaturated_fat: item.polyunsaturated_fat || 0,
                        monounsaturated_fat: item.monounsaturated_fat || 0,
                        trans_fat: item.trans_fat || 0,
                        cholesterol: item.cholesterol || 0,
                        sodium: item.sodium || 0,
                        potassium: item.potassium || 0,
                        vitamin_a: item.vitamin_a || 0,
                        vitamin_c: item.vitamin_c || 0,
                        calcium: item.calcium || 0,
                        iron: item.iron || 0,
                        image_url: primaryImagePath,
                        file_key: 'default_key',
                        healthiness_rating: item.healthiness_rating || 5,
                        date: formattedDate,
                        meal_type: selectedMeal,
                        brand_name: brandName,
                        quantity: quantity,
                        notes: userNotes
                    };

                    foodLogsToInsert.push(foodLog);
                }

                // Navigate before database operation to prevent UI blocking
                console.log('🚀 About to navigate to FoodLog...');
                navigateToFoodLog();

                // Continue with database operation after navigation has started
                console.log(`Saving ${foodLogsToInsert.length} food logs to local database in batch`);
                await addMultipleFoodLogs(foodLogsToInsert);
                console.log(`Saved ${nutritionData.length} food items to database`);
            } else {
                // Handle single food item
                const primaryImagePath = localImagePaths && localImagePaths.length > 0
                    ? localImagePaths[0]
                    : '';

                const foodLog = {
                    meal_id: mealId,
                    food_name: foodName || displayFood.food_name || 'Unknown Food',
                    calories: displayFood.calories || 0,
                    proteins: displayFood.proteins || 0,
                    carbs: displayFood.carbs || 0,
                    fats: displayFood.fats || 0,
                    fiber: displayFood.fiber || 0,
                    sugar: displayFood.sugar || 0,
                    saturated_fat: displayFood.saturated_fat || 0,
                    polyunsaturated_fat: displayFood.polyunsaturated_fat || 0,
                    monounsaturated_fat: displayFood.monounsaturated_fat || 0,
                    trans_fat: displayFood.trans_fat || 0,
                    cholesterol: displayFood.cholesterol || 0,
                    sodium: displayFood.sodium || 0,
                    potassium: displayFood.potassium || 0,
                    vitamin_a: displayFood.vitamin_a || 0,
                    vitamin_c: displayFood.vitamin_c || 0,
                    calcium: displayFood.calcium || 0,
                    iron: displayFood.iron || 0,
                    image_url: primaryImagePath,
                    file_key: 'default_key',
                    healthiness_rating: displayFood.healthiness_rating || 5,
                    date: formattedDate,
                    meal_type: selectedMeal,
                    brand_name: brandName,
                    quantity: quantity,
                    notes: userNotes
                };

                // Navigate before database operation to prevent UI blocking
                console.log('🚀 About to navigate to FoodLog...');
                navigateToFoodLog();

                // Continue with database operation after navigation has started
                console.log('Saving food log to local database:', foodLog);
                await addFoodLog(foodLog);
            }
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Check if a value is present (using our helper function)
    const hasValue = (value: number) => hasNutritionalValue(value);

    // Calculate macro percentages
    const proteinCals = totalNutrition.proteins * 4;
    const carbCals = totalNutrition.carbs * 4;
    const fatCals = totalNutrition.fats * 9;
    const totalMacroCalories = proteinCals + carbCals + fatCals;
    const proteinPercent = totalMacroCalories > 0 ? Math.round((proteinCals / totalMacroCalories) * 100) : 0;
    const carbPercent = totalMacroCalories > 0 ? Math.round((carbCals / totalMacroCalories) * 100) : 0;
    const fatPercent = totalMacroCalories > 0 ? Math.round((fatCals / totalMacroCalories) * 100) : 0;

    return (
        <LinearGradient
            colors={[theme.colors.background, theme.colors.cardBackground]}
            style={styles.container}
        >
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.border }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Nutrition Facts</Text>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                        onPress={handleAddFood}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={theme.colors.text} />
                        ) : (
                            <Ionicons name="add" size={24} color={theme.colors.text} />
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Food Info & Controls Card */}
                    <GradientBorderCard style={styles.cardMargin} cardBackground={theme.colors.cardBackground}>
                        <View style={styles.combinedSection}>
                            {/* Food Info */}
                            <View style={styles.foodInfoSection}>
                                <Text style={[styles.foodName, { color: theme.colors.text }]}>
                                    {isMultipleItems
                                        ? `${nutritionData.length} Food Items Detected`
                                        : (foodName || displayFood.food_name || 'Unknown Food')
                                    }
                                </Text>
                                {brandName && (
                                    <Text style={[styles.brandName, { color: theme.colors.textSecondary }]}>{brandName}</Text>
                                )}
                                {isMultipleItems && (
                                    <View style={styles.itemsList}>
                                        {nutritionData.map((item, index) => (
                                            <Text key={index} style={[styles.itemName, { color: theme.colors.textSecondary }]}>
                                                • {item.food_name || `Food Item ${index + 1}`}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Divider */}
                            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                            {/* Controls */}
                            <View style={styles.controlsSection}>
                                {/* Meal Selection */}
                                <View style={styles.controlRow}>
                                    <Text style={[styles.controlLabel, { color: theme.colors.text }]}>Meal</Text>
                                    <View style={styles.mealContainer}>
                                        {meals.map((meal) => (
                                            <TouchableOpacity
                                                key={meal}
                                                style={[
                                                    styles.mealOption,
                                                    { backgroundColor: theme.colors.border, borderColor: theme.colors.border },
                                                    selectedMeal === meal && { backgroundColor: 'transparent', borderColor: theme.colors.primary }
                                                ]}
                                                onPress={() => setSelectedMeal(meal)}
                                            >
                                                <Text style={[
                                                    styles.mealOptionText,
                                                    { color: theme.colors.textSecondary },
                                                    selectedMeal === meal && { color: theme.colors.primary }
                                                ]}>
                                                    {meal}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </GradientBorderCard>

                    {/* Calories & Macros Card */}
                    <GradientBorderCard style={styles.cardMargin} cardBackground={theme.colors.cardBackground}>
                        <View style={styles.nutritionSection}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                {isMultipleItems ? 'Total Calories & Macronutrients' : 'Calories & Macronutrients'}
                            </Text>

                            {/* Calories */}
                            <View style={styles.caloriesContainer}>
                                <Text style={[styles.caloriesValue, { color: theme.colors.text }]}>{totalNutrition.calories || 0}</Text>
                                <Text style={[styles.caloriesLabel, { color: theme.colors.textSecondary }]}>calories</Text>
                            </View>

                            {/* Macro Breakdown */}
                            <View style={styles.macrosGrid}>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: theme.colors.success }]} />
                                    <Text style={[styles.macroValue, { color: theme.colors.text }]}>{totalNutrition.proteins || 0}g</Text>
                                    <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Protein</Text>
                                    <Text style={[styles.macroPercent, { color: theme.colors.textSecondary }]}>{proteinPercent}%</Text>
                                    <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(proteinCals)} cal</Text>
                                </View>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: '#0084ff' }]} />
                                    <Text style={[styles.macroValue, { color: theme.colors.text }]}>{totalNutrition.carbs || 0}g</Text>
                                    <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Carbs</Text>
                                    <Text style={[styles.macroPercent, { color: theme.colors.textSecondary }]}>{carbPercent}%</Text>
                                    <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(carbCals)} cal</Text>
                                </View>
                                <View style={styles.macroCard}>
                                    <View style={[styles.macroDot, { backgroundColor: theme.colors.warning }]} />
                                    <Text style={[styles.macroValue, { color: theme.colors.text }]}>{totalNutrition.fats || 0}g</Text>
                                    <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Fat</Text>
                                    <Text style={[styles.macroPercent, { color: theme.colors.textSecondary }]}>{fatPercent}%</Text>
                                    <Text style={[styles.macroCalories, { color: theme.colors.textSecondary }]}>{Math.round(fatCals)} cal</Text>
                                </View>
                            </View>

                            {/* Additional Nutrients */}
                            {(hasValue(totalNutrition.fiber) || hasValue(totalNutrition.sugar) ||
                                hasValue(totalNutrition.saturated_fat) || hasValue(totalNutrition.sodium) ||
                                hasValue(totalNutrition.cholesterol) || hasValue(totalNutrition.potassium)) && (
                                    <View style={styles.nutritionCategory}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Additional Nutrients</Text>
                                        <View style={styles.categoryContent}>
                                            {hasValue(totalNutrition.fiber) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Dietary Fiber</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.fiber}g</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.sugar) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Total Sugars</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.sugar}g</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.saturated_fat) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Saturated Fat</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.saturated_fat}g</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.cholesterol) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Cholesterol</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.cholesterol}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.sodium) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Sodium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.sodium}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.potassium) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Potassium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.potassium}mg</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                            {/* Vitamins & Minerals */}
                            {(hasValue(totalNutrition.vitamin_a) || hasValue(totalNutrition.vitamin_c) ||
                                hasValue(totalNutrition.calcium) || hasValue(totalNutrition.iron)) && (
                                    <View style={styles.nutritionCategory}>
                                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>Vitamins & Minerals</Text>
                                        <View style={styles.categoryContent}>
                                            {hasValue(totalNutrition.vitamin_a) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Vitamin A</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.vitamin_a}mcg</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.vitamin_c) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Vitamin C</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.vitamin_c}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.calcium) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Calcium</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.calcium}mg</Text>
                                                </View>
                                            )}
                                            {hasValue(totalNutrition.iron) && (
                                                <View style={[styles.nutrientRow, { borderBottomColor: theme.colors.border }]}>
                                                    <Text style={[styles.nutrientName, { color: theme.colors.text }]}>Iron</Text>
                                                    <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>{totalNutrition.iron}mg</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                        </View>
                    </GradientBorderCard>

                    {/* Add Button at Bottom */}
                    <TouchableOpacity
                        style={styles.addButtonLarge}
                        onPress={handleAddFood}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.addButtonGradient}
                        >
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.addButtonText}>Adding...</Text>
                                </View>
                            ) : (
                                <>
                                    <Ionicons name="add" size={20} color="#FFFFFF" />
                                    <Text style={styles.addButtonText}>Add to {selectedMeal}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
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
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    cardMargin: {
        marginBottom: 16,
    },
    gradientBorderContainer: {
        padding: 2,
        borderRadius: 16,
    },
    gradientBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
    },
    gradientBorderInner: {
        borderRadius: 14,
        padding: 20,
    },
    combinedSection: {
        // Combined food info and controls
    },
    foodInfoSection: {
        alignItems: 'center',
        marginBottom: 16,
    },
    foodName: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    brandName: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 8,
    },
    itemsList: {
        marginTop: 8,
        alignSelf: 'stretch',
    },
    itemName: {
        fontSize: 14,
        marginBottom: 4,
    },
    divider: {
        height: 1,
        marginVertical: 16,
    },
    controlsSection: {
        // Controls styling
    },
    controlRow: {
        marginBottom: 20,
    },
    controlLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    mealContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mealOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    selectedMealOption: {
        backgroundColor: 'transparent',
    },
    mealOptionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    selectedMealOptionText: {
    },
    addButtonLarge: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 20,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 8,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nutritionSection: {
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    caloriesContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    caloriesValue: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    caloriesLabel: {
        fontSize: 16,
        marginTop: 4,
    },
    macrosGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    macroCard: {
        alignItems: 'center',
        flex: 1,
    },
    macroDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    macroLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    macroPercent: {
        fontSize: 12,
        marginTop: 2,
    },
    macroCalories: {
        fontSize: 10,
        marginTop: 2,
    },
    nutritionCategory: {
        marginBottom: 20,
        marginTop: 24,
        width: '100%',
        alignSelf: 'stretch',
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    categoryContent: {
        // Category content styling
    },
    nutrientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    nutrientName: {
        fontSize: 14,
        flex: 1,
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '600',
    },
});
