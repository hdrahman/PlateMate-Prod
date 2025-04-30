import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Image, ViewStyle, TextStyle, ActivityIndicator, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

type MealType = {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    ingredients: string[];
    imageUrl?: string;
};

// Define types for the component props
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

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

    // GradientBorderCard component for consistent card styling
    const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
        return (
            <View style={styles.gradientBorderContainer}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        borderRadius: 10,
                    }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
                <View
                    style={{
                        margin: 1,
                        borderRadius: 9,
                        backgroundColor: CARD_BG,
                        padding: 16,
                        ...(style || {})
                    }}
                >
                    {children}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.navigate('MealPlanner' as never)}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Meal Plan</Text>
                <View style={styles.placeholderButton} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PURPLE_ACCENT} />
                    <Text style={styles.loadingText}>Generating your personalized meal plan...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollInner}
                >
                    <GradientBorderCard>
                        <Text style={styles.summaryTitle}>Daily Nutrition Summary</Text>
                        <View style={styles.dividerLine} />
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
                    </GradientBorderCard>

                    <Text style={styles.mealsTitle}>Your Meals</Text>

                    {mealPlan.map((meal, index) => (
                        <GradientBorderCard key={index}>
                            {meal.imageUrl && (
                                <Image
                                    source={{ uri: meal.imageUrl }}
                                    style={styles.mealImage}
                                    resizeMode="cover"
                                />
                            )}
                            <View style={styles.mealInfo}>
                                <Text style={styles.mealName}>{meal.name}</Text>

                                <View style={styles.dividerLine} />

                                <View style={styles.mealMacros}>
                                    <Text style={styles.mealMacro}>{meal.calories} cal</Text>
                                    <Text style={styles.mealMacro}>{meal.protein}g protein</Text>
                                    <Text style={styles.mealMacro}>{meal.carbs}g carbs</Text>
                                    <Text style={styles.mealMacro}>{meal.fats}g fats</Text>
                                </View>

                                <Text style={styles.ingredientsTitle}>Ingredients:</Text>
                                <Text style={styles.ingredients}>{meal.ingredients.join(", ")}</Text>

                                <TouchableOpacity style={styles.logButton}>
                                    <Text style={styles.logButtonText}>Log This Meal</Text>
                                </TouchableOpacity>
                            </View>
                        </GradientBorderCard>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// Create a type for our styles
type StylesType = {
    container: ViewStyle;
    header: ViewStyle;
    headerTitle: TextStyle;
    backButton: ViewStyle;
    placeholderButton: ViewStyle;
    loadingContainer: ViewStyle;
    loadingText: TextStyle;
    scrollView: ViewStyle;
    scrollInner: ViewStyle;
    gradientBorderContainer: ViewStyle;
    summaryTitle: TextStyle;
    dividerLine: ViewStyle;
    macrosContainer: ViewStyle;
    macroItem: ViewStyle;
    macroValue: TextStyle;
    macroLabel: TextStyle;
    mealsTitle: TextStyle;
    mealImage: ImageStyle;
    mealInfo: ViewStyle;
    mealName: TextStyle;
    mealMacros: ViewStyle;
    mealMacro: TextStyle;
    ingredientsTitle: TextStyle;
    ingredients: TextStyle;
    logButton: ViewStyle;
    logButtonText: TextStyle;
};

const styles = StyleSheet.create<StylesType>({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    headerTitle: {
        color: PURPLE_ACCENT,
        fontSize: 22,
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
        color: WHITE,
        fontSize: 18,
        textAlign: 'center',
        marginTop: 15,
    },
    scrollView: {
        flex: 1,
    },
    scrollInner: {
        paddingHorizontal: 10,
        paddingBottom: 40,
        width: '100%',
        alignItems: 'center',
    },
    // Gradient border components
    gradientBorderContainer: {
        marginBottom: 12,
        borderRadius: 10,
        width: '100%',
        overflow: 'hidden',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 6,
    },
    // Dividers
    dividerLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        marginVertical: 8,
        marginHorizontal: -20,
        width: '120%',
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 5,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        color: PURPLE_ACCENT,
        fontSize: 22,
        fontWeight: 'bold',
    },
    macroLabel: {
        color: SUBDUED,
        fontSize: 14,
        marginTop: 4,
    },
    mealsTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginLeft: 5,
        marginTop: 5,
        marginBottom: 5,
    },
    mealImage: {
        width: '100%',
        height: 180,
        borderTopLeftRadius: 9,
        borderTopRightRadius: 9,
        marginBottom: 10,
        marginTop: -16, // To counter the padding of the parent
        marginHorizontal: -16, // To counter the padding of the parent
    },
    mealInfo: {
        padding: 5,
    },
    mealName: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    mealMacros: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        justifyContent: 'space-around',
    },
    mealMacro: {
        color: SUBDUED,
        fontSize: 14,
        marginRight: 8,
        marginBottom: 4,
    },
    ingredientsTitle: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    ingredients: {
        color: SUBDUED,
        fontSize: 14,
        lineHeight: 20,
    },
    logButton: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 15,
        transform: [{ translateY: -2 }],
        shadowColor: PURPLE_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 5,
    },
    logButtonText: {
        color: WHITE,
        fontWeight: '700',
        fontSize: 16,
    },
}); 