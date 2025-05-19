import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Colors from ManualFoodEntry.tsx
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#2196F3';
const GOLD = '#FFD700';

const GoalsScreen = () => {
    const navigation = useNavigation<any>();

    // Mock data - in a real app, this would come from an API/database
    const [goals, setGoals] = useState({
        startingWeight: {
            value: 112,
            date: '28 Sept 2020'
        },
        currentWeight: 105,
        goalWeight: 85,
        weeklyGoal: 'Lose 1 kg per week',
        activityLevel: 'Not Very Active',
        nutrition: {
            calories: 1800,
            carbs: 225,
            fat: 60,
            protein: 90
        },
        fitness: {
            workoutsPerWeek: 0,
            minutesPerWorkout: 0
        },
        premium: {
            caloriesByMeal: true,
            macrosByMeal: true,
            adjustForExercise: true
        }
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Goals</Text>
                <TouchableOpacity style={styles.refreshButton}>
                    <Ionicons name="refresh" size={28} color={WHITE} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Weight Goals */}
                <View style={styles.section}>
                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Starting Weight</Text>
                        <Text style={styles.goalValue}>{goals.startingWeight.value} kg on {goals.startingWeight.date}</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Current Weight</Text>
                        <Text style={styles.goalValue}>{goals.currentWeight} kg</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Goal Weight</Text>
                        <Text style={styles.goalValue}>{goals.goalWeight} kg</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Weekly Goal</Text>
                        <Text style={styles.goalValue}>{goals.weeklyGoal}</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Activity Level</Text>
                        <Text style={styles.goalValue}>{goals.activityLevel}</Text>
                    </View>
                </View>

                {/* Nutrition Goals */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Nutrition Goals</Text>

                    <TouchableOpacity style={styles.goalCard}>
                        <View style={styles.goalCardContent}>
                            <Text style={styles.goalCardTitle}>Calorie, Carbs, Protein and Fat Goals</Text>
                            <Text style={styles.goalCardSubtitle}>Customize your default or daily goals.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.goalCard}>
                        <View style={styles.goalCardContent}>
                            <Text style={styles.goalCardTitle}>Calorie Goals by Meal</Text>
                            <Text style={styles.goalCardSubtitle}>Stay on track with a calorie goal for each meal.</Text>
                        </View>
                        <View style={styles.premiumBadge}>
                            <Ionicons name="star" size={20} color={GOLD} />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.goalCard}>
                        <View style={styles.goalCardContent}>
                            <Text style={styles.goalCardTitle}>Show Carbs, Protein and Fat By Meal</Text>
                            <Text style={styles.goalCardSubtitle}>View carbs, protein and fat by gram or percent.</Text>
                        </View>
                        <View style={styles.premiumBadge}>
                            <Ionicons name="star" size={20} color={GOLD} />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.goalCard}>
                        <View style={styles.goalCardContent}>
                            <Text style={styles.goalCardTitle}>Additional Nutrient Goals</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Fitness Goals */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Fitness Goals</Text>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Workouts / Week</Text>
                        <Text style={styles.goalValue}>{goals.fitness.workoutsPerWeek}</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Minutes / Workout</Text>
                        <Text style={styles.goalValue}>{goals.fitness.minutesPerWorkout}</Text>
                    </View>

                    <TouchableOpacity style={styles.goalCard}>
                        <View style={styles.goalCardContent}>
                            <Text style={styles.goalCardTitle}>Exercise Calories</Text>
                            <Text style={styles.goalCardSubtitle}>Decide whether to adjust daily goals when you exercise</Text>
                        </View>
                        <View style={styles.premiumBadge}>
                            <Ionicons name="star" size={20} color={GOLD} />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    refreshButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    section: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    sectionHeader: {
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    goalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    goalLabel: {
        color: WHITE,
        fontSize: 16,
    },
    goalValue: {
        color: BLUE_ACCENT,
        fontSize: 16,
    },
    goalCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    goalCardContent: {
        flex: 1,
    },
    goalCardTitle: {
        color: WHITE,
        fontSize: 16,
        marginBottom: 4,
    },
    goalCardSubtitle: {
        color: GRAY,
        fontSize: 14,
    },
    premiumBadge: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default GoalsScreen; 