import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    StatusBar,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { addFoodLog } from '../utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// Modern color scheme
const COLORS = {
    PRIMARY_BG: '#000000',
    SECONDARY_BG: '#111111',
    CARD_BG: '#1a1a1a',
    WHITE: '#FFFFFF',
    GRAY_LIGHT: '#B0B0B0',
    GRAY_MEDIUM: '#808080',
    GRAY_DARK: '#333333',
    ACCENT_BLUE: '#0084ff',
    ACCENT_GREEN: '#32D74B',
    ACCENT_ORANGE: '#FF9500',
    ACCENT_RED: '#FF3B30',
    ACCENT_PURPLE: '#AF52DE',
    ACCENT_PINK: '#FF2D92',
    GLASS: 'rgba(255, 255, 255, 0.1)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
};

// Navigation types
type RootStackParamList = {
    'Food Log': { refresh?: number };
    BarcodeScanner: undefined;
    ScannedProduct: { foodData: any; mealType?: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'ScannedProduct'>;

const ScannedProduct: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { foodData, mealType: initialMealType } = route.params as { foodData: any; mealType?: string };

    // State management
    const [mealType, setMealType] = useState(initialMealType || 'Snacks');
    const [quantity, setQuantity] = useState(foodData?.serving_qty ? String(foodData.serving_qty) : '1');
    const [servingUnit, setServingUnit] = useState(foodData?.serving_unit || 'serving');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const mealTypes = [
        { name: 'Breakfast', icon: 'sunny-outline', color: COLORS.ACCENT_ORANGE },
        { name: 'Lunch', icon: 'restaurant-outline', color: COLORS.ACCENT_GREEN },
        { name: 'Dinner', icon: 'moon-outline', color: COLORS.ACCENT_BLUE },
        { name: 'Snacks', icon: 'cafe-outline', color: COLORS.ACCENT_PINK }
    ];

    // Calculate nutrition values based on quantity
    const calculateNutrition = (baseValue: number, currentQuantity: string) => {
        const qty = parseFloat(currentQuantity) || 1;
        const baseQty = foodData?.serving_qty || 1;
        return Math.round((baseValue * qty) / baseQty);
    };

    // Get the best available image from API
    const getProductImage = () => {
        if (foodData?.photo?.thumb) return foodData.photo.thumb;
        if (foodData?.photo?.highres) return foodData.photo.highres;
        if (foodData?.image_url) return foodData.image_url;
        if (foodData?.thumbnail) return foodData.thumbnail;
        return null;
    };

    // Calculate nutrition values
    const calories = calculateNutrition(foodData.calories || 0, quantity);
    const proteins = calculateNutrition(foodData.proteins || 0, quantity);
    const carbs = calculateNutrition(foodData.carbs || 0, quantity);
    const fats = calculateNutrition(foodData.fats || 0, quantity);
    const fiber = foodData.fiber ? calculateNutrition(foodData.fiber, quantity) : null;
    const sugar = foodData.sugar ? calculateNutrition(foodData.sugar, quantity) : null;
    const sodium = foodData.sodium ? calculateNutrition(foodData.sodium, quantity) : null;

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Get user ID from storage
            const userId = await AsyncStorage.getItem('user_id');
            if (!userId) {
                Alert.alert('Error', 'Please log in to continue');
                return;
            }

            // Prepare food log entry
            const foodLogEntry = {
                user_id: parseInt(userId),
                meal_type: mealType,
                food_name: foodData.food_name || 'Unknown Food',
                brand_name: foodData.brand_name || '',
                quantity: `${quantity} ${servingUnit}`,
                calories: calories,
                proteins: proteins,
                carbs: carbs,
                fats: fats,
                notes: notes ? `${notes} | Scanned product` : 'Scanned product',
                timestamp: new Date().toISOString(),
            };

            console.log('Adding food log entry:', foodLogEntry);

            // Add to database
            const result = await addFoodLog(foodLogEntry);

            if (result) {
                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                Alert.alert(
                    '✅ Added Successfully!',
                    `${foodData.food_name} has been added to your ${mealType.toLowerCase()}.`,
                    [
                        {
                            text: 'View Food Log',
                            onPress: () => navigation.navigate('Food Log', { refresh: Date.now() })
                        },
                        {
                            text: 'Scan Another',
                            onPress: () => navigation.navigate('BarcodeScanner'),
                            style: 'default'
                        }
                    ]
                );
            } else {
                throw new Error('Failed to add food log entry');
            }
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const productImage = getProductImage();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_BG} />

            {/* Header */}
            <BlurView intensity={30} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Facts</Text>
                <TouchableOpacity style={styles.headerButton}>
                    <Ionicons name="bookmark-outline" size={24} color={COLORS.GRAY_LIGHT} />
                </TouchableOpacity>
            </BlurView>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Enhanced Product Header with Image */}
                <View style={styles.productHeaderCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <View style={styles.productSection}>
                            <View style={styles.productImageSection}>
                                {productImage ? (
                                    <View style={styles.productImageContainer}>
                                        <Image
                                            source={{ uri: productImage }}
                                            style={styles.productImage}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.scanBadge}>
                                            <MaterialCommunityIcons name="barcode-scan" size={10} color={COLORS.ACCENT_BLUE} />
                                            <Text style={styles.scanBadgeText}>SCANNED</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.placeholderImageContainer}>
                                        <MaterialCommunityIcons name="food" size={40} color={COLORS.GRAY_MEDIUM} />
                                        <View style={styles.scanBadge}>
                                            <MaterialCommunityIcons name="barcode-scan" size={10} color={COLORS.ACCENT_BLUE} />
                                            <Text style={styles.scanBadgeText}>SCANNED</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={styles.productInfoSection}>
                                <Text style={styles.productName} numberOfLines={2}>
                                    {foodData.food_name || 'Unknown Product'}
                                </Text>
                                {foodData.brand_name && (
                                    <Text style={styles.brandName}>{foodData.brand_name}</Text>
                                )}

                                {/* Serving Controls - Inline */}
                                <View style={styles.servingControls}>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => setQuantity(String(Math.max(0.1, parseFloat(quantity) - 0.5)))}
                                    >
                                        <Ionicons name="remove" size={16} color={COLORS.WHITE} />
                                    </TouchableOpacity>
                                    <View style={styles.quantityDisplay}>
                                        <TextInput
                                            style={styles.quantityInput}
                                            value={quantity}
                                            onChangeText={setQuantity}
                                            keyboardType="decimal-pad"
                                            selectTextOnFocus
                                        />
                                        <Text style={styles.servingUnitText}>{servingUnit}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => setQuantity(String(parseFloat(quantity) + 0.5))}
                                    >
                                        <Ionicons name="add" size={16} color={COLORS.WHITE} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Enhanced Nutrition Display */}
                <View style={styles.nutritionCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        {/* Large Calorie Display */}
                        <View style={styles.caloriesContainer}>
                            <Text style={styles.caloriesValue}>{calories}</Text>
                            <Text style={styles.caloriesLabel}>calories</Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.sectionDivider} />

                        {/* Enhanced Macros with Progress Bars */}
                        <View style={styles.macrosRow}>
                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{carbs}g</Text>
                                    <Text style={styles.macroLabel}>Carbs</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_BLUE + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (carbs / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_BLUE
                                    }]} />
                                </View>
                            </View>

                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{proteins}g</Text>
                                    <Text style={styles.macroLabel}>Protein</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_GREEN + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (proteins / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_GREEN
                                    }]} />
                                </View>
                            </View>

                            <View style={styles.macroItem}>
                                <View style={styles.macroHeader}>
                                    <Text style={styles.macroValue}>{fats}g</Text>
                                    <Text style={styles.macroLabel}>Fat</Text>
                                </View>
                                <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_ORANGE + '30' }]}>
                                    <View style={[styles.macroProgress, {
                                        width: `${Math.min(100, (fats / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                        backgroundColor: COLORS.ACCENT_ORANGE
                                    }]} />
                                </View>
                            </View>
                        </View>

                        {/* Additional Nutrients - Compact */}
                        {(fiber || sugar || sodium) && (
                            <>
                                <View style={styles.sectionDivider} />
                                <View style={styles.additionalNutrients}>
                                    <Text style={styles.sectionSubtitle}>Additional Info</Text>
                                    <View style={styles.nutrientGrid}>
                                        {fiber && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{fiber}g</Text>
                                                <Text style={styles.nutrientLabel}>Fiber</Text>
                                            </View>
                                        )}
                                        {sugar && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{sugar}g</Text>
                                                <Text style={styles.nutrientLabel}>Sugar</Text>
                                            </View>
                                        )}
                                        {sodium && (
                                            <View style={styles.nutrientItem}>
                                                <Text style={styles.nutrientValue}>{sodium}mg</Text>
                                                <Text style={styles.nutrientLabel}>Sodium</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </>
                        )}
                    </LinearGradient>
                </View>

                {/* Enhanced Meal Type Selection */}
                <View style={styles.mealCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <Text style={styles.sectionTitle}>Add to Meal</Text>
                        <View style={styles.mealTypeGrid}>
                            {mealTypes.map((meal) => (
                                <TouchableOpacity
                                    key={meal.name}
                                    style={[
                                        styles.mealTypeButton,
                                        mealType === meal.name && styles.activeMealType
                                    ]}
                                    onPress={() => setMealType(meal.name)}
                                >
                                    <Ionicons
                                        name={meal.icon as any}
                                        size={24}
                                        color={mealType === meal.name ? COLORS.WHITE : meal.color}
                                    />
                                    <Text style={[
                                        styles.mealTypeText,
                                        mealType === meal.name && styles.activeMealTypeText
                                    ]}>
                                        {meal.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </LinearGradient>
                </View>

                {/* Enhanced Notes */}
                <View style={styles.notesCard}>
                    <LinearGradient
                        colors={[COLORS.CARD_BG, COLORS.SECONDARY_BG]}
                        style={styles.cardGradient}
                    >
                        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add any notes about this food..."
                            placeholderTextColor={COLORS.GRAY_MEDIUM}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            maxLength={200}
                        />
                    </LinearGradient>
                </View>

                {/* Bottom spacing for fixed button */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Fixed Bottom Action */}
            <View style={styles.bottomContainer}>
                <LinearGradient
                    colors={[COLORS.PRIMARY_BG + 'F0', COLORS.PRIMARY_BG]}
                    style={styles.bottomGradient}
                >
                    <TouchableOpacity
                        style={[styles.addButton, loading && styles.addButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={loading ? [COLORS.GRAY_MEDIUM, COLORS.GRAY_DARK] : [COLORS.ACCENT_BLUE, COLORS.ACCENT_PURPLE]}
                            style={styles.addButtonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={COLORS.WHITE} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={20} color={COLORS.WHITE} />
                                    <Text style={styles.addButtonText}>Add to {mealType}</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.GRAY_DARK,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.GLASS,
        borderWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.WHITE,
    },
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },

    // Card Styles
    productHeaderCard: {
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    nutritionCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    mealCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    notesCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    cardGradient: {
        padding: 20,
    },

    // Product Section
    productSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productImageSection: {
        marginRight: 20,
    },
    productImageContainer: {
        position: 'relative',
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: COLORS.GRAY_DARK,
    },
    placeholderImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: COLORS.GRAY_DARK,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    scanBadge: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.ACCENT_BLUE + '20',
        borderColor: COLORS.ACCENT_BLUE,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    scanBadgeText: {
        fontSize: 8,
        color: COLORS.ACCENT_BLUE,
        marginLeft: 2,
        fontWeight: '600',
    },
    productInfoSection: {
        flex: 1,
    },
    productName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.WHITE,
        lineHeight: 24,
        marginBottom: 4,
    },
    brandName: {
        fontSize: 14,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
        marginBottom: 16,
    },

    // Serving Controls
    servingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    quantityButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.ACCENT_PINK,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityDisplay: {
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 16,
    },
    quantityInput: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 60,
        marginBottom: 4,
    },
    servingUnitText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 12,
        fontWeight: '500',
    },

    // Calories Section
    caloriesContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    caloriesValue: {
        fontSize: 48,
        fontWeight: '800',
        color: COLORS.WHITE,
        lineHeight: 56,
    },
    caloriesLabel: {
        fontSize: 16,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
        marginTop: 4,
    },

    // Divider
    sectionDivider: {
        height: 1,
        backgroundColor: COLORS.GRAY_DARK,
        marginVertical: 20,
    },

    // Macros
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    macroItem: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    macroHeader: {
        alignItems: 'center',
        marginBottom: 8,
    },
    macroValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.WHITE,
        marginBottom: 2,
    },
    macroLabel: {
        fontSize: 12,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },
    macroBar: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    macroProgress: {
        height: '100%',
        borderRadius: 3,
    },

    // Additional Nutrients
    additionalNutrients: {
        marginTop: 20,
    },
    sectionSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 12,
    },
    nutrientGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    nutrientItem: {
        width: '30%',
        alignItems: 'center',
        marginBottom: 8,
    },
    nutrientValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.WHITE,
        marginBottom: 2,
    },
    nutrientLabel: {
        fontSize: 12,
        color: COLORS.GRAY_LIGHT,
        fontWeight: '500',
    },

    // Meal Selection
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 16,
    },
    mealTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    mealTypeButton: {
        width: '48%',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activeMealType: {
        backgroundColor: COLORS.ACCENT_PINK,
        borderColor: COLORS.ACCENT_PINK,
    },
    mealTypeText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    activeMealTypeText: {
        color: COLORS.WHITE,
    },

    // Notes
    notesInput: {
        color: COLORS.WHITE,
        fontSize: 16,
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // Bottom Action
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    bottomGradient: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 32,
    },
    addButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    addButtonDisabled: {
        opacity: 0.6,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    addButtonText: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 8,
    },
});

export default ScannedProduct; 