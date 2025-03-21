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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { PanGestureHandler, GestureHandlerRootView, State as GestureState } from 'react-native-gesture-handler';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getFoodLogsByDate, getExercisesByDate, addExercise } from '../utils/database';
import { isOnline } from '../utils/syncService';
import { BACKEND_URL } from '../utils/config';

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

const DiaryScreen: React.FC = () => {
    const [mealData, setMealData] = useState<Meal[]>([]);
    const [breakfastEntries, setBreakfastEntries] = useState([]);
    const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
    const navigation = useNavigation<NavigationProp>();
    const [currentDate, setCurrentDate] = useState(new Date());
    const processedMealData = useRef(false);
    const [loading, setLoading] = useState(false);

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
                const localMealData = await getFoodLogsByDate(formattedDate) as FoodLogEntry[];
                console.log('Local meal data:', localMealData);

                // Process local data into the format needed for display
                if (localMealData && localMealData.length > 0) {
                    // Get current meal data to merge with
                    const mealDict: Record<string, Meal> = {};

                    // Initialize with default meal types
                    defaultMeals.forEach(meal => {
                        mealDict[meal.title] = {
                            ...meal,
                            total: 0, // Reset totals as we'll recalculate
                            macros: { carbs: 0, fat: 0, protein: 0 },
                            items: []
                        };
                    });

                    // Group by meal type
                    localMealData.forEach(entry => {
                        if (!entry.meal_type) return; // Skip entries without meal type

                        if (!mealDict[entry.meal_type]) {
                            mealDict[entry.meal_type] = {
                                title: entry.meal_type,
                                total: 0,
                                macros: { carbs: 0, fat: 0, protein: 0 },
                                items: []
                            };
                        }

                        // Add food entry to respective meal
                        mealDict[entry.meal_type].total += entry.calories;
                        mealDict[entry.meal_type].macros.carbs += entry.carbs;
                        mealDict[entry.meal_type].macros.fat += entry.fats;
                        mealDict[entry.meal_type].macros.protein += entry.proteins;
                        mealDict[entry.meal_type].items.push({
                            name: `${entry.food_name}\nProtein ${entry.proteins}g`,
                            calories: entry.calories
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
                                const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
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

                                    // Add food entry to respective meal
                                    mealDict[entry.meal_type].total += entry.calories;
                                    mealDict[entry.meal_type].macros.carbs += entry.carbs;
                                    mealDict[entry.meal_type].macros.fat += entry.fats;
                                    mealDict[entry.meal_type].macros.protein += entry.proteins;
                                    mealDict[entry.meal_type].items.push({
                                        name: `${entry.food_name}\nProtein ${entry.proteins}g`,
                                        calories: entry.calories
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
    }, [currentDate]); // Only re-run when the date changes

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
    const foodTotal = mealData.reduce((acc, meal) => acc + meal.total, 0);
    const remaining = goal - foodTotal + totalExerciseCalories;
    const [showStreakInfo, setShowStreakInfo] = useState(false);
    const [showMacrosAsPercent, setShowMacrosAsPercent] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current; // new animated value
    const swipeAnim = useRef(new Animated.Value(0)).current; // new animated value for full page swiping

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
                                <TouchableOpacity onPress={() => console.log('Open Nutrients')} style={styles.iconButton}>
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
                                                .map((item, i) => (
                                                    <View key={i}>
                                                        <View style={styles.logRow}>
                                                            <Text style={styles.logItemText}>{item.name}</Text>
                                                            <Text style={styles.logCalText}>{item.calories}</Text>
                                                        </View>
                                                        {i < meal.items.length - 1 && <View style={styles.entryDividerLine} />}
                                                    </View>
                                                ))}
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
                                    <TouchableOpacity style={[styles.tabBtn, { flex: 1, marginRight: 8 }]}>
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
        width: '100%', // Ensure full width for exercise names
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
});