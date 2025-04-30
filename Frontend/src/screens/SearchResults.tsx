import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    FlatList, ActivityIndicator, TextInput, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp, ParamListBase } from '@react-navigation/native';
import RecipeCard from '../components/RecipeCard';
import { Recipe, searchRecipes, RecipeSearchParams } from '../api/recipes';

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

// Define the route params type
type SearchResultsParams = {
    query?: string;
    cuisine?: string;
    diet?: string;
    includeIngredients?: string[];
};

export default function SearchResults() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<Record<string, SearchResultsParams>, string>>();
    const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false);

    // Prepare search params from route
    const getSearchParams = (): RecipeSearchParams => {
        const params: RecipeSearchParams = {};

        if (route.params?.query) {
            params.query = route.params.query;
        } else if (searchQuery) {
            params.query = searchQuery;
        }

        if (route.params?.cuisine) {
            params.cuisine = route.params.cuisine;
        }

        if (route.params?.diet) {
            params.diet = route.params.diet;
        }

        if (route.params?.includeIngredients) {
            params.includeIngredients = route.params.includeIngredients;
        }

        return params;
    };

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                setLoading(true);
                const searchParams = getSearchParams();
                const results = await searchRecipes(searchParams);
                setRecipes(results);
            } catch (error) {
                console.error('Error searching for recipes:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, [route.params]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            setFiltering(true);
            const params = getSearchParams();
            const results = await searchRecipes(params);
            setRecipes(results);
        } catch (error) {
            console.error('Error searching for recipes:', error);
        } finally {
            setFiltering(false);
        }
    };

    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipe });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={SUBDUED} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search recipes, ingredients..."
                        placeholderTextColor={SUBDUED}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoFocus={!route.params?.query}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            style={styles.clearButton}
                        >
                            <Ionicons name="close-circle" size={20} color={SUBDUED} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.resultsContainer}>
                {(loading || filtering) ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                        <Text style={styles.loadingText}>Searching for recipes...</Text>
                    </View>
                ) : recipes.length > 0 ? (
                    <>
                        <Text style={styles.resultCount}>
                            {recipes.length} {recipes.length === 1 ? 'result' : 'results'} found
                        </Text>
                        <FlatList
                            data={recipes}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.recipeCardContainer}>
                                    <RecipeCard recipe={item} onPress={handleRecipePress} />
                                </View>
                            )}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                        />
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={60} color={SUBDUED} />
                        <Text style={styles.emptyText}>No recipes found</Text>
                        <Text style={styles.emptySubtext}>
                            Try different keywords or check your filters
                        </Text>
                    </View>
                )}
            </View>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        marginRight: 12,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchInput: {
        flex: 1,
        height: 36,
        color: WHITE,
        fontSize: 16,
        marginLeft: 8,
    },
    clearButton: {
        padding: 4,
    },
    resultsContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: WHITE,
        marginTop: 12,
        fontSize: 16,
    },
    resultCount: {
        color: SUBDUED,
        padding: 16,
        fontSize: 14,
    },
    listContent: {
        paddingHorizontal: 10,
        paddingBottom: 30,
    },
    recipeCardContainer: {
        marginBottom: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtext: {
        color: SUBDUED,
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
        marginHorizontal: 30,
    },
});