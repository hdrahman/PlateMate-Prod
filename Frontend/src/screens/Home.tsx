import React, { useState, useContext, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { G, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useSteps } from '../context/StepContext';
import { getTodayExerciseCalories, getCheatDayProgress, CheatDayProgress, getUserStreak, checkAndUpdateStreak, hasActivityForToday } from '../utils/database';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfileBySupabaseUid,
  getUserProfileByFirebaseUid,
  getUserGoals,
  updateUserProfile,
  getUserBMRData
} from '../utils/database';
import { calculateNutritionGoals, getDefaultNutritionGoals } from '../utils/nutritionCalculator';
import { useFoodLog } from '../context/FoodLogContext';
import { subscribeToDatabaseChanges, unsubscribeFromDatabaseChanges } from '../utils/databaseWatcher';
import {
  getWeightHistoryLocal,
  addWeightEntryLocal,
  clearWeightHistoryLocal
} from '../utils/database';
import { useOnboarding } from '../context/OnboardingContext';
import WelcomePremiumModal from '../components/WelcomePremiumModal';

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

// Steps history
const stepsHistory = [
  { date: '11/03', steps: 2400 },
  { date: '12/03', steps: 3700 },
  { date: '02/01', steps: 5000 }
];

// Cheat day data
const cheatDaysTotal = 7;
const cheatDaysCompleted = 3;
const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100;

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
  const { onboardingComplete, justCompletedOnboarding, markWelcomeModalShown } = useOnboarding();
  const { nutrientTotals, refreshLogs, isLoading: foodLogLoading, startWatchingFoodLogs, stopWatchingFoodLogs, lastUpdated, hasError, forceSingleRefresh } = useFoodLog();

  // Date change detection for midnight rollover
  useEffect(() => {
    const formatDateToString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getMillisecondsUntilMidnight = (): number => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    };

    const refreshAllData = async () => {
      console.log('🏠 Date changed - refreshing all home screen data...');
      try {
        await refreshLogs();
        const todayExerciseCals = await getTodayExerciseCalories();
        setExerciseCalories(todayExerciseCals);
        if (refreshStepData) await refreshStepData();
        if (user?.uid) {
          const newStreak = await getUserStreak(user.uid);
          setCurrentStreak(newStreak);
        }
      } catch (error) {
        console.error('❌ Error refreshing data on date change:', error);
      }
    };

    let currentDate = formatDateToString(new Date());
    let timeoutId: NodeJS.Timeout;

    const scheduleNextCheck = () => {
      const msUntilMidnight = getMillisecondsUntilMidnight();
      timeoutId = setTimeout(() => {
        const newDate = formatDateToString(new Date());
        if (newDate !== currentDate) {
          currentDate = newDate;
          refreshAllData();
        }
        scheduleNextCheck(); // Schedule next midnight
      }, msUntilMidnight);
    };

    scheduleNextCheck();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshLogs, refreshStepData, user?.uid]);

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

  // Macros loading state
  const [macrosLoading, setMacrosLoading] = useState(true);

  // Use the step context instead of the hook directly
  const {
    todaySteps,
    stepHistory,
    isAvailable,
    loading: stepsLoading,
    refreshStepData
  } = useSteps();

  // Add state for weight history
  const [weightHistory, setWeightHistory] = useState<Array<{ date: string; weight: number }>>([]);
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  // Add state for streak tracking
  const [currentStreak, setCurrentStreak] = useState(0);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightLost, setWeightLost] = useState(0);
  const [weightGoal, setWeightGoal] = useState<string>('maintain'); // Add state for weight goal

  // Add state for temporary today's weight display
  const [showTodayWeight, setShowTodayWeight] = useState(false);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);

  // Add state for cheat day data
  const [cheatDayData, setCheatDayData] = useState<CheatDayProgress>({
    daysCompleted: 0,
    totalDays: 7,
    daysUntilNext: 7,
    enabled: false
  });
  const [cheatDayLoading, setCheatDayLoading] = useState(true);

  // Add state for welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Load user profile and calculate nutrition goals
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;

      try {
        setProfileLoading(true);
        // Get user profile from local database
        const profile = await getUserProfileByFirebaseUid(user.uid);

        if (profile) {
          // Update target weight if it exists in the profile
          if (profile.target_weight) {
            setTargetWeight(profile.target_weight);
          }

          // Get user goals for calorie goal
          const userGoals = await getUserGoals(user.uid);
          console.log('📋 Loaded user goals from database:', {
            calorieGoal: userGoals?.calorieGoal,
            fitnessGoal: userGoals?.fitnessGoal,
            targetWeight: userGoals?.targetWeight
          });

          // Store the user's weight goal
          if (userGoals?.fitnessGoal) {
            setWeightGoal(userGoals.fitnessGoal);
          }

          console.log('📋 User profile data:', {
            daily_calorie_target: profile.daily_calorie_target,
            fitness_goal: profile.fitness_goal,
            weight_goal: profile.weight_goal,
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activity_level: profile.activity_level
          });

          // Calculate nutrition goals based on user profile
          const goals = calculateNutritionGoals({
            firstName: profile.first_name,
            lastName: profile.last_name,
            dateOfBirth: profile.date_of_birth,
            location: profile.location,
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activityLevel: profile.activity_level,
            unitPreference: profile.unit_preference || 'metric',
            dietaryRestrictions: profile.dietary_restrictions || [],
            foodAllergies: profile.food_allergies || [],
            cuisinePreferences: profile.cuisine_preferences || [],
            spiceTolerance: profile.spice_tolerance,
            weightGoal: userGoals?.fitnessGoal || 'maintain', // Get from nutrition_goals table instead
            targetWeight: profile.target_weight,
            startingWeight: profile.starting_weight,
            healthConditions: profile.health_conditions || [],
            fitnessGoal: profile.fitness_goal,
            dailyCalorieTarget: profile.daily_calorie_target,
            nutrientFocus: profile.nutrient_focus,
            defaultAddress: null,
            preferredDeliveryTimes: [],
            deliveryInstructions: null,
            pushNotificationsEnabled: !!profile.push_notifications_enabled,
            emailNotificationsEnabled: !!profile.email_notifications_enabled,
            smsNotificationsEnabled: !!profile.sms_notifications_enabled,
            marketingEmailsEnabled: !!profile.marketing_emails_enabled,
            paymentMethods: [],
            billingAddress: null,
            defaultPaymentMethodId: null,
            preferredLanguage: profile.preferred_language || 'en',
            timezone: profile.timezone || 'UTC',
            darkMode: !!profile.dark_mode,
            syncDataOffline: !!profile.sync_data_offline
          } as any);

          console.log('📋 Calculated nutrition goals:', {
            calories: goals.calories,
            protein: goals.protein,
            carbs: goals.carbs,
            fat: goals.fat
          });

          // Try to get BMR data first (if available, it will have more accurate calorie targets)
          const bmrData = await getUserBMRData(user.uid);
          console.log('📊 BMR data loaded:', bmrData);

          // Update state with calculated goals, prioritizing BMR data, then database, then calculated
          let finalCalorieGoal = goals.calories;
          
          if (bmrData?.dailyTarget) {
            finalCalorieGoal = bmrData.dailyTarget;
            console.log('📋 Using BMR daily target as calorie goal:', finalCalorieGoal);
          } else if (userGoals?.calorieGoal) {
            finalCalorieGoal = userGoals.calorieGoal;
            console.log('📋 Using database calorie goal:', finalCalorieGoal);
          } else {
            console.log('📋 Using calculated calorie goal:', finalCalorieGoal);
          }

          setDailyCalorieGoal(finalCalorieGoal);
          setMacroGoals({
            protein: userGoals?.proteinGoal || goals.protein,
            carbs: userGoals?.carbGoal || goals.carbs,
            fat: userGoals?.fatGoal || goals.fat
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();

    // Add focus listener to refresh data when returning to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      // Reload user profile to get the latest target weight
      loadUserProfile();
      // Reload cheat day data to get the latest settings
      loadCheatDayData();
      
      // Refresh step data to ensure latest count
      if (refreshStepData) {
        refreshStepData().catch(error => {
          console.warn('Failed to refresh step data on focus:', error);
        });
      }
    });

    // Clean up the listener when component unmounts
    return unsubscribe;
  }, [user, navigation, refreshStepData]);

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

  // Load user streak when component mounts
  useEffect(() => {
    if (user?.uid) {
      getUserStreak(user.uid)
        .then(streak => setCurrentStreak(streak))
        .catch(error => console.error('Error loading streak:', error));
    }
  }, [user]);

  // Show welcome modal when onboarding is just completed
  useEffect(() => {
    console.log('🔍 Checking for welcome modal:', {
      justCompletedOnboarding,
      userUid: user?.uid,
      showWelcomeModal
    });

    if (justCompletedOnboarding && user?.uid && !showWelcomeModal) {
      console.log('✅ Showing welcome modal for just completed onboarding');
      // Small delay to ensure the home screen is fully loaded
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1500);
    }
  }, [justCompletedOnboarding, user, showWelcomeModal]);

  // Load today's nutrition data from the food log context
  useEffect(() => {
    const loadTodayNutrients = async () => {
      if (profileLoading) return;

      try {
        // Only set loading states if we don't have data yet (prevent flickering on refresh)
        const hasExistingData = consumedCalories !== 0 || nutrientTotals.calories !== undefined;
        if (!hasExistingData) {
          setFoodLoading(true);
          setMacrosLoading(true);
        }

        // Only refresh logs if context data is uninitialized (avoid false positives for 0 values)
        if (nutrientTotals.calories === undefined || nutrientTotals.protein === undefined) {
          await refreshLogs();
        }

        // Get the nutrition values from the context
        setConsumedCalories(nutrientTotals.calories);

        console.log('🏠 Home screen nutrient values (FIXED):', {
          protein: nutrientTotals.protein,
          carbs: nutrientTotals.carbs,
          fat: nutrientTotals.fat,
          calories: nutrientTotals.calories,
          lastUpdated: lastUpdated,
          dataSource: 'FoodLogContext'
        });

        console.log('🏠 Home screen macro goals:', {
          protein: macroGoals.protein,
          carbs: macroGoals.carbs,
          fat: macroGoals.fat,
          profileLoading: profileLoading
        });

        console.log('🏠 Home screen macro calculations:', {
          proteinDiff: macroGoals.protein - nutrientTotals.protein,
          carbsDiff: macroGoals.carbs - nutrientTotals.carbs,
          fatDiff: macroGoals.fat - nutrientTotals.fat,
          macrosLoading: macrosLoading
        });

        // Load exercise calories (only set loading if we don't have data yet)
        if (exerciseCalories === 0) {
          setExerciseLoading(true);
        }
        const todayExerciseCals = await getTodayExerciseCalories();
        setExerciseCalories(todayExerciseCals);

        // Calculate adjusted goal and remaining calories
        const adjustedDailyGoal = dailyCalorieGoal + todayExerciseCals;
        const remaining = adjustedDailyGoal - nutrientTotals.calories;

        // Instead of capping at 0, show actual value (negative if over)
        setRemainingCals(Math.round(remaining));

        // Calculate percent consumed based on base goal (for legacy compatibility)
        // Ensure we don't cap at 100% so the progress bar doesn't unwind
        const percentConsumed = (nutrientTotals.calories / dailyCalorieGoal) * 100;
        setPercentCons(Math.round(percentConsumed));

        // Update streak when nutrition data changes
        if (user?.uid) {
          const hasActivity = await hasActivityForToday(user.uid);
          if (hasActivity) {
            const newStreak = await checkAndUpdateStreak(user.uid);
            setCurrentStreak(newStreak);
          } else {
            const currentStreak = await getUserStreak(user.uid);
            setCurrentStreak(currentStreak);
          }
        }
      } catch (error) {
        console.error('Error loading today nutrients:', error);
      } finally {
        // Always reset loading states
        setFoodLoading(false);
        setMacrosLoading(false);
        setExerciseLoading(false);
      }
    };

    loadTodayNutrients();
  }, [profileLoading, dailyCalorieGoal, nutrientTotals, refreshLogs, lastUpdated, user, macroGoals, consumedCalories, exerciseCalories]);

  // Load weight history only once when the component mounts
  useEffect(() => {
    const loadWeightHistory = async () => {
      if (!user) return;

      try {
        setWeightLoading(true);

        // Get user profile from local database to get starting weight and current weight
        const profile = await getUserProfileByFirebaseUid(user.uid);
        if (!profile) {
          console.log('No profile found');
          setWeightLoading(false);
          return;
        }

        // Get weight history from local SQLite database
        const historyEntries = await getWeightHistoryLocal(user.uid);

        // Initialize the weight history array
        let formattedHistory = [];

        // Add starting weight as the first point if available
        if (profile.starting_weight) {
          // Use profile creation date or a date earlier than all weight entries
          const startDate = profile.last_modified || new Date(2000, 0, 1).toISOString();
          formattedHistory.push({
            date: new Date(startDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            weight: profile.starting_weight
          });
          // Set starting weight state
          setStartingWeight(profile.starting_weight);
        }

        // Add intermediary weights from weight history
        if (historyEntries && historyEntries.length > 0) {
          // Sort history chronologically - oldest first
          const sortedWeights = [...historyEntries].sort((a, b) =>
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );

          // Format and add all intermediary weight entries
          const intermediaryWeights = sortedWeights.map(entry => ({
            date: new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            weight: entry.weight
          }));

          formattedHistory = [...formattedHistory, ...intermediaryWeights];

          // If we don't have a starting weight yet, use the first weight entry
          if (!profile.starting_weight && sortedWeights.length > 0) {
            setStartingWeight(sortedWeights[0].weight);
          }
        }

        // Add current weight as the last point if different from the last history entry
        if (profile.weight) {
          const lastEntryWeight = formattedHistory.length > 0 ?
            formattedHistory[formattedHistory.length - 1].weight : null;

          // Only add current weight if it's different from the last history entry
          // or if there are no history entries
          if (!lastEntryWeight || Math.abs(lastEntryWeight - profile.weight) >= 0.01) {
            formattedHistory.push({
              date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
              weight: profile.weight
            });
          }

          // Set current weight state
          setCurrentWeight(profile.weight);
        }

        // Set the complete weight history
        setWeightHistory(formattedHistory);

        // If there's no entry for today, set up the temporary today point
        const today = new Date();
        const hasEntryForToday = formattedHistory.some(entry => {
          const entryDate = new Date(entry.date);
          return entryDate.getDate() === today.getDate() &&
            entryDate.getMonth() === today.getMonth() &&
            entryDate.getFullYear() === today.getFullYear();
        });

        if (!hasEntryForToday && currentWeight) {
          setShowTodayWeight(true);
          setTodayWeight(currentWeight);
        } else {
          setShowTodayWeight(false);
          setTodayWeight(null);
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
  }, [user, setWeightHistory, setCurrentWeight, setTargetWeight, setStartingWeight, setWeightLost]);

  // Calculate weight lost when profile and weight history are loaded - fix the logic
  useEffect(() => {
    if (!profileLoading && !weightLoading && currentWeight !== null) {
      // If starting_weight is available, use it; otherwise use the first weight entry
      const initialWeight = startingWeight || (weightHistory.length > 0 ? weightHistory[0].weight : currentWeight);

      // Calculate weight change (can be positive for loss or negative for gain)
      const weightChange = initialWeight - currentWeight;
      setWeightLost(parseFloat(weightChange.toFixed(1)));
    }
  }, [profileLoading, weightLoading, currentWeight, startingWeight, weightHistory]);

  // Update the handleAddWeight function
  const handleAddWeight = async () => {
    if (!user || !newWeight) return;

    try {
      const weightValue = parseFloat(newWeight);

      if (isNaN(weightValue) || weightValue <= 0) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight value.');
        return;
      }

      // Get the current user profile
      const profile = await getUserProfileByFirebaseUid(user.uid);
      if (!profile) {
        Alert.alert('Error', 'Unable to find user profile.');
        return;
      }

      // Check if this is the first weight entry and we need to set starting weight
      if (!startingWeight) {
        // Update the starting_weight in the user profile
        await updateUserProfile(user.uid, { starting_weight: weightValue });
        setStartingWeight(weightValue);
      }

      // Always update the current weight in user profile
      await updateUserProfile(user.uid, { weight: weightValue });
      setCurrentWeight(weightValue);

      // Add weight entry to history
      await addWeightEntryLocal(user.uid, weightValue);

      // Update local state with the new entry
      const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

      // Add the new entry to the existing weight history
      const updatedHistory = [...weightHistory];

      // If the last entry is also from today, replace it instead of adding a new one
      const lastEntryIndex = updatedHistory.length - 1;
      const lastEntry = lastEntryIndex >= 0 ? updatedHistory[lastEntryIndex] : null;

      if (lastEntry && lastEntry.date === today) {
        // Replace today's entry
        updatedHistory[lastEntryIndex] = { date: today, weight: weightValue };
      } else {
        // Add new entry
        updatedHistory.push({ date: today, weight: weightValue });
      }

      setWeightHistory(updatedHistory);

      // No need to show temporary today weight anymore
      setShowTodayWeight(false);
      setTodayWeight(null);

      // Recalculate weight lost or gained
      if (startingWeight) {
        const weightChange = startingWeight - weightValue;
        setWeightLost(parseFloat(weightChange.toFixed(1)));
      }

      // Success message with feedback
      Alert.alert(
        'Weight Updated',
        `Your weight has been updated to ${weightValue} kg.`,
        [{ text: 'OK' }],
        { cancelable: true }
      );

      // Close modal and clear input
      setWeightModalVisible(false);
      setNewWeight('');
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

  // Calculate adjusted goal (base + exercise calories)
  const adjustedGoal = dailyCalorieGoal + exerciseCalories;

  // Calculate values for the main ring based on adjusted goal.
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const adjustedPercentCons = adjustedGoal > 0 ? (consumedCalories / adjustedGoal) * 100 : 0;
  // Don't allow progress to exceed 100% of the circle circumference
  const consumedStroke = Math.min(circumference, circumference * (Math.min(100, adjustedPercentCons) / 100));

  // Data for the right card with updated colors.
  const rightStats = [
    {
      label: 'Goal',
      value: adjustedGoal || '---',
      icon: 'flag-outline',
      color: '#FFB74D'
    },
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

  // Update the weight lost card render function
  const renderWeightLostCard = () => {
    // Check if the user's goal is to gain weight
    const isGainGoal = weightGoal.startsWith('gain');

    // Determine if the weight change aligns with the goal
    const isAlignedWithGoal = (isGainGoal && weightLost < 0) || (!isGainGoal && weightLost >= 0);

    // Set background colors based on goal
    const lossBackgroundColor = isGainGoal ? 'rgba(139, 0, 0, 0.2)' : 'rgba(0, 100, 0, 0.2)';
    const gainBackgroundColor = isGainGoal ? 'rgba(0, 100, 0, 0.2)' : 'rgba(139, 0, 0, 0.2)';

    // Set gradient colors based on goal
    const lossGradientColors = isGainGoal
      ? ['#8B0000', '#8B0000', '#FF0000'] as const
      : ['#006400', '#006400', '#00FF00'] as const;

    const gainGradientColors = isGainGoal
      ? ['#006400', '#006400', '#00FF00'] as const
      : ['#8B0000', '#8B0000', '#FF0000'] as const;

    return (
      <GradientBorderCard>
        <View style={styles.burnContainer}>
          <Text style={styles.burnTitle}>
            {weightLost >= 0 ? 'Weight Lost' : 'Weight Gained'}
          </Text>
          <View style={[
            styles.burnBarBackground,
            {
              backgroundColor: weightLost >= 0
                ? lossBackgroundColor  // For weight loss
                : gainBackgroundColor  // For weight gain
            }
          ]}>
            {weightLost >= 0 ? (
              // Weight loss - use appropriate gradient based on goal
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={lossGradientColors}
                style={[
                  styles.burnBarFill,
                  {
                    width: `${Math.min(
                      (Math.abs(weightLost) / (startingWeight && targetWeight && startingWeight > targetWeight
                        ? startingWeight - targetWeight
                        : 10)) * 100,
                      100
                    )}%`
                  }
                ]}
              />
            ) : (
              // Weight gain - use appropriate gradient based on goal
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={gainGradientColors}
                style={[
                  styles.burnBarFill,
                  {
                    width: `${Math.min(
                      (Math.abs(weightLost) / 10) * 100, // use a default of 10kg for the scale if no target
                      100
                    )}%`
                  }
                ]}
              />
            )}
          </View>
          <View style={styles.weightLabelsContainer}>
            <Text style={styles.weightLabel}>{startingWeight || (weightHistory.length > 0 ? weightHistory[0].weight : '--')} kg</Text>
            <Text style={[
              styles.burnDetails,
              !isAlignedWithGoal && styles.burnDetailsGain // Apply red style if not aligned with goal
            ]}>
              {weightLost >= 0
                ? `${Math.abs(weightLost)} Kilograms Lost!`
                : `${Math.abs(weightLost)} Kilograms Gained!`}
            </Text>
            <Text style={styles.weightLabel}>{targetWeight ? `${targetWeight} kg` : '---'}</Text>
          </View>
        </View>
      </GradientBorderCard>
    );
  };

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
          <Text style={styles.modalTitle}>Update Weight</Text>
          <View style={{
            width: '100%',
            position: 'relative',
            marginBottom: 20,
          }}>
            <TextInput
              style={[styles.weightInput, {
                borderColor: newWeight ? 'rgba(155, 0, 255, 0.6)' : '#555', // More subtle highlight
                paddingRight: 40, // Make room for the unit label
              }]}
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="Enter weight in kg"
              keyboardType="numeric"
              placeholderTextColor="rgba(150, 150, 150, 0.6)"
              autoFocus={true}
            />
            <Text style={{
              position: 'absolute',
              right: 15,
              top: 15,
              color: 'rgba(170, 170, 170, 0.8)',
              fontSize: 16,
              fontWeight: '400',
            }}>
              kg
            </Text>
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, {
                backgroundColor: 'rgba(60, 60, 60, 0.8)',
                borderWidth: 1,
                borderColor: '#555',
              }]}
              onPress={() => {
                setWeightModalVisible(false);
                setNewWeight('');
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, {
                backgroundColor: 'rgba(55, 0, 110, 0.6)',
                borderWidth: 1,
                borderColor: '#9B00FF',
              }]}
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
    Alert.alert(
      "Clear Weight History",
      "This will remove all weight entries except your starting weight and current weight. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setWeightLoading(true);

              // Call local SQLite function to clear weight history
              await clearWeightHistoryLocal(user.uid);

              // Reload weight history with just starting and current weights
              // Get updated profile
              const updatedProfile = await getUserProfileByFirebaseUid(user.uid);
              if (!updatedProfile) {
                throw new Error('Failed to load updated profile');
              }

              // Reset the weight history with only starting and current weight
              let formattedHistory = [];

              // Add starting weight
              if (updatedProfile.starting_weight) {
                const startDate = updatedProfile.last_modified || new Date(2000, 0, 1).toISOString();
                formattedHistory.push({
                  date: new Date(startDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
                  weight: updatedProfile.starting_weight
                });
                setStartingWeight(updatedProfile.starting_weight);
              }

              // Add current weight if different from starting weight
              if (updatedProfile.weight &&
                (!updatedProfile.starting_weight ||
                  Math.abs(updatedProfile.weight - updatedProfile.starting_weight) >= 0.01)) {
                formattedHistory.push({
                  date: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
                  weight: updatedProfile.weight
                });
                setCurrentWeight(updatedProfile.weight);
              }

              // Update weight history
              setWeightHistory(formattedHistory);

              // Calculate weight lost
              if (updatedProfile.starting_weight && updatedProfile.weight) {
                const lost = updatedProfile.starting_weight - updatedProfile.weight;
                setWeightLost(parseFloat(lost.toFixed(1)));
              }

              // Show success message
              Alert.alert(
                "Success",
                "Weight history has been cleared, keeping only your starting and current weights."
              );
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
  };

  // In the Home component, add this function to check if today's weight has been recorded
  // Check if a weight entry exists for today
  const hasTodayWeightEntry = (weightHistory: Array<{ date: string; weight: number }>) => {
    const today = new Date();
    const todayString = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

    return weightHistory.some(entry => entry.date === todayString);
  };

  // Track if automatic weight recording has been done today
  const [hasRecordedToday, setHasRecordedToday] = useState(false);

  // Update the automatic weight recording effect - run only once when needed
  useEffect(() => {
    if (!user || !currentWeight || hasRecordedToday) return;

    // Function to record today's weight if it hasn't been recorded yet
    const recordTodayWeight = async () => {
      if (!user || !currentWeight) return;

      try {
        // Check if we already have a weight entry for today
        const historyEntries = await getWeightHistoryLocal(user.uid);
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Check if there's an entry for today
        const hasEntryForToday = historyEntries && historyEntries.length > 0 &&
          historyEntries.some(entry => entry.recorded_at.startsWith(todayString));

        // If no entry for today, record the current weight (WITHOUT triggering change notifications)
        if (!hasEntryForToday) {
          // Use addWeightEntryLocal but prevent it from triggering database change notifications
          await addWeightEntryLocal(user.uid, currentWeight, true); // Pass true for isAutomatic
          console.log('Daily weight recorded automatically');

          // Mark as recorded to prevent repeated attempts
          setHasRecordedToday(true);

          // Update the local weight history display
          const newEntry = {
            date: today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            weight: currentWeight
          };

          // Update weight history state
          setWeightHistory(prev => {
            const updatedHistory = [...prev];
            const lastEntryIndex = updatedHistory.length - 1;

            if (lastEntryIndex >= 0 && updatedHistory[lastEntryIndex].date === newEntry.date) {
              updatedHistory[lastEntryIndex] = newEntry;
            } else {
              updatedHistory.push(newEntry);
            }
            return updatedHistory;
          });

          setShowTodayWeight(false);

          // Recalculate weight change
          if (startingWeight) {
            const weightChange = startingWeight - currentWeight;
            setWeightLost(parseFloat(weightChange.toFixed(1)));
          }
        } else {
          // Mark as recorded since it already exists
          setHasRecordedToday(true);
        }
      } catch (error) {
        console.error('Error in automatic weight recording:', error);
      }
    };

    // Run once when the component mounts to ensure today's weight is recorded
    recordTodayWeight();

    // Set up a timer to check at midnight only
    const checkTimeAndRecordWeight = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check if it's midnight (00:00) - reset the daily recording flag
      if (hours === 0 && minutes === 0) {
        setHasRecordedToday(false);
        recordTodayWeight();
      }
    };

    // Check every minute for midnight trigger
    const interval = setInterval(checkTimeAndRecordWeight, 60000);

    // Clear interval on unmount
    return () => clearInterval(interval);
  }, [user, currentWeight, hasRecordedToday, startingWeight]); // Removed weightHistory from dependencies

  useEffect(() => {
    const setStartingWeightTo110 = async () => {
      if (user) {
        try {
          // Skip if onboarding has not completed to avoid conflicts
          if (!onboardingComplete) {
            console.log("🔄 Skipping automatic weight update - onboarding not complete yet");
            return;
          }

          console.log("Checking if user profile exists...");

          // Check if the user profile exists using proper function
          const userProfile = await getUserProfileBySupabaseUid(user.uid);

          if (!userProfile) {
            console.log("⚠️ User profile doesn't exist yet, skipping weight update");
            return;
          }

          // Only update if starting_weight is not already set
          if (!userProfile.starting_weight && userProfile.weight) {
            console.log("📝 Setting starting weight to user's current weight from profile");

            // Use the user's actual weight from their profile as the starting weight
            await updateUserProfile(user.uid, {
              starting_weight: userProfile.weight
            });

            console.log(`✅ Starting weight set to ${userProfile.weight}kg (user's actual weight from profile)`);

            // Update the local state
            setStartingWeight(userProfile.weight);

            // Since starting weight equals current weight initially, weight lost should be 0
            setWeightLost(0);
          } else if (userProfile.starting_weight) {
            console.log("ℹ️ Starting weight already set, using existing value");
            setStartingWeight(userProfile.starting_weight);

            // Calculate weight lost properly
            if (userProfile.weight) {
              const weightChange = userProfile.starting_weight - userProfile.weight;
              setWeightLost(parseFloat(weightChange.toFixed(1)));
            }
          } else {
            console.log("⚠️ No weight data available in profile yet");
          }
        } catch (error) {
          console.error("⚠️ Error in automatic weight management:", error);
          // Don't show fallback errors since this is now a background operation
        }
      }
    };

    // Add a small delay to ensure onboarding completion has finished
    const timer = setTimeout(setStartingWeightTo110, 1000);
    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentWeight, onboardingComplete]);

  // Load cheat day data
  const loadCheatDayData = async () => {
    if (!user) return;

    try {
      setCheatDayLoading(true);
      const progress = await getCheatDayProgress(user.uid);
      setCheatDayData(progress);
    } catch (error) {
      console.error('Error loading cheat day data:', error);
      // Set default values on error
      setCheatDayData({
        daysCompleted: 0,
        totalDays: 7,
        daysUntilNext: 7,
        enabled: false
      });
    } finally {
      setCheatDayLoading(false);
    }
  };

  // Load cheat day data when component mounts or user changes
  useEffect(() => {
    loadCheatDayData();
  }, [user]);

  // Calculate cheat day progress for display
  const cheatDayProgress = cheatDayData.enabled && cheatDayData.totalDays > 0
    ? Math.max(5, (cheatDayData.daysCompleted / cheatDayData.totalDays) * 100) // Minimum 5% to show like a dot
    : 5; // Show 5% when disabled to maintain visual consistency

  // Start watching food logs when the component mounts
  useEffect(() => {
    startWatchingFoodLogs();
    return () => stopWatchingFoodLogs();
  }, [startWatchingFoodLogs, stopWatchingFoodLogs]);

  // Subscribe to database changes for exercise data updates
  useEffect(() => {
    const refreshExerciseData = async () => {
      try {
        const todayExerciseCals = await getTodayExerciseCalories();
        setExerciseCalories(todayExerciseCals);

        // Recalculate remaining calories using adjusted goal
        const adjustedDailyGoal = dailyCalorieGoal + todayExerciseCals;
        const remaining = adjustedDailyGoal - consumedCalories;
        // Don't cap at zero to allow "X over" display
        setRemainingCals(Math.round(remaining));
      } catch (error) {
        console.error('Error refreshing exercise data:', error);
      }
    };

    // Subscribe to database changes
    const unsubscribe = subscribeToDatabaseChanges(refreshExerciseData);

    // Clean up subscription on unmount
    return unsubscribe;
  }, [dailyCalorieGoal, consumedCalories]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }}>
      {renderErrorBanner()}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* CHEAT DAY CARD */}
        <GradientBorderCard>
          <View style={styles.cheatDayContainer}>
            {/* STREAK INDICATOR - Top Right Corner */}
            <View style={styles.streakContainer}>
              <MaskedView
                maskElement={<Text style={[styles.streakText, { opacity: 1 }]}>{currentStreak}</Text>}
              >
                <LinearGradient
                  colors={["#0080FF", "#FF1493"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0.33, 0.8]}
                >
                  <Text style={[styles.streakText, { opacity: 0 }]}>{currentStreak}</Text>
                </LinearGradient>
              </MaskedView>
              <MaskedView
                maskElement={<MaterialCommunityIcons name="fire" size={28} color="#FFF" />}
                style={{ marginLeft: 0 }}
              >
                <LinearGradient
                  colors={["#0080FF", "#FF1493"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0.33, 0.8]}
                  style={{ width: 28, height: 28 }}
                />
              </MaskedView>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cheatDayLabel}>
                {!cheatDayData.enabled
                  ? 'Cheat day disabled'
                  : cheatDayData.daysUntilNext === 0
                    ? 'Cheat day today!'
                    : `${cheatDayData.daysUntilNext} days until cheat day`}
              </Text>
            </View>
            <View style={[
              styles.cheatDayBarBackground,
              { backgroundColor: 'rgba(0, 207, 255, 0.2)' } // subdued light blue background matching the cheat day gradient
            ]}>
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                style={[styles.cheatDayBarFill, { width: `${cheatDayProgress}%` }]}
              />
            </View>
            <Text style={styles.cheatDayStatus}>
              {cheatDayLoading
                ? '---'
                : !cheatDayData.enabled
                  ? 'Enable in goals to track'
                  : `${cheatDayData.daysCompleted} / ${cheatDayData.totalDays} days`}
            </Text>
          </View>
        </GradientBorderCard>

        {/* Add space between the cards */}
        <View style={{ height: 4 }} />

        {/* GOAL CARD (Unified circular bar + stats overlay) */}
        <GradientBorderCard>
          {/* Analytics Button - Top Left Corner */}
          <TouchableOpacity
            style={styles.goalCardAnalyticsButton}
            onPress={() => navigation.navigate('Analytics' as never)}
          >
            <MaskedView
              style={styles.goalCardAnalyticsMask}
              maskElement={
                <Ionicons name="analytics" size={22} color="black" />
              }
            >
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={['#FF00F5', '#9B00FF', '#00CFFF']}
                style={styles.goalCardAnalyticsGradient}
              />
            </MaskedView>
          </TouchableOpacity>
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
                    <Stop offset="0%" stopColor="#8B6914" />
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
                  stroke="rgba(155, 0, 255, 0.15)"
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
                  strokeDashoffset={circumference + (dailyCalorieGoal > 0 ? (exerciseCalories / dailyCalorieGoal) * circumference : 0)}
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
                  strokeDashoffset={circumference + (dailyCalorieGoal > 0 ? (exerciseCalories / dailyCalorieGoal) * circumference : 0)}
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
                <Text style={styles.remainingValue}>
                  {remainingCals < 0 ? Math.abs(remainingCals) : remainingCals}
                </Text>
                <Text style={styles.remainingLabel}>
                  {remainingCals < 0 ? 'OVER' : 'REMAINING'}
                </Text>
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
            <MacroRing
              key={`protein-${nutrientTotals.protein}-${macroGoals.protein}-${lastUpdated}`}
              label="PROTEIN"
              percent={macrosLoading ? 0 : (nutrientTotals.protein / macroGoals.protein) * 100}
              current={macrosLoading ? 0 : nutrientTotals.protein}
              goal={macroGoals.protein}
            />
            <MacroRing
              key={`carbs-${nutrientTotals.carbs}-${macroGoals.carbs}-${lastUpdated}`}
              label="CARBS"
              percent={macrosLoading ? 0 : (nutrientTotals.carbs / macroGoals.carbs) * 100}
              current={macrosLoading ? 0 : nutrientTotals.carbs}
              goal={macroGoals.carbs}
            />
            <MacroRing
              key={`fats-${nutrientTotals.fat}-${macroGoals.fat}-${lastUpdated}`}
              label="FATS"
              percent={macrosLoading ? 0 : (nutrientTotals.fat / macroGoals.fat) * 100}
              current={macrosLoading ? 0 : nutrientTotals.fat}
              goal={macroGoals.fat}
            />
            <MacroRing
              label="OTHER"
              percent={100}
              current={0}
              goal={0}
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
      </ScrollView>
      {renderWeightModal()}
      <WelcomePremiumModal
        visible={showWelcomeModal}
        onClose={() => {
          setShowWelcomeModal(false);
          markWelcomeModalShown();
        }}
      />
    </SafeAreaView>
  );
}

