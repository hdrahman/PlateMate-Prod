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
    const [activeTab, setActiveTab] = useState('NUTRIENTS');

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

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {['OVERVIEW', 'CALORIES', 'NUTRIENTS', 'MACROS'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === tab ? styles.activeTabText : null
                            ]}
                        >
                            {tab}
                        </Text>
                        {activeTab === tab && (
                            <LinearGradient
                                colors={["#5A60EA", "#FF00F5"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.activeTabIndicator}
                            />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Day Navigation */}
            <View style={styles.dayNavContainer}>
                <TouchableOpacity style={styles.dayNavButton}>
                    <Ionicons name="chevron-back" size={20} color={WHITE} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.dayViewText}>Day View</Text>
                    <Text style={styles.todayText}>Today</Text>
                </View>
                <TouchableOpacity style={styles.dayNavButton}>
                    <Ionicons name="chevron-forward" size={20} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* Column Headers */}
            <View style={styles.columnHeaders}>
                <Text style={[styles.columnHeader, { flex: 2 }]}>Total</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Goal</Text>
                <Text style={[styles.columnHeader, { flex: 1 }]}>Left</Text>
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

            {/* Navigation Bar */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navButton}>
                    <Ionicons name="chevron-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navButton}>
                    <Ionicons name="square-outline" size={24} color={WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navButton}>
                    <Ionicons name="apps" size={24} color={WHITE} />
                </TouchableOpacity>
            </View>
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
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    activeTab: {},
    activeTabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 10,
        right: 10,
        height: 3,
        borderRadius: 1.5,
    },
    tabText: {
        fontSize: 14,
        color: SUBDUED,
        fontWeight: '500',
    },
    activeTabText: {
        color: WHITE,
        fontWeight: 'bold',
    },
    dayNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingVertical: 8,
        backgroundColor: 'hsla(0, 0%, 100%, 0.07)',
        borderRadius: 6,
        marginHorizontal: 10,
    },
    dayNavButton: {
        padding: 10,
    },
    dayViewText: {
        fontSize: 14,
        color: SUBDUED,
        textAlign: 'center',
    },
    todayText: {
        fontSize: 18,
        color: WHITE,
        textAlign: 'center',
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: CARD_BG,
        marginTop: 14,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginHorizontal: 10,
    },
    columnHeader: {
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
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
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    nutrientLabel: {
        fontSize: 16,
        color: WHITE,
        marginBottom: 8,
        fontWeight: '500',
    },
    nutrientValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    currentValue: {
        flex: 2,
        fontSize: 16,
        color: WHITE,
        textAlign: 'center',
    },
    goalValue: {
        flex: 1,
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
    },
    remainingValue: {
        flex: 1,
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
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
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        backgroundColor: CARD_BG,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    navButton: {
        padding: 8,
    },
    spacer: {
        height: 20,
    },
});

export default NutrientsScreen;
