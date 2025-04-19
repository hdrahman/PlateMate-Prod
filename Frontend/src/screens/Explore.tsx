import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = 120;

type TopicType = {
    title: string;
    icon: any; // Using any type for icon to accommodate Ionicons names
    colors: [string, string]; // Properly type as tuple
    description: string;
};

export default function Explore() {
    const topics: TopicType[] = [
        {
            title: "Workouts & Training",
            icon: "barbell-outline",
            colors: ["#FF9500", "#FF5E3A"],
            description: "Discover fitness routines and training methods"
        },
        {
            title: "Nutrition & Diet",
            icon: "nutrition-outline",
            colors: ["#34C759", "#32D74B"],
            description: "Learn about healthy eating and meal planning"
        },
        {
            title: "Style & Grooming",
            icon: "shirt-outline",
            colors: ["#5856D6", "#AF52DE"],
            description: "Tips for looking and feeling your best"
        },
        {
            title: "Mindset & Motivation",
            icon: "brain-outline",
            colors: ["#FF2D55", "#FF375F"],
            description: "Build mental strength and stay motivated"
        },
        {
            title: "Recovery & Wellness",
            icon: "medkit-outline",
            colors: ["#00C7BE", "#5AC8FA"],
            description: "Optimize rest and enhance wellbeing"
        }
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.headerText}>Explore</Text>
            <Text style={styles.subHeaderText}>Discover new content to improve your lifestyle</Text>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {topics.map((topic, index) => (
                    <TouchableOpacity key={index} style={styles.cardContainer}>
                        <LinearGradient
                            colors={topic.colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.card}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name={topic.icon} size={40} color="white" />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.cardTitle}>{topic.title}</Text>
                                <Text style={styles.cardDescription}>{topic.description}</Text>
                            </View>
                            <View style={styles.arrowContainer}>
                                <Ionicons name="chevron-forward" size={24} color="white" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingTop: 20,
    },
    headerText: {
        fontSize: 28,
        fontWeight: "bold",
        color: "white",
        marginHorizontal: 20,
        marginTop: 10,
    },
    subHeaderText: {
        fontSize: 16,
        color: "#999",
        marginHorizontal: 20,
        marginTop: 5,
        marginBottom: 20,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    card: {
        flex: 1,
        borderRadius: 15,
        flexDirection: "row",
        alignItems: "center",
        padding: 20,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    textContainer: {
        flex: 1,
        marginLeft: 15,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "white",
        marginBottom: 5,
    },
    cardDescription: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
    },
    arrowContainer: {
        width: 30,
        justifyContent: "center",
        alignItems: "center",
    },
}); 