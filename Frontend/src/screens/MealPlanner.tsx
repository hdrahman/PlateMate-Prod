import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ScrollView, TextInput, Platform, Alert,
    ActivityIndicator, FlatList, Keyboard, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import RecipeCategory from '../components/RecipeCategory';
import RecipeCard from '../components/RecipeCard';
import { getRandomRecipes, getRecipesByMealType, searchRecipes, Recipe } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';
import apiService from '../utils/apiService';
import { ServiceTokenType } from '../utils/tokenManager';
import { getCachedFeaturedRecipes, cacheFeaturedRecipes, cleanupExpiredCache } from '../utils/database';

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
import { getTodayExerciseCalories, getUserProfileBySupabaseUid, getUserGoals } from '../utils/database';
import { NutritionGoals, calculateNutritionGoals, getDefaultNutritionGoals } from '../utils/nutritionCalculator';
import { UserProfile } from '../types/user';
import { useFoodLog } from '../context/FoodLogContext';
import SubscriptionManager from '../utils/SubscriptionManager';
import SubscriptionService from '../services/SubscriptionService';
import { BlurView } from 'expo-blur';
import { ThemeContext } from '../ThemeContext';

// Color constants removed - now using ThemeContext

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

// Card component - Uses gradient border in dark mode, shadow/border in light mode
const GradientBorderCard: React.FC<GradientBorderCardProps & { cardBackground: string; gradientColors: string[]; isDarkTheme: boolean; borderColor: string }> = React.memo(({ children, style, cardBackground, gradientColors, isDarkTheme, borderColor }) => {
    // Light mode: Clean elevated card with shadow
    if (!isDarkTheme) {
        return (
            <View
                style={[
                    styles.gradientBorderContainer,
                    {
                        backgroundColor: cardBackground,
                        borderRadius: 12,
                        padding: 16,
                        // Elevation shadow for depth
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                        // Subtle border for definition
                        borderWidth: 1,
                        borderColor: borderColor,
                    },
                    style,
                ]}
            >
                {children}
            </View>
        );
    }
    
    // Dark mode: Keep the neon gradient border
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={gradientColors as any}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 12,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1,
                    borderRadius: 11,
                    backgroundColor: cardBackground,
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
    isLoadingSuggestions,
    textColor,
    textSecondaryColor,
    primaryColor
}: {
    searchQuery: string;
    onChangeText: (text: string) => void;
    onSubmitEditing: () => void;
    onFocus: () => void;
    onBlur: () => void;
    isLoadingSuggestions: boolean;
    textColor: string;
    textSecondaryColor: string;
    primaryColor: string;
}) => {
    return (
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={22} color={textSecondaryColor} style={styles.searchIcon} />
            <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search recipes, ingredients..."
                placeholderTextColor={textSecondaryColor}
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
                    color={primaryColor}
                    style={styles.searchLoadingIcon}
                />
            )}
        </View>
    );
});

// Memoized suggestion item moved outside to prevent re-renders
const SuggestionItem = React.memo(({
    item,
    onPress,
    textColor,
    textSecondaryColor,
    primaryColor
}: {
    item: AutocompleteSuggestion;
    onPress: (item: AutocompleteSuggestion) => void;
    textColor: string;
    textSecondaryColor: string;
    primaryColor: string;
}) => (
    <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => onPress(item)}
    >
        <View style={[
            styles.suggestionIconContainer,
            { backgroundColor: item.type === 'recipe' ? `${primaryColor}20` : `${primaryColor}15` }
        ]}>
            <Ionicons
                name={item.type === 'recipe' ? 'restaurant' : 'leaf'}
                size={16}
                color={primaryColor}
            />
        </View>
        <Text style={[styles.suggestionText, { color: textColor }]}>
            {item.title || item.name || 'Unknown'}
        </Text>
        <Text style={[
            styles.suggestionType,
            { color: primaryColor }
        ]}>
            {item.type === 'recipe' ? 'Recipe' : 'Ingredient'}
        </Text>
    </TouchableOpacity>
));

