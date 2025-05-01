import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe } from '../api/recipes';
import { useFavorites } from '../context/FavoritesContext';

// Define color constants for consistent theming
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

interface RecipeCardProps {
    recipe: Recipe;
    onPress?: (recipe: Recipe) => void;
    compact?: boolean;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress, compact = false }) => {
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const isFav = isFavorite(recipe.id);

    const handleFavoritePress = async (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (isFav) {
            await removeFavorite(recipe.id);
        } else {
            await addFavorite(recipe);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.card, compact && styles.compactCard]}
            onPress={() => onPress && onPress(recipe)}
            activeOpacity={0.7}
        >
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: recipe.image }}
                    style={[styles.image, compact && styles.compactImage]}
                    resizeMode="cover"
                />
                <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={handleFavoritePress}
                >
                    <Ionicons
                        name={isFav ? "heart" : "heart-outline"}
                        size={22}
                        color={isFav ? "#FF4081" : WHITE}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                    {recipe.title}
                </Text>

                {!compact && (
                    <Text style={styles.summary} numberOfLines={2} ellipsizeMode="tail">
                        {recipe.summary}
                    </Text>
                )}

                <View style={styles.metaContainer}>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={compact ? 14 : 16} color={SUBDUED} />
                        <Text style={styles.metaText}>{recipe.readyInMinutes} min</Text>
                    </View>

                    <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={compact ? 14 : 16} color={SUBDUED} />
                        <Text style={styles.metaText}>{recipe.servings} serv</Text>
                    </View>

                    <View style={styles.metaItem}>
                        <Ionicons name="heart-outline" size={compact ? 14 : 16} color={SUBDUED} />
                        <Text style={styles.metaText}>{recipe.healthScore}/100</Text>
                    </View>
                </View>

                {!compact && recipe.diets.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {recipe.diets.slice(0, 3).map((diet, index) => (
                            <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>{diet}</Text>
                            </View>
                        ))}
                        {recipe.diets.length > 3 && (
                            <Text style={styles.moreTag}>+{recipe.diets.length - 3}</Text>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: '100%',
    },
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 100,
    },
    imageContainer: {
        position: 'relative',
    },
    image: {
        width: '100%',
        height: 160,
    },
    compactImage: {
        width: 80,
        height: '100%',
    },
    favoriteButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        padding: 12,
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 6,
    },
    summary: {
        fontSize: 14,
        color: SUBDUED,
        marginBottom: 8,
    },
    metaContainer: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 14,
    },
    metaText: {
        fontSize: 12,
        color: SUBDUED,
        marginLeft: 4,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginRight: 6,
        marginBottom: 6,
    },
    tagText: {
        color: PURPLE_ACCENT,
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    moreTag: {
        color: SUBDUED,
        fontSize: 10,
        marginLeft: 4,
        alignSelf: 'center',
    },
});

export default RecipeCard;