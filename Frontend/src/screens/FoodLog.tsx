import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    TouchableWithoutFeedback,
    Animated,
    Dimensions,
    ActivityIndicator,
    Modal,
    TouchableHighlight,
    Alert,
    AppState,
    TextInput,
    FlatList,
    ViewStyle,
    TextStyle
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { PanGestureHandler, GestureHandlerRootView, State as GestureState } from 'react-native-gesture-handler';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFoodLogsByDate, getExercisesByDate, addExercise, deleteFoodLog, updateFoodLog, isDatabaseReady, deleteExercise } from '../utils/database';
import { isOnline } from '../utils/syncService';
import { BACKEND_URL } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExerciseModal from '../components/ExerciseModal';

const { width: screenWidth } = Dimensions.get('window');

// Helper function to format date as YYYY-MM-DD
const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Define the navigation type
type RootStackParamList = {
    ImageCapture: { mealType: string };
    // Add other screens as needed
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Define types for meal data
interface MealItem {
    name: string;
    calories: number;
    healthiness?: number;  // Add healthiness rating
}

interface MealMacros {
    carbs: number;
    fat: number;
    protein: number;
}

interface Meal {
    title: string;
    total: number;
    macros: MealMacros;
    items: MealItem[];
}

// Define type for food log entry from database
interface FoodLogEntry {
    id: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    weight?: number;  // Add weight field
    weight_unit?: string;  // Add weight unit field
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

// Define the Exercise interface
interface Exercise {
    id?: number;
    exercise_name: string;
    calories_burned: number;
    duration: number;
    date?: string;
    notes?: string;
}

// Add interface for route params
type FoodLogRouteParams = {
    refresh?: number;
};

const DiaryScreen: React.FC = () => {
    const [mealData, setMealData] = useState<Meal[]>([]);
    const [breakfastEntries, setBreakfastEntries] = useState([]);
    const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const [currentDate, setCurrentDate] = useState(new Date());
    const processedMealData = useRef(false);
    const [loading, setLoading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const localMealDataRef = useRef<FoodLogEntry[] | null>(null);
    const scrollRef = useRef(null); // added scroll ref for simultaneous gesture handling

    // Define valid meal types
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    // Helper function to get color based on healthiness rating
    const getHealthinessColor = (rating: number): string => {
        if (rating <= 4) return '#FF5252'; // Red for unhealthy (0-4)
        if (rating <= 7) return '#FFD740'; // Yellow for moderate (5-7)
        return '#4CAF50'; // Green for healthy (8-10)
    };

    // Update the route.params effect to properly refresh the data
    useEffect(() => {
        const params = route.params as FoodLogRouteParams;
        if (params?.refresh) {
            console.log('Detected refresh parameter in route.params:', params.refresh);

            // Use a timer to ensure SQLite has time to complete its operations
            // before we trigger a refresh
            setTimeout(() => {
                console.log('Executing delayed refresh from route params');
                refreshMealData();
            }, 500);
        }
    }, [route.params]);

    // Additional style to ensure black background during transitions
    const containerStyle = {
        flex: 1,
        backgroundColor: PRIMARY_BG, // PRIMARY_BG is '#000000'
    };

    // Initialize with default meal types on component mount
    useEffect(() => {
        // Create default meal structure with all required types
        const defaultMeals: Meal[] = [
            {
                title: 'Breakfast',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Lunch',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Dinner',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Snacks',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            }
        ];

        setMealData(defaultMeals);
    }, []);

    // Add a function to trigger refresh
    const refreshMealData = () => {
        console.log('refreshMealData called - incrementing refreshTrigger');
        setRefreshTrigger(prev => prev + 1);
    };

    // Add a special useEffect for handling focus events with a slight delay
    // This ensures database operations complete before refreshing
    useEffect(() => {
        const handleFocus = () => {
            console.log('Screen focused, setting up delayed refresh...');
            // Use a short timeout to ensure any database operations complete
            setTimeout(() => {
                console.log('Executing delayed refresh after screen focus');
                refreshMealData();
            }, 300);
        };

        const unsubscribe = navigation.addListener('focus', handleFocus);
        return unsubscribe;
    }, [navigation]);

    const updateMealItems = (mealType, entries) => {
        return entries.map(entry => ({
            name: `${entry.food_name}\nProtein ${entry.proteins}g`,
            calories: entry.calories
        }));
    };

    // Add processLocalData function before the fetchMeals useEffect
    const processLocalData = async (localData: FoodLogEntry[], mealTypes: string[]): Promise<Meal[]> => {
        // Get current meal data to merge with
        const mealDict: Record<string, Meal> = {};

        // Initialize with default meal types
        mealTypes.forEach(type => {
            mealDict[type] = {
                title: type,
                total: 0, // Reset totals as we'll recalculate
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            };
        });

        // Group by meal type
        localData.forEach(entry => {
            if (!entry.meal_type) return; // Skip entries without meal type

            // Normalize meal_type - capitalize first letter to match our mealTypes
            let normalizedMealType = entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1).toLowerCase();

            // Check if the meal type exists in our predefined types
            const validMealType = mealTypes.includes(normalizedMealType) ?
                normalizedMealType :
                'Snacks'; // Default to Snacks if unknown type

            // Add food entry to respective meal
            mealDict[validMealType].total += entry.calories || 0;
            mealDict[validMealType].macros.carbs += entry.carbs || 0;
            mealDict[validMealType].macros.fat += entry.fats || 0;
            mealDict[validMealType].macros.protein += entry.proteins || 0;

            // Format the item name with appropriate nutritional info
            const weightInfo = entry.weight ? `Weight: ${entry.weight}${entry.weight_unit || 'g'}` : '';
            const proteinInfo = `Protein: ${entry.proteins}g`;
            const itemDescription = weightInfo ? `${proteinInfo}\n${weightInfo}` : proteinInfo;

            mealDict[validMealType].items.push({
                name: `${entry.food_name}\n${itemDescription}`,
                calories: entry.calories || 0,
                healthiness: entry.healthiness_rating || 5
            });
        });

        // Convert back to array and ensure all meal types are present
        const updatedMeals = Object.values(mealDict);

        // Sort meals in the correct order
        updatedMeals.sort((a, b) => {
            const order = { 'Breakfast': 1, 'Lunch': 2, 'Dinner': 3, 'Snacks': 4 };
            return (order[a.title] || 99) - (order[b.title] || 99);
        });

        return updatedMeals;
    };

    useEffect(() => {
        const fetchMeals = async () => {
            try {
                console.log('fetchMeals triggered by refreshTrigger:', refreshTrigger);

                // Always reset meal data when date changes
                setLoading(true);

                // Initialize with empty meals for the new date
                const defaultMeals: Meal[] = [
                    {
                        title: 'Breakfast',
                        total: 0,
                        macros: { carbs: 0, fat: 0, protein: 0 },
                        items: []
                    },
                    {
                        title: 'Lunch',
                        total: 0,
                        macros: { carbs: 0, fat: 0, protein: 0 },
                        items: []
                    },
                    {
                        title: 'Dinner',
                        total: 0,
                        macros: { carbs: 0, fat: 0, protein: 0 },
                        items: []
                    },
                    {
                        title: 'Snacks',
                        total: 0,
                        macros: { carbs: 0, fat: 0, protein: 0 },
                        items: []
                    }
                ];

                // Format the current date to match the database format (YYYY-MM-DD)
                const formattedDate = formatDateToString(currentDate);
                console.log('Fetching meals for date:', formattedDate);

                // Check if database is ready
                if (!isDatabaseReady()) {
                    console.log('🔄 Database not yet initialized, waiting...');
                    // Wait a bit and try again
                    setTimeout(() => {
                        console.log('🔄 Retrying fetch after waiting for DB initialization');
                        refreshMealData();
                    }, 1000);
                    return;
                }

                // Always set default meals first, then we'll add entries if we find any
                setMealData(defaultMeals);

                // Try to get data from local SQLite database
                console.log('Fetching from local SQLite database...');
                try {
                    const localData = await getFoodLogsByDate(formattedDate) as FoodLogEntry[];
                    console.log('Local meal data found:', localData.length, 'entries');

                    // Store local data in a ref for later use
                    localMealDataRef.current = localData;

                    if (localData && localData.length > 0) {
                        // Create a deep copy of the data to prevent any reference issues
                        const updatedMeals = await processLocalData(localData, mealTypes);
                        console.log('Processed local data into meal format with',
                            updatedMeals.reduce((count, meal) => count + meal.items.length, 0),
                            'total items');

                        // Update meal data with the new data for the current date
                        setMealData(updatedMeals);
                        console.log('Updated meal data from local database for date:', formattedDate);
                    }
                } catch (error) {
                    console.error('Error fetching meals from local database:', error);
                    // Keep the default meals we set above
                }

                setLoading(false);

                // Try to fetch exercises as well
                try {
                    if (isDatabaseReady()) {
                        const exercises = await getExercisesByDate(formattedDate) as Exercise[];
                        console.log(`Found ${exercises.length} exercises for date ${formattedDate}`);
                        setExerciseList(exercises);
                    }
                } catch (error) {
                    console.error('Error fetching exercises:', error);
                }

                // After loading local data, set processed flag to true
                processedMealData.current = true;

            } catch (error) {
                console.error('Error fetching meals:', error);
                setLoading(false);
            }
        };

        fetchMeals();
    }, [currentDate, refreshTrigger]); // Re-run when date changes or refresh is triggered

    useEffect(() => {
        // This useEffect is now simplified since we handle meal type initialization elsewhere
        // It just marks the data as processed to prevent infinite loops
        if (!processedMealData.current && mealData.length > 0) {
            processedMealData.current = true;
        }
    }, [mealData]);

    // Add effect to clear meal data when date changes
    useEffect(() => {
        // Immediately clear meal data when date changes
        console.log('Date changed to:', formatDateToString(currentDate));

        // Reset the meal data to empty state
        const emptyMeals: Meal[] = [
            {
                title: 'Breakfast',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Lunch',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Dinner',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Snacks',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            }
        ];

        setMealData(emptyMeals);
        setExerciseList([]);
        localMealDataRef.current = null;

        // The fetchMeals effect will run after this since it also depends on currentDate
    }, [currentDate]);

    const goal = 1800;
    // Calculate total exercise calories based on exerciseList instead of hardcoded value
    const totalExerciseCalories = exerciseList.reduce((total, exercise) => total + exercise.calories_burned, 0);

    // Add null check to prevent the "Cannot read property 'total' of undefined" error
    const foodTotal = mealData && mealData.length
        ? mealData.reduce((acc, meal) => acc + (meal?.total || 0), 0)
        : 0;

    const remaining = goal - foodTotal + totalExerciseCalories;
    const [showStreakInfo, setShowStreakInfo] = useState(false);
    const [showMacrosAsPercent, setShowMacrosAsPercent] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current; // new animated value
    const swipeAnim = useRef(new Animated.Value(0)).current; // new animated value for full page swiping
    const swipeValueRef = useRef(0); // Add ref to track current swipe value

    // Add state for action modal
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [selectedFoodItem, setSelectedFoodItem] = useState<{ id?: number, name: string, meal: string, index: number } | null>(null);
    const [moveModalVisible, setMoveModalVisible] = useState(false);

    // Add state for exercise modal
    const [exerciseModalVisible, setExerciseModalVisible] = useState(false);

    // Add state for exercise action modal
    const [exerciseActionModalVisible, setExerciseActionModalVisible] = useState(false);
    const [selectedExerciseItem, setSelectedExerciseItem] = useState<{ id?: number, name: string, index: number } | null>(null);

    // Replace the original addTestExercise function with the new modal-opening function
    const openExerciseModal = () => {
        setExerciseModalVisible(true);
    };

    // Gradient border card wrapper component
    interface GradientBorderCardProps {
        children: React.ReactNode;
        style?: any;
    }

    const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
        return (
            <View style={styles.gradientBorderContainer}>
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
                        backgroundColor: style?.backgroundColor || '#121212',
                        padding: 16,
                    }}
                >
                    {children}
                </View>
            </View>
        );
    };

    // Create a type for our styles
    type StylesType = {
        container: ViewStyle;
        header: ViewStyle;
        headerTitle: TextStyle;
        headerSub: TextStyle;
        streakNumber: TextStyle;
        streakInfo: ViewStyle;
        streakInfoArrow: ViewStyle;
        streakInfoText: TextStyle;
        headerRight: ViewStyle;
        streakButton: ViewStyle;
        iconButton: ViewStyle;
        dayNavCard: ViewStyle;
        arrowButton: ViewStyle;
        arrowSymbol: TextStyle;
        summaryCard: ViewStyle;
        summaryTitle: TextStyle;
        equationRow: ViewStyle;
        equationColumn: ViewStyle;
        equationValue: TextStyle;
        equationSign: TextStyle;
        equationResult: TextStyle;
        equationLabel: TextStyle;
        mealSection: ViewStyle;
        mealHeader: ViewStyle;
        mealTitle: TextStyle;
        mealCal: TextStyle;
        macrosText: TextStyle;
        dividerLine: ViewStyle;
        entryDividerLine: ViewStyle;
        logRow: ViewStyle;
        logItemText: TextStyle;
        logItemDuration: TextStyle;
        logCalText: TextStyle;
        addBtn: ViewStyle;
        addBtnText: TextStyle;
        bottomActions: ViewStyle;
        topActionsRow: ViewStyle;
        bottomAnalyzeRow: ViewStyle;
        tabBtn: ViewStyle;
        tabBtnText: TextStyle;
        analyzeBtn: ViewStyle;
        analyzeBtnText: TextStyle;
        loadingContainer: ViewStyle;
        loadingText: TextStyle;
        animatedContent: ViewStyle;
        scrollInner: ViewStyle;
        healthinessCircle: ViewStyle;
        healthinessText: TextStyle;
        modalOverlay: ViewStyle;
        actionModalContent: ViewStyle;
        actionModalTitle: TextStyle;
        actionButton: ViewStyle;
        actionButtonText: TextStyle;
        deleteButton: ViewStyle;
        deleteButtonText: TextStyle;
        cancelButton: ViewStyle;
        cancelButtonText: TextStyle;
        exitButton: ViewStyle;
        moveModalContent: ViewStyle;
        moveModalTitle: TextStyle;
        mealTypeButton: ViewStyle;
        currentMealType: ViewStyle;
        mealTypeButtonText: TextStyle;
        currentMealTypeText: TextStyle;
        buttonText: TextStyle;
        weightText: TextStyle;

        // New gradient border styles
        gradientBorderContainer: ViewStyle;
    };

    const styles = StyleSheet.create<StylesType>({
        container: {
            flex: 1,
            backgroundColor: PRIMARY_BG,
        },
        header: {
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: PRIMARY_BG,
        },
        headerTitle: {
            fontSize: 26,
            color: PURPLE_ACCENT,
            fontWeight: '700',
            marginBottom: 4,
        },
        headerSub: {
            fontSize: 16,
            color: WHITE,
            fontWeight: '400',
        },
        dayNavCard: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
            borderRadius: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginHorizontal: 10, // Match with scrollInner paddingHorizontal
            marginTop: -5,
            marginBottom: 3, // Reduced to minimize space between day and calories card
        },
        arrowButton: {
            paddingHorizontal: 12,
            paddingVertical: 4
        },
        arrowSymbol: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#FFF'
        },

        // Gradient border components
        gradientBorderContainer: {
            marginBottom: 12,
            borderRadius: 10,
            width: '100%',
            overflow: 'hidden',
        },

        // Calories Remaining Card
        summaryCard: {
            backgroundColor: '#121212',
            marginTop: 3, // Reduced from 8 to 3 to minimize space
            marginBottom: 0, // Removed margin as it's handled by gradientBorderContainer
            borderRadius: 8,
            padding: 16,
            width: '100%', // Consistent width
        },
        summaryTitle: {
            fontSize: 16,
            color: WHITE,
            fontWeight: '600',
            marginBottom: 8,
        },
        equationRow: {
            flexDirection: 'row' as const,
            flexWrap: 'nowrap' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        },
        equationColumn: {
            alignItems: 'center' as const,
            marginHorizontal: 10,
        },
        equationValue: {
            fontSize: 18, // Increase font size for better readability
            fontWeight: '500',
            marginRight: 10, // Shift slightly to the right
            textAlign: 'center', // Center align text
        },
        equationSign: {
            color: WHITE,
            fontSize: 18, // Increase font size for better readability
            fontWeight: '300',
            marginRight: 10, // Shift slightly to the right
            marginTop: -10, // Align with numbers
            textAlign: 'center', // Center align text
        },
        equationResult: {
            color: PURPLE_ACCENT,
            fontSize: 20, // Increase font size for better readability
            fontWeight: '700',
            marginRight: 10, // Shift slightly to the right
            marginLeft: 10, // Shift slightly to the right
            textAlign: 'center', // Center align text
        },
        equationLabel: {
            color: SUBDUED,
            fontSize: 12,
            marginTop: 4,
            marginRight: 10, // Shift slightly to the right
            textAlign: 'center', // Center align text
        },

        // Meal/Exercise/Water Sections
        mealSection: {
            backgroundColor: '#181818',
            marginHorizontal: 0,
            marginBottom: 0, // Removed margin as it's handled by gradientBorderContainer
            borderRadius: 8,
            padding: 16,
            width: '100%', // Ensure full width matches summary card
        },
        mealHeader: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            marginBottom: 4,
            width: '100%',
        },
        mealTitle: {
            fontSize: 16,
            color: WHITE,
            fontWeight: '600',
        },
        mealCal: {
            fontSize: 16,
            color: WHITE,
            fontWeight: '600',
        },
        macrosText: {
            fontSize: 13,
            color: SUBDUED,
            marginBottom: 8,
        },

        // Dividers
        dividerLine: {
            borderBottomWidth: 1,
            borderBottomColor: '#333',
            marginVertical: 5, // Reduced margin for tighter sections
            marginHorizontal: -20, // Extend beyond parent container padding
            width: '120%', // Ensure full width coverage
        },
        entryDividerLine: {
            borderBottomWidth: 1,
            borderBottomColor: '#333',
            marginTop: 6,
            marginBottom: 6,
            marginHorizontal: -20, // Extend beyond parent container padding
            width: '120%', // Ensure full width coverage
        },

        // Items
        logRow: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            marginVertical: 2,
        },
        logItemText: {
            fontSize: 14,
            color: WHITE,
            lineHeight: 18,
            flexShrink: 1,
        },
        logItemDuration: {
            fontSize: 12,
            color: SUBDUED,
        },
        logCalText: {
            fontSize: 14,
            color: WHITE,
            fontWeight: '500',
        },

        // Buttons
        addBtn: {
            marginTop: 8,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: PURPLE_ACCENT,
            paddingVertical: 6,
            alignItems: 'center' as const,
        },
        addBtnText: {
            color: PURPLE_ACCENT,
            fontSize: 14,
            fontWeight: '600',
        },

        // Bottom actions
        bottomActions: {
            flexDirection: 'column' as const,
            marginTop: 8,
            paddingHorizontal: 0,
            width: '100%',
        },
        topActionsRow: {
            flexDirection: 'row' as const,
        },
        bottomAnalyzeRow: {
            marginTop: 8,
        },
        tabBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: PURPLE_ACCENT,
            borderRadius: 6,
            marginRight: 8,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            paddingVertical: 10,
        },
        tabBtnText: {
            color: PURPLE_ACCENT,
            fontWeight: '600',
            fontSize: 14,
        },
        analyzeBtn: {
            flex: 1,
            backgroundColor: PURPLE_ACCENT,
            borderRadius: 6,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            paddingVertical: 10,
            marginRight: 8,
            transform: [{ translateY: -2 }],
            shadowColor: PURPLE_ACCENT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 10,
            elevation: 5,
        },
        analyzeBtnText: {
            color: WHITE,
            fontWeight: '700',
            fontSize: 14,
        },
        headerRight: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const
        },
        streakButton: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        iconButton: {
            marginLeft: 8 // Reduced margin
        },
        streakNumber: {
            fontSize: 20, // Increased font size
            fontWeight: 'bold',
            textAlign: 'center', // Center align text
            lineHeight: 25, // Align with icon height
            marginRight: -10, // Reduced margin
        },
        streakInfo: {
            position: 'absolute',
            top: 35,
            left: -150, // Shift to the left
            right: 10,
            backgroundColor: '#333',
            padding: 20, // Increase padding for better readability
            borderRadius: 10,
            zIndex: 1,
            overflow: 'hidden',
            width: 250, // Make the dropdown text a lot wider
        },
        streakInfoArrow: {
            position: 'absolute',
            top: -10,
            left: '50%',
            marginLeft: -10,
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderBottomWidth: 10,
            borderStyle: 'solid',
            backgroundColor: 'transparent',
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: '#333',
        },
        streakInfoText: {
            color: '#FFF',
            fontSize: 12,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: '#121212',
        },
        loadingText: {
            color: '#fff',
            marginTop: 10,
            fontSize: 16,
        },
        animatedContent: {
            flex: 1,
            width: '100%',
        },
        scrollInner: {
            paddingHorizontal: 10,
            paddingBottom: 100,
            width: '100%',
            alignItems: 'center' as const,
        },
        healthinessCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: 'transparent',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 3,
        },
        healthinessText: {
            fontSize: 10,
            fontWeight: 'bold',
            textAlign: 'center',
        },
        modalOverlay: {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
        actionModalContent: {
            backgroundColor: '#1C1C1E',
            padding: 20,
            borderRadius: 10,
            width: '80%',
        },
        actionModalTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: WHITE,
            marginBottom: 15,
            textAlign: 'center',
        },
        actionButton: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            backgroundColor: '#252525',
            padding: 15,
            borderRadius: 8,
            marginBottom: 10,
            width: '100%',
        },
        actionButtonText: {
            color: WHITE,
            fontSize: 16,
            marginLeft: 10,
        },
        deleteButton: {
            backgroundColor: '#3A0505',
        },
        deleteButtonText: {
            color: '#FF5252',
        },
        cancelButton: {
            backgroundColor: '#333',
            padding: 15,
            borderRadius: 8,
            width: '100%',
            alignItems: 'center' as const,
            marginTop: 5,
        },
        cancelButtonText: {
            color: '#AAA',
            fontSize: 16,
        },
        exitButton: {
            position: 'absolute',
            top: 10,
            left: 10,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: 'transparent', // Change from purple to transparent
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
        },
        moveModalContent: {
            backgroundColor: '#1C1C1E',
            padding: 20,
            borderRadius: 10,
            width: '80%',
        },
        moveModalTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: WHITE,
            marginBottom: 15,
            textAlign: 'center',
        },
        mealTypeButton: {
            padding: 15,
            borderWidth: 1,
            borderColor: PURPLE_ACCENT,
            borderRadius: 8,
            marginBottom: 10,
            width: '100%',
            alignItems: 'center',
        },
        currentMealType: {
            backgroundColor: '#2D1640',
        },
        mealTypeButtonText: {
            color: PURPLE_ACCENT,
            fontSize: 16,
        },
        currentMealTypeText: {
            color: WHITE,
        },
        buttonText: {
            color: PURPLE_ACCENT,
            fontSize: 16,
        },
        weightText: {
            fontSize: 12,
            color: '#999999',
            marginTop: 2,
        },
    });

    // Add dummy handlers for functions called in JSX
    const handleOutsidePress = () => {
        // Close any open dropdowns, tooltips, etc.
    };

    const toggleStreakInfo = () => {
        // Toggle streak info visibility
    };

    const gotoPrevDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);

        // Force an immediate clear of data
        console.log('Moving to previous day, clearing data');

        // Reset meal data to empty state
        const emptyMeals: Meal[] = [
            {
                title: 'Breakfast',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Lunch',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Dinner',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Snacks',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            }
        ];

        setMealData(emptyMeals);
        setExerciseList([]);
        localMealDataRef.current = null;

        // Change the date (which will trigger the effects)
        setCurrentDate(newDate);
    };

    const gotoNextDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);

        // Force an immediate clear of data
        console.log('Moving to next day, clearing data');

        // Reset meal data to empty state
        const emptyMeals: Meal[] = [
            {
                title: 'Breakfast',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Lunch',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Dinner',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            },
            {
                title: 'Snacks',
                total: 0,
                macros: { carbs: 0, fat: 0, protein: 0 },
                items: []
            }
        ];

        setMealData(emptyMeals);
        setExerciseList([]);
        localMealDataRef.current = null;

        // Change the date (which will trigger the effects)
        setCurrentDate(newDate);
    };

    const formatDate = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    // Replace the current isSwipeActive approach with a more refined solution
    const [swipeDirection, setSwipeDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
    const initialGestureRef = useRef({ x: 0, y: 0 });
    const gestureStateRef = useRef('idle');

    // Update the gesture handler to better detect scroll direction
    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: swipeAnim } }],
        {
            useNativeDriver: true,
            listener: (event: any) => {
                if (event.nativeEvent && typeof event.nativeEvent.translationX === 'number') {
                    swipeValueRef.current = event.nativeEvent.translationX;

                    // Only update the translation value if we've determined this is a horizontal swipe
                    if (swipeDirection === 'horizontal') {
                        // Allow the animation to update
                    } else if (swipeDirection === 'none' && Math.abs(event.nativeEvent.translationX) > 10) {
                        // If we've moved horizontally more than 10px and haven't determined direction yet
                        const { translationX, translationY } = event.nativeEvent;
                        determineDirection(translationX, translationY);
                    }
                }
            }
        }
    );

    // Create a function to determine direction based on the initial movement
    const determineDirection = (x: number, y: number) => {
        // If movement is obviously horizontal (2:1 ratio), use horizontal swipe
        if (Math.abs(x) > Math.abs(y) * 2 && Math.abs(x) > 15) {
            console.log("Setting horizontal swipe direction");
            setSwipeDirection('horizontal');
            // Disable scroll when swiping horizontally
            if (scrollRef.current) {
                scrollRef.current.setNativeProps({ scrollEnabled: false });
            }
        }
        // If movement is obviously vertical (1.5:1 ratio), use vertical scroll
        else if (Math.abs(y) > Math.abs(x) * 1.5) {
            console.log("Setting vertical swipe direction");
            setSwipeDirection('vertical');
        }
        // Otherwise wait for more movement to decide
    };

    // Better gesture state tracking for scrolling
    const onHandlerStateChange = (event: any) => {
        if (event.nativeEvent.state === GestureState.BEGAN) {
            // Reset direction detection at the start of a gesture
            gestureStateRef.current = 'began';
            setSwipeDirection('none');
            initialGestureRef.current = { x: 0, y: 0 };
        }
        else if (event.nativeEvent.state === GestureState.ACTIVE) {
            // During the gesture, determine direction if not already set
            gestureStateRef.current = 'active';
            if (swipeDirection === 'none') {
                const { translationX, translationY } = event.nativeEvent;
                initialGestureRef.current = { x: translationX, y: translationY };
                determineDirection(translationX, translationY);
            }
        }
        else if (event.nativeEvent.state === GestureState.END ||
            event.nativeEvent.state === GestureState.CANCELLED ||
            event.nativeEvent.state === GestureState.FAILED) {

            gestureStateRef.current = 'ended';
            // Only process swipe if we determined it was a horizontal gesture
            if (swipeDirection === 'horizontal') {
                const { translationX, velocityX } = event.nativeEvent;
                handleSwipeRelease(translationX, velocityX);
            }

            // Re-enable scrolling
            if (scrollRef.current) {
                scrollRef.current.setNativeProps({ scrollEnabled: true });
            }

            // Reset after a short delay
            setTimeout(() => {
                setSwipeDirection('none');
            }, 100);
        }
    };

    const handleSwipeRelease = (translationX: number, velocityX: number) => {
        const threshold = 80; // Lower threshold to make swiping more responsive
        const velocity = 0.5; // Velocity threshold

        // Determine if we should switch days based on translation and velocity
        const shouldSwitchDay =
            Math.abs(translationX) > threshold ||
            Math.abs(velocityX) > velocity * 1000;

        if (shouldSwitchDay) {
            if (translationX < 0 || velocityX < -velocity * 1000) {
                // Swipe left or fast left flick -> next day
                // Animate to the left first to make it smooth
                Animated.timing(swipeAnim, {
                    toValue: -screenWidth,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => {
                    // When animation completes, set new date and reset animation
                    const newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() + 1);

                    // Reset meal data to empty state
                    const emptyMeals: Meal[] = [
                        {
                            title: 'Breakfast',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Lunch',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Dinner',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Snacks',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        }
                    ];

                    setMealData(emptyMeals);
                    setExerciseList([]);
                    localMealDataRef.current = null;
                    setCurrentDate(newDate);

                    // Reset animation value immediately
                    swipeAnim.setValue(0);
                });
            } else if (translationX > 0 || velocityX > velocity * 1000) {
                // Swipe right or fast right flick -> previous day
                // Animate to the right first to make it smooth
                Animated.timing(swipeAnim, {
                    toValue: screenWidth,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => {
                    // When animation completes, set new date and reset animation
                    const newDate = new Date(currentDate);
                    newDate.setDate(newDate.getDate() - 1);

                    // Reset meal data to empty state
                    const emptyMeals: Meal[] = [
                        {
                            title: 'Breakfast',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Lunch',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Dinner',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        },
                        {
                            title: 'Snacks',
                            total: 0,
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        }
                    ];

                    setMealData(emptyMeals);
                    setExerciseList([]);
                    localMealDataRef.current = null;
                    setCurrentDate(newDate);

                    // Reset animation value immediately
                    swipeAnim.setValue(0);
                });
            }
        } else {
            // Not enough swipe; snap back with spring animation for more natural feel
            Animated.spring(swipeAnim, {
                toValue: 0,
                velocity: velocityX,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }).start();
        }
    };

    const toggleMacrosDisplay = () => {
        // Toggle between percent and grams for macros display
    };

    const handleFoodItemLongPress = (foodId: number | undefined, foodName: string, mealType: string, index: number) => {
        // Set the selected food item and show the action modal
        setSelectedFoodItem({ id: foodId, name: foodName, meal: mealType, index: index });
        setActionModalVisible(true);
    };

    const handleDeleteFoodItem = async () => {
        if (selectedFoodItem && selectedFoodItem.id) {
            try {
                setLoading(true);
                await deleteFoodLog(selectedFoodItem.id);
                setActionModalVisible(false);
                // Refresh data after deletion
                refreshMealData();
            } catch (error) {
                console.error('Error deleting food item:', error);
                Alert.alert('Error', 'Failed to delete food item. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            setActionModalVisible(false);
            Alert.alert('Error', 'Unable to delete this food item. Try again later.');
        }
    };

    const moveFood = async (id: number | undefined, newMealType: string) => {
        if (!id) {
            setMoveModalVisible(false);
            Alert.alert('Error', 'Cannot move this food item. ID not found.');
            return;
        }

        try {
            setLoading(true);
            // Find the current food log entry
            if (localMealDataRef.current) {
                const foodEntry = localMealDataRef.current.find(entry => entry.id === id);

                if (foodEntry) {
                    // Update the meal type
                    await updateFoodLog(id, {
                        ...foodEntry,
                        meal_type: newMealType,
                        sync_action: 'UPDATE'
                    });

                    // Close the modal and refresh data
                    setMoveModalVisible(false);
                    refreshMealData();
                } else {
                    throw new Error('Food entry not found');
                }
            } else {
                throw new Error('Local meal data not available');
            }
        } catch (error) {
            console.error('Error moving food item:', error);
            Alert.alert('Error', 'Failed to move food item. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle long press on exercise item
    const handleExerciseItemLongPress = (exerciseId: number | undefined, exerciseName: string, index: number) => {
        setSelectedExerciseItem({ id: exerciseId, name: exerciseName, index: index });
        setExerciseActionModalVisible(true);
    };

    // Handle delete exercise item
    const handleDeleteExerciseItem = async () => {
        if (selectedExerciseItem && selectedExerciseItem.id) {
            try {
                setLoading(true);
                await deleteExercise(selectedExerciseItem.id);
                setExerciseActionModalVisible(false);
                // Refresh data after deletion
                refreshMealData();
            } catch (error) {
                console.error('Error deleting exercise:', error);
                Alert.alert('Error', 'Failed to delete exercise. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            setExerciseActionModalVisible(false);
            Alert.alert('Error', 'Unable to delete this exercise. Try again later.');
        }
    };

    // Make sure renderExerciseList function is properly defined
    const renderExerciseList = () => {
        // If there are no exercises, return null instead of an empty row
        if (exerciseList.length === 0) {
            return null;
        }

        return exerciseList.map((exercise, index) => (
            <View key={index}>
                <TouchableHighlight
                    underlayColor="#333"
                    onLongPress={() => {
                        handleExerciseItemLongPress(exercise.id, exercise.exercise_name, index);
                    }}
                    delayLongPress={500}
                >
                    <View style={styles.logRow}>
                        <View style={{ flexDirection: 'column' }}>
                            <Text style={[styles.logItemText, { fontSize: 16 }]} numberOfLines={1} ellipsizeMode="tail">
                                {exercise.exercise_name}
                            </Text>
                            <Text style={styles.logItemDuration}>{exercise.duration} min</Text>
                        </View>
                        <Text style={styles.logCalText}>{exercise.calories_burned}</Text>
                    </View>
                </TouchableHighlight>
                {/* Divider line under each entry */}
                {index < exerciseList.length - 1 && (
                    <View style={styles.entryDividerLine} />
                )}
            </View>
        ));
    };

    // Add opacity and scale effects for better visual feedback during swipe
    const opacityInterpolation = swipeAnim.interpolate({
        inputRange: [-screenWidth / 2, 0, screenWidth / 2],
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp'
    });

    const scaleInterpolation = swipeAnim.interpolate({
        inputRange: [-screenWidth / 2, 0, screenWidth / 2],
        outputRange: [0.95, 1, 0.95],
        extrapolate: 'clamp'
    });

    // Apply interpolation to date text in header
    const dateSlideInterpolation = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [-50, 0, 50],
        extrapolate: 'clamp'
    });

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={containerStyle}>
                {/* Fixed header & day bar */}
                <TouchableWithoutFeedback onPress={handleOutsidePress}>
                    <>
                        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                            <Text style={styles.headerTitle}>Diary</Text>
                            <View style={styles.headerRight}>
                                <TouchableOpacity onPress={toggleStreakInfo} style={styles.streakButton}>
                                    <MaskedView
                                        maskElement={<Text style={styles.streakNumber}>7</Text>}
                                    >
                                        <LinearGradient
                                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={{ width: 27, height: 27 }}
                                        />
                                    </MaskedView>
                                    <MaskedView
                                        maskElement={<MaterialCommunityIcons name="fire" size={27} color="#FFF" />}
                                    >
                                        <LinearGradient
                                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={{ width: 27, height: 27 }}
                                        />
                                    </MaskedView>
                                </TouchableOpacity>
                                {showStreakInfo && (
                                    <View style={styles.streakInfo}>
                                        <View style={styles.streakInfoArrow} />
                                        <Text style={styles.streakInfoText}>This is your streak count. Keep logging daily to maintain your streak!</Text>
                                    </View>
                                )}
                                {/* New icon button */}
                                <TouchableOpacity onPress={() => console.log('OpenImage')} style={styles.iconButton}>
                                    <Ionicons name="image" size={22} color="#00BFFF" />
                                </TouchableOpacity>
                                {/* Updated pie chart icon color */}
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Nutrients' as never)}
                                    style={styles.iconButton}
                                >
                                    <Ionicons name="pie-chart-outline" size={22} color="#FFA500" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.dayNavCard}>
                            <TouchableOpacity onPress={gotoPrevDay} style={styles.arrowButton}>
                                <Ionicons name="chevron-back" size={16} color="#FFF" />
                            </TouchableOpacity>
                            <Animated.View style={{ transform: [{ translateX: dateSlideInterpolation }] }}>
                                <Text style={[styles.headerSub, { fontSize: 14 }]}>
                                    {formatDate(currentDate)}
                                </Text>
                            </Animated.View>
                            <TouchableOpacity onPress={gotoNextDay} style={styles.arrowButton}>
                                <Ionicons name="chevron-forward" size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ height: 5 }} /> {/* Reduced space below the Today bar */}
                    </>
                </TouchableWithoutFeedback>

                {/* Swipeable content below day bar */}
                <PanGestureHandler
                    onGestureEvent={onGestureEvent}
                    onHandlerStateChange={onHandlerStateChange}
                    simultaneousHandlers={scrollRef} // Allow simultaneous handling with ScrollView
                    failOffsetY={[-5, 5]} // If movement starts vertical, fail the gesture
                    activeOffsetX={[-20, 20]} // Decreased horizontal threshold to make it more responsive
                >
                    <Animated.View style={[styles.animatedContent, { transform: [{ translateX: swipeAnim }, { scale: scaleInterpolation }], opacity: opacityInterpolation }]}>
                        <ScrollView
                            ref={scrollRef}
                            contentContainerStyle={styles.scrollInner}
                            showsVerticalScrollIndicator={true}
                            scrollEnabled={true}
                            bounces={true}
                        >
                            {/* 2) Calories Remaining */}
                            <GradientBorderCard style={styles.summaryCard}>
                                <Text style={styles.summaryTitle}>Calories Remaining</Text>
                                <View style={styles.equationRow}>
                                    <View style={styles.equationColumn}>
                                        <Text style={[styles.equationValue, { color: '#FFB74D' }]}>
                                            {goal}
                                        </Text>
                                        <Text style={styles.equationLabel}>Base</Text>
                                    </View>
                                    <Text style={[styles.equationSign, { marginTop: -10 }]}>-</Text>
                                    <View style={styles.equationColumn}>
                                        <Text style={[styles.equationValue, { color: '#FF8A65' }]}>
                                            {foodTotal}
                                        </Text>
                                        <Text style={styles.equationLabel}>Food</Text>
                                    </View>
                                    <Text style={[styles.equationSign, { marginTop: -10 }]}>+</Text>
                                    <View style={styles.equationColumn}>
                                        <Text style={[styles.equationValue, { color: '#66BB6A' }]}>
                                            {totalExerciseCalories}
                                        </Text>
                                        <Text style={styles.equationLabel}>Exercise</Text>
                                    </View>
                                    <Text style={[styles.equationSign, { marginTop: -10 }]}>=</Text>
                                    <View style={styles.equationColumn}>
                                        <Text style={[styles.equationResult, { marginLeft: 10 }]}>{remaining}</Text>
                                        <Text style={styles.equationLabel}>Remaining</Text>
                                    </View>
                                </View>
                            </GradientBorderCard>

                            {/* 3) Meals */}
                            {mealData.map((meal, idx) => (
                                <GradientBorderCard key={idx} style={styles.mealSection}>
                                    {/* Always show meal title and calories */}
                                    <View style={styles.mealHeader}>
                                        <Text style={styles.mealTitle}>{meal.title}</Text>
                                        <Text style={styles.mealCal}>{meal.total}</Text>
                                    </View>

                                    {/* Always show macros, even if they're all zero */}
                                    <TouchableOpacity onPress={toggleMacrosDisplay}>
                                        <Text style={styles.macrosText}>
                                            {showMacrosAsPercent
                                                ? `Carbs ${meal.macros.carbs}% • Fat ${meal.macros.fat}% • Protein ${meal.macros.protein}%`
                                                : `Carbs ${meal.macros.carbs}g • Fat ${meal.macros.fat}g • Protein ${meal.macros.protein}g`}
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.dividerLine} />

                                    {/* Only show items if there are any */}
                                    {meal.items.length > 0 ? (
                                        <>
                                            {meal.items
                                                .filter(item => item.calories !== 100) // <-- Remove 100 kcal items
                                                .map((item, i) => {
                                                    // First extract food name without the weight info
                                                    const foodName = item.name.split('\n')[0];
                                                    // Try to find the ID from localMealDataRef
                                                    let foodId = undefined;

                                                    if (localMealDataRef.current) {
                                                        // Try exact match first
                                                        const exactMatch = localMealDataRef.current.find(entry =>
                                                            entry.food_name === foodName &&
                                                            entry.meal_type.toLowerCase() === meal.title.toLowerCase()
                                                        );

                                                        if (exactMatch) {
                                                            foodId = exactMatch.id;
                                                        } else {
                                                            // If no exact match, try just by food name
                                                            const nameMatch = localMealDataRef.current.find(entry =>
                                                                entry.food_name === foodName
                                                            );

                                                            if (nameMatch) {
                                                                foodId = nameMatch.id;
                                                            }
                                                        }
                                                    }

                                                    return (
                                                        <TouchableHighlight
                                                            key={i}
                                                            underlayColor="#333"
                                                            onLongPress={() => {
                                                                handleFoodItemLongPress(foodId, foodName, meal.title, i);
                                                            }}
                                                            delayLongPress={500}
                                                        >
                                                            <View>
                                                                <View style={styles.logRow}>
                                                                    <View style={{ flex: 1 }}>
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            <Text style={styles.logItemText}>{foodName}</Text>
                                                                            <View style={[
                                                                                styles.healthinessCircle,
                                                                                { borderColor: getHealthinessColor(item.healthiness || 5), marginLeft: 4 }
                                                                            ]}>
                                                                                <Text style={[styles.healthinessText, { color: getHealthinessColor(item.healthiness || 5) }]}>
                                                                                    {Math.round(item.healthiness || 5)}
                                                                                </Text>
                                                                            </View>
                                                                        </View>
                                                                        <Text style={styles.weightText}>{item.name.split('\n').slice(1).join('\n')}</Text>
                                                                    </View>
                                                                    <Text style={styles.logCalText}>{item.calories}</Text>
                                                                </View>
                                                                {i < meal.items.length - 1 && <View style={styles.entryDividerLine} />}
                                                            </View>
                                                        </TouchableHighlight>
                                                    );
                                                })}
                                            <View style={styles.dividerLine} />
                                        </>
                                    ) : null}

                                    <TouchableOpacity
                                        style={styles.addBtn}
                                        onPress={() => navigation.navigate('ImageCapture', { mealType: meal.title })}
                                    >
                                        <Text style={styles.addBtnText}>ADD FOOD</Text>
                                    </TouchableOpacity>
                                </GradientBorderCard>
                            ))}

                            {/* 4) Exercise */}
                            <GradientBorderCard style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={[styles.mealTitle, { fontSize: 18 }]}>Exercise</Text>
                                    <Text style={styles.mealCal}>{totalExerciseCalories}</Text>
                                </View>

                                {/* Divider line under heading */}
                                <View style={styles.dividerLine} />

                                {renderExerciseList()}

                                {/* Only show divider line if there are exercises already */}
                                {exerciseList.length > 0 && <View style={styles.dividerLine} />}

                                <TouchableOpacity style={styles.addBtn} onPress={openExerciseModal}>
                                    <Text style={styles.addBtnText}>Add Exercise</Text>
                                </TouchableOpacity>
                            </GradientBorderCard>

                            {/* 5) Water */}
                            <GradientBorderCard style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>Water</Text>
                                </View>
                                {/* Divider line under heading */}
                                <View style={styles.dividerLine} />

                                <TouchableOpacity style={styles.addBtn}>
                                    <Text style={styles.addBtnText}>ADD WATER</Text>
                                </TouchableOpacity>
                            </GradientBorderCard>

                            {/* 7) Bottom action row */}
                            <View style={styles.bottomActions}>
                                <View style={styles.topActionsRow}>
                                    <TouchableOpacity
                                        style={[styles.tabBtn, { flex: 1, marginRight: 8 }]}
                                        onPress={() => navigation.navigate('Nutrients' as never)}
                                    >
                                        <Text style={styles.tabBtnText}>Nutrition</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.tabBtn, { flex: 1 }]}>
                                        <Text style={styles.tabBtnText}>Complete Diary</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.bottomAnalyzeRow}>
                                    <TouchableOpacity style={[styles.analyzeBtn, { flex: 1 }]}>
                                        <Text style={styles.analyzeBtnText}>Analyze</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={{ height: 10 }} />
                        </ScrollView>
                    </Animated.View>
                </PanGestureHandler>

                {/* Action Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={actionModalVisible}
                    onRequestClose={() => setActionModalVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setActionModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.actionModalContent}>
                                    <Text style={styles.actionModalTitle}>
                                        {selectedFoodItem?.name || 'Food Item'}
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => {
                                            setActionModalVisible(false);
                                            setMoveModalVisible(true);
                                        }}
                                    >
                                        <Ionicons name="arrow-forward-circle-outline" size={22} color="#8A2BE2" />
                                        <Text style={styles.actionButtonText}>Move to Different Meal</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={handleDeleteFoodItem}
                                    >
                                        <Ionicons name="trash-outline" size={22} color="#FF5252" />
                                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.exitButton}
                                        onPress={() => setActionModalVisible(false)}
                                    >
                                        <Ionicons name="close" size={28} color="#8A2BE2" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Move Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={moveModalVisible}
                    onRequestClose={() => setMoveModalVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setMoveModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.moveModalContent}>
                                    <Text style={styles.moveModalTitle}>Move to Meal</Text>

                                    <TouchableOpacity
                                        style={styles.exitButton}
                                        onPress={() => setMoveModalVisible(false)}
                                    >
                                        <Ionicons name="close" size={28} color="#8A2BE2" />
                                    </TouchableOpacity>

                                    {mealTypes.map((type) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.mealTypeButton,
                                                selectedFoodItem?.meal === type && styles.currentMealType
                                            ]}
                                            key={type}
                                            onPress={() => moveFood(selectedFoodItem?.id, type)}
                                            disabled={selectedFoodItem?.meal === type}
                                        >
                                            <Text style={[
                                                styles.mealTypeButtonText,
                                                selectedFoodItem?.meal === type && styles.currentMealTypeText
                                            ]}>
                                                {type}
                                                {selectedFoodItem?.meal === type ? ' (Current)' : ''}
                                            </Text>
                                            {selectedFoodItem?.meal !== type && (
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={18}
                                                    color={PURPLE_ACCENT}
                                                    style={{ position: 'absolute', right: 15 }}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    ))}

                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setMoveModalVisible(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Exercise Modal */}
                <ExerciseModal
                    visible={exerciseModalVisible}
                    onClose={() => setExerciseModalVisible(false)}
                    onExerciseAdded={refreshMealData}
                    currentDate={currentDate}
                />

                {/* Exercise Action Modal */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={exerciseActionModalVisible}
                    onRequestClose={() => setExerciseActionModalVisible(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setExerciseActionModalVisible(false)}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.actionModalContent}>
                                    <Text style={styles.actionModalTitle}>
                                        {selectedExerciseItem?.name || 'Exercise Item'}
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={handleDeleteExerciseItem}
                                    >
                                        <Ionicons name="trash-outline" size={22} color="#FF5252" />
                                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.exitButton}
                                        onPress={() => setExerciseActionModalVisible(false)}
                                    >
                                        <Ionicons name="close" size={28} color="#8A2BE2" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

                {/* Loading overlay */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                        <Text style={styles.loadingText}>Processing...</Text>
                    </View>
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

export default DiaryScreen;

/** COLOR PALETTE */
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';
