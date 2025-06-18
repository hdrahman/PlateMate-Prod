import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FoodItem from '../components/FoodItem';
import FoodDetails from '../components/FoodDetails';
import ManualFoodEntry from '../components/ManualFoodEntry';
import { FoodItem as FoodItemType } from '../services/BarcodeService';
import { getRecentFoodEntries, addFoodEntryWithContext, FoodLogEntry } from '../api/foodLog';
import { debounce } from 'lodash';
import { useFoodLog } from '../context/FoodLogContext';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { auth } from '../utils/firebase/index';

// Define navigation type
type RootStackParamList = {
    'Food Log': { refresh?: number };
    Manual: { mealType?: string; sourcePage?: string };
    Camera: undefined;
    BarcodeScanner: undefined;
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
        const user = auth.currentUser;

        if (user) {
            try {
                const token = await user.getIdToken(true);
                return {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };
            } catch (tokenError) {
                console.error('Error getting Firebase token:', tokenError);
                throw tokenError;
            }
        }
    } catch (error) {
        console.error('Error getting auth token:', error);
    }
    return {
        'Content-Type': 'application/json'
    };
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
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#0074dd';

// GradientBorderCard component for consistent card styling
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
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
                    backgroundColor: '#121212',
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

    // Use the food log context
    const foodLogContext = useFoodLog();

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

            // Use the food log context to add the entry
            await addFoodEntryWithContext(food, finalMealType, quantity, 1, foodLogContext);

            Alert.alert('Success', `Added ${food.food_name} to your ${finalMealType} log`, [
                {
                    text: 'OK',
                    onPress: async () => {
                        // Add a small delay to ensure database operations complete
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // Refresh food logs across the app
                        await foodLogContext.refreshLogs();

                        // Hide food details modal
                        setShowFoodDetails(false);

                        // Navigate back to Food Log with refresh parameter
                        navigation.navigate('Food Log', { refresh: Date.now() });
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
        navigation.navigate('Camera');
    };

    const openBarcodeScanner = () => {
        navigation.navigate('BarcodeScanner');
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
                color={option.isActive ? "#FF00F5" : WHITE}
            />
            <Text style={[styles.uploadOptionText, option.isActive && styles.activeUploadOptionText]}>
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
            ]}
            edges={['top']}
        >
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

            {/* Header with back button and title */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Food</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <GradientBorderCard style={styles.searchInputWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={GRAY} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search foods..."
                            placeholderTextColor={GRAY}
                            value={searchQuery}
                            onChangeText={handleSearchChange}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={GRAY} />
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
                        <Ionicons name="add" size={24} color={WHITE} />
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
                        <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                        <Text style={styles.loadingText}>Searching...</Text>
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
                                    tintColor={PURPLE_ACCENT}
                                    colors={[PURPLE_ACCENT]}
                                />
                            }
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={60} color={GRAY} />
                            <Text style={styles.emptyText}>No results found</Text>
                            <Text style={styles.emptySubtext}>Try different keywords or add manually</Text>
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
                                    <Text style={styles.manualEntryText}>Add Manually</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )
                ) : (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Foods</Text>
                        </View>
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={PURPLE_ACCENT} />
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
                                        tintColor={PURPLE_ACCENT}
                                        colors={[PURPLE_ACCENT]}
                                    />
                                }
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="nutrition-outline" size={60} color={GRAY} />
                                <Text style={styles.emptyText}>No recent foods</Text>
                                <Text style={styles.emptySubtext}>Search for foods or add manually</Text>
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
            />

            {/* Loading Overlay */}
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
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