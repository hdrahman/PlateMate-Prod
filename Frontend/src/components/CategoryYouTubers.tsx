import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { YouTuber } from '../api/youtube';
import { getYouTubersBySubcategory } from '../data/youtubers';
import YouTuberTab from './YouTuberTab';

interface CategoryYouTubersProps {
    category: string;
    youtubers: YouTuber[];
    subcategories: string[];
}

const { width } = Dimensions.get('window');

const CategoryYouTubers: React.FC<CategoryYouTubersProps> = ({
    category,
    youtubers: initialYoutubers,
    subcategories
}) => {
    const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
    const [youtubers, setYoutubers] = useState<YouTuber[]>(initialYoutubers);

    const handleSubcategoryPress = (subcategory: string) => {
        setSelectedSubcategory(subcategory);

        if (subcategory === 'All') {
            setYoutubers(initialYoutubers);
        } else {
            const filteredYoutubers = getYouTubersBySubcategory(category, subcategory);
            setYoutubers(filteredYoutubers);
        }
    };

    // Determine if we're filtering (not showing "All")
    const isFiltering = selectedSubcategory !== 'All';

    return (
        <View style={styles.container}>
            <Text style={styles.categoryTitle}>{category}</Text>

            {/* Subcategory Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subcategoriesContainer}
            >
                <TouchableOpacity
                    style={[
                        styles.subcategoryTab,
                        selectedSubcategory === 'All' && styles.selectedSubcategoryTab
                    ]}
                    onPress={() => handleSubcategoryPress('All')}
                >
                    <Text
                        style={[
                            styles.subcategoryText,
                            selectedSubcategory === 'All' && styles.selectedSubcategoryText
                        ]}
                    >
                        All
                    </Text>
                </TouchableOpacity>

                {subcategories.map((subcategory) => (
                    <TouchableOpacity
                        key={subcategory}
                        style={[
                            styles.subcategoryTab,
                            selectedSubcategory === subcategory && styles.selectedSubcategoryTab
                        ]}
                        onPress={() => handleSubcategoryPress(subcategory)}
                    >
                        <Text
                            style={[
                                styles.subcategoryText,
                                selectedSubcategory === subcategory && styles.selectedSubcategoryText
                            ]}
                        >
                            {subcategory}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Display no results message if no youtubers match the filter */}
            {youtubers.length === 0 ? (
                <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No youtubers found in this subcategory</Text>
                </View>
            ) : isFiltering ? (
                /* When filtering (not 'All'), show horizontal paging view */
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={width}
                    snapToAlignment="center"
                    contentContainerStyle={styles.youtuberTabsContainer}
                >
                    {youtubers.map((youtuber) => (
                        <View key={youtuber.id} style={[styles.youtuberTabWrapper, { width }]}>
                            <YouTuberTab youtuber={youtuber} />
                        </View>
                    ))}
                </ScrollView>
            ) : (
                /* When showing 'All', display vertical list of all YouTubers */
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.allYoutubersContainer}
                >
                    {youtubers.map((youtuber) => (
                        <View key={youtuber.id} style={styles.youtuberVerticalItem}>
                            <YouTuberTab youtuber={youtuber} />
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 30,
        flex: 1,
    },
    categoryTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 15,
        paddingHorizontal: 20,
    },
    subcategoriesContainer: {
        paddingHorizontal: 15,
        marginBottom: 20,
    },
    subcategoryTab: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: '#1E1E1E',
    },
    selectedSubcategoryTab: {
        backgroundColor: '#FF9500',
    },
    subcategoryText: {
        color: '#BBBBBB',
        fontSize: 14,
        fontWeight: '500',
    },
    selectedSubcategoryText: {
        color: 'white',
        fontWeight: 'bold',
    },
    youtuberTabsContainer: {
        flexGrow: 1,
    },
    youtuberTabWrapper: {
        flex: 1,
    },
    allYoutubersContainer: {
        paddingBottom: 30,
    },
    youtuberVerticalItem: {
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 20,
    },
    noResultsContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noResultsText: {
        color: '#BBBBBB',
        fontSize: 16,
    },
});

export default CategoryYouTubers; 