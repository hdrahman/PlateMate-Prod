import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, TextInput, Platform, Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import RecipeCategory from '../components/RecipeCategory';
import RecipeCard from '../components/RecipeCard';
import { Recipe, foodCategories, getRandomRecipes } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';
import { RecipeCacheService } from '../services/RecipeCacheService';

// Custom imports for user data
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { getTodayExerciseCalories, getUserProfileByFirebaseUid } from '../utils/database';
import { NutritionGoals, calculateNutritionGoals, getDefaultNutritionGoals } from '../utils/nutritionCalculator';
import { UserProfile } from '../types/user';
import { useFoodLog } from '../context/FoodLogContext';

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



export default function MealPlanner() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { favorites } = useFavorites();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);
    const [isDailyNutrientsLoading, setIsDailyNutrientsLoading] = useState<boolean>(true);
    const [featuredRecipes, setFeaturedRecipes] = useState<Recipe[]>([]);
    const [showFavorites, setShowFavorites] = useState<boolean>(true);

    // User context
    const { user } = useAuth();
    const { profile: onboardingProfile, isLoading: isOnboardingLoading } = useOnboarding();
    const { nutrientTotals, refreshLogs, isLoading: foodLogLoading,
        startWatchingFoodLogs, stopWatchingFoodLogs, lastUpdated, hasError, forceSingleRefresh } = useFoodLog();



    // Daily nutrition stats
    const [dailyNutrition, setDailyNutrition] = useState({
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        remainingCalories: 2000,
        mealsLeft: 3
    });
    const [userGoals, setUserGoals] = useState<NutritionGoals>(getDefaultNutritionGoals());

    // Load popular healthy recipes on component mount
    useEffect(() => {
        loadFeaturedRecipes();
    }, []);

    // Start watching for food log changes
    useEffect(() => {
        console.log('MealPlanner screen starting to watch food logs');
        startWatchingFoodLogs();

        // Clean up when component unmounts
        return () => {
            console.log('MealPlanner screen stopping food log watch');
            stopWatchingFoodLogs();
        };
    }, [startWatchingFoodLogs, stopWatchingFoodLogs]);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                setIsProfileLoading(true);
                let currentProfile: any = null;

                // First, try to get profile from onboarding context if available
                if (onboardingProfile && !isOnboardingLoading) {
                    currentProfile = onboardingProfile;
                }

                // Fallback to database if needed
                if (!currentProfile && user) {
                    const dbProfile = await getUserProfileByFirebaseUid(user.uid);
                    if (dbProfile) {
                        currentProfile = {
                            firstName: dbProfile.first_name,
                            lastName: dbProfile.last_name,
                            phoneNumber: '',
                            height: dbProfile.height,
                            weight: dbProfile.weight,
                            age: dbProfile.age,
                            gender: dbProfile.gender,
                            activityLevel: dbProfile.activity_level,
                            dietaryRestrictions: dbProfile.dietary_restrictions || [],
                            foodAllergies: dbProfile.food_allergies || [],
                            cuisinePreferences: dbProfile.cuisine_preferences || [],
                            spiceTolerance: dbProfile.spice_tolerance,
                            weightGoal: 'maintain',
                            healthConditions: dbProfile.health_conditions || [],
                            dailyCalorieTarget: dbProfile.daily_calorie_target,
                            nutrientFocus: dbProfile.nutrient_focus
                        };
                    }
                }

                // Calculate nutrition goals
                let calculatedGoals = getDefaultNutritionGoals();

                if (currentProfile) {
                    calculatedGoals = calculateNutritionGoals(currentProfile);
                    setUserGoals(calculatedGoals);
                } else {
                    // If profile still not found, use defaults
                    setUserGoals(getDefaultNutritionGoals());
                }
                setIsProfileLoading(false);

                setIsDailyNutrientsLoading(true);
                try {
                    // Use the nutrient totals from context instead of refreshing logs
                    // This prevents unnecessary database calls

                    // Get today's exercise calories
                    const todayExerciseCals = await getTodayExerciseCalories();

                    const goalCalories = calculatedGoals.calories;
                    const remaining = goalCalories - nutrientTotals.calories + todayExerciseCals;

                    setDailyNutrition(prev => ({
                        ...prev,
                        calories: nutrientTotals.calories,
                        protein: nutrientTotals.protein,
                        fat: nutrientTotals.fat,
                        carbs: nutrientTotals.carbs,
                        remainingCalories: Math.round(remaining)
                    }));

                } catch (error) {
                    console.error("Error fetching daily nutrition data:", error);
                    // Fallback to goal calories if fetch fails, assuming 0 consumption
                    setDailyNutrition(prev => ({
                        ...prev,
                        calories: 0, protein: 0, fat: 0, carbs: 0,
                        remainingCalories: calculatedGoals.calories
                    }));
                } finally {
                    setIsDailyNutrientsLoading(false);
                }
            } catch (error) {
                console.error("Error loading user data:", error);
                setIsProfileLoading(false);
                setIsDailyNutrientsLoading(false);
            }
        };

        loadUserData();
    }, [user, onboardingProfile, isOnboardingLoading, nutrientTotals, lastUpdated]);

    // Function to load featured healthy and popular recipes with caching
    const loadFeaturedRecipes = async () => {
        try {
            setIsLoading(true);

            // Try to get cached recipes first
            const cachedRecipes = await RecipeCacheService.getCachedFeaturedRecipes();

            if (cachedRecipes && cachedRecipes.length > 0) {
                console.log('🎯 Using cached featured recipes to save API costs');
                setFeaturedRecipes(cachedRecipes);
                setIsLoading(false);
                return;
            }

            // If no cache, fetch from API and cache the results
            console.log('🌐 Fetching fresh featured recipes from API');
            const recipes = await getRandomRecipes(5);

            if (recipes && recipes.length > 0) {
                setFeaturedRecipes(recipes);

                // Cache the recipes for the rest of the day
                await RecipeCacheService.cacheFeaturedRecipes(recipes);
                console.log('💾 Featured recipes cached for today');
            }
        } catch (error) {
            console.error('Error loading healthy popular recipes:', error);
            Alert.alert('Error', 'Failed to load recipes. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle search submission
    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigation.navigate('RecipeResults', { query: searchQuery.trim() });
            setSearchQuery(''); // Clear the search field after submitting
        }
    };

    // Handle recipe press
    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipeId: recipe.id });
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



    // Error banner component
    const renderErrorBanner = () => {
        if (!hasError) return null;

        return (
            <TouchableOpacity
                style={styles.errorBanner}
                onPress={forceSingleRefresh}
            >
                <Ionicons name="warning-outline" size={20} color="#FFD700" />
                <Text style={styles.errorText}>
                    Database connection issue. Tap to retry.
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {renderErrorBanner()}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Meal Planner</Text>
                <Text style={styles.headerSub}>
                    Get personalized meal plans and recipe ideas
                </Text>
            </View>



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
                <Text style={styles.sectionTitle}>Popular Healthy Recipes</Text>
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
                            <Text style={styles.nutritionValue}>{isDailyNutrientsLoading ? '...' : dailyNutrition.remainingCalories}</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionLabel}>Meals Left</Text>
                            <Text style={styles.nutritionValue}>{dailyNutrition.mealsLeft}</Text>
                        </View>
                    </View>
                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{isDailyNutrientsLoading ? '...' : dailyNutrition.carbs}g</Text>
                            <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{isDailyNutrientsLoading ? '...' : dailyNutrition.protein}g</Text>
                            <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{isDailyNutrientsLoading ? '...' : dailyNutrition.fat}g</Text>
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
        paddingBottom: 0,
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
        paddingTop: 8,
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
    errorBanner: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#FF6347',
    },
    errorText: {
        color: '#FFD700',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: 'bold',
    },

});