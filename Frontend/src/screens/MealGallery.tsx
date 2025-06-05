import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getAllMealImages } from '../utils/database';
import { getLocalStorageInfo } from '../utils/localFileStorage';

const { width } = Dimensions.get('window');
const PADDING = 16;
const SPACING = 8;
const NUM_COLUMNS = 2;
const IMAGE_SIZE = (width - (PADDING * 2) - (SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

// Theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

// Define navigation types
type RootStackParamList = {
    FoodLog: undefined;
    // Add other screens as needed
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface MealImage {
    id: number;
    food_name: string;
    image_url: string;
    date: string;
    meal_type: string;
    calories: number;
}

const MealGallery: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const [mealImages, setMealImages] = useState<MealImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [storageInfo, setStorageInfo] = useState<{
        totalImages: number;
        totalSizeMB: number;
        directoryPath: string;
    } | null>(null);

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

            // Get local storage information
            const storage = await getLocalStorageInfo();
            setStorageInfo(storage);
        } catch (err) {
            console.error('Error loading meal images:', err);
            setError('Failed to load meal images');
            Alert.alert('Error', 'Failed to load meal images. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderMealImage = ({ item }: { item: MealImage }) => {
        // Skip items without valid image URLs
        if (!item.image_url || item.image_url === 'https://via.placeholder.com/150' || item.image_url === '') {
            return null;
        }

        return (
            <TouchableOpacity
                style={styles.imageContainer}
                onPress={() => {
                    // TODO: Navigate to meal detail screen or implement image viewer
                    console.log('Meal image tapped:', item);
                }}
            >
                <Image
                    source={{ uri: item.image_url }}
                    style={styles.mealImage}
                    resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                    <Text style={styles.foodName} numberOfLines={2}>
                        {item.food_name}
                    </Text>
                    <Text style={styles.mealInfo}>
                        {item.meal_type} • {item.calories} cal
                    </Text>
                    <Text style={styles.dateText}>
                        {new Date(item.date).toLocaleDateString()}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="camera-outline" size={64} color={SUBDUED} />
            <Text style={styles.emptyTitle}>No Meal Images</Text>
            <Text style={styles.emptySubtitle}>
                Start logging your meals with photos to see them here!
            </Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Meal Gallery</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                    <Text style={styles.loadingText}>Loading meal images...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Meal Gallery</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={SUBDUED} />
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <Text style={styles.errorSubtitle}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadMealImages}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Meal Gallery</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.contentContainer}>
                {mealImages.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <>
                        <View style={styles.statsContainer}>
                            <Text style={styles.countText}>
                                {mealImages.length} meal{mealImages.length !== 1 ? 's' : ''} with photos
                            </Text>
                            {storageInfo && (
                                <Text style={styles.storageText}>
                                    📱 Local storage: {storageInfo.totalSizeMB} MB
                                </Text>
                            )}
                        </View>
                        <FlatList
                            data={mealImages}
                            renderItem={renderMealImage}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={NUM_COLUMNS}
                            contentContainerStyle={styles.gridContainer}
                            columnWrapperStyle={NUM_COLUMNS > 1 ? styles.row : undefined}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                )}
            </View>
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
        paddingTop: 12, // SafeAreaView now handles safe area spacing
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        backgroundColor: PRIMARY_BG, // Ensure header has background
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
    placeholder: {
        width: 40, // Same width as back button
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: PADDING,
        paddingTop: 16,
    },
    countText: {
        fontSize: 16,
        color: SUBDUED,
        marginBottom: 8,
    },
    statsContainer: {
        marginBottom: 16,
    },
    storageText: {
        fontSize: 14,
        color: SUBDUED,
        opacity: 0.7,
    },
    gridContainer: {
        paddingBottom: 16,
    },
    row: {
        justifyContent: 'space-between',
    },
    imageContainer: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE + 60, // Extra height for text overlay
        marginBottom: SPACING,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: CARD_BG,
    },
    mealImage: {
        width: '100%',
        height: IMAGE_SIZE,
    },
    imageOverlay: {
        padding: 8,
        backgroundColor: CARD_BG,
        flex: 1,
        justifyContent: 'space-between',
    },
    foodName: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 4,
    },
    mealInfo: {
        fontSize: 12,
        color: SUBDUED,
        marginBottom: 2,
    },
    dateText: {
        fontSize: 11,
        color: SUBDUED,
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