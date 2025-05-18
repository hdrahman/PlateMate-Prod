import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    FlatList,
    Image,
    Alert,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FoodItem from '../components/FoodItem';
import FoodDetails from '../components/FoodDetails';
import ManualFoodEntry from '../components/ManualFoodEntry';
import { searchFatSecretFood, getFatSecretFoodDetails } from '../api';
import { getRecentFoodEntries, addFoodEntry, FoodLogEntry } from '../api/foodLog';
import { debounce } from 'lodash';

// Define navigation type
type RootStackParamList = {
    FoodLog: { refresh?: number };
    Manual: undefined;
};
type NavigationProp = StackNavigationProp<RootStackParamList>;

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';

export default function Manual() {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [recentEntries, setRecentEntries] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFood, setSelectedFood] = useState(null);
    const [showFoodDetails, setShowFoodDetails] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [foodCategories, setFoodCategories] = useState([
        'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Fruits', 'Vegetables', 'Protein'
    ]);

    // Load recent entries when component mounts
    useEffect(() => {
        loadRecentEntries();
    }, []);

    // Load recent food entries
    const loadRecentEntries = async () => {
        setIsLoading(true);
        try {
            const entries = await getRecentFoodEntries(10);
            setRecentEntries(entries);
        } catch (error) {
            console.error('Error loading recent entries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle search query changes
    const handleSearchChange = (text) => {
        setSearchQuery(text);
        if (text.length > 2) {
            setIsSearching(true);
            debouncedSearch(text);
        } else {
            setIsSearching(false);
            setSearchResults([]);
        }
    };

    // Debounced search to prevent too many API calls
    const debouncedSearch = useCallback(
        debounce(async (query) => {
            try {
                // Use FatSecret API for all searches
                const results = await searchFatSecretFood(query);
                console.log("Search results:", results.length);
                setSearchResults(results);
            } catch (error) {
                console.error('Error searching for food:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500),
        []
    );

    // Handle pull-to-refresh
    const onRefresh = async () => {
        setRefreshing(true);
        await loadRecentEntries();
        setRefreshing(false);
    };

    // Handle selecting a food item
    const handleFoodSelect = async (food) => {
        try {
            setIsLoading(true);

            // If we have a FatSecret ID, get detailed info
            if (food.notes?.includes('FatSecret')) {
                const foodId = food.notes.split('FatSecret ID: ')[1];
                if (foodId) {
                    // Get detailed info from FatSecret API
                    const detailedFood = await getFatSecretFoodDetails(foodId);
                    if (detailedFood) {
                        setSelectedFood(detailedFood);
                        setShowFoodDetails(true);
                        setIsLoading(false);
                        return;
                    }
                }
            }

            // Use whatever info we have
            setSelectedFood(food);
            setShowFoodDetails(true);
        } catch (error) {
            console.error('Error getting food details:', error);
            setSelectedFood(food);
            setShowFoodDetails(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle adding food to log
    const handleAddFood = async (food, mealType, quantity) => {
        try {
            setIsLoading(true);
            await addFoodEntry(food, mealType, quantity);
            Alert.alert('Success', `Added ${food.food_name} to your ${mealType} log`, [
                {
                    text: 'OK',
                    onPress: async () => {
                        // Add a small delay to ensure database operations complete
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Refresh recent entries
                        await loadRecentEntries();

                        // Hide food details modal
                        setShowFoodDetails(false);

                        // Navigate back to FoodLog with refresh parameter
                        navigation.navigate('FoodLog', { refresh: Date.now() });
                    }
                }
            ]);
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Render food category item
    const renderFoodCategory = ({ item }) => (
        <TouchableOpacity style={styles.categoryItem}>
            <Text style={styles.categoryText}>{item}</Text>
        </TouchableOpacity>
    );

    // Render recent entry item
    const renderRecentEntry = ({ item }) => (
        <TouchableOpacity style={styles.recentEntryItem}>
            <View style={styles.recentEntryImageContainer}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.recentEntryImage} />
                ) : (
                    <Ionicons name="restaurant-outline" size={24} color={GRAY} />
                )}
            </View>
            <View style={styles.recentEntryDetails}>
                <Text style={styles.recentEntryName}>{item.food_name}</Text>
                <Text style={styles.recentEntryInfo}>
                    {item.meal_type} • {item.calories} cal
                </Text>
            </View>
            <View style={styles.macroSummary}>
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{item.proteins}g</Text>
                    <Text style={styles.macroLabel}>P</Text>
                </View>
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{item.carbs}g</Text>
                    <Text style={styles.macroLabel}>C</Text>
                </View>
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{item.fats}g</Text>
                    <Text style={styles.macroLabel}>F</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.mainContainer, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

            {/* Loading Indicator */}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={BLUE_ACCENT} />
                </View>
            )}

            {/* Food Details Modal */}
            {selectedFood && (
                <FoodDetails
                    food={selectedFood}
                    visible={showFoodDetails}
                    onClose={() => setShowFoodDetails(false)}
                    onAddFood={handleAddFood}
                />
            )}

            {/* Manual Food Entry Modal */}
            <ManualFoodEntry
                visible={showManualEntry}
                onClose={() => setShowManualEntry(false)}
                onAddFood={handleAddFood}
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Food Search</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={GRAY} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for a food..."
                        placeholderTextColor={GRAY}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => {
                                setSearchQuery('');
                                setIsSearching(false);
                                setSearchResults([]);
                            }}
                        >
                            <Ionicons name="close-circle" size={20} color={GRAY} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Main Content */}
            {isSearching ? (
                <View style={styles.searchingContainer}>
                    <ActivityIndicator size="small" color={BLUE_ACCENT} />
                    <Text style={styles.searchingText}>Searching...</Text>
                </View>
            ) : searchQuery.length > 2 && searchResults.length === 0 ? (
                // No results found
                <View style={styles.emptySearchContainer}>
                    <Ionicons name="search-outline" size={48} color={GRAY} />
                    <Text style={styles.emptySearchText}>No results found for "{searchQuery}"</Text>
                    <Text style={styles.emptySearchSubtext}>Try a different search term</Text>
                </View>
            ) : searchResults.length > 0 ? (
                // Search Results
                <FlatList
                    data={searchResults}
                    keyExtractor={(item, index) => `${item.food_name}-${index}`}
                    renderItem={({ item }) => (
                        <FoodItem item={item} onPress={handleFoodSelect} />
                    )}
                    contentContainerStyle={styles.searchResultsContainer}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                // Regular Content (when not searching)
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {/* Food Categories */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Categories</Text>
                        <FlatList
                            data={foodCategories}
                            renderItem={renderFoodCategory}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoriesContainer}
                            keyExtractor={(item) => item}
                        />
                    </View>

                    {/* Recent Entries */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Entries</Text>
                        {recentEntries.length > 0 ? (
                            recentEntries.map((entry, index) => (
                                <TouchableOpacity
                                    key={`entry-${index}`}
                                    onPress={() => handleFoodSelect(entry)}
                                >
                                    {renderRecentEntry({ item: entry })}
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="add-circle-outline" size={40} color={GRAY} />
                                <Text style={styles.emptyStateText}>Add food entries to see them here</Text>
                                <TouchableOpacity
                                    style={styles.startNowButton}
                                    onPress={() => setShowManualEntry(true)}
                                >
                                    <Text style={styles.startNowText}>START NOW</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Quick-Add Meals */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick-Add Meal</Text>
                        <TouchableOpacity style={styles.quickAddButton}>
                            <Ionicons name="camera-outline" size={24} color={WHITE} style={styles.quickAddIcon} />
                            <Text style={styles.quickAddText}>SCAN WITH CAMERA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAddButton}>
                            <Ionicons name="barcode-outline" size={24} color={WHITE} style={styles.quickAddIcon} />
                            <Text style={styles.quickAddText}>SCAN BARCODE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickAddButton}
                            onPress={() => setShowManualEntry(true)}
                        >
                            <Ionicons name="create-outline" size={24} color={WHITE} style={styles.quickAddIcon} />
                            <Text style={styles.quickAddText}>MANUAL ENTRY</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Nutrition Tips */}
                    <View style={[styles.section, styles.tipSection]}>
                        <Text style={styles.tipTitle}>Nutrition Tip</Text>
                        <Text style={styles.tipText}>
                            Track your meals consistently for better results. Aim to log everything you eat for the most accurate nutrition insights.
                        </Text>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        color: WHITE,
        fontSize: 16,
    },
    clearButton: {
        padding: 8,
    },
    searchingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 50,
    },
    searchingText: {
        color: WHITE,
        marginTop: 10,
        fontSize: 16,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    categoriesContainer: {
        paddingBottom: 10,
    },
    categoryItem: {
        backgroundColor: CARD_BG,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    categoryText: {
        color: WHITE,
        fontSize: 14,
        fontWeight: '500',
    },
    recentEntryItem: {
        flexDirection: 'row',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    recentEntryImageContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: LIGHT_GRAY,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    recentEntryImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    recentEntryDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    recentEntryName: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    recentEntryInfo: {
        color: GRAY,
        fontSize: 14,
    },
    macroSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 80,
    },
    macroItem: {
        alignItems: 'center',
        marginHorizontal: 4,
    },
    macroValue: {
        color: WHITE,
        fontSize: 14,
        fontWeight: 'bold',
    },
    macroLabel: {
        color: GRAY,
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
    },
    emptyStateText: {
        color: GRAY,
        marginTop: 10,
        fontSize: 16,
        textAlign: 'center',
    },
    startNowButton: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: BLUE_ACCENT,
        borderRadius: 8,
    },
    startNowText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 14,
    },
    customButton: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    customButtonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    customButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    quickAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        padding: 14,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    quickAddIcon: {
        marginRight: 10,
    },
    quickAddText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '500',
    },
    tipSection: {
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    tipTitle: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    tipText: {
        color: GRAY,
        fontSize: 14,
        lineHeight: 20,
    },
    searchResultsContainer: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    emptySearchContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptySearchText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySearchSubtext: {
        color: GRAY,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
}); 