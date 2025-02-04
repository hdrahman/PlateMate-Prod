import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

const mockDiaryData = {
    goal: 1800,
    food: 1637,
    exercise: 450,
    meals: [
        {
            title: 'Breakfast',
            total: 600,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 14.0g', calories: 210 },
                { name: 'Quick Add\nProtein 33.0g', calories: 390 },
            ],
        },
        {
            title: 'Lunch',
            total: 1037,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 50.0g', calories: 900 },
            ],
        },
        {
            title: 'Snacks',
            total: 300,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 10.0g', calories: 150 },
                { name: 'Quick Add\nProtein 10.0g', calories: 150 },
            ],
        },
        {
            title: 'Dinner',
            total: 500,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 25.0g', calories: 250 },
                { name: 'Quick Add\nProtein 25.0g', calories: 250 },
            ],
        },
    ],
    exerciseList: [
        { name: 'Cardio (60 minutes)', calories: 600 },
        { name: 'Walk (30 minutes)', calories: 450 },
    ],
    water: true,
};

const DiaryScreen: React.FC = () => {
    const { goal, food, exercise, meals, exerciseList } = mockDiaryData;
    const remaining = goal - food + exercise;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollInner}>
                <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={styles.headerTitle}>Diary</Text>
                    <View style={styles.headerRight}>
                        <Text style={styles.streakNumber}>7</Text>
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
                        <TouchableOpacity onPress={() => console.log('Open Nutrients')} style={styles.iconButton}>
                            <Ionicons name="pie-chart-outline" size={22} color="#CCC" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Day Bar */}
                <View style={[styles.dayNavCard, { marginHorizontal: -8, borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.3)' }]}>
                    <TouchableOpacity style={[styles.arrowButton, { marginLeft: 4 }]}>
                        <Ionicons name="chevron-back" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={[styles.headerSub, { fontSize: 14 }]}>Today</Text>
                    <TouchableOpacity style={[styles.arrowButton, { marginRight: 4 }]}>
                        <Ionicons name="chevron-forward" size={16} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Add space between the "Today" card and the card below it */}
                <View style={{ height: 10 }} />

                {/* 2) Calories Remaining */}
                <View style={styles.summaryCard}>
                    <Text style={[styles.summaryTitle, { fontSize: 14 }]}>Calories Remaining</Text>
                    <View style={styles.equationRow}>
                        <View style={styles.equationColumn}>
                            <Text style={[styles.equationValue, { color: '#FFB74D', fontSize: 20 }]}>
                                {goal}
                            </Text>
                            <Text style={styles.equationLabel}>Base</Text>
                        </View>
                        <Text style={[styles.equationSign, { marginTop: 10 }]}>-</Text>
                        <View style={styles.equationColumn}>
                            <Text style={[styles.equationValue, { color: '#FF8A65', fontSize: 20 }]}>
                                {food}
                            </Text>
                            <Text style={styles.equationLabel}>Food</Text>
                        </View>
                        <Text style={[styles.equationSign, { marginTop: 10 }]}>+</Text>
                        <View style={styles.equationColumn}>
                            <Text style={[styles.equationValue, { color: '#66BB6A', fontSize: 20 }]}>
                                {exercise}
                            </Text>
                            <Text style={styles.equationLabel}>Exercise</Text>
                        </View>
                        <Text style={[styles.equationSign, { marginTop: 10 }]}>=</Text>
                        <View style={styles.equationColumn}>
                            <Text style={[styles.equationResult, { fontSize: 22 }]}>{remaining}</Text>
                            <Text style={styles.equationLabel}>Remaining</Text>
                        </View>
                    </View>
                </View>

                {/* 3) Meals */}
                {meals.map((meal, idx) => (
                    <View key={idx} style={styles.mealSection}>
                        {/* Title row */}
                        <View style={styles.mealHeader}>
                            <Text style={styles.mealTitle}>{meal.title}</Text>
                            <Text style={styles.mealCal}>{meal.total}</Text>
                        </View>

                        {/* Macros */}
                        <Text style={styles.macrosText}>
                            Carbs {meal.macros.carbs}% • Fat {meal.macros.fat}% • Protein {meal.macros.protein}%
                        </Text>

                        {/* Divider line under macros */}
                        <View style={styles.dividerLine} />

                        {/* Entries */}
                        {meal.items.map((item, i) => (
                            <View key={i}>
                                <View style={styles.logRow}>
                                    <Text style={styles.logItemText}>{item.name}</Text>
                                    <Text style={styles.logCalText}>{item.calories}</Text>
                                </View>

                                {/* Divider line under each entry */}
                                {i < meal.items.length - 1 && (
                                    <View style={styles.entryDividerLine} />
                                )}
                            </View>
                        ))}

                        {/* Divider line before Add Food button */}
                        <View style={styles.dividerLine} />

                        <TouchableOpacity style={styles.addBtn}>
                            <LinearGradient
                                colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.addBtnGradient}
                            >
                                <Text style={styles.addBtnText}>ADD FOOD</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* 4) Exercise */}
                <View style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                        <Text style={styles.mealTitle}>Exercise</Text>
                        <Text style={styles.mealCal}>{mockDiaryData.exercise}</Text>
                    </View>

                    {/* Divider line under heading */}
                    <View style={styles.dividerLine} />

                    {exerciseList.map((ex, i) => (
                        <View key={i}>
                            <View style={styles.logRow}>
                                <Text style={styles.logItemText}>{ex.name}</Text>
                                <Text style={styles.logCalText}>{ex.calories}</Text>
                            </View>
                            {/* Divider line under each entry */}
                            {i < exerciseList.length - 1 && (
                                <View style={styles.entryDividerLine} />
                            )}
                        </View>
                    ))}

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

                {/* 6) Bottom action row */}
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
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
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
        paddingVertical: 5, // Move the header slightly up
        paddingHorizontal: 16,
        backgroundColor: PRIMARY_BG,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 26,
        color: PURPLE_ACCENT,
        fontWeight: '700',
        textAlign: 'left', // Left align the title
        flex: 1,
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
        backgroundColor: 'hsla(0, 0%, 100%, 0.06)',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginTop: 8,
        marginHorizontal: -8, // Reduced margins
        borderWidth: 0.5, // Thinner border
        borderColor: 'rgba(255, 255, 255, 0.3)', // Less noticeable color
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
        fontSize: 14, // Slightly smaller font size
        color: WHITE,
        fontWeight: '600',
        marginBottom: 8,
    },
    equationRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between', // Spread the items
    },
    equationColumn: {
        alignItems: 'center',
    },
    equationValue: {
        fontSize: 20, // Bigger font size for numbers
        fontWeight: '500',
        marginRight: 6,
    },
    equationSign: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '300',
        marginRight: 6,
    },
    equationResult: {
        color: PURPLE_ACCENT,
        fontSize: 22, // Bigger font size for result
        fontWeight: '700',
        marginRight: 6,
    },
    equationLabel: {
        color: SUBDUED,
        fontSize: 12,
        marginTop: 4,
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
        overflow: 'hidden', // Ensure gradient doesn't overflow
    },
    addBtnGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    addBtnText: {
        color: WHITE,
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    streakNumber: {
        color: '#FFF',
        fontSize: 16,
        marginRight: 4,
    },
    iconButton: {
        marginLeft: 12,
    },
});
