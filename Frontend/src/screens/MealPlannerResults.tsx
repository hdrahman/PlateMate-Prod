import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';

type MealType = {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    ingredients: string[];
    imageUrl?: string;
};

export default function MealPlannerResults() {
    const navigation = useNavigation();
    const route = useRoute();
    const [loading, setLoading] = useState(true);
    const [mealPlan, setMealPlan] = useState<MealType[]>([]);

    // Mock data for demonstration - in a real app, this would come from API
    const mockMealPlan = [
        {
            name: "Spinach and Feta Omelette",
            calories: 320,
            protein: 22,
            carbs: 5,
            fats: 24,
            ingredients: ["Eggs", "Spinach", "Feta cheese", "Olive oil", "Salt", "Pepper"],
            imageUrl: "https://images.unsplash.com/photo-1612240498936-65f5101365d2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80"
        },
        {
            name: "Grilled Chicken Salad",
            calories: 450,
            protein: 35,
            carbs: 15,
            fats: 28,
            ingredients: ["Chicken breast", "Mixed greens", "Cherry tomatoes", "Cucumber", "Avocado", "Olive oil", "Lemon juice"],
            imageUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80"
        },
        {
            name: "Baked Salmon with Roasted Vegetables",
            calories: 520,
            protein: 40,
            carbs: 25,
            fats: 30,
            ingredients: ["Salmon fillet", "Broccoli", "Bell peppers", "Red onion", "Olive oil", "Garlic", "Lemon", "Herbs"],
            imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80"
        }
    ];

    useEffect(() => {
        // Simulate API call to generate meal plan based on image
        setTimeout(() => {
            setMealPlan(mockMealPlan);
            setLoading(false);
        }, 2000);
    }, []);

    const totalCalories = mealPlan.reduce((sum, meal) => sum + meal.calories, 0);
    const totalProtein = mealPlan.reduce((sum, meal) => sum + meal.protein, 0);
    const totalCarbs = mealPlan.reduce((sum, meal) => sum + meal.carbs, 0);
    const totalFats = mealPlan.reduce((sum, meal) => sum + meal.fats, 0);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.navigate('MealPlanner' as never)}
                >
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Meal Plan</Text>
                <View style={styles.placeholderButton} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Generating your personalized meal plan...</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView}>
                    <View style={styles.summaryContainer}>
                        <Text style={styles.summaryTitle}>Daily Nutrition Summary</Text>
                        <View style={styles.macrosContainer}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{totalCalories}</Text>
                                <Text style={styles.macroLabel}>Calories</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{totalProtein}g</Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{totalCarbs}g</Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{totalFats}g</Text>
                                <Text style={styles.macroLabel}>Fats</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.mealsTitle}>Your Meals</Text>

                    {mealPlan.map((meal, index) => (
                        <View key={index} style={styles.mealCard}>
                            {meal.imageUrl && (
                                <Image
                                    source={{ uri: meal.imageUrl }}
                                    style={styles.mealImage}
                                    resizeMode="cover"
                                />
                            )}
                            <View style={styles.mealInfo}>
                                <Text style={styles.mealName}>{meal.name}</Text>

                                <View style={styles.mealMacros}>
                                    <Text style={styles.mealMacro}>{meal.calories} cal</Text>
                                    <Text style={styles.mealMacro}>{meal.protein}g protein</Text>
                                    <Text style={styles.mealMacro}>{meal.carbs}g carbs</Text>
                                    <Text style={styles.mealMacro}>{meal.fats}g fats</Text>
                                </View>

                                <Text style={styles.ingredientsTitle}>Ingredients:</Text>
                                <Text style={styles.ingredients}>{meal.ingredients.join(", ")}</Text>

                                <TouchableOpacity style={styles.logButton}>
                                    <LinearGradient
                                        colors={['#5A60EA', '#FF00F5']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.logButtonGradient}
                                    >
                                        <Text style={styles.logButtonText}>Log This Meal</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <View style={styles.bottomPadding} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 8,
    },
    placeholderButton: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    summaryContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 15,
        padding: 15,
        margin: 15,
    },
    summaryTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        color: '#FF00F5',
        fontSize: 18,
        fontWeight: 'bold',
    },
    macroLabel: {
        color: '#999',
        fontSize: 14,
    },
    mealsTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 5,
    },
    mealCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 15,
        marginHorizontal: 15,
        marginVertical: 8,
        overflow: 'hidden',
    },
    mealImage: {
        width: '100%',
        height: 180,
    },
    mealInfo: {
        padding: 15,
    },
    mealName: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    mealMacros: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    mealMacro: {
        color: '#CCC',
        fontSize: 14,
        marginRight: 15,
        marginBottom: 5,
    },
    ingredientsTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    ingredients: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
    },
    logButton: {
        marginTop: 15,
        borderRadius: 10,
        overflow: 'hidden',
    },
    logButtonGradient: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        alignItems: 'center',
    },
    logButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    bottomPadding: {
        height: 30,
    },
}); 