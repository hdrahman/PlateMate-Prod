import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, GestureResponderEvent, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';
import { LinearGradient } from 'expo-linear-gradient';

// Define color constants for consistent theming
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

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

// Fallback food images for different meal types
const getFallbackImage = (title: string): string => {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('breakfast') || titleLower.includes('pancake') || titleLower.includes('egg') || titleLower.includes('oatmeal')) {
        return 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('salad') || titleLower.includes('vegetable') || titleLower.includes('green')) {
        return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('pasta') || titleLower.includes('spaghetti') || titleLower.includes('noodle')) {
        return 'https://images.unsplash.com/photo-1551892589-865f69869476?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('chicken') || titleLower.includes('meat') || titleLower.includes('beef')) {
        return 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('soup') || titleLower.includes('broth')) {
        return 'https://images.unsplash.com/photo-1547592180-85f7d2b5c2b8?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('pizza')) {
        return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('burger') || titleLower.includes('sandwich')) {
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&crop=center';
    } else if (titleLower.includes('dessert') || titleLower.includes('cake') || titleLower.includes('sweet')) {
        return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop&crop=center';
    }

    // Default fallback
    return 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop&crop=center';
};

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress, compact = false }) => {
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const isFav = isFavorite(recipe.id);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const handleFavoritePress = async (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (isFav) {
            await removeFavorite(recipe.id);
        } else {
            await addFavorite(recipe);
        }
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    const handleImageError = () => {
        setImageLoading(false);
        setImageError(true);
    };

    // Determine which image to show
    const getImageSource = () => {
        if (imageError || !recipe.image) {
            return getFallbackImage(recipe.title);
        }
        return recipe.image;
    };

    return (
        <TouchableOpacity
            style={[styles.card, compact && styles.compactCard]}
            onPress={() => onPress && onPress(recipe)}
            activeOpacity={0.7}
        >
            <View style={styles.imageContainer}>
                {imageLoading && (
                    <View style={[
                        styles.imageLoadingContainer,
                        compact && styles.compactImageLoadingContainer
                    ]}>
                        <ActivityIndicator size="small" color={PURPLE_ACCENT} />
                    </View>
                )}
                <Image
                    source={{ uri: getImageSource() }}
                    style={[
                        styles.image,
                        compact && styles.compactImage,
                        { opacity: imageLoading ? 0 : 1 }
                    ]}
                    resizeMode="cover"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    fadeDuration={200}
                />
                {!recipe.image && !imageLoading && (
                    <View style={[
                        styles.placeholderOverlay,
                        compact && styles.compactPlaceholderOverlay
                    ]}>
                        <Ionicons name="restaurant" size={compact ? 16 : 24} color={WHITE} style={{ opacity: 0.6 }} />
                    </View>
                )}
                <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={handleFavoritePress}
                >
                    <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={22}
                        color={isFav ? "#FF4081" : WHITE}
                    />
                </TouchableOpacity>

                <View style={styles.healthScoreBadge}>
                    <LinearGradient
                        colors={[getHealthScoreColor(recipe.healthScore), getHealthScoreColor(recipe.healthScore) + '99']}
                        style={styles.healthScoreGradient}
                    >
                        <Ionicons name="heart" size={compact ? 12 : 14} color={WHITE} />
                        <Text style={styles.healthScoreText}>{recipe.healthScore}</Text>
                    </LinearGradient>
                </View>

                {(recipe.aggregateLikes && recipe.aggregateLikes > 0) && (
                    <View style={styles.popularityBadge}>
                        <LinearGradient
                            colors={['#2196F3', '#03A9F4']}
                            style={styles.popularityGradient}
                        >
                            <Ionicons name="thumbs-up" size={compact ? 12 : 14} color={WHITE} />
                            <Text style={styles.popularityText}>{formatLikes(recipe.aggregateLikes)}</Text>
                        </LinearGradient>
                    </View>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                    {recipe.title}
                </Text>

                {!compact && (
                    <Text style={styles.summary} numberOfLines={2} ellipsizeMode="tail">
                        {recipe.summary}
                    </Text>
                )}

                <View style={styles.metaContainer}>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={compact ? 14 : 16} color={SUBDUED} />
                        <Text style={styles.metaText}>{recipe.readyInMinutes} min</Text>
                    </View>

                    <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={compact ? 14 : 16} color={SUBDUED} />
                        <Text style={styles.metaText}>{recipe.servings} serv</Text>
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
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{diet}</Text>
                            </View>
                        ))}
                        {recipe.diets.length > 3 && (
                            <Text style={styles.moreTag}>+{recipe.diets.length - 3}</Text>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: CARD_BG,
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
        backgroundColor: '#1a1a1a', // Dark background for better contrast
        overflow: 'hidden',
        borderRadius: 8,
    },
    image: {
        width: '100%',
        height: 160,
        backgroundColor: '#1a1a1a', // Background color for image loading
        borderRadius: 8,
    },
    compactImage: {
        width: 80,
        height: '100%',
        backgroundColor: '#1a1a1a', // Background color for image loading
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
        color: WHITE,
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
        color: WHITE,
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
        color: WHITE,
        marginBottom: 6,
    },
    summary: {
        fontSize: 14,
        color: SUBDUED,
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
        color: SUBDUED,
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
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginRight: 6,
        marginBottom: 6,
    },
    tagText: {
        color: PURPLE_ACCENT,
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    moreTag: {
        color: SUBDUED,
        fontSize: 10,
        marginLeft: 4,
        alignSelf: 'center',
    },
});

export default RecipeCard;