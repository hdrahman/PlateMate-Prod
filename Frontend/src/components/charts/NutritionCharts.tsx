import React, { useContext } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { ProgressChart, PieChart } from 'react-native-chart-kit';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../ThemeContext';
import { Theme } from '../../styles/theme';

const { width } = Dimensions.get('window');

// Helper function to get theme-aware nutrition colors
const getNutritionColors = (theme: Theme) => ({
    CARBS: theme.colors.chartCarbs,
    PROTEIN: theme.colors.chartProtein,
    FAT: theme.colors.chartFat,
    FIBER: theme.colors.success,       // Green for fiber
    SUGAR: theme.colors.chartCalories, // Pink for sugar
    SODIUM: theme.colors.error,        // Red for sodium
    BACKGROUND: 'transparent',
});

interface NutritionData {
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
}

interface MacronutrientPieChartProps {
    data: NutritionData;
    showLegend?: boolean;
}

interface MacronutrientProgressProps {
    data: NutritionData;
    maxValues?: {
        carbs: number;
        proteins: number;
        fats: number;
    };
}

interface NutritionLegendProps {
    data: NutritionData;
}

/**
 * Macronutrient Pie Chart Component
 */
export const MacronutrientPieChart: React.FC<MacronutrientPieChartProps> = ({
    data,
    showLegend = false
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const colors = getNutritionColors(theme);
    const { carbs, proteins, fats } = data;

    const chartData = [
        {
            name: 'Carbs',
            population: carbs * 4, // 4 cal per gram
            color: colors.CARBS,
            legendFontColor: theme.colors.textSecondary,
            legendFontSize: 12,
        },
        {
            name: 'Protein',
            population: proteins * 4, // 4 cal per gram
            color: colors.PROTEIN,
            legendFontColor: theme.colors.textSecondary,
            legendFontSize: 12,
        },
        {
            name: 'Fat',
            population: fats * 9, // 9 cal per gram
            color: colors.FAT,
            legendFontColor: theme.colors.textSecondary,
            legendFontSize: 12,
        },
    ].filter(item => item.population > 0);

    const chartConfig = {
        backgroundColor: colors.BACKGROUND,
        backgroundGradientFrom: colors.BACKGROUND,
        backgroundGradientTo: colors.BACKGROUND,
        color: (opacity = 1) => isDarkTheme 
            ? `rgba(255, 255, 255, ${opacity})` 
            : `rgba(28, 28, 30, ${opacity})`,
        strokeWidth: 3,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
    };

    if (chartData.length === 0) {
        return (
            <View style={styles.emptyChartContainer}>
                <Text style={[styles.emptyChartText, { color: theme.colors.textMuted }]}>
                    No macronutrient data available
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.pieChartContainer}>
            <PieChart
                data={chartData}
                width={width - 40}
                height={180}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor={colors.BACKGROUND}
                paddingLeft="15"
                center={[10, 0]}
                hasLegend={showLegend}
            />
        </View>
    );
};

/**
 * Individual Macronutrient Progress Circles
 */
export const MacronutrientProgress: React.FC<MacronutrientProgressProps> = ({
    data,
    maxValues = { carbs: 50, proteins: 50, fats: 50 }
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const colors = getNutritionColors(theme);
    const { carbs, proteins, fats } = data;

    const progressData = {
        data: [
            carbs / Math.max(carbs, proteins, fats, maxValues.carbs),
            proteins / Math.max(carbs, proteins, fats, maxValues.proteins),
            fats / Math.max(carbs, proteins, fats, maxValues.fats),
        ]
    };

    const chartConfig = {
        backgroundColor: colors.BACKGROUND,
        backgroundGradientFrom: colors.BACKGROUND,
        backgroundGradientTo: colors.BACKGROUND,
        color: (opacity = 1) => isDarkTheme 
            ? `rgba(255, 255, 255, ${opacity})` 
            : `rgba(28, 28, 30, ${opacity})`,
        strokeWidth: 3,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
    };

    const macroItems = [
        { name: 'Carbs', value: carbs, color: colors.CARBS, index: 0 },
        { name: 'Protein', value: proteins, color: colors.PROTEIN, index: 1 },
        { name: 'Fat', value: fats, color: colors.FAT, index: 2 },
    ];

    return (
        <View style={styles.macroGrid}>
            {macroItems.map((item) => (
                <View key={item.name} style={styles.macroItem}>
                    <View style={styles.macroProgressContainer}>
                        <ProgressChart
                            data={{ data: [progressData.data[item.index]] }}
                            width={90}
                            height={90}
                            strokeWidth={8}
                            radius={25}
                            chartConfig={{
                                ...chartConfig,
                                color: () => item.color,
                            }}
                            hideLegend={true}
                        />
                        <View style={styles.macroValueOverlay}>
                            <Text style={[styles.macroValueText, { color: theme.colors.text }]}>
                                {item.value}g
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.macroLabelText, { color: theme.colors.textSecondary }]}>
                        {item.name}
                    </Text>
                </View>
            ))}
        </View>
    );
};

