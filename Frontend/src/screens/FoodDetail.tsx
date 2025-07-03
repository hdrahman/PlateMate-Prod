import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getFoodLogById, updateFoodLog, getFoodLogsByMealId, addFoodLog } from '../utils/database';
import { formatNutritionalValue, hasNutritionalValue } from '../utils/helpers';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Theme colors matching the app
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const GRAY = '#8E8E93';
const LIGHT_GRAY = '#2A2A2A';
const PURPLE_ACCENT = '#AA00FF';

// Nutrient category colors
const MACRO_COLORS = {
    carbs: '#4FC3F7',
    protein: '#66BB6A',
    fat: '#FFB74D'
};

const VITAMIN_COLORS = {
    vitaminA: '#FF7043',
    vitaminC: '#FFA726',
    calcium: '#AB47BC',
    iron: '#EF5350'
};

// Define navigation types
type RootStackParamList = {
    FoodDetail: { foodId: number };
    FoodLog: { refresh?: number; mealIdFilter?: number };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface FoodLogEntry {
    id: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    weight?: number;
    weight_unit?: string;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    notes?: string;
    synced: number;
    sync_action: string;
    last_modified: string;
}

const FoodDetailScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { foodId } = route.params as { foodId: number };

    const [foodData, setFoodData] = useState<FoodLogEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editedFoodData, setEditedFoodData] = useState<Partial<FoodLogEntry>>({});
    const [relatedFoodItems, setRelatedFoodItems] = useState<FoodLogEntry[]>([]);
    const [hasRelatedItems, setHasRelatedItems] = useState(false);

    useEffect(() => {
        loadFoodData();
    }, [foodId]);

    const loadFoodData = async () => {
        try {
            setLoading(true);
            const data = await getFoodLogById(foodId);
            setFoodData(data);

            // Check for other food items with the same meal_id
            if (data && data.meal_id) {
                const relatedItems = await getFoodLogsByMealId(data.meal_id);
                // Filter out the current item
                const otherItems = relatedItems.filter(item => item.id !== foodId);
                setRelatedFoodItems(otherItems);
                setHasRelatedItems(otherItems.length > 0);
            }
        } catch (error) {
            console.error('Error loading food data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper function to get color based on healthiness rating
    const getHealthinessColor = (rating: number): string => {
        if (rating <= 4) return '#FF5252'; // Red for unhealthy (0-4)
        if (rating <= 7) return '#FFD740'; // Yellow for moderate (5-7)
        return '#4CAF50'; // Green for healthy (8-10)
    };

    // Helper function to format macro percentages
    const getMacroPercentages = () => {
        if (!foodData) return { carbs: 0, fat: 0, protein: 0 };

        const totalCals = foodData.calories;
        if (totalCals === 0) return { carbs: 0, fat: 0, protein: 0 };

        const carbCals = foodData.carbs * 4;
        const fatCals = foodData.fats * 9;
        const proteinCals = foodData.proteins * 4;

        return {
            carbs: Math.round((carbCals / totalCals) * 100),
            fat: Math.round((fatCals / totalCals) * 100),
            protein: Math.round((proteinCals / totalCals) * 100)
        };
    };

    // Daily value percentages (simplified estimates)
    const getDailyValuePercentage = (nutrient: string, value: number): number => {
        const dailyValues: { [key: string]: number } = {
            fiber: 25, // 25g daily value
            sugar: 50, // 50g daily value (max recommended)
            saturated_fat: 20, // 20g daily value
            cholesterol: 300, // 300mg daily value
            sodium: 2300, // 2300mg daily value
            potassium: 3500, // 3500mg daily value
            vitamin_a: 900, // 900mcg daily value
            vitamin_c: 90, // 90mg daily value
            calcium: 1000, // 1000mg daily value
            iron: 18 // 18mg daily value
        };

        const dv = dailyValues[nutrient];
        if (!dv) return 0;
        return Math.min(Math.round((value / dv) * 100), 100);
    };

    // Helper to safely format ISO date strings (YYYY-MM-DD or full ISO) into local date without UTC offset issues
    const formatLocalDate = (isoDateString: string | undefined): string => {
        if (!isoDateString) return '';

        // Extract just the date portion if a time component exists
        const datePart = isoDateString.split('T')[0]; // YYYY-MM-DD
        const parts = datePart.split('-');
        if (parts.length !== 3) {
            // Fallback to native formatting if unexpected format encountered
            return new Date(isoDateString).toLocaleDateString();
        }

        const [year, month, day] = parts.map(Number);

        // Construct a date in local timezone to avoid UTC conversion shifting the day
        const localDateObj = new Date(year, month - 1, day);

        return localDateObj.toLocaleDateString();
    };

    // Render nutrient row with progress bar
    const renderNutrientRowWithProgress = (
        icon: string,
        label: string,
        value: number,
        unit: string = 'g',
        color: string = SUBDUED,
        showProgress: boolean = false,
        nutrientKey?: string
    ) => {
        const percentage = nutrientKey ? getDailyValuePercentage(nutrientKey, value) : 0;

        return (
            <View style={styles.nutrientRowWithProgress}>
                <View style={styles.nutrientRowHeader}>
                    <View style={styles.nutrientRowLeft}>
                        <Ionicons name={icon as any} size={16} color={color} style={styles.nutrientIcon} />
                        <Text style={styles.nutrientLabel}>{label}</Text>
                    </View>
                    <View style={styles.nutrientRowRight}>
                        <Text style={styles.nutrientValue}>
                            {formatNutritionalValue(value, unit, value < 1 && value > 0 ? 1 : 0)}
                        </Text>
                        {showProgress && hasNutritionalValue(value) && percentage > 0 && (
                            <Text style={styles.percentageText}>{percentage}%</Text>
                        )}
                    </View>
                </View>
                {showProgress && hasNutritionalValue(value) && percentage > 0 && (
                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBackground}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${percentage}%`, backgroundColor: color }
                                ]}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // Render macro circle
    const renderMacroCircle = (label: string, value: number, unit: string, percentage: number, color: string) => (
        <View style={styles.macroCircle}>
            <View style={[styles.macroCircleInner, { borderColor: color }]}>
                <Text style={styles.macroValue}>{formatNutritionalValue(value, unit)}</Text>
                {hasNutritionalValue(value) && (
                    <Text style={styles.macroPercentage}>{percentage}%</Text>
                )}
            </View>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );

    // Handle edit button press
    const handleEditPress = () => {
        if (foodData) {
            setEditedFoodData({
                food_name: foodData.food_name,
                calories: foodData.calories,
                proteins: foodData.proteins,
                carbs: foodData.carbs,
                fats: foodData.fats,
                quantity: foodData.quantity,
                meal_type: foodData.meal_type,
                notes: foodData.notes || '',
            });
            setEditModalVisible(true);
        }
    };

    // Handle saving edited food data
    const handleSaveEdit = async () => {
        if (!foodData || !editedFoodData) return;

        try {
            setLoading(true);

            // Update the food log entry in the database
            await updateFoodLog(foodId, {
                ...foodData,
                ...editedFoodData,
                sync_action: 'UPDATE',
            });

            // Reload the food data to show updated values
            const updatedData = await getFoodLogById(foodId);
            setFoodData(updatedData);

            setEditModalVisible(false);
            Alert.alert('Success', 'Food log entry updated successfully');
        } catch (error) {
            console.error('Error updating food log:', error);
            Alert.alert('Error', 'Failed to update food log entry');
        } finally {
            setLoading(false);
        }
    };

    // Handle viewing all related food items
    const handleViewAllItems = () => {
        if (foodData) {
            // Navigate to FoodLog with filter for this meal
            navigation.navigate('FoodLog', {
                refresh: Date.now(),
                mealIdFilter: foodData.meal_id
            });
        }
    };

    const handleQuickAdd = async () => {
        if (!foodData) return;

        try {
            // Format current date as ISO string (YYYY-MM-DD) - same as ImageCapture
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            console.log(`Saving food log from quick add with date: ${formattedDate}`);

            // Create food log entry using the EXACT same structure as ImageCapture
            const foodLog = {
                meal_id: Date.now().toString(), // Generate a unique meal ID - same as ImageCapture
                food_name: foodData.food_name || 'Unknown Food',
                brand_name: foodData.brand_name || '',
                meal_type: foodData.meal_type,
                date: formattedDate, // Use formatted date
                quantity: foodData.quantity || '1 serving',
                weight: foodData.weight || null,
                weight_unit: foodData.weight_unit || 'g',
                calories: foodData.calories || 0, // Keep calories as 0 since it's mandatory
                proteins: foodData.proteins || -1, // Use -1 for missing data
                carbs: foodData.carbs || -1,
                fats: foodData.fats || -1,
                fiber: foodData.fiber || -1,
                sugar: foodData.sugar || -1,
                saturated_fat: foodData.saturated_fat || -1,
                polyunsaturated_fat: foodData.polyunsaturated_fat || -1,
                monounsaturated_fat: foodData.monounsaturated_fat || -1,
                trans_fat: foodData.trans_fat || -1,
                cholesterol: foodData.cholesterol || -1,
                sodium: foodData.sodium || -1,
                potassium: foodData.potassium || -1,
                vitamin_a: foodData.vitamin_a || -1,
                vitamin_c: foodData.vitamin_c || -1,
                calcium: foodData.calcium || -1,
                iron: foodData.iron || -1,
                healthiness_rating: foodData.healthiness_rating || 5,
                notes: foodData.notes || '',
                image_url: foodData.image_url || '', // Required field
                file_key: foodData.file_key || 'default_key' // Required field
            };

            console.log('Saving quick add food log to local database:', foodLog);

            // Navigate to FoodLog immediately so the user can see the new entry
            const refreshTimestamp = Date.now();
            navigation.navigate('FoodLog', { refresh: refreshTimestamp });

            await addFoodLog(foodLog);

            Alert.alert(
                'Success',
                'Food item added to today\'s log!',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error adding food log:', error);
            Alert.alert(
                'Error',
                'Failed to add food item. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                <Text style={styles.loadingText}>Loading food details...</Text>
            </SafeAreaView>
        );
    }

    if (!foodData) {
        return (
            <SafeAreaView style={styles.errorContainer}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <Text style={styles.errorText}>Food not found</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const macroPercentages = getMacroPercentages();

    // Determine if we should show the FatSecret attribution
    const shouldShowAttribution = (() => {
        if (!foodData) return false;

        // Show attribution if:
        // 1. The notes field references a scanned item (barcode or product)
        // 2. The image URL points to a remote resource (manual search results typically have remote images)
        //    Local images for GPT or manual entries usually start with "file://" or are empty.
        const notesText = foodData.notes?.toLowerCase() || '';
        const isScanned = notesText.includes('scanned');

        const imageUrl = foodData.image_url || '';
        const isRemoteImage = imageUrl.startsWith('http');

        return isScanned || isRemoteImage;
    })();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Image Background with Overlay */}
                {!loading && foodData?.image_url && !imageError ? (
                    <View style={styles.imageSection}>
                        <Image
                            source={{ uri: foodData.image_url }}
                            style={styles.foodImage}
                            resizeMode="cover"
                            onError={() => setImageError(true)}
                        />

                        <LinearGradient
                            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
                            style={styles.headerGradient}
                        />

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', PRIMARY_BG]}
                            style={styles.bottomGradient}
                        />

                        {/* Header with safe area padding */}
                        <SafeAreaView style={styles.headerContainer} edges={['top']}>
                            <View style={styles.header}>
                                <TouchableOpacity
                                    onPress={() => navigation.goBack()}
                                    style={styles.headerButton}
                                >
                                    <View style={styles.headerButtonBackground}>
                                        <Ionicons name="chevron-back" size={24} color={WHITE} />
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                                <TouchableOpacity style={styles.headerButton}>
                                    <View style={styles.headerButtonBackground}>
                                        <Ionicons name="heart-outline" size={22} color={WHITE} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>

                        {/* Food Details Overlay */}
                        <View style={styles.foodInfoOverlay}>
                            <Text style={styles.foodName}>{foodData?.food_name}</Text>

                            {/* Row container for health score and meal info */}
                            <View style={styles.infoRow}>
                                {/* Health Score on the left */}
                                {foodData?.healthiness_rating && (
                                    <View style={[
                                        styles.healthinessBadge,
                                        {
                                            backgroundColor: getHealthinessColor(foodData.healthiness_rating) + '20',
                                            borderColor: getHealthinessColor(foodData.healthiness_rating),
                                            marginTop: 0,
                                        }
                                    ]}>
                                        <Text style={[styles.healthinessBadgeText, { color: getHealthinessColor(foodData.healthiness_rating) }]}>
                                            Health Score: {Math.round(foodData.healthiness_rating)}
                                        </Text>
                                    </View>
                                )}

                                {/* Meal type and date with edit button on the right */}
                                <View style={styles.metaContainer}>
                                    <Text style={[styles.foodMeta, styles.foodMetaRight]}>
                                        {foodData?.meal_type} • {foodData && formatLocalDate(foodData.date)}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={handleEditPress}
                                    >
                                        <Ionicons name="pencil" size={18} color={WHITE} />
                                        <Text style={styles.editButtonText}>Edit</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noImageHeader}>
                        <SafeAreaView edges={['top']}>
                            <View style={styles.header}>
                                <TouchableOpacity
                                    onPress={() => navigation.goBack()}
                                    style={styles.headerButton}
                                >
                                    <View style={styles.headerButtonBackground}>
                                        <Ionicons name="chevron-back" size={24} color={WHITE} />
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                                <TouchableOpacity style={styles.headerButton}>
                                    <View style={styles.headerButtonBackground}>
                                        <Ionicons name="heart-outline" size={22} color={WHITE} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Basic food info without image */}
                            <View style={styles.noImageFoodInfo}>
                                <Text style={styles.foodName}>{foodData?.food_name}</Text>

                                <View style={styles.infoRow}>
                                    {/* Health Score on the left */}
                                    {foodData?.healthiness_rating && (
                                        <View style={[
                                            styles.healthinessBadge,
                                            {
                                                backgroundColor: getHealthinessColor(foodData.healthiness_rating) + '20',
                                                borderColor: getHealthinessColor(foodData.healthiness_rating),
                                                marginTop: 0,
                                            }
                                        ]}>
                                            <Text style={[styles.healthinessBadgeText, { color: getHealthinessColor(foodData.healthiness_rating) }]}>
                                                Health Score: {Math.round(foodData.healthiness_rating)}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Meal type and date with edit button on the right */}
                                    <View style={styles.metaContainer}>
                                        <Text style={[styles.foodMeta, styles.foodMetaRight]}>
                                            {foodData?.meal_type} • {foodData && formatLocalDate(foodData.date)}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={handleEditPress}
                                        >
                                            <Ionicons name="pencil" size={18} color={WHITE} />
                                            <Text style={styles.editButtonText}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </SafeAreaView>
                    </View>
                )}

                {/* Main Content Container */}
                <View style={[
                    styles.contentContainer,
                    (!foodData?.image_url || imageError) && styles.contentContainerNoImage
                ]}>
                    {/* Calories Section */}
                    <View style={styles.calorieSection}>
                        {/* Quick Add Button - Top (positioned absolutely) */}
                        <TouchableOpacity
                            style={styles.quickAddButtonTop}
                            onPress={handleQuickAdd}
                        >
                            <View style={styles.quickAddButtonContent}>
                                <Ionicons name="add" size={14} color="#4CAF50" />
                                <Text style={styles.quickAddButtonText}>Add</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.calorieAlignmentContainer}>
                            <View style={styles.calorieRow}>
                                <Text style={styles.calorieNumber}>{foodData?.calories}</Text>
                                <Text style={styles.calorieLabel}>calories</Text>
                            </View>

                            {/* Health score has been moved to the overlay */}
                        </View>
                    </View>

                    {/* Macros Visual Section */}
                    <View style={styles.macrosSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="fitness" size={20} color={PURPLE_ACCENT} />
                            <Text style={styles.sectionTitle}>Macronutrients</Text>
                        </View>
                        <View style={styles.macrosRow}>
                            {renderMacroCircle('Carbs', foodData.carbs, 'g', macroPercentages.carbs, MACRO_COLORS.carbs)}
                            {renderMacroCircle('Protein', foodData.proteins, 'g', macroPercentages.protein, MACRO_COLORS.protein)}
                            {renderMacroCircle('Fat', foodData.fats, 'g', macroPercentages.fat, MACRO_COLORS.fat)}
                        </View>
                    </View>

                    {/* Enhanced Nutrition Facts */}
                    <View style={styles.detailsSection}>
                        {/* Main Macros with Progress */}
                        <View style={styles.nutrientGroup}>
                            {renderNutrientRowWithProgress('leaf', 'Total Carbohydrates', foodData.carbs, 'g', MACRO_COLORS.carbs)}
                            {renderNutrientRowWithProgress('git-branch', 'Dietary Fiber', foodData.fiber, 'g', '#8BC34A', true, 'fiber')}
                            {renderNutrientRowWithProgress('cafe', 'Total Sugars', foodData.sugar, 'g', '#FF7043', true, 'sugar')}
                            {renderNutrientRowWithProgress('fitness', 'Protein', foodData.proteins, 'g', MACRO_COLORS.protein)}
                            {renderNutrientRowWithProgress('water', 'Total Fat', foodData.fats, 'g', MACRO_COLORS.fat)}
                        </View>

                        {/* Fat Breakdown */}
                        <View style={styles.nutrientGroup}>
                            <View style={styles.subSectionHeader}>
                                <Ionicons name="ellipse" size={16} color={MACRO_COLORS.fat} />
                                <Text style={styles.subSectionTitle}>Fat Breakdown</Text>
                            </View>
                            {renderNutrientRowWithProgress('warning', 'Saturated Fat', foodData.saturated_fat, 'g', '#FF5722', true, 'saturated_fat')}
                            {renderNutrientRowWithProgress('close', 'Trans Fat', foodData.trans_fat, 'g', '#F44336')}
                            {renderNutrientRowWithProgress('leaf', 'Polyunsaturated Fat', foodData.polyunsaturated_fat, 'g', '#FF9800')}
                            {renderNutrientRowWithProgress('leaf-outline', 'Monounsaturated Fat', foodData.monounsaturated_fat, 'g', '#FFC107')}
                        </View>

                        {/* Vitamins & Minerals with Progress */}
                        <View style={styles.nutrientGroup}>
                            <View style={styles.subSectionHeader}>
                                <Ionicons name="sparkles" size={16} color={VITAMIN_COLORS.vitaminC} />
                                <Text style={styles.subSectionTitle}>Vitamins & Minerals</Text>
                            </View>
                            {renderNutrientRowWithProgress('heart', 'Cholesterol', foodData.cholesterol, 'mg', '#E91E63', true, 'cholesterol')}
                            {renderNutrientRowWithProgress('water', 'Sodium', foodData.sodium, 'mg', '#2196F3', true, 'sodium')}
                            {renderNutrientRowWithProgress('flash', 'Potassium', foodData.potassium, 'mg', '#9C27B0', true, 'potassium')}
                            {renderNutrientRowWithProgress('eye', 'Vitamin A', foodData.vitamin_a, 'mcg', VITAMIN_COLORS.vitaminA, true, 'vitamin_a')}
                            {renderNutrientRowWithProgress('sunny', 'Vitamin C', foodData.vitamin_c, 'mg', VITAMIN_COLORS.vitaminC, true, 'vitamin_c')}
                            {renderNutrientRowWithProgress('diamond', 'Calcium', foodData.calcium, 'mg', VITAMIN_COLORS.calcium, true, 'calcium')}
                            {renderNutrientRowWithProgress('magnet', 'Iron', foodData.iron, 'mg', VITAMIN_COLORS.iron, true, 'iron')}
                        </View>

                        {/* Additional Information */}
                        {(foodData.brand_name || foodData.weight || foodData.notes) && (
                            <View style={styles.additionalInfo}>
                                <View style={styles.subSectionHeader}>
                                    <Ionicons name="information-circle" size={16} color={PURPLE_ACCENT} />
                                    <Text style={styles.subSectionTitle}>Additional Information</Text>
                                </View>
                                {foodData.brand_name && (
                                    <View style={styles.infoRow}>
                                        <View style={styles.infoRowLeft}>
                                            <Ionicons name="business" size={14} color={SUBDUED} />
                                            <Text style={styles.infoLabel}>Brand</Text>
                                        </View>
                                        <Text style={styles.infoValue}>{foodData.brand_name}</Text>
                                    </View>
                                )}
                                {foodData.weight && (
                                    <View style={styles.infoRow}>
                                        <View style={styles.infoRowLeft}>
                                            <Ionicons name="scale" size={14} color={SUBDUED} />
                                            <Text style={styles.infoLabel}>Weight</Text>
                                        </View>
                                        <Text style={styles.infoValue}>{foodData.weight}{foodData.weight_unit || 'g'}</Text>
                                    </View>
                                )}
                                {foodData.notes && (
                                    <View style={styles.notesContainer}>
                                        <View style={styles.infoRowLeft}>
                                            <Ionicons name="document-text" size={14} color={SUBDUED} />
                                            <Text style={styles.infoLabel}>Notes</Text>
                                        </View>
                                        <Text style={styles.notesText}>{foodData.notes}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Quick Add Button - Bottom */}
                    <TouchableOpacity
                        style={styles.quickAddButtonBottom}
                        onPress={handleQuickAdd}
                    >
                        <View style={styles.quickAddButtonContent}>
                            <Ionicons name="add" size={18} color="#4CAF50" />
                            <Text style={styles.quickAddButtonTextBottom}>Quick Add</Text>
                        </View>
                    </TouchableOpacity>

                    {/* FatSecret Attribution - show conditionally */}
                    {shouldShowAttribution && (
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
                    )}

                    {/* Bottom Spacing */}
                    <View style={{ height: 60 }} />
                </View>
            </ScrollView>

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Food Log</Text>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color={WHITE} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            {/* Food Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Food Name</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={editedFoodData.food_name}
                                    onChangeText={(text) => setEditedFoodData({ ...editedFoodData, food_name: text })}
                                    placeholder="Food name"
                                    placeholderTextColor={SUBDUED}
                                />
                            </View>

                            {/* Calories */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Calories</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={String(editedFoodData.calories || '')}
                                    onChangeText={(text) => setEditedFoodData({ ...editedFoodData, calories: Number(text) || 0 })}
                                    keyboardType="numeric"
                                    placeholder="Calories"
                                    placeholderTextColor={SUBDUED}
                                />
                            </View>

                            {/* Macros Row */}
                            <View style={styles.macrosInputRow}>
                                {/* Protein */}
                                <View style={styles.macroInputGroup}>
                                    <Text style={styles.inputLabel}>Protein (g)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={String(editedFoodData.proteins || '')}
                                        onChangeText={(text) => setEditedFoodData({ ...editedFoodData, proteins: Number(text) || 0 })}
                                        keyboardType="numeric"
                                        placeholder="Protein"
                                        placeholderTextColor={SUBDUED}
                                    />
                                </View>

                                {/* Carbs */}
                                <View style={styles.macroInputGroup}>
                                    <Text style={styles.inputLabel}>Carbs (g)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={String(editedFoodData.carbs || '')}
                                        onChangeText={(text) => setEditedFoodData({ ...editedFoodData, carbs: Number(text) || 0 })}
                                        keyboardType="numeric"
                                        placeholder="Carbs"
                                        placeholderTextColor={SUBDUED}
                                    />
                                </View>

                                {/* Fat */}
                                <View style={styles.macroInputGroup}>
                                    <Text style={styles.inputLabel}>Fat (g)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={String(editedFoodData.fats || '')}
                                        onChangeText={(text) => setEditedFoodData({ ...editedFoodData, fats: Number(text) || 0 })}
                                        keyboardType="numeric"
                                        placeholder="Fat"
                                        placeholderTextColor={SUBDUED}
                                    />
                                </View>
                            </View>

                            {/* Quantity */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Quantity</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={editedFoodData.quantity}
                                    onChangeText={(text) => setEditedFoodData({ ...editedFoodData, quantity: text })}
                                    placeholder="e.g., 1 serving"
                                    placeholderTextColor={SUBDUED}
                                />
                            </View>

                            {/* Meal Type Picker */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Meal</Text>
                                <View style={styles.mealTypeContainer}>
                                    {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal) => (
                                        <TouchableOpacity
                                            key={meal}
                                            style={[
                                                styles.mealTypeButton,
                                                editedFoodData.meal_type === meal && styles.mealTypeButtonActive
                                            ]}
                                            onPress={() => setEditedFoodData({ ...editedFoodData, meal_type: meal })}
                                        >
                                            <Text style={[
                                                styles.mealTypeButtonText,
                                                editedFoodData.meal_type === meal && styles.mealTypeButtonTextActive
                                            ]}>
                                                {meal}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Notes */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.textInput, styles.textAreaInput]}
                                    value={editedFoodData.notes}
                                    onChangeText={(text) => setEditedFoodData({ ...editedFoodData, notes: text })}
                                    placeholder="Add any notes about this food"
                                    placeholderTextColor={SUBDUED}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveEdit}
                        >
                            <LinearGradient
                                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                style={styles.saveButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: WHITE,
        fontSize: 16,
        marginTop: 10,
    },
    errorContainer: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        color: WHITE,
        fontSize: 18,
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: PURPLE_ACCENT,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingTop: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    scrollView: {
        flex: 1,
    },
    imageSection: {
        height: 450, // Increased height to show more of the image
        position: 'relative',
        width: screenWidth,
        overflow: 'hidden',
    },
    foodImage: {
        width: screenWidth,
        height: 450, // Increased height to match
        position: 'absolute',
    },
    placeholderImage: {
        width: screenWidth,
        height: 450, // Increased height to match
        backgroundColor: CARD_BG,
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200, // Increased height for better blending
    },
    foodInfoOverlay: {
        position: 'absolute',
        bottom: 20, // Moved even further down to be very close to edge of the blend
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    contentContainer: {
        paddingHorizontal: 20,
        backgroundColor: PRIMARY_BG,
        marginTop: -20, // Less overlap to prevent cutting off content
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 5, // Minimal padding
    },
    foodName: {
        fontSize: 32,
        fontWeight: '700',
        color: WHITE,
        marginBottom: 8,
        lineHeight: 38,
    },
    foodMeta: {
        fontSize: 16,
        color: WHITE,
        textTransform: 'capitalize',
    },
    foodMetaRight: {
        color: 'rgba(255, 255, 255, 0.85)', // Slightly grayed out but still predominantly white
        textAlign: 'right',
        flex: 1,
    },
    calorieSection: {
        alignItems: 'center',
        paddingTop: 20, // Increased from 10 to 20
        paddingBottom: 5,
        marginBottom: 24,
        position: 'relative',
    },
    calorieAlignmentContainer: {
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    calorieRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        width: '60%', // Control the width to align with health score
    },
    calorieNumber: {
        fontSize: 64,
        fontWeight: '300',
        color: WHITE,
        lineHeight: 70,
        marginRight: 5,
    },
    calorieLabel: {
        fontSize: 20,
        color: SUBDUED,
        marginBottom: 12,
    },
    healthinessBadge: {
        alignSelf: 'flex-start', // Position at left side
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        marginTop: 8,
        marginBottom: 0,
    },
    healthinessBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    macrosSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: WHITE,
        marginLeft: 8,
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    macroCircle: {
        alignItems: 'center',
    },
    macroCircleInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: 12,
    },
    macroValue: {
        fontSize: 16,
        fontWeight: '700',
        color: WHITE,
    },
    macroPercentage: {
        fontSize: 12,
        color: SUBDUED,
    },
    macroLabel: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '500',
    },
    detailsSection: {
        marginBottom: 8,
    },
    nutrientGroup: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        marginHorizontal: -4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    nutrientRowWithProgress: {
        marginBottom: 12,
    },
    nutrientRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    nutrientRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    nutrientIcon: {
        marginRight: 8,
    },
    nutrientLabel: {
        fontSize: 15,
        color: WHITE,
        flex: 1,
    },
    nutrientRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nutrientValue: {
        fontSize: 15,
        fontWeight: '600',
        color: WHITE,
        marginRight: 8,
    },
    percentageText: {
        fontSize: 12,
        color: SUBDUED,
        minWidth: 35,
        textAlign: 'right',
    },
    progressBarContainer: {
        marginTop: 6,
        marginLeft: 24,
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    subSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    subSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: PURPLE_ACCENT,
        marginLeft: 6,
    },

    additionalInfo: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        padding: 20,
        marginHorizontal: -4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 14,
        color: SUBDUED,
        marginLeft: 6,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: WHITE,
    },
    notesContainer: {
        marginTop: 8,
    },
    notesText: {
        fontSize: 14,
        color: WHITE,
        lineHeight: 20,
        marginTop: 8,
        marginLeft: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: WHITE,
        letterSpacing: 0.5,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonBackground: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noImageHeader: {
        backgroundColor: PRIMARY_BG,
        paddingBottom: 10,
    },
    noImageFoodInfo: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
    },
    contentContainerNoImage: {
        marginTop: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    metaContainer: {
        flex: 1,
        alignItems: 'flex-end',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(170, 0, 255, 0.3)',
    },
    editButtonText: {
        color: WHITE,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: CARD_BG,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    modalTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: '600',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        color: WHITE,
        fontSize: 14,
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: WHITE,
        fontSize: 16,
    },
    textAreaInput: {
        height: 100,
        paddingTop: 12,
    },
    macrosInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    macroInputGroup: {
        width: '31%',
    },
    mealTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    mealTypeButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 8,
        width: '48%',
        alignItems: 'center',
    },
    mealTypeButtonActive: {
        backgroundColor: PURPLE_ACCENT,
    },
    mealTypeButtonText: {
        color: GRAY,
        fontSize: 14,
        fontWeight: '500',
    },
    mealTypeButtonTextActive: {
        color: WHITE,
        fontWeight: '600',
    },
    saveButton: {
        margin: 16,
    },
    saveButtonGradient: {
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    relatedItemsBanner: {
        marginVertical: 15,
        borderRadius: 10,
        overflow: 'hidden',
    },
    relatedItemsGradient: {
        padding: 12,
        borderRadius: 10,
    },
    relatedItemsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    relatedItemsText: {
        flex: 1,
        color: WHITE,
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 10,
    },
    quickAddButtonTop: {
        position: 'absolute',
        top: 5,
        right: 5,
        borderWidth: 1.5,
        borderColor: '#4CAF50',
        borderRadius: 20,
        backgroundColor: 'transparent',
        paddingVertical: 4,
        paddingHorizontal: 10,
        zIndex: 10,
    },
    quickAddButtonBottom: {
        marginTop: 8,
        marginBottom: 16,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#4CAF50',
        borderRadius: 8,
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    quickAddButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickAddButtonText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 3,
    },
    quickAddButtonTextBottom: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: '600',
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

export default FoodDetailScreen; 