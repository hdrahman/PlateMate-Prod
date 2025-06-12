import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem as FoodItemType } from '../api/nutritionix';

// Define theme colors - professional palette
const WHITE = '#FFFFFF';
const GRAY = '#8E8E93';
const LIGHT_GRAY = '#48484A';
const CARD_BG = '#1C1C1E';
const GREEN = '#30D158';
const BLUE = '#64D2FF';
const ORANGE = '#FF9F0A';

interface FoodItemProps {
    item: FoodItemType;
    onPress: (item: FoodItemType) => void;
}

export default function FoodItem({ item, onPress }: FoodItemProps) {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => onPress(item)}
            activeOpacity={0.8}
        >
            {/* Main Row */}
            <View style={styles.mainRow}>
                <View style={styles.titleContainer}>
                    <Text style={styles.foodName} numberOfLines={1}>{item.food_name}</Text>
                    {item.brand_name && (
                        <Text style={styles.brandName} numberOfLines={1}>{item.brand_name}</Text>
                    )}
                </View>

                <View style={styles.rightSection}>
                    <Text style={styles.caloriesText}>{item.calories} cal</Text>
                    <Ionicons name="chevron-forward" size={14} color={GRAY} />
                </View>
            </View>

            {/* Bottom Row */}
            <View style={styles.bottomRow}>
                <Text style={styles.servingText}>
                    {item.serving_qty} {item.serving_unit}
                    {item.serving_weight_grams > 0 ? ` (${item.serving_weight_grams}g)` : ''}
                </Text>

                <View style={styles.macrosRow}>
                    <View style={styles.macroItem}>
                        <View style={[styles.macroDot, { backgroundColor: GREEN }]} />
                        <Text style={styles.macroText}>{item.proteins}g P</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <View style={[styles.macroDot, { backgroundColor: BLUE }]} />
                        <Text style={styles.macroText}>{item.carbs}g C</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <View style={[styles.macroDot, { backgroundColor: ORANGE }]} />
                        <Text style={styles.macroText}>{item.fats}g F</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 12,
        marginBottom: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    foodName: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 1,
    },
    brandName: {
        fontSize: 11,
        color: GRAY,
        fontWeight: '500',
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    caloriesText: {
        fontSize: 13,
        fontWeight: '600',
        color: WHITE,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    servingText: {
        fontSize: 11,
        color: GRAY,
        fontWeight: '500',
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    macroItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    macroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
    },
    macroText: {
        fontSize: 11,
        fontWeight: '500',
        color: GRAY,
    },
}); 