/**
 * Nutrition Legend Component
 */
export const NutritionLegend: React.FC<NutritionLegendProps> = ({ data }) => {
    const { theme } = useContext(ThemeContext);
    const colors = getNutritionColors(theme);
    const { carbs, proteins, fats } = data;

    const legendItems = [
        { name: 'Carbohydrates', value: carbs, color: colors.CARBS, unit: 'g' },
        { name: 'Protein', value: proteins, color: colors.PROTEIN, unit: 'g' },
        { name: 'Fat', value: fats, color: colors.FAT, unit: 'g' },
    ];

    return (
        <View style={[styles.legendContainer, { borderTopColor: theme.colors.border }]}>
            {legendItems.map((item) => (
                <View key={item.name} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.legendValue, { color: theme.colors.text }]}>
                        {item.value}{item.unit}
                    </Text>
                </View>
            ))}
        </View>
    );
};

/**
 * Additional Nutrients Display
 */
interface AdditionalNutrientsProps {
    data: {
        fiber?: number;
        sugar?: number;
        sodium?: number;
    };
    quantity: string;
    calculateNutrition: (baseValue: number, currentQuantity: string) => number;
}

export const AdditionalNutrients: React.FC<AdditionalNutrientsProps> = ({
    data,
    quantity,
    calculateNutrition
}) => {
    const { theme } = useContext(ThemeContext);
    const colors = getNutritionColors(theme);
    
    const nutrients = [
        {
            key: 'fiber',
            name: 'Dietary Fiber',
            value: data.fiber,
            color: colors.FIBER,
            icon: 'eco',
            unit: 'g'
        },
        {
            key: 'sugar',
            name: 'Sugar',
            value: data.sugar,
            color: colors.SUGAR,
            icon: 'grain',
            unit: 'g'
        },
        {
            key: 'sodium',
            name: 'Sodium',
            value: data.sodium,
            color: colors.SODIUM,
            icon: 'opacity',
            unit: 'mg'
        },
    ].filter(nutrient => nutrient.value && nutrient.value > 0);

    if (nutrients.length === 0) {
        return null;
    }

    return (
        <View style={styles.additionalNutrientsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Additional Nutrients
            </Text>
            <View style={styles.nutrientsList}>
                {nutrients.map((nutrient) => (
                    <View key={nutrient.key} style={styles.nutrientItem}>
                        <View style={[
                            styles.nutrientIconContainer, 
                            { backgroundColor: theme.colors.ringBackground }
                        ]}>
                            <MaterialIcons
                                name={nutrient.icon as any}
                                size={16}
                                color={nutrient.color}
                            />
                        </View>
                        <Text style={[styles.nutrientName, { color: theme.colors.textSecondary }]}>
                            {nutrient.name}
                        </Text>
                        <Text style={[styles.nutrientValue, { color: theme.colors.text }]}>
                            {calculateNutrition(nutrient.value!, quantity)}{nutrient.unit}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Pie Chart Styles
    pieChartContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyChartContainer: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChartText: {
        fontSize: 14,
        fontStyle: 'italic',
    },

    // Progress Chart Styles
    macroGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 20,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroProgressContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    macroValueOverlay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    macroValueText: {
        fontSize: 14,
        fontWeight: '700',
    },
    macroLabelText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },

    // Legend Styles
    legendContainer: {
        paddingTop: 16,
        borderTopWidth: 1,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    legendText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    legendValue: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Additional Nutrients Styles
    additionalNutrientsContainer: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    nutrientsList: {
        gap: 12,
    },
    nutrientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    nutrientIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    nutrientName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    nutrientValue: {
        fontSize: 14,
        fontWeight: '600',
    },
});
