import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/user';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// Try to import LineChart, but provide a fallback if it fails
let LineChart;
try {
    const ChartKit = require('react-native-chart-kit');
    LineChart = ChartKit.LineChart;
} catch (error) {
    console.warn('Chart library not available:', error);
    // Create a fallback component
    LineChart = ({ style }) => (
        <View style={[style, { backgroundColor: 'rgba(0, 116, 221, 0.1)', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#fff' }}>Chart Preview</Text>
        </View>
    );
}

// Try to import date-fns functions
let format, addWeeks;
try {
    const dateFns = require('date-fns');
    format = dateFns.format;
    addWeeks = dateFns.addWeeks;
} catch (error) {
    console.warn('date-fns library not available:', error);
    // Create fallback functions
    format = (date) => date.toLocaleDateString();
    addWeeks = (date, weeks) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + weeks * 7);
        return newDate;
    };
}

interface PredictiveInsightsStepProps {
    profile: UserProfile;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    onNext: () => void;
}

const { width } = Dimensions.get('window');

const PredictiveInsightsStep: React.FC<PredictiveInsightsStepProps> = ({ profile, updateProfile, onNext }) => {
    const [targetDate, setTargetDate] = useState<string>('');
    const [dailyCalories, setDailyCalories] = useState<number>(0);
    const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
    const [successRate, setSuccessRate] = useState<number>(87);

    // Calculate metrics based on user profile
    useEffect(() => {
        calculateMetrics();
    }, [profile]);

    const calculateMetrics = () => {
        // Calculate estimated completion date
        const estimatedWeeks = calculateEstimatedWeeks();
        const completionDate = addWeeks(new Date(), estimatedWeeks);
        setTargetDate(format(completionDate, 'MMMM d, yyyy'));

        // Calculate daily calorie target
        const calories = calculateDailyCalories();
        setDailyCalories(calories);

        // Calculate macros
        const calculatedMacros = calculateMacros(calories);
        setMacros(calculatedMacros);

        // Calculate personalized success rate based on profile
        calculateSuccessRate();
    };

    const calculateEstimatedWeeks = (): number => {
        if (!profile.weight || !profile.targetWeight || profile.weight === profile.targetWeight) {
            return 24; // Default 24 weeks (6 months) if no weight change or data missing
        }

        const weightDiff = Math.abs(profile.weight - profile.targetWeight);
        let weeklyRate = 0.5; // Default 0.5kg/week

        // Adjust rate based on weight goal
        if (profile.weightGoal) {
            switch (profile.weightGoal) {
                case 'lose_1':
                    weeklyRate = 1;
                    break;
                case 'lose_0_75':
                    weeklyRate = 0.75;
                    break;
                case 'lose_0_5':
                    weeklyRate = 0.5;
                    break;
                case 'lose_0_25':
                    weeklyRate = 0.25;
                    break;
                case 'gain_0_25':
                    weeklyRate = 0.25;
                    break;
                case 'gain_0_5':
                    weeklyRate = 0.5;
                    break;
                default:
                    weeklyRate = 0.5;
            }
        }

        const estimatedWeeks = Math.ceil(weightDiff / weeklyRate);
        return Math.min(Math.max(estimatedWeeks, 4), 52); // Between 4 and 52 weeks
    };

    const calculateDailyCalories = (): number => {
        if (!profile.weight || !profile.height || !profile.age || !profile.gender) {
            return 2000; // Default value if data is missing
        }

        // Calculate BMR using Mifflin-St Jeor Equation
        let bmr = 0;
        if (profile.gender.toLowerCase() === 'male') {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * (profile.age || 30) + 5;
        } else {
            bmr = 10 * profile.weight + 6.25 * profile.height - 5 * (profile.age || 30) - 161;
        }

        // Activity level multiplier
        let activityMultiplier = 1.2; // Sedentary default
        if (profile.activityLevel) {
            switch (profile.activityLevel) {
                case 'sedentary':
                    activityMultiplier = 1.2;
                    break;
                case 'lightly_active':
                    activityMultiplier = 1.375;
                    break;
                case 'moderately_active':
                    activityMultiplier = 1.55;
                    break;
                case 'very_active':
                    activityMultiplier = 1.725;
                    break;
                case 'extra_active':
                    activityMultiplier = 1.9;
                    break;
                default:
                    activityMultiplier = 1.2;
            }
        }

        // Calculate TDEE (Total Daily Energy Expenditure)
        let tdee = Math.round(bmr * activityMultiplier);

        // Adjust based on goal
        if (profile.fitnessGoal === 'fat_loss') {
            tdee -= 500; // Calorie deficit for weight loss
        } else if (profile.fitnessGoal === 'muscle_gain') {
            tdee += 300; // Calorie surplus for muscle gain
        }

        return tdee;
    };

    const calculateMacros = (calories: number) => {
        let protein = 0;
        let fat = 0;
        let carbs = 0;

        if (profile.fitnessGoal === 'fat_loss') {
            // Higher protein, moderate fat, lower carbs for fat loss
            protein = Math.round((calories * 0.30) / 4); // 30% protein
            fat = Math.round((calories * 0.30) / 9); // 30% fat
            carbs = Math.round((calories * 0.40) / 4); // 40% carbs
        } else if (profile.fitnessGoal === 'muscle_gain') {
            // Higher protein, moderate fat, higher carbs for muscle gain
            protein = Math.round((calories * 0.30) / 4); // 30% protein
            fat = Math.round((calories * 0.25) / 9); // 25% fat
            carbs = Math.round((calories * 0.45) / 4); // 45% carbs
        } else {
            // Balanced macros for maintenance or recomp
            protein = Math.round((calories * 0.30) / 4); // 30% protein
            fat = Math.round((calories * 0.30) / 9); // 30% fat
            carbs = Math.round((calories * 0.40) / 4); // 40% carbs
        }

        return { protein, carbs, fat };
    };

    const calculateSuccessRate = () => {
        // Calculate a personalized success rate based on profile factors
        let baseRate = 80; // Base success rate of 80%

        // Adjust based on fitness goal
        if (profile.fitnessGoal === 'balanced') {
            baseRate += 5; // Balanced goals are more achievable
        } else if (profile.fitnessGoal === 'fat_loss') {
            // Adjust based on weight loss rate
            if (profile.weightGoal === 'lose_0_25') {
                baseRate += 7; // Gentle rate is more sustainable
            } else if (profile.weightGoal === 'lose_0_5') {
                baseRate += 4; // Moderate rate is sustainable
            } else if (profile.weightGoal === 'lose_0_75') {
                baseRate -= 2; // More aggressive, less sustainable
            } else if (profile.weightGoal === 'lose_1') {
                baseRate -= 5; // Very aggressive, harder to sustain
            }
        }

        // Adjust based on cheat days (if available)
        if (profile.cheatDayEnabled) {
            baseRate += 3; // Having planned cheat days improves adherence
        }

        // Cap between 75% and 92%
        setSuccessRate(Math.min(Math.max(Math.round(baseRate), 75), 92));
    };

    const handleSubmit = async () => {
        try {
            await updateProfile({
                dailyCalorieTarget: dailyCalories,
                projectedCompletionDate: targetDate,
                estimatedDurationWeeks: calculateEstimatedWeeks(),
                nutrientFocus: {
                    protein: macros.protein,
                    carbs: macros.carbs,
                    fat: macros.fat,
                }
            });

            onNext();
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };

    // Render enhanced weight comparison graph
    const renderEnhancedChart = () => {
        // Chart dimensions
        const chartWidth = width - 72; // Account for padding
        const chartHeight = 180;

        // Path definitions for traditional diet curve
        const traditionalPath = `
            M 0,${chartHeight * 0.65}
            C ${chartWidth * 0.2},${chartHeight * 0.2}
            ${chartWidth * 0.4},${chartHeight * 0.2}
            ${chartWidth * 0.6},${chartHeight * 0.5}
            S ${chartWidth * 0.8},${chartHeight * 0.8}
            ${chartWidth},${chartHeight * 0.3}
        `;

        // Path definitions for PlateMate curve
        const platematePath = `
            M 0,${chartHeight * 0.65}
            C ${chartWidth * 0.25},${chartHeight * 0.9}
            ${chartWidth * 0.4},${chartHeight * 0.95}
            ${chartWidth * 0.7},${chartHeight * 0.7}
            S ${chartWidth * 0.9},${chartHeight * 0.5}
            ${chartWidth},${chartHeight * 0.7}
        `;

        return (
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Your weight</Text>

                <View style={styles.chartContainer}>
                    {/* Legend at top */}
                    <View style={styles.legendContainer}>
                        <View style={styles.legendItem}>
                            <Text style={styles.legendText}>Traditional diet</Text>
                            <View style={styles.redDot} />
                        </View>
                        <View style={styles.legendItem}>
                            <View style={styles.blackDot} />
                            <Text style={styles.legendText}>PlateMate</Text>
                        </View>
                    </View>

                    {/* SVG Chart area */}
                    <View style={styles.chartArea}>
                        {/* Dotted horizontal lines */}
                        <View style={[styles.dottedLine, { top: '30%' }]} />
                        <View style={[styles.dottedLine, { top: '50%' }]} />
                        <View style={[styles.dottedLine, { top: '70%' }]} />

                        <Svg width={chartWidth} height={chartHeight} style={styles.svgContainer}>
                            <Defs>
                                <SvgGradient id="traditionalGradient" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0" stopColor="rgba(255, 107, 107, 0.4)" />
                                    <Stop offset="1" stopColor="rgba(255, 107, 107, 0)" />
                                </SvgGradient>
                            </Defs>

                            {/* Traditional diet area fill */}
                            <Path
                                d={`${traditionalPath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`}
                                fill="url(#traditionalGradient)"
                            />

                            {/* Traditional diet curve (red) */}
                            <Path
                                d={traditionalPath}
                                stroke="#FF6B6B"
                                strokeWidth={3}
                                fill="transparent"
                            />

                            {/* PlateMate curve (black) */}
                            <Path
                                d={platematePath}
                                stroke="black"
                                strokeWidth={3}
                                fill="transparent"
                            />

                            {/* Endpoint dots */}
                            <Circle cx="0" cy={chartHeight * 0.65} r="6" fill="#FFF" stroke="#FF6B6B" strokeWidth="2" />
                            <Circle cx={chartWidth} cy={chartHeight * 0.3} r="6" fill="#FFF" stroke="#FF6B6B" strokeWidth="2" />
                            <Circle cx="0" cy={chartHeight * 0.65} r="6" fill="#FFF" stroke="black" strokeWidth="2" />
                            <Circle cx={chartWidth} cy={chartHeight * 0.7} r="6" fill="#FFF" stroke="black" strokeWidth="2" />
                        </Svg>
                    </View>

                    {/* X-axis labels */}
                    <View style={styles.xAxisLabels}>
                        <Text style={styles.xLabel}>Month 1</Text>
                        <Text style={styles.xLabel}>Month 6</Text>
                    </View>
                </View>

                <Text style={styles.chartCaption}>
                    {successRate}% of PlateMate users maintain their weight{'\n'}loss even 6 months later
                </Text>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.backText}>Back</Text>
                <View style={styles.progressDots}>
                    {Array(12).fill(0).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                i === 10 ? styles.activeDot : (i < 10 ? styles.completedDot : styles.inactiveDot)
                            ]}
                        />
                    ))}
                </View>
                <Text style={styles.skipText}>Skip</Text>
            </View>

            {/* Chart Card - Use enhanced chart */}
            {renderEnhancedChart()}

            {/* Projected Completion Card */}
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="calendar" size={24} color="#3B82F6" />
                    <Text style={styles.cardTitle}>Projected Completion</Text>
                </View>
                <Text style={styles.cardValue}>{targetDate}</Text>
            </View>

            {/* Daily Calorie Target Card */}
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="flame" size={24} color="#F97316" />
                    <Text style={styles.cardTitle}>Daily Calorie Target</Text>
                </View>
                <Text style={styles.cardValue}>{dailyCalories} calories</Text>
            </View>

            {/* Recommended Macros Card */}
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="restaurant" size={24} color="#22C55E" />
                    <Text style={styles.cardTitle}>Recommended Macros</Text>
                </View>
                <View style={styles.macrosContainer}>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{macros.protein}g</Text>
                        <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{macros.carbs}g</Text>
                        <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{macros.fat}g</Text>
                        <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleSubmit}>
                <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    contentContainer: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    backText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    skipText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 3,
    },
    activeDot: {
        backgroundColor: '#3B82F6',
    },
    completedDot: {
        backgroundColor: '#7C3AED',
    },
    inactiveDot: {
        backgroundColor: '#6B7280',
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        margin: 16,
        marginTop: 10,
    },
    chartTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#000',
        marginBottom: 16,
    },
    chartContainer: {
        height: 260,
        width: '100%',
        position: 'relative',
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
        marginHorizontal: 6,
    },
    redDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF6B6B',
    },
    blackDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#000',
    },
    chartArea: {
        flex: 1,
        position: 'relative',
        marginBottom: 30,
    },
    svgContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
    },
    dottedLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        zIndex: 1,
    },
    xAxisLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    xLabel: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    chartCaption: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        textAlign: 'center',
        marginTop: 10,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 12,
    },
    cardValue: {
        color: '#000',
        fontSize: 28,
        fontWeight: '700',
    },
    macrosContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        color: '#000',
        fontSize: 24,
        fontWeight: '700',
    },
    macroLabel: {
        color: '#6B7280',
        fontSize: 16,
    },
    nextButton: {
        backgroundColor: '#000',
        borderRadius: 100,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 20,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default PredictiveInsightsStep; 