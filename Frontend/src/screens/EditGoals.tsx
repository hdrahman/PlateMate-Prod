import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    ActivityIndicator,
    Animated,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

// Constants for colors - matching EditProfile
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#0074dd';
const GRADIENT_START = '#0074dd';
const GRADIENT_MIDDLE = '#5c00dd';
const GRADIENT_END = '#dd0095';
const GREEN = '#4CAF50';
const ORANGE = '#FF9800';
const PURPLE = '#9C27B0';
const PINK = '#FF00F5';

const { width } = Dimensions.get('window');

interface GoalsData {
    targetWeight?: number;
    calorieGoal?: number;
    proteinGoal?: number;
    carbGoal?: number;
    fatGoal?: number;
    fitnessGoal?: string;
    activityLevel?: string;
    weeklyWorkouts?: number;
    stepGoal?: number;
    waterGoal?: number;
    sleepGoal?: number;
}

// Create a GradientBorder component for form sections
const GradientBorderBox = ({ children, style }: { children: React.ReactNode, style?: any }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
            />
            <View style={[styles.gradientBorderInner, style]}>
                {children}
            </View>
        </View>
    );
};

export default function EditGoals() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('nutrition');
    const [isLoading, setIsLoading] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Nutrition goals
    const [targetWeight, setTargetWeight] = useState('');
    const [calorieGoal, setCalorieGoal] = useState('');
    const [proteinGoal, setProteinGoal] = useState('');
    const [carbGoal, setCarbGoal] = useState('');
    const [fatGoal, setFatGoal] = useState('');
    const [fitnessGoal, setFitnessGoal] = useState('maintain');
    const [activityLevel, setActivityLevel] = useState('moderate');

    // Fitness goals
    const [weeklyWorkouts, setWeeklyWorkouts] = useState('4');
    const [stepGoal, setStepGoal] = useState('10000');
    const [waterGoal, setWaterGoal] = useState('2000');
    const [sleepGoal, setSleepGoal] = useState('8');

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

        // Fetch user's goals
        const fetchUserGoals = async () => {
            try {
                // In a real app, you would get this from Firestore or another database
                // For demonstration, we'll use placeholder data
                const userData = {
                    targetWeight: 70,
                    calorieGoal: 2000,
                    proteinGoal: 150,
                    carbGoal: 200,
                    fatGoal: 65,
                    fitnessGoal: 'maintain',
                    activityLevel: 'moderate',
                    weeklyWorkouts: 4,
                    stepGoal: 10000,
                    waterGoal: 2000,
                    sleepGoal: 8
                };

                setTargetWeight(userData.targetWeight?.toString() || '');
                setCalorieGoal(userData.calorieGoal?.toString() || '');
                setProteinGoal(userData.proteinGoal?.toString() || '');
                setCarbGoal(userData.carbGoal?.toString() || '');
                setFatGoal(userData.fatGoal?.toString() || '');
                setFitnessGoal(userData.fitnessGoal || 'maintain');
                setActivityLevel(userData.activityLevel || 'moderate');
                setWeeklyWorkouts(userData.weeklyWorkouts?.toString() || '4');
                setStepGoal(userData.stepGoal?.toString() || '10000');
                setWaterGoal(userData.waterGoal?.toString() || '2000');
                setSleepGoal(userData.sleepGoal?.toString() || '8');
            } catch (error) {
                console.error('Error fetching user goals', error);
            }
        };

        if (user) {
            fetchUserGoals();
        }
    }, [user]);

    const handleSave = async () => {
        setIsLoading(true);

        try {
            const goalsData: GoalsData = {
                targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
                calorieGoal: calorieGoal ? parseInt(calorieGoal) : undefined,
                proteinGoal: proteinGoal ? parseInt(proteinGoal) : undefined,
                carbGoal: carbGoal ? parseInt(carbGoal) : undefined,
                fatGoal: fatGoal ? parseInt(fatGoal) : undefined,
                fitnessGoal,
                activityLevel,
                weeklyWorkouts: weeklyWorkouts ? parseInt(weeklyWorkouts) : undefined,
                stepGoal: stepGoal ? parseInt(stepGoal) : undefined,
                waterGoal: waterGoal ? parseInt(waterGoal) : undefined,
                sleepGoal: sleepGoal ? parseInt(sleepGoal) : undefined,
            };

            // In a real app, you would save this to Firestore or another database
            // Simulate saving data
            await new Promise(resolve => setTimeout(resolve, 1000));

            Alert.alert('Success', 'Fitness goals updated successfully');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update goals. Please try again.');
            console.error('Goals update error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderNutritionTab = () => {
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
                {/* Summary Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={styles.summaryTitle}>Nutrition Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{calorieGoal || '0'}</Text>
                                <Text style={styles.statLabel}>Calories/day</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{targetWeight || '0'} kg</Text>
                                <Text style={styles.statLabel}>Target Weight</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Weight & Calorie Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Weight & Calorie Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Target Weight (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={targetWeight}
                            onChangeText={setTargetWeight}
                            placeholder="Enter target weight"
                            placeholderTextColor={GRAY}
                            keyboardType="decimal-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={calorieGoal}
                            onChangeText={setCalorieGoal}
                            placeholder="Enter calorie goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Macronutrient Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Macronutrient Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Protein (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={proteinGoal}
                            onChangeText={setProteinGoal}
                            placeholder="Enter protein goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={carbGoal}
                            onChangeText={setCarbGoal}
                            placeholder="Enter carb goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Fat (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={fatGoal}
                            onChangeText={setFatGoal}
                            placeholder="Enter fat goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Activity Profile */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Activity Profile</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Fitness Goal</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[styles.segmentOption, fitnessGoal === 'lose' && styles.segmentActive]}
                                onPress={() => setFitnessGoal('lose')}
                            >
                                <Text style={[styles.segmentText, fitnessGoal === 'lose' && styles.segmentTextActive]}>
                                    Lose Weight
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, fitnessGoal === 'maintain' && styles.segmentActive]}
                                onPress={() => setFitnessGoal('maintain')}
                            >
                                <Text style={[styles.segmentText, fitnessGoal === 'maintain' && styles.segmentTextActive]}>
                                    Maintain
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, fitnessGoal === 'gain' && styles.segmentActive]}
                                onPress={() => setFitnessGoal('gain')}
                            >
                                <Text style={[styles.segmentText, fitnessGoal === 'gain' && styles.segmentTextActive]}>
                                    Gain Weight
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Activity Level</Text>
                        <View style={styles.dropdownField}>
                            <Text style={styles.dropdownText}>{getActivityLevelLabel(activityLevel)}</Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
                        </View>
                    </View>
                </GradientBorderBox>
            </Animated.View>
        );
    };

    const renderFitnessTab = () => {
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
                {/* Summary Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryContent}>
                        <Text style={styles.summaryTitle}>Fitness Goals</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{weeklyWorkouts || '0'}</Text>
                                <Text style={styles.statLabel}>Workouts/week</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stepGoal || '0'}</Text>
                                <Text style={styles.statLabel}>Daily Steps</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* Workout Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Workout Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Weekly Workouts</Text>
                        <TextInput
                            style={styles.input}
                            value={weeklyWorkouts}
                            onChangeText={setWeeklyWorkouts}
                            placeholder="Workouts per week"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Step Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={stepGoal}
                            onChangeText={setStepGoal}
                            placeholder="Target daily steps"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>

                {/* Health Goals */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Health Goals</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Daily Water Intake (ml)</Text>
                        <TextInput
                            style={styles.input}
                            value={waterGoal}
                            onChangeText={setWaterGoal}
                            placeholder="Water intake goal"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sleep Goal (hours)</Text>
                        <TextInput
                            style={styles.input}
                            value={sleepGoal}
                            onChangeText={setSleepGoal}
                            placeholder="Target sleep hours"
                            placeholderTextColor={GRAY}
                            keyboardType="number-pad"
                        />
                    </View>
                </GradientBorderBox>
            </Animated.View>
        );
    };

    // Helper function to get activity level label
    const getActivityLevelLabel = (value: string) => {
        const labels: Record<string, string> = {
            'sedentary': 'Sedentary (office job)',
            'light': 'Light Activity (1-2 days/week)',
            'moderate': 'Moderate Activity (3-5 days/week)',
            'active': 'Very Active (6-7 days/week)',
            'athletic': 'Athletic (2x per day)'
        };
        return labels[value] || 'Select activity level';
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['rgba(92, 0, 221, 0.3)', 'transparent']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Fitness Goals</Text>
                <View style={{ width: 28 }}></View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'nutrition' && styles.activeTab]}
                    onPress={() => setActiveTab('nutrition')}
                >
                    <Ionicons
                        name="nutrition"
                        size={24}
                        color={activeTab === 'nutrition' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'nutrition' && styles.activeTabText
                        ]}
                    >
                        Nutrition
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'fitness' && styles.activeTab]}
                    onPress={() => setActiveTab('fitness')}
                >
                    <Ionicons
                        name="barbell"
                        size={24}
                        color={activeTab === 'fitness' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'fitness' && styles.activeTabText
                        ]}
                    >
                        Fitness
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {activeTab === 'nutrition' ? renderNutritionTab() : renderFitnessTab()}

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={WHITE} />
                    ) : (
                        <LinearGradient
                            colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveButtonGradient}
                        >
                            <Text style={styles.saveButtonText}>Save Goals</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

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
    summaryCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    summaryContent: {
        alignItems: 'center',
    },
    summaryTitle: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    summaryStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    statItem: {
        alignItems: 'center',
        padding: 10,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 20,
    },
    statValue: {
        color: WHITE,
        fontSize: 22,
        fontWeight: 'bold',
    },
    statLabel: {
        color: WHITE,
        fontSize: 14,
        opacity: 0.8,
    },
    gradientBorderContainer: {
        marginBottom: 20,
        borderRadius: 16,
        position: 'relative',
        padding: 2,
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    gradientBorderInner: {
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 16,
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
        marginHorizontal: 16,
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
});
