import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';

/**
 * Example data that might be pulled in from your store / API / context
 */
const mockDiaryData = {
    goalCalories: 1800,
    foodCalories: 1637,
    exerciseCalories: 450,
    remainingCalories: 613,
    meals: [
        {
            title: 'Breakfast',
            totalCals: 600,
            macros: {
                carbs: 0,
                fats: 0,
                protein: 100,
            },
            items: [
                { name: 'Quick Add Protein 14.0g', calories: 210 },
                { name: 'Quick Add Protein 33.0g', calories: 390 },
            ],
        },
        {
            title: 'Lunch',
            totalCals: 1037,
            macros: {
                carbs: 0,
                fats: 0,
                protein: 100,
            },
            items: [
                { name: 'Quick Add Protein 50.0g', calories: 900 },
            ],
        },
    ],
    exercise: [
        {
            name: 'Cardio (60 minutes)',
            calories: 600,
        },
        {
            name: 'Walk (30 minutes)',
            calories: 450,
        },
    ],
};

const DiaryScreen: React.FC = () => {
    const {
        goalCalories,
        foodCalories,
        exerciseCalories,
        remainingCalories,
        meals,
    } = mockDiaryData;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header / Title */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>Diary</Text>
                    <Text style={styles.headerDate}>Today</Text>
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Calories Remaining</Text>
                    <View style={styles.calorieRow}>
                        <Text style={styles.calorieLabel}>Goal</Text>
                        <Text style={styles.calorieValue}>{goalCalories}</Text>
                    </View>
                    <View style={styles.calorieRow}>
                        <Text style={styles.calorieLabel}>Food</Text>
                        <Text style={styles.calorieValue}>{foodCalories}</Text>
                    </View>
                    <View style={styles.calorieRow}>
                        <Text style={styles.calorieLabel}>Exercise</Text>
                        <Text style={styles.calorieValue}>+ {exerciseCalories}</Text>
                    </View>
                    <View style={styles.dividerLine} />
                    <View style={styles.calorieRow}>
                        <Text style={styles.calorieLabel}>Remaining</Text>
                        <Text style={styles.remainingVal}>{remainingCalories}</Text>
                    </View>
                </View>

                {/* Meals */}
                {meals.map((meal, index) => (
                    <View key={index} style={styles.mealContainer}>
                        <View style={styles.mealHeader}>
                            <Text style={styles.mealTitle}>{meal.title}</Text>
                            <Text style={styles.mealCals}>{meal.totalCals}</Text>
                        </View>
                        <Text style={styles.macrosText}>
                            Carbs {meal.macros.carbs}% • Fat {meal.macros.fats}% • Protein {meal.macros.protein}%
                        </Text>
                        {meal.items.map((item, i) => (
                            <View key={i} style={styles.itemRow}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemCals}>{item.calories}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addFoodBtn}>
                            <Text style={styles.addFoodBtnText}>ADD FOOD</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Exercise Section */}
                <View style={styles.exerciseContainer}>
                    <View style={styles.exerciseHeader}>
                        <Text style={styles.exerciseTitle}>Exercise</Text>
                        <Text style={styles.exerciseCals}>{exerciseCalories}</Text>
                    </View>
                    {mockDiaryData.exercise.map((ex, idx) => (
                        <View key={idx} style={styles.itemRow}>
                            <Text style={styles.itemName}>{ex.name}</Text>
                            <Text style={styles.itemCals}>{ex.calories}</Text>
                        </View>
                    ))}
                    <TouchableOpacity style={styles.addExerciseBtn}>
                        <Text style={styles.addExerciseBtnText}>ADD EXERCISE</Text>
                    </TouchableOpacity>
                </View>

                {/* Water, Complete Diary, or other actions */}
                <TouchableOpacity style={styles.completeDiaryBtn}>
                    <Text style={styles.completeDiaryBtnText}>Complete Diary</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DiaryScreen;

const PRIMARY_COLOR = '#AA00FF'; // A vibrant purple accent
const BACKGROUND_COLOR = '#1C1C1E'; // iOS dark mode background style
const CARD_COLOR = '#2C2C2E';
const TEXT_COLOR = '#FFFFFF';
const SUBTEXT_COLOR = '#BBBBBB';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
    },
    scrollContent: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    headerContainer: {
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        color: TEXT_COLOR,
        fontWeight: '700',
        marginBottom: 4,
    },
    headerDate: {
        fontSize: 18,
        color: SUBTEXT_COLOR,
    },
    summaryCard: {
        backgroundColor: CARD_COLOR,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: TEXT_COLOR,
        marginBottom: 8,
    },
    calorieRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    calorieLabel: {
        color: SUBTEXT_COLOR,
        fontSize: 16,
    },
    calorieValue: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '500',
    },
    dividerLine: {
        height: 1,
        backgroundColor: SUBTEXT_COLOR,
        marginVertical: 8,
        opacity: 0.3,
    },
    remainingVal: {
        color: PRIMARY_COLOR,
        fontSize: 18,
        fontWeight: '700',
    },
    mealContainer: {
        backgroundColor: CARD_COLOR,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    mealTitle: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: '600',
    },
    mealCals: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: '600',
    },
    macrosText: {
        color: SUBTEXT_COLOR,
        fontSize: 14,
        marginBottom: 8,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
    },
    itemName: {
        color: TEXT_COLOR,
        fontSize: 16,
    },
    itemCals: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '500',
    },
    addFoodBtn: {
        marginTop: 8,
        paddingVertical: 8,
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 8,
        alignItems: 'center',
    },
    addFoodBtnText: {
        color: TEXT_COLOR,
        fontWeight: '700',
        fontSize: 16,
    },
    exerciseContainer: {
        backgroundColor: CARD_COLOR,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    exerciseTitle: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: '600',
    },
    exerciseCals: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: '600',
    },
    addExerciseBtn: {
        marginTop: 8,
        paddingVertical: 8,
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 8,
        alignItems: 'center',
    },
    addExerciseBtnText: {
        color: TEXT_COLOR,
        fontWeight: '700',
        fontSize: 16,
    },
    completeDiaryBtn: {
        marginTop: 8,
        paddingVertical: 12,
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 8,
        alignItems: 'center',
    },
    completeDiaryBtnText: {
        color: TEXT_COLOR,
        fontWeight: '700',
        fontSize: 16,
    },
});
