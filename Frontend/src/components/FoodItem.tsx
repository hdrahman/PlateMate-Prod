import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
    // Check if this food has a local camera image (from camera capture)
    // Only show images that are local file paths from camera, not external URLs
    const hasLocalImage = item.image &&
        item.image.trim() !== '' &&
        (item.image.includes('meal_images/') || // Our local meal images directory
            item.image.includes('DocumentDirectory/meal_images') ||
            item.image.includes('CacheDirectory/meal_images') ||
            item.image.startsWith('file://') // React Native file URIs
        ) &&
        !item.image.startsWith('http://') &&
        !item.image.startsWith('https://') &&
        !item.image.includes('placeholder') &&
        !item.image.includes('via.placeholder.com');

    return (
        <TouchableOpacity
            style={[
                styles.container,
                hasLocalImage ? styles.containerWithImage : styles.containerNoImage
            ]}
            onPress={() => onPress(item)}
            activeOpacity={0.8}
        >
            {/* Image section (only if food was added through camera) */}
            {hasLocalImage && (
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.foodImage}
                        resizeMode="cover"
                    />
                </View>
            )}

            {/* Content section */}
            <View style={[
                styles.contentContainer,
                hasLocalImage ? styles.contentWithImage : styles.contentNoImage
            ]}>
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
                            <Text style={styles.macroText}>{item.proteins}g Protein</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <View style={[styles.macroDot, { backgroundColor: BLUE }]} />
                            <Text style={styles.macroText}>{item.carbs}g Carbs</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <View style={[styles.macroDot, { backgroundColor: ORANGE }]} />
                            <Text style={styles.macroText}>{item.fats}g Fats</Text>
                        </View>
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
        marginBottom: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    containerNoImage: {
        padding: 12,
    },
    containerWithImage: {
        flexDirection: 'row',
        padding: 8,
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 12,
    },
    foodImage: {
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        flex: 1,
    },
    contentNoImage: {
        // No special styling needed for this case
    },
    contentWithImage: {
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
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
        flexDirection: 'column',
        gap: 8,
    },
    servingText: {
        fontSize: 11,
        color: GRAY,
        fontWeight: '500',
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
    },
    macroItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minWidth: 80,
    },
    macroDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    macroText: {
        fontSize: 12,
        fontWeight: '600',
        color: WHITE,
    },
}); 