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
                {/* Appearance Section at the top */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={[styles.itemRow, styles.fullWidthItem]}>
                        <Text style={styles.itemText}>Dark Mode</Text>
                        <Switch value={isDarkTheme} onValueChange={toggleTheme} />
                    </View>
                </View>
                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("EditProfileScreen")}>
                        <Text style={styles.itemText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("EditGoalsScreen")}>
                        <Text style={styles.itemText}>Edit Goals</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("PremiumSubscriptionScreen")}>
                        <Text style={styles.itemText}>Premium Subscription</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("ChangePasswordScreen")}>
                        <Text style={styles.itemText}>Change Password</Text>
                    </TouchableOpacity>
                </View>
                {/* Privacy & Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Security</Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("NotificationsScreen")}>
                        <Text style={styles.itemText}>Notifications</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("DataSharingScreen")}>
                        <Text style={styles.itemText}>Data Sharing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("PrivacyPolicyScreen")}>
                        <Text style={styles.itemText}>Privacy Policy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("DeleteAccountScreen")}>
                        <Text style={[styles.itemText, styles.dangerText]}>Delete Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => { /* handle log out action */ }}>
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
        // ...existing code...
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
        marginHorizontal: -20,       // added to extend border edge-to-edge
        paddingHorizontal: 20,       // added padding between text and sides
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: "#333",
    },
    item: {
        paddingVertical: 15,
        marginHorizontal: -20, // keep border spanning edge-to-edge
        paddingHorizontal: 20, // added padding between text and sides
        borderBottomWidth: 1,
        borderColor: "#333",
    },
    fullWidthItem: {
        marginHorizontal: -20,
    },
    itemText: {
        fontSize: 16,
        color: "#FFF",
        marginLeft: 10, // added left margin to indent text relative to section headers
    },
    dangerText: {
        color: "#FF4C4C",
        textAlign: "center",
    },
});

export default SettingsScreen;
