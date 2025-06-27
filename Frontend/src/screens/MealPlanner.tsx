import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, TextInput, Platform, Alert,
    ActivityIndicator, FlatList, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import RecipeCategory from '../components/RecipeCategory';
import RecipeCard from '../components/RecipeCard';
import { getRandomRecipes, getRecipesByMealType, Recipe } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';
import apiService from '../utils/apiService';
import { ServiceTokenType } from '../utils/tokenManager';

// Define food categories locally since they were removed from the API
const foodCategories = [
    { id: 'breakfast', name: 'Breakfast', icon: 'sunny-outline' },
    { id: 'lunch', name: 'Lunch', icon: 'fast-food-outline' },
    { id: 'dinner', name: 'Dinner', icon: 'restaurant-outline' },
    { id: 'snack', name: 'Snacks', icon: 'cafe-outline' },
];

// Define autocomplete functions locally since they were removed from the API
const autocompleteRecipes = async (query: string): Promise<{ id: number; title: string }[]> => {
    try {
        console.log(`Fetching autocomplete suggestions for: "${query}"`);
        const response = await apiService.get('/recipes/autocomplete', { query }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH
        });
        console.log(`Autocomplete response for "${query}":`, response);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Error getting recipe autocomplete:', error);
        return [];
    }
};

const autocompleteIngredients = async (query: string): Promise<{ id: number; name: string }[]> => {
    try {
        const response = await apiService.get('/recipes/ingredients/autocomplete', { query }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH
        });
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Error getting ingredient autocomplete:', error);
        return [];
    }
};

// Custom imports for user data
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { getTodayExerciseCalories, getUserProfileBySupabaseUid } from '../utils/database';
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

interface AutocompleteSuggestion {
    id: number;
    title?: string;
    name?: string;
    type: 'recipe' | 'ingredient';
    uniqueKey?: string;
}

// GradientBorderCard component moved outside to prevent re-creation
const GradientBorderCard: React.FC<GradientBorderCardProps> = React.memo(({ children, style }) => {
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
});

// Search Input Component moved outside and properly memoized
const SearchInputComponent = React.memo(({
    searchQuery,
    onChangeText,
    onSubmitEditing,
    onFocus,
    onBlur,
    isLoadingSuggestions
}: {
    searchQuery: string;
    onChangeText: (text: string) => void;
    onSubmitEditing: () => void;
    onFocus: () => void;
    onBlur: () => void;
    isLoadingSuggestions: boolean;
}) => {
    return (
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={22} color={SUBDUED} style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                placeholder="Search recipes, ingredients..."
                placeholderTextColor={SUBDUED}
                value={searchQuery}
                onChangeText={onChangeText}
                onSubmitEditing={onSubmitEditing}
                onFocus={onFocus}
                onBlur={onBlur}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
            />
            {isLoadingSuggestions && (
                <ActivityIndicator
                    size="small"
                    color={PURPLE_ACCENT}
                    style={styles.searchLoadingIcon}
                />
            )}
        </View>
    );
});

// Memoized suggestion item moved outside to prevent re-renders
const SuggestionItem = React.memo(({
    item,
    onPress
}: {
    item: AutocompleteSuggestion;
    onPress: (item: AutocompleteSuggestion) => void;
}) => (
    <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => onPress(item)}
    >
        <View style={[
            styles.suggestionIconContainer,
            { backgroundColor: item.type === 'recipe' ? '#AA00FF20' : '#00CFFF20' }
        ]}>
            <Ionicons
                name={item.type === 'recipe' ? 'restaurant' : 'leaf'}
                size={16}
                color={item.type === 'recipe' ? '#AA00FF' : '#00CFFF'}
            />
        </View>
        <Text style={styles.suggestionText}>
            {item.title || item.name || 'Unknown'}
        </Text>
        <Text style={[
            styles.suggestionType,
            { color: item.type === 'recipe' ? '#AA00FF' : '#00CFFF' }
        ]}>
            {item.type === 'recipe' ? 'Recipe' : 'Ingredient'}
        </Text>
    </TouchableOpacity>
));

