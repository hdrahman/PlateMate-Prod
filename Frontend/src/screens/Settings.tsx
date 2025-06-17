import React, { useContext } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, ScrollView, Alert, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemeContext } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { resetCurrentUserOnboarding } from "../utils/resetOnboarding";

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

    const handleCheckOnboardingStatus = async () => {
        try {
            const { checkOnboardingStatus } = await import('../utils/resetOnboarding');
            await checkOnboardingStatus();
            Alert.alert('Debug', 'Onboarding status has been logged to console. Check the logs for details.');
        } catch (error) {
            Alert.alert('Error', 'Failed to check onboarding status.');
        }
    };

    const handleResetOnboarding = async () => {
        Alert.alert(
            'Reset Onboarding',
            'This will reset your onboarding status and you will need to go through the onboarding process again. Are you sure?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await resetCurrentUserOnboarding();
                            if (success) {
                                Alert.alert(
                                    'Success',
                                    'Onboarding has been reset successfully. Please restart the app to see the onboarding flow.',
                                    [{ text: 'OK' }]
                                );
                            } else {
                                Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />
            <View style={[styles.header, isDarkTheme ? styles.dark : styles.light]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.card}>
                        <View style={styles.itemRow}>
                            <View style={styles.iconTextContainer}>
                                <View style={[styles.iconBubble, { backgroundColor: '#9B00FF30' }]}>
                                    <Ionicons name="moon-outline" size={20} color="#9B00FF" />
                                </View>
                                <Text style={styles.itemText}>Dark Mode</Text>
                            </View>
                            <View style={styles.switchContainer}>
                                <Switch
                                    value={isDarkTheme}
                                    onValueChange={toggleTheme}
                                    trackColor={{ false: "#3e3e3e", true: "#9B00FF40" }}
                                    thumbColor={isDarkTheme ? "#9B00FF" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("EditProfile")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#4A90E230' }]}>
                                <Ionicons name="person-circle-outline" size={20} color="#4A90E2" />
                            </View>
                            <Text style={styles.itemText}>Edit Profile</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("EditGoals")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#50C87830' }]}>
                                <Ionicons name="fitness-outline" size={20} color="#50C878" />
                            </View>
                            <Text style={styles.itemText}>Edit Goals</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.item}
                            onPress={() => {
                                // Navigate using full type and options to avoid navigation errors
                                navigation.navigate('PremiumSubscription' as never);
                            }}
                        >
                            <View style={[styles.iconBubble, { backgroundColor: '#FFD70030' }]}>
                                <Ionicons name="star-outline" size={20} color="#FFD700" />
                            </View>
                            <Text style={styles.itemText}>Premium Subscription</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={() => navigation.navigate("ChangePassword")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#9B00FF30' }]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#9B00FF" />
                            </View>
                            <Text style={styles.itemText}>Change Password</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Privacy & Security</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("Notifications")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#FF700030' }]}>
                                <Ionicons name="notifications-outline" size={20} color="#FF7000" />
                            </View>
                            <Text style={styles.itemText}>Notifications</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("DataSharing")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#00BFFF30' }]}>
                                <Ionicons name="share-social-outline" size={20} color="#00BFFF" />
                            </View>
                            <Text style={styles.itemText}>Data Sharing</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={() => navigation.navigate("PrivacyPolicy")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#C0C0C030' }]}>
                                <Ionicons name="document-text-outline" size={20} color="#C0C0C0" />
                            </View>
                            <Text style={styles.itemText}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Developer</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.item} onPress={handleCheckOnboardingStatus}>
                            <View style={[styles.iconBubble, { backgroundColor: '#00BFFF30' }]}>
                                <Ionicons name="information-circle-outline" size={20} color="#00BFFF" />
                            </View>
                            <Text style={styles.itemText}>Check Onboarding Status</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.item} onPress={handleResetOnboarding}>
                            <View style={[styles.iconBubble, { backgroundColor: '#FF700030' }]}>
                                <Ionicons name="refresh-outline" size={20} color="#FF7000" />
                            </View>
                            <Text style={styles.itemText}>Reset Onboarding</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={() => navigation.navigate("DebugOnboarding")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#9B00FF30' }]}>
                                <Ionicons name="bug-outline" size={20} color="#9B00FF" />
                            </View>
                            <Text style={styles.itemText}>Debug Onboarding Data</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.section, styles.bottomSection]}>
                    <View style={styles.logoutContainer}>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleLogout}
                            activeOpacity={0.8}
                        >
                            <View style={styles.logoutContent}>
                                <Ionicons name="log-out-outline" size={22} color="#FFF" style={styles.logoutIcon} />
                                <Text style={styles.logoutText}>Log Out</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#121212",
    },
    dark: {
        backgroundColor: "#121212",
    },
    light: {
        backgroundColor: "#1E1E1E",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: "#FFF",
        fontSize: 22,
        fontWeight: "bold",
        marginLeft: 10,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    bottomSection: {
        marginTop: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#9B00FF",
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        backgroundColor: "#1E1E1E",
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: "#333",
    },
    iconTextContainer: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    switchContainer: {
        paddingLeft: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 5,
    },
    itemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 0,
        height: 60,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
    },
    lastItem: {
        borderBottomWidth: 0,
    },
    itemText: {
        fontSize: 16,
        color: "#FFF",
        flex: 1,
    },
    iconBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    chevron: {
        marginLeft: 10,
    },
    logoutContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FF000050',
    },
    logoutButton: {
        backgroundColor: "#FF3B30",
        borderRadius: 12,
        shadowColor: "#FF0000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 5,
    },
    logoutContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
    },
    logoutText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    logoutIcon: {
        marginRight: 10,
    },
});

export default SettingsScreen;
