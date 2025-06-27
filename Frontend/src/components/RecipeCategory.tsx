import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RecipeCard from './RecipeCard';
import { getRecipesByMealType, Recipe } from '../api/recipes';

// Define color constants for consistent theming
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';
const CARD_BG = '#121212';

// Function to determine the color based on health score
const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green for excellent
    if (score >= 60) return '#8BC34A'; // Light green for good
    if (score >= 40) return '#FFEB3B'; // Yellow for moderate
    if (score >= 20) return '#FF9800'; // Orange for fair
    return '#F44336'; // Red for poor
};

// Function to format the likes count
const formatLikes = (likes: number): string => {
    if (likes >= 1000000) return (likes / 1000000).toFixed(1) + 'M';
    if (likes >= 1000) return (likes / 1000).toFixed(1) + 'K';
    return likes.toString();
};

// Maximum number of image loading retries
const MAX_RETRIES = 2;

interface RecipeCategoryProps {
    title: string;
    categoryId: string;
    icon: string;
    onRecipePress: (recipe: Recipe) => void;
}

interface RecipeWithRetries extends Recipe {
    retryCount?: number;
    currentImageUrl?: string;
}

const RecipeCategory: React.FC<RecipeCategoryProps> = ({
    title,
    categoryId,
    icon,
    onRecipePress
}) => {
    const [recipes, setRecipes] = useState<RecipeWithRetries[]>([]);
    const [loading, setLoading] = useState(true);
    const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
    const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                setLoading(true);

                // Fetch fresh recipes from API
                console.log(`🌐 Fetching fresh ${categoryId} recipes from API`);
                const data = await getRecipesByMealType(categoryId, 12);

                console.log(`Category ${categoryId}: Received ${data?.length || 0} recipes`);

                if (data && data.length > 0) {
                    // Initialize image loading and retry states
                    const initialImageLoading: { [key: string]: boolean } = {};
                    const recipesWithRetries = data.map(recipe => {
                        const recipeId = recipe.id?.toString() || '';
                        initialImageLoading[recipeId] = true;
                        return {
                            ...recipe,
                            retryCount: 0,
                            currentImageUrl: recipe.image
                        };
                    });

                    setRecipes(recipesWithRetries);
                    setImageLoading(initialImageLoading);
                } else {
                    console.log(`No recipes found for category: ${categoryId}`);
                    setRecipes([]);
                }
            } catch (error) {
                console.error(`Error fetching ${categoryId} recipes:`, error);
                setRecipes([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, [categoryId]);

    const handleImageLoad = (recipeId: string) => {
        setImageLoading(prev => ({ ...prev, [recipeId]: false }));
    };

    const handleImageError = (recipeId: string) => {
        console.error(`Error loading image for recipe ID: ${recipeId} in category: ${title}`);

        // Find the recipe and check retry count
        const recipeToRetry = recipes.find(r => r.id?.toString() === recipeId);
        if (!recipeToRetry) return;

        const currentRetries = recipeToRetry.retryCount || 0;

        // If we've reached max retries, mark as error
        if (currentRetries >= MAX_RETRIES) {
            setImageLoading(prev => ({ ...prev, [recipeId]: false }));
            setImageErrors(prev => ({ ...prev, [recipeId]: true }));
            return;
        }

        // Try a different image URL format based on retry count
        const newRetryCount = currentRetries + 1;
        let newImageUrl;

        if (newRetryCount === 1) {
            // First retry: Try Spoonacular format with 556x370
            newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
        } else {
            // Second retry: Try 636x393 format
            newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-636x393.jpg`;
        }

        console.log(`Retry ${newRetryCount} for recipe ${recipeId} with URL: ${newImageUrl}`);

        // Update the recipe with new retry count and image URL
        const updatedRecipes = recipes.map(recipe => {
            if (recipe.id?.toString() === recipeId) {
                return {
                    ...recipe,
                    retryCount: newRetryCount,
                    currentImageUrl: newImageUrl
                };
            }
            return recipe;
        });

        setRecipes(updatedRecipes);
    };

    const getImageSource = (recipe: RecipeWithRetries): string => {
        const recipeId = recipe.id?.toString() || '';
        const hasError = imageErrors[recipeId];

        if (hasError) {
            // If we've tried multiple times and failed, use a category-based fallback
            let category = "food";
            if (recipe.cuisines && recipe.cuisines.length > 0) {
                category = recipe.cuisines[0].toLowerCase();
            } else if (recipe.diets && recipe.diets.length > 0) {
                category = recipe.diets[0].toLowerCase();
            }

            // Map category to appropriate fallback
            let imageType = "food";
            if (category.includes("italian") || category.includes("pasta")) {
                imageType = "pasta";
            } else if (category.includes("chicken")) {
                imageType = "chicken";
            } else if (category.includes("beef") || category.includes("meat")) {
                imageType = "beef";
            } else if (category.includes("breakfast")) {
                imageType = "breakfast";
            } else if (category.includes("dessert") || category.includes("sweet")) {
                imageType = "dessert";
            } else if (category.includes("seafood") || category.includes("fish")) {
                imageType = "seafood";
            } else if (category.includes("vegetable") || category.includes("vegan")) {
                imageType = "vegetable";
            } else if (category.includes("beverage") || category.includes("drink")) {
                imageType = "beverage";
            }

            return `https://spoonacular.com/recipeImages/default-${imageType}.jpg`;
        }

        // Skip known problematic FatSecret default images
        if (recipe.image === "https://www.fatsecret.com/static/recipe/default.jpg" ||
            (recipe.image && recipe.image.endsWith("/static/recipe/default.jpg"))) {
            return `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
        }

        // Use the current image URL (could be original or retry URL)
        if (recipe.currentImageUrl && typeof recipe.currentImageUrl === 'string') {
            return recipe.currentImageUrl;
        }

        // Fallback to original image if available
        if (recipe.image && typeof recipe.image === 'string') {
            return recipe.image;
        }

        // Last resort fallback
        return `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={icon as any} size={20} color={WHITE} />
                    </View>
                    <Text style={styles.title}>{title}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                </View>
            </View>
        );
    }

    if (recipes.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon as any} size={20} color={WHITE} />
                </View>
                <Text style={styles.title}>{title}</Text>

            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {recipes.map((recipe) => (
                    <TouchableOpacity
                        key={recipe.id}
                        style={styles.cardContainer}
                        onPress={() => onRecipePress(recipe)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardWrapper}>
                            <LinearGradient
                                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.cardGradient}
                            >
                                <ImageBackground
                                    source={{ uri: getImageSource(recipe) }}
                                    style={styles.recipeImage}
                                    imageStyle={styles.recipeImageStyle}
                                    resizeMode="cover"
                                    onLoad={() => handleImageLoad(recipe.id?.toString() || '')}
                                    onError={() => handleImageError(recipe.id?.toString() || '')}
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        locations={[0.5, 1]}
                                        style={styles.imageFadeGradient}
                                    >
                                        <View style={styles.recipeInfo}>
                                            <Text style={styles.recipeTitle} numberOfLines={1}>
                                                {recipe.title}
                                            </Text>
                                            <View style={styles.recipeMetaInfo}>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="time-outline" size={14} color={WHITE} />
                                                    <Text style={styles.metaText}>{recipe.readyInMinutes}m</Text>
                                                </View>
                                                <View style={styles.iconsContainer}>
                                                    <View style={styles.healthScoreContainer}>
                                                        <Ionicons
                                                            name="heart"
                                                            size={14}
                                                            color={getHealthScoreColor(recipe.healthScore)}
                                                        />
                                                        <Text style={[
                                                            styles.metaText,
                                                            { color: getHealthScoreColor(recipe.healthScore) }
                                                        ]}>
                                                            {recipe.healthScore}
                                                        </Text>
                                                    </View>


                                                </View>
                                            </View>
                                        </View>
                                    </LinearGradient>

                                </ImageBackground>
                            </LinearGradient>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 10,
    },
    iconContainer: {
        backgroundColor: PURPLE_ACCENT,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    title: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    seeAllButton: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    seeAllText: {
        color: PURPLE_ACCENT,
        fontSize: 14,
        fontWeight: '500',
        marginRight: 2,
    },
    scrollContent: {
        paddingLeft: 10,
        paddingRight: 20,
    },
    cardContainer: {
        width: 220,
        marginRight: 12,
    },
    cardWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    cardGradient: {
        padding: 2,
        borderRadius: 12,
    },
    recipeImage: {
        height: 160,
        width: '100%',
        justifyContent: 'flex-end',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
    },
    recipeImageStyle: {
        borderRadius: 10,
        backgroundColor: '#1a1a1a',
    },
    imageFadeGradient: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingVertical: 10,
    },
    recipeInfo: {
        padding: 10,
    },
    recipeTitle: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    recipeMetaInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    iconsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    healthScoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: 6,
    },
    likesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    metaText: {
        color: WHITE,
        fontSize: 12,
        marginLeft: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    loadingContainer: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        marginHorizontal: 10,
    },
    placeholderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
});

export default RecipeCategory;