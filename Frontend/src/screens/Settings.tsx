import React, { useContext } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, SafeAreaView, ScrollView, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemeContext } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const SettingsScreen = () => {
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const navigation = useNavigation<any>();
    const { signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            // Navigation is handled automatically by the AppNavigator based on auth state
        } catch (error) {
            Alert.alert('Logout Error', 'Failed to log out. Please try again.');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }}>
            <View style={[styles.header, isDarkTheme ? styles.dark : styles.light]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
                        <Ionicons name="person-circle-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("EditGoalsScreen")}>
                        <Ionicons name="fitness-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Edit Goals</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("PremiumSubscriptionScreen")}>
                        <Ionicons name="star-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Premium Subscription</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("ChangePasswordScreen")}>
                        <Ionicons name="lock-closed-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Change Password</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Security</Text>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("NotificationsScreen")}>
                        <Ionicons name="notifications-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Notifications</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("DataSharingScreen")}>
                        <Ionicons name="share-social-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Data Sharing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("PrivacyPolicyScreen")}>
                        <Ionicons name="document-text-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.itemText}>Privacy Policy</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, styles.bottomSection]}>
                    <TouchableOpacity style={[styles.item, styles.fullWidthItem]} onPress={() => navigation.navigate("DeleteAccountScreen")}>
                        <Ionicons name="trash-outline" size={20} color="#FF4C4C" style={styles.icon} />
                        <Text style={[styles.itemText, styles.dangerText]}>Delete Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.item, styles.fullWidthItem]}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#FF4C4C" style={styles.icon} />
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
        backgroundColor: "#000", // Ensures smooth transition
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
        // Removed backgroundColor to use dynamic styling
    },
    backButton: {
        backgroundColor: "#000", // Matches container to avoid white flash
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
    bottomSection: {
        marginBottom: 10, // Reduced space after the last section
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
        flexDirection: "row",
        alignItems: "center",
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
        marginLeft: 10,
    },
    dangerText: {
        color: "#FF4C4C",
        textAlign: "center",
    },
    icon: {
        marginRight: 10,
    },
});

export default SettingsScreen;
