import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image,
    TouchableOpacity, ActivityIndicator, SafeAreaView,
    Share, Linking, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getRecipeById, Recipe } from '../api/recipes';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');

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
    const { theme, isDarkTheme } = useContext(ThemeContext);

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

    // Parse instructions into numbered steps
    const parseInstructions = (instructions: string) => {
        if (!instructions) return [];

        // Check if instructions are already in numbered format (1. Step one\n2. Step two)
        if (instructions.match(/^\d+\.\s+/m)) {
            // Split by newlines and filter out empty lines
            return instructions
                .split('\n')
                .filter(step => step.trim().length > 0)
                .map(step => {
                    // Remove the number prefix if it exists
                    return step.replace(/^\d+\.\s+/, '').trim();
                });
        }

        // Split by numbered steps (1., 2., etc.) or periods for basic splitting
        const steps = instructions
            .split(/\d+\.\s+/)
            .filter(step => step.trim().length > 0)
            .map(step => step.trim());

        // If no numbered steps found, try splitting by sentences
        if (steps.length <= 1) {
            return instructions
                .split(/\.\s+/)
                .filter(step => step.trim().length > 10)
                .map(step => step.trim() + (step.endsWith('.') ? '' : '.'));
        }

        return steps;
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading recipe details...</Text>
            </SafeAreaView>
        );
    }

    if (!recipe) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.errorText, { color: theme.colors.text }]}>Recipe not found</Text>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={[styles.backButtonText, { color: theme.colors.text }]}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const instructionSteps = parseInstructions(recipe.instructions);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with image and title */}
                <View style={styles.header}>
                    <Image source={{ uri: recipe.image }} style={styles.headerImage} />
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']}
                        style={styles.headerGradient}
                    />
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.shareIconButton}
                        onPress={handleShare}
                    >
                        <Ionicons name="share-outline" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{recipe.title}</Text>
                        {recipe.summary && (
                            <Text style={[styles.headerSubtitle, { color: theme.colors.text }]} numberOfLines={2}>
                                {recipe.summary.replace(/<[^>]*>/g, '').substring(0, 100)}...
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.content}>
                    {/* Quick Info Cards */}
                    <View style={styles.quickInfoContainer}>
                        <View style={[styles.infoCard, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                                <Ionicons name="time-outline" size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Cook Time</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>{recipe.readyInMinutes} min</Text>
                        </View>
                        <View style={[styles.infoCard, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                                <Ionicons name="people-outline" size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Servings</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>{recipe.servings}</Text>
                        </View>
                    </View>

                    {/* Dietary Tags */}
                    {recipe.diets && recipe.diets.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                                <Ionicons name="leaf-outline" size={20} color={theme.colors.primary} />
                                {' '}Dietary Information
                            </Text>
                            <View style={styles.tagsContainer}>
                                {recipe.diets.map((diet, index) => (
                                    <View key={index} style={[styles.tag, { backgroundColor: `${theme.colors.primary}20`, borderColor: theme.colors.border }]}>
                                        <Text style={[styles.tagText, { color: theme.colors.primary }]}>{diet}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Ingredients Section */}
                    <View style={styles.wideSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
                            {' '}Ingredients ({recipe.ingredients.length})
                        </Text>
                        <View style={[styles.ingredientsContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            {recipe.ingredients.map((ingredient, index) => (
                                <View key={index} style={[styles.ingredientItem, { borderBottomColor: theme.colors.border }]}>
                                    <View style={[styles.ingredientBullet, { backgroundColor: theme.colors.primary }]} />
                                    <Text style={[styles.ingredientText, { color: theme.colors.text }]}>{ingredient}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Instructions Section */}
                    <View style={styles.wideSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                            <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
                            {' '}Instructions
                        </Text>
                        <View style={[styles.instructionsContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            {instructionSteps.map((step, index) => (
                                <View key={index} style={[styles.instructionStep, { borderBottomColor: theme.colors.border }]}>
                                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                                        <Text style={[styles.stepNumberText, { color: theme.colors.text }]}>{index + 1}</Text>
                                    </View>
                                    <Text style={[styles.stepText, { color: theme.colors.text }]}>{step}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsContainer}>
                        {recipe.sourceUrl && (
                            <TouchableOpacity
                                style={[styles.sourceButton, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
                                onPress={handleOpenSource}
                            >
                                <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
                                <Text style={[styles.sourceButtonText, { color: theme.colors.primary }]}>View Original Recipe</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.logButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
                            <Ionicons name="add-circle-outline" size={20} color={theme.colors.text} />
                            <Text style={[styles.logButtonText, { color: theme.colors.text }]}>Add to My Meals</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    backButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    backButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    header: {
        position: 'relative',
        height: 320,
    },
    headerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    headerGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 140,
    },
    headerTitleContainer: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.9,
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    backIconButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareIconButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
    },
    quickInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 28,
        gap: 12,
    },
    infoCard: {
        flex: 1,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 13,
        marginBottom: 4,
        textAlign: 'center',
    },
    infoValue: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 2,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    ingredientsContainer: {
        borderRadius: 16,
        padding: 24,
        marginHorizontal: -10,
        borderWidth: 2,
    },
    ingredientItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    ingredientBullet: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        marginRight: 16,
    },
    ingredientText: {
        fontSize: 15,
        lineHeight: 22,
        flex: 1,
    },
    instructionsContainer: {
        borderRadius: 16,
        padding: 24,
        marginHorizontal: -10,
        borderWidth: 2,
    },
    instructionStep: {
        flexDirection: 'row',
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginTop: 2,
    },
    stepNumberText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    stepText: {
        fontSize: 15,
        lineHeight: 24,
        flex: 1,
    },
    actionsContainer: {
        gap: 16,
        marginBottom: 40,
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 16,
        borderWidth: 2,
        gap: 8,
    },
    sourceButtonText: {
        fontWeight: '600',
        fontSize: 16,
    },
    logButton: {
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        borderWidth: 2,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    logButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    wideSection: {
        marginBottom: 32,
    },
});