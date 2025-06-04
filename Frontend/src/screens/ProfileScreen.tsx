import React, { useState, useEffect } from 'react';
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
import { getUserProfileByFirebaseUid, getUserGoals } from '../utils/database';

// Colors from ManualFoodEntry.tsx
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#2196F3';

const ProfileScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

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
        // Here you would fetch user data from backend
        const fetchUserProfile = async () => {
            if (!user) return;

            try {
                // Get user profile from local database
                const profile = await getUserProfileByFirebaseUid(user.uid);

                // Get user goals from the database to get the calorie goal
                const userGoals = await getUserGoals(user.uid);

                if (profile) {
                    // Update profile data with fetched information
                    setProfileData(prevData => ({
                        ...prevData,
                        goalWeight: profile.target_weight || 0,
                        dailyCalories: userGoals?.calorieGoal || 0,
                        // Update other fields as needed
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <View style={styles.profileHeaderContainer}>
                    <Image
                        source={require('../../assets/default-avatar.png')}
                        style={styles.profileImage}
                        defaultSource={require('../../assets/default-avatar.png')}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.username}>{profileData.username}</Text>
                        <Text style={styles.location}>{profileData.location}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={goToSettings}>
                    <Ionicons name="settings-outline" size={28} color={WHITE} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, styles.activeTab]}>
                    <Text style={[styles.tabText, styles.activeTabText]}>MY INFO</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab}>
                    <Text style={styles.tabText}>MY ITEMS</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Progress Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Progress</Text>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressCircle}>
                            <View style={styles.progressCircleInner}>
                                <Ionicons name="scale-outline" size={32} color={WHITE} />
                                <Text style={styles.weightLostText}>{profileData.weightLost} kg lost</Text>
                                <Text style={styles.currentWeightText}>Current: {profileData.currentWeight} kg</Text>
                            </View>
                        </View>
                        <View style={styles.progressLimits}>
                            <Text style={styles.limitText}>{profileData.startingWeight}</Text>
                            <Text style={styles.limitText}>{profileData.goalWeight}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>ADD WEIGHT</Text>
                    </TouchableOpacity>
                </View>

                {/* Goals Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Goals</Text>

                    <View style={styles.goalItem}>
                        <Text style={styles.goalLabel}>Weight</Text>
                        <Text style={styles.goalValue}>{profileData.goalWeight} kg</Text>
                    </View>
                    <View style={styles.goalSubItem}>
                        <Text style={styles.goalSubtext}>{profileData.weeklyGoal}</Text>
                    </View>

                    <View style={styles.goalItem}>
                        <Text style={styles.goalLabel}>Daily Calories</Text>
                        <Text style={styles.goalValue}>
                            {profileData.dailyCalories ? `${profileData.dailyCalories} cal` : "---"}
                        </Text>
                    </View>
                    <View style={styles.goalSubItem}>
                        <Text style={styles.goalSubtext}>Carbs {profileData.macros.carbs}g / Fat {profileData.macros.fat}g / Protein {profileData.macros.protein}g</Text>
                    </View>

                    <TouchableOpacity style={styles.actionButton} onPress={goToGoals}>
                        <Text style={styles.actionButtonText}>UPDATE GOALS</Text>
                    </TouchableOpacity>
                </View>

                {/* Friends Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Friends</Text>
                    {/* We would add friends list here */}
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>Add friends to share progress</Text>
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
                    <Text style={styles.premiumBannerText}>Go Premium</Text>
                </LinearGradient>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

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
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
    },
    location: {
        color: GRAY,
        fontSize: 16,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: BLUE_ACCENT,
    },
    tabText: {
        color: GRAY,
        fontSize: 16,
        fontWeight: 'bold',
    },
    activeTabText: {
        color: WHITE,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: WHITE,
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
        borderColor: '#333',
        borderLeftColor: BLUE_ACCENT,
    },
    progressCircleInner: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    weightLostText: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    currentWeightText: {
        color: GRAY,
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
        color: GRAY,
        fontSize: 16,
    },
    actionButton: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 4,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    actionButtonText: {
        color: BLUE_ACCENT,
        fontSize: 16,
        fontWeight: 'bold',
    },
    goalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    goalLabel: {
        color: WHITE,
        fontSize: 18,
    },
    goalValue: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    goalSubItem: {
        marginBottom: 16,
    },
    goalSubtext: {
        color: GRAY,
        fontSize: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyStateText: {
        color: GRAY,
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
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ProfileScreen; 