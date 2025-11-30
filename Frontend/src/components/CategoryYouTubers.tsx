import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { YouTuber } from '../api/youtube';
import { getYouTubersBySubcategory } from '../data/youtubers';
import YouTuberTab from './YouTuberTab';
import { ThemeContext } from '../ThemeContext';

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
    const { theme, isDarkTheme } = useContext(ThemeContext);
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
            {/* Subcategory Tabs */}
            <View style={styles.tabBarContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.subcategoriesContainer}
                    style={styles.subcategoriesScrollView}
                >
                    <TouchableOpacity
                        style={[
                            styles.subcategoryTab,
                            { backgroundColor: theme.colors.cardBackground },
                            selectedSubcategory === 'All' && styles.selectedSubcategoryTab
                        ]}
                        onPress={() => handleSubcategoryPress('All')}
                    >
                        <Text
                            style={[
                                styles.subcategoryText,
                                { color: theme.colors.textSecondary },
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
                                { backgroundColor: theme.colors.cardBackground },
                                selectedSubcategory === subcategory && styles.selectedSubcategoryTab
                            ]}
                            onPress={() => handleSubcategoryPress(subcategory)}
                        >
                            <Text
                                style={[
                                    styles.subcategoryText,
                                    { color: theme.colors.textSecondary },
                                    selectedSubcategory === subcategory && styles.selectedSubcategoryText
                                ]}
                            >
                                {subcategory}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content area */}
            <View style={styles.contentContainer}>
                {/* Display no results message if no youtubers match the filter */}
                {youtubers.length === 0 ? (
                    <View style={styles.noResultsContainer}>
                        <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>No youtubers found in this subcategory</Text>
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
                        style={styles.verticalScrollView}
                    >
                        {youtubers.map((youtuber) => (
                            <View key={youtuber.id} style={[styles.youtuberVerticalItem, { borderBottomColor: theme.colors.border }]}>
                                <YouTuberTab youtuber={youtuber} />
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabBarContainer: {
        height: 40,
        marginBottom: 10,
    },
    subcategoriesScrollView: {
        height: 40,
    },
    subcategoriesContainer: {
        paddingHorizontal: 15,
        alignItems: 'center',
        height: 40,
    },
    contentContainer: {
        flex: 1,
    },
    subcategoryTab: {
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 10,
        height: 32,
        justifyContent: 'center',
    },
    selectedSubcategoryTab: {
        backgroundColor: '#FF9500',
    },
    subcategoryText: {
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
    verticalScrollView: {
        flex: 1,
    },
    youtuberVerticalItem: {
        marginBottom: 10,
        borderBottomWidth: 1,
        paddingBottom: 15,
    },
    noResultsContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noResultsText: {
        fontSize: 16,
    },
});

export default CategoryYouTubers; 