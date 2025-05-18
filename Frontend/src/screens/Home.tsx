import React, { useState, useContext, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { G, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useSteps } from '../context/StepContext';
import { getTodayCalories, getTodayExerciseCalories, getTodayProtein, getTodayCarbs, getTodayFats } from '../utils/database';
import { useAuth } from '../context/AuthContext';
import { getUserProfileByFirebaseUid } from '../utils/database';
import { calculateNutritionGoals, getDefaultNutritionGoals } from '../utils/nutritionCalculator';

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
  ActivityIndicator
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
const WeightLost = 8;

// Cheat day data
const cheatDaysTotal = 7;
const cheatDaysCompleted = 3;
const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100;

// Weight history data
const weightHistory = [
  { date: '11/03', weight: 104 },
  { date: '12/03', weight: 98 },
  { date: '02/01', weight: 107 }
];

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
            syncDataOffline: profile.sync_data_offline
          });

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

  // Fetch food calories from the database
  useEffect(() => {
    const fetchCalories = async () => {
      try {
        setFoodLoading(true);
        const calories = await getTodayCalories();
        setConsumedCalories(calories);

        // Calculate percentage based on current goal
        setPercentCons((calories / dailyCalorieGoal) * 100);
      } catch (error) {
        console.error('Error fetching calories:', error);
        // Keep default values if there's an error
      } finally {
        setFoodLoading(false);
      }
    };

    // Only fetch if profile is loaded
    if (!profileLoading) {
      fetchCalories();
    }
  }, [dailyCalorieGoal, profileLoading]);

  // Fetch exercise calories from the database
  useEffect(() => {
    const fetchExerciseCalories = async () => {
      try {
        setExerciseLoading(true);
        const calories = await getTodayExerciseCalories();
        setExerciseCalories(calories);

        // Now that we have both food and exercise calories, calculate remaining calories
        setRemainingCals(dailyCalorieGoal - consumedCalories + calories);
      } catch (error) {
        console.error('Error fetching exercise calories:', error);
        // Keep default values if there's an error
      } finally {
        setExerciseLoading(false);
      }
    };

    // Only fetch if food calories are loaded
    if (!foodLoading) {
      fetchExerciseCalories();
    }
  }, [consumedCalories, dailyCalorieGoal, foodLoading]);

  // Fetch macros from the database
  useEffect(() => {
    const fetchMacros = async () => {
      try {
        setMacrosLoading(true);
        const [proteinVal, carbsVal, fatsVal] = await Promise.all([
          getTodayProtein(),
          getTodayCarbs(),
          getTodayFats(),
        ]);
        setProtein(proteinVal);
        setCarbs(carbsVal);
        setFats(fatsVal);
      } catch (error) {
        console.error('Error fetching macros:', error);
        setProtein(0);
        setCarbs(0);
        setFats(0);
      } finally {
        setMacrosLoading(false);
      }
    };
    fetchMacros();
  }, []);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }}>
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
        <GradientBorderCard>
          <View style={styles.burnContainer}>
            <Text style={styles.burnTitle}>Weight Lost</Text>
            <View style={styles.burnBarBackground}>
              <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                colors={['#006400', '#006400', '#00FF00']} // smoother gradient, first half dark green
                style={[styles.burnBarFill, { width: `${Math.min((WeightLost / 10) * 100, 100)}%` }]} // dynamically adjust width
              />
            </View>
            <View style={styles.weightLabelsContainer}>
              <Text style={styles.weightLabel}>104 kg</Text>
              <Text style={styles.burnDetails}>{WeightLost} Kilograms Lost!</Text> {/* Centered text */}
              <Text style={styles.weightLabel}>96 kg</Text>
            </View>
          </View>
        </GradientBorderCard>

        {/* Add space between the cards */}
        <View style={{ height: 4 }} />

        {/* -- TREND CARDS WRAPPED IN A HORIZONTAL SCROLL -- */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ width: '100%' }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {/* WEIGHT TREND CARD (1st page) */}
          <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
            <GradientBorderCard>
              <View style={styles.trendContainer}>
                <WeightGraph data={weightHistory} />
              </View>
            </GradientBorderCard>
          </View>

          {/* STEPS TREND CARD (2nd page) */}
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
    </SafeAreaView>
  );
}

/************************************
 *  WEIGHT GRAPH COMPONENT
 ************************************/
function WeightGraph({ data }: { data: { date: string; weight: number }[] }) {
  // Dimensions for the chart
  const GRAPH_WIDTH = 0.94 * width;
  const GRAPH_HEIGHT = 220;
  const MARGIN = 30; // a bit bigger margin for labels

  // X-values: indices of data
  const xValues = data.map((_, i) => i);
  // Y-values: actual weight
  const yValues = data.map(d => d.weight);

  // Build scales
  const minWeight = Math.min(...yValues);
  const maxWeight = Math.max(...yValues);

  // Add a small top buffer (+1) so final dot isn't at the very top
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minWeight, maxWeight + 1])
    .range([GRAPH_HEIGHT - MARGIN, MARGIN]);

  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN, GRAPH_WIDTH - MARGIN]);

  // We'll get about 4-5 ticks for Y
  const yTickValues = d3Scale.scaleLinear().domain([minWeight, maxWeight + 1]).ticks(5);

  // Straight lines between points
  const lineGenerator = d3Shape
    .line<{ date: string; weight: number }>()
    .x((d, i) => scaleX(i))
    .y(d => scaleY(d.weight))
    .curve(d3Shape.curveLinear);

  const pathData = lineGenerator(data);

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingBottom: 5 }}>
      {/* TITLE + PLUS ICON */}
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
        <TouchableOpacity onPress={() => console.log('Add more dates!')}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* SCROLLABLE CHART */}
      <ScrollView horizontal style={{ width: '100%' }} showsHorizontalScrollIndicator={false}>
        <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} style={{ backgroundColor: 'transparent' }}>
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
                    {tickValue}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Vertical grid + X labels */}
            {data.map((d, i) => {
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

          {/* ───────── LINE + POINTS ───────── */}
          <G>
            {pathData && (
              <Path
                d={pathData}
                fill="none"
                stroke="#FF6347"  // changed color to tomato
                strokeWidth={2}
              />
            )}
            {data.map((d, i) => {
              const cx = scaleX(i);
              const cy = scaleY(d.weight);
              return (
                <Circle
                  key={`circle-${i}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="#FF4500"  // changed color to orange red
                  stroke="#FFF"
                  strokeWidth={1}
                />
              );
            })}
          </G>
        </Svg>
      </ScrollView>
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
    .curve(d3Shape.curveLinear);

  const pathData = lineGenerator(data);

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
            {pathData && (
              <Path
                d={pathData}
                fill="none"
                stroke="#1E90FF"  // changed color to dodger blue
                strokeWidth={2}
              />
            )}
            {data.map((d, i) => {
              const cx = scaleX(i);
              const cy = scaleY(d.steps);
              return (
                <Circle
                  key={`steps-circle-${i}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="#4169E1"  // changed color to royal blue
                  stroke="#FFF"
                  strokeWidth={1}
                />
              );
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
});
