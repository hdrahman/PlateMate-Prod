import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp, NavigationProp, ParamListBase } from '@react-navigation/native';
import { Recipe } from '../api/recipes';

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

// Define nutrients interface
interface Nutrients {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

// Define route params interface
interface MealPlannerResultsParams {
    mealPlan: Recipe[];
    nutrients: Nutrients;
}

// We no longer use fallback images

export default function MealPlannerResults() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<Record<string, MealPlannerResultsParams>, string>>();
    const [loading, setLoading] = useState(true);
    const [mealPlan, setMealPlan] = useState<Recipe[]>([]);
    const [nutrients, setNutrients] = useState<Nutrients>({
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0
    });
    const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});
    const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
    const [retryCount, setRetryCount] = useState<{ [key: string]: number }>({});

    useEffect(() => {
        // Get meal plan data from navigation params
        if (route.params) {
            const { mealPlan: mealPlanData, nutrients: nutrientsData } = route.params;

            if (mealPlanData) {
                // Log received recipes for debugging
                console.log(`Received ${mealPlanData.length} recipes in meal plan`);
                mealPlanData.forEach((recipe, index) => {
                    console.log(`Recipe ${index + 1}: ${recipe.title}, Image URL: ${recipe.image || 'No image'}`);
                });

                // Validate image URLs up front
                const validatedMealPlan = mealPlanData.map(recipe => {
                    if (recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')) {
                        return recipe;
                    } else {
                        console.log(`Recipe ${recipe.title} has invalid image URL: ${recipe.image}`);
                        // Create a more reliable URL based on recipe ID
                        const fixedRecipe = {
                            ...recipe,
                            image: `https://spoonacular.com/recipeImages/${recipe.id}-556x370.jpg`
                        };
                        console.log(`Fixed image URL to: ${fixedRecipe.image}`);
                        return fixedRecipe;
                    }
                });

                setMealPlan(validatedMealPlan);

                // Initialize image loading states
                const loadingStates: { [key: string]: boolean } = {};
                const retries: { [key: string]: number } = {};
                validatedMealPlan.forEach((recipe) => {
                    if (recipe.id) {
                        const recipeId = recipe.id.toString();
                        loadingStates[recipeId] = true;
                        retries[recipeId] = 0;
                    }
                });
                setImageLoadingStates(loadingStates);
                setRetryCount(retries);
            }

            if (nutrientsData) {
                setNutrients(nutrientsData);
            }

            setLoading(false);
        }
    }, [route.params]);

    const handleImageLoad = (recipeId: string) => {
        setImageLoadingStates(prev => ({ ...prev, [recipeId]: false }));
    };

    const handleImageError = (recipeId: string, recipeTitle: string) => {
        console.error(`Error loading image for recipe ID: ${recipeId}, Title: ${recipeTitle}`);

        // If we've already retried 2 times, mark as error
        if (retryCount[recipeId] >= 2) {
            setImageLoadingStates(prev => ({ ...prev, [recipeId]: false }));
            setImageErrors(prev => ({ ...prev, [recipeId]: true }));
            return;
        }

        // Increment retry count
        setRetryCount(prev => ({
            ...prev,
            [recipeId]: (prev[recipeId] || 0) + 1
        }));

        // Try an alternative image URL with a different format
        const updatedMealPlan = mealPlan.map(recipe => {
            if (recipe.id.toString() === recipeId) {
                // Try different image formats based on retry count
                let newImageUrl;
                if (retryCount[recipeId] === 0) {
                    // First retry: Try Spoonacular format with 556x370
                    newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
                } else {
                    // Second retry: Try 636x393 format
                    newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-636x393.jpg`;
                }

                console.log(`Retrying with new image URL for ${recipe.title}: ${newImageUrl}`);

                return {
                    ...recipe,
                    image: newImageUrl
                };
            }
            return recipe;
        });

        setMealPlan(updatedMealPlan);
    };

    const getImageSource = (recipe: Recipe) => {
        const recipeId = recipe.id?.toString() || 'unknown';
        const hasError = imageErrors[recipeId];

        if (hasError) {
            // If we've tried multiple times and failed, use a category-based fallback
            let category = "food";
            if (recipe.cuisines && recipe.cuisines.length > 0) {
                category = recipe.cuisines[0].toLowerCase();
            } else if (recipe.diets && recipe.diets.length > 0) {
                category = recipe.diets[0].toLowerCase();
            }

            // Map common categories to image types
            let imageType = "food";
            if (category.includes("italian") || category.includes("pasta")) {
                imageType = "pasta";
            } else if (category.includes("asian") || category.includes("chinese")) {
                imageType = "asian";
            } else if (category.includes("breakfast")) {
                imageType = "breakfast";
            }

            return `https://spoonacular.com/recipeImages/default-${imageType}.jpg`;
        }

        // Skip known problematic FatSecret default images
        if (recipe.image === "https://www.fatsecret.com/static/recipe/default.jpg" ||
            (recipe.image && recipe.image.endsWith("/static/recipe/default.jpg"))) {
            return `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
        }

        return recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')
            ? recipe.image
            : `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
    };

    const renderMealImage = (recipe: Recipe) => {
        const recipeId = recipe.id?.toString() || 'unknown';
        const isLoading = imageLoadingStates[recipeId];

        return (
            <View style={styles.imageContainer}>
                {isLoading && (
                    <View style={styles.imageLoadingContainer}>
                        <ActivityIndicator size="small" color={PURPLE_ACCENT} />
                    </View>
                )}
                <Image
                    source={{ uri: getImageSource(recipe) }}
                    style={[styles.mealImage, { opacity: isLoading ? 0 : 1 }]}
                    resizeMode="cover"
                    onLoad={() => handleImageLoad(recipeId)}
                    onError={() => handleImageError(recipeId, recipe.title || 'Unknown Recipe')}
                />
            </View>
        );
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

    // Navigate to recipe details
    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipeId: recipe.id });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.navigate('MealPlanner')}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Meal Plan</Text>
                <View style={styles.placeholderButton} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                    <Text style={styles.loadingText}>Generating your personalized meal plan...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollInner}
                >
                    <GradientBorderCard>
                        <Text style={styles.summaryTitle}>Daily Nutrition Summary</Text>
                        <View style={styles.dividerLine} />
                        <View style={styles.macrosContainer}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{Math.round(nutrients.calories)}</Text>
                                <Text style={styles.macroLabel}>Calories</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{Math.round(nutrients.protein)}g</Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{Math.round(nutrients.carbohydrates)}g</Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{Math.round(nutrients.fat)}g</Text>
                                <Text style={styles.macroLabel}>Fats</Text>
                            </View>
                        </View>
                    </GradientBorderCard>

                    <Text style={styles.mealsTitle}>Your Meals</Text>

                    {mealPlan.length > 0 ? (
                        mealPlan.map((recipe, index) => (
                            <GradientBorderCard key={recipe.id || index}>
                                {renderMealImage(recipe)}
                                <View style={styles.mealInfo}>
                                    <Text style={styles.mealName}>{recipe.title}</Text>

                                    <View style={styles.dividerLine} />

                                    <View style={styles.mealMacros}>
                                        <Text style={styles.mealMacro}>{recipe.readyInMinutes} min</Text>
                                        <Text style={styles.mealMacro}>{recipe.servings} servings</Text>
                                        <Text style={styles.mealMacro}>{recipe.healthScore}/100 health</Text>
                                    </View>

                                    {recipe.diets && recipe.diets.length > 0 && (
                                        <View style={styles.dietTags}>
                                            {recipe.diets.map((diet, i) => (
                                                <View key={i} style={styles.dietTag}>
                                                    <Text style={styles.dietTagText}>{diet}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    <Text style={styles.ingredientsTitle}>Ingredients:</Text>
                                    <Text style={styles.ingredients}>
                                        {recipe.ingredients.join(", ")}
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.viewButton}
                                        onPress={() => handleRecipePress(recipe)}
                                    >
                                        <Text style={styles.viewButtonText}>View Full Recipe</Text>
                                    </TouchableOpacity>
                                </View>
                            </GradientBorderCard>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="restaurant-outline" size={50} color={SUBDUED} />
                            <Text style={styles.emptyStateText}>No meal plan generated yet</Text>
                            <TouchableOpacity
                                style={styles.generateButton}
                                onPress={() => navigation.navigate('MealPlanner')}
                            >
                                <Text style={styles.generateButtonText}>Create Meal Plan</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
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
        paddingTop: 10,
        paddingBottom: 10,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    placeholderButton: {
        width: 32,
        height: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollInner: {
        padding: 16,
        paddingBottom: 40,
    },
    gradientBorderContainer: {
        borderRadius: 10,
        marginVertical: 8,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 4,
    },
    dividerLine: {
        height: 1,
        backgroundColor: 'rgba(170, 0, 255, 0.3)',
        marginVertical: 12,
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
    },
    macroLabel: {
        fontSize: 12,
        color: SUBDUED,
        marginTop: 4,
    },
    mealsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
        marginTop: 20,
        marginBottom: 8,
    },
    mealImage: {
        width: '100%',
        height: 180,
        borderRadius: 8,
        marginBottom: 12,
    },
    mealInfo: {
        flex: 1,
    },
    mealName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 4,
    },
    mealMacros: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    mealMacro: {
        fontSize: 14,
        color: SUBDUED,
        marginRight: 16,
    },
    dietTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    dietTag: {
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
        marginBottom: 8,
    },
    dietTagText: {
        color: PURPLE_ACCENT,
        fontSize: 12,
        textTransform: 'capitalize',
    },
    ingredientsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    ingredients: {
        fontSize: 14,
        color: SUBDUED,
        lineHeight: 20,
        marginBottom: 16,
    },
    viewButton: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    viewButtonText: {
        color: WHITE,
        fontWeight: '600',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: WHITE,
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        color: SUBDUED,
        fontSize: 16,
        marginTop: 16,
        marginBottom: 24,
    },
    generateButton: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    generateButtonText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 14,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 180,
        borderRadius: 8,
        marginBottom: 12,
    },
    imageLoadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
}); 