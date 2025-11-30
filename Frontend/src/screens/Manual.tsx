import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    FlatList,
    Image,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FoodItem from '../components/FoodItem';
import FoodDetails from '../components/FoodDetails';
import ManualFoodEntry from '../components/ManualFoodEntry';
import { FoodItem as FoodItemType } from '../services/BarcodeService';
import { getRecentFoodEntries, FoodLogEntry } from '../api/foodLog';
import { useFoodLog } from '../context/FoodLogContext';
import { debounce } from 'lodash';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';

// Define navigation type
type RootStackParamList = {
    FoodLog: { refresh?: number };
    Manual: { mealType?: string; sourcePage?: string };
    Scanner: { mode?: 'camera' | 'barcode' };
    ImageCapture: { mealType: string; photoUri?: string; sourcePage?: string };
    FoodDetail: { foodId: number };
};
type NavigationProp = StackNavigationProp<RootStackParamList>;

// Backend API base URL
const BACKEND_BASE_URL = BACKEND_URL;

/**
 * Get authorization headers for backend API calls
 */
const getAuthHeaders = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated');
        }

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        };
    } catch (error) {
        console.error('Error getting auth headers:', error);
        throw error;
    }
};

/**
 * Search for foods using the backend API
 * @param query - The search query
 * @param minHealthiness - Minimum healthiness rating to include (1-10)
 * @returns An array of food items
 */
const searchFood = async (query: string, minHealthiness: number = 0): Promise<FoodItemType[]> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/food/search`,
            {
                query: query,
                min_healthiness: minHealthiness
            },
            { headers }
        );

        // Extract results from the wrapped response format
        const data = response.data;
        if (data && data.results && Array.isArray(data.results)) {
            console.log(`Found ${data.results.length} food items for query: ${query}`);
            return data.results;
        } else {
            console.log(`No results found in response:`, data);
            return [];
        }
    } catch (error) {
        console.error('Error searching for food:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

/**
 * Get detailed nutrition information for a food using the backend API
 * @param query - The food name
 * @returns Detailed nutrition information
 */
const getFoodDetails = async (query: string): Promise<FoodItemType | null> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/food/details`,
            {
                food_name: query
            },
            { headers }
        );

        return response.data || null;
    } catch (error) {
        console.error('Error getting food details:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            } else if (error.response?.status === 404) {
                console.log('Food not found');
            }
        }
        return null;
    }
};

// Define theme colors
const PRIMARY_BG = '#000000';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#0074dd';

// GradientBorderCard component for consistent card styling
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
    theme?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style, theme }) => {
    const cardBgColor = theme?.colors?.cardBackground || theme?.colors?.background || '#121212';
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
                    backgroundColor: cardBgColor,
                    padding: 16,
                    flex: 1,
                }}
            >
                {children}
            </View>
        </View>
    );
};

// Convert FoodLogEntry to FoodItem for display purposes
// Add ID so we can navigate to the food detail screen
const convertFoodLogEntryToFoodItem = (entry: FoodLogEntry): FoodItemType & { id?: number } => {
    return {
        id: entry.id, // Include the ID for navigation
        food_name: entry.food_name,
        brand_name: entry.brand_name || undefined,
        calories: entry.calories,
        proteins: entry.proteins,
        carbs: entry.carbs,
        fats: entry.fats,
        fiber: entry.fiber,
        sugar: entry.sugar,
        saturated_fat: entry.saturated_fat,
        polyunsaturated_fat: entry.polyunsaturated_fat,
        monounsaturated_fat: entry.monounsaturated_fat,
        trans_fat: entry.trans_fat,
        cholesterol: entry.cholesterol,
        sodium: entry.sodium,
        potassium: entry.potassium,
        vitamin_a: entry.vitamin_a,
        vitamin_c: entry.vitamin_c,
        calcium: entry.calcium,
        iron: entry.iron,
        image: entry.image_url || '', // Map image_url to image
        serving_unit: entry.quantity?.split(' ').slice(1).join(' ') || 'serving',
        serving_weight_grams: 0, // Not available in FoodLogEntry
        serving_qty: parseFloat(entry.quantity?.split(' ')[0] || '1'),
        healthiness_rating: entry.healthiness_rating
    };
};

