import React, { useState } from 'react';
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

const GradientText = ({ text, colors, style }) => {
    return (
        <MaskedView
            maskElement={
                <Text style={style}>
                    {text}
                </Text>
            }
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
            />
        </MaskedView>
    );
};

const NutrientsScreen: React.FC = () => {
    const navigation = useNavigation();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Calculate the remaining amount for each nutrient
    const calculateRemaining = (current: number, goal: number) => {
        return goal - current;
    };

    // Get colors based on nutrient type
    const getNutrientColors = (label: string): [string, string] => {
        const lowerLabel = label.toLowerCase();

        if (lowerLabel.includes('vitamin') || lowerLabel.includes('calcium') || lowerLabel.includes('iron')) {
            return ['#4CAF50', '#8BC34A']; // Green gradient for vitamins and minerals
        } else if (lowerLabel.includes('fat')) {
            return ['#FF9800', '#FFC107']; // Orange gradient for fats
        } else if (lowerLabel.includes('protein')) {
            return ['#F44336', '#FF5722']; // Red gradient for protein
        } else if (lowerLabel.includes('carb') || lowerLabel.includes('sugar') || lowerLabel.includes('fiber')) {
            return ['#2196F3', '#03A9F4']; // Blue gradient for carbs
        } else {
            return ['#9C27B0', '#673AB7']; // Purple gradient for others
        }
    };

    // Format date display
    const formatDate = (date: Date): string => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        // Remove time for comparison
        const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const t = stripTime(today);
        const d = stripTime(date);
        const diff = d.getTime() - t.getTime();

        if (diff === 0) return "Today";
        if (diff === -86400000) return "Yesterday";
        if (diff === 86400000) return "Tomorrow";

        // Fallback: e.g., Sunday, Feb 02
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: '2-digit' };
        return date.toLocaleDateString(undefined, options);
    };

    const gotoPrevDay = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() - 1);
            return newDate;
        });
    };

    const gotoNextDay = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + 1);
            return newDate;
        });
    };

    const renderNutrientItem = (label: string, current: number, goal: number, unit: string) => {
        const remaining = calculateRemaining(current, goal);
        const progressPercent = Math.min((current / goal) * 100, 100);
        const gradientColors = getNutrientColors(label);

        return (
            <View key={label} style={styles.nutrientRow}>
                <Text style={styles.nutrientLabel}>{label}</Text>
                <View style={styles.nutrientValues}>
                    <Text style={styles.currentValue}>{current}</Text>
                    <Text style={styles.goalValue}>{goal}</Text>
                    <Text style={styles.remainingValue}>{remaining}{unit}</Text>
                </View>
                <View style={styles.progressBarContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBar, { width: `${progressPercent}%` }]}
                    />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <GradientText
                    text="NUTRIENTS"
                    colors={["#5A60EA", "#FF00F5"]}
                    style={styles.headerTitle}
                />
                <View style={{ width: 28 }} />
            </View>

            {/* Day Navigation */}
            <View style={styles.dayNavContainer}>
                <TouchableOpacity style={styles.dayNavButton} onPress={gotoPrevDay}>
                    <Ionicons name="chevron-back" size={20} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.todayText}>{formatDate(currentDate)}</Text>
                <TouchableOpacity style={styles.dayNavButton} onPress={gotoNextDay}>
                    <Ionicons name="chevron-forward" size={20} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* Nutrients Card */}
            <LinearGradient
                colors={["#00A8FF", "#AA00FF", "#FF00F5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBorder}
            >
                <View style={styles.nutrientsCardContainer}>
                    {/* Column Headers */}
                    <View style={styles.columnHeaders}>
                        <Text style={styles.columnHeader}>Total</Text>
                        <Text style={styles.columnHeader}>Goal</Text>
                        <Text style={styles.columnHeader}>Left</Text>
                    </View>

                    {/* Nutrients List */}
                    <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                    >
                        {Object.entries(macroGoals).map(([key, value]) => {
                            // Convert key from camelCase to Title Case for display
                            const label = key.replace(/([A-Z])/g, ' $1')
                                .replace(/^./, str => str.toUpperCase());

                            return renderNutrientItem(label, value.current, value.goal, value.unit);
                        })}

                        <View style={styles.spacer} />
                    </ScrollView>
                </View>
            </LinearGradient>
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
    headerTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: WHITE,
    },
    dayNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingVertical: 10,
        backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
        borderRadius: 10,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
    },
    dayNavButton: {
        padding: 10,
    },
    todayText: {
        fontSize: 20,
        color: WHITE,
        textAlign: 'center',
        fontWeight: '600',
    },
    nutrientsCardContainer: {
        flex: 1,
        borderRadius: 10,
        overflow: 'hidden',
        margin: 2,
        backgroundColor: CARD_BG,
    },
    scrollView: {
        flex: 1,
        backgroundColor: CARD_BG,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    },
    columnHeaders: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: CARD_BG,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    columnHeader: {
        flex: 1,
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
        fontWeight: '600',
    },
    nutrientRow: {
        flexDirection: 'column',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    nutrientLabel: {
        fontSize: 15,
        color: WHITE,
        marginBottom: 6,
        fontWeight: '500',
    },
    nutrientValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    currentValue: {
        flex: 1,
        fontSize: 15,
        color: WHITE,
        textAlign: 'center',
    },
    goalValue: {
        flex: 1,
        fontSize: 15,
        color: SUBDUED,
        textAlign: 'center',
    },
    remainingValue: {
        flex: 1,
        fontSize: 15,
        color: SUBDUED,
        textAlign: 'center',
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
    spacer: {
        height: 20,
    },
    gradientBorder: {
        flex: 1,
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
});

export default NutrientsScreen;
