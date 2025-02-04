import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';

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
                {/* 
                  * 1) Header area 
                  * (We won’t add the day-bar code now. If you want the day-bar,
                  * that typically lives in this file, not in App.js, unless
                  * you want it across all screens.)
                  */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Diary</Text>
                    <Text style={styles.headerSub}>Today</Text>
                </View>

                {/* 2) Calories Remaining */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Calories Remaining</Text>
                    <View style={styles.equationRow}>
                        <Text style={[styles.equationValue, { color: '#FFB74D' }]}>
                            {goal}
                        </Text>
                        <Text style={styles.equationSign}>-</Text>
                        <Text style={[styles.equationValue, { color: '#FF8A65' }]}>
                            {food}
                        </Text>
                        <Text style={styles.equationSign}>+</Text>
                        <Text style={[styles.equationValue, { color: '#66BB6A' }]}>
                            {exercise}
                        </Text>
                        <Text style={styles.equationSign}>=</Text>
                        <Text style={styles.equationResult}>{remaining}</Text>
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
                            <Text style={styles.addBtnText}>ADD FOOD</Text>
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
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    equationValue: {
        fontSize: 16,
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
        fontSize: 18,
        fontWeight: '700',
        marginRight: 6,
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
});
