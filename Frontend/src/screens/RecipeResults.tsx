import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp, ParamListBase, useFocusEffect } from '@react-navigation/native';
import RecipeCard from '../components/RecipeCard';
import { Recipe, searchRecipes } from '../api/recipes';

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

// Define route params interface
interface RecipeResultsParams {
    query?: string;
    cuisine?: string;
    diet?: string;
    maxReadyTime?: number;
}

export default function RecipeResults() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<Record<string, RecipeResultsParams>, string>>();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [noResults, setNoResults] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Function to search for recipes
    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setNoResults(false);

            console.log('🔍 Performing search for:', query);

            const results = await searchRecipes(query, 20);

            console.log('📊 Search results:', results.length, 'recipes found');

            if (results && results.length > 0) {
                setRecipes(results);
                setNoResults(false);
            } else {
                setRecipes([]);
                setNoResults(true);
            }
        } catch (error) {
            console.error('❌ Error searching recipes:', error);
            setRecipes([]);
            setNoResults(true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Perform search when component mounts or query changes
    useEffect(() => {
        const initializeSearch = async () => {
            try {
                // Get query from route params
                const routeQuery = route.params?.query;
                if (routeQuery) {
                    setSearchQuery(routeQuery);
                    setLoading(true);

                    console.log('Initializing search with query:', routeQuery);

                    // Perform search with the query (ignoring additional filters for now)
                    const results = await searchRecipes(routeQuery, 20);
                    setRecipes(results);

                    // Log results for debugging
                    console.log(`Found ${results.length} recipes for query: ${routeQuery}`);
                    if (results.length > 0) {
                        console.log('First recipe:', {
                            title: results[0].title,
                            hasIngredients: results[0].ingredients?.length > 0,
                            hasInstructions: Boolean(results[0].instructions)
                        });
                    }
                }
            } catch (error) {
                console.error('Error initializing search:', error);
                setError('Failed to load recipes. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        initializeSearch();
    }, [route.params?.query]);

    // Re-run search when screen comes into focus with a query
    useFocusEffect(
        useCallback(() => {
            console.log('RecipeResults screen focused, params:', route.params);
            if (route.params?.query && route.params.query !== searchQuery) {
                const query = route.params.query.trim();
                console.log('Focus effect running search with:', query);
                setSearchQuery(query);
                performSearch(query);
            }
        }, [route.params, searchQuery, performSearch])
    );

    // Handle search submission
    const handleSearch = () => {
        if (searchQuery.trim()) {
            performSearch(searchQuery);
            // Update route params to reflect the new search
            navigation.setParams({ query: searchQuery.trim() });
        }
    };

    // Handle recipe press
    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipeId: recipe.id });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recipe Results</Text>
                <View style={styles.placeholderButton} />
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={22} color={SUBDUED} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search recipes, ingredients..."
                    placeholderTextColor={SUBDUED}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                    <Text style={styles.loadingText}>Searching for recipes...</Text>
                </View>
            ) : noResults ? (
                <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={50} color={SUBDUED} />
                    <Text style={styles.emptyStateText}>No results found for "{searchQuery}"</Text>
                    <Text style={styles.emptyStateSubtext}>Try another search term</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollInner}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.resultsText}>
                        {recipes?.length || 0} {(recipes?.length || 0) === 1 ? 'result' : 'results'} for "{searchQuery}"
                    </Text>

                    {recipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            onPress={handleRecipePress}
                        />
                    ))}

                    {/* FatSecret Attribution */}
                    <View style={styles.attributionContainer}>
                        <Text
                            style={styles.attributionText}
                            onPress={() => {
                                Linking.openURL('https://www.fatsecret.com');
                            }}
                        >
                            Powered by fatsecret
                        </Text>
                    </View>
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
        paddingTop: Platform.OS === 'android' ? 50 : 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    backButton: {
        padding: 4,
    },
    placeholderButton: {
        width: 32,
        height: 32,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 10,
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
    scrollView: {
        flex: 1,
    },
    scrollInner: {
        padding: 16,
        paddingBottom: 40,
    },
    resultsText: {
        fontSize: 14,
        color: SUBDUED,
        marginBottom: 12,
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyStateText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 16,
    },
    emptyStateSubtext: {
        color: SUBDUED,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
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
        color: SUBDUED,
        textDecorationLine: 'underline',
        opacity: 0.8,
    },
}); 