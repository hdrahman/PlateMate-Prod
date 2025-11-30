import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, TextInput, StatusBar, Platform, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp, ParamListBase } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import RecipeCard from '../components/RecipeCard';
import { Recipe, searchRecipes } from '../api/recipes';
import { ThemeContext } from '../ThemeContext';

// Define the route params type
type SearchResultsParams = {
    query?: string;
    cuisine?: string;
    diet?: string;
    includeIngredients?: string[];
};

// GradientBorderCard component for consistent card styling
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps & { cardBackgroundColor: string }> = ({ children, style, cardBackgroundColor }) => {
    return (
        <View style={[styles.gradientBorderContainer, style]}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 10,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1,
                    borderRadius: 9,
                    backgroundColor: cardBackgroundColor,
                    padding: 16,
                    flex: 1,
                }}
            >
                {children}
            </View>
        </View>
    );
};

export default function SearchResults() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<Record<string, SearchResultsParams>, string>>();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtering, setFiltering] = useState(false);
    const inputRef = React.useRef<TextInput>(null);

    // Delayed focus to prevent keyboard stealing issues
    useEffect(() => {
        if (!route.params?.query) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [route.params?.query]);

    const handleSearchSubmit = async () => {
        if (!searchQuery.trim()) return;

        try {
            setFiltering(true);
            const query = route.params?.query || searchQuery;
            const results = await searchRecipes(query, 20);
            setRecipes(results);
        } catch (error) {
            console.error('Error searching for recipes:', error);
        } finally {
            setFiltering(false);
        }
    };

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                setLoading(true);
                const query = route.params?.query || searchQuery;
                const results = await searchRecipes(query, 20);
                setRecipes(results);
            } catch (error) {
                console.error('Error searching for recipes:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, [route.params]);



    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetails', { recipe });
    };



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>

                <GradientBorderCard style={styles.searchContainerWrapper} cardBackgroundColor={theme.colors.cardBackground}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
                        <TextInput
                            ref={inputRef}
                            style={[styles.searchInput, { color: theme.colors.text }]}
                            placeholder="Search recipes, ingredients..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setSearchQuery('')}
                                style={styles.clearButton}
                            >
                                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </GradientBorderCard>
            </View>

            <View style={styles.resultsContainer}>
                {(loading || filtering) ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Searching for recipes...</Text>
                    </View>
                ) : recipes.length > 0 ? (
                    <>
                        <Text style={[styles.resultCount, { color: theme.colors.textSecondary }]}>
                            {recipes.length} {recipes.length === 1 ? 'result' : 'results'} found
                        </Text>
                        <FlatList
                            data={recipes}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.recipeCardContainer}>
                                    <RecipeCard recipe={item} onPress={handleRecipePress} />
                                </View>
                            )}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                            ListFooterComponent={() => (
                                <View style={styles.attributionContainer}>
                                    <Text
                                        style={[styles.attributionText, { color: theme.colors.textSecondary }]}
                                        onPress={() => {
                                            Linking.openURL('https://www.fatsecret.com');
                                        }}
                                    >
                                        Powered by fatsecret
                                    </Text>
                                </View>
                            )}
                        />
                    </>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={60} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.text }]}>No recipes found</Text>
                        <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                            Try different keywords or check your filters
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => navigation.goBack()}
                        >
                            <LinearGradient
                                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>Go Back</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    searchContainerWrapper: {
        flex: 1,
        height: 50,
        padding: 0,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    searchInput: {
        flex: 1,
        height: 36,
        fontSize: 16,
        marginLeft: 8,
    },
    clearButton: {
        padding: 4,
    },
    resultsContainer: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    resultCount: {
        fontSize: 14,
        marginBottom: 16,
    },
    recipeCardContainer: {
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        width: '60%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        marginTop: 16,
    },
    gradientButton: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    gradientBorderContainer: {
        borderRadius: 10,
        overflow: 'hidden',
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
        textDecorationLine: 'underline',
        opacity: 0.8,
    },
});