/************************************
 *  WEIGHT GRAPH COMPONENT
 ************************************/
function WeightGraph({ data, onAddPress, weightLoading, showTodayWeight, todayWeight }: { data: { date: string; weight: number }[]; onAddPress: () => void; weightLoading: boolean; showTodayWeight: boolean; todayWeight: number | null }) {
  // Dimensions for the chart - use more of the available width
  const GRAPH_WIDTH = 0.98 * width;
  const GRAPH_HEIGHT = 250; // Increased height to 250 from 220
  const MARGIN_RIGHT = 60; // Increased right margin from 45 to 60
  const MARGIN_LEFT = 35; // Reduced left margin to shift graph left
  const MARGIN_BOTTOM = 60; // Increased bottom margin for date labels
  const MARGIN_TOP = 30; // Top margin
  const EXTRA_RIGHT_PADDING = 30; // Increased from 20 to 30 for more space on the right

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

  // Calculate optimal Y-axis range for better visualization
  const calculateOptimalYRange = (values: number[]) => {
    if (values.length === 0) return [0, 100];

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // For longer time periods, use a wider context
    const timeRangeFactor = Math.min(1.5, 1 + (combinedData.length / 30)); // Gradually increase context with more data points

    // Calculate range padding based on the weight range and time range
    const rangePadding = Math.max(
      1, // Minimum padding
      (maxVal - minVal) * 0.15 * timeRangeFactor // Dynamic padding based on range and time
    );

    // If range is very small, add more padding to make changes more visible
    if (maxVal - minVal < 2) {
      return [Math.max(0, minVal - rangePadding), maxVal + rangePadding];
    }

    // Otherwise, add proportional padding
    return [Math.max(0, minVal - rangePadding / 2), maxVal + rangePadding / 2];
  };

  const [minWeight, maxWeight] = calculateOptimalYRange(yValues);

  // Add a small buffer so points aren't at the very edges
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minWeight, maxWeight])
    .range([GRAPH_HEIGHT - MARGIN_BOTTOM, MARGIN_TOP]); // Updated to use MARGIN_TOP and MARGIN_BOTTOM

  // Calculate optimal spacing between data points based on available width
  const availableWidth = GRAPH_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  // Ensure we have enough space between points, but not too much
  const minSpacing = 40; // Minimum space between points (pixels)
  const maxSpacing = 80; // Maximum space between points (pixels)
  const calculatedSpacing = availableWidth / (combinedData.length > 1 ? combinedData.length - 1 : 1);
  const optimalSpacing = Math.min(maxSpacing, Math.max(minSpacing, calculatedSpacing));

  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN_LEFT, GRAPH_WIDTH - MARGIN_RIGHT]);

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
    .y0(GRAPH_HEIGHT - MARGIN_BOTTOM) // Bottom of the graph
    .y1(d => scaleY(d.weight))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the line curve

  const pathData = lineGenerator(combinedData);
  const areaData = areaGenerator(combinedData);

  // Select a subset of x-axis labels to prevent crowding
  const shouldShowLabel = (i: number) => {
    if (combinedData.length <= 4) return true; // Show all labels if 4 or fewer points
    if (i === 0 || i === combinedData.length - 1) return true; // Always show first and last
    // If more than 8 points, show fewer labels
    if (combinedData.length > 8) {
      return i % Math.ceil(combinedData.length / 4) === 0; // Show approximately 4 labels total
    }
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
          marginBottom: -10
        }}
      >
        <Text style={styles.weightGraphTitle}>Weight Trend:</Text>
        <TouchableOpacity
          onPress={onAddPress}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderWidth: 1,
            borderColor: 'rgba(156, 39, 176, 0.4)',
            shadowColor: '#9B00FF',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <MaterialCommunityIcons name="pencil" size={18} color="#9B00FF" />
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
        <ScrollView
          horizontal
          style={{ width: '100%' }}
          contentContainerStyle={{ paddingRight: 35, paddingLeft: 0 }} // Increased right padding from 20 to 35
          showsHorizontalScrollIndicator={false}
        >
          <Svg
            width={Math.max(GRAPH_WIDTH, optimalSpacing * (combinedData.length - 1) + MARGIN_LEFT + MARGIN_RIGHT + EXTRA_RIGHT_PADDING)}
            height={GRAPH_HEIGHT}
            style={{ backgroundColor: 'transparent' }}
          >
            {/* ───────── GRID + AXES ───────── */}
            <G>
              {/* Horizontal grid + Y labels */}
              {yTickValues.map((tickValue) => {
                const yCoord = scaleY(tickValue);
                return (
                  <React.Fragment key={`y-tick-${tickValue}`}>
                    <SvgLine
                      x1={MARGIN_LEFT}
                      x2={GRAPH_WIDTH - MARGIN_RIGHT}
                      y1={yCoord}
                      y2={yCoord}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={MARGIN_LEFT - 5}
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
                const isLastLabel = i === combinedData.length - 1;

                return (
                  <React.Fragment key={`x-tick-${i}`}>
                    <SvgLine
                      x1={xCoord}
                      x2={xCoord}
                      y1={GRAPH_HEIGHT - MARGIN_BOTTOM}
                      y2={MARGIN_TOP}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={1}
                    />
                    {shouldShowLabel(i) && (
                      <SvgText
                        x={xCoord}
                        y={GRAPH_HEIGHT - MARGIN_BOTTOM / 2}
                        fill={isLastLabel ? "#FFA500" : "#FFF"}
                        fontSize={isLastLabel ? 13 : 10} // Increased font size for last label from 12 to 13
                        fontWeight={isLastLabel ? "bold" : "normal"}
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

                // Only render dots for certain points to reduce visual clutter
                if (i === 0 || i === combinedData.length - 1 || i % 3 === 0) {
                  return (
                    <Circle
                      key={`circle-${i}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="rgba(255,69,0,0.6)"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={0.5}
                    />
                  );
                }
                return null;
              })}
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
  const GRAPH_WIDTH = 0.98 * width;
  const GRAPH_HEIGHT = 230; // Increased height to 230 from 200
  const MARGIN_RIGHT = 60; // Increased right margin from 45 to 60
  const MARGIN_LEFT = 35; // Reduced left margin to shift graph left
  const MARGIN_BOTTOM = 60; // Increased bottom margin for date labels
  const MARGIN_TOP = 30; // Top margin
  const EXTRA_RIGHT_PADDING = 30; // Increased from 20 to 30 for more space on the right

  // X-values
  const xValues = data.map((_, i) => i);
  // Y-values: steps
  const yValues = data.map(d => d.steps);

  // Calculate optimal Y-axis range
  const calculateOptimalYRange = (values: number[]) => {
    if (values.length === 0) return [0, 10000];

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // For longer time periods, use a wider context
    const timeRangeFactor = Math.min(1.5, 1 + (data.length / 30)); // Gradually increase context with more data points

    // For steps, always start at 0 and add good padding on top
    const topPadding = Math.max(1000, maxVal * 0.2 * timeRangeFactor); // Adjust padding based on time range

    return [0, maxVal + topPadding]; // Add padding to the top only
  };

  const [minSteps, maxSteps] = calculateOptimalYRange(yValues);

  // Use the optimal range for Y scale
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minSteps, maxSteps])
    .range([GRAPH_HEIGHT - MARGIN_BOTTOM, MARGIN_TOP]); // Updated to use MARGIN_TOP and MARGIN_BOTTOM

  // Calculate optimal spacing between data points based on available width
  const availableWidth = GRAPH_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  // Ensure we have enough space between points, but not too much
  const minSpacing = 40; // Minimum space between points (pixels)
  const maxSpacing = 80; // Maximum space between points (pixels)
  const calculatedSpacing = availableWidth / (data.length > 1 ? data.length - 1 : 1);
  const optimalSpacing = Math.min(maxSpacing, Math.max(minSpacing, calculatedSpacing));

  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN_LEFT, GRAPH_WIDTH - MARGIN_RIGHT]);

  // Ticks - use the optimal range
  const yTickValues = d3Scale.scaleLinear().domain([minSteps, maxSteps]).ticks(5);

  // Straight lines
  const lineGenerator = d3Shape
    .line<{ date: string; steps: number }>()
    .x((d, i) => scaleX(i))
    .y(d => scaleY(d.steps))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the WeightGraph curve type

  const areaGenerator = d3Shape
    .area<{ date: string; steps: number }>()
    .x((d, i) => scaleX(i))
    .y0(GRAPH_HEIGHT - MARGIN_BOTTOM) // Bottom of the graph
    .y1(d => scaleY(d.steps))
    .curve(d3Shape.curveCatmullRom.alpha(0.5)); // Match the line curve

  const pathData = lineGenerator(data);
  const areaData = areaGenerator(data);

  // Select a subset of x-axis labels to prevent crowding
  const shouldShowLabel = (i: number) => {
    if (data.length <= 4) return true; // Show all labels if 4 or fewer points
    if (i === 0 || i === data.length - 1) return true; // Always show first and last
    // If more than 8 points, show fewer labels
    if (data.length > 8) {
      return i % Math.ceil(data.length / 4) === 0; // Show approximately 4 labels total
    }
    return i % Math.ceil(data.length / 5) === 0; // Show approximately 5 labels total
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingBottom: 5 }}>
      <View
        style={{
          width: '90%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: -10
        }}
      >
        <Text style={styles.weightGraphTitle}>Steps Trend:</Text>
        <TouchableOpacity
          onPress={() => console.log('Add more steps!')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderWidth: 1,
            borderColor: 'rgba(30, 144, 255, 0.4)',
            shadowColor: '#1E90FF',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <MaterialCommunityIcons name="walk" size={18} color="#1E90FF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        style={{ width: '100%' }}
        contentContainerStyle={{ paddingRight: 35, paddingLeft: 0 }} // Increased right padding from 20 to 35
        showsHorizontalScrollIndicator={false}
      >
        <Svg
          width={Math.max(GRAPH_WIDTH, optimalSpacing * (data.length - 1) + MARGIN_LEFT + MARGIN_RIGHT + EXTRA_RIGHT_PADDING)}
          height={GRAPH_HEIGHT}
          style={{ backgroundColor: 'transparent' }}
        >
          <G>
            {/* Horizontal grid + Y labels */}
            {yTickValues.map((tickValue) => {
              const yCoord = scaleY(tickValue);
              return (
                <React.Fragment key={`steps-y-${tickValue}`}>
                  <SvgLine
                    x1={MARGIN_LEFT}
                    x2={GRAPH_WIDTH - MARGIN_RIGHT}
                    y1={yCoord}
                    y2={yCoord}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={MARGIN_LEFT - 5}
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
              const isLastLabel = i === data.length - 1;

              return (
                <React.Fragment key={`steps-x-${i}`}>
                  <SvgLine
                    x1={xCoord}
                    x2={xCoord}
                    y1={GRAPH_HEIGHT - MARGIN_BOTTOM}
                    y2={MARGIN_TOP}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1}
                  />
                  {shouldShowLabel(i) && (
                    <SvgText
                      x={xCoord}
                      y={GRAPH_HEIGHT - MARGIN_BOTTOM / 2}
                      fill={isLastLabel ? "#FFA500" : "#FFF"} // Highlight the last label
                      fontSize={isLastLabel ? 13 : 10} // Increased font size for last label from 12 to 13
                      fontWeight={isLastLabel ? "bold" : "normal"} // Bold for the last label
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
  current: number; // current grams consumed
  goal: number; // goal grams from database
  onPress?: () => void;
}

const MacroRing = React.memo(({ label, percent, current, goal, onPress }: MacroRingProps) => {
  const MACRO_STROKE_WIDTH = 6;
  const isOther = label.toUpperCase() === 'OTHER';
  
  // Always recalculate diff to ensure it's fresh
  const diff = goal - current;
  let subText = '';
  let subTextColor = '';

  // Always recalculate subText based on current diff
  if (!isOther) {
    if (diff > 0) {
      subText = `${Math.round(diff)}g Left`;
      subTextColor = '#9E9E9E';
    } else if (diff < 0) {
      subText = `${Math.round(Math.abs(diff))}g over`;
      subTextColor = '#FF8A80';
    } else {
      subText = 'Goal met';
      subTextColor = '#4CAF50';
    }
  } else {
    subTextColor = '#9E9E9E'; // "Nutrients"
  }

  // Debug logging AFTER calculating subText
  if (!isOther) {
    console.log(`🔍 MacroRing ${label}:`, { 
      current: Math.round(current * 100) / 100, 
      goal: Math.round(goal * 100) / 100, 
      diff: Math.round(diff * 100) / 100, 
      subText: subText
    });
  }

  const radius = (MACRO_RING_SIZE - MACRO_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  // Don't cap the percent for display, but cap the fill stroke to not exceed the circumference
  const cappedPercent = percent;
  const fillStroke = Math.min(circumference, (percent / 100) * circumference);

  // Custom solid colors for each macro ring
  let solidColor = '#FF00F5'; // default
  let backgroundStrokeColor = 'rgba(80, 0, 133, 0.2)'; // default subdued background
  switch (label.toUpperCase()) {
    case 'PROTEIN':
      solidColor = '#DE0707'; // Custom red: rgb(222, 7, 7)
      backgroundStrokeColor = 'rgba(222, 7, 7, 0.2)'; // subdued custom red
      break;
    case 'CARBS':
      solidColor = '#0052CC'; // Richer blue: rgb(0, 82, 204)
      backgroundStrokeColor = 'rgba(0, 82, 204, 0.2)'; // subdued richer blue
      break;
    case 'FATS':
      solidColor = '#19BF32'; // Custom green: rgb(25, 191, 50)
      backgroundStrokeColor = 'rgba(25, 191, 50, 0.2)'; // subdued custom green
      break;
    case 'OTHER':
      backgroundStrokeColor = 'rgba(80, 0, 133, 0.2)'; // subdued purple for OTHER
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
          {isOther && (
            <Defs>
              <SvgLinearGradient id={`macroGradient-${label}`} {...gradientDirection}>
                <Stop offset="0%" stopColor="#00A8FF" />
                <Stop offset="10%" stopColor="#00A8FF" />
                <Stop offset="60%" stopColor="#9B00FF" />
                <Stop offset="100%" stopColor="#FF00F5" />
              </SvgLinearGradient>
            </Defs>
          )}
          <Circle
            cx={MACRO_RING_SIZE / 2}
            cy={MACRO_RING_SIZE / 2}
            r={radius}
            stroke={backgroundStrokeColor}
            strokeWidth={MACRO_STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={MACRO_RING_SIZE / 2}
            cy={MACRO_RING_SIZE / 2}
            r={radius}
            stroke={isOther ? `url(#macroGradient-${label})` : solidColor}
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
            stroke={isOther ? `url(#macroGradient-${label})` : solidColor}
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
});

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
    fontStyle: 'italic',
    fontWeight: 'bold',
    fontFamily: 'Courier New',
    textAlign: 'center',
    flex: 1,
  },
  burnDetailsGain: {
    color: '#FF9999',
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
    marginTop: 10,
    minHeight: 280 // Added minimum height to accommodate taller graphs
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
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(80, 80, 80, 0.5)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  weightInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
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
  buttonText: {
    color: '#fff',
    fontWeight: '500',
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
  // Streak indicator styles
  streakContainer: {
    position: 'absolute',
    top: -18,
    right: -12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 10, // Ensure it appears above other elements
  },
  streakText: {
    color: '#FFF', // Changed to white since gradient will handle color
    fontSize: 18,
    fontWeight: 'bold'
  },
  // Goal card analytics button styles
  goalCardAnalyticsButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(155, 0, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(155, 0, 255, 0.3)',
    zIndex: 10,
  },
  goalCardAnalyticsMask: {
    width: 22,
    height: 22,
  },
  goalCardAnalyticsGradient: {
    width: 22,
    height: 22,
  },
});