import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RecipeCard from './RecipeCard';
import { Recipe, getRecipesByMealType } from '../api/recipes';
import { RecipeCacheService } from '../services/RecipeCacheService';

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

// Function to format number of likes (1000 -> 1K)
const formatLikes = (likes: number): string => {
    if (!likes) return '0';
    if (likes >= 1000000) return `${(likes / 1000000).toFixed(1)}M`;
    if (likes >= 1000) return `${(likes / 1000).toFixed(1)}K`;
    return likes.toString();
};

interface RecipeCategoryProps {
    title: string;
    categoryId: string;
    icon: string;
    onRecipePress: (recipe: Recipe) => void;
}

const RecipeCategory: React.FC<RecipeCategoryProps> = ({
    title,
    categoryId,
    icon,
    onRecipePress
}) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                setLoading(true);

                // Try to get cached recipes first
                const cachedRecipes = await RecipeCacheService.getCachedCategoryRecipes(categoryId);

                if (cachedRecipes && cachedRecipes.length > 0) {
                    console.log(`🎯 Using cached ${categoryId} recipes to save API costs`);
                    setRecipes(cachedRecipes);
                    setLoading(false);
                    return;
                }

                // If no cache, fetch from API and cache the results
                console.log(`🌐 Fetching fresh ${categoryId} recipes from API`);
                const data = await getRecipesByMealType(categoryId, 4);

                if (data && data.length > 0) {
                    setRecipes(data);

                    // Cache the recipes for the rest of the day
                    await RecipeCacheService.cacheCategoryRecipes(categoryId, data);
                    console.log(`💾 ${categoryId} recipes cached for today`);
                }
            } catch (error) {
                console.error(`Error fetching ${categoryId} recipes:`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, [categoryId]);

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={icon as any} size={16} color={WHITE} />
                    </View>
                    <Text style={styles.title}>{title}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={PURPLE_ACCENT} />
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
                    <Ionicons name={icon as any} size={16} color={WHITE} />
                </View>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity style={styles.seeAllButton}>
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={16} color={PURPLE_ACCENT} />
                </TouchableOpacity>
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
                                    source={{ uri: recipe.image }}
                                    style={styles.recipeImage}
                                    imageStyle={styles.recipeImageStyle}
                                    resizeMode="cover"
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

                                                    {recipe.aggregateLikes && recipe.aggregateLikes > 0 && (
                                                        <View style={styles.likesContainer}>
                                                            <Ionicons name="thumbs-up" size={14} color="#2196F3" />
                                                            <Text style={[styles.metaText, { color: '#2196F3' }]}>
                                                                {formatLikes(recipe.aggregateLikes)}
                                                            </Text>
                                                        </View>
                                                    )}
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
});

export default RecipeCategory;