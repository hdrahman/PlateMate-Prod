import React, { useState, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { G, Line as SvgLine, Text as SvgText } from 'react-native-svg';

import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent
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

const MACRO_RING_SIZE = 60;

// ─────────────────────────────────────────────────────────────────────────────
// DUMMY DATA
// ─────────────────────────────────────────────────────────────────────────────
const dailyCalorieGoal = 2500;
const consumedCalories = 1022;
const remainingCalories = dailyCalorieGoal - consumedCalories;
const percentConsumed = (consumedCalories / dailyCalorieGoal) * 100;

const fatPercent = 30;
const carbsPercent = 70;
const proteinPercent = 40;
const totalBurned = 500;
const stepsCount = 4500;
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

export default function Home() {
  const navigation = useNavigation();
  const { isDarkTheme } = useContext(ThemeContext);
  // Keep track of which "page" (card) we are on in the horizontal scroll
  const [activeIndex, setActiveIndex] = useState(0);
  // Handler: updates activeIndex when user scrolls horizontally
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    setActiveIndex(newIndex);
  };

  // Calculate values for the main ring.
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedStroke = (percentConsumed / 100) * circumference;

  // Data for the right card with updated colors.
  const rightStats = [
    { label: 'Goal', value: dailyCalorieGoal, icon: 'flag-outline', color: '#FFB74D' }, // warm orange hue
    { label: 'Food', value: consumedCalories, icon: 'restaurant-outline', color: '#FF8A65' }, // soft red hue
    { label: 'Exercise', value: totalBurned, icon: 'barbell-outline', color: '#66BB6A' }, // updated green
    {
      label: 'Steps',
      value: stepsCount,
      icon: 'walk',
      iconSet: 'MaterialCommunityIcons',
      color: '#E040FB' // updated purple
    }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* CHEAT DAY CARD */}
        <View style={styles.card}>
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
        </View>

        {/* Add space between the cards */}
        <View style={{ height: 6 }} />

        {/* GOAL CARD (Unified circular bar + stats overlay) */}
        <View style={styles.goalCard}>
          <View style={styles.ringContainer}>
            <View style={styles.ringGlow} />
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
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
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#ringGradient)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - consumedStroke}
                strokeLinecap="butt"
                transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#ringGradient)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - consumedStroke}
                strokeLinecap="round"
                transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#exerciseGradient)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - (totalBurned / dailyCalorieGoal) * circumference}
                strokeLinecap="butt"
                transform={`rotate(198, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`} // Counter-clockwise from 12 o'clock
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#exerciseGradient)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - (totalBurned / dailyCalorieGoal) * circumference}
                strokeLinecap="round"
                transform={`rotate(198, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`} // Counter-clockwise from 12 o'clock
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#eatenGradient)" // Gradient for calories eaten bar
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - consumedStroke}
                strokeLinecap="butt"
                transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
              />
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="url(#eatenGradient)" // Gradient for calories eaten bar
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference - consumedStroke}
                strokeLinecap="round"
                transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.centerTextContainer}>
              <Text style={styles.remainingValue}>{remainingCalories}</Text>
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
                    <Text style={styles.statValue}>{item.value}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Add space between the cards */}
        <View style={{ height: 5 }} />

        {/* MACROS CARD */}
        <View style={styles.card}>
          <View style={styles.macrosRow}>
            <MacroRing label="PROTEIN" percent={proteinPercent} current={proteinPercent} />
            <MacroRing label="CARBS" percent={carbsPercent} current={carbsPercent} />
            <MacroRing label="FATS" percent={fatPercent} current={fatPercent} />
            <MacroRing
              label="OTHER"
              percent={100}
              current={0}
              onPress={() => navigation.navigate('Nutrients' as never)}
            />
          </View>
        </View>

        {/* Add space between the cards */}
        <View style={{ height: 5 }} />

        {/* WEIGHT LOST CARD */}
        <View style={styles.card}>
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
        </View>

        {/* Add space between the cards */}
        <View style={{ height: 6 }} />

        {/* -- TREND CARDS WRAPPED IN A HORIZONTAL SCROLL -- */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ width: '100%' }}
        >
          {/* WEIGHT TREND CARD (1st page) */}
          <View style={{ width }}>
            <View style={[styles.card, { width: '95%', marginLeft: '2.5%' }]}>
              <View style={styles.trendContainer}>
                <WeightGraph data={weightHistory} />
              </View>
            </View>
          </View>

          {/* STEPS TREND CARD (2nd page) */}
          <View style={{ width }}>
            <View style={[styles.card, { width: '95%', marginLeft: '2.5%' }]}>
              <View style={styles.trendContainer}>
                <StepsGraph data={stepsHistory} />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* PAGINATION DOTS */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, activeIndex === 0 && styles.dotActive]} />
          <View style={[styles.dot, activeIndex === 1 && styles.dotActive]} />
        </View>
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

  // Add a small top buffer (+1) so final dot isn’t at the very top
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
  const fillStroke = (percent / 100) * circumference;

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
            <Text style={styles.macroRingText}>{percent}%</Text>
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
    marginRight: 22, // Add space between the circle and the stack
    marginLeft: 18 // Add space between the circle and the left edge
  },
  ringGlow: {
    position: 'absolute',
    width: CIRCLE_SIZE - STROKE_WIDTH * 2,
    height: CIRCLE_SIZE - STROKE_WIDTH * 2,
    borderRadius: CIRCLE_SIZE,
    backgroundColor: '#9B00FF',
    opacity: 0.2,
    top: STROKE_WIDTH,
    left: STROKE_WIDTH
  },
  centerTextContainer: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center'
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
    backgroundColor: '#FF00F5'
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
    backgroundColor: '#FFF'
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
    paddingLeft: 10, // Adjust padding to ensure the stack is next to the circle
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
});
