import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getUserGoals, updateUserGoals, getUserProfileBySupabaseUid, getUserProfileByFirebaseUid } from '../utils/database';
import { calculateAndStoreBMR } from '../utils/nutritionCalculator';
import { ThemeContext } from '../ThemeContext';

const EditGoalsScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [isLoading, setIsLoading] = useState(true);

    const [goals, setGoals] = useState({
        targetWeight: '',
        calorieGoal: '',
        proteinGoal: '',
        carbGoal: '',
        fatGoal: '',
        stepGoal: '',
        waterGoal: '',
        sleepGoal: '',
        weeklyWorkouts: '',
        fitnessGoal: 'maintain',
        activityLevel: 'moderate',
    });

    useEffect(() => {
        const loadGoals = async () => {
            if (!user) return;

            try {
                setIsLoading(true);
                const userGoals = await getUserGoals(user.id);
                const profile = await getUserProfileBySupabaseUid(user.id);

                if (userGoals || profile) {
                    setGoals({
                        targetWeight: (userGoals?.targetWeight || profile?.target_weight || '').toString(),
                        calorieGoal: (userGoals?.calorieGoal || profile?.daily_calorie_target || '').toString(),
                        proteinGoal: (userGoals?.proteinGoal || profile?.protein_goal || '').toString(),
                        carbGoal: (userGoals?.carbGoal || profile?.carb_goal || '').toString(),
                        fatGoal: (userGoals?.fatGoal || profile?.fat_goal || '').toString(),
                        stepGoal: (userGoals?.stepGoal || profile?.step_goal || '').toString(),
                        waterGoal: (userGoals?.waterGoal || profile?.water_goal || '').toString(),
                        sleepGoal: (userGoals?.sleepGoal || profile?.sleep_goal || '').toString(),
                        weeklyWorkouts: (userGoals?.weeklyWorkouts || profile?.weekly_workouts || '').toString(),
                        fitnessGoal: userGoals?.fitnessGoal || profile?.fitness_goal || 'maintain',
                        activityLevel: userGoals?.activityLevel || profile?.activity_level || 'moderate',
                    });
                }
            } catch (error) {
                console.error('Error loading goals:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadGoals();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;

        try {
            setIsLoading(true);

            const goalsToSave = {
                targetWeight: goals.targetWeight ? parseFloat(goals.targetWeight) : undefined,
                calorieGoal: goals.calorieGoal ? parseInt(goals.calorieGoal) : undefined,
                proteinGoal: goals.proteinGoal ? parseInt(goals.proteinGoal) : undefined,
                carbGoal: goals.carbGoal ? parseInt(goals.carbGoal) : undefined,
                fatGoal: goals.fatGoal ? parseInt(goals.fatGoal) : undefined,
                stepGoal: goals.stepGoal ? parseInt(goals.stepGoal) : undefined,
                waterGoal: goals.waterGoal ? parseInt(goals.waterGoal) : undefined,
                sleepGoal: goals.sleepGoal ? parseInt(goals.sleepGoal) : undefined,
                weeklyWorkouts: goals.weeklyWorkouts ? parseInt(goals.weeklyWorkouts) : undefined,
                fitnessGoal: goals.fitnessGoal,
                activityLevel: goals.activityLevel,
            };

            await updateUserGoals(user.id, goalsToSave);

            // Recalculate BMR if activity level changed (affects TDEE and daily targets)
            if (goals.activityLevel) {
                try {
                    console.log('🔄 Recalculating BMR after activity level change...');
                    const fullProfile = await getUserProfileByFirebaseUid(user.uid);

                    if (fullProfile && fullProfile.height && fullProfile.weight && fullProfile.age &&
                        fullProfile.gender && goals.activityLevel) {

                        const profileForBMR = {
                            ...fullProfile,
                            activityLevel: goals.activityLevel,
                            // Use new fitness goal if it was updated
                            weightGoal: goals.fitnessGoal || fullProfile.weight_goal || fullProfile.fitness_goal
                        };

                        await calculateAndStoreBMR(profileForBMR, user.uid);
                        console.log('✅ BMR recalculated after activity level update');
                    } else {
                        console.log('ℹ️ Cannot recalculate BMR - missing required profile fields');
                    }
                } catch (bmrError) {
                    console.warn('⚠️ Failed to recalculate BMR after goals update:', bmrError);
                    // Don't fail the goals update if BMR calculation fails
                }
            }

            Alert.alert('Success', 'Your goals have been updated!');
            navigation.goBack();
        } catch (error) {
            console.error('Error saving goals:', error);
            Alert.alert('Error', 'Failed to save goals. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Goals</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Weight Goals */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Weight & Fitness</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Target Weight (kg)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.targetWeight}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, targetWeight: text }))}
                            placeholder="Enter target weight"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Weekly Workouts</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.weeklyWorkouts}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, weeklyWorkouts: text }))}
                            placeholder="Number of workouts per week"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                {/* Nutrition Goals */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Nutrition</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Daily Calories</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.calorieGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, calorieGoal: text }))}
                            placeholder="Daily calorie target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Protein (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.proteinGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, proteinGoal: text }))}
                            placeholder="Daily protein target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Carbs (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.carbGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, carbGoal: text }))}
                            placeholder="Daily carbs target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Fat (g)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.fatGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, fatGoal: text }))}
                            placeholder="Daily fat target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                {/* Lifestyle Goals */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lifestyle</Text>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Daily Steps</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.stepGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, stepGoal: text }))}
                            placeholder="Daily step target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Water (glasses)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.waterGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, waterGoal: text }))}
                            placeholder="Daily water target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Sleep (hours)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={goals.sleepGoal}
                            onChangeText={(text) => setGoals(prev => ({ ...prev, sleepGoal: text }))}
                            placeholder="Daily sleep target"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
    },
});

export default EditGoalsScreen;
