import React, { useContext, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, ScrollView, Alert, StatusBar, Modal, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ThemeContext } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMealGalleryStats, clearOldestMealImages, getUserProfileByFirebaseUid, updateUserProfile } from "../utils/database";
import UnifiedStepTracker from "../services/UnifiedStepTracker";
import PersistentStepTracker from "../services/PersistentStepTracker";
import StepTrackingModeModal from "../components/StepTrackingModeModal";

const SettingsScreen = () => {
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const navigation = useNavigation<any>();
    const { signOut, user } = useAuth();
    const [mealGalleryStats, setMealGalleryStats] = useState<{ totalMeals: number, storageUsedMB: number }>({ totalMeals: 0, storageUsedMB: 0 });
    const [isPersistentTrackingEnabled, setIsPersistentTrackingEnabled] = useState(false);
    const [isLoadingStepSettings, setIsLoadingStepSettings] = useState(false);
    const [showClearMealModal, setShowClearMealModal] = useState(false);
    const [clearMealCount, setClearMealCount] = useState("");
    const [showStepModeModal, setShowStepModeModal] = useState(false);
    const [pendingStepTrackingEnable, setPendingStepTrackingEnable] = useState(false);

    useEffect(() => {
        loadMealGalleryStats();
        loadStepTrackingSettings();
    }, []);

    const loadMealGalleryStats = async () => {
        try {
            const stats = await getMealGalleryStats();
            setMealGalleryStats(stats);
        } catch (error) {
            console.error('Error loading meal gallery stats:', error);
        }
    };

    const loadStepTrackingSettings = async () => {
        try {
            const enabled = UnifiedStepTracker.isTracking();
            setIsPersistentTrackingEnabled(enabled);
        } catch (error) {
            console.error('Error loading step tracking settings:', error);
        }
    };

    const handlePersistentTrackingToggle = async (enabled: boolean) => {
        if (isLoadingStepSettings) return;

        if (enabled) {
            // Show modal to select step tracking mode
            setPendingStepTrackingEnable(true);
            setShowStepModeModal(true);
        } else {
            // Disable step tracking
            setIsLoadingStepSettings(true);
            try {
                await Promise.all([
                    UnifiedStepTracker.stopTracking(),
                    PersistentStepTracker.stopService()
                ]);
                
                // Update database to set mode to disabled
                if (user?.uid) {
                    await updateUserProfile(user.uid, { step_tracking_calorie_mode: 'disabled' });
                }
                
                setIsPersistentTrackingEnabled(false);
                Alert.alert(
                    'Step Tracking Disabled',
                    'Step counting has been completely stopped.',
                    [{ text: 'OK' }]
                );
            } catch (error) {
                console.error('Error disabling persistent tracking:', error);
                Alert.alert('Error', 'Failed to disable step tracking. Please try again.');
            } finally {
                setIsLoadingStepSettings(false);
            }
        }
    };

    const handleStepModeSelection = async (mode: 'with_calories' | 'without_calories') => {
        setIsLoadingStepSettings(true);
        setPendingStepTrackingEnable(false);
        
        try {
            // Save the selected mode to database
            if (user?.uid) {
                await updateUserProfile(user.uid, { step_tracking_calorie_mode: mode });
                console.log(`✅ Step tracking mode saved: ${mode}`);
            }

            // Start step tracking
            const success = await UnifiedStepTracker.startTracking();
            if (success) {
                setIsPersistentTrackingEnabled(true);
                const modeText = mode === 'with_calories' ? 'Steps + Calories' : 'Steps Only';
                Alert.alert(
                    'Step Tracking Enabled',
                    `Step counting is now active in "${modeText}" mode.`,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Error', 'Failed to enable step tracking. Please check permissions.');
            }
        } catch (error) {
            console.error('Error enabling step tracking with mode:', error);
            Alert.alert('Error', 'Failed to enable step tracking. Please try again.');
        } finally {
            setIsLoadingStepSettings(false);
        }
    };

    const handleStepModeModalClose = () => {
        setShowStepModeModal(false);
        setPendingStepTrackingEnable(false);
        setIsLoadingStepSettings(false);
    };

    const handleClearMealCache = () => {
        // Open modal for user to input how many meals to clear
        setClearMealCount("");
        setShowClearMealModal(true);
    };

    const handleConfirmClearMeals = () => {
        const count = parseInt(clearMealCount);

        // Validate input
        if (isNaN(count) || count <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid number greater than 0.');
            return;
        }

        // Determine actual count to delete (cap at total available)
        const actualCount = Math.min(count, mealGalleryStats.totalMeals);

        if (actualCount === 0) {
            Alert.alert('No Meals', 'There are no meals with images to clear.');
            setShowClearMealModal(false);
            return;
        }

        // Close the input modal
        setShowClearMealModal(false);

        // Show confirmation dialog
        Alert.alert(
            'Confirm Deletion',
            `This will permanently delete ${actualCount} meal${actualCount !== 1 ? 's' : ''} and their image${actualCount !== 1 ? 's' : ''} from local storage. Once cleared, they cannot be recovered.\n\nAre you sure you want to continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const deletedCount = await clearOldestMealImages(actualCount);
                            await loadMealGalleryStats();
                            Alert.alert('Success', `${deletedCount} meal${deletedCount !== 1 ? 's' : ''} cleared successfully.`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear meals. Please try again.');
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
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("PrivacyPolicy")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#C0C0C030' }]}>
                                <Ionicons name="document-text-outline" size={20} color="#C0C0C0" />
                            </View>
                            <Text style={styles.itemText}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate("LegalTerms")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#E8A87C30' }]}>
                                <Ionicons name="document-outline" size={20} color="#E8A87C" />
                            </View>
                            <Text style={styles.itemText}>Legal</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={() => navigation.navigate("AboutCalculations")}>
                            <View style={[styles.iconBubble, { backgroundColor: '#FFB30030' }]}>
                                <Ionicons name="calculator-outline" size={20} color="#FFB300" />
                            </View>
                            <Text style={styles.itemText}>About Our Calculations</Text>
                            <Ionicons name="chevron-forward" size={18} color="#777" style={styles.chevron} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meal Gallery Management</Text>
                    <View style={styles.card}>
                        <View style={styles.item}>
                            <View style={[styles.iconBubble, { backgroundColor: '#32CD3230' }]}>
                                <Ionicons name="images-outline" size={20} color="#32CD32" />
                            </View>
                            <View style={styles.cacheStatsContainer}>
                                <Text style={styles.itemText}>Gallery Statistics</Text>
                                <Text style={styles.cacheStatsText}>
                                    Meals Saved: {mealGalleryStats.totalMeals} | Storage: {mealGalleryStats.storageUsedMB.toFixed(2)} MB
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.item, styles.lastItem]} onPress={handleClearMealCache}>
                            <View style={[styles.iconBubble, { backgroundColor: '#FF453A30' }]}>
                                <Ionicons name="trash-outline" size={20} color="#FF453A" />
                            </View>
                            <Text style={styles.itemText}>Clear Meal Cache</Text>
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

            {/* Clear Meal Cache Modal */}
            <Modal
                visible={showClearMealModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowClearMealModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Clear Meal Cache</Text>
                            <TouchableOpacity
                                onPress={() => setShowClearMealModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalContent}>
                            <Text style={styles.modalDescription}>
                                Enter the number of meals you want to clear. The oldest meals will be deleted first.
                            </Text>
                            <Text style={styles.modalWarning}>
                                ⚠️ Meals are stored locally with images. Once cleared, they cannot be recovered.
                            </Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>
                                    Number of meals (max: {mealGalleryStats.totalMeals})
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={clearMealCount}
                                    onChangeText={setClearMealCount}
                                    keyboardType="numeric"
                                    placeholder="Enter number"
                                    placeholderTextColor="#777"
                                    maxLength={6}
                                />
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setShowClearMealModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.clearButton]}
                                    onPress={handleConfirmClearMeals}
                                >
                                    <Text style={styles.clearButtonText}>Clear Meals</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Step Tracking Mode Modal */}
            <StepTrackingModeModal
                visible={showStepModeModal}
                onClose={handleStepModeModalClose}
                onSelectMode={handleStepModeSelection}
            />
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#2A2A2A',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFF',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalContent: {
        padding: 20,
    },
    modalDescription: {
        fontSize: 14,
        color: '#CCC',
        marginBottom: 12,
        lineHeight: 20,
    },
    modalWarning: {
        fontSize: 13,
        color: '#FF9500',
        backgroundColor: '#FF950020',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        lineHeight: 18,
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        color: '#AAA',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#2A2A2A',
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#FFF',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#2A2A2A',
        borderWidth: 1,
        borderColor: '#444',
    },
    clearButton: {
        backgroundColor: '#FF453A',
    },
    cancelButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    clearButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SettingsScreen;
