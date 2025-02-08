import React, { useContext } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, SafeAreaView, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemeContext } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";

const SettingsScreen = () => {
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.itemRow}>
                        <Text style={styles.itemText}>Dark Mode</Text>
                        <Switch value={isDarkTheme} onValueChange={toggleTheme} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("EditProfileScreen")}>
                        <Text style={styles.itemText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("EditGoalsScreen")}>
                        <Text style={styles.itemText}>Edit Goals</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("PremiumSubscriptionScreen")}>
                        <Text style={styles.itemText}>Premium Subscription</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("ChangePasswordScreen")}>
                        <Text style={styles.itemText}>Change Password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("DeleteAccountScreen")}>
                        <Text style={[styles.itemText, styles.dangerText]}>Delete Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => { /* handle log out action */ }}>
                        <Text style={[styles.itemText, styles.dangerText]}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dark: {
        backgroundColor: "#000",
    },
    light: {
        backgroundColor: "#1E1E1E",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: "#444",
        paddingHorizontal: 16,
    },
    headerTitle: {
        color: "#FFF",
        fontSize: 22,
        fontWeight: "bold",
        marginLeft: 10,
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#9B00FF",
        marginBottom: 10,
    },
    itemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: "#333",
    },
    item: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: "#333",
    },
    fullWidthItem: {
        marginHorizontal: 0,
    },
    itemText: {
        fontSize: 16,
        color: "#FFF",
    },
    dangerText: {
        color: "#FF4C4C",
        textAlign: "center",
    },
});

export default SettingsScreen;
