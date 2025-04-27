import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const PURPLE_ACCENT = '#AA00FF';
const BLUE_ACCENT = '#2196F3';

export default function Manual() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manual Entry</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={GRAY} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search foods..."
                        placeholderTextColor={GRAY}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Main Content */}
            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Common Foods</Text>

                    {/* Food Items */}
                    {['Apple', 'Banana', 'Chicken Breast', 'Eggs', 'Greek Yogurt', 'Brown Rice'].map((food, index) => (
                        <TouchableOpacity key={index} style={styles.foodItem}>
                            <Text style={styles.foodName}>{food}</Text>
                            <Ionicons name="chevron-forward" size={20} color={GRAY} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Entries</Text>

                    {/* Empty state for recent entries */}
                    <View style={styles.emptyState}>
                        <Ionicons name="time-outline" size={40} color={GRAY} />
                        <Text style={styles.emptyStateText}>Your recent entries will appear here</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Create Custom Food</Text>
                    <TouchableOpacity style={styles.customButton}>
                        <LinearGradient
                            colors={["#5A60EA", "#FF00F5"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.customButtonGradient}
                        >
                            <Text style={styles.customButtonText}>CREATE CUSTOM FOOD</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: WHITE,
        fontSize: 16,
    },
    content: {
        flex: 1,
    },
    section: {
        margin: 16,
        marginTop: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 12,
    },
    foodItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
    },
    foodName: {
        fontSize: 16,
        color: WHITE,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 8,
        padding: 32,
    },
    emptyStateText: {
        color: GRAY,
        marginTop: 12,
        textAlign: 'center',
    },
    customButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    customButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    customButtonText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 16,
    },
}); 