export default function MealPlanner() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { theme, isDarkTheme } = useContext(ThemeContext);
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

    // Subscription status
    const [hasPremiumAccess, setHasPremiumAccess] = useState(true); // Start optimistic
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);

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
        checkPremiumAccess();
        loadFeaturedRecipes();
    }, []);

    // Re-check premium access when user changes (e.g., after subscription)
    useEffect(() => {
        if (user) {
            checkPremiumAccess();
        }
    }, [user]);

    // Listen for subscription changes and re-check premium access
    useEffect(() => {
        const handleSubscriptionChange = () => {
            console.log('📢 MealPlanner: Subscription status changed, re-checking premium access');
            checkPremiumAccess();
        };

        // Add listener for subscription changes
        SubscriptionService.addSubscriptionChangeListener(handleSubscriptionChange);

        // Cleanup listener on unmount
        return () => {
            SubscriptionService.removeSubscriptionChangeListener(handleSubscriptionChange);
        };
    }, []);

    // Re-load recipes when premium access changes
    useEffect(() => {
        if (!isCheckingAccess) {
            loadFeaturedRecipes();
        }
    }, [hasPremiumAccess, isCheckingAccess]);

    // Check if user has premium access
    const checkPremiumAccess = async () => {
        try {
            setIsCheckingAccess(true);
            const hasAccess = await SubscriptionManager.canAccessPremiumFeature();
            setHasPremiumAccess(hasAccess);
        } catch (error) {
            console.error('Error checking premium access:', error);
            // On error, assume no access to be safe
            setHasPremiumAccess(false);
        } finally {
            setIsCheckingAccess(false);
        }
    };

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

                // Get user goals from database first, then calculate if needed
                let calculatedGoals = getDefaultNutritionGoals();
                if (currentProfile) {
                    calculatedGoals = calculateNutritionGoals(currentProfile);
                }

                let finalGoals = calculatedGoals;

                if (user) {
                    const userGoals = await getUserGoals(user.uid);
                    if (userGoals && userGoals.calorieGoal) {
                        // Use stored goals from database
                        finalGoals = {
                            calories: userGoals.calorieGoal,
                            protein: userGoals.proteinGoal || calculatedGoals.protein,
                            carbs: userGoals.carbGoal || calculatedGoals.carbs,
                            fat: userGoals.fatGoal || calculatedGoals.fat,
                            fiber: calculatedGoals.fiber,
                            sugar: calculatedGoals.sugar,
                            sodium: calculatedGoals.sodium
                        };
                        console.log('📊 MealPlanner using stored goals from database:', finalGoals);
                    } else {
                        console.log('📊 MealPlanner using calculated goals:', finalGoals);
                    }
                }

                setUserGoals(finalGoals);
                setIsProfileLoading(false);

                setIsDailyNutrientsLoading(true);
                try {
                    // Use the nutrient totals from context instead of refreshing logs
                    // This prevents unnecessary database calls

                    // Get today's exercise calories
                    const todayExerciseCals = await getTodayExerciseCalories();

                    const goalCalories = finalGoals.calories;
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
                        remainingCalories: finalGoals.calories
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

    // Function to load featured gym-friendly recipes - NOW WITH DAILY CACHING!
    const loadFeaturedRecipes = async () => {
        try {
            setIsLoading(true);

            // For non-premium users, show generic/demo recipes
            if (!hasPremiumAccess && !isCheckingAccess) {
                const genericRecipes = getGenericRecipes();
                setFeaturedRecipes(genericRecipes);
                return;
            }

            // Clean up expired cache entries first
            await cleanupExpiredCache();

            // Check if we have cached featured recipes for today
            console.log('🔍 Checking for cached featured recipes...');
            const cachedRecipes = await getCachedFeaturedRecipes();

            if (cachedRecipes && cachedRecipes.length > 0) {
                console.log('✅ Using cached featured recipes from today');
                setFeaturedRecipes(cachedRecipes);
                return;
            }

            // No cache found, fetch fresh recipes
            console.log('🌐 Fetching fresh featured recipes...');

            // Mix of gym-friendly search terms to get variety - NO QUINOA SPAM!
            const gymFriendlySearchTerms = [
                'chicken breast', 'beef steak', 'grilled chicken', 'chicken pasta',
                'beef stir fry', 'chicken rice', 'salmon fillet', 'turkey sandwich',
                'chicken burrito', 'beef tacos', 'protein pancakes', 'chicken curry',
                'beef noodles', 'chicken wrap', 'salmon bowl', 'turkey meatballs'
            ];

            // Pick a random search term for variety
            const searchTerm = gymFriendlySearchTerms[Math.floor(Math.random() * gymFriendlySearchTerms.length)];

            const searchResult = await searchRecipes(searchTerm, 15); // Search for 15 to have good selection
            const recipes = searchResult.results || [];

            console.log(`Received ${recipes?.length || 0} recipes for "${searchTerm}"`);

            if (recipes && recipes.length > 0) {
                // Filter to recipes with valid images and prefer higher protein/calories
                const validRecipes = recipes.filter(recipe =>
                    recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')
                ).sort((a, b) => {
                    // Prefer recipes with higher health scores (they tend to be more balanced)
                    const scoreA = a.healthScore || 0;
                    const scoreB = b.healthScore || 0;
                    return scoreB - scoreA;
                });

                console.log(`Found ${validRecipes.length} recipes with valid images`);

                // Use up to 5 valid recipes
                const recipesToShow = validRecipes.slice(0, 5);
                setFeaturedRecipes(recipesToShow);

                // Cache the recipes for today
                await cacheFeaturedRecipes(recipesToShow);
                console.log('💾 Featured recipes cached for today');
            } else {
                // Fallback to random recipes if search fails
                console.log('No recipes found, falling back to random recipes');
                const fallbackRecipes = await getRandomRecipes(10);
                const validFallback = fallbackRecipes.filter(recipe =>
                    recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')
                );
                const recipesToShow = validFallback.slice(0, 5);
                setFeaturedRecipes(recipesToShow);

                // Cache the fallback recipes too
                await cacheFeaturedRecipes(recipesToShow);
                console.log('💾 Fallback recipes cached for today');
            }
        } catch (error) {
            console.error('Error loading featured recipes:', error);
            // For premium users, show error. For free users, show generic recipes
            if (!hasPremiumAccess) {
                setFeaturedRecipes(getGenericRecipes());
            } else {
                Alert.alert('Error', 'Failed to load featured recipes. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Generic recipes for non-premium users
    const getGenericRecipes = (): Recipe[] => {
        return [
            {
                id: 999001,
                title: 'Delicious Healthy Meal',
                image: 'https://via.placeholder.com/300x200/4CAF50/white?text=Healthy+Recipe',
                readyInMinutes: 30,
                servings: 2,
                healthScore: 85,
                aggregateLikes: 245,
                extendedIngredients: [],
                analyzedInstructions: [],
                cuisines: ['Healthy'],
                diets: ['Balanced'],
                dishTypes: ['Main Course'],
                summary: 'A nutritious and delicious meal perfect for your health goals.',
                vegan: false,
                vegetarian: false,
                glutenFree: false,
                dairyFree: false
            },
            {
                id: 999002,
                title: 'Protein-Rich Dish',
                image: 'https://via.placeholder.com/300x200/FF9800/white?text=Protein+Rich',
                readyInMinutes: 25,
                servings: 4,
                healthScore: 90,
                aggregateLikes: 189,
                extendedIngredients: [],
                analyzedInstructions: [],
                cuisines: ['Fitness'],
                diets: ['High Protein'],
                dishTypes: ['Main Course'],
                summary: 'High-protein recipe designed to support your fitness goals.',
                vegan: false,
                vegetarian: false,
                glutenFree: false,
                dairyFree: false
            },
            {
                id: 999003,
                title: 'Balanced Nutrition Bowl',
                image: 'https://via.placeholder.com/300x200/2196F3/white?text=Nutrition+Bowl',
                readyInMinutes: 20,
                servings: 1,
                healthScore: 95,
                aggregateLikes: 312,
                extendedIngredients: [],
                analyzedInstructions: [],
                cuisines: ['Bowl'],
                diets: ['Balanced', 'Whole Foods'],
                dishTypes: ['Bowl'],
                summary: 'A perfectly balanced nutrition bowl with wholesome ingredients.',
                vegan: true,
                vegetarian: true,
                glutenFree: true,
                dairyFree: true
            }
        ];
    };

    // Handle recipe press - redirect to subscription for non-premium users
    const handleRecipePress = async (recipe: Recipe) => {
        if (!hasPremiumAccess) {
            navigation.navigate('PremiumSubscription', {
                source: 'meal_planner',
                feature: 'recipe_details',
            });
        } else {
            navigation.navigate('RecipeDetails', { recipeId: recipe.id });
        }
    };

    // Handle scanning pantry - redirect to subscription for non-premium users
    const handleScanPantry = async () => {
        if (!hasPremiumAccess) {
            navigation.navigate('PremiumSubscription', {
                source: 'meal_planner',
                feature: 'pantry_scanning',
            });
        } else {
            Alert.alert('Coming Soon', 'Pantry scanning feature is coming soon!');
        }
    };

    // Error banner component
    const renderErrorBanner = () => {
        if (!hasError) return null;

        return (
            <TouchableOpacity
                style={styles.errorBanner}
                onPress={forceSingleRefresh}
            >
                <Ionicons name="warning-outline" size={20} color={theme.colors.warning} />
                <Text style={styles.errorText}>
                    Database connection issue. Tap to retry.
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {renderErrorBanner()}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollInner}
                scrollEnabled={hasPremiumAccess} // Disable scrolling for non-premium users
            >
                {/* Header Section */}
                <View style={styles.headerInContent}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meal Planner</Text>
                    <Text style={[styles.headerSub, { color: theme.colors.textSecondary }]}>
                        Get personalized meal plans and recipe ideas
                    </Text>
                </View>
                {/* Search Box */}
                <View style={styles.searchWrapper}>
                    <GradientBorderCard cardBackground={theme.colors.cardBackground} gradientColors={theme.colors.gradientNeonBlue} isDarkTheme={isDarkTheme} borderColor={theme.colors.border}>
                        <SearchInputComponent
                            searchQuery={searchQuery}
                            onChangeText={handleSearchQueryChange}
                            onSubmitEditing={handleSearch}
                            onFocus={handleSearchFocus}
                            onBlur={handleSearchBlur}
                            isLoadingSuggestions={isLoadingSuggestions}
                            textColor={theme.colors.text}
                            textSecondaryColor={theme.colors.textSecondary}
                            primaryColor={theme.colors.primary}
                        />
                    </GradientBorderCard>

                    {/* Autocomplete Suggestions */}
                    {showSuggestions && suggestions.length > 0 && (
                        <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item) => item.uniqueKey || `${item.type}-${item.id}-${Math.random()}`}
                                renderItem={({ item }) => (
                                    <SuggestionItem
                                        item={item}
                                        onPress={handleSuggestionSelect}
                                        textColor={theme.colors.text}
                                        textSecondaryColor={theme.colors.textSecondary}
                                        primaryColor={theme.colors.primary}
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
                <GradientBorderCard cardBackground={theme.colors.cardBackground} gradientColors={theme.colors.gradientNeonBlue} isDarkTheme={isDarkTheme} borderColor={theme.colors.border}>
                    <TouchableOpacity
                        style={styles.actionCardContent}
                        onPress={handleScanPantry}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: `${theme.colors.primary}33` }]}>
                            <Ionicons name="camera-outline" size={24} color={theme.colors.text} />
                        </View>
                        <View style={styles.actionTextContainer}>
                            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Scan Your Pantry</Text>
                            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                                Get recipe ideas based on what you have
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </GradientBorderCard>

                {/* Favorite Recipes Section */}
                {favorites.length > 0 && (
                    <>
                        <View style={styles.sectionHeaderContainer}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Favorite Recipes</Text>
                            <TouchableOpacity
                                onPress={() => setShowFavorites(!showFavorites)}
                                style={styles.toggleButton}
                            >
                                <Ionicons
                                    name={showFavorites ? "chevron-up" : "chevron-down"}
                                    size={24}
                                    color={theme.colors.text}
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
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Featured Recipes</Text>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
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
                <GradientBorderCard cardBackground={theme.colors.cardBackground} gradientColors={theme.colors.gradientNeonBlue} isDarkTheme={isDarkTheme} borderColor={theme.colors.border}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Today's Nutrition</Text>
                    <View style={[styles.dividerLine, { backgroundColor: `${theme.colors.primary}4D` }]} />
                    <View style={styles.nutritionInfoContainer}>
                        <View style={styles.nutritionItem}>
                            <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>Remaining Calories</Text>
                            <Text style={[styles.nutritionValue, { color: theme.colors.text }]}>
                                {!hasPremiumAccess ? '---' : isDailyNutrientsLoading ? '...' : dailyNutrition.remainingCalories}
                            </Text>
                        </View>
                        <View style={styles.nutritionItem}>
                            <Text style={[styles.nutritionLabel, { color: theme.colors.textSecondary }]}>Meals Left</Text>
                            <Text style={[styles.nutritionValue, { color: theme.colors.text }]}>{!hasPremiumAccess ? '---' : dailyNutrition.mealsLeft}</Text>
                        </View>
                    </View>
                    <View style={styles.macrosContainer}>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.text }]}>
                                {!hasPremiumAccess ? '---' : isDailyNutrientsLoading ? '...' : dailyNutrition.carbs + 'g'}
                            </Text>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.text }]}>
                                {!hasPremiumAccess ? '---' : isDailyNutrientsLoading ? '...' : dailyNutrition.protein + 'g'}
                            </Text>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={[styles.macroValue, { color: theme.colors.text }]}>
                                {!hasPremiumAccess ? '---' : isDailyNutrientsLoading ? '...' : dailyNutrition.fat + 'g'}
                            </Text>
                            <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>Fat</Text>
                        </View>
                    </View>
                </GradientBorderCard>

                {/* FatSecret Attribution */}
                <View style={styles.attributionContainer}>
                    <Text
                        style={[styles.attributionText, { color: theme.colors.textSecondary }]}
                        onPress={() => {
                            Linking.openURL('https://www.fatsecret.com');
                        }}
                    >
                        Powered by fatsecret
                    </Text>
                </View>
            </ScrollView>

            {/* Paywall overlay for non-premium users */}
            {!isCheckingAccess && !hasPremiumAccess && (
                <View style={styles.paywallOverlay}>
                    {Platform.OS === 'ios' ? (
                        <BlurView
                            intensity={15}
                            tint="dark"
                            style={styles.blurOverlay}
                        >
                            <View style={styles.blurBackdrop} />
                            <View style={styles.paywallContent}>
                                <LinearGradient
                                    colors={['#5A60EA', '#FF00F5']}
                                    style={styles.paywallGradient}
                                >
                                    <Ionicons name="restaurant" size={64} color="#FFF" />
                                    <Text style={styles.paywallTitle}>Unlock Meal Planner</Text>
                                    <Text style={styles.paywallSubtitle}>
                                        Get personalized meal plans, recipe recommendations, and nutrition insights
                                    </Text>
                                    <View style={styles.paywallFeatures}>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Unlimited recipe access</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Personalized meal plans</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Pantry scanning</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Nutrition analysis</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.paywallButton}
                                        onPress={() => navigation.navigate('PremiumSubscription', {
                                            source: 'meal_planner_overlay',
                                            feature: 'meal_planning'
                                        })}
                                    >
                                        <Text style={styles.paywallButtonText}>Upgrade to Premium</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.paywallTrialText}>
                                        +14 days free trial • Up to 28 days total
                                    </Text>
                                </LinearGradient>
                            </View>
                        </BlurView>
                    ) : (
                        <View style={[styles.blurOverlay, styles.androidBlurOverlay]}>
                            <View style={styles.paywallContent}>
                                <LinearGradient
                                    colors={['#5A60EA', '#FF00F5']}
                                    style={styles.paywallGradient}
                                >
                                    <Ionicons name="restaurant" size={64} color="#FFF" />
                                    <Text style={styles.paywallTitle}>Unlock Meal Planner</Text>
                                    <Text style={styles.paywallSubtitle}>
                                        Get personalized meal plans, recipe recommendations, and nutrition insights
                                    </Text>
                                    <View style={styles.paywallFeatures}>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Unlimited recipe access</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Personalized meal plans</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Pantry scanning</Text>
                                        </View>
                                        <View style={styles.paywallFeature}>
                                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                            <Text style={styles.paywallFeatureText}>Nutrition analysis</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.paywallButton}
                                        onPress={() => navigation.navigate('PremiumSubscription', {
                                            source: 'meal_planner_overlay',
                                            feature: 'meal_planning'
                                        })}
                                    >
                                        <Text style={styles.paywallButtonText}>Upgrade to Premium</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.paywallTrialText}>
                                        +14 days free trial • Up to 28 days total
                                    </Text>
                                </LinearGradient>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        marginBottom: 4,
    },
    headerSub: {
        fontSize: 14,
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
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 12,
    },
    dividerLine: {
        height: 1,
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
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 20,
        fontWeight: 'bold',
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
    },
    macroLabel: {
        fontSize: 12,
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
        borderRadius: 10,
        borderWidth: 1,
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
        marginTop: 12,
        marginBottom: 8,
    },
    preferenceInput: {
        borderRadius: 8,
        padding: 12,
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
    },
    radioOuterCircle: {
        height: 20,
        width: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInnerCircle: {
        height: 10,
        width: 10,
        borderRadius: 5,
    },
    generateButton: {
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    generateButtonText: {
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
        borderRadius: 8,
        borderWidth: 1,
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
        borderBottomColor: 'transparent',
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
        fontSize: 14,
    },
    suggestionType: {
        fontSize: 12,
        marginLeft: 8,
    },
    attributionContainer: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 20,
    },
    attributionText: {
        fontSize: 12,
        textDecorationLine: 'underline',
        opacity: 0.8,
    },
    // Paywall styles
    paywallOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    blurOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    blurBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    androidBlurOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    paywallContent: {
        width: '100%',
        maxWidth: 350,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    paywallGradient: {
        padding: 32,
        alignItems: 'center',
        borderRadius: 20,
    },
    paywallTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    paywallSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    paywallFeatures: {
        width: '100%',
        marginBottom: 24,
    },
    paywallFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    paywallFeatureText: {
        fontSize: 16,
        color: '#FFF',
        marginLeft: 12,
        fontWeight: '500',
    },
    paywallButton: {
        backgroundColor: '#FFF',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 25,
        marginBottom: 12,
        minWidth: 200,
        alignItems: 'center',
    },
    paywallButtonText: {
        color: '#5A60EA',
        fontSize: 18,
        fontWeight: 'bold',
    },
    paywallTrialText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
});