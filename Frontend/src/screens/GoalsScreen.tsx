import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { getUserGoals, getUserBMRData } from '../utils/database';
import { getProfile } from '../api/profileApi';
import { kgToLbs } from '../utils/unitConversion';

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
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isImperialUnits, setIsImperialUnits] = useState(false);
    
    // Add state for BMR and calorie data
    const [bmrData, setBmrData] = useState<{
        bmr: number | null;
        maintenanceCalories: number | null;
        dailyTarget: number | null;
    } | null>(null);

    // Initial goals state with empty/default values
    const [goals, setGoals] = useState({
        startingWeight: {
            value: 0,
            date: '---'
        },
        currentWeight: 0,
        goalWeight: null, // Set to null to indicate no value yet
        weeklyGoal: '---',
        activityLevel: '---',
        nutrition: {
            calories: 0,
            carbs: 0,
            fat: 0,
            protein: 0
        },
        fitness: {
            workoutsPerWeek: 0,
            minutesPerWorkout: 0
        },
        premium: {
            caloriesByMeal: false,
            macrosByMeal: false,
            adjustForExercise: false
        }
    });

    useEffect(() => {
        const fetchGoals = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                // Fetch user goals from local database
                const userGoals = await getUserGoals(user.id);

                // Try to get profile data for additional info
                let profileData = null;
                try {
                    profileData = await getProfile();
                    if (profileData && profileData.profile) {
                        setIsImperialUnits(profileData.profile.is_imperial_units || false);
                    }
                } catch (profileError) {
                    console.warn('Failed to fetch profile data:', profileError);
                }

                // Get target weight directly from the database
                const targetWeight = profileData?.profile?.target_weight ||
                    (profileData?.nutrition_goals?.target_weight) ||
                    userGoals?.targetWeight || null;

                // Get BMR data
                const userBMRData = await getUserBMRData(user.id);
                setBmrData(userBMRData);
                console.log('📊 BMR Data loaded:', userBMRData);

                // Update the goals state with fetched data
                setGoals(prevGoals => ({
                    ...prevGoals,
                    startingWeight: {
                        value: profileData?.profile?.starting_weight || 0,
                        date: profileData?.profile?.created_at ? new Date(profileData.profile.created_at).toLocaleDateString() : '---'
                    },
                    currentWeight: profileData?.profile?.weight || 0,
                    goalWeight: targetWeight, // Use the target weight from database
                    weeklyGoal: userGoals?.fitnessGoal === 'lose'
                        ? 'Lose weight'
                        : userGoals?.fitnessGoal === 'gain'
                            ? 'Gain weight'
                            : 'Maintain weight',
                    activityLevel: userGoals?.activityLevel || '---',
                    nutrition: {
                        calories: userGoals?.calorieGoal || 0,
                        carbs: userGoals?.carbGoal || 0,
                        fat: userGoals?.fatGoal || 0,
                        protein: userGoals?.proteinGoal || 0
                    },
                    fitness: {
                        workoutsPerWeek: userGoals?.weeklyWorkouts || 0,
                        minutesPerWorkout: 0 // Not tracked yet
                    }
                }));
            } catch (error) {
                console.error('Error fetching goals:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGoals();

        // Add focus listener to refresh data when returning to this screen
        const unsubscribe = navigation.addListener('focus', () => {
            fetchGoals();
        });

        // Clean up the listener when component unmounts
        return unsubscribe;
    }, [user, navigation]);

    // Format weight display with unit and handle empty values
    const formatWeight = (weight) => {
        if (weight === null || weight === undefined || weight === 0) {
            return "---";
        }

        if (isImperialUnits) {
            return `${Math.round(kgToLbs(weight))} lbs`;
        }

        return `${weight} kg`;
    };

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
                        <Text style={styles.goalValue}>
                            {goals.startingWeight.value ? formatWeight(goals.startingWeight.value) + ` on ${goals.startingWeight.date}` : "---"}
                        </Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Current Weight</Text>
                        <Text style={styles.goalValue}>{formatWeight(goals.currentWeight)}</Text>
                    </View>

                    <View style={styles.goalRow}>
                        <Text style={styles.goalLabel}>Goal Weight</Text>
                        <Text style={styles.goalValue}>{formatWeight(goals.goalWeight)}</Text>
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

                {/* BMR and Calorie Breakdown */}
                {bmrData && (
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Calorie Breakdown</Text>
                        
                        <View style={styles.goalRow}>
                            <Text style={styles.goalLabel}>BMR (Basal Metabolic Rate)</Text>
                            <Text style={styles.goalValue}>{bmrData.bmr || '---'} cal</Text>
                        </View>

                        <View style={styles.goalRow}>
                            <Text style={styles.goalLabel}>Maintenance Calories (TDEE)</Text>
                            <Text style={styles.goalValue}>{bmrData.maintenanceCalories || '---'} cal</Text>
                        </View>

                        <View style={styles.goalRow}>
                            <Text style={styles.goalLabel}>Daily Target</Text>
                            <Text style={styles.goalValue}>{bmrData.dailyTarget || '---'} cal</Text>
                        </View>

                        {bmrData.maintenanceCalories && bmrData.dailyTarget && (
                            <View style={styles.goalRow}>
                                <Text style={styles.goalLabel}>Goal Adjustment</Text>
                                <Text style={[
                                    styles.goalValue, 
                                    { color: bmrData.dailyTarget - bmrData.maintenanceCalories >= 0 ? '#4CAF50' : '#F44336' }
                                ]}>
                                    {bmrData.dailyTarget - bmrData.maintenanceCalories > 0 ? '+' : ''}
                                    {bmrData.dailyTarget - bmrData.maintenanceCalories} cal
                                </Text>
                            </View>
                        )}
                    </View>
                )}

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