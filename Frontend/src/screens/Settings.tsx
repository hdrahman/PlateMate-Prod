import React, { useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, ScrollView, Alert, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemeContext } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCacheStats, clearMealPlannerCache } from "../utils/database";
import BackgroundStepTrackerInstance from "../services/BackgroundStepTracker";

const SettingsScreen = () => {
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const navigation = useNavigation<any>();
    const { signOut } = useAuth();
    const [cacheStats, setCacheStats] = useState<{ total: number, active: number, expired: number }>({ total: 0, active: 0, expired: 0 });
    const [isPersistentTrackingEnabled, setIsPersistentTrackingEnabled] = useState(false);
    const [isLoadingStepSettings, setIsLoadingStepSettings] = useState(false);

    useEffect(() => {
        loadCacheStats();
        loadStepTrackingSettings();
    }, []);

    const loadCacheStats = async () => {
        try {
            const stats = await getCacheStats();
            setCacheStats(stats);
        } catch (error) {
            console.error('Error loading cache stats:', error);
        }
    };

    const loadStepTrackingSettings = async () => {
        try {
            const enabled = await BackgroundStepTrackerInstance.isPersistentTrackingEnabled();
            setIsPersistentTrackingEnabled(enabled);
        } catch (error) {
            console.error('Error loading step tracking settings:', error);
        }
    };

    const handlePersistentTrackingToggle = async (enabled: boolean) => {
        if (isLoadingStepSettings) return;

        setIsLoadingStepSettings(true);
        try {
            if (enabled) {
                const success = await BackgroundStepTrackerInstance.enablePersistentTracking();
                if (success) {
                    setIsPersistentTrackingEnabled(true);
                    Alert.alert(
                        'Always-On Step Tracking Enabled',
                        'Step counting will now continue even when the app is closed. You may see a persistent notification.',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert('Error', 'Failed to enable always-on step tracking. Please try again.');
                }
            } else {
                const success = await BackgroundStepTrackerInstance.disablePersistentTracking();
                if (success) {
                    setIsPersistentTrackingEnabled(false);
                    Alert.alert(
                        'Always-On Step Tracking Disabled',
                        'Step counting will now only work when the app is open.',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert('Error', 'Failed to disable always-on step tracking. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error toggling persistent tracking:', error);
            Alert.alert('Error', 'Failed to change step tracking settings. Please try again.');
        } finally {
            setIsLoadingStepSettings(false);
        }
    };

    const handleClearCache = async () => {
        Alert.alert(
            'Clear Meal Planner Cache',
            'This will clear all cached recipes and force fresh data to be loaded. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearMealPlannerCache();
                            await loadCacheStats();
                            Alert.alert('Success', 'Meal planner cache cleared successfully');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear cache. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        try {
            await signOut();
            // Navigation is handled automatically by the AppNavigator based on auth state
        } catch (error) {
            Alert.alert('Logout Error', 'Failed to log out. Please try again.');
        }
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
                        <View style={styles.itemRow}>
                            <View style={styles.iconTextContainer}>
                                <View style={[styles.iconBubble, { backgroundColor: '#FF00F530' }]}>
                                    <Ionicons name="footsteps-outline" size={20} color="#FF00F5" />
                                </View>
                                <View style={styles.stepTrackingTextContainer}>
                                    <Text style={styles.itemText}>Always-On Step Tracking</Text>
                                    <Text style={styles.itemSubtext}>
                                        Keep counting steps even when app is closed
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.switchContainer}>
                                <Switch
                                    value={isPersistentTrackingEnabled}
                                    onValueChange={handlePersistentTrackingToggle}
                                    disabled={isLoadingStepSettings}
                                    trackColor={{ false: "#3e3e3e", true: "#FF00F540" }}
                                    thumbColor={isPersistentTrackingEnabled ? "#FF00F5" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                />
                            </View>
                        </View>
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
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("ChangePassword")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#9B00FF30' }]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#9B00FF" />
                            </View>
                            <Text style={styles.itemText}>Change Password</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.item, styles.lastItem]}
                            onPress={() => {
                                console.log('🎬 Settings: Future Self Recording button pressed');
                                try {
                                    console.log('🚀 Testing navigation to FutureSelfRecordingSimple');
                                    (navigation as any).navigate('FutureSelfRecordingSimple');

                                    console.log('✅ Navigation call completed');
                                } catch (error) {
                                    console.error('❌ Navigation error:', error);
                                    Alert.alert('Navigation Error', `Failed to open recording screen: ${error}`);
                                }
                            }}
                        >
                            <View style={[styles.iconBubble, { backgroundColor: '#4CAF5030' }]}>
                                <Ionicons name="videocam-outline" size={20} color="#4CAF50" />
                            </View>
                            <Text style={styles.itemText}>Record Future Self Message</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Community</Text>
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={[styles.item, styles.lastItem]}
                            onPress={() => navigation.navigate("FeatureRequests")}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBubble, { backgroundColor: '#32CD3230' }]}>
                                <Ionicons name="bulb-outline" size={20} color="#32CD32" />
                            </View>
                            <Text style={styles.itemText}>Feature Requests</Text>
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
                    <Text style={styles.sectionTitle}>Cache Management</Text>
                    <View style={styles.card}>
                        <View style={styles.item}>
                            <View style={[styles.iconBubble, { backgroundColor: '#32CD3230' }]}>
                                <Ionicons name="server-outline" size={20} color="#32CD32" />
                            </View>
                            <View style={styles.cacheStatsContainer}>
                                <Text style={styles.itemText}>Cache Statistics</Text>
                                <Text style={styles.cacheStatsText}>
                                    Active: {cacheStats.active} | Expired: {cacheStats.expired} | Total: {cacheStats.total}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={handleClearCache}>
                            <View style={[styles.iconBubble, { backgroundColor: '#FF453A30' }]}>
                                <Ionicons name="trash-outline" size={20} color="#FF453A" />
                            </View>
                            <Text style={styles.itemText}>Clear Recipe Cache</Text>
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
    cacheStatsContainer: {
        flex: 1,
        marginLeft: 12,
    },
    cacheStatsText: {
        fontSize: 12,
        color: '#777',
        marginTop: 2,
    },
    stepTrackingTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    itemSubtext: {
        fontSize: 12,
        color: '#777',
        marginTop: 2,
        lineHeight: 16,
    },
});

export default SettingsScreen;
