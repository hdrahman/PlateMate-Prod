import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Image,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../ThemeContext';
import { getUserProfileBySupabaseUid, getUserGoals } from '../utils/database';
import { formatWeight, parseUnitPreference, kgToLbs } from '../utils/unitConversion';

// Colors are now provided via ThemeContext

const ProfileScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);

    // Unit preference state
    const [isImperialUnits, setIsImperialUnits] = useState(false);

    // Mock data - in a real app, this would come from an API/database
    const [profileData, setProfileData] = useState({
        username: 'haamed_rahman',
        location: 'United States',
        startingWeight: 112,
        currentWeight: 105,
        goalWeight: 0,
        weightLost: 7,
        weeklyGoal: 'Lose 1 kg per week',
        dailyCalories: 0,
        macros: {
            carbs: 225,
            fat: 60,
            protein: 90,
        }
    });

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!user) return;

            try {
                // Get user profile from local database
                const profile = await getUserProfileBySupabaseUid(user.id);

                // Get user goals from the database to get the calorie goal
                const userGoals = await getUserGoals(user.id);

                if (profile) {
                    // Parse and set unit preference
                    const useMetric = parseUnitPreference(profile);
                    setIsImperialUnits(!useMetric);

                    // Update profile data with fetched information
                    setProfileData(prevData => ({
                        ...prevData,
                        username: profile.first_name ? profile.first_name.toLowerCase() : 'user',
                        location: profile.location || 'Not set',
                        startingWeight: profile.starting_weight || profile.weight || 0,
                        currentWeight: profile.weight || 0,
                        goalWeight: profile.target_weight || 0,
                        dailyCalories: userGoals?.calorieGoal || profile.daily_calorie_target || 0,
                        macros: {
                            carbs: userGoals?.carbGoal || profile.carb_goal || 225,
                            fat: userGoals?.fatGoal || profile.fat_goal || 60,
                            protein: userGoals?.proteinGoal || profile.protein_goal || 90,
                        }
                    }));
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
            }
        };

        fetchUserProfile();
    }, [user]);

    const goToEditProfile = () => {
        navigation.navigate('EditProfile');
    };

    const goToGoals = () => {
        navigation.navigate('Goals');
    };

    const goToSettings = () => {
        navigation.navigate('Settings');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.profileHeaderContainer}>
                    <Image
                        source={require('../../assets/default-avatar.png')}
                        style={styles.profileImage}
                        defaultSource={require('../../assets/default-avatar.png')}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={[styles.username, { color: theme.colors.text }]}>{profileData.username}</Text>
                        <Text style={[styles.location, { color: theme.colors.textSecondary }]}>{profileData.location}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={goToSettings}>
                    <Ionicons name="settings-outline" size={28} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity style={[styles.tab, styles.activeTab, { borderBottomColor: theme.colors.primary }]}>
                    <Text style={[styles.tabText, styles.activeTabText, { color: theme.colors.text }]}>MY INFO</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab}>
                    <Text style={[styles.tabText, { color: theme.colors.textSecondary }]}>MY ITEMS</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Progress Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Progress</Text>
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressCircle, { borderColor: theme.colors.border, borderLeftColor: theme.colors.primary }]}>
                            <View style={styles.progressCircleInner}>
                                <Ionicons name="scale-outline" size={32} color={theme.colors.text} />
                                <Text style={[styles.weightLostText, { color: theme.colors.text }]}>
                                    {isImperialUnits
                                        ? `${Math.round(kgToLbs(profileData.weightLost) * 10) / 10} lbs lost`
                                        : `${profileData.weightLost} kg lost`}
                                </Text>
                                <Text style={[styles.currentWeightText, { color: theme.colors.textSecondary }]}>
                                    Current: {formatWeight(profileData.currentWeight, isImperialUnits)}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.progressLimits}>
                            <Text style={[styles.limitText, { color: theme.colors.textSecondary }]}>
                                {formatWeight(profileData.startingWeight, isImperialUnits)}
                            </Text>
                            <Text style={[styles.limitText, { color: theme.colors.textSecondary }]}>
                                {formatWeight(profileData.goalWeight, isImperialUnits)}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.cardBackground }]}>
                        <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>ADD WEIGHT</Text>
                    </TouchableOpacity>
                </View>

                {/* Goals Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Goals</Text>

                    <View style={styles.goalItem}>
                        <Text style={[styles.goalLabel, { color: theme.colors.text }]}>Weight</Text>
                        <Text style={[styles.goalValue, { color: theme.colors.text }]}>
                            {formatWeight(profileData.goalWeight, isImperialUnits)}
                        </Text>
                    </View>
                    <View style={styles.goalSubItem}>
                        <Text style={[styles.goalSubtext, { color: theme.colors.textSecondary }]}>{profileData.weeklyGoal}</Text>
                    </View>

                    <View style={styles.goalItem}>
                        <Text style={[styles.goalLabel, { color: theme.colors.text }]}>Daily Calories</Text>
                        <Text style={[styles.goalValue, { color: theme.colors.text }]}>
                            {profileData.dailyCalories ? `${profileData.dailyCalories} cal` : "---"}
                        </Text>
                    </View>
                    <View style={styles.goalSubItem}>
                        <Text style={[styles.goalSubtext, { color: theme.colors.textSecondary }]}>Carbs {profileData.macros.carbs}g / Fat {profileData.macros.fat}g / Protein {profileData.macros.protein}g</Text>
                    </View>

                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.cardBackground }]} onPress={goToGoals}>
                        <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>UPDATE GOALS</Text>
                    </TouchableOpacity>
                </View>

                {/* Friends Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Friends</Text>
                    {/* We would add friends list here */}
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Add friends to share progress</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Premium Banner */}
            <TouchableOpacity style={styles.premiumBanner}>
                <LinearGradient
                    colors={['#1E3B70', '#29539B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.premiumBannerGradient}
                >
                    <Text style={[styles.premiumBannerText, { color: theme.colors.text }]}>Go Premium</Text>
                </LinearGradient>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    profileHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginLeft: 16,
    },
    profileImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#3B5998',
    },
    profileInfo: {
        marginLeft: 12,
    },
    username: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    location: {
        fontSize: 16,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    activeTabText: {},
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    progressContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    progressCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 15,
    },
    progressCircleInner: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    weightLostText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    currentWeightText: {
        fontSize: 16,
        marginTop: 4,
    },
    progressLimits: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 8,
    },
    limitText: {
        fontSize: 16,
    },
    actionButton: {
        borderRadius: 4,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    goalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    goalLabel: {
        fontSize: 18,
    },
    goalValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    goalSubItem: {
        marginBottom: 16,
    },
    goalSubtext: {
        fontSize: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyStateText: {
        fontSize: 16,
    },
    premiumBanner: {
        margin: 16,
        borderRadius: 25,
        overflow: 'hidden',
    },
    premiumBannerGradient: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    premiumBannerText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ProfileScreen; 