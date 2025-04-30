import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

// Define types for the component props
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

// Define color constants for consistent theming
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';

export default function MealPlanner() {
    const navigation = useNavigation();

    // Handle the pantry scan button press
    const handleScanPantry = () => {
        // Navigate to a custom camera screen for pantry scanning
        navigation.navigate('MealPlannerCamera' as never);
    };

    // GradientBorderCard component for consistent card styling
    const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
        return (
            <View style={styles.gradientBorderContainer}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        borderRadius: 10,
                    }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
                <View
                    style={{
                        margin: 1,
                        borderRadius: 9,
                        backgroundColor: CARD_BG,
                        padding: 16,
                        ...(style || {})
                    }}
                >
                    {children}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Meal Planner</Text>
                <Text style={styles.headerSub}>
                    Get personalized meal plans based on your pantry items
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollInner}
            >
                {/* Scan Pantry Card */}
                <GradientBorderCard>
                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={handleScanPantry}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="camera-outline" size={40} color={WHITE} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.scanTitle}>Scan Your Pantry</Text>
                            <Text style={styles.scanDescription}>
                                Take a photo of your pantry items to generate meal suggestions
                            </Text>
                        </View>
                        <View style={styles.arrowContainer}>
                            <Ionicons name="chevron-forward" size={24} color={WHITE} />
                        </View>
                    </TouchableOpacity>
                </GradientBorderCard>

                {/* Recent Meal Plans Card */}
                <GradientBorderCard>
                    <Text style={styles.sectionTitle}>Recent Meal Plans</Text>
                    <View style={styles.dividerLine} />
                    <Text style={styles.emptyStateText}>
                        Your recent meal plans will appear here after you scan your pantry
                    </Text>
                </GradientBorderCard>

                {/* Nutrition Summary Section */}
                <GradientBorderCard>
                    <Text style={styles.sectionTitle}>Today's Nutrition</Text>
                    <View style={styles.dividerLine} />
                    <View style={styles.nutritionInfoContainer}>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionLabel}>Remaining Calories</Text>
                            <Text style={styles.nutritionValue}>1200</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                            <Text style={styles.nutritionLabel}>Meals Left</Text>
                            <Text style={styles.nutritionValue}>2</Text>
                        </View>
                    </View>
                </GradientBorderCard>

                {/* Add a button to explore meal ideas */}
                <GradientBorderCard>
                    <TouchableOpacity style={styles.analyzeBtn}>
                        <Text style={styles.analyzeBtnText}>Explore Meal Ideas</Text>
                    </TouchableOpacity>
                </GradientBorderCard>
            </ScrollView>
        </SafeAreaView>
    );
}

// Create a type for our styles
type StylesType = {
    container: ViewStyle;
    header: ViewStyle;
    headerTitle: TextStyle;
    headerSub: TextStyle;
    scrollView: ViewStyle;
    scrollInner: ViewStyle;
    scanButton: ViewStyle;
    iconContainer: ViewStyle;
    textContainer: ViewStyle;
    scanTitle: TextStyle;
    scanDescription: TextStyle;
    arrowContainer: ViewStyle;
    sectionTitle: TextStyle;
    emptyStateText: TextStyle;
    nutritionInfoContainer: ViewStyle;
    nutritionItem: ViewStyle;
    nutritionLabel: TextStyle;
    nutritionValue: TextStyle;
    gradientBorderContainer: ViewStyle;
    dividerLine: ViewStyle;
    analyzeBtn: ViewStyle;
    analyzeBtnText: TextStyle;
};

const styles = StyleSheet.create<StylesType>({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: PRIMARY_BG,
    },
    headerTitle: {
        fontSize: 26,
        color: PURPLE_ACCENT,
        fontWeight: '700',
        marginBottom: 4,
    },
    headerSub: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '400',
    },
    scrollView: {
        flex: 1,
    },
    scrollInner: {
        paddingHorizontal: 10,
        paddingBottom: 40,
        width: '100%',
        alignItems: 'center',
    },
    // Gradient border components
    gradientBorderContainer: {
        marginBottom: 12,
        borderRadius: 10,
        width: '100%',
        overflow: 'hidden',
    },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 15,
    },
    scanTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 5,
    },
    scanDescription: {
        fontSize: 14,
        color: SUBDUED,
    },
    arrowContainer: {
        width: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 6,
    },
    // Dividers
    dividerLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        marginVertical: 8,
        marginHorizontal: -20,
        width: '120%',
    },
    emptyStateText: {
        color: SUBDUED,
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
    nutritionInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
    },
    nutritionItem: {
        alignItems: 'center',
    },
    nutritionLabel: {
        color: SUBDUED,
        fontSize: 14,
        marginBottom: 5,
    },
    nutritionValue: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    // Button styles
    analyzeBtn: {
        backgroundColor: PURPLE_ACCENT,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        transform: [{ translateY: -2 }],
        shadowColor: PURPLE_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 5,
    },
    analyzeBtnText: {
        color: WHITE,
        fontWeight: '700',
        fontSize: 16,
    },
}); 