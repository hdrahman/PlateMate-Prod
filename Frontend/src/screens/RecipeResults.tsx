import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp, ParamListBase } from '@react-navigation/native';
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
    query: string;
}

export default function RecipeResults() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<Record<string, RecipeResultsParams>, string>>();
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [noResults, setNoResults] = useState<boolean>(false);

    useEffect(() => {
        // Get search query from navigation params
        if (route.params?.query) {
            const query = route.params.query.trim();
            setSearchQuery(query);
            performSearch(query);
        } else {
            setLoading(false);
        }
    }, [route.params?.query]);

    // Function to search for recipes
    const performSearch = async (query: string) => {
        try {
            setLoading(true);
            setNoResults(false);

            console.log('🔍 Performing search for:', query);

            const results = await searchRecipes({
                query,
                number: 20
            });

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
    };

    // Handle search submission
    const handleSearch = () => {
        if (searchQuery.trim()) {
            performSearch(searchQuery);
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
                        {recipes.length} {recipes.length === 1 ? 'result' : 'results'} for "{searchQuery}"
                    </Text>

                    {recipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            onPress={handleRecipePress}
                        />
                    ))}
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
}); 