import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem as FoodItemType } from '../api/nutritionix';

// Define theme colors
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const CARD_BG = '#1C1C1E';
const GREEN = '#4CAF50';
const YELLOW = '#FFC107';
const RED = '#F44336';

interface FoodItemProps {
    item: FoodItemType;
    onPress: (item: FoodItemType) => void;
}

export default function FoodItem({ item, onPress }: FoodItemProps) {
    // Get healthiness color
    const getHealthinessColor = (rating?: number) => {
        if (!rating) return GRAY;
        if (rating >= 7) return GREEN;
        if (rating >= 4) return YELLOW;
        return RED;
    };

    // Get macro percentage string
    const getMacroPercentage = () => {
        const totalMacros = item.proteins + item.carbs + item.fats;
        if (totalMacros === 0) return '';

        const proteinPct = Math.round((item.proteins / totalMacros) * 100);
        const carbsPct = Math.round((item.carbs / totalMacros) * 100);
        const fatsPct = Math.round((item.fats / totalMacros) * 100);

        return `${proteinPct}P / ${carbsPct}C / ${fatsPct}F`;
    };

    // Get default food image if none is provided
    const getImage = () => {
        if (item.image) return { uri: item.image };
        return require('../../assets/default-food.png');
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => onPress(item)}
        >
            <View style={styles.imageContainer}>
                <Image
                    source={getImage()}
                    style={styles.image}
                    defaultSource={require('../../assets/default-food.png')}
                />
            </View>

            <View style={styles.detailsContainer}>
                <Text style={styles.foodName}>{item.food_name}</Text>
                {item.brand_name && (
                    <Text style={styles.brandName}>{item.brand_name}</Text>
                )}
                <View style={styles.nutritionInfo}>
                    <Text style={styles.caloriesText}>
                        {item.calories} <Text style={styles.caloriesLabel}>cal</Text>
                    </Text>
                    <Text style={styles.servingText}>
                        {item.serving_qty} {item.serving_unit} {item.serving_weight_grams > 0 ? `(${item.serving_weight_grams}g)` : ''}
                    </Text>
                </View>
                <View style={styles.macrosContainer}>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{item.proteins}g</Text>
                        <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{item.carbs}g</Text>
                        <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{item.fats}g</Text>
                        <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                    <View style={[styles.healthinessIndicator, { backgroundColor: getHealthinessColor(item.healthiness_rating) }]}>
                        <Text style={styles.healthinessText}>{item.healthiness_rating || '?'}</Text>
                    </View>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={GRAY} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: CARD_BG,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: LIGHT_GRAY,
        marginRight: 12,
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    detailsContainer: {
        flex: 1,
    },
    foodName: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 2,
    },
    brandName: {
        fontSize: 12,
        color: GRAY,
        marginBottom: 4,
    },
    nutritionInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    caloriesText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
    },
    caloriesLabel: {
        fontSize: 12,
        fontWeight: 'normal',
        color: GRAY,
    },
    servingText: {
        fontSize: 12,
        color: GRAY,
    },
    macrosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    macroItem: {
        marginRight: 12,
    },
    macroValue: {
        fontSize: 12,
        fontWeight: '600',
        color: WHITE,
    },
    macroLabel: {
        fontSize: 10,
        color: GRAY,
    },
    healthinessIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    healthinessText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: WHITE,
    },
}); 