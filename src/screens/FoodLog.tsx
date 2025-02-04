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
                {/* Top Title / Date */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Diary</Text>
                    <Text style={styles.headerSub}>Today</Text>
                </View>

                {/* Calories Remaining summary */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Calories Remaining</Text>
                    <View style={styles.equationRow}>
                        <Text style={styles.equationValue}>{goal}</Text>
                        <Text style={styles.equationSign}>-</Text>
                        <Text style={styles.equationValue}>{food}</Text>
                        <Text style={styles.equationSign}>+</Text>
                        <Text style={styles.equationValue}>{exercise}</Text>
                        <Text style={styles.equationSign}>=</Text>
                        <Text style={styles.equationResult}>{remaining}</Text>
                    </View>
                </View>

                {/* Meals */}
                {meals.map((meal, idx) => (
                    <View key={idx} style={styles.mealSection}>
                        <View style={styles.mealHeader}>
                            <Text style={styles.mealTitle}>{meal.title}</Text>
                            <Text style={styles.mealCal}>{meal.total}</Text>
                        </View>
                        <Text style={styles.macrosText}>
                            Carbs {meal.macros.carbs}% • Fat {meal.macros.fat}% • Protein {meal.macros.protein}%
                        </Text>

                        {meal.items.map((item, i) => (
                            <View key={i} style={styles.logRow}>
                                <Text style={styles.logItemText}>{item.name}</Text>
                                <Text style={styles.logCalText}>{item.calories}</Text>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addBtn}>
                            <Text style={styles.addBtnText}>ADD FOOD</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Exercise */}
                <View style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                        <Text style={styles.mealTitle}>Exercise</Text>
                        <Text style={styles.mealCal}>{exercise}</Text>
                    </View>
                    {exerciseList.map((ex, i) => (
                        <View key={i} style={styles.logRow}>
                            <Text style={styles.logItemText}>{ex.name}</Text>
                            <Text style={styles.logCalText}>{ex.calories}</Text>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>ADD EXERCISE</Text>
                    </TouchableOpacity>
                </View>

                {/* Water */}
                <View style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                        <Text style={styles.mealTitle}>Water</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>ADD WATER</Text>
                    </TouchableOpacity>
                </View>

                {/* Bottom action row */}
                <View style={styles.bottomActions}>
                    <TouchableOpacity style={[styles.tabBtn, { flex: 1 }]}>
                        <Text style={styles.tabBtnText}>Nutrition</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.completeBtn, { flex: 1 }]}>
                        <Text style={styles.completeBtnText}>Complete Diary</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DiaryScreen;

/** COLOR PALETTE from your PlateMate theme */
const PRIMARY_BG = '#000000';     // or #1A1A1A — choose whichever dark shade suits best
const CARD_BG = '#1C1C1E';     // slightly lighter dark for cards
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';  // main accent (like your plate/circle in image 2)

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
    summaryCard: {
        backgroundColor: CARD_BG,
        marginHorizontal: 16,
        borderRadius: 8,
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
        color: WHITE,
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
    mealSection: {
        backgroundColor: CARD_BG,
        marginHorizontal: 16,
        borderRadius: 8,
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
    logRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 6,
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
    bottomActions: {
        flexDirection: 'row',
        marginTop: 8,
        paddingHorizontal: 16,
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
    completeBtn: {
        flex: 1,
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    completeBtnText: {
        color: WHITE,
        fontWeight: '700',
        fontSize: 14,
    },
});
