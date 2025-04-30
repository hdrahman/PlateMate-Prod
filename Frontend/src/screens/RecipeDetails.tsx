import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image,
    TouchableOpacity, ActivityIndicator, SafeAreaView,
    Share, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getRecipeById, Recipe } from '../api/recipes';
import { LinearGradient } from 'expo-linear-gradient';

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

// Define the route params type
type RecipeDetailsParams = {
    recipeId?: string;
    recipe?: Recipe;
};

export default function RecipeDetails() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<Record<string, RecipeDetailsParams>, string>>();
    const [loading, setLoading] = useState(true);
    const [recipe, setRecipe] = useState<Recipe | null>(null);

    // Get the recipe ID from route params
    const recipeId = route.params?.recipeId;

    useEffect(() => {
        const fetchRecipeDetails = async () => {
            try {
                setLoading(true);

                // Check if we have a full recipe object in route params
                if (route.params?.recipe) {
                    setRecipe(route.params.recipe);
                    setLoading(false);
                    return;
                }

                // Otherwise load by ID
                if (recipeId) {
                    const recipeData = await getRecipeById(recipeId);
                    setRecipe(recipeData);
                }
            } catch (error) {
                console.error('Error fetching recipe details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipeDetails();
    }, [recipeId, route.params]);

    const handleShare = async () => {
        if (!recipe) return;

        try {
            await Share.share({
                message: `Check out this recipe for ${recipe.title}! ${recipe.sourceUrl || ''}`,
                title: recipe.title
            });
        } catch (error) {
            console.error('Error sharing recipe:', error);
        }
    };

    const handleOpenSource = async () => {
        if (!recipe?.sourceUrl) return;

        try {
            const canOpen = await Linking.canOpenURL(recipe.sourceUrl);
            if (canOpen) {
                await Linking.openURL(recipe.sourceUrl);
            }
        } catch (error) {
            console.error('Error opening source URL:', error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                <Text style={styles.loadingText}>Loading recipe details...</Text>
            </SafeAreaView>
        );
    }

    if (!recipe) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text style={styles.errorText}>Recipe not found</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                <View style={styles.header}>
                    <Image source={{ uri: recipe.image }} style={styles.headerImage} />
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                        style={styles.headerGradient}
                    />
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={WHITE} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.shareIconButton}
                        onPress={handleShare}
                    >
                        <Ionicons name="share-outline" size={24} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{recipe.title}</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Ionicons name="time-outline" size={20} color={PURPLE_ACCENT} />
                            <Text style={styles.infoLabel}>Time</Text>
                            <Text style={styles.infoValue}>{recipe.readyInMinutes} min</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Ionicons name="people-outline" size={20} color={PURPLE_ACCENT} />
                            <Text style={styles.infoLabel}>Servings</Text>
                            <Text style={styles.infoValue}>{recipe.servings}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Ionicons name="heart-outline" size={20} color={PURPLE_ACCENT} />
                            <Text style={styles.infoLabel}>Health</Text>
                            <Text style={styles.infoValue}>{recipe.healthScore}/100</Text>
                        </View>
                    </View>

                    {recipe.diets.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Dietary</Text>
                            <View style={styles.tagsContainer}>
                                {recipe.diets.map((diet, index) => (
                                    <View key={index} style={styles.tag}>
                                        <Text style={styles.tagText}>{diet}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.summaryText}>{recipe.summary}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ingredients</Text>
                        {recipe.ingredients.map((ingredient, index) => (
                            <View key={index} style={styles.ingredientItem}>
                                <Ionicons name="ellipse" size={8} color={PURPLE_ACCENT} style={styles.bullet} />
                                <Text style={styles.ingredientText}>{ingredient}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Instructions</Text>
                        <Text style={styles.instructionsText}>{recipe.instructions}</Text>
                    </View>

                    {recipe.sourceUrl && (
                        <TouchableOpacity
                            style={styles.sourceButton}
                            onPress={handleOpenSource}
                        >
                            <Text style={styles.sourceButtonText}>View Original Recipe</Text>
                            <Ionicons name="open-outline" size={18} color={WHITE} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.logButton}>
                        <Text style={styles.logButtonText}>Add to My Meals</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: PRIMARY_BG,
        padding: 20,
    },
    loadingText: {
        color: WHITE,
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        color: WHITE,
        fontSize: 16,
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: PURPLE_ACCENT,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    backButtonText: {
        color: WHITE,
        fontWeight: 'bold',
    },
    header: {
        position: 'relative',
        height: 250,
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    headerGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 100,
    },
    headerTitle: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    backIconButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareIconButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    infoItem: {
        alignItems: 'center',
    },
    infoLabel: {
        color: SUBDUED,
        fontSize: 12,
        marginTop: 4,
    },
    infoValue: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 2,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: PURPLE_ACCENT,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    summaryText: {
        color: WHITE,
        fontSize: 14,
        lineHeight: 22,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        color: PURPLE_ACCENT,
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    ingredientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    bullet: {
        marginRight: 8,
    },
    ingredientText: {
        color: WHITE,
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
    instructionsText: {
        color: WHITE,
        fontSize: 14,
        lineHeight: 22,
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        paddingVertical: 12,
        marginBottom: 16,
    },
    sourceButtonText: {
        color: WHITE,
        fontWeight: '600',
        marginRight: 6,
    },
    logButton: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: PURPLE_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    logButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
});