export default function Manual() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const params = route.params as { mealType?: string; sourcePage?: string };
    const defaultMealType = params?.mealType || 'Breakfast';
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { addFoodLog } = useFoodLog();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FoodItemType[]>([]);
    const [recentEntries, setRecentEntries] = useState<FoodItemType[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodItemType | null>(null);
    const [showFoodDetails, setShowFoodDetails] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [selectedMealCategory, setSelectedMealCategory] = useState(defaultMealType);

    // Load recent entries when component mounts
    useEffect(() => {
        loadRecentEntries();
    }, []);

    // Load recent food entries
    const loadRecentEntries = async () => {
        setIsLoading(true);
        try {
            const entries = await getRecentFoodEntries(10);
            // Convert FoodLogEntry to FoodItem for display
            const convertedEntries = entries.map(convertFoodLogEntryToFoodItem);
            setRecentEntries(convertedEntries);
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
                // Use Backend API for all searches (moved from direct Nutritionix API)
                const results = await searchFood(query);
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
            // For recent food entries (from food log), navigate to FoodDetail screen
            if (food.id) {
                navigation.navigate('FoodDetail', { foodId: food.id });
                return;
            }

            // For search results, show the modal
            setIsLoading(true);
            setSelectedFood(food);
            setShowFoodDetails(true);
        } catch (error) {
            console.error('Error selecting food:', error);
            setSelectedFood(food);
            setShowFoodDetails(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle adding food to log
    const handleAddFood = async (food, mealType, quantity) => {
        try {
            // If no meal type was specified, use the default from route params
            const finalMealType = mealType || selectedMealCategory;

            setIsLoading(true);

            // Format current date as ISO string (YYYY-MM-DD) - same as ImageCapture
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            console.log(`Saving food log from manual/search with date: ${formattedDate}`);

            // Create food log entry using the EXACT same structure as ImageCapture
            const foodLog = {
                meal_id: Date.now(), // Generate a unique meal ID as number - same as ImageCapture
                user_id: 1, // Placeholder - database function will override with actual user ID
                food_name: food.food_name || 'Unknown Food',
                brand_name: food.brand_name || '',
                meal_type: finalMealType,
                date: formattedDate, // Use formatted date
                quantity: `${quantity} ${food.serving_unit || 'serving'}`,
                weight: null,
                weight_unit: 'g',
                calories: food.calories || 0, // Keep calories as 0 since it's mandatory
                proteins: food.proteins || -1, // Use -1 for missing data
                carbs: food.carbs || -1,
                fats: food.fats || -1,
                fiber: food.fiber || -1,
                sugar: food.sugar || -1,
                saturated_fat: food.saturated_fat || -1,
                polyunsaturated_fat: food.polyunsaturated_fat || -1,
                monounsaturated_fat: food.monounsaturated_fat || -1,
                trans_fat: food.trans_fat || -1,
                cholesterol: food.cholesterol || -1,
                sodium: food.sodium || -1,
                potassium: food.potassium || -1,
                vitamin_a: food.vitamin_a || -1,
                vitamin_c: food.vitamin_c || -1,
                calcium: food.calcium || -1,
                iron: food.iron || -1,
                healthiness_rating: food.healthiness_rating || 5,
                notes: food.notes || '',
                image_url: food.image || '', // Required field
                file_key: 'default_key' // Required field
            };

            console.log('Saving manual/search food log to local database:', foodLog);

            // Use FoodLogContext which handles navigation and refresh automatically
            await addFoodLog(foodLog);

            // Hide food details modal if open
            setShowFoodDetails(false);

        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Navigation functions for upload options
    const openGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                navigation.navigate('ImageCapture', {
                    mealType: selectedMealCategory,
                    photoUri: result.assets[0].uri,
                    sourcePage: 'Manual'
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const openCamera = () => {
        navigation.navigate('Scanner', { mode: 'camera' });
    };

    const openBarcodeScanner = () => {
        navigation.navigate('Scanner', { mode: 'barcode' });
    };

    const openManualEntry = () => {
        setShowManualEntry(true);
    };

    // Render upload option button
    const renderUploadOption = (option: { name: string; icon: string; onPress: () => void; isActive?: boolean }) => (
        <TouchableOpacity
            style={[styles.uploadOption, option.isActive && styles.activeUploadOption]}
            onPress={option.onPress}
        >
            <MaterialCommunityIcons
                name={option.icon as any}
                size={26}
                color={option.isActive ? theme.colors.primary : theme.colors.text}
            />
            <Text style={[styles.uploadOptionText, { color: theme.colors.text }, option.isActive && { color: theme.colors.primary }]}>
                {option.name}
            </Text>
        </TouchableOpacity>
    );

    // Render recent entry item
    const renderRecentEntry = ({ item }) => (
        <FoodItem item={item} onPress={handleFoodSelect} />
    );

    // Render search result item
    const renderSearchResult = ({ item }) => (
        <FoodItem item={item} onPress={handleFoodSelect} />
    );

    return (
        <SafeAreaView
            style={[
                styles.container,
                { backgroundColor: theme.colors.background }
            ]}
            edges={['top']}
        >
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

            {/* Header with back button and title */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: theme.colors.cardBackground }]}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Food</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <GradientBorderCard style={styles.searchInputWrapper} theme={theme}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.colors.text }]}
                            placeholder="Search foods..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={searchQuery}
                            onChangeText={handleSearchChange}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </GradientBorderCard>

                <TouchableOpacity
                    style={styles.addManualButton}
                    onPress={() => setShowManualEntry(true)}
                >
                    <LinearGradient
                        colors={["#0074dd", "#5c00dd", "#dd0095"]}
                        style={styles.addManualGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Ionicons name="add" size={24} color={theme.colors.text} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Upload Options (replaced Categories) */}
            <View style={styles.uploadOptionsContainer}>
                {renderUploadOption({
                    name: 'Gallery',
                    icon: 'image-outline',
                    onPress: openGallery
                })}
                {renderUploadOption({
                    name: 'Camera',
                    icon: 'camera-outline',
                    onPress: openCamera
                })}
                {renderUploadOption({
                    name: 'Barcode',
                    icon: 'barcode-scan',
                    onPress: openBarcodeScanner
                })}
                {renderUploadOption({
                    name: 'Manual',
                    icon: 'text-box-outline',
                    onPress: openManualEntry,
                    isActive: true
                })}
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {isSearching ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Searching...</Text>
                    </View>
                ) : searchQuery.length > 2 ? (
                    searchResults.length > 0 ? (
                        <FlatList
                            data={searchResults}
                            renderItem={renderSearchResult}
                            keyExtractor={(item, index) => `search-${index}`}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor={theme.colors.primary}
                                    colors={[theme.colors.primary]}
                                />
                            }
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={60} color={theme.colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No results found</Text>
                            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>Try different keywords or add manually</Text>
                            <TouchableOpacity
                                style={styles.manualEntryButton}
                                onPress={() => setShowManualEntry(true)}
                            >
                                <LinearGradient
                                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                    style={styles.manualEntryGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={[styles.manualEntryText, { color: theme.colors.text }]}>Add Manually</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )
                ) : (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Foods</Text>
                        </View>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                            </View>
                        ) : recentEntries.length > 0 ? (
                            <FlatList
                                data={recentEntries}
                                renderItem={renderRecentEntry}
                                keyExtractor={(item, index) => `recent-${index}`}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.listContainer}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        tintColor={theme.colors.primary}
                                        colors={[theme.colors.primary]}
                                    />
                                }
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="nutrition-outline" size={60} color={theme.colors.textSecondary} />
                                <Text style={[styles.emptyText, { color: theme.colors.text }]}>No recent foods</Text>
                                <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>Search for foods or add manually</Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Food Details Modal */}
            {selectedFood && (
                <FoodDetails
                    visible={showFoodDetails}
                    food={selectedFood}
                    onClose={() => setShowFoodDetails(false)}
                    onAddFood={(food, mealType, quantity) => handleAddFood(food, mealType || selectedMealCategory, quantity)}
                />
            )}

            {/* Manual Food Entry Modal */}
            <ManualFoodEntry
                visible={showManualEntry}
                onClose={() => setShowManualEntry(false)}
                onAddFood={(food, mealType, quantity) => handleAddFood(food, mealType || selectedMealCategory, quantity)}
                defaultMealType={selectedMealCategory}
            />

            {/* Loading Overlay */}
            {isLoading && (
                <View style={[styles.loadingOverlay, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
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
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
    },
    // Upload Options (replaced Categories)
    uploadOptionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 16,
    },
    uploadOption: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    activeUploadOption: {
        // Additional styling for active option if needed
    },
    uploadOptionText: {
        color: WHITE,
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    activeUploadOptionText: {
        color: '#FF00F5',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchInputWrapper: {
        flex: 1,
        height: 56,
        padding: 0,
        marginRight: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: '100%',
    },
    searchInput: {
        flex: 1,
        height: 40,
        color: WHITE,
        marginLeft: 8,
        fontSize: 16,
        textAlignVertical: 'center',
    },
    addManualButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    addManualGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
    },
    listContainer: {
        paddingTop: 12,
        paddingBottom: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: WHITE,
        marginTop: 12,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: GRAY,
        textAlign: 'center',
        marginBottom: 24,
    },
    manualEntryButton: {
        width: '60%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        marginTop: 16,
    },
    manualEntryGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    manualEntryText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradientBorderContainer: {
        borderRadius: 10,
        overflow: 'hidden',
    },
}); 