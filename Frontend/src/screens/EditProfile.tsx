import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    ActivityIndicator,
    Image,
    Dimensions,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Auth, auth } from '../utils/firebase';
import { updateProfile } from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

// Extend the User type to include our custom fields
interface ExtendedUser extends Auth.User {
    age?: number;
    height?: number;
    weight?: number;
}

// Colors from ManualFoodEntry.tsx
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#0074dd';
const GRADIENT_START = '#0074dd';
const GRADIENT_END = '#dd0095';
const GRADIENT_MIDDLE = '#5c00dd';
const GREEN = '#4CAF50';
const ORANGE = '#FF9800';
const PURPLE = '#9C27B0';

const { width, height } = Dimensions.get('window');

const EditProfile = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    // Animation values
    const slideAnim = React.useRef(new Animated.Value(0)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    // Mock profile data
    const [username, setUsername] = useState('haamed_rahman');
    const [height, setHeight] = useState('5 ft 11 in');
    const [age, setAge] = useState(21);
    const [weight, setWeight] = useState('105 kg');
    const [sex, setSex] = useState('Male');
    const [dateOfBirth, setDateOfBirth] = useState('Oct 28, 2003');
    const [location, setLocation] = useState('United States');
    const [timeZone, setTimeZone] = useState('Riyadh');
    const [zipCode, setZipCode] = useState('31311');
    const [units, setUnits] = useState('Kilograms, Feet/Inches, Kilometers, Calories, Milliliters');
    const [email, setEmail] = useState('haamed1.450@gmail.com');

    // Gamification data
    const [level, setLevel] = useState(12);
    const [xp, setXp] = useState(340);
    const [xpToNextLevel, setXpToNextLevel] = useState(500);
    const [rank, setRank] = useState('Silver Athlete');
    const [streakDays, setStreakDays] = useState(8);
    const [achievements, setAchievements] = useState([
        { name: 'Early Bird', description: 'Complete 5 morning workouts', completed: true, icon: 'sunny' },
        { name: 'Consistency King', description: 'Maintain a 7-day streak', completed: true, icon: 'trending-up' },
        { name: 'Weight Warrior', description: 'Lose 5kg', completed: true, icon: 'barbell' },
        { name: 'Marathon Master', description: 'Run 42km total', completed: false, icon: 'walk' },
        { name: 'Nutrition Ninja', description: 'Log meals for 30 days', completed: false, icon: 'nutrition' },
    ]);

    useEffect(() => {
        // Animation on component mount
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        ]).start();

        // Here you would fetch user data from backend
        // For now using static data from state
        if (user) {
            // Update with user data
        }
    }, [user]);

    const renderProfileTab = () => {
        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Profile Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.profileCard}
                >
                    <View style={styles.profileCardContent}>
                        <Image
                            source={require('../../assets/default-avatar.png')}
                            style={styles.profileImage}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{username}</Text>
                            <Text style={styles.profileLocation}>{location}</Text>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{weight}</Text>
                                    <Text style={styles.statLabel}>Weight</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{height}</Text>
                                    <Text style={styles.statLabel}>Height</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{age}</Text>
                                    <Text style={styles.statLabel}>Age</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.editButton}>
                        <Ionicons name="camera-outline" size={20} color={WHITE} />
                        <Text style={styles.editButtonText}>Change Photo</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Form Fields */}
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholderTextColor={GRAY}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={[styles.input, styles.inputDisabled]}
                            value={email}
                            editable={false}
                            placeholderTextColor={GRAY}
                        />
                        <Text style={styles.inputHint}>Email cannot be changed</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sex</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[styles.segmentOption, sex === 'Male' && styles.segmentActive]}
                                onPress={() => setSex('Male')}
                            >
                                <Text style={[styles.segmentText, sex === 'Male' && styles.segmentTextActive]}>Male</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, sex === 'Female' && styles.segmentActive]}
                                onPress={() => setSex('Female')}
                            >
                                <Text style={[styles.segmentText, sex === 'Female' && styles.segmentTextActive]}>Female</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, sex === 'Other' && styles.segmentActive]}
                                onPress={() => setSex('Other')}
                            >
                                <Text style={[styles.segmentText, sex === 'Other' && styles.segmentTextActive]}>Other</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputRow}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.inputLabel}>Height</Text>
                            <TextInput
                                style={styles.input}
                                value={height}
                                onChangeText={setHeight}
                                placeholderTextColor={GRAY}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.inputLabel}>Weight</Text>
                            <TextInput
                                style={styles.input}
                                value={weight}
                                onChangeText={setWeight}
                                placeholderTextColor={GRAY}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Location & Preferences</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Location</Text>
                        <TextInput
                            style={styles.input}
                            value={location}
                            onChangeText={setLocation}
                            placeholderTextColor={GRAY}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Time Zone</Text>
                        <TextInput
                            style={styles.input}
                            value={timeZone}
                            onChangeText={setTimeZone}
                            placeholderTextColor={GRAY}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Measurement Units</Text>
                        <TouchableOpacity style={styles.dropdownField}>
                            <Text style={styles.dropdownText} numberOfLines={1} ellipsizeMode="tail">
                                {units}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={BLUE_ACCENT} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => navigation.goBack()}
                >
                    <LinearGradient
                        colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderAchievementsTab = () => {
        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Level Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.levelCard}
                >
                    <View style={styles.levelHeader}>
                        <View>
                            <Text style={styles.levelTitle}>Level {level}</Text>
                            <Text style={styles.levelRank}>{rank}</Text>
                        </View>
                        <View style={styles.streakContainer}>
                            <Ionicons name="flame" size={24} color={ORANGE} />
                            <Text style={styles.streakText}>{streakDays} day streak</Text>
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${(xp / xpToNextLevel) * 100}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>{xp} / {xpToNextLevel} XP</Text>
                    </View>
                </LinearGradient>

                {/* Achievements */}
                <View style={styles.achievementsSection}>
                    <Text style={styles.sectionTitle}>Achievements</Text>

                    {achievements.map((achievement, index) => (
                        <View key={index} style={styles.achievementItem}>
                            <View style={[
                                styles.achievementIcon,
                                achievement.completed ? styles.achievementCompleted : styles.achievementLocked
                            ]}>
                                <Ionicons
                                    name={achievement.icon as any}
                                    size={24}
                                    color={achievement.completed ? WHITE : GRAY}
                                />
                            </View>
                            <View style={styles.achievementInfo}>
                                <Text style={styles.achievementName}>{achievement.name}</Text>
                                <Text style={styles.achievementDesc}>{achievement.description}</Text>
                            </View>
                            {achievement.completed ? (
                                <Ionicons name="checkmark-circle" size={24} color={GREEN} />
                            ) : (
                                <Ionicons name="lock-closed" size={24} color={GRAY} />
                            )}
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.goalsButton}
                    onPress={() => navigation.navigate('Goals')}
                >
                    <LinearGradient
                        colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.goalsButtonGradient}
                    >
                        <Text style={styles.goalsButtonText}>Set Fitness Goals</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 28 }}></View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
                    onPress={() => setActiveTab('profile')}
                >
                    <Ionicons
                        name="person"
                        size={24}
                        color={activeTab === 'profile' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'profile' && styles.activeTabText
                        ]}
                    >
                        Profile
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
                    onPress={() => setActiveTab('achievements')}
                >
                    <Ionicons
                        name="trophy"
                        size={24}
                        color={activeTab === 'achievements' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'achievements' && styles.activeTabText
                        ]}
                    >
                        Achievements
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {activeTab === 'profile' ? renderProfileTab() : renderAchievementsTab()}
            </ScrollView>
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
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: GRADIENT_MIDDLE,
    },
    tabText: {
        color: GRAY,
        fontSize: 16,
        marginLeft: 8,
    },
    activeTabText: {
        color: GRADIENT_MIDDLE,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    tabContent: {
        padding: 16,
    },
    profileCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    profileCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: WHITE,
    },
    profileInfo: {
        marginLeft: 20,
        flex: 1,
    },
    profileName: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    profileLocation: {
        color: WHITE,
        fontSize: 16,
        opacity: 0.8,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    statLabel: {
        color: WHITE,
        fontSize: 12,
        opacity: 0.8,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        paddingVertical: 8,
    },
    editButtonText: {
        color: WHITE,
        marginLeft: 8,
        fontWeight: '600',
    },
    formSection: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        color: GRAY,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    inputDisabled: {
        opacity: 0.7,
    },
    inputHint: {
        color: GRAY,
        fontSize: 12,
        marginTop: 4,
    },
    inputRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        overflow: 'hidden',
    },
    segmentOption: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    segmentText: {
        color: GRAY,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: WHITE,
    },
    dropdownField: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
    },
    saveButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginVertical: 20,
    },
    saveButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    levelCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    levelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    levelTitle: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
    },
    levelRank: {
        color: WHITE,
        fontSize: 16,
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 152, 0, 0.2)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    streakText: {
        color: ORANGE,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    progressContainer: {
        marginTop: 8,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: WHITE,
        borderRadius: 4,
    },
    progressText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        textAlign: 'right',
        marginTop: 4,
    },
    achievementsSection: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    achievementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(28, 28, 30, 0.6)',
        borderRadius: 12,
        padding: 12,
    },
    achievementIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    achievementCompleted: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    achievementLocked: {
        backgroundColor: LIGHT_GRAY,
    },
    achievementInfo: {
        flex: 1,
    },
    achievementName: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    achievementDesc: {
        color: GRAY,
        fontSize: 14,
    },
    goalsButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginVertical: 20,
    },
    goalsButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    goalsButtonText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default EditProfile;
