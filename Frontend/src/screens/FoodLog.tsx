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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { PanGestureHandler, GestureHandlerRootView, State as GestureState } from 'react-native-gesture-handler';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFoodLogsByDate, getExercisesByDate, addExercise, deleteFoodLog, updateFoodLog } from '../utils/database';
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

    // Check for navigation params that should trigger a refresh
    useEffect(() => {
        const params = route.params as FoodLogRouteParams;
        if (params?.refresh) {
            console.log('Received refresh parameter from navigation:', params.refresh);
            refreshMealData();
        }
    }, [route.params]);

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
        setRefreshTrigger(prev => prev + 1);
    };

    // Subscribe to navigation focus events to refresh data when returning to this screen
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            console.log('Screen focused, refreshing data...');
            refreshMealData();
        });

        return unsubscribe;
    }, [navigation]);

    const updateMealItems = (mealType, entries) => {
        return entries.map(entry => ({
            name: `${entry.food_name}\nProtein ${entry.proteins}g`,
            calories: entry.calories
        }));
    };

    useEffect(() => {
        const fetchMeals = async () => {
            try {
                // Don't set loading true right away, we want to show existing data immediately
                processedMealData.current = false; // Reset before fetching new data

                // Format the current date to match the database format (YYYY-MM-DD)
                const formattedDate = formatDateToString(currentDate);
                console.log('Fetching meals for date:', formattedDate);

                // Setup default meals
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
                const localData = await getFoodLogsByDate(formattedDate) as FoodLogEntry[];
                console.log('Local meal data:', localData);

                // Store local data in a ref for later use
                localMealDataRef.current = localData;

                // Process local data into the format needed for display
                if (localData && localData.length > 0) {
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

                    // Set meal data immediately from local database
                    setMealData(updatedMeals);
                    console.log('Updated meal data from local database:', updatedMeals);
                } else {
                    // If no local data, just set the defaults
                    setMealData(defaultMeals);
                }

                // After showing local data, try to fetch from backend in the background
                setLoading(false); // Ensure we're not showing loading state anymore

                // Fetch from backend if online
                const online = await isOnline();
                if (online) {
                    try {
                        console.log('Fetching from backend API...');
                        // Get data by date from the backend
                        const dateResponse = await fetch(`${BACKEND_URL}/meal_entries/by-date/${formattedDate}`);

                        if (dateResponse.ok) {
                            const backendDateData = await dateResponse.json();
                            console.log('Backend data by date:', backendDateData);

                            if (backendDateData && backendDateData.length > 0) {
                                // Process backend data by date
                                const mealDict: Record<string, Meal> = {};

                                // Initialize with default meal types
                                mealTypes.forEach(type => {
                                    mealDict[type] = {
                                        title: type,
                                        total: 0,
                                        macros: { carbs: 0, fat: 0, protein: 0 },
                                        items: []
                                    };
                                });

                                // Group by meal type
                                backendDateData.forEach(entry => {
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

                                // Convert back to array
                                const updatedMeals = Object.values(mealDict);

                                // Sort meals in the correct order
                                updatedMeals.sort((a, b) => {
                                    const order = { 'Breakfast': 1, 'Lunch': 2, 'Dinner': 3, 'Snacks': 4 };
                                    return (order[a.title] || 99) - (order[b.title] || 99);
                                });

                                setMealData(updatedMeals);
                                console.log('Updated meal data from backend by date:', updatedMeals);
                            }
                        }
                    } catch (backendError) {
                        console.error('Error fetching meal data from backend:', backendError);
                        // Continue with local data if backend fetch fails
                    }
                } else {
                    console.log('Device is offline, using only local data');
                }
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

    const toggleStreakInfo = () => {
        setShowStreakInfo(!showStreakInfo);
    };

    const toggleMacrosDisplay = () => {
        setShowMacrosAsPercent(!showMacrosAsPercent);
    };

    const handleOutsidePress = () => {
        if (showStreakInfo) {
            setShowStreakInfo(false);
        }
    };

    const animateSwipe = (direction: number, updateDate: () => void) => {
        Animated.sequence([
            Animated.timing(slideAnim, {
                toValue: direction * 50,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
        updateDate();
    };

    const gotoPrevDay = () => {
        processedMealData.current = false; // Reset when date changes
        animateSwipe(1, () => {
            setCurrentDate(prev => {
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() - 1);
                return newDate;
            });
        });
    };

    const gotoNextDay = () => {
        processedMealData.current = false; // Reset when date changes
        animateSwipe(-1, () => {
            setCurrentDate(prev => {
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() + 1);
                return newDate;
            });
        });
    };

    const formatDate = (date: Date): string => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        // Remove time
        const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const t = stripTime(today);
        const d = stripTime(date);
        const diff = d.getTime() - t.getTime();

        if (diff === 0) return "Today";
        if (diff === -86400000) return "Yesterday";
        if (diff === 86400000) return "Tomorrow";

        // Fallback: e.g., Sunday, Feb 02
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: '2-digit' };
        return date.toLocaleDateString(undefined, options);
    };

    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: swipeAnim } }],
        { useNativeDriver: true }
    );

    const handleSwipeRelease = (translationX: number) => {
        const threshold = 100;
        if (translationX <= -threshold) {
            // swipe left -> next day
            processedMealData.current = false; // Reset when date changes
            Animated.timing(swipeAnim, {
                toValue: -screenWidth,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setCurrentDate(prev => {
                    const newDate = new Date(prev);
                    newDate.setDate(newDate.getDate() + 1);
                    return newDate;
                });
                swipeAnim.setValue(0); // Set to 0 directly instead of screenWidth
                // No need for another animation, this prevents the "half-screen" issue
            });
        } else if (translationX >= threshold) {
            // swipe right -> previous day
            processedMealData.current = false; // Reset when date changes
            Animated.timing(swipeAnim, {
                toValue: screenWidth,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setCurrentDate(prev => {
                    const newDate = new Date(prev);
                    newDate.setDate(newDate.getDate() - 1);
                    return newDate;
                });
                swipeAnim.setValue(0); // Set to 0 directly instead of -screenWidth
                // No need for another animation, this prevents the "half-screen" issue
            });
        } else {
            // not enough swipe; snap back
            Animated.timing(swipeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    };

    const onHandlerStateChange = (event: any) => {
        if (event.nativeEvent.state === GestureState.END) {
            const { translationX } = event.nativeEvent;
            handleSwipeRelease(translationX);
        }
    };

    const fetchExercises = async () => {
        try {
            const formattedDate = formatDateToString(currentDate);
            console.log('Fetching exercises for date:', formattedDate);

            // Fetch exercises from local database
            const localExerciseData = await getExercisesByDate(formattedDate);
            console.log('Local exercise data:', localExerciseData);

            if (localExerciseData && localExerciseData.length > 0) {
                // Transform the data to match the Exercise interface
                const transformedData = localExerciseData.map((exercise: any) => ({
                    id: exercise.id,
                    exercise_name: exercise.exercise_name,
                    calories_burned: exercise.calories_burned,
                    duration: exercise.duration,
                    date: exercise.date,
                    notes: exercise.notes || ''
                }));
                setExerciseList(transformedData);
            } else {
                setExerciseList([]);
            }

            // Fetch from backend if online
            const online = await isOnline();
            if (online) {
                try {
                    const response = await fetch(`${BACKEND_URL}/exercises/by-date/${formattedDate}`);
                    if (response.ok) {
                        const backendExerciseData = await response.json();
                        console.log('Backend exercise data:', backendExerciseData);

                        // Transform the data to match the Exercise interface
                        const transformedData = backendExerciseData.map((exercise: any) => ({
                            id: exercise.id,
                            exercise_name: exercise.exercise_name,
                            calories_burned: exercise.calories_burned,
                            duration: exercise.duration,
                            date: exercise.date,
                            notes: exercise.notes || ''
                        }));
                        setExerciseList(transformedData);
                    }
                } catch (error) {
                    console.error('Error fetching from backend:', error);
                }
            }
        } catch (error) {
            console.error('Error fetching exercises:', error);
        }
    };

    useEffect(() => {
        fetchExercises();
    }, [currentDate]); // Fetch exercises when the date changes

    // Update the exercise card to use the new data structure
    const renderExerciseList = () => {
        // If there are no exercises, return null instead of an empty row
        if (exerciseList.length === 0) {
            return null;
        }

        return exerciseList.map((exercise, index) => (
            <View key={index}>
                <View style={styles.logRow}>
                    <View style={{ flexDirection: 'column' }}>
                        <Text style={[styles.logItemText, { fontSize: 16 }]} numberOfLines={1} ellipsizeMode="tail">
                            {exercise.exercise_name}
                        </Text>
                        <Text style={styles.logItemDuration}>{exercise.duration} min</Text>
                    </View>
                    <Text style={styles.logCalText}>{exercise.calories_burned}</Text>
                </View>
                {/* Divider line under each entry */}
                {index < exerciseList.length - 1 && (
                    <View style={styles.entryDividerLine} />
                )}
            </View>
        ));
    };

    // Add a test exercise function
    const addTestExercise = async () => {
        try {
            const formattedDate = formatDateToString(currentDate);
            console.log('Adding test exercise for date:', formattedDate);

            const exerciseData = {
                exercise_name: 'Test Exercise',
                calories_burned: 150,
                duration: 30,
                date: formattedDate,
                notes: 'Added for testing'
            };

            const result = await addExercise(exerciseData);
            console.log('Test exercise added with ID:', result);

            // Refresh exercise list
            fetchExercises();
        } catch (error) {
            console.error('Error adding test exercise:', error);
        }
    };

    // Add effect to check for AsyncStorage refresh trigger
    useEffect(() => {
        const checkAsyncStorageTrigger = async () => {
            try {
                const trigger = await AsyncStorage.getItem('FOOD_LOG_REFRESH_TRIGGER');
                if (trigger) {
                    console.log('Found refresh trigger in AsyncStorage:', trigger);
                    // Clear the trigger and refresh
                    await AsyncStorage.removeItem('FOOD_LOG_REFRESH_TRIGGER');
                    refreshMealData();
                }
            } catch (error) {
                console.error('Error checking AsyncStorage trigger:', error);
            }
        };

        // Check on initial load
        checkAsyncStorageTrigger();

        // Set up a listener to check periodically
        const interval = setInterval(checkAsyncStorageTrigger, 1000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    // Function to handle long press on a food item
    const handleFoodItemLongPress = (foodId: number | undefined, foodName: string, mealType: string, index: number) => {
        console.log('Long press detected:', { foodId, foodName, mealType, index });

        if (!foodId) {
            console.log('Warning: No food ID found for', foodName);

            // Try to find the item in localMealDataRef.current
            if (localMealDataRef.current) {
                const matchingItem = localMealDataRef.current.find(entry =>
                    entry.food_name === foodName &&
                    entry.meal_type.toLowerCase() === mealType.toLowerCase()
                );

                if (matchingItem) {
                    console.log('Found matching item with ID:', matchingItem.id);
                    foodId = matchingItem.id;
                } else {
                    console.log('No matching item found in local data for:', foodName);
                }
            }
        }

        setSelectedFoodItem({
            id: foodId,
            name: foodName,
            meal: mealType,
            index: index
        });

        console.log('Selected food item set to:', {
            id: foodId,
            name: foodName,
            meal: mealType,
            index: index
        });

        setActionModalVisible(true);
    };

    // Function to move food item to different meal type
    const moveFood = async (foodId: number | undefined, newMealType: string) => {
        if (!foodId) return;

        setLoading(true);

        try {
            // Update the food log entry with the new meal type
            await updateFoodLog(foodId, { meal_type: newMealType });
            console.log(`Food item moved to ${newMealType}`);

            // Close modals
            setMoveModalVisible(false);
            setActionModalVisible(false);

            // Reset selected food item
            setSelectedFoodItem(null);

            // Refresh the meal data
            refreshMealData();

            // Show success message
            Alert.alert('Success', `Food item moved to ${newMealType}`);
        } catch (error) {
            console.error('Error moving food item:', error);
            Alert.alert('Error', 'Failed to move food item');
        } finally {
            setLoading(false);
        }
    };

    // Function to handle moving a food item to a different meal
    const handleMoveFoodItem = async (newMealType: string) => {
        if (!selectedFoodItem || !selectedFoodItem.id) {
            console.error('No food item selected for moving');
            return;
        }

        try {
            // Update the meal type in local database
            await updateFoodLog(selectedFoodItem.id, { meal_type: newMealType });
            console.log(`Food item moved to ${newMealType} in local database`);

            // Try to update in backend if online
            const online = await isOnline();
            if (online) {
                try {
                    const response = await fetch(`${BACKEND_URL}/meal_entries/${selectedFoodItem.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ meal_type: newMealType }),
                    });

                    if (response.ok) {
                        console.log(`Food item moved to ${newMealType} in backend`);
                    } else {
                        console.error('Failed to update meal type in backend');
                    }
                } catch (error) {
                    console.error('Error updating meal type in backend:', error);
                }
            }

            // Refresh the food log
            refreshMealData();
        } catch (error) {
            console.error('Error moving food item:', error);
            Alert.alert('Error', 'Failed to move food item');
        } finally {
            setMoveModalVisible(false);
            setActionModalVisible(false);
            setSelectedFoodItem(null);
        }
    };

    // Function to handle deleting a food item
    const handleDeleteFoodItem = async () => {
        if (!selectedFoodItem || !selectedFoodItem.id) {
            console.error('No food item selected for deletion');
            return;
        }

        // Show confirmation dialog
        Alert.alert(
            "Delete Food Item",
            `Are you sure you want to delete "${selectedFoodItem.name}"?`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => setActionModalVisible(false)
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setActionModalVisible(false);
                            setLoading(true);

                            // Try to delete from backend first if online
                            const online = await isOnline();
                            if (online) {
                                try {
                                    const response = await fetch(`${BACKEND_URL}/meal_entries/delete/${selectedFoodItem.id}`, {
                                        method: 'DELETE',
                                    });

                                    if (!response.ok) {
                                        throw new Error('Failed to delete from backend');
                                    }
                                    console.log('Food item deleted from backend');
                                } catch (error) {
                                    console.error('Error deleting food item from backend:', error);
                                    Alert.alert('Error', 'Failed to delete from server. Please try again later.');
                                    return;
                                }
                            }

                            // If backend delete was successful or we're offline, delete from local database
                            await deleteFoodLog(selectedFoodItem.id);
                            console.log('Food item deleted from local database');

                            // Refresh the food log
                            refreshMealData();
                        } catch (error) {
                            console.error('Error deleting food item:', error);
                            Alert.alert('Error', 'Failed to delete food item');
                        } finally {
                            setLoading(false);
                            setSelectedFoodItem(null);
                        }
                    }
                }
            ]
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
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
                                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ width: 27, height: 27 }} // Adjusted size to align with other icons
                                        />
                                    </MaskedView>
                                    <MaskedView
                                        maskElement={<MaterialCommunityIcons name="fire" size={27} color="#FFF" />}
                                    >
                                        <LinearGradient
                                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
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
                            <View style={styles.summaryCard}>
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
                            </View>

                            {/* 3) Meals */}
                            {mealData.map((meal, idx) => (
                                <View key={idx} style={styles.mealSection}>
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
                                </View>
                            ))}

                            {/* 4) Exercise */}
                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={[styles.mealTitle, { fontSize: 18 }]}>Exercise</Text>
                                    <Text style={styles.mealCal}>{totalExerciseCalories}</Text>
                                </View>

                                {/* Divider line under heading */}
                                <View style={styles.dividerLine} />

                                {renderExerciseList()}

                                {/* Only show divider line if there are exercises already */}
                                {exerciseList.length > 0 && <View style={styles.dividerLine} />}

                                <TouchableOpacity style={styles.addBtn} onPress={addTestExercise}>
                                    <Text style={styles.addBtnText}>ADD EXERCISE</Text>
                                </TouchableOpacity>
                            </View>

                            {/* 5) Water */}
                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>Water</Text>
                                </View>
                                {/* Divider line under heading */}
                                <View style={styles.dividerLine} />

                                <TouchableOpacity style={styles.addBtn}>
                                    <Text style={styles.addBtnText}>ADD WATER</Text>
                                </TouchableOpacity>
                            </View>

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
                                        style={styles.cancelButton}
                                        onPress={() => setActionModalVisible(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
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

const styles = StyleSheet.create({
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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

    // Calories Remaining Card
    summaryCard: {
        backgroundColor: '#121212',
        marginTop: 3, // Reduced from 8 to 3 to minimize space
        marginBottom: 12, // Added margin bottom to match spacing between other cards
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
        flexDirection: 'row',
        flexWrap: 'nowrap', // ensure one line
        alignItems: 'center',
        justifyContent: 'center', // Center align row
    },
    equationColumn: {
        alignItems: 'center',
        marginHorizontal: 10, // Add space between columns
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
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        width: '100%', // Ensure full width matches summary card
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        width: '100%', // Ensure full width
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
        marginVertical: 8,
        marginHorizontal: 0, // Change from -16 to 0 to prevent overflow
    },
    entryDividerLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        marginTop: 6,
        marginBottom: 6,
        marginHorizontal: 0, // Change from -16 to 0 to prevent overflow
    },

    // Items
    logRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
        alignItems: 'center',
    },
    addBtnText: {
        color: PURPLE_ACCENT,
        fontSize: 14,
        fontWeight: '600',
    },

    // Bottom actions
    bottomActions: {
        flexDirection: 'column',
        marginTop: 8,
        paddingHorizontal: 0, // Remove extra padding
        width: '100%',
    },
    topActionsRow: {
        flexDirection: 'row',
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
        alignItems: 'center',
        justifyContent: 'center',
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
        alignItems: 'center',
        justifyContent: 'center',
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
        flexDirection: 'row',
        alignItems: 'center'
    },
    streakButton: {
        flexDirection: 'row',
        alignItems: 'center',
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
        justifyContent: 'center',
        alignItems: 'center',
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
        paddingHorizontal: 10, // Reduced from 16 to 10 to make cards wider
        paddingBottom: 100,
        width: '100%',
        alignItems: 'center',
    },
    healthinessCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
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
        justifyContent: 'center',
        alignItems: 'center',
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
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: 'center',
        marginTop: 5,
    },
    cancelButtonText: {
        color: '#AAA',
        fontSize: 16,
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