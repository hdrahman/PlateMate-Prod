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

// Add MET activity interface
interface METActivity {
    name: string;
    met: number;
    category: 'light' | 'moderate' | 'vigorous';
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

                // Keep any existing data if we have it
                let existingMealData = [...mealData];
                let hasExistingData = existingMealData.some(meal => meal.items.length > 0);

                // Store if we already have data to prevent flashing
                if (hasExistingData) {
                    console.log('Keeping existing meal data during refresh');
                } else {
                    setLoading(true);
                }

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

                // Setup default meals (for initializing if needed)
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

                // First try to get data from local SQLite database
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

                        // Only update state if we actually have items
                        if (updatedMeals.some(meal => meal.items.length > 0)) {
                            setMealData(updatedMeals);
                            console.log('Updated meal data from local database');
                        }
                    } else if (!hasExistingData) {
                        // Only set default meals if we don't already have data
                        setMealData(defaultMeals);
                    }
                } catch (error) {
                    console.error('Error fetching meals from local database:', error);

                    // If we have existing data, keep it rather than showing an error
                    if (!hasExistingData) {
                        setMealData(defaultMeals);
                    }
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

    // Add state for action modal
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [selectedFoodItem, setSelectedFoodItem] = useState<{ id?: number, name: string, meal: string, index: number } | null>(null);
    const [moveModalVisible, setMoveModalVisible] = useState(false);

    // Add state for exercise modal
    const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<METActivity | null>(null);
    const [exerciseDuration, setExerciseDuration] = useState('30');
    const [exerciseIntensity, setExerciseIntensity] = useState('moderate');
    const [searchQuery, setSearchQuery] = useState('');
    const [userWeight, setUserWeight] = useState(70); // Default 70kg (around 150lbs)

    // Add state for manual entry
    const [manualMET, setManualMET] = useState('5.0');
    const [manualActivityName, setManualActivityName] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);

    // Add state for exercise action modal
    const [exerciseActionModalVisible, setExerciseActionModalVisible] = useState(false);
    const [selectedExerciseItem, setSelectedExerciseItem] = useState<{ id?: number, name: string, index: number } | null>(null);

    // MET activities data based on the provided charts
    const metActivities: METActivity[] = [
        // Popular/Common activities at the top
        { name: 'Weight lifting, moderate', met: 5.0, category: 'moderate' },
        { name: 'Weight lifting, vigorous', met: 6.0, category: 'vigorous' },
        { name: 'Walking, 3 mph', met: 3.3, category: 'moderate' },
        { name: 'Walking, 4 mph', met: 5.0, category: 'moderate' },
        { name: 'Running, 6 min/mile', met: 16.0, category: 'vigorous' },
        { name: 'Running, 10 min/mile', met: 10.0, category: 'vigorous' },
        { name: 'Bicycling, 12-13 mph', met: 8.0, category: 'vigorous' },
        { name: 'Swimming, moderate pace', met: 4.5, category: 'moderate' },
        { name: 'Basketball game', met: 8.0, category: 'vigorous' },
        { name: 'Soccer, casual', met: 7.0, category: 'vigorous' },

        // Light activities
        { name: 'Walking, slowly (stroll)', met: 2.0, category: 'light' },
        { name: 'Walking, 2 mph', met: 2.5, category: 'light' },
        { name: 'Stretching, yoga', met: 2.5, category: 'light' },
        { name: 'Fishing, standing', met: 2.5, category: 'light' },
        { name: 'Golf with a cart', met: 2.5, category: 'light' },
        { name: 'Housework, light', met: 2.5, category: 'light' },
        { name: 'Playing catch', met: 2.5, category: 'light' },
        { name: 'Playing piano', met: 2.5, category: 'light' },
        { name: 'Canoeing leisurely', met: 2.5, category: 'light' },
        { name: 'Croquet', met: 2.5, category: 'light' },
        { name: 'Dancing, ballroom, slow', met: 2.9, category: 'light' },
        { name: 'Sitting quietly', met: 1.0, category: 'light' },

        // Moderate activities
        { name: 'Aerobic dance, low impact', met: 5.0, category: 'moderate' },
        { name: 'Archery', met: 3.5, category: 'moderate' },
        { name: 'Badminton', met: 4.5, category: 'moderate' },
        { name: 'Baseball or softball', met: 5.0, category: 'moderate' },
        { name: 'Basketball, shooting baskets', met: 4.5, category: 'moderate' },
        { name: 'Bicycling, leisurely', met: 3.5, category: 'moderate' },
        { name: 'Bowling', met: 3.0, category: 'moderate' },
        { name: 'Calisthenics, light to moderate', met: 3.5, category: 'moderate' },
        { name: 'Canoeing, 3 mph', met: 3.0, category: 'moderate' },
        { name: 'Dancing, modern, fast', met: 4.8, category: 'moderate' },
        { name: 'Fishing, walking and standing', met: 3.5, category: 'moderate' },
        { name: 'Foot bag, hacky sack', met: 4.0, category: 'moderate' },
        { name: 'Gardening, active', met: 4.0, category: 'moderate' },
        { name: 'Golf, walking', met: 4.4, category: 'moderate' },
        { name: 'Gymnastics', met: 4.0, category: 'moderate' },
        { name: 'Horseback riding', met: 4.0, category: 'moderate' },
        { name: 'Ice skating', met: 5.5, category: 'moderate' },
        { name: 'Jumping on mini tramp', met: 4.5, category: 'moderate' },
        { name: 'Kayaking', met: 5.0, category: 'moderate' },
        { name: 'Raking the lawn', met: 4.0, category: 'moderate' },
        { name: 'Skateboarding', met: 5.0, category: 'moderate' },
        { name: 'Snowmobiling', met: 3.5, category: 'moderate' },
        { name: 'Swimming recreational', met: 6.0, category: 'moderate' },
        { name: 'Table tennis', met: 4.0, category: 'moderate' },
        { name: 'Tai chi', met: 4.0, category: 'moderate' },
        { name: 'Tennis, doubles', met: 5.0, category: 'moderate' },
        { name: 'Trampoline', met: 3.5, category: 'moderate' },
        { name: 'Volleyball, noncompetitive', met: 3.0, category: 'moderate' },
        { name: 'Mowing lawn, walking', met: 5.5, category: 'moderate' },

        // Vigorous activities
        { name: 'Aerobic dance', met: 6.5, category: 'vigorous' },
        { name: 'Aerobic dance, high impact', met: 7.0, category: 'vigorous' },
        { name: 'Aerobic stepping, 6-8 inches', met: 8.5, category: 'vigorous' },
        { name: 'Backpacking', met: 7.0, category: 'vigorous' },
        { name: 'Bicycling, 14-15 mph', met: 10.0, category: 'vigorous' },
        { name: 'Bicycling, 16-19 mph', met: 12.0, category: 'vigorous' },
        { name: 'Bicycling, 20+ mph', met: 16.0, category: 'vigorous' },
        { name: 'Calisthenics, heavy, vigorous', met: 8.0, category: 'vigorous' },
        { name: 'Canoeing, 5 mph or portaging', met: 7.0, category: 'vigorous' },
        { name: 'Chopping wood', met: 6.0, category: 'vigorous' },
        { name: 'Dancing, aerobic or ballet', met: 6.0, category: 'vigorous' },
        { name: 'Fencing', met: 6.0, category: 'vigorous' },
        { name: 'Fishing in stream with waders', met: 6.5, category: 'vigorous' },
        { name: 'Football, competitive', met: 9.0, category: 'vigorous' },
        { name: 'Football, touch/flag', met: 8.0, category: 'vigorous' },
        { name: 'Frisbee, ultimate', met: 8.0, category: 'vigorous' },
        { name: 'Hockey, field or ice', met: 8.0, category: 'vigorous' },
        { name: 'Ice skating, social', met: 7.0, category: 'vigorous' },
        { name: 'Jogging, 12 min/mile', met: 8.0, category: 'vigorous' },
        { name: 'Judo/karate/tae kwan do', met: 10.0, category: 'vigorous' },
        { name: 'Lacrosse', met: 8.0, category: 'vigorous' },
        { name: 'Logging/felling trees', met: 8.0, category: 'vigorous' },
        { name: 'Mountain climbing', met: 8.0, category: 'vigorous' },
        { name: 'Race walking, moderate pace', met: 6.5, category: 'vigorous' },
        { name: 'Racquetball', met: 10.0, category: 'vigorous' },
        { name: 'Racquetball, team', met: 8.0, category: 'vigorous' },
        { name: 'Roller skating', met: 7.0, category: 'vigorous' },
        { name: 'Rollerblading, fast', met: 12.0, category: 'vigorous' },
        { name: 'Jump Rope, slow', met: 8.0, category: 'vigorous' },
        { name: 'Jump Rope, fast', met: 12.0, category: 'vigorous' },
        { name: 'Running, 7 min/mile', met: 14.0, category: 'vigorous' },
        { name: 'Running, 8 min/mile', met: 12.5, category: 'vigorous' },
        { name: 'Running, 9 min/mile', met: 11.0, category: 'vigorous' },
        { name: 'Shoveling snow', met: 6.0, category: 'vigorous' },
        { name: 'Skiing downhill, moderate', met: 6.0, category: 'vigorous' },
        { name: 'Skiing downhill, vigorous', met: 8.0, category: 'vigorous' },
        { name: 'Skiing cross country, slow', met: 7.0, category: 'vigorous' },
        { name: 'Skiing cross country, moderate', met: 8.0, category: 'vigorous' },
        { name: 'Skiing cross country, vigorous', met: 9.0, category: 'vigorous' },
        { name: 'Skiing cross country, racing uphill', met: 16.5, category: 'vigorous' },
        { name: 'Skin diving', met: 12.5, category: 'vigorous' },
        { name: 'Snow shoeing', met: 8.0, category: 'vigorous' },
        { name: 'Soccer, competitive', met: 10.0, category: 'vigorous' },
        { name: 'Surfing', met: 6.0, category: 'vigorous' },
        { name: 'Swimming laps, moderate pace', met: 7.0, category: 'vigorous' },
        { name: 'Swimming laps, fast', met: 10.0, category: 'vigorous' },
        { name: 'Swimming laps, sidestroke', met: 8.0, category: 'vigorous' },
        { name: 'Tennis', met: 7.0, category: 'vigorous' },
        { name: 'Volleyball, competitive/beach', met: 8.0, category: 'vigorous' },
        { name: 'Walking, 11 min/mile', met: 11.0, category: 'vigorous' },
        { name: 'Walking up stairs', met: 8.0, category: 'vigorous' },
        { name: 'Water jogging', met: 8.0, category: 'vigorous' },
        { name: 'Water polo', met: 10.0, category: 'vigorous' },
        { name: 'Wrestling', met: 6.0, category: 'vigorous' },
        { name: 'Hiking up hills', met: 6.9, category: 'vigorous' },
        { name: 'Hiking hills, 12 lb pack', met: 7.5, category: 'vigorous' },
    ];

    // Function to calculate calories burned using MET formula
    const calculateCaloriesBurned = (activity: METActivity, duration: number, weight: number) => {
        // Apply intensity modifier
        let intensityMultiplier = 1.0; // default (moderate)

        if (exerciseIntensity === 'light') {
            intensityMultiplier = 0.8; // 20% reduction for light intensity
        } else if (exerciseIntensity === 'vigorous') {
            intensityMultiplier = 1.2; // 20% increase for vigorous intensity
        }

        // Adjusted MET value based on personal intensity
        const adjustedMET = activity.met * intensityMultiplier;

        // Formula: Exercise calories = (MET level of activity x 3.5 x Weight (kg) x minutes of activity) / 200
        return Math.round((adjustedMET * 3.5 * weight * duration) / 200);
    };

    // Filter activities based on search query
    const filteredActivities = searchQuery.trim() === ''
        ? metActivities
        : metActivities.filter(activity =>
            activity.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Group activities by category for display
    const groupedActivities = {
        popular: filteredActivities.slice(0, 10), // First 10 are popular activities
        light: filteredActivities.filter(a => a.category === 'light'),
        moderate: filteredActivities.filter(a => a.category === 'moderate'),
        vigorous: filteredActivities.filter(a => a.category === 'vigorous')
    };

    // Add a real exercise function
    const addNewExercise = async () => {
        if (!selectedActivity && !isManualEntry) {
            Alert.alert('Select Activity', 'Please select an activity from the list or use manual entry');
            return;
        }

        if (isManualEntry && !manualActivityName.trim()) {
            Alert.alert('Activity Name Required', 'Please enter a name for your activity');
            return;
        }

        try {
            const formattedDate = formatDateToString(currentDate);

            // Calculate calories burned
            const duration = parseInt(exerciseDuration) || 30;

            let caloriesBurned = 0;
            let activityName = '';
            let metValue = 0;

            if (isManualEntry) {
                metValue = parseFloat(manualMET) || 5.0;
                activityName = manualActivityName.trim();

                // Apply intensity modifier for manual entry
                let intensityMultiplier = 1.0;
                if (exerciseIntensity === 'light') intensityMultiplier = 0.8;
                if (exerciseIntensity === 'vigorous') intensityMultiplier = 1.2;

                // Formula: Exercise calories = (MET level of activity x 3.5 x Weight (kg) x minutes of activity) / 200
                caloriesBurned = Math.round((metValue * intensityMultiplier * 3.5 * userWeight * duration) / 200);
            } else {
                caloriesBurned = calculateCaloriesBurned(selectedActivity!, duration, userWeight);
                activityName = selectedActivity!.name;
                metValue = selectedActivity!.met;
            }

            // Get intensity multiplier for notes
            let intensityMultiplier = "1.0";
            if (exerciseIntensity === 'light') intensityMultiplier = "0.8";
            if (exerciseIntensity === 'vigorous') intensityMultiplier = "1.2";

            const exerciseData = {
                exercise_name: activityName,
                calories_burned: caloriesBurned,
                duration: duration,
                date: formattedDate,
                notes: `MET: ${metValue}, Intensity: ${exerciseIntensity} (${intensityMultiplier}x multiplier)`
            };

            const result = await addExercise(exerciseData);
            console.log('Exercise added with ID:', result);

            // Reset form fields
            setSelectedActivity(null);
            setExerciseDuration('30');
            setExerciseIntensity('moderate');
            setSearchQuery('');
            setManualMET('5.0');
            setManualActivityName('');
            setIsManualEntry(false);

            // Close modal
            setExerciseModalVisible(false);

            // Refresh exercise list
            refreshMealData();
        } catch (error) {
            console.error('Error adding exercise:', error);
            Alert.alert('Error', 'Failed to add exercise. Please try again.');
        }
    };

    // Render activity item for the flat list
    const renderActivityItem = ({ item }: { item: METActivity }) => {
        const isSelected = selectedActivity?.name === item.name;
        return (
            <TouchableOpacity
                style={[
                    styles.activityItem,
                    isSelected && styles.selectedActivityItem
                ]}
                onPress={() => setSelectedActivity(item)}
            >
                <View style={styles.activityInfo}>
                    <Text style={[
                        styles.activityName,
                        isSelected && { color: '#0074dd' }
                    ]}>
                        {item.name}
                    </Text>
                    <Text style={styles.activityMet}>
                        MET: {item.met} ({item.category})
                    </Text>
                </View>
                {selectedActivity?.name === item.name && (
                    <View style={styles.checkmarkContainer}>
                        <Ionicons name="checkmark-circle" size={24} color="#0074dd" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

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

        // Exercise modal styles
        exerciseModalContent: ViewStyle;
        exerciseModalScrollContent: ViewStyle;
        exerciseModalTitle: TextStyle;
        searchInputContainer: ViewStyle;
        searchInput: TextStyle;
        sectionHeader: TextStyle;
        activitiesContainer: ViewStyle;
        activityItem: ViewStyle;
        selectedActivityItem: ViewStyle;
        activityInfo: ViewStyle;
        activityName: TextStyle;
        activityMet: TextStyle;
        checkmarkContainer: ViewStyle;
        inputLabel: TextStyle;
        inputContainer: ViewStyle;
        intensityContainer: ViewStyle;
        intensityButton: ViewStyle;
        intensityButtonSelected: ViewStyle;
        intensityButtonText: TextStyle;
        intensityButtonTextSelected: TextStyle;
        caloriesResult: ViewStyle;
        caloriesResultText: TextStyle;
        caloriesFormula: TextStyle;
        buttonRow: ViewStyle;
        modalCancelButton: ViewStyle;
        modalAddButton: ViewStyle;
        modalButtonText: TextStyle;
        input: TextStyle;
        inputRow: ViewStyle;
        durationInputContainer: ViewStyle;
        popularActivitiesCard: ViewStyle;
        popularActivitiesCardInner: ViewStyle;
        popularActivitiesHeader: ViewStyle;
        popularActivitiesTitle: TextStyle;
        popularActivityItem: ViewStyle;
        popularActivitiesWrapper: ViewStyle;
        popularActivitiesContainer: ViewStyle;
        popularActivitiesScroll: ViewStyle;
        orDivider: ViewStyle;
        orText: TextStyle;
        exerciseModalDivider: ViewStyle;
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

        // Exercise modal specific divider
        exerciseModalDivider: {
            borderBottomWidth: 1,
            borderBottomColor: '#333',
            marginVertical: 5,
            marginHorizontal: -20, // Extend beyond container padding
            width: '130%', // Even wider coverage to ensure full stretch
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

        // Exercise modal styles
        exerciseModalContent: {
            width: '95%',
            maxHeight: '90%',
            backgroundColor: '#1e1e1e',
            borderRadius: 10,
            padding: 20,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            flexDirection: 'column' as const,
            justifyContent: 'space-between' as const,
            flex: 1,
        },
        exerciseModalScrollContent: {
            flexGrow: 1,
            paddingTop: 10,
        },
        exerciseModalTitle: {
            fontSize: 22,
            fontWeight: 'bold',
            color: '#fff', // Default color for when the gradient isn't loaded
            marginBottom: 0,
            textAlign: 'center',
            paddingHorizontal: 10,
            width: '100%'
        },
        searchInputContainer: {
            marginBottom: 15,
            backgroundColor: '#333',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            flexDirection: 'row' as const,
            alignItems: 'center' as const
        },
        searchInput: {
            flex: 1,
            color: 'white',
            marginLeft: 8,
            fontSize: 16
        },
        sectionHeader: {
            fontSize: 16,
            fontWeight: 'bold',
            color: PURPLE_ACCENT,
            marginTop: 10,
            marginBottom: 5,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 116, 221, 0.2)',
            paddingTop: 8
        },
        activitiesContainer: {
            // Use flex instead of fixed height to allow content to adapt
            flex: 1,
            marginBottom: 10
        },
        activityItem: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            alignItems: 'center' as const,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#333'
        },
        selectedActivityItem: {
            backgroundColor: 'rgba(0, 116, 221, 0.1)'
        },
        activityInfo: {
            flex: 1
        },
        activityName: {
            color: 'white',
            fontSize: 16
        },
        activityMet: {
            color: '#aaa',
            fontSize: 14,
            marginTop: 3
        },
        checkmarkContainer: {
            marginLeft: 10
        },
        inputLabel: {
            color: 'white',
            fontSize: 16,
            marginTop: 0, // Removed top margin since we'll use row margins instead
            marginBottom: 0, // Removed bottom margin since we'll use row margins instead
            flex: 1
        },
        inputContainer: {
            backgroundColor: '#333',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 10
        },
        input: {
            color: 'white',
            fontSize: 16
        },
        intensityContainer: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            marginVertical: 5 // Reduced from 15 to 5 to make sections more compact
        },
        intensityButton: {
            paddingVertical: 6, // Reduced from 8 to 6
            paddingHorizontal: 8, // Reduced from 10 to 8
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            backgroundColor: 'transparent',
        },
        intensityButtonSelected: {
            backgroundColor: '#0074dd',
        },
        intensityButtonText: {
            color: '#888',
            fontSize: 14,
            fontWeight: '500',
        },
        intensityButtonTextSelected: {
            color: '#fff',
            fontWeight: 'bold',
        },
        caloriesResult: {
            alignItems: 'center' as const,
            marginVertical: 8,
            padding: 10,
            backgroundColor: 'rgba(0, 116, 221, 0.1)',
            borderRadius: 8
        },
        caloriesResultText: {
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold'
        },
        caloriesFormula: {
            color: '#aaa',
            fontSize: 14,
            marginBottom: 8,
            textAlign: 'center'
        },
        buttonRow: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            marginTop: 10,
            width: '100%',
            paddingBottom: 0
        },
        modalCancelButton: {
            flex: 0.48,
            marginRight: 5,
            paddingVertical: 12,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            borderRadius: 8,
            backgroundColor: '#444'
        },
        modalAddButton: {
            flex: 0.48,
            marginLeft: 5,
            paddingVertical: 12,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            borderRadius: 8,
            backgroundColor: '#0074dd',
            shadowColor: '#0074dd',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.6,
            shadowRadius: 3,
            elevation: 4
        },
        modalButtonText: {
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
            textAlign: 'center'
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 15,
            marginBottom: 10
        },
        durationInputContainer: {
            backgroundColor: '#333',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            width: 80,
            marginLeft: 5 // Reduced from 10 to 5 to move closer to the text
        },
        popularActivitiesCard: {
            backgroundColor: '#181818',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(0, 116, 221, 0.3)',
            padding: 8,
            marginBottom: 15,
            shadowColor: '#0074dd',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2
        },
        popularActivitiesCardInner: {
            marginTop: 0,
            marginBottom: 15,
            padding: 8,
            backgroundColor: 'transparent'
        },
        popularActivitiesHeader: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            marginBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 116, 221, 0.3)',
            paddingBottom: 6
        },
        popularActivitiesTitle: {
            color: PURPLE_ACCENT,
            fontSize: 15,
            fontWeight: 'bold',
            marginLeft: 8
        },
        popularActivityItem: {
            backgroundColor: 'rgba(0, 116, 221, 0.05)',
            borderBottomColor: 'rgba(0, 116, 221, 0.2)',
            borderRadius: 4,
            marginBottom: 6,
            borderLeftWidth: 2,
            borderLeftColor: 'rgba(0, 116, 221, 0.5)',
        },
        popularActivitiesWrapper: {
            position: 'relative',
            borderRadius: 10,
            marginBottom: 15,
            overflow: 'hidden',
            shadowColor: '#0074dd',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 3
        },
        popularActivitiesContainer: {
            margin: 1,
            borderRadius: 9,
            backgroundColor: '#181818',
            padding: 12,
        },
        popularActivitiesScroll: {
            maxHeight: 400, // Taller to fit all activities
        },
        orDivider: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 15,
        },
        orText: {
            color: '#aaa',
            fontSize: 14,
            paddingHorizontal: 10,
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
        setCurrentDate(newDate);
    };

    const gotoNextDay = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    const formatDate = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: swipeAnim } }],
        { useNativeDriver: true }
    );

    const onHandlerStateChange = (event: any) => {
        if (event.nativeEvent.state === GestureState.END) {
            const { translationX } = event.nativeEvent;
            handleSwipeRelease(translationX);
        }
    };

    const handleSwipeRelease = (translationX: number) => {
        const threshold = 100; // Minimum swipe distance to trigger day change

        if (translationX <= -threshold) {
            // Swipe left -> next day
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() + 1);
            setCurrentDate(newDate);
            swipeAnim.setValue(0);
        } else if (translationX >= threshold) {
            // Swipe right -> previous day
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() - 1);
            setCurrentDate(newDate);
            swipeAnim.setValue(0);
        } else {
            // Not enough swipe; snap back
            Animated.timing(swipeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    };

    const toggleMacrosDisplay = () => {
        // Toggle between percent and grams for macros display
    };

    const handleFoodItemLongPress = (foodId: number | undefined, foodName: string, mealType: string, index: number) => {
        // Handle long press on food item
    };

    const handleDeleteFoodItem = () => {
        // Handle food item deletion
    };

    const moveFood = (id: number | undefined, mealType: string) => {
        // Move food to a different meal
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

    return (
        <GestureHandlerRootView style={containerStyle}>
            <SafeAreaView style={[styles.container, containerStyle]}>
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
                            <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
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
                    activeOffsetX={[-20, 20]} // increased offset to reduce sensitivity
                >
                    <Animated.View style={[styles.animatedContent, { transform: [{ translateX: swipeAnim }] }]}>
                        <ScrollView
                            contentContainerStyle={styles.scrollInner}
                            showsVerticalScrollIndicator={false}
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
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={exerciseModalVisible}
                    onRequestClose={() => {
                        setExerciseModalVisible(false);
                        setSelectedActivity(null);
                    }}
                >
                    <TouchableWithoutFeedback onPress={() => {
                        setExerciseModalVisible(false);
                        setSelectedActivity(null);
                    }}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback onPress={() => { }}>
                                <View style={styles.exerciseModalContent}>
                                    <MaskedView
                                        maskElement={
                                            <Text style={styles.exerciseModalTitle}>Add Exercise</Text>
                                        }
                                    >
                                        <LinearGradient
                                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ height: 30, width: '100%' }}
                                        />
                                    </MaskedView>

                                    <TouchableOpacity
                                        style={styles.exitButton}
                                        onPress={() => {
                                            setExerciseModalVisible(false);
                                            setSelectedActivity(null);
                                            setIsManualEntry(false);
                                        }}
                                    >
                                        <Ionicons name="close" size={28} color="#8A2BE2" />
                                    </TouchableOpacity>

                                    <View style={{ height: 15 }} />

                                    {/* Make the content scrollable */}
                                    <ScrollView contentContainerStyle={styles.exerciseModalScrollContent}>
                                        {!selectedActivity && !isManualEntry ? (
                                            <>
                                                {/* Manual Entry Card */}
                                                <TouchableOpacity
                                                    style={[styles.popularActivitiesWrapper, { marginBottom: 8 }]} // Reduced from default marginBottom: 15 to 8
                                                    onPress={() => setIsManualEntry(true)}
                                                >
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
                                                    <View style={styles.popularActivitiesContainer}>
                                                        <View style={styles.popularActivitiesHeader}>
                                                            <Ionicons name="create-outline" size={20} color="#0074dd" />
                                                            <Text style={styles.popularActivitiesTitle}>Manual Entry</Text>
                                                        </View>
                                                        <Text style={[styles.activityMet, { marginBottom: 5 }]}>
                                                            Enter your own activity name and MET value
                                                        </Text>
                                                        <TouchableOpacity
                                                            style={[styles.intensityButton, {
                                                                backgroundColor: 'transparent',
                                                                width: '100%',
                                                                marginTop: 10,
                                                                borderWidth: 1,
                                                                borderColor: '#8A2BE2'
                                                            }]}
                                                            onPress={() => setIsManualEntry(true)}
                                                        >
                                                            <Text style={[styles.intensityButtonText, { color: '#AA00FF', fontWeight: 'bold' }]}>Enter Manually</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Or divider */}
                                                <View style={[styles.orDivider, { marginVertical: 8 }]}> // Reduced from marginVertical: 15 to 8
                                                    <View style={styles.dividerLine} />
                                                    <Text style={styles.orText}>OR</Text>
                                                    <View style={styles.dividerLine} />
                                                </View>

                                                {/* Search Input */}
                                                <View style={styles.searchInputContainer}>
                                                    <Ionicons name="search" size={20} color="#999" />
                                                    <TextInput
                                                        style={styles.searchInput}
                                                        placeholder="Search activities..."
                                                        placeholderTextColor="#999"
                                                        value={searchQuery}
                                                        onChangeText={setSearchQuery}
                                                    />
                                                </View>

                                                {/* Activities List */}
                                                <View style={styles.activitiesContainer}>
                                                    {searchQuery === '' ? (
                                                        <View style={styles.popularActivitiesWrapper}>
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
                                                            <View style={styles.popularActivitiesContainer}>
                                                                <ScrollView
                                                                    nestedScrollEnabled={true}
                                                                    style={styles.popularActivitiesScroll}
                                                                    contentContainerStyle={{
                                                                        paddingBottom: 15
                                                                    }}
                                                                >
                                                                    <Text style={[styles.sectionHeader, {
                                                                        marginTop: 0,
                                                                        borderTopWidth: 0,
                                                                        paddingTop: 0
                                                                    }]}>Popular Activities</Text>
                                                                    {groupedActivities.popular.map((activity, index) =>
                                                                        renderActivityItem({ item: activity })
                                                                    )}

                                                                    <Text style={styles.sectionHeader}>Light Activities ({'<'} 3 METs)</Text>
                                                                    {groupedActivities.light.map((activity, index) =>
                                                                        renderActivityItem({ item: activity })
                                                                    )}

                                                                    <Text style={styles.sectionHeader}>Moderate Activities (3-6 METs)</Text>
                                                                    {groupedActivities.moderate.map((activity, index) =>
                                                                        renderActivityItem({ item: activity })
                                                                    )}

                                                                    <Text style={styles.sectionHeader}>Vigorous Activities ({'>'} 6 METs)</Text>
                                                                    {groupedActivities.vigorous.map((activity, index) =>
                                                                        renderActivityItem({ item: activity })
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        </View>
                                                    ) : (
                                                        <FlatList
                                                            data={filteredActivities}
                                                            renderItem={renderActivityItem}
                                                            keyExtractor={(item) => item.name}
                                                            nestedScrollEnabled={true}
                                                        />
                                                    )}
                                                </View>
                                            </>
                                        ) : isManualEntry ? (
                                            /* Manual Entry Form */
                                            <View style={{ marginTop: 10 }}>
                                                <TouchableOpacity
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        marginBottom: 15
                                                    }}
                                                    onPress={() => setIsManualEntry(false)}
                                                >
                                                    <Ionicons name="arrow-back" size={20} color="#0074dd" />
                                                    <Text style={{ color: '#0074dd', marginLeft: 5 }}>Back to activity list</Text>
                                                </TouchableOpacity>

                                                <Text style={styles.inputLabel}>Activity Name:</Text>
                                                <View style={styles.inputContainer}>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={manualActivityName}
                                                        onChangeText={setManualActivityName}
                                                        placeholder="e.g., Tennis with friends"
                                                        placeholderTextColor="#777"
                                                    />
                                                </View>

                                                <View style={styles.inputRow}>
                                                    <Text style={styles.inputLabel}>MET Value:</Text>
                                                    <View style={styles.durationInputContainer}>
                                                        <TextInput
                                                            style={styles.input}
                                                            keyboardType="numeric"
                                                            value={manualMET}
                                                            onChangeText={setManualMET}
                                                        />
                                                    </View>
                                                </View>

                                                {/* Divider before Duration */}
                                                <View style={styles.exerciseModalDivider} />

                                                <View style={styles.inputRow}>
                                                    <Text style={styles.inputLabel}>Duration (minutes):</Text>
                                                    <View style={styles.durationInputContainer}>
                                                        <TextInput
                                                            style={styles.input}
                                                            keyboardType="number-pad"
                                                            value={exerciseDuration}
                                                            onChangeText={setExerciseDuration}
                                                        />
                                                    </View>
                                                </View>

                                                {/* Divider before Intensity */}
                                                <View style={styles.exerciseModalDivider} />

                                                {/* Intensity Selection - First instance */}
                                                <View style={styles.inputRow}>
                                                    <Text style={[styles.inputLabel, { marginRight: 2, width: 60 }]}>Intensity:</Text>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton,
                                                            { marginRight: 3 }
                                                        ]}
                                                        onPress={() => setExerciseIntensity('light')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'light' && styles.intensityButtonTextSelected
                                                        ]}>Light</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton,
                                                            { marginRight: 3 }
                                                        ]}
                                                        onPress={() => setExerciseIntensity('moderate')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'moderate' && styles.intensityButtonTextSelected
                                                        ]}>Moderate</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton
                                                        ]}
                                                        onPress={() => setExerciseIntensity('vigorous')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'vigorous' && styles.intensityButtonTextSelected
                                                        ]}>Vigorous</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Divider after Intensity */}
                                                <View style={styles.exerciseModalDivider} />

                                                {/* Calories Result */}
                                                <View style={styles.caloriesResult}>
                                                    <Text style={styles.caloriesFormula}>
                                                        {exerciseIntensity === 'moderate' ? (
                                                            `MET: ${manualMET} × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        ) : exerciseIntensity === 'light' ? (
                                                            `MET: ${manualMET} × 0.8 (light) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        ) : (
                                                            `MET: ${manualMET} × 1.2 (vigorous) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        )}
                                                    </Text>
                                                    <Text style={styles.caloriesResultText}>
                                                        = {Math.round((parseFloat(manualMET) || 5.0) *
                                                            (exerciseIntensity === 'light' ? 0.8 : exerciseIntensity === 'vigorous' ? 1.2 : 1.0) *
                                                            3.5 * userWeight * (parseInt(exerciseDuration) || 30) / 200)} calories
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : selectedActivity && (
                                            <>
                                                {/* Divider before Duration section */}
                                                <View style={styles.exerciseModalDivider} />

                                                {/* Duration Input - changed to horizontal layout */}
                                                <View style={styles.inputRow}>
                                                    <Text style={styles.inputLabel}>Duration (minutes):</Text>
                                                    <View style={styles.durationInputContainer}>
                                                        <TextInput
                                                            style={styles.input}
                                                            keyboardType="number-pad"
                                                            value={exerciseDuration}
                                                            onChangeText={setExerciseDuration}
                                                        />
                                                    </View>
                                                </View>

                                                {/* Divider before Intensity */}
                                                <View style={styles.exerciseModalDivider} />

                                                {/* Intensity Selection - Second instance */}
                                                <View style={styles.inputRow}>
                                                    <Text style={[styles.inputLabel, { marginRight: 2, width: 60 }]}>Intensity:</Text>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton,
                                                            { marginRight: 3 }
                                                        ]}
                                                        onPress={() => setExerciseIntensity('light')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'light' && styles.intensityButtonTextSelected
                                                        ]}>Light</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton,
                                                            { marginRight: 3 }
                                                        ]}
                                                        onPress={() => setExerciseIntensity('moderate')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'moderate' && styles.intensityButtonTextSelected
                                                        ]}>Moderate</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.intensityButton
                                                        ]}
                                                        onPress={() => setExerciseIntensity('vigorous')}
                                                    >
                                                        <Text style={[
                                                            styles.intensityButtonText,
                                                            exerciseIntensity === 'vigorous' && styles.intensityButtonTextSelected
                                                        ]}>Vigorous</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Divider after Intensity */}
                                                <View style={styles.exerciseModalDivider} />

                                                {/* Calories Result */}
                                                <View style={styles.caloriesResult}>
                                                    <Text style={styles.caloriesFormula}>
                                                        {exerciseIntensity === 'moderate' ? (
                                                            `MET: ${selectedActivity.met} × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        ) : exerciseIntensity === 'light' ? (
                                                            `MET: ${selectedActivity.met} × 0.8 (light) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        ) : (
                                                            `MET: ${selectedActivity.met} × 1.2 (vigorous) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                                        )}
                                                    </Text>
                                                    <Text style={styles.caloriesResultText}>
                                                        = {calculateCaloriesBurned(
                                                            selectedActivity,
                                                            parseInt(exerciseDuration) || 30,
                                                            userWeight
                                                        )} calories
                                                    </Text>
                                                </View>
                                            </>
                                        )}

                                        {/* Add margin at bottom to ensure space for buttons */}
                                        <View style={{ marginBottom: 20 }} />
                                    </ScrollView>

                                    {/* Buttons - fixed at bottom */}
                                    <View style={styles.buttonRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.modalAddButton,
                                                {
                                                    flex: 1,
                                                    backgroundColor: 'transparent',
                                                    width: '100%',
                                                    borderWidth: 1,
                                                    borderColor: '#C050FF', // Brighter purple for border
                                                    shadowColor: 'transparent',
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0,
                                                    shadowRadius: 0,
                                                    elevation: 0
                                                },
                                                (!selectedActivity && !isManualEntry) && { opacity: 0.5 },
                                                (isManualEntry && !manualActivityName.trim()) && { opacity: 0.5 }
                                            ]}
                                            onPress={addNewExercise}
                                            disabled={(!selectedActivity && !isManualEntry) || (isManualEntry && !manualActivityName.trim())}
                                        >
                                            <Text style={[styles.modalButtonText, { color: '#D020FF', fontWeight: 'bold' }]}>ADD EXERCISE</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>

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