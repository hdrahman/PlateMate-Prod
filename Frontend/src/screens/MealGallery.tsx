import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Dimensions,
    Alert,
    StatusBar,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAllMealImages } from '../utils/database';
import { getLocalStorageInfo } from '../utils/localFileStorage';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';

const { width } = Dimensions.get('window');
const PADDING = 16;
const SPACING = 12;
const NUM_COLUMNS = 2;
const IMAGE_SIZE = (width - (PADDING * 2) - (SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

// Theme colors
const PRIMARY_BG = '#000000';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';
const GRADIENT_COLORS = ["#FF00F5", "#9B00FF", "#00CFFF"] as const;

// Define navigation types
type RootStackParamList = {
    FoodLog: undefined;
    FoodDetail: { foodId: number };
    // Add other screens as needed
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'FoodLog'>;

interface MealImage {
    id: number;
    food_name: string;
    image_url: string;
    date: string;
    meal_type: string;
    calories: number;
    meal_id: number;
}

interface MealStats {
    totalMeals: number;
    totalPhotos: number;
    totalCalories: number;
    avgCaloriesPerMeal: number;
    mostFrequentFood: string;
    mostFrequentMealType: string;
    highestCalorieMeal: { name: string; calories: number };
    thisMonthMeals: number;
    storageUsed: string;
}

const MealGallery: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [mealImages, setMealImages] = useState<MealImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [mealStats, setMealStats] = useState<MealStats | null>(null);

    // Load meal images when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            loadMealImages();
        }, [])
    );

    const loadMealImages = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load meal images from local storage
            const images = await getAllMealImages();
            setMealImages(images);

            // Calculate stats
            const stats = await calculateMealStats(images);
            setMealStats(stats);
        } catch (err) {
            console.error('Error loading meal images:', err);
            setError('Failed to load meal images');
            Alert.alert('Error', 'Failed to load meal images. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const calculateMealStats = async (images: MealImage[]): Promise<MealStats> => {
        const storageInfo = await getLocalStorageInfo();

        // Group by meal_id to get unique meals
        const uniqueMeals = new Map();
        images.forEach(img => {
            if (!uniqueMeals.has(img.meal_id)) {
                uniqueMeals.set(img.meal_id, img);
            }
        });

        const meals = Array.from(uniqueMeals.values());

        // Calculate total calories (excluding negative sentinel values)
        const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories > 0 ? meal.calories : 0), 0);

        // Find most frequent food
        const foodCounts = new Map();
        meals.forEach(meal => {
            const food = meal.food_name || 'Unknown';
            foodCounts.set(food, (foodCounts.get(food) || 0) + 1);
        });
        const mostFrequentFood = Array.from(foodCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

        // Find most frequent meal type
        const mealTypeCounts = new Map();
        meals.forEach(meal => {
            const type = meal.meal_type || 'Unknown';
            mealTypeCounts.set(type, (mealTypeCounts.get(type) || 0) + 1);
        });
        const mostFrequentMealType = Array.from(mealTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

        // Find highest calorie meal
        const highestCalorieMeal = meals.reduce((max, meal) =>
            (meal.calories || 0) > (max.calories || 0) ? meal : max,
            { food_name: 'Unknown', calories: 0 }
        );

        // Count this month's meals
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const thisMonthMeals = meals.filter(meal => {
            const mealDate = new Date(meal.date);
            return mealDate.getMonth() === thisMonth && mealDate.getFullYear() === thisYear;
        }).length;

        return {
            totalMeals: meals.length,
            totalPhotos: images.length,
            totalCalories,
            avgCaloriesPerMeal: meals.length > 0 ? Math.round(totalCalories / meals.length) : 0,
            mostFrequentFood,
            mostFrequentMealType,
            highestCalorieMeal: {
                name: highestCalorieMeal.food_name || 'Unknown',
                calories: highestCalorieMeal.calories || 0
            },
            thisMonthMeals,
            storageUsed: `${storageInfo.totalSizeMB} MB`
        };
    };

    const renderMealImage = ({ item, index }: { item: MealImage; index: number }) => {
        // Skip items without valid image URLs
        if (!item.image_url || item.image_url === 'https://via.placeholder.com/150' || item.image_url === '') {
            return null;
        }

        const isLeftColumn = index % 2 === 0;

        return (
            <TouchableOpacity
                style={[
                    styles.imageContainer,
                    isLeftColumn ? styles.leftColumn : styles.rightColumn,
                    { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }
                ]}
                onPress={() => {
                    navigation.navigate('FoodDetail', { foodId: item.id });
                }}
            >
                <Image
                    source={{ uri: item.image_url }}
                    style={styles.mealImage}
                    resizeMode="cover"
                />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.imageOverlay}
                >
                    <View style={styles.overlayContent}>
                        <Text style={[styles.foodName, { color: theme.colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                            {item.food_name}
                        </Text>
                        <Text style={[styles.mealInfo, { color: theme.colors.text }]}>
                            {item.meal_type} • {item.calories} cal
                        </Text>
                        <Text style={[styles.dateText, { color: theme.colors.text }]}>
                            {new Date(item.date).toLocaleDateString()}
                        </Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderSummaryCard = () => {
        if (!mealStats) return null;

        return (
            <View style={styles.summaryContainer}>
                <LinearGradient
                    colors={GRADIENT_COLORS}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.summaryGradient}
                >
                    <View style={styles.summaryContent}>
                        <View style={styles.summaryHeader}>
                            <Ionicons name="trophy" size={24} color={theme.colors.text} />
                            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Your Food Journey</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statNumber}>{mealStats.totalMeals}</Text>
                                <Text style={styles.statLabel}>Meals Captured</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statNumber}>{mealStats.thisMonthMeals}</Text>
                                <Text style={styles.statLabel}>This Month</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statNumber}>{Math.round(mealStats.totalCalories / 1000)}K</Text>
                                <Text style={styles.statLabel}>Total Calories</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statNumber}>{mealStats.avgCaloriesPerMeal}</Text>
                                <Text style={styles.statLabel}>Avg per Meal</Text>
                            </View>
                        </View>

                        <View style={styles.insightsSection}>
                            <Text style={styles.insightTitle}>🍽️ Your Food Insights</Text>
                            <Text style={styles.insightText}>
                                Your go-to meal: <Text style={styles.highlightText}>{mealStats.mostFrequentFood}</Text>
                            </Text>
                            <Text style={styles.insightText}>
                                Favorite time: <Text style={styles.highlightText}>{mealStats.mostFrequentMealType}</Text>
                            </Text>
                            <Text style={styles.insightText}>
                                Biggest feast: <Text style={styles.highlightText}>{mealStats.highestCalorieMeal.name} ({mealStats.highestCalorieMeal.calories} cal)</Text>
                            </Text>
                            <Text style={styles.insightText}>
                                Storage used: <Text style={styles.highlightText}>{mealStats.storageUsed}</Text>
                            </Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Meal Images</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Start logging your meals with photos to see them here!
            </Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
                <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meal Gallery</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading meal images...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
                <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meal Gallery</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Something went wrong</Text>
                    <Text style={[styles.errorSubtitle, { color: theme.colors.textSecondary }]}>{error}</Text>
                    <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={loadMealImages}>
                        <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meal Gallery</Text>
                <TouchableOpacity
                    style={styles.summaryButton}
                    onPress={() => setShowSummary(!showSummary)}
                >
                    <Ionicons name={showSummary ? "stats-chart" : "stats-chart-outline"} size={24} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {mealImages.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <>
                        {showSummary && renderSummaryCard()}

                        <View style={styles.galleryHeader}>
                            <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
                                {mealImages.length} meal{mealImages.length !== 1 ? 's' : ''} with photos
                            </Text>
                        </View>

                        <View style={styles.gridContainer}>
                            {mealImages.map((item, index) => (
                                <View key={item.id} style={styles.gridItem}>
                                    {renderMealImage({ item, index })}
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: PADDING,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        backgroundColor: PRIMARY_BG,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: WHITE,
    },
    summaryButton: {
        padding: 8,
        borderRadius: 8,
    },
    placeholder: {
        width: 40,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: PADDING,
    },
    summaryContainer: {
        marginTop: 16,
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    summaryGradient: {
        padding: 20,
    },
    summaryContent: {
        alignItems: 'center',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: WHITE,
        marginLeft: 8,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    statCard: {
        width: '48%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: WHITE,
    },
    statLabel: {
        fontSize: 12,
        color: WHITE,
        opacity: 0.8,
        marginTop: 4,
        textAlign: 'center',
    },
    insightsSection: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 12,
        textAlign: 'center',
    },
    insightText: {
        fontSize: 14,
        color: WHITE,
        marginBottom: 6,
        opacity: 0.9,
    },
    highlightText: {
        fontWeight: 'bold',
        color: WHITE,
    },
    galleryHeader: {
        marginTop: 8,
        marginBottom: 16,
    },
    countText: {
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingBottom: 20,
    },
    gridItem: {
        width: '48%',
        marginBottom: SPACING,
    },
    imageContainer: {
        width: '100%',
        height: IMAGE_SIZE + 80, // Increased height for better text display
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    leftColumn: {
        // No additional margin needed
    },
    rightColumn: {
        // No additional margin needed
    },
    mealImage: {
        width: '100%',
        height: IMAGE_SIZE - 20, // Reduced image height to give more space for text
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100, // Increased overlay height
        justifyContent: 'flex-end',
    },
    overlayContent: {
        padding: 12,
        paddingBottom: 16,
    },
    foodName: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 4,
        lineHeight: 18,
    },
    mealInfo: {
        fontSize: 12,
        color: WHITE,
        marginBottom: 4,
        opacity: 0.9,
    },
    dateText: {
        fontSize: 11,
        color: WHITE,
        opacity: 0.7,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: SUBDUED,
        marginTop: 12,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: WHITE,
        marginTop: 16,
        marginBottom: 8,
    },
    errorSubtitle: {
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: PURPLE_ACCENT,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        marginTop: 100,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: WHITE,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
    },
});

export default MealGallery; 