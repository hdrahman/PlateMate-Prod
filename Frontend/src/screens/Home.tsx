import React, { useState, useContext, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { G, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useSteps } from '../context/StepContext';
import { getTodayExerciseCalories } from '../utils/database';
import { useAuth } from '../context/AuthContext';
import { getUserProfileByFirebaseUid } from '../utils/database';
import { calculateNutritionGoals, getDefaultNutritionGoals } from '../utils/nutritionCalculator';
import { useFoodLog } from '../context/FoodLogContext';
import { getWeightHistory, WeightEntry, addWeightEntry, clearWeightHistory } from '../api/userApi';

import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as d3Scale from 'd3-scale';
import * as d3Shape from 'd3-shape';
import { ThemeContext } from '../ThemeContext';

const { width } = Dimensions.get('window');
const BASE_WIDTH = 375; // base width for scaling
const scaleFactor = Math.min(width / BASE_WIDTH, 1);
const CIRCLE_SIZE = width * 0.50 * scaleFactor; // scales proportionally
const STROKE_WIDTH = 20;
const OUTLINE_WIDTH = 2; // Width of the purple outline
const SVG_PADDING = OUTLINE_WIDTH * 3; // Extra padding for the SVG
const SVG_SIZE = CIRCLE_SIZE + (SVG_PADDING * 2); // Total SVG size including padding

const MACRO_RING_SIZE = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Default data until we load from user profile
// ─────────────────────────────────────────────────────────────────────────────
const defaultGoals = getDefaultNutritionGoals();

// Cheat day data
const cheatDaysTotal = 7;
const cheatDaysCompleted = 3;
const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100;

// Steps history
const stepsHistory = [
  { date: '11/03', steps: 2400 },
  { date: '12/03', steps: 3700 },
  { date: '02/01', steps: 5000 }
];

// GradientBorderCard component for consistent card styling
interface GradientBorderCardProps {
  children: React.ReactNode;
  style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
  return (
    <View style={styles.gradientBorderContainer}>
      <LinearGradient
        colors={["#0074dd", "#5c00dd", "#dd0095"]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 10,
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <View
        style={{
          margin: 1,
          borderRadius: 9,
          backgroundColor: '#121212', // Fixed dark background for all cards
          padding: 16,
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default function Home() {
  const navigation = useNavigation();
  const { isDarkTheme } = useContext(ThemeContext);
  const { user } = useAuth();
  const { nutrientTotals, refreshLogs, isLoading: foodLogLoading, startWatchingFoodLogs, stopWatchingFoodLogs, lastUpdated, hasError, forceSingleRefresh } = useFoodLog();

  // Keep track of which "page" (card) we are on in the horizontal scroll
  const [activeIndex, setActiveIndex] = useState(0);

  // Add state for user goals from profile
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(defaultGoals.calories);
  const [macroGoals, setMacroGoals] = useState({
    protein: defaultGoals.protein,
    carbs: defaultGoals.carbs,
    fat: defaultGoals.fat
  });
  const [profileLoading, setProfileLoading] = useState(true);

  // Add state for consumed calories and loading
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [remainingCals, setRemainingCals] = useState(dailyCalorieGoal);
  const [percentCons, setPercentCons] = useState(0);
  const [foodLoading, setFoodLoading] = useState(true);

  // Add state for exercise calories and loading
  const [exerciseCalories, setExerciseCalories] = useState(0);
  const [exerciseLoading, setExerciseLoading] = useState(true);

  // Macro state
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fats, setFats] = useState(0);
  const [macrosLoading, setMacrosLoading] = useState(true);

  // Use the step context instead of the hook directly
  const {
    todaySteps,
    stepHistory,
    isAvailable,
    loading: stepsLoading
  } = useSteps();

  // Add state for weight history
  const [weightHistory, setWeightHistory] = useState<Array<{ date: string; weight: number }>>([]);
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightLost, setWeightLost] = useState(0);

  // Add state for temporary today's weight display
  const [showTodayWeight, setShowTodayWeight] = useState(false);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);

  // Load user profile and calculate nutrition goals
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;

      try {
        setProfileLoading(true);
        // Get user profile from local database
        const profile = await getUserProfileByFirebaseUid(user.uid);

        if (profile) {
          // Calculate nutrition goals based on user profile
          const goals = calculateNutritionGoals({
            firstName: profile.first_name,
            lastName: profile.last_name,
            phoneNumber: '',
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activity_level,
            dietaryRestrictions: profile.dietary_restrictions || [],
            foodAllergies: profile.food_allergies || [],
            cuisinePreferences: profile.cuisine_preferences || [],
            spiceTolerance: profile.spice_tolerance,
            weightGoal: profile.weight_goal,
            healthConditions: profile.health_conditions || [],
            dailyCalorieTarget: profile.daily_calorie_target,
            nutrientFocus: profile.nutrient_focus,
            defaultAddress: null,
            preferredDeliveryTimes: [],
            deliveryInstructions: null,
            pushNotificationsEnabled: profile.push_notifications_enabled,
            emailNotificationsEnabled: profile.email_notifications_enabled,
            smsNotificationsEnabled: profile.sms_notifications_enabled,
            marketingEmailsEnabled: profile.marketing_emails_enabled,
            paymentMethods: [],
            billingAddress: null,
            defaultPaymentMethodId: null,
            preferredLanguage: profile.preferred_language || 'en',
            timezone: profile.timezone || 'UTC',
            unitPreference: profile.unit_preference || 'metric',
            darkMode: profile.dark_mode,
            syncDataOffline: profile.sync_data_offline,
            targetWeight: profile.target_weight,
            startingWeight: profile.starting_weight
          });

          // Update state with calculated goals
          setDailyCalorieGoal(goals.calories);
          setMacroGoals({
            protein: goals.protein,
            carbs: goals.carbs,
            fat: goals.fat
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  // Set up food log watching when component mounts
  useEffect(() => {
    console.log('Home screen starting to watch food logs');
    startWatchingFoodLogs();

    // Clean up when component unmounts
    return () => {
      console.log('Home screen stopping food log watch');
      stopWatchingFoodLogs();
    };
  }, [startWatchingFoodLogs, stopWatchingFoodLogs]);

  // Load today's nutrition data from the food log context
  useEffect(() => {
    const loadTodayNutrients = async () => {
      if (profileLoading) return;

      try {
        setFoodLoading(true);
        setMacrosLoading(true);

        // Only refresh logs if needed (first load or when explicitly required)
        if (nutrientTotals.calories === 0) {
          await refreshLogs();
        }

        // Get the nutrition values from the context
        setConsumedCalories(nutrientTotals.calories);
        setProtein(nutrientTotals.protein);
        setCarbs(nutrientTotals.carbs);
        setFats(nutrientTotals.fat);

        // Load exercise calories
        const todayExerciseCals = await getTodayExerciseCalories();
        setExerciseCalories(todayExerciseCals);

        // Calculate remaining calories
        const remaining = dailyCalorieGoal - nutrientTotals.calories + todayExerciseCals;
        setRemainingCals(Math.max(0, Math.round(remaining)));

        // Calculate percent consumed
        const percentConsumed = (nutrientTotals.calories / dailyCalorieGoal) * 100;
        setPercentCons(Math.min(100, Math.round(percentConsumed)));
      } catch (error) {
        console.error('Error loading today nutrients:', error);
      } finally {
        setFoodLoading(false);
        setMacrosLoading(false);
        setExerciseLoading(false);
      }
    };

    loadTodayNutrients();
  }, [profileLoading, dailyCalorieGoal, nutrientTotals, refreshLogs, lastUpdated]);

  // Load weight history only once when the component mounts
  useEffect(() => {
    const loadWeightHistory = async () => {
      if (!user) return;

      try {
        setWeightLoading(true);

        // Get weight history from API
        const history = await getWeightHistory(user.uid);

        if (history && history.weights && history.weights.length > 0) {
          // Sort history chronologically - oldest first
          const sortedWeights = [...history.weights].sort((a, b) =>
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );

          // Format all entries to show the complete weight trend
          const formattedHistory = sortedWeights.map(entry => ({
            date: new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            weight: entry.weight
          }));

          setWeightHistory(formattedHistory);

          // Set starting weight from the first entry
          setStartingWeight(sortedWeights[0].weight);

          // Set current weight from the last entry
          const lastWeight = sortedWeights[sortedWeights.length - 1].weight;
          setCurrentWeight(lastWeight);

          // Check if the last entry is from today
          const lastEntryDate = new Date(sortedWeights[sortedWeights.length - 1].recorded_at);
          const today = new Date();
          const isToday =
            lastEntryDate.getDate() === today.getDate() &&
            lastEntryDate.getMonth() === today.getMonth() &&
            lastEntryDate.getFullYear() === today.getFullYear();

          // If the last entry is not from today, set today's temporary weight
          if (!isToday) {
            setShowTodayWeight(true);
            setTodayWeight(lastWeight);
          }
        }
      } catch (error) {
        console.error('Error loading weight history:', error);
      } finally {
        setWeightLoading(false);
      }
    };

    // We still need user to be available for this to work
    if (user) {
      loadWeightHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Calculate weight lost when profile and weight history are loaded
  useEffect(() => {
    if (!profileLoading && !weightLoading && currentWeight !== null) {
      // If starting_weight is available, use it; otherwise use the first weight entry
      const initialWeight = startingWeight || (weightHistory.length > 0 ? weightHistory[0].weight : currentWeight);

      // Calculate weight lost
      const lost = initialWeight - currentWeight;
      setWeightLost(parseFloat(lost.toFixed(1)));
    }
  }, [profileLoading, weightLoading, currentWeight, startingWeight, weightHistory]);

  // Handle adding new weight
  const handleAddWeight = async () => {
    if (!user || !newWeight) return;

    try {
      const weightValue = parseFloat(newWeight);

      if (isNaN(weightValue) || weightValue <= 0) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight value.');
        return;
      }

      // Check if the weight is different from the current weight
      // Use a small threshold to account for floating-point precision
      const weightChanged = !currentWeight || Math.abs(weightValue - currentWeight) >= 0.01;

      if (weightChanged) {
        // Only add to backend if weight actually changed
        await addWeightEntry(user.uid, weightValue);

        // Update local state with the new entry
        const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

        // Add the new entry to the existing weight history
        const updatedHistory = [...weightHistory, { date: today, weight: weightValue }];
        setWeightHistory(updatedHistory);

        // No need to show temporary today weight anymore
        setShowTodayWeight(false);

        // If this is the first entry, set it as starting weight
        if (weightHistory.length === 0) {
          setStartingWeight(weightValue);
        }
      } else {
        // If weight hasn't changed, just update the UI without adding to history
        console.log('Weight unchanged, not creating new entry');
      }

      // Always update current weight with the new entry
      setCurrentWeight(weightValue);

      setWeightModalVisible(false);
      setNewWeight('');

      // Recalculate weight lost
      if (startingWeight) {
        const lost = startingWeight - weightValue;
        setWeightLost(parseFloat(lost.toFixed(1)));
      }
    } catch (error) {
      console.error('Error adding weight entry:', error);
      Alert.alert('Error', 'Failed to add weight entry. Please try again.');
    }
  };

  // Handler: updates activeIndex when user scrolls horizontally
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    setActiveIndex(newIndex);
  };

  // Calculate values for the main ring.
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedStroke = (percentCons / 100) * circumference;

  // Data for the right card with updated colors.
  const rightStats = [
    { label: 'Goal', value: dailyCalorieGoal, icon: 'flag-outline', color: '#FFB74D' }, // warm orange hue
    {
      label: 'Food',
      value: foodLoading ? '-' : consumedCalories,
      icon: 'restaurant-outline',
      color: '#FF8A65'
    }, // soft red hue
    {
      label: 'Exercise',
      value: exerciseLoading ? '-' : exerciseCalories,
      icon: 'barbell-outline',
      color: '#66BB6A'
    }, // updated green
    {
      label: 'Steps',
      value: stepsLoading ? '-' : todaySteps,
      icon: 'walk',
      iconSet: 'MaterialCommunityIcons',
      color: '#E040FB' // updated purple
    }
  ];

  // Use actual step history from the context
  const formattedStepHistory = stepsLoading ? [] : stepHistory.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
    steps: item.steps
  }));

  // Add error handling UI component at the top of HomeScreen
  const renderErrorBanner = () => {
    if (!hasError) return null;

    return (
      <TouchableOpacity
        style={styles.errorBanner}
        onPress={forceSingleRefresh}
      >
        <Ionicons name="warning-outline" size={20} color="#FFD700" />
        <Text style={styles.errorText}>
          Database connection issue. Tap to retry.
        </Text>
      </TouchableOpacity>
    );
  };

  // Replace the static weight card with dynamic data
  const renderWeightLostCard = () => (
    <GradientBorderCard>
      <View style={styles.burnContainer}>
        <Text style={styles.burnTitle}>Weight Lost</Text>
        <View style={styles.burnBarBackground}>
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            colors={['#006400', '#006400', '#00FF00']} // smoother gradient, first half dark green
            style={[
              styles.burnBarFill,
              {
                width: `${Math.min(
                  (weightLost / (startingWeight && targetWeight ? startingWeight - targetWeight : 10)) * 100,
                  100
                )}%`
              }
            ]} // dynamically adjust width
          />
        </View>
        <View style={styles.weightLabelsContainer}>
          <Text style={styles.weightLabel}>{startingWeight || (weightHistory.length > 0 ? weightHistory[0].weight : '--')} kg</Text>
          <Text style={styles.burnDetails}>{weightLost} Kilograms Lost!</Text> {/* Centered text */}
          <Text style={styles.weightLabel}>{targetWeight || '--'} kg</Text>
        </View>
      </View>
    </GradientBorderCard>
  );

  // Add a modal for entering new weight
  const renderWeightModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={weightModalVisible}
      onRequestClose={() => setWeightModalVisible(false)}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add New Weight</Text>
          <TextInput
            style={styles.weightInput}
            value={newWeight}
            onChangeText={setNewWeight}
            placeholder="Enter weight in kg"
            keyboardType="numeric"
            placeholderTextColor="#888"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setWeightModalVisible(false);
                setNewWeight('');
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleAddWeight}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Add function to clear weight history
  const handleClearWeightHistory = async () => {
    if (!user) return;

    try {
      // Show loading
      setWeightLoading(true);

      // Confirm with user before proceeding
      Alert.alert(
        "Clear Weight History",
        "This will remove all weight entries except your starting and current weights. This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setWeightLoading(false)
          },
          {
            text: "Clear",
            style: "destructive",
            onPress: async () => {
              try {
                // Call API to clear weight history
                await clearWeightHistory(user.uid);

                // Refresh weight history
                const history = await getWeightHistory(user.uid);

                if (history && history.weights && history.weights.length > 0) {
                  // Sort history chronologically - oldest first
                  const sortedWeights = [...history.weights].sort((a, b) =>
                    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
                  );

                  // Format all entries
                  const formattedHistory = sortedWeights.map(entry => ({
                    date: new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
                    weight: entry.weight
                  }));

                  setWeightHistory(formattedHistory);

                  // Update starting and current weights
                  setStartingWeight(sortedWeights[0].weight);
                  const lastWeight = sortedWeights[sortedWeights.length - 1].weight;
                  setCurrentWeight(lastWeight);

                  // Show success message
                  Alert.alert(
                    "Success",
                    "Weight history has been cleared, keeping only your starting and current weights."
                  );
                }
              } catch (error) {
                console.error('Error clearing weight history:', error);
                Alert.alert("Error", "Failed to clear weight history. Please try again.");
              } finally {
                setWeightLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      setWeightLoading(false);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }}>
      {renderErrorBanner()}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* CHEAT DAY CARD */}
        <GradientBorderCard>
          <View style={styles.cheatDayContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cheatDayLabel}>Days until cheat day</Text>
            </View>
            <View style={styles.cheatDayBarBackground}>
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                style={[styles.cheatDayBarFill, { width: `${cheatProgress}%` }]}
              />
            </View>
            <Text style={styles.cheatDayStatus}>
              {cheatDaysCompleted} / {cheatDaysTotal} days
            </Text>
          </View>
        </GradientBorderCard>

        {/* Add space between the cards */}
        <View style={{ height: 4 }} />

        {/* GOAL CARD (Unified circular bar + stats overlay) */}
        <GradientBorderCard>
          <View style={[styles.goalCardContent, { flexDirection: 'row' }]}>
            <View style={styles.ringContainer}>
              <View style={styles.ringGlow} />
              <Svg width={SVG_SIZE} height={SVG_SIZE}>
                <Defs>
                  <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#2E0854" />
                    <Stop offset="50%" stopColor="#9B00FF" />
                    <Stop offset="100%" stopColor="#00CFFF" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="exerciseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#8B0000" />
                    <Stop offset="100%" stopColor="#FFD700" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="eatenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#4B0082" />
                    <Stop offset="100%" stopColor="#8A2BE2" />
                  </SvgLinearGradient>
                </Defs>
                {/* Outer dark grey outline */}
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius + STROKE_WIDTH / 2 + OUTLINE_WIDTH / 2}
                  stroke="#444444"
                  strokeWidth={0}
                  fill="none"
                />
                {/* Inner dark grey outline */}
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius - STROKE_WIDTH / 2 - OUTLINE_WIDTH / 2}
                  stroke="#444444"
                  strokeWidth={0}
                  fill="none"
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#ringGradient)"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference - consumedStroke}
                  strokeLinecap="butt"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`}
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#ringGradient)"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference - consumedStroke}
                  strokeLinecap="round"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`}
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#exerciseGradient)"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference + (exerciseCalories / dailyCalorieGoal) * circumference}
                  strokeLinecap="butt"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`} // 12 o'clock counterclockwise
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#exerciseGradient)"
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference + (exerciseCalories / dailyCalorieGoal) * circumference}
                  strokeLinecap="round"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`} // 12 o'clock counterclockwise
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#eatenGradient)" // Gradient for calories eaten bar
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference - consumedStroke}
                  strokeLinecap="butt"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`}
                />
                <Circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={radius}
                  stroke="url(#eatenGradient)" // Gradient for calories eaten bar
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference - consumedStroke}
                  strokeLinecap="round"
                  transform={`rotate(-90, ${SVG_SIZE / 2}, ${SVG_SIZE / 2})`}
                />
              </Svg>
              <View style={styles.centerTextContainer}>
                <Text style={styles.remainingValue}>{remainingCals}</Text>
                <Text style={styles.remainingLabel}>REMAINING</Text>
              </View>
            </View>
            <View style={[styles.rightCardVertical, { marginTop: 13 }]}>
              {rightStats.map((item) => {
                const IconComponent = item.iconSet === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
                return (
                  <View key={item.label} style={styles.statRowVertical}>
                    <IconComponent name={item.icon as any} size={20} color={item.color} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.statLabel, { color: item.color }]}>{item.label}</Text>
                      <Text style={styles.statValue}>
                        {item.label === 'Steps' && stepsLoading ? (
                          <ActivityIndicator size="small" color="#E040FB" />
                        ) : (
                          item.value
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </GradientBorderCard>

        {/* Add space between the cards */}
        <View style={{ height: 3 }} />

        {/* MACROS CARD */}
        <GradientBorderCard>
          <View style={styles.macrosRow}>
            <MacroRing label="PROTEIN" percent={macrosLoading ? 0 : Math.min(100, (protein / macroGoals.protein) * 100)} current={macrosLoading ? 0 : protein} />
            <MacroRing label="CARBS" percent={macrosLoading ? 0 : Math.min(100, (carbs / macroGoals.carbs) * 100)} current={macrosLoading ? 0 : carbs} />
            <MacroRing label="FATS" percent={macrosLoading ? 0 : Math.min(100, (fats / macroGoals.fat) * 100)} current={macrosLoading ? 0 : fats} />
            <MacroRing
              label="OTHER"
              percent={100}
              current={0}
              onPress={() => navigation.navigate('Nutrients' as never)}
            />
          </View>
        </GradientBorderCard>

        {/* Add space between the cards */}
        <View style={{ height: 3 }} />

        {/* WEIGHT LOST CARD */}
        {renderWeightLostCard()}

        {/* HORIZONTALLY SCROLLABLE TREND CARDS */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          snapToInterval={width}
          decelerationRate="fast"
          snapToAlignment="center"
        >
          {/* WEIGHT TREND CARD */}
          <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
            <GradientBorderCard>
              <View style={styles.trendContainer}>
                <WeightGraph
                  data={weightHistory}
                  onAddPress={() => setWeightModalVisible(true)}
                  weightLoading={weightLoading}
                  showTodayWeight={showTodayWeight}
                  todayWeight={todayWeight}
                />
              </View>
            </GradientBorderCard>
          </View>

          {/* STEPS TREND CARD */}
          <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
            <GradientBorderCard>
              <View style={styles.trendContainer}>
                {stepsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#E040FB" />
                    <Text style={styles.loadingText}>Loading step data...</Text>
                  </View>
                ) : (
                  <StepsGraph data={formattedStepHistory.length > 0 ? formattedStepHistory : stepsHistory} />
                )}
              </View>
            </GradientBorderCard>
          </View>
        </ScrollView>

        {/* PAGINATION DOTS */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, activeIndex === 0 && styles.dotActive]} />
          <View style={[styles.dot, activeIndex === 1 && styles.dotActive]} />
        </View>

        {/* EXPLORE BUTTON */}
        <GradientBorderCard>
          <TouchableOpacity
            style={styles.exploreButtonInner}
            onPress={() => navigation.navigate('Explore' as never)}
          >
            <MaskedView
              style={{ height: 30, width: '100%' }}
              maskElement={
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Ionicons name="compass" size={22} color="black" style={{ marginRight: 8 }} />
                  <Text style={[styles.exploreButtonText, { color: 'black' }]}>Explore Content</Text>
                </View>
              }
            >
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                style={{ flex: 1 }}
              />
            </MaskedView>
          </TouchableOpacity>
        </GradientBorderCard>
      </ScrollView>
      {renderWeightModal()}
    </SafeAreaView>
  );
}

/************************************
 *  WEIGHT GRAPH COMPONENT
 ************************************/
function WeightGraph({ data, onAddPress, weightLoading, showTodayWeight, todayWeight }: { data: { date: string; weight: number }[]; onAddPress: () => void; weightLoading: boolean; showTodayWeight: boolean; todayWeight: number | null }) {
  // Dimensions for the chart
  const GRAPH_WIDTH = 0.94 * width;
  const GRAPH_HEIGHT = 220;
  const MARGIN = 30; // a bit bigger margin for labels

  // Create a combined dataset that includes history and today's temporary point if needed
  const combinedData = [...data];

  // Add today's temporary weight point if needed
  if (showTodayWeight && todayWeight !== null && data.length > 0) {
    combinedData.push({
      date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      weight: todayWeight
    });
  }

  // X-values: indices of data
  const xValues = combinedData.map((_, i) => i);
  // Y-values: actual weight
  const yValues = combinedData.map(d => d.weight);

  // Build scales
  const minWeight = Math.min(...yValues, ...yValues.map(w => w - 0.5)); // Add a bit of padding at bottom
  const maxWeight = Math.max(...yValues, ...yValues.map(w => w + 0.5)); // Add a bit of padding at top

  // Add a small buffer so points aren't at the very edges
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minWeight, maxWeight])
    .range([GRAPH_HEIGHT - MARGIN, MARGIN]);

  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN, GRAPH_WIDTH - MARGIN]);

  // Get appropriate number of Y ticks based on range
  const yTickCount = Math.min(5, Math.ceil((maxWeight - minWeight) * 2));
  const yTickValues = d3Scale.scaleLinear().domain([minWeight, maxWeight]).ticks(yTickCount);

  // Straight lines between points
  const lineGenerator = d3Shape
    .line<{ date: string; weight: number }>()
    .x((d, i) => scaleX(i))
    .y(d => scaleY(d.weight))
    .curve(d3Shape.curveCatmullRom.alpha(0.5));

  const areaGenerator = d3Shape
    .area<{ date: string; weight: number }>()
    .x((d, i) => scaleX(i))
    .y0(GRAPH_HEIGHT - MARGIN) // Bottom of the graph
    .y1(d => scaleY(d.weight))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the line curve

  const pathData = lineGenerator(combinedData);
  const areaData = areaGenerator(combinedData);

  // Select a subset of x-axis labels to prevent crowding
  const shouldShowLabel = (i: number) => {
    if (combinedData.length <= 5) return true; // Show all labels if 5 or fewer points
    if (i === 0 || i === combinedData.length - 1) return true; // Always show first and last
    return i % Math.ceil(combinedData.length / 5) === 0; // Show approximately 5 labels total
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingBottom: 5 }}>
      {/* TITLE + PLUS ICON + CLEAR BUTTON */}
      <View
        style={{
          width: '90%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: -10 // was 5
        }}
      >
        <Text style={styles.weightGraphTitle}>Weight Trend:</Text>
        <TouchableOpacity onPress={onAddPress}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* SCROLLABLE CHART */}
      {weightLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E040FB" />
          <Text style={styles.loadingText}>Loading weight data...</Text>
        </View>
      ) : combinedData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No weight data available yet.</Text>
          <Text style={styles.emptySubtext}>Tap the + button to add your weight.</Text>
        </View>
      ) : (
        <ScrollView horizontal style={{ width: '100%' }} showsHorizontalScrollIndicator={false}>
          <Svg width={Math.max(GRAPH_WIDTH, combinedData.length * 60)} height={GRAPH_HEIGHT} style={{ backgroundColor: 'transparent' }}>
            {/* ───────── GRID + AXES ───────── */}
            <G>
              {/* Horizontal grid + Y labels */}
              {yTickValues.map((tickValue) => {
                const yCoord = scaleY(tickValue);
                return (
                  <React.Fragment key={`y-tick-${tickValue}`}>
                    <SvgLine
                      x1={MARGIN}
                      x2={GRAPH_WIDTH - MARGIN}
                      y1={yCoord}
                      y2={yCoord}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={MARGIN - 5}
                      y={yCoord}
                      fill="#FFF"
                      fontSize={10}
                      textAnchor="end"
                      alignmentBaseline="middle"
                    >
                      {tickValue.toFixed(1)}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Vertical grid + X labels */}
              {combinedData.map((d, i) => {
                const xCoord = scaleX(i);
                return (
                  <React.Fragment key={`x-tick-${i}`}>
                    <SvgLine
                      x1={xCoord}
                      x2={xCoord}
                      y1={GRAPH_HEIGHT - MARGIN}
                      y2={MARGIN}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={1}
                    />
                    {shouldShowLabel(i) && (
                      <SvgText
                        x={xCoord}
                        y={GRAPH_HEIGHT - MARGIN / 2}
                        fill="#FFF"
                        fontSize={10}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {d.date}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </G>

            {/* ───────── LINE + POINTS ───────── */}
            <G>
              {/* Area fill under the curve */}
              {areaData && (
                <Path
                  d={areaData}
                  fill="url(#areaGradient)"
                  opacity={0.15}
                />
              )}

              {/* Define gradients */}
              <Defs>
                <SvgLinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#FF6347" />
                  <Stop offset="100%" stopColor="#FF8C00" />
                </SvgLinearGradient>
                <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FF6347" />
                  <Stop offset="100%" stopColor="#FF6347" stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>

              {pathData && (
                <Path
                  d={pathData}
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth={3.5}   // Slightly thicker
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {combinedData.map((d, i) => {
                const cx = scaleX(i);
                const cy = scaleY(d.weight);
                const isTodayPoint = showTodayWeight && i === combinedData.length - 1 && i > 0;

                // Only render dots for certain points to reduce visual clutter
                if (isTodayPoint || i === 0 || i === combinedData.length - 1 || i % 3 === 0) {
                  return (
                    <Circle
                      key={`circle-${i}`}
                      cx={cx}
                      cy={cy}
                      r={isTodayPoint ? 3.5 : 2}  // Even smaller dots
                      fill={isTodayPoint ? "#00CFFF" : "rgba(255,69,0,0.4)"}  // More transparent
                      stroke={isTodayPoint ? "#FFF" : "rgba(255,255,255,0.4)"}
                      strokeWidth={isTodayPoint ? 1 : 0.3}  // Thinner stroke
                      strokeDasharray={isTodayPoint ? "2,2" : ""}
                    />
                  );
                }
                return null;
              })}

              {/* Add a label for today's temporary point if it exists */}
              {showTodayWeight && combinedData.length > 1 && (
                <SvgText
                  x={scaleX(combinedData.length - 1)}
                  y={scaleY(combinedData[combinedData.length - 1].weight) - 10}
                  fill="#00CFFF"
                  fontSize={10}
                  textAnchor="middle"
                >
                  Today
                </SvgText>
              )}
            </G>
          </Svg>
        </ScrollView>
      )}
    </View>
  );
}

/************************************
 *  STEPS GRAPH COMPONENT (Second Card)
 ************************************/
function StepsGraph({ data }: { data: { date: string; steps: number }[] }) {
  const GRAPH_WIDTH = 0.9 * width;
  const GRAPH_HEIGHT = 200;
  const MARGIN = 30;

  // X-values
  const xValues = data.map((_, i) => i);
  // Y-values: steps
  const yValues = data.map(d => d.steps);

  const minSteps = Math.min(...yValues);
  const maxSteps = Math.max(...yValues);

  // buffer to avoid top cutoff
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minSteps, maxSteps + 500])
    .range([GRAPH_HEIGHT - MARGIN, MARGIN]);

  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN, GRAPH_WIDTH - MARGIN]);

  // Ticks
  const yTickValues = d3Scale.scaleLinear().domain([minSteps, maxSteps + 500]).ticks(5);

  // Straight lines
  const lineGenerator = d3Shape
    .line<{ date: string; steps: number }>()
    .x((d, i) => scaleX(i))
    .y(d => scaleY(d.steps))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the WeightGraph curve type

  const areaGenerator = d3Shape
    .area<{ date: string; steps: number }>()
    .x((d, i) => scaleX(i))
    .y0(GRAPH_HEIGHT - MARGIN) // Bottom of the graph
    .y1(d => scaleY(d.steps))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the line curve

  const pathData = lineGenerator(data);
  const areaData = areaGenerator(data);

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingBottom: 5 }}>
      <View
        style={{
          width: '90%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: -10 // was 5
        }}
      >
        <Text style={styles.weightGraphTitle}>Steps Trend:</Text>
        <TouchableOpacity onPress={() => console.log('Add more steps!')}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={{ width: '100%' }} showsHorizontalScrollIndicator={false}>
        <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} style={{ backgroundColor: 'transparent' }}>
          <G>
            {/* Horizontal grid + Y labels */}
            {yTickValues.map((tickValue) => {
              const yCoord = scaleY(tickValue);
              return (
                <React.Fragment key={`steps-y-${tickValue}`}>
                  <SvgLine
                    x1={MARGIN}
                    x2={GRAPH_WIDTH - MARGIN}
                    y1={yCoord}
                    y2={yCoord}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={MARGIN - 5}
                    y={yCoord}
                    fill="#FFF"
                    fontSize={10}
                    textAnchor="end"
                    alignmentBaseline="middle"
                  >
                    {tickValue}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {/* Vertical grid + X labels */}
            {data.map((d, i) => {
              const xCoord = scaleX(i);
              return (
                <React.Fragment key={`steps-x-${i}`}>
                  <SvgLine
                    x1={xCoord}
                    x2={xCoord}
                    y1={GRAPH_HEIGHT - MARGIN}
                    y2={MARGIN}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={xCoord}
                    y={GRAPH_HEIGHT - MARGIN / 2}
                    fill="#FFF"
                    fontSize={10}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {d.date}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </G>

          {/* Steps line + points */}
          <G>
            {/* Area fill under the curve */}
            {areaData && (
              <Path
                d={areaData}
                fill="url(#stepsAreaGradient)"
                opacity={0.15}
              />
            )}

            {/* Define gradients */}
            <Defs>
              <SvgLinearGradient id="stepsLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#1E90FF" />
                <Stop offset="100%" stopColor="#00BFFF" />
              </SvgLinearGradient>
              <SvgLinearGradient id="stepsAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#1E90FF" />
                <Stop offset="100%" stopColor="#1E90FF" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>

            {pathData && (
              <Path
                d={pathData}
                fill="none"
                stroke="url(#stepsLineGradient)"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {data.map((d, i) => {
              const cx = scaleX(i);
              const cy = scaleY(d.steps);

              // Only render dots for certain points to reduce visual clutter
              if (i === 0 || i === data.length - 1 || i % 3 === 0) {
                return (
                  <Circle
                    key={`steps-circle-${i}`}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill="rgba(65,105,225,0.4)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={0.3}
                  />
                );
              }
              return null;
            })}
          </G>
        </Svg>
      </ScrollView>
    </View>
  );
}

/** ────────────────────────────────────────────
 *  MACRO RING COMPONENT
 *  ────────────────────────────────────────────
 */
interface MacroRingProps {
  label: string;
  percent: number;
  current: number; // current grams (assume goal is 100g)
  onPress?: () => void;
}

function MacroRing({ label, percent, current, onPress }: MacroRingProps) {
  const MACRO_STROKE_WIDTH = 6;
  const isOther = label.toUpperCase() === 'OTHER';
  const goal = 100; // Assume each macro has a goal of 100g
  const diff = goal - current;
  let subText = '';
  let subTextColor = '';

  if (!isOther) {
    if (diff > 0) {
      subText = `${diff}g Left`;
      subTextColor = '#9E9E9E';
    } else if (diff < 0) {
      subText = `${Math.abs(diff)}g over`;
      subTextColor = '#FF8A80';
    } else {
      subText = 'Goal met';
      subTextColor = '#ccc';
    }
  } else {
    subTextColor = '#9E9E9E'; // "Nutrients"
  }

  const radius = (MACRO_RING_SIZE - MACRO_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  // Ensure percent doesn't exceed 100
  const cappedPercent = Math.min(percent, 100);
  const fillStroke = (cappedPercent / 100) * circumference;

  // More saturated, vibrant gradient colors for each macro.
  let gradientColors = ['#FF00F5', '#9B00FF', '#00CFFF']; // default
  switch (label.toUpperCase()) {
    case 'PROTEIN':
      gradientColors = ['#FF5252', '#FF1744', '#D50000'];
      break;
    case 'CARBS':
      gradientColors = ['#29B6F6', '#03A9F4', '#0288D1'];
      break;
    case 'FATS':
      gradientColors = ['#66BB6A', '#43A047', '#18d621'];
      break;
    case 'OTHER':
      break;
    default:
      break;
  }

  // Use diagonal gradient direction for the OTHER macro
  const gradientDirection = isOther
    ? { x1: "0%", y1: "0%", x2: "100%", y2: "100%" }
    : { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.macroRingWrapper} onPress={onPress}>
      <Text style={styles.macroRingLabelTop}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <Svg width={MACRO_RING_SIZE} height={MACRO_RING_SIZE}>
          <Defs>
            {isOther ? (
              <SvgLinearGradient id={`macroGradient-${label}`} {...gradientDirection}>
                <Stop offset="0%" stopColor="#00A8FF" />
                <Stop offset="10%" stopColor="#00A8FF" />
                <Stop offset="60%" stopColor="#9B00FF" />
                <Stop offset="100%" stopColor="#FF00F5" />
              </SvgLinearGradient>
            ) : (
              <SvgLinearGradient id={`macroGradient-${label}`} {...gradientDirection}>
                <Stop offset="0%" stopColor={gradientColors[0]} />
                <Stop offset="50%" stopColor={gradientColors[1]} />
                <Stop offset="100%" stopColor={gradientColors[2]} />
              </SvgLinearGradient>
            )}
          </Defs>
          <Circle
            cx={MACRO_RING_SIZE / 2}
            cy={MACRO_RING_SIZE / 2}
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={MACRO_STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={MACRO_RING_SIZE / 2}
            cy={MACRO_RING_SIZE / 2}
            r={radius}
            stroke={`url(#macroGradient-${label})`}
            strokeWidth={MACRO_STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference - fillStroke}
            strokeLinecap="butt"
            transform={`rotate(-90, ${MACRO_RING_SIZE / 2}, ${MACRO_RING_SIZE / 2})`}
          />
          <Circle
            cx={MACRO_RING_SIZE / 2}
            cy={MACRO_RING_SIZE / 2}
            r={radius}
            stroke={`url(#macroGradient-${label})`}
            strokeWidth={MACRO_STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference - fillStroke}
            strokeLinecap="round"
            transform={`rotate(-90, ${MACRO_RING_SIZE / 2}, ${MACRO_RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.macroRingCenter}>
          {isOther ? (
            <>
              <Svg width={MACRO_RING_SIZE} height={MACRO_RING_SIZE} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Defs>
                  <SvgLinearGradient id="appleRingGradient" {...gradientDirection}>
                    <Stop offset="0%" stopColor="#00A8FF" />
                    <Stop offset="10%" stopColor="#00A8FF" />
                    <Stop offset="60%" stopColor="#9B00FF" />
                    <Stop offset="100%" stopColor="#FF00F5" />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx={MACRO_RING_SIZE / 2}
                  cy={MACRO_RING_SIZE / 2}
                  r={(MACRO_RING_SIZE - MACRO_STROKE_WIDTH) / 2}
                  stroke="url(#appleRingGradient)"
                  strokeWidth={MACRO_STROKE_WIDTH}
                  fill="none"
                />
              </Svg>
              <View
                style={{
                  shadowColor: "#00A8FF",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <MaskedView
                  style={{ height: 40, width: 40 }}
                  maskElement={
                    <View
                      style={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <MaterialCommunityIcons name="food-apple" size={40} color="black" />
                    </View>
                  }
                >
                  <LinearGradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    colors={["#00A8FF", "#00A8FF", "#9B00FF", "#FF00F5", "#FF00F5"]}
                    locations={[0, 0.15, 0.80, 0.85, 1]}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              </View>
            </>
          ) : (
            <Text style={styles.macroRingText}>{Math.round(percent)}%</Text>
          )}
        </View>
      </View>
      <Text style={[styles.macroRingSubLabel, { color: subTextColor }]}>
        {isOther ? 'Nutrients' : subText}
      </Text>
    </Container>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 10 // Reduced padding for less space between header and first card
  },
  card: {
    width: '95%',
    backgroundColor: 'hsla(0, 0%, 100%, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 4, // Slightly reduced margin for uniform spacing
    // Shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3
  },
  /* Cheat Day */
  cheatDayContainer: {},
  cheatDayLabel: {
    color: '#FFF',
    fontSize: 14,
    textTransform: 'uppercase',
    fontStyle: 'italic', // added italic
    fontWeight: 'bold',   // added bold
    fontFamily: 'Georgia', // new font for extra flair
  },
  cheatDayBarBackground: {
    marginTop: 8,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    overflow: 'hidden'
  },
  cheatDayBarFill: {
    height: 10,
    borderRadius: 5
  },
  cheatDayStatus: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase'
  },
  /* Ring + Right Card */
  ringAndRightCard: {
    width: '95%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  ringContainer: {
    position: 'relative',
    marginRight: 22, // spacing between circle and stats column
    marginLeft: 0, // removed extra left margin
  },
  ringGlow: {
    position: 'absolute',
    width: CIRCLE_SIZE - STROKE_WIDTH * 2,
    height: CIRCLE_SIZE - STROKE_WIDTH * 2,
    borderRadius: CIRCLE_SIZE,
    backgroundColor: 'transparent',
    opacity: 0,
    top: STROKE_WIDTH + SVG_PADDING,
    left: STROKE_WIDTH + SVG_PADDING
  },
  centerTextContainer: {
    position: 'absolute',
    width: SVG_SIZE,
    height: SVG_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    left: 0,
    top: 0
  },
  remainingValue: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: 'bold',
    textShadowColor: '#9B00FF', // added soft purple shadow
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'Georgia', // adding a custom font
  },
  remainingLabel: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase'
  },
  rightCard: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: '38%'
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  statValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  /* Macros */
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  macroRingWrapper: {
    alignItems: 'center',
    marginHorizontal: 10
  },
  macroRingLabelTop: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: 'Georgia', // updated font for macro label
  },
  macroRingCenter: {
    position: 'absolute',
    width: MACRO_RING_SIZE,
    height: MACRO_RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center'
  },
  macroRingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  macroRingSubLabel: {
    fontSize: 12,
    marginTop: 4
  },
  /* Weight Lost */
  burnContainer: {},
  burnTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  burnBarBackground: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    overflow: 'hidden'
  },
  burnBarFill: {
    height: 10,
    borderRadius: 5,
  },
  burnDetails: {
    color: '#FFF',
    fontSize: 12,
    fontStyle: 'italic', // added italic styling
    fontWeight: 'bold',   // added bold styling
    fontFamily: 'Courier New', // change font here
    textAlign: 'center', // Center the text horizontally
    flex: 1, // Allow the text to take up available space
  },
  /* Weight Trend */
  weightGraphTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontStyle: 'italic',      // added italic
    fontWeight: 'bold',       // added bold
    textDecorationLine: 'underline', // added underline
    fontFamily: 'Courier New', // new font style
  },
  /* Pagination Dots */
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 5
  },
  dotActive: {
    backgroundColor: '#9B00FF'
  },
  // New style for positioning the trend elements (StepsTrend and WeightTrend)
  trendContainer: {
    marginTop: 10
  },
  goalCard: {
    width: '95%',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4, // Slightly reduced margin for uniform spacing
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Ensure the stack is next to the circle
    height: 235 // Slightly taller card to prevent overflow
  },
  rightCardVertical: {
    flex: 1,
    justifyContent: 'space-between', // Align with top and bottom of the ring
    alignItems: 'flex-start',
    paddingLeft: 0, // removed extra padding on left
    marginTop: 10 // Move the stack slightly lower
  },
  statRowVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  weightLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', // Center the text vertically
    marginTop: 4,
  },
  weightLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gradientBorderContainer: {
    marginBottom: 8,
    borderRadius: 10,
    width: '95%',
    overflow: 'hidden',
  },
  goalCardContent: {
    padding: 10,
    marginBottom: 4,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 250 // Increased height to accommodate the larger SVG size
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontSize: 16,
  },
  // Explore button styles
  exploreButton: {
    width: '90%',
    height: 50,
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  exploreButtonInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  exploreButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreButtonIcon: {
    marginRight: 8,
  },
  exploreButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FF6347',
  },
  errorText: {
    color: '#FFD700',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '80%',
    backgroundColor: '#1e1e1e',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  weightInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    padding: 12,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#5c00dd',
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
