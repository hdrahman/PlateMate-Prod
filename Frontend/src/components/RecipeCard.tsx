import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, GestureResponderEvent, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';

interface RecipeCardProps {
    recipe: Recipe;
    onPress?: (recipe: Recipe) => void;
    compact?: boolean;
}

// Function to determine the color based on health score
const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green for excellent
    if (score >= 60) return '#8BC34A'; // Light green for good
    if (score >= 40) return '#FFEB3B'; // Yellow for moderate
    if (score >= 20) return '#FF9800'; // Orange for fair
    return '#F44336'; // Red for poor
};

// Function to get a human-readable health score label
const getHealthScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Fair';
    return 'Poor';
};

// Function to format the likes count
const formatLikes = (likes: number): string => {
    if (likes >= 1000000) return (likes / 1000000).toFixed(1) + 'M';
    if (likes >= 1000) return (likes / 1000).toFixed(1) + 'K';
    return likes.toString();
};

const MAX_RETRIES = 2; // Maximum number of retries for image loading

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress, compact = false }) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const recipeId = recipe.id?.toString() || '';
    const isFav = isFavorite(recipeId);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [imageRetries, setImageRetries] = useState(0);
    const [currentImageUrl, setCurrentImageUrl] = useState(recipe.image || '');

    const handleFavoritePress = async (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (isFav) {
            await removeFavorite(recipeId);
        } else {
            await addFavorite(recipe);
        }
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    const handleImageError = () => {
        const recipeTitle = recipe.title || 'Unknown Recipe';
        console.error(`Error loading image for recipe: ${recipeTitle} (ID: ${recipeId}), URL: ${currentImageUrl}, Retry: ${imageRetries}`);

        // If we've reached max retries, mark as error and use fallback
        if (imageRetries >= MAX_RETRIES) {
            setImageLoading(false);
            setImageError(true);
            return;
        }

        // Increment retry count
        const newRetryCount = imageRetries + 1;
        setImageRetries(newRetryCount);

        // Try a different image URL format
        let newImageUrl;
        if (newRetryCount === 1) {
            // First retry: Try Spoonacular format with 556x370
            newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
        } else {
            // Second retry: Try 636x393 format
            newImageUrl = `https://spoonacular.com/recipeImages/${recipeId}-636x393.jpg`;
        }

        console.log(`Retrying with new image URL for ${recipeTitle}: ${newImageUrl}`);
        setCurrentImageUrl(newImageUrl);
    };

    // Use the image from the API, with validation and fallbacks
    const getImageSource = () => {
        // If we've already determined this image has errors after retries
        if (imageError) {
            // Try to determine an appropriate category-based fallback
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

        // Use current image URL (which may be the original or a retry URL)
        if (currentImageUrl && typeof currentImageUrl === 'string' && currentImageUrl.startsWith('http')) {
            return currentImageUrl;
        }

        // If the current image is invalid but we have a recipe ID, generate a URL
        if (recipe.id) {
            return `https://spoonacular.com/recipeImages/${recipeId}-556x370.jpg`;
        }

        // Last resort fallback
        return 'https://spoonacular.com/recipeImages/default-food.jpg';
    };

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.colors.cardBackground }, compact && styles.compactCard]}
            onPress={() => onPress && onPress(recipe)}
            activeOpacity={0.7}
        >
            <View style={[styles.imageContainer, { backgroundColor: theme.colors.cardBackground }]}>
                {imageLoading && (
                    <View style={[
                        styles.imageLoadingContainer,
                        compact && styles.compactImageLoadingContainer
                    ]}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                )}
                <Image
                    source={{ uri: getImageSource() }}
                    style={[
                        styles.image,
                        { backgroundColor: theme.colors.cardBackground },
                        compact && styles.compactImage,
                        { opacity: imageLoading ? 0 : 1 }
                    ]}
                    resizeMode="cover"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    fadeDuration={200}
                />



                <View style={styles.healthScoreBadge}>
                    <LinearGradient
                        colors={[getHealthScoreColor(recipe.healthScore), getHealthScoreColor(recipe.healthScore) + '99']}
                        style={styles.healthScoreGradient}
                    >
                        <Ionicons name="heart" size={compact ? 12 : 14} color={theme.colors.text} />
                        <Text style={[styles.healthScoreText, { color: theme.colors.text }]}>{recipe.healthScore}</Text>
                    </LinearGradient>
                </View>

                {(recipe.aggregateLikes && recipe.aggregateLikes > 0) && (
                    <View style={styles.popularityBadge}>
                        <LinearGradient
                            colors={['#2196F3', '#03A9F4']}
                            style={styles.popularityGradient}
                        >
                            <Ionicons name="thumbs-up" size={compact ? 12 : 14} color={theme.colors.text} />
                            <Text style={[styles.popularityText, { color: theme.colors.text }]}>{formatLikes(recipe.aggregateLikes)}</Text>
                        </LinearGradient>
                    </View>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                    {recipe.title}
                </Text>

                {!compact && (
                    <Text style={[styles.summary, { color: theme.colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
                        {recipe.summary}
                    </Text>
                )}

                <View style={styles.metaContainer}>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={compact ? 14 : 16} color={theme.colors.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{recipe.readyInMinutes} min</Text>
                    </View>

                    <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={compact ? 14 : 16} color={theme.colors.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{recipe.servings} serv</Text>
                    </View>

                    {!compact && (
                        <View style={styles.healthScoreLabel}>
                            <Text style={[
                                styles.healthScoreLabelText,
                                { color: getHealthScoreColor(recipe.healthScore) }
                            ]}>
                                {getHealthScoreLabel(recipe.healthScore)}
                            </Text>
                        </View>
                    )}
                </View>

                {!compact && recipe.diets.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {recipe.diets.slice(0, 3).map((diet, index) => (
                            <View key={index} style={[styles.tag, { backgroundColor: theme.colors.primary + '33' }]}>
                                <Text style={[styles.tagText, { color: theme.colors.primary }]}>{diet}</Text>
                            </View>
                        ))}
                        {recipe.diets.length > 3 && (
                            <Text style={[styles.moreTag, { color: theme.colors.textSecondary }]}>+{recipe.diets.length - 3}</Text>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: '100%',
    },
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 100,
    },
    imageContainer: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
    },
    image: {
        width: '100%',
        height: 160,
        borderRadius: 8,
    },
    compactImage: {
        width: 80,
        height: '100%',
        borderRadius: 8,
    },
    imageLoadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactImageLoadingContainer: {
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactPlaceholderOverlay: {
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    favoriteButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    healthScoreBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        borderRadius: 12,
        overflow: 'hidden',
    },
    healthScoreGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    healthScoreText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    popularityBadge: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        borderRadius: 12,
        overflow: 'hidden',
    },
    popularityGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    popularityText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    infoContainer: {
        padding: 12,
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    summary: {
        fontSize: 14,
        marginBottom: 8,
    },
    metaContainer: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 14,
    },
    metaText: {
        fontSize: 12,
        marginLeft: 4,
    },
    healthScoreLabel: {
        marginLeft: 'auto',
    },
    healthScoreLabelText: {
        fontSize: 13,
        fontWeight: '600',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginRight: 6,
        marginBottom: 6,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    moreTag: {
        fontSize: 10,
        marginLeft: 4,
        alignSelf: 'center',
    },
});

export default RecipeCard;