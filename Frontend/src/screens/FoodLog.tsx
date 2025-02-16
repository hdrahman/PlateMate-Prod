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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { PanGestureHandler, GestureHandlerRootView, State as GestureState } from 'react-native-gesture-handler';
import axios from 'axios';

const { width: screenWidth } = Dimensions.get('window');
const BACKEND_URL = 'http://172.31.153.15:8000'

const DiaryScreen: React.FC = () => {
    const [mealData, setMealData] = useState([]);
    const [breakfastEntries, setBreakfastEntries] = useState([]);
    const [exerciseList, setExerciseList] = useState([
        { name: 'Running', calories: 250, duration: '30 min' },
        { name: 'Cycling', calories: 180, duration: '20 min' },
    ]);

    const updateMealItems = (mealType, entries) => {
        return entries.map(entry => ({
            name: `${entry.food_name}\nProtein ${entry.proteins}g`,
            calories: entry.calories
        }));
    };

    useEffect(() => {
        const fetchMeals = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/meal_entries/meal-data`);
                setMealData(response.data);
            } catch (error) {
                console.error('Error fetching meal data:', error);
            }
        };
        fetchMeals();
    }, []);

    const goal = 1800;
    const exercise = 450;
    const foodTotal = mealData.reduce((acc, meal) => acc + meal.total, 0);
    const remaining = goal - foodTotal + exercise;
    const [showStreakInfo, setShowStreakInfo] = useState(false);
    const [showMacrosAsPercent, setShowMacrosAsPercent] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
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
        animateSwipe(1, () => {
            setCurrentDate(prev => {
                const newDate = new Date(prev);
                newDate.setDate(newDate.getDate() - 1);
                return newDate;
            });
        });
    };

    const gotoNextDay = () => {
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
                swipeAnim.setValue(screenWidth);
                Animated.timing(swipeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            });
        } else if (translationX >= threshold) {
            // swipe right -> previous day
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
                swipeAnim.setValue(-screenWidth);
                Animated.timing(swipeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
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
                    <Animated.View style={{ flex: 1, transform: [{ translateX: swipeAnim }] }}>
                        <ScrollView contentContainerStyle={styles.scrollInner}>
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
                                            {exercise}
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
                                    {/* Filter out 100 kcal meals */}
                                    <View style={styles.mealHeader}>
                                        <Text style={styles.mealTitle}>{meal.title}</Text>
                                        <Text style={styles.mealCal}>{meal.total}</Text>
                                    </View>

                                    <TouchableOpacity onPress={toggleMacrosDisplay}>
                                        <Text style={styles.macrosText}>
                                            {showMacrosAsPercent
                                                ? `Carbs ${meal.macros.carbs}% • Fat ${meal.macros.fat}% • Protein ${meal.macros.protein}%`
                                                : `Carbs ${meal.macros.carbs}g • Fat ${meal.macros.fat}g • Protein ${meal.macros.protein}g`}
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.dividerLine} />

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

                                    <TouchableOpacity style={styles.addBtn}>
                                        <Text style={styles.addBtnText}>ADD FOOD</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>Lunch</Text>
                                    <Text style={styles.mealCal}>0</Text>
                                </View>
                                <Text style={styles.macrosText}>Carbs 0g • Fat 0g • Protein 0g</Text>
                                <View style={styles.dividerLine} />
                                <TouchableOpacity style={styles.addBtn}>
                                    <Text style={styles.addBtnText}>ADD FOOD</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>Dinner</Text>
                                    <Text style={styles.mealCal}>0</Text>
                                </View>
                                <Text style={styles.macrosText}>Carbs 0g • Fat 0g • Protein 0g</Text>
                                <View style={styles.dividerLine} />
                                <TouchableOpacity style={styles.addBtn}>
                                    <Text style={styles.addBtnText}>ADD FOOD</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>Snacks</Text>
                                    <Text style={styles.mealCal}>0</Text>
                                </View>
                                <Text style={styles.macrosText}>Carbs 0g • Fat 0g • Protein 0g</Text>
                                <View style={styles.dividerLine} />
                                <TouchableOpacity style={styles.addBtn}>
                                    <Text style={styles.addBtnText}>ADD FOOD</Text>
                                </TouchableOpacity>
                            </View>

                            {/* 4) Exercise */}
                            <View style={styles.mealSection}>
                                <View style={styles.mealHeader}>
                                    <Text style={[styles.mealTitle, { fontSize: 18 }]}>Exercise</Text>
                                    <Text style={styles.mealCal}>{exercise}</Text>
                                </View>

                                {/* Divider line under heading */}
                                <View style={styles.dividerLine} />

                                {exerciseList.map((ex, i) => (
                                    <View key={i}>
                                        <View style={styles.logRow}>
                                            <View style={{ flexDirection: 'column' }}>
                                                <Text style={[styles.logItemText, { fontSize: 16 }]}>{ex.name}</Text>
                                                <Text style={styles.logItemDuration}>{ex.duration}</Text>
                                            </View>
                                            <Text style={styles.logCalText}>{ex.calories}</Text>
                                        </View>
                                        {/* Divider line under each entry */}
                                        {i < exerciseList.length - 1 && (
                                            <View style={styles.entryDividerLine} />
                                        )}
                                    </View>
                                ))}can

                                {/* Divider line before Add Exercise button */}
                                <View style={styles.dividerLine} />

                                <TouchableOpacity style={styles.addBtn}>
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
    scrollInner: {
        paddingBottom: 20,
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
        marginTop: -5,
        marginBottom: 5,
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
        backgroundColor: '#181818', // slightly darker background
        marginHorizontal: 0,
        borderRadius: 0,
        padding: 16,
        marginBottom: 12,
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
        backgroundColor: '#181818', // slightly darker background
        marginHorizontal: 0,
        borderRadius: 0,
        padding: 16,
        marginBottom: 12,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
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
        marginHorizontal: -16, // extend to the edges
    },
    entryDividerLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        marginTop: 6,
        marginBottom: 6,
        marginHorizontal: -16, // extend to the edges
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
        width: '80%',
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
        paddingHorizontal: 16,
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
});
