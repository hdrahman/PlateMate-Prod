import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getFoodLogById } from '../utils/database';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Theme colors matching the app
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const LIGHT_GRAY = '#2A2A2A';
const PURPLE_ACCENT = '#AA00FF';

// Define navigation types
type RootStackParamList = {
    FoodDetail: { foodId: number };
    FoodLog: undefined;
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

    useEffect(() => {
        loadFoodData();
    }, [foodId]);

    const loadFoodData = async () => {
        try {
            setLoading(true);
            const data = await getFoodLogById(foodId);
            setFoodData(data);
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

    // Render nutrient row with integrated style
    const renderNutrientRow = (label: string, value: number, unit: string = 'g', showBorder: boolean = true) => (
        <View style={[styles.nutrientRow, !showBorder && { borderBottomWidth: 0 }]}>
            <Text style={styles.nutrientLabel}>{label}</Text>
            <Text style={styles.nutrientValue}>
                {value.toFixed(value < 1 && value > 0 ? 1 : 0)}{unit}
            </Text>
        </View>
    );

    // Render macro circle
    const renderMacroCircle = (label: string, value: number, unit: string, percentage: number, color: string) => (
        <View style={styles.macroCircle}>
            <View style={[styles.macroCircleInner, { borderColor: color }]}>
                <Text style={styles.macroValue}>{value}{unit}</Text>
                <Text style={styles.macroPercentage}>{percentage}%</Text>
            </View>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );

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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

            {/* Floating Header */}
            <SafeAreaView style={styles.floatingHeader}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerButton}
                >
                    <View style={styles.headerButtonBackground}>
                        <Ionicons name="chevron-back" size={24} color={WHITE} />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerButton}>
                    <View style={styles.headerButtonBackground}>
                        <Ionicons name="heart-outline" size={22} color={WHITE} />
                    </View>
                </TouchableOpacity>
            </SafeAreaView>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Hero Section with Image */}
                <View style={styles.heroSection}>
                    {!imageError && foodData.image_url ? (
                        <Image
                            source={{ uri: foodData.image_url }}
                            style={styles.heroImage}
                            onError={() => setImageError(true)}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholderHero}>
                            <Ionicons name="restaurant" size={80} color={SUBDUED} />
                        </View>
                    )}

                    {/* Gradient Overlay */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.9)']}
                        style={styles.heroGradient}
                    />

                    {/* Hero Content */}
                    <View style={styles.heroContent}>
                        {foodData.healthiness_rating && (
                            <View style={[
                                styles.healthinessBadge,
                                { backgroundColor: getHealthinessColor(foodData.healthiness_rating) + '20', borderColor: getHealthinessColor(foodData.healthiness_rating) }
                            ]}>
                                <Text style={[styles.healthinessBadgeText, { color: getHealthinessColor(foodData.healthiness_rating) }]}>
                                    Health Score: {Math.round(foodData.healthiness_rating)}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.heroTitle}>{foodData.food_name}</Text>
                        <Text style={styles.heroMealType}>{foodData.meal_type} • {new Date(foodData.date).toLocaleDateString()}</Text>
                    </View>
                </View>

                {/* Main Content Container */}
                <View style={styles.contentContainer}>

                    {/* Calories Section */}
                    <View style={styles.calorieSection}>
                        <Text style={styles.calorieNumber}>{foodData.calories}</Text>
                        <Text style={styles.calorieLabel}>calories</Text>
                        {foodData.quantity && (
                            <Text style={styles.servingText}>per {foodData.quantity}</Text>
                        )}
                    </View>

                    {/* Macros Visual Section */}
                    <View style={styles.macrosSection}>
                        <Text style={styles.sectionTitle}>Macronutrients</Text>
                        <View style={styles.macrosRow}>
                            {renderMacroCircle('Carbs', foodData.carbs, 'g', macroPercentages.carbs, '#4FC3F7')}
                            {renderMacroCircle('Protein', foodData.proteins, 'g', macroPercentages.protein, '#66BB6A')}
                            {renderMacroCircle('Fat', foodData.fats, 'g', macroPercentages.fat, '#FFB74D')}
                        </View>
                    </View>

                    {/* Detailed Nutrients */}
                    <View style={styles.detailsSection}>
                        <Text style={styles.sectionTitle}>Nutrition Facts</Text>

                        {/* Main Macros */}
                        <View style={styles.nutrientGroup}>
                            {renderNutrientRow('Total Carbohydrates', foodData.carbs)}
                            {renderNutrientRow('  Dietary Fiber', foodData.fiber)}
                            {renderNutrientRow('  Total Sugars', foodData.sugar)}
                            {renderNutrientRow('Protein', foodData.proteins)}
                            {renderNutrientRow('Total Fat', foodData.fats, 'g', false)}
                        </View>

                        {/* Fat Details */}
                        <View style={styles.nutrientGroup}>
                            <Text style={styles.subSectionTitle}>Fat Breakdown</Text>
                            {renderNutrientRow('  Saturated Fat', foodData.saturated_fat)}
                            {renderNutrientRow('  Trans Fat', foodData.trans_fat)}
                            {renderNutrientRow('  Polyunsaturated Fat', foodData.polyunsaturated_fat)}
                            {renderNutrientRow('  Monounsaturated Fat', foodData.monounsaturated_fat, 'g', false)}
                        </View>

                        {/* Vitamins & Minerals */}
                        <View style={styles.nutrientGroup}>
                            <Text style={styles.subSectionTitle}>Vitamins & Minerals</Text>
                            {renderNutrientRow('Cholesterol', foodData.cholesterol, 'mg')}
                            {renderNutrientRow('Sodium', foodData.sodium, 'mg')}
                            {renderNutrientRow('Potassium', foodData.potassium, 'mg')}
                            {renderNutrientRow('Vitamin A', foodData.vitamin_a, 'mcg')}
                            {renderNutrientRow('Vitamin C', foodData.vitamin_c, 'mg')}
                            {renderNutrientRow('Calcium', foodData.calcium, 'mg')}
                            {renderNutrientRow('Iron', foodData.iron, 'mg', false)}
                        </View>

                        {/* Additional Information */}
                        {(foodData.brand_name || foodData.weight || foodData.notes) && (
                            <View style={styles.additionalInfo}>
                                <Text style={styles.subSectionTitle}>Additional Information</Text>
                                {foodData.brand_name && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Brand</Text>
                                        <Text style={styles.infoValue}>{foodData.brand_name}</Text>
                                    </View>
                                )}
                                {foodData.weight && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Weight</Text>
                                        <Text style={styles.infoValue}>{foodData.weight}{foodData.weight_unit || 'g'}</Text>
                                    </View>
                                )}
                                {foodData.notes && (
                                    <View style={styles.notesContainer}>
                                        <Text style={styles.infoLabel}>Notes</Text>
                                        <Text style={styles.notesText}>{foodData.notes}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Bottom Spacing */}
                    <View style={{ height: 60 }} />
                </View>
            </ScrollView>
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
    floatingHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        zIndex: 100,
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
    scrollView: {
        flex: 1,
    },
    heroSection: {
        height: screenHeight * 0.45,
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    placeholderHero: {
        width: '100%',
        height: '100%',
        backgroundColor: LIGHT_GRAY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70%',
    },
    heroContent: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    healthinessBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
    },
    healthinessBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: WHITE,
        marginBottom: 8,
        lineHeight: 38,
    },
    heroMealType: {
        fontSize: 16,
        color: SUBDUED,
        textTransform: 'capitalize',
    },
    contentContainer: {
        backgroundColor: PRIMARY_BG,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        paddingTop: 24,
        paddingHorizontal: 20,
        minHeight: screenHeight * 0.6,
    },
    calorieSection: {
        alignItems: 'center',
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
        marginBottom: 32,
    },
    calorieNumber: {
        fontSize: 64,
        fontWeight: '300',
        color: WHITE,
        lineHeight: 70,
    },
    calorieLabel: {
        fontSize: 16,
        color: SUBDUED,
        marginTop: -8,
    },
    servingText: {
        fontSize: 14,
        color: SUBDUED,
        marginTop: 8,
    },
    macrosSection: {
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 20,
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
        marginBottom: 40,
    },
    nutrientGroup: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    nutrientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    nutrientLabel: {
        fontSize: 16,
        color: WHITE,
        flex: 1,
    },
    nutrientValue: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
    },
    subSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: PURPLE_ACCENT,
        marginBottom: 12,
    },
    additionalInfo: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 20,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 16,
        color: SUBDUED,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
        color: WHITE,
    },
    notesContainer: {
        marginTop: 12,
    },
    notesText: {
        fontSize: 14,
        color: WHITE,
        lineHeight: 20,
        marginTop: 8,
    },
});

export default FoodDetailScreen; 