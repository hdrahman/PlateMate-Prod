import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

const { width } = Dimensions.get('window');

// App theme colors
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';

// Define the nutrition data
const macroGoals = {
    protein: { current: 0, goal: 101, unit: 'g' },
    carbs: { current: 0, goal: 253, unit: 'g' },
    fiber: { current: 0, goal: 38, unit: 'g' },
    sugar: { current: 0, goal: 76, unit: 'g' },
    fat: { current: 0, goal: 67, unit: 'g' },
    saturatedFat: { current: 0, goal: 22, unit: 'g' },
    polyunsaturatedFat: { current: 0, goal: 0, unit: 'g' },
    monounsaturatedFat: { current: 0, goal: 0, unit: 'g' },
    transFat: { current: 0, goal: 0, unit: 'g' },
    cholesterol: { current: 0, goal: 300, unit: 'mg' },
    sodium: { current: 0, goal: 2300, unit: 'mg' },
    potassium: { current: 0, goal: 3500, unit: 'mg' },
    vitaminA: { current: 0, goal: 100, unit: '%' },
    vitaminC: { current: 0, goal: 100, unit: '%' },
    calcium: { current: 0, goal: 100, unit: '%' },
    iron: { current: 0, goal: 100, unit: '%' }
};

// Add a GradientText component for text with gradient
const GradientText = ({ text, style, colors }) => {
    return (
        <MaskedView
            maskElement={
                <Text style={[style, { opacity: 1 }]}>
                    {text}
                </Text>
            }
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text style={[style, { opacity: 0 }]}>
                    {text}
                </Text>
            </LinearGradient>
        </MaskedView>
    );
};

const NutrientsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [nutrientData, setNutrientData] = useState(macroGoals);

    // Add this to ensure consistent black background during transitions
    const containerStyle = {
        flex: 1,
        backgroundColor: PRIMARY_BG, // PRIMARY_BG is '#000000'
    };

    useEffect(() => {
        // Fetch nutrient data from the backend
        const fetchNutrientData = async () => {
            try {
                const response = await fetch('/api/meal-data');
                const data = await response.json();

                // Calculate the total for each nutrient
                const totals = {
                    protein: 0,
                    carbs: 0,
                    fiber: 0,
                    sugar: 0,
                    fat: 0,
                    saturatedFat: 0,
                    polyunsaturatedFat: 0,
                    monounsaturatedFat: 0,
                    transFat: 0,
                    cholesterol: 0,
                    sodium: 0,
                    potassium: 0,
                    vitaminA: 0,
                    vitaminC: 0,
                    calcium: 0,
                    iron: 0
                };

                data.forEach(entry => {
                    totals.protein += entry.proteins;
                    totals.carbs += entry.carbs;
                    totals.fiber += entry.fiber;
                    totals.sugar += entry.sugar;
                    totals.fat += entry.fats;
                    totals.saturatedFat += entry.saturated_fat;
                    totals.polyunsaturatedFat += entry.polyunsaturated_fat;
                    totals.monounsaturatedFat += entry.monounsaturated_fat;
                    totals.transFat += entry.trans_fat;
                    totals.cholesterol += entry.cholesterol;
                    totals.sodium += entry.sodium;
                    totals.potassium += entry.potassium;
                    totals.vitaminA += entry.vitamin_a;
                    totals.vitaminC += entry.vitamin_c;
                    totals.calcium += entry.calcium;
                    totals.iron += entry.iron;
                });

                // Update state with totals
                setNutrientData(prevData => {
                    const updatedData = { ...prevData };
                    Object.keys(totals).forEach(key => {
                        updatedData[key].current = totals[key];
                    });
                    return updatedData;
                });
            } catch (error) {
                console.error('Failed to fetch nutrient data:', error);
            }
        };

        fetchNutrientData();
    }, []);

    // Calculate the remaining amount for each nutrient
    const calculateRemaining = (current: number, goal: number) => {
        return goal - current;
    };

    // Get colors based on nutrient type
    const getNutrientColors = (label: string): readonly [string, string] => {
        const lowerLabel = label.toLowerCase();

        if (lowerLabel.includes('protein')) {
            return ['#B71C1C', '#D32F2F'] as const; // Dark red to slightly lighter red
        } else if (lowerLabel.includes('carbs')) {
            return ['#0D47A1', '#0D47A1'] as const; // Dark blue (no gradient)
        } else if (lowerLabel.includes('fiber')) {
            return ['#2E7D32', '#2E7D32'] as const; // Dark rich green (no gradient)
        } else if (lowerLabel.includes('sugar')) {
            return ['#4A148C', '#6A1B9A'] as const; // Dark purple to slightly lighter purple
        } else if (lowerLabel.includes('fat')) {
            return ['#F57F17', '#FFC107'] as const; // Dark amber to lighter amber
        } else {
            return ['#4A148C', '#7B1FA2'] as const; // Default purple gradient
        }
    };

    const renderNutrientItem = (label: string, current: number, goal: number, unit: string) => {
        const remaining = calculateRemaining(current, goal);
        // Set all progress bars to 100% temporarily
        const progressPercent = 100;
        const gradientColors = getNutrientColors(label);

        return (
            <View key={label} style={styles.nutrientRow}>
                <View style={styles.nutrientValues}>
                    <View style={styles.leftValues}>
                        <Text style={styles.remainingValue}>{remaining}{unit}</Text>
                    </View>
                    <Text style={styles.nutrientLabel}>{label}</Text>
                    <Text style={styles.rightValue}>{current}/{goal}</Text>
                </View>
                <View style={styles.progressBarContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        locations={[0, 0.6]}
                        style={[styles.progressBar, { width: `${progressPercent}%` }]}
                    />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, containerStyle]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <GradientText
                        text="NUTRIENTS"
                        colors={["#5A60EA", "#FF00F5"]}
                        style={styles.headerTitle}
                    />
                </View>
                <View style={{ width: 28 }} />
            </View>

            {/* Day Navigation - Centered */}
            <View style={styles.dayNavContainer}>
                <TouchableOpacity style={styles.dayNavButton}>
                    <Ionicons name="chevron-back" size={20} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.todayText}>Today</Text>
                <TouchableOpacity style={styles.dayNavButton}>
                    <Ionicons name="chevron-forward" size={20} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* Column Headers */}
            <View style={styles.columnHeadersContainer}>
                <View style={styles.columnHeaders}>
                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'left' }]}>Remaining</Text>
                    <View style={{ flex: 2 }} />
                    <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Total/Goal</Text>
                </View>
                <View style={styles.headerDivider} />
            </View>

            {/* Nutrients List */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {Object.entries(nutrientData).map(([key, value]) => {
                    // Convert key from camelCase to Title Case for display
                    const label = key.replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase());

                    return renderNutrientItem(label, value.current, value.goal, value.unit);
                })}

                <View style={styles.spacer} />
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
        paddingVertical: 10,
    },
    backButton: {
        padding: 4,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: WHITE,
        textAlign: 'center',
    },
    dayNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingVertical: 4,
        backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
        borderRadius: 6,
        marginHorizontal: 10,
        marginTop: 5,
    },
    dayNavButton: {
        padding: 8,
    },
    todayText: {
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
    },
    columnHeadersContainer: {
        marginTop: 14,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerDivider: {
        height: 1,
        backgroundColor: '#333',
        marginHorizontal: 16,
    },
    columnHeader: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        marginHorizontal: 10,
        backgroundColor: CARD_BG,
    },
    nutrientRow: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    nutrientLabel: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '500',
        flex: 2,
        textAlign: 'center',
    },
    nutrientValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    leftValues: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    rightValue: {
        flex: 1,
        fontSize: 16,
        color: WHITE,
        textAlign: 'right',
    },
    remainingValue: {
        fontSize: 16,
        color: '#BBBBBB', // Lighter gray for remaining values
        textAlign: 'left',
    },
    progressBarContainer: {
        height: 5,
        backgroundColor: '#333',
        borderRadius: 2.5,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2.5,
    },
    spacer: {
        height: 20,
    },
});

export default NutrientsScreen;
