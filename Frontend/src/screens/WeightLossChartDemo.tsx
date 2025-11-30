import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import WeightLossComparisonChart from '../components/WeightLossComparisonChart';
import { ThemeContext } from '../ThemeContext';

const WeightLossChartDemo: React.FC = () => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Weight Loss Success</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                        See how PlateMate delivers sustainable results compared to traditional dieting
                    </Text>

                    <WeightLossComparisonChart successPercentage={78} />

                    <View style={styles.insightsContainer}>
                        <Text style={[styles.insightsTitle, { color: theme.colors.text }]}>Why PlateMate Works Better</Text>

                        <View style={[styles.insightItem, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadow }]}>
                            <Text style={styles.insightEmoji}>🎯</Text>
                            <View style={styles.insightText}>
                                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>Sustainable Approach</Text>
                                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                                    Unlike crash diets, PlateMate focuses on gradual, healthy changes that you can maintain long-term.
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.insightItem, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadow }]}>
                            <Text style={styles.insightEmoji}>🧠</Text>
                            <View style={styles.insightText}>
                                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>AI-Powered Guidance</Text>
                                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                                    Smart recommendations adapt to your progress, preventing plateaus and maintaining motivation.
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.insightItem, { backgroundColor: theme.colors.cardBackground, shadowColor: theme.colors.shadow }]}>
                            <Text style={styles.insightEmoji}>📊</Text>
                            <View style={styles.insightText}>
                                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>Data-Driven Results</Text>
                                <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                                    Track real progress beyond just weight - including nutrition, habits, and overall wellness.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingVertical: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    insightsContainer: {
        marginTop: 30,
        paddingHorizontal: 20,
    },
    insightsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    insightItem: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    insightEmoji: {
        fontSize: 24,
        marginRight: 16,
        marginTop: 2,
    },
    insightText: {
        flex: 1,
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    insightDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
});

export default WeightLossChartDemo; 