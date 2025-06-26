import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import WeightLossComparisonChart from '../components/WeightLossComparisonChart';

const WeightLossChartDemo: React.FC = () => {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.headerTitle}>Weight Loss Success</Text>
                    <Text style={styles.headerSubtitle}>
                        See how PlateMate delivers sustainable results compared to traditional dieting
                    </Text>

                    <WeightLossComparisonChart successPercentage={78} />

                    <View style={styles.insightsContainer}>
                        <Text style={styles.insightsTitle}>Why PlateMate Works Better</Text>

                        <View style={styles.insightItem}>
                            <Text style={styles.insightEmoji}>🎯</Text>
                            <View style={styles.insightText}>
                                <Text style={styles.insightTitle}>Sustainable Approach</Text>
                                <Text style={styles.insightDescription}>
                                    Unlike crash diets, PlateMate focuses on gradual, healthy changes that you can maintain long-term.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.insightItem}>
                            <Text style={styles.insightEmoji}>🧠</Text>
                            <View style={styles.insightText}>
                                <Text style={styles.insightTitle}>AI-Powered Guidance</Text>
                                <Text style={styles.insightDescription}>
                                    Smart recommendations adapt to your progress, preventing plateaus and maintaining motivation.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.insightItem}>
                            <Text style={styles.insightEmoji}>📊</Text>
                            <View style={styles.insightText}>
                                <Text style={styles.insightTitle}>Data-Driven Results</Text>
                                <Text style={styles.insightDescription}>
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
        backgroundColor: '#F8F9FA',
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
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666666',
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
        color: '#1A1A1A',
        marginBottom: 20,
        textAlign: 'center',
    },
    insightItem: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
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
        color: '#1A1A1A',
        marginBottom: 4,
    },
    insightDescription: {
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
    },
});

export default WeightLossChartDemo; 