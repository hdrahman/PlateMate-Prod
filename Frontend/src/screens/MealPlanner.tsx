import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, TextInput, Modal, Platform, Alert,
    ActivityIndicator, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import RecipeCategory from '../components/RecipeCategory';
import RecipeCard from '../components/RecipeCard';
import { Recipe, foodCategories, getRandomRecipes, generateMealPlan } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

// Define types for the component props
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

// Define diet options
const dietOptions = [
    { label: 'No Restrictions', value: undefined },
    { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Vegan', value: 'vegan' },
    { label: 'Gluten Free', value: 'gluten-free' },
    { label: 'Ketogenic', value: 'ketogenic' },
    { label: 'Paleo', value: 'paleo' },
    { label: 'Pescetarian', value: 'pescetarian' },
    { label: 'Whole30', value: 'whole30' },
];

// Define meal type options
const mealTypeOptions = [
    { label: 'All', value: undefined },
    { label: 'Breakfast', value: 'breakfast' },
    { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' },
    { label: 'Snack', value: 'snack' },
    { label: 'Dessert', value: 'dessert' },
];

// Define cuisine options
const cuisineOptions = [
    { label: 'All', value: undefined },
    { label: 'Italian', value: 'italian' },
    { label: 'Mexican', value: 'mexican' },
    { label: 'Asian', value: 'asian' },
    { label: 'Mediterranean', value: 'mediterranean' },
    { label: 'American', value: 'american' },
    { label: 'Indian', value: 'indian' },
    { label: 'French', value: 'french' },
    { label: 'Thai', value: 'thai' },
    { label: 'Greek', value: 'greek' },
];

export default function MealPlanner() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { favorites } = useFavorites();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [featuredRecipes, setFeaturedRecipes] = useState<Recipe[]>([]);
    const [showFavorites, setShowFavorites] = useState<boolean>(true);

    // Meal plan preferences
    const [showPreferences, setShowPreferences] = useState<boolean>(false);
    const [targetCalories, setTargetCalories] = useState<string>('2000');
    const [selectedDiet, setSelectedDiet] = useState<string | undefined>(undefined);
    const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
    const [selectedCuisine, setSelectedCuisine] = useState<string | undefined>(undefined);
    const [excludeIngredients, setExcludeIngredients] = useState<string>('');
    const [maxReadyTime, setMaxReadyTime] = useState<string>('');
    const [highProtein, setHighProtein] = useState<boolean>(false);
    const [lowCarb, setLowCarb] = useState<boolean>(false);

    // Daily nutrition stats
    const [dailyNutrition, setDailyNutrition] = useState({
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        remainingCalories: 2000,
        mealsLeft: 3
    });

    // Load random recipes on component mount
    useEffect(() => {
        loadRandomRecipes();
    }, []);

    // Function to load random recipes
    const loadRandomRecipes = async () => {
        try {
            setIsLoading(true);
            const recipes = await getRandomRecipes(5);
            setFeaturedRecipes(recipes);
        } catch (error) {
            console.error('Error loading random recipes:', error);
            Alert.alert('Error', 'Failed to load recipes. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle search submission
    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigation.navigate('RecipeResults', { query: searchQuery });
        }
    };

    // Handle recipe press
    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipeId: recipe.id });
    };

    // Generate a personalized meal plan
    const handleGenerateMealPlan = async () => {
        try {
            setIsLoading(true);

            // Prepare exclude ingredients list if any
            const excludeList = excludeIngredients
                .split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);

            // Build parameters for meal plan generation
            const mealPlanParams: any = {
                timeFrame: 'day' as 'day' | 'week',
                targetCalories: parseInt(targetCalories) || 2000,
                diet: selectedDiet,
                exclude: excludeList.length > 0 ? excludeList : undefined
            };

            // Add additional filters
            if (selectedMealType) {
                mealPlanParams.type = selectedMealType;
            }

            if (selectedCuisine) {
                mealPlanParams.cuisine = selectedCuisine;
            }

            if (maxReadyTime && parseInt(maxReadyTime) > 0) {
                mealPlanParams.maxReadyTime = parseInt(maxReadyTime);
            }

            if (highProtein) {
                mealPlanParams.minProtein = 25; // Set minimum protein in grams
            }

            if (lowCarb) {
                mealPlanParams.maxCarbs = 50; // Set maximum carbs in grams
            }

            // Call API to generate meal plan
            const mealPlanData = await generateMealPlan(mealPlanParams);

            // Update daily nutrition with the meal plan data
            if (mealPlanData.nutrients) {
                setDailyNutrition({
                    calories: Math.round(mealPlanData.nutrients.calories),
                    protein: Math.round(mealPlanData.nutrients.protein),
                    fat: Math.round(mealPlanData.nutrients.fat),
                    carbs: Math.round(mealPlanData.nutrients.carbohydrates),
                    remainingCalories: Math.round(parseInt(targetCalories) - mealPlanData.nutrients.calories),
                    mealsLeft: 3 - mealPlanData.meals.length
                });
            }

            // Close preferences modal
            setShowPreferences(false);

            // Navigate to meal plan results
            navigation.navigate('MealPlannerResults', {
                mealPlan: mealPlanData.meals,
                nutrients: mealPlanData.nutrients
            });
        } catch (error) {
            console.error('Error generating meal plan:', error);
            Alert.alert('Error', 'Failed to generate meal plan. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle scanning pantry (placeholder for future feature)
    const handleScanPantry = () => {
        Alert.alert('Coming Soon', 'Pantry scanning feature is coming soon!');
    };

    // GradientBorderCard component for consistent card styling
    const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
        return (
            <View style={styles.gradientBorderContainer}>
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
                        backgroundColor: CARD_BG,
                        padding: 16,
                        ...(style || {})
                    }}
                >
                    {children}
                </View>
            </View>
        );
    };

    // Preferences Modal component
    const PreferencesModal = () => (
        <Modal
            visible={showPreferences}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowPreferences(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Meal Plan Preferences</Text>
                        <TouchableOpacity
                            onPress={() => setShowPreferences(false)}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={24} color={WHITE} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScrollView}>
                        {/* Calories Input */}
                        <Text style={styles.preferenceLabel}>Target Calories</Text>
                        <TextInput
                            style={styles.preferenceInput}
                            value={targetCalories}
                            onChangeText={setTargetCalories}
                            keyboardType="numeric"
                            placeholder="Enter target calories"
                            placeholderTextColor={SUBDUED}
                        />

                        {/* Diet Selection */}
                        <Text style={styles.preferenceLabel}>Diet</Text>
                        {dietOptions.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.dietOption}
                                onPress={() => setSelectedDiet(option.value)}
                            >
                                <Text style={styles.dietOptionText}>{option.label}</Text>
                                <View style={styles.radioOuterCircle}>
                                    {selectedDiet === option.value && (
                                        <View style={styles.radioInnerCircle} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}

                        {/* Meal Type Selection */}
                        <Text style={styles.preferenceLabel}>Meal Type</Text>
                        {mealTypeOptions.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.dietOption}
                                onPress={() => setSelectedMealType(option.value)}
                            >
                                <Text style={styles.dietOptionText}>{option.label}</Text>
                                <View style={styles.radioOuterCircle}>
                                    {selectedMealType === option.value && (
                                        <View style={styles.radioInnerCircle} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}

                        {/* Cuisine Selection */}
                        <Text style={styles.preferenceLabel}>Cuisine</Text>
                        {cuisineOptions.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.dietOption}
                                onPress={() => setSelectedCuisine(option.value)}
                            >
                                <Text style={styles.dietOptionText}>{option.label}</Text>
                                <View style={styles.radioOuterCircle}>
                                    {selectedCuisine === option.value && (
                                        <View style={styles.radioInnerCircle} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}

                        {/* Max Ready Time */}
                        <Text style={styles.preferenceLabel}>Max Ready Time (minutes)</Text>
                        <TextInput
                            style={styles.preferenceInput}
                            value={maxReadyTime}
                            onChangeText={setMaxReadyTime}
                            keyboardType="numeric"
                            placeholder="Enter maximum preparation time"
                            placeholderTextColor={SUBDUED}
                        />

                        {/* Nutrition Preferences */}
                        <Text style={styles.preferenceLabel}>Nutrition Preferences</Text>
                        <View style={styles.switchOption}>
                            <Text style={styles.switchOptionText}>High Protein</Text>
                            <Switch
                                value={highProtein}
                                onValueChange={setHighProtein}
                                trackColor={{ false: '#3e3e3e', true: 'rgba(170, 0, 255, 0.4)' }}
                                thumbColor={highProtein ? PURPLE_ACCENT : '#f4f3f4'}
                            />
                        </View>
                        <View style={styles.switchOption}>
                            <Text style={styles.switchOptionText}>Low Carb</Text>
                            <Switch
                                value={lowCarb}
                                onValueChange={setLowCarb}
                                trackColor={{ false: '#3e3e3e', true: 'rgba(170, 0, 255, 0.4)' }}
                                thumbColor={lowCarb ? PURPLE_ACCENT : '#f4f3f4'}
                            />
                        </View>

                        {/* Exclude Ingredients */}
                        <Text style={styles.preferenceLabel}>Exclude Ingredients</Text>
                        <TextInput
                            style={styles.preferenceInput}
                            value={excludeIngredients}
                            onChangeText={setExcludeIngredients}
                            placeholder="Enter ingredients to exclude (comma separated)"
                            placeholderTextColor={SUBDUED}
                            multiline
                        />

                        {/* Generate Button */}
                        <TouchableOpacity
                            style={styles.generateButton}
                            onPress={handleGenerateMealPlan}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color={WHITE} />
                            ) : (
                                <Text style={styles.generateButtonText}>Generate Meal Plan</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Meal Planner</Text>
                <Text style={styles.headerSub}>
                    Get personalized meal plans and recipe ideas
                </Text>
            </View>

            {/* Preferences Modal */}
            <PreferencesModal />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollInner}
            >
                {/* Search Box */}
                <GradientBorderCard>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={22} color={SUBDUED} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search recipes, ingredients..."
                            placeholderTextColor={SUBDUED}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                    </View>
                </GradientBorderCard>

                {/* Scan Pantry Card */}
                <GradientBorderCard>
                    <TouchableOpacity
                        style={styles.actionCardContent}
                        onPress={handleScanPantry}
                    >
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="camera-outline" size={24} color={WHITE} />
                        </View>
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Scan Your Pantry</Text>
                            <Text style={styles.actionSubtitle}>
                                Get recipe ideas based on what you have
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={SUBDUED} />
                    </TouchableOpacity>
                </GradientBorderCard>

                {/* Generate Meal Plan Card */}
                <GradientBorderCard>
                    <TouchableOpacity
                        style={styles.actionCardContent}
                        onPress={() => setShowPreferences(true)}
                    >
                        <View style={styles.actionIconContainer}>
                            <Ionicons name="restaurant-outline" size={24} color={WHITE} />
                        </View>
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Generate Meal Plan</Text>
                            <Text style={styles.actionSubtitle}>
                                Personalized meals based on your preferences
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={SUBDUED} />
                    </TouchableOpacity>
                </GradientBorderCard>

                {/* Favorite Recipes Section */}
                {favorites.length > 0 && (
                    <>
                        <View style={styles.sectionHeaderContainer}>
                            <Text style={styles.sectionTitle}>Favorite Recipes</Text>
                            <TouchableOpacity
                                onPress={() => setShowFavorites(!showFavorites)}
                                style={styles.toggleButton}
                            >
                                <Ionicons
                                    name={showFavorites ? "chevron-up" : "chevron-down"}
                                    size={24}
                                    color={WHITE}
                                />
                            </TouchableOpacity>
                        </View>

                        {showFavorites && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalScrollContainer}
                            >
                                {favorites.map((recipe) => (
                                    <View key={recipe.id} style={styles.favoriteCardContainer}>
                                        <RecipeCard
                                            recipe={recipe}
                                            onPress={handleRecipePress}
                                            compact={true}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </>
                )}

                {/* Featured Recipes Section */}
                <Text style={styles.sectionTitle}>Featured Recipes</Text>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                    </View>
                ) : (
                    featuredRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            onPress={handleRecipePress}
                        />
                    ))
                )}

                {/* Display selected meal categories */}
                {foodCategories.slice(0, 5).map(category => (
                    <RecipeCategory
                        key={category.id}
                        title={category.name}
                        categoryId={category.id}
                        icon={category.icon}
                        onRecipePress={handleRecipePress}
                    />
                ))}

                {/* Nutrition Summary Section */}
                <GradientBorderCard>
                    <Text style={styles.sectionTitle}>Today's Nutrition</Text>
                    <View style={styles.dividerLine} />
                    <View style={styles.nutritionInfoContainer}>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionLabel}>Remaining Calories</Text>
                            <Text style={styles.nutritionValue}>{dailyNutrition.remainingCalories}</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionLabel}>Meals Left</Text>
                            <Text style={styles.nutritionValue}>{dailyNutrition.mealsLeft}</Text>
                        </View>
                    </View>
                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{dailyNutrition.carbs}g</Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{dailyNutrition.protein}g</Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{dailyNutrition.fat}g</Text>
                            <Text style={styles.macroLabel}>Fat</Text>
                        </View>
                    </View>
                </GradientBorderCard>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 50 : 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 4,
    },
    headerSub: {
        fontSize: 14,
        color: SUBDUED,
    },
    scrollView: {
        flex: 1,
    },
    scrollInner: {
        padding: 16,
        paddingBottom: 80,
    },
    gradientBorderContainer: {
        borderRadius: 10,
        marginVertical: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 40,
        color: WHITE,
        fontSize: 16,
    },
    actionCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 12,
        color: SUBDUED,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginTop: 24,
        marginBottom: 12,
    },
    dividerLine: {
        height: 1,
        backgroundColor: 'rgba(170, 0, 255, 0.3)',
        marginVertical: 12,
    },
    nutritionInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    nutritionItem: {
        alignItems: 'center',
    },
    nutritionLabel: {
        fontSize: 12,
        color: SUBDUED,
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
    },
    macroLabel: {
        fontSize: 12,
        color: SUBDUED,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: CARD_BG,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: PURPLE_ACCENT,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(170, 0, 255, 0.3)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
    },
    closeButton: {
        padding: 4,
    },
    modalScrollView: {
        padding: 16,
    },
    preferenceLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginTop: 12,
        marginBottom: 8,
    },
    preferenceInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        marginBottom: 16,
    },
    dietOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    dietOptionText: {
        fontSize: 16,
        color: WHITE,
    },
    radioOuterCircle: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: PURPLE_ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInnerCircle: {
        height: 10,
        width: 10,
        borderRadius: 5,
        backgroundColor: PURPLE_ACCENT,
    },
    generateButton: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    generateButtonText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 12,
    },
    toggleButton: {
        padding: 8,
    },
    horizontalScrollContainer: {
        paddingVertical: 8,
        paddingLeft: 0,
        paddingRight: 16,
    },
    favoriteCardContainer: {
        width: 250,
        marginRight: 16,
    },
    switchOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    switchOptionText: {
        fontSize: 16,
        color: WHITE,
    },
});