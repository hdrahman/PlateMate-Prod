import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export default function MealPlanner() {
    const navigation = useNavigation();

    // Handle the pantry scan button press
    const handleScanPantry = () => {
        // Navigate to a custom camera screen for pantry scanning
        navigation.navigate('MealPlannerCamera' as never);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerSection}>
                <Text style={styles.headerText}>Meal Planner</Text>
                <Text style={styles.subHeaderText}>
                    Get personalized meal plans based on your pantry items
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Scan Pantry Card */}
                <TouchableOpacity style={styles.cardContainer} onPress={handleScanPantry}>
                    <LinearGradient
                        colors={['#5A60EA', '#FF00F5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.card}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="camera-outline" size={40} color="white" />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.cardTitle}>Scan Your Pantry</Text>
                            <Text style={styles.cardDescription}>
                                Take a photo of your pantry items to generate meal suggestions
                            </Text>
                        </View>
                        <View style={styles.arrowContainer}>
                            <Ionicons name="chevron-forward" size={24} color="white" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Recent Meal Plans Card - Will be populated with actual data later */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Recent Meal Plans</Text>
                    <Text style={styles.emptyStateText}>
                        Your recent meal plans will appear here after you scan your pantry
                    </Text>
                </View>

                {/* Nutrition Summary Section - Placeholder for future functionality */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Today's Nutrition</Text>
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
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerSection: {
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginHorizontal: 20,
    },
    subHeaderText: {
        fontSize: 16,
        color: '#999',
        marginHorizontal: 20,
        marginTop: 5,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 10,
        paddingBottom: 30,
    },
    cardContainer: {
        width: '90%',
        height: 120,
        borderRadius: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        alignSelf: 'center',
    },
    card: {
        flex: 1,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 15,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    cardDescription: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    arrowContainer: {
        width: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionContainer: {
        marginTop: 20,
        marginHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10,
    },
    emptyStateText: {
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
    nutritionInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#1E1E1E',
        borderRadius: 10,
        padding: 15,
    },
    nutritionItem: {
        alignItems: 'center',
    },
    nutritionLabel: {
        color: '#999',
        fontSize: 14,
        marginBottom: 5,
    },
    nutritionValue: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
}); 