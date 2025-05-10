import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
    StatusBar,
    Platform,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { getFoodLogsByDate, initDatabase, isDatabaseReady } from '../utils/database';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: screenWidth } = Dimensions.get('window');

// App theme colors
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';

// Define the nutrition data
const macroGoals = {
    protein: { current: 0, goal: 101, unit: 'g' },
    carbs: { current: 0, goal: 253, unit: 'g' },
    fiber: { current: 0, goal: 38, unit: 'g' },
    sugar: { current: 0, goal: 76, unit: 'g' },
    fat: { current: 0, goal: 67, unit: 'g' },
    saturatedFat: { current: 0, goal: 22, unit: 'g' },
    polyunsaturatedFat: { current: 0, goal: 0, unit: 'g' },
    monounsaturatedFat: { current: 0, goal: 0, unit: 'g' },
    transFat: { current: 0, goal: 0, unit: 'g' },
    cholesterol: { current: 0, goal: 300, unit: 'mg' },
    sodium: { current: 0, goal: 2300, unit: 'mg' },
    potassium: { current: 0, goal: 3500, unit: 'mg' },
    vitaminA: { current: 0, goal: 100, unit: '%' },
    vitaminC: { current: 0, goal: 100, unit: '%' },
    calcium: { current: 0, goal: 100, unit: '%' },
    iron: { current: 0, goal: 100, unit: '%' },
    calories: { current: 0, goal: 2000, unit: 'kcal' },
};

// Add a GradientText component for text with gradient
const GradientText = ({ text, style, colors }) => {
    return (
        <MaskedView
            maskElement={
                <Text style={[style, { opacity: 1 }]}>
                    {text}
                </Text>
            }
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text style={[style, { opacity: 0 }]}>
                    {text}
                </Text>
            </LinearGradient>
        </MaskedView>
    );
};

// Helper function to format date as YYYY-MM-DD
const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format date for display (e.g., "Mon, Jan 1")
const formatDateForDisplay = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

const NutrientsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [nutrientData, setNutrientData] = useState(macroGoals);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Animation values
    const translateX = useRef(new Animated.Value(0)).current;
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const scrollRef = useRef(null);

    // Transform interpolations for 3D effect
    const rotate = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: ['10deg', '0deg', '-10deg'],
        extrapolate: 'clamp'
    });

    const scale = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [0.9, 1, 0.9],
        extrapolate: 'clamp'
    });

    // Perspective effect for depth
    const perspective = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp'
    });

    // Date text animation - preventing the text from falling off by using a smaller range
    const dateTextTranslate = swipeAnim.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [screenWidth / 4, 0, -screenWidth / 4], // Reduced range to prevent falling off
        extrapolate: 'clamp'
    });

    // Animation for opacity to fade content in/out during transition
    const contentOpacity = swipeAnim.interpolate({
        inputRange: [-screenWidth / 2, -screenWidth / 4, 0, screenWidth / 4, screenWidth / 2],
        outputRange: [0.7, 0.9, 1, 0.9, 0.7],
        extrapolate: 'clamp'
    });

    // Add this to ensure consistent black background during transitions
    const containerStyle = {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    };

    // Initialize the database when the component mounts
    useEffect(() => {
        const setupDatabase = async () => {
            try {
                // Only initialize if not already initialized
                if (!isDatabaseReady()) {
                    await initDatabase();
                }
                setDbReady(true);
            } catch (error) {
                console.error('Failed to initialize database:', error);
                // Even if it fails, try proceeding anyway
                setDbReady(true);
            }
        };

        setupDatabase();
    }, []);

    // Fetch data when date changes or database becomes ready
    useEffect(() => {
        if (dbReady) {
            fetchNutrientData();
        }
    }, [currentDate, dbReady]);

    const fetchNutrientData = async () => {
        try {
            setLoading(true);

            // Ensure the date is a string in YYYY-MM-DD format
            const dateStr = formatDateToString(currentDate);
            console.log('Fetching nutrient data for date:', dateStr);

            // Check database readiness again just to be safe
            if (!isDatabaseReady()) {
                console.log('Database not ready, initializing...');
                await initDatabase();
            }

            // Get food logs for the date
            const logs: any[] = await getFoodLogsByDate(dateStr);
            console.log(`Found ${logs.length} food log entries for ${dateStr}`);

            // Reset nutrient data to defaults
            const resetData = { ...macroGoals };
            Object.keys(resetData).forEach(key => {
                resetData[key].current = 0;
            });

            // Aggregate nutrients
            const totals = {
                protein: 0,
                carbs: 0,
                fat: 0,
                calories: 0,
                fiber: 0,
                sugar: 0,
                saturatedFat: 0,
                polyunsaturatedFat: 0,
                monounsaturatedFat: 0,
                transFat: 0,
                cholesterol: 0,
                sodium: 0,
                potassium: 0,
                vitaminA: 0,
                vitaminC: 0,
                calcium: 0,
                iron: 0
            };

            if (logs && logs.length > 0) {
                logs.forEach(entry => {
                    if (!entry) return; // Skip undefined entries

                    totals.protein += entry.proteins || 0;
                    totals.carbs += entry.carbs || 0;
                    totals.fat += entry.fats || 0;
                    totals.calories += entry.calories || 0;
                    totals.fiber += entry.fiber || 0;
                    totals.sugar += entry.sugar || 0;
                    totals.saturatedFat += entry.saturated_fat || 0;
                    totals.polyunsaturatedFat += entry.polyunsaturated_fat || 0;
                    totals.monounsaturatedFat += entry.monounsaturated_fat || 0;
                    totals.transFat += entry.trans_fat || 0;
                    totals.cholesterol += entry.cholesterol || 0;
                    totals.sodium += entry.sodium || 0;
                    totals.potassium += entry.potassium || 0;
                    totals.vitaminA += entry.vitamin_a || 0;
                    totals.vitaminC += entry.vitamin_c || 0;
                    totals.calcium += entry.calcium || 0;
                    totals.iron += entry.iron || 0;
                });
            }

            console.log('Final nutrient totals:', totals);

            setNutrientData(prevData => {
                const updatedData = { ...prevData };
                Object.keys(totals).forEach(key => {
                    updatedData[key].current = totals[key];
                });
                return updatedData;
            });
        } catch (error) {
            console.error('Failed to fetch nutrient data from local DB:', error);

            // In case of error, make sure we at least show some data (zeros)
            setNutrientData(prevData => {
                const resetData = { ...prevData };
                Object.keys(resetData).forEach(key => {
                    resetData[key].current = 0;
                });
                return resetData;
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate the remaining amount for each nutrient
    const calculateRemaining = (current: number, goal: number) => {
        return goal - current;
    };

    // Get colors based on nutrient type
    const getNutrientColors = (label: string): readonly [string, string] => {
        const lowerLabel = label.toLowerCase();

        if (lowerLabel.includes('protein')) {
            return ['#B71C1C', '#D32F2F'] as const; // Dark red to slightly lighter red
        } else if (lowerLabel.includes('carbs')) {
            return ['#0D47A1', '#0D47A1'] as const; // Dark blue (no gradient)
        } else if (lowerLabel.includes('fiber')) {
            return ['#2E7D32', '#2E7D32'] as const; // Dark rich green (no gradient)
        } else if (lowerLabel.includes('sugar')) {
            return ['#4A148C', '#6A1B9A'] as const; // Dark purple to slightly lighter purple
        } else if (lowerLabel.includes('fat')) {
            return ['#F57F17', '#FFC107'] as const; // Dark amber to lighter amber
        } else {
            return ['#4A148C', '#7B1FA2'] as const; // Default purple gradient
        }
    };

    // Make sure animation completes in case it gets stuck
    useEffect(() => {
        const cleanup = () => {
            // Reset animation state if component unmounts during transition
            swipeAnim.setValue(0);
            setIsTransitioning(false);
        };

        return cleanup;
    }, []);

    // Improved go to previous day to prevent sticking
    const gotoPrevDay = () => {
        if (isTransitioning) return;

        setIsTransitioning(true);

        // Animate to the right with 3D effect
        Animated.timing(swipeAnim, {
            toValue: screenWidth,
            duration: 250,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                // Update the date
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() - 1);
                setCurrentDate(newDate);

                // Reset the animation value (off-screen to the left)
                swipeAnim.setValue(-screenWidth);

                // Animate back in from the left with 3D effect
                Animated.spring(swipeAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 70,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) {
                        setIsTransitioning(false);
                    } else {
                        // Force it to complete if animation gets interrupted
                        swipeAnim.setValue(0);
                        setIsTransitioning(false);
                    }
                });
            } else {
                // Force it to complete if animation gets interrupted
                swipeAnim.setValue(0);
                setIsTransitioning(false);
            }
        });
    };

    // Improved go to next day to prevent sticking
    const gotoNextDay = () => {
        if (isTransitioning) return;

        setIsTransitioning(true);

        // Animate to the left with 3D effect
        Animated.timing(swipeAnim, {
            toValue: -screenWidth,
            duration: 250,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                // Update the date
                const newDate = new Date(currentDate);
                newDate.setDate(newDate.getDate() + 1);
                setCurrentDate(newDate);

                // Reset the animation value (off-screen to the right)
                swipeAnim.setValue(screenWidth);

                // Animate back in from the right with 3D effect
                Animated.spring(swipeAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 70,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) {
                        setIsTransitioning(false);
                    } else {
                        // Force it to complete if animation gets interrupted
                        swipeAnim.setValue(0);
                        setIsTransitioning(false);
                    }
                });
            } else {
                // Force it to complete if animation gets interrupted
                swipeAnim.setValue(0);
                setIsTransitioning(false);
            }
        });
    };

    // Format date for display
    const formatDate = (date: Date): string => {
        // Check if date is today
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return "Today";
        }

        // Check if date is yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        // Check if date is tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.toDateString() === tomorrow.toDateString()) {
            return "Tomorrow";
        }

        // Otherwise return formatted date
        return formatDateForDisplay(date);
    };

    // Handle horizontal gesture
    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        {
            useNativeDriver: true,
            listener: (event: any) => {
                if (event.nativeEvent && !isTransitioning) {
                    // Pass the swipe translation to our animation value
                    swipeAnim.setValue(event.nativeEvent.translationX * 0.8); // Dampen the effect slightly
                }
            }
        }
    );

    // Handle gesture end
    const onHandlerStateChange = ({ nativeEvent }) => {
        const { translationX, velocityX, state } = nativeEvent;

        if (state === State.END) {
            if (isTransitioning) {
                resetSwipeState();
                return;
            }

            // Threshold for swipe action
            const swipeThreshold = screenWidth / 3;

            // Check if swipe was significant enough
            if (Math.abs(translationX) > swipeThreshold || Math.abs(velocityX) > 800) {
                if (translationX > 0) {
                    // Swipe right - go to previous day
                    gotoPrevDay();
                } else {
                    // Swipe left - go to next day
                    gotoNextDay();
                }
            } else {
                // Not enough to trigger date change, animate back
                resetSwipeState();
            }
        }
    };

    const resetSwipeState = () => {
        // Spring back to center position
        Animated.spring(swipeAnim, {
            toValue: 0,
            friction: 5,
            tension: 40,
            useNativeDriver: true
        }).start();
    };

    const renderNutrientItem = (label: string, current: number, goal: number, unit: string) => {
        const remaining = calculateRemaining(current, goal);
        // Calculate progress as a percentage of the goal, clamped between 0 and 100
        let progressPercent = Math.max(0, Math.min(100, (goal > 0 ? (current / goal) * 100 : 0)));

        // Special case for polyunsaturated and monounsaturated fats:
        // If goal is 0 but current value is > 0, show full bar (100%)
        if (goal === 0 && current > 0) {
            progressPercent = 100;
        }

        const gradientColors = getNutrientColors(label);

        // Display unit correctly based on nutrient type
        const displayUnit = (label.includes('Vitamin') || label.includes('Calcium') || label.includes('Iron'))
            ? ''
            : unit;

        return (
            <View key={label} style={styles.nutrientRow}>
                <View style={styles.nutrientValues}>
                    <View style={styles.leftValues}>
                        <Text style={styles.remainingValue}>{remaining}{displayUnit}</Text>
                    </View>
                    <Text style={styles.nutrientLabel}>{label}</Text>
                    <Text style={styles.rightValue}>{current}/{goal}</Text>
                </View>
                <View style={styles.progressBarContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        locations={[0, 0.6]}
                        style={[styles.progressBar, { width: `${progressPercent}%` }]}
                    />
                </View>
            </View>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, containerStyle]}>
                <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Ionicons name="chevron-back" size={28} color={WHITE} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <GradientText
                                text="NUTRIENTS"
                                colors={["#5A60EA", "#FF00F5"]}
                                style={styles.headerTitle}
                            />
                        </View>
                        <View style={{ width: 28 }} />
                    </View>

                    {/* Day Navigation Bar */}
                    <View style={styles.dayNavContainer}>
                        <TouchableOpacity
                            style={styles.dayNavButton}
                            onPress={gotoPrevDay}
                            disabled={isTransitioning}
                        >
                            <Ionicons name="chevron-back" size={20} color={WHITE} />
                        </TouchableOpacity>
                        <View style={styles.dateContainer}>
                            <Animated.Text style={[styles.todayText, {
                                transform: [{ translateX: dateTextTranslate }]
                            }]}>
                                {formatDate(currentDate)}
                            </Animated.Text>
                        </View>
                        <TouchableOpacity
                            style={styles.dayNavButton}
                            onPress={gotoNextDay}
                            disabled={isTransitioning}
                        >
                            <Ionicons name="chevron-forward" size={20} color={WHITE} />
                        </TouchableOpacity>
                    </View>

                    {/* Content with Gesture Handler */}
                    <PanGestureHandler
                        onGestureEvent={onGestureEvent}
                        onHandlerStateChange={onHandlerStateChange}
                        activeOffsetX={[-20, 20]}  // Only activate for horizontal movement > 20px
                        failOffsetY={[-10, 10]}    // Fail if vertical movement exceeds 10px first
                        enabled={!isTransitioning}
                    >
                        <Animated.View
                            style={[
                                styles.animatedContent,
                                {
                                    opacity: contentOpacity,
                                    transform: [
                                        { perspective: 1000 },
                                        { translateX: swipeAnim },
                                        { rotateY: rotate },
                                        { scale: perspective }
                                    ]
                                }
                            ]}
                        >
                            {/* Column Headers */}
                            <View style={styles.columnHeadersContainer}>
                                <View style={styles.columnHeaders}>
                                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'left' }]}>Remaining</Text>
                                    <View style={{ flex: 2 }} />
                                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Total/Goal</Text>
                                </View>
                                <View style={styles.headerDivider} />
                            </View>

                            {/* Nutrients List */}
                            <ScrollView
                                ref={scrollRef}
                                style={styles.scrollView}
                                showsVerticalScrollIndicator={false}
                                scrollEventThrottle={16}
                            >
                                {!dbReady || loading ? (
                                    <View style={styles.loadingContainer}>
                                        <Text style={styles.loadingText}>{!dbReady ? 'Initializing database...' : 'Loading nutrients...'}</Text>
                                    </View>
                                ) : (
                                    Object.entries(nutrientData)
                                        .filter(([key]) => key !== 'calories')
                                        .map(([key, value]) => {
                                            // Convert key from camelCase to Title Case for display
                                            const label = key.replace(/([A-Z])/g, ' $1')
                                                .replace(/^./, str => str.toUpperCase());
                                            return renderNutrientItem(label, value.current, value.goal, value.unit);
                                        })
                                )}

                                <View style={styles.spacer} />
                            </ScrollView>
                        </Animated.View>
                    </PanGestureHandler>
                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    backButton: {
        padding: 4,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: WHITE,
        textAlign: 'center',
    },
    dayNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingVertical: 4,
        backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
        borderRadius: 6,
        marginHorizontal: 10,
        marginTop: 5,
    },
    dayNavButton: {
        padding: 8,
    },
    todayText: {
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
    },
    columnHeadersContainer: {
        marginTop: 14,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerDivider: {
        height: 1,
        backgroundColor: '#333',
        marginHorizontal: 16,
    },
    columnHeader: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
    },
    nutrientRow: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    nutrientLabel: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '500',
        flex: 2,
        textAlign: 'center',
    },
    nutrientValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    leftValues: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    rightValue: {
        flex: 1,
        fontSize: 16,
        color: WHITE,
        textAlign: 'right',
    },
    remainingValue: {
        fontSize: 16,
        color: '#BBBBBB', // Lighter gray for remaining values
        textAlign: 'left',
    },
    progressBarContainer: {
        height: 5,
        backgroundColor: '#333',
        borderRadius: 2.5,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2.5,
    },
    spacer: {
        height: 20,
    },
    animatedContent: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 200,
    },
    loadingText: {
        color: WHITE,
        fontSize: 16,
    },
    dateContainer: {
        flex: 1,
        overflow: 'hidden', // Prevents date text from visually overflowing
        alignItems: 'center',
    },
});

export default NutrientsScreen;

