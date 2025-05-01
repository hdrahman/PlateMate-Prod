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
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import FoodItem from '../components/FoodItem';
import FoodDetails from '../components/FoodDetails';
import { searchFood, FoodItem as FoodItemType, getFoodDetails, enhanceFoodImage } from '../api/nutritionix';
import { getRecentFoodEntries, addFoodEntry, FoodLogEntry } from '../api/foodLog';
import { debounce } from 'lodash';

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';

export default function Manual() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FoodItemType[]>([]);
    const [recentEntries, setRecentEntries] = useState<FoodLogEntry[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodItemType | null>(null);
    const [showFoodDetails, setShowFoodDetails] = useState(false);
    const [foodCategories, setFoodCategories] = useState<string[]>([
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
    const handleSearchChange = (text: string) => {
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
        debounce(async (query: string) => {
            try {
                // Set minimum healthiness rating to 8.5 to only show very healthy foods
                let results = await searchFood(query, 8.5);

                // Enhance images for all search results
                if (results.length > 0) {
                    const enhancedResults = await Promise.all(
                        results.map(async (food) => await enhanceFoodImage(food))
                    );
                    results = enhancedResults;
                }

                setSearchResults(results);
            } catch (error) {
                console.error('Error searching for food:', error);
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
    const handleFoodSelect = async (food: FoodItemType) => {
        try {
            setIsLoading(true);
            // Get more detailed information if available
            const detailedFood = await getFoodDetails(food.food_name);

            // Try to enhance the food image with a better quality one
            const enhancedFood = detailedFood || food;
            const foodWithBetterImage = await enhanceFoodImage(enhancedFood);

            setSelectedFood(foodWithBetterImage);
            setShowFoodDetails(true);
        } catch (error) {
            console.error('Error getting food details:', error);

            // Fallback to original food if enhancement fails
            const foodWithBetterImage = await enhanceFoodImage(food);
            setSelectedFood(foodWithBetterImage);
            setShowFoodDetails(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle adding food to log
    const handleAddFood = async (food: FoodItemType, mealType: string, quantity: number) => {
        try {
            setIsLoading(true);
            await addFoodEntry(food, mealType, quantity);
            Alert.alert('Success', `Added ${food.food_name} to your ${mealType} log`);
            setShowFoodDetails(false);
            // Refresh recent entries
            await loadRecentEntries();
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Navigate to create custom food
    const handleCreateCustomFood = () => {
        // This would navigate to a custom food creation screen
        Alert.alert('Coming Soon', 'Custom food creation feature is coming soon!');
    };

    // Render food category item
    const renderFoodCategory = ({ item }: { item: string }) => (
        <TouchableOpacity style={styles.categoryItem}>
            <Text style={styles.categoryText}>{item}</Text>
        </TouchableOpacity>
    );

    // Render recent entry item
    const renderRecentEntry = ({ item }: { item: FoodLogEntry }) => (
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

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

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manual Entry</Text>
                <View style={{ width: 28 }} />
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
                                <View key={`entry-${index}`}>
                                    {renderRecentEntry({ item: entry })}
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="time-outline" size={40} color={GRAY} />
                                <Text style={styles.emptyStateText}>Your recent entries will appear here</Text>
                            </View>
                        )}
                    </View>

                    {/* Popular Foods */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Popular Foods</Text>
                        <View style={styles.popularFoodsGrid}>
                            {['Spinach', 'Broccoli', 'Salmon', 'Kale'].map((food, index) => (
                                <TouchableOpacity
                                    key={`popular-${index}`}
                                    style={styles.popularFoodItem}
                                    onPress={async () => {
                                        const results = await searchFood(food, 8.5);
                                        if (results.length > 0) {
                                            handleFoodSelect(results[0]);
                                        }
                                    }}
                                >
                                    <View style={styles.popularFoodIcon}>
                                        <Ionicons name="nutrition" size={24} color={WHITE} />
                                    </View>
                                    <Text style={styles.popularFoodName}>{food}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Create Custom Food */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Create Custom Food</Text>
                        <TouchableOpacity style={styles.customButton} onPress={handleCreateCustomFood}>
                            <LinearGradient
                                colors={["#5A60EA", "#FF00F5"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.customButtonGradient}
                            >
                                <Text style={styles.customButtonText}>CREATE CUSTOM FOOD</Text>
                            </LinearGradient>
                        </TouchableOpacity>
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
        paddingVertical: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: WHITE,
        fontSize: 16,
    },
    clearButton: {
        padding: 6,
    },
    searchingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    searchingText: {
        color: WHITE,
        marginLeft: 10,
        fontSize: 16,
    },
    searchResultsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    content: {
        flex: 1,
    },
    section: {
        margin: 16,
        marginTop: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 12,
    },
    categoriesContainer: {
        paddingRight: 16,
    },
    categoryItem: {
        backgroundColor: CARD_BG,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
    },
    categoryText: {
        color: WHITE,
        fontWeight: '500',
    },
    foodItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
    },
    foodName: {
        fontSize: 16,
        color: WHITE,
    },
    recentEntryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    recentEntryImageContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: LIGHT_GRAY,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    recentEntryImage: {
        width: '100%',
        height: '100%',
        borderRadius: 25,
    },
    recentEntryDetails: {
        flex: 1,
    },
    recentEntryName: {
        fontSize: 16,
        fontWeight: '500',
        color: WHITE,
        marginBottom: 4,
    },
    recentEntryInfo: {
        fontSize: 14,
        color: GRAY,
    },
    macroSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    macroItem: {
        alignItems: 'center',
        marginHorizontal: 4,
        minWidth: 25,
    },
    macroValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: WHITE,
    },
    macroLabel: {
        fontSize: 12,
        color: GRAY,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 32,
    },
    emptyStateText: {
        color: GRAY,
        marginTop: 12,
        textAlign: 'center',
    },
    popularFoodsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    popularFoodItem: {
        width: '48%',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 16,
        marginBottom: 10,
        alignItems: 'center',
    },
    popularFoodIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: LIGHT_GRAY,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    popularFoodName: {
        fontSize: 14,
        color: WHITE,
        textAlign: 'center',
    },
    customButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    customButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    customButtonText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
    quickAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
    },
    quickAddIcon: {
        marginRight: 12,
    },
    quickAddText: {
        color: WHITE,
        fontWeight: '500',
        fontSize: 16,
    },
    tipSection: {
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 16,
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: BLUE_ACCENT,
        marginBottom: 8,
    },
    tipText: {
        color: GRAY,
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
}); 