export default function MealPlanner() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { favorites } = useFavorites();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);
    const [isDailyNutrientsLoading, setIsDailyNutrientsLoading] = useState<boolean>(true);
    const [featuredRecipes, setFeaturedRecipes] = useState<Recipe[]>([]);
    const [showFavorites, setShowFavorites] = useState<boolean>(true);

    // Autocomplete states
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
    const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Cache for autocomplete results to prevent redundant API calls
    const autocompleteCacheRef = useRef<{ [query: string]: AutocompleteSuggestion[] }>({});
    // Minimum query length before triggering autocomplete
    const MIN_QUERY_LENGTH = 2;
    // Debounce delay in milliseconds - increased to reduce API calls
    const DEBOUNCE_DELAY = 500;
    // Maximum number of suggestions to display
    const MAX_SUGGESTIONS = 5;
    // Last query that was sent to the API
    const lastQueryRef = useRef<string>('');
    // Current query being processed
    const currentQueryRef = useRef<string>('');
    // Prefetched common terms
    const COMMON_TERMS = ['chicken', 'beef', 'pasta', 'rice', 'salad', 'breakfast', 'lunch', 'dinner'];

    // Prefetch common search terms
    useEffect(() => {
        // Simplified prefetch function to avoid TypeError
        const prefetchCommonTerms = async () => {
            try {
                // Use the defined COMMON_TERMS constant
                for (const term of COMMON_TERMS) {
                    // Skip if already cached
                    if (autocompleteCacheRef.current[term]) continue;

                    try {
                        // Simple implementation to avoid errors
                        const results = await autocompleteRecipes(term);

                        // Create safe suggestions array
                        const suggestions = [];

                        // Only process if we have valid results
                        if (results && Array.isArray(results)) {
                            // Process each item individually with safety checks
                            for (let i = 0; i < Math.min(results.length, MAX_SUGGESTIONS); i++) {
                                const item = results[i];
                                if (item && typeof item === 'object' && 'id' in item && 'title' in item) {
                                    suggestions.push({
                                        id: Number(item.id) || i,
                                        title: String(item.title) || 'Unknown',
                                        type: 'recipe' as const,
                                        uniqueKey: `recipe-${i}-${Date.now()}`
                                    });
                                }
                            }
                        }

                        // Store in cache (even if empty)
                        autocompleteCacheRef.current[term] = suggestions;

                    } catch (err) {
                        console.error(`Error prefetching term "${term}":`, err);
                        // Store empty array on error
                        autocompleteCacheRef.current[term] = [];
                    }
                }
            } catch (error) {
                console.error('Error in prefetchCommonTerms:', error);
            }
        };

        // Run prefetch after component mounts
        prefetchCommonTerms();
    }, []);

    // Fetch autocomplete suggestions with improved performance
    const fetchAutocomplete = useCallback(async (query: string) => {
        if (!query || query.trim().length < MIN_QUERY_LENGTH) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Normalize the query to avoid case sensitivity issues
        const normalizedQuery = query.trim().toLowerCase();

        // Save the query we're currently processing
        currentQueryRef.current = normalizedQuery;

        // Check if this exact query was the last one processed
        if (normalizedQuery === lastQueryRef.current) {
            return;
        }

        // Check if we have cached results for this query
        if (autocompleteCacheRef.current[normalizedQuery]) {
            console.log('Using cached autocomplete results for:', normalizedQuery);
            setSuggestions(autocompleteCacheRef.current[normalizedQuery]);
            setShowSuggestions(autocompleteCacheRef.current[normalizedQuery].length > 0);
            return;
        }

        // Check if this query is a substring of any cached query
        for (const cachedQuery in autocompleteCacheRef.current) {
            if (cachedQuery.includes(normalizedQuery)) {
                console.log('Using partial match from cache:', cachedQuery);
                setSuggestions(autocompleteCacheRef.current[cachedQuery]);
                setShowSuggestions(autocompleteCacheRef.current[cachedQuery].length > 0);
                return;
            }
        }

        // Update last processed query
        lastQueryRef.current = normalizedQuery;
        setIsLoadingSuggestions(true);

        try {
            // Start the API request but don't wait for it yet
            const resultsPromise = autocompleteRecipes(normalizedQuery);

            // Process other UI tasks in parallel
            // This is where we could add other non-blocking operations if needed

            // Now wait for the API results
            const results = await resultsPromise;

            // Create safe suggestions array in a non-blocking way
            const suggestions: AutocompleteSuggestion[] = [];

            // Only process if we have valid results
            if (results && Array.isArray(results)) {
                // Process each item individually with safety checks
                for (let i = 0; i < Math.min(results.length, MAX_SUGGESTIONS); i++) {
                    const item = results[i];
                    if (item && typeof item === 'object' && 'id' in item && 'title' in item) {
                        suggestions.push({
                            id: Number(item.id) || i,
                            title: String(item.title) || 'Unknown',
                            type: 'recipe' as const,
                            uniqueKey: `recipe-${i}-${Date.now()}`
                        });
                    }
                }
            }

            // Cache the results (do this in the background)
            setTimeout(() => {
                autocompleteCacheRef.current[normalizedQuery] = suggestions;
            }, 0);

            // Only update UI if this is still the current query being processed
            if (normalizedQuery === currentQueryRef.current) {
                setSuggestions(suggestions);
                setShowSuggestions(suggestions.length > 0);
            }
        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            if (normalizedQuery === currentQueryRef.current) {
                setSuggestions([]);
                setShowSuggestions(false);
            }
            // Cache empty results to prevent repeated failed lookups
            setTimeout(() => {
                autocompleteCacheRef.current[normalizedQuery] = [];
            }, 0);
        } finally {
            if (normalizedQuery === currentQueryRef.current) {
                setIsLoadingSuggestions(false);
            }
        }
    }, []);

    // Handle search query changes with improved debouncing
    const handleSearchQueryChange = useCallback((text: string) => {
        // Always update the search query immediately for responsive UI
        setSearchQuery(text);

        // Always update the current query reference immediately
        currentQueryRef.current = text.trim().toLowerCase();

        // Clear existing timeout
        if (autocompleteTimeoutRef.current) {
            clearTimeout(autocompleteTimeoutRef.current);
            autocompleteTimeoutRef.current = null;
        }

        // Only fetch autocomplete if text is long enough
        if (text.trim().length >= MIN_QUERY_LENGTH) {
            // Show cached results immediately if available
            const normalizedQuery = text.trim().toLowerCase();

            // Check exact cache match
            if (autocompleteCacheRef.current[normalizedQuery]) {
                setSuggestions(autocompleteCacheRef.current[normalizedQuery]);
                setShowSuggestions(autocompleteCacheRef.current[normalizedQuery].length > 0);
                return; // Skip API call if we have exact cache match
            }

            // Check for partial matches in cache
            let foundPartialMatch = false;
            for (const cachedQuery in autocompleteCacheRef.current) {
                if (cachedQuery.includes(normalizedQuery)) {
                    setSuggestions(autocompleteCacheRef.current[cachedQuery]);
                    setShowSuggestions(autocompleteCacheRef.current[cachedQuery].length > 0);
                    foundPartialMatch = true;
                    break;
                }
            }

            // Only make API call if no cache hits
            if (!foundPartialMatch) {
                setIsLoadingSuggestions(true);

                // Set new timeout with appropriate delay to reduce API calls
                autocompleteTimeoutRef.current = setTimeout(() => {
                    fetchAutocomplete(text);
                }, DEBOUNCE_DELAY);
            }
        } else {
            // Clear suggestions if text is too short
            setSuggestions([]);
            setShowSuggestions(false);
            setIsLoadingSuggestions(false);
        }
    }, [fetchAutocomplete]);

    // Handle suggestion selection
    const handleSuggestionSelect = useCallback((suggestion: AutocompleteSuggestion) => {
        console.log('Suggestion selected:', suggestion);

        // Clear suggestions immediately to prevent UI flicker
        setShowSuggestions(false);
        Keyboard.dismiss();

        // Update search query without triggering autocomplete
        if (autocompleteTimeoutRef.current) {
            clearTimeout(autocompleteTimeoutRef.current);
        }

        // Get search term from suggestion
        const searchTerm = suggestion.title || suggestion.name || '';
        if (searchTerm.trim()) {
            // Set the search query to show what was selected
            setSearchQuery(searchTerm);

            // Always navigate to search results for any suggestion type
            console.log('Navigating to RecipeResults with query:', searchTerm);

            // Small delay to ensure state is updated before navigation
            setTimeout(() => {
                navigation.navigate('RecipeResults', { query: searchTerm });

                // Clear the search query after navigation
                setTimeout(() => {
                    setSearchQuery('');
                }, 500);
            }, 50);
        }
    }, [navigation]);

    // Handle search submission
    const handleSearch = useCallback(() => {
        if (searchQuery.trim()) {
            console.log('Search submitted with query:', searchQuery.trim());
            setShowSuggestions(false);
            Keyboard.dismiss();

            // Navigate to search results
            navigation.navigate('RecipeResults', { query: searchQuery.trim() });

            // Clear the search field after submitting
            setTimeout(() => {
                setSearchQuery('');
            }, 200);
        }
    }, [searchQuery, navigation]);

    // Handle search input focus
    const handleSearchFocus = useCallback(() => {
        if (searchQuery.length >= 2) {
            fetchAutocomplete(searchQuery);
        }
    }, [searchQuery, fetchAutocomplete]);

    // Handle search input blur
    const handleSearchBlur = useCallback(() => {
        // Small delay to allow suggestion tap to register
        setTimeout(() => {
            setShowSuggestions(false);
        }, 200);
    }, []);

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

            // Clear autocomplete timeout
            if (autocompleteTimeoutRef.current) {
                clearTimeout(autocompleteTimeoutRef.current);
            }
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
                    const dbProfile = await getUserProfileBySupabaseUid(user.uid);
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

    // Function to load featured healthy and popular recipes
    const loadFeaturedRecipes = async () => {
        try {
            setIsLoading(true);

            // Fetch fresh recipes from API
            console.log('🌐 Fetching fresh featured recipes from API');
            const recipes = await getRandomRecipes(10); // Increased from 5 to 10 for better results

            console.log(`Received ${recipes?.length || 0} recipes from API`);

            // Log image URLs for debugging
            recipes?.forEach((recipe, index) => {
                console.log(`Recipe ${index + 1}: ${recipe.title}, Image: ${recipe.image || 'No image'}`);
            });

            if (recipes && recipes.length > 0) {
                // Filter to recipes with valid images
                const validRecipes = recipes.filter(recipe =>
                    recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')
                );

                console.log(`Found ${validRecipes.length} recipes with valid images`);

                // Use up to 5 valid recipes
                const recipesToShow = validRecipes.slice(0, 5);
                setFeaturedRecipes(recipesToShow);

                console.log('✅ Featured recipes loaded successfully');
            }
        } catch (error) {
            console.error('Error loading healthy popular recipes:', error);
            Alert.alert('Error', 'Failed to load recipes. Please try again later.');
        } finally {
            setIsLoading(false);
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
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollInner}
            >
                {/* Header Section */}
                <View style={styles.headerInContent}>
                    <Text style={styles.headerTitle}>Meal Planner</Text>
                    <Text style={styles.headerSub}>
                        Get personalized meal plans and recipe ideas
                    </Text>
                </View>
                {/* Search Box */}
                <View style={styles.searchWrapper}>
                    <GradientBorderCard>
                        <SearchInputComponent
                            searchQuery={searchQuery}
                            onChangeText={handleSearchQueryChange}
                            onSubmitEditing={handleSearch}
                            onFocus={handleSearchFocus}
                            onBlur={handleSearchBlur}
                            isLoadingSuggestions={isLoadingSuggestions}
                        />
                    </GradientBorderCard>

                    {/* Autocomplete Suggestions */}
                    {showSuggestions && suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item) => item.uniqueKey || `${item.type}-${item.id}-${Math.random()}`}
                                renderItem={({ item }) => (
                                    <SuggestionItem
                                        item={item}
                                        onPress={handleSuggestionSelect}
                                    />
                                )}
                                showsVerticalScrollIndicator={false}
                                style={styles.suggestionsList}
                                nestedScrollEnabled={true}
                                removeClippedSubviews={false}
                                getItemLayout={(data, index) => ({
                                    length: 48,
                                    offset: 48 * index,
                                    index,
                                })}
                                initialNumToRender={5}
                                maxToRenderPerBatch={5}
                            />
                        </View>
                    )}
                </View>

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
                {foodCategories.map(category => (
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
        paddingTop: Platform.OS === 'android' ? 20 : 5,
        paddingBottom: 0,
    },
    headerInContent: {
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 16,
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
        marginTop: 20,
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
    searchWrapper: {
        position: 'relative',
        zIndex: 1000,
    },
    searchLoadingIcon: {
        marginLeft: 8,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 60, // Position below the search input
        left: 0,
        right: 0,
        backgroundColor: CARD_BG,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(170, 0, 255, 0.3)',
        maxHeight: 200,
        zIndex: 1001,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    suggestionsList: {
        maxHeight: 200,
    },
    suggestionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: CARD_BG,
        height: 48,
    },
    suggestionIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    suggestionText: {
        flex: 1,
        color: WHITE,
        fontSize: 14,
    },
    suggestionType: {
        fontSize: 12,
        color: SUBDUED,
        marginLeft: 8,
    },
});