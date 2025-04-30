import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RecipeCard from './RecipeCard';
import { Recipe, getRecipesByMealType } from '../api/recipes';

// Define color constants for consistent theming
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

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
                const data = await getRecipesByMealType(categoryId, 4);
                setRecipes(data);
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
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {recipes.map((recipe) => (
                    <View key={recipe.id} style={styles.cardContainer}>
                        <RecipeCard
                            recipe={recipe}
                            onPress={onRecipePress}
                            compact={true}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
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
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    seeAllText: {
        color: PURPLE_ACCENT,
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        paddingLeft: 10,
        paddingRight: 20,
    },
    cardContainer: {
        width: 280,
        marginRight: 12,
    },
    loadingContainer: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default RecipeCategory;