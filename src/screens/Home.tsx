import React from 'react';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';

import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path
} from 'react-native-svg';

// Using Expo’s LinearGradient:
import { LinearGradient } from 'expo-linear-gradient';

// d3 for our line chart
import * as d3Scale from 'd3-scale';
import * as d3Shape from 'd3-shape';

const { width } = Dimensions.get('window');

// Main ring dimensions
const CIRCLE_SIZE = width * 0.55;
const STROKE_WIDTH = 20;

// Macro ring dimensions
const MACRO_RING_SIZE = 60;

// ─────────────────────────────────────────────────────────────────────────────
// DUMMY DATA
// ─────────────────────────────────────────────────────────────────────────────
const dailyCalorieGoal = 2500;
const consumedCalories = 1022;
const remainingCalories = dailyCalorieGoal - consumedCalories;
const percentConsumed = (consumedCalories / dailyCalorieGoal) * 100;

const fatPercent = 20;
const carbsPercent = 70;
const proteinPercent = 40;
const totalBurned = 500;
const stepsCount = 4500;

// Cheat day data
const cheatDaysTotal = 7;
const cheatDaysCompleted = 3;
const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100;

// Weight history data
const weightHistory = [
  { date: '11/03', weight: 104 },
  { date: '12/03', weight: 98 },
  { date: '02/01', weight: 107 },
];

export default function Home() {
  const navigation = useNavigation();

  // Calculate values for the main ring.
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedStroke = (percentConsumed / 100) * circumference;

  // Data for the right card.
  const rightStats = [
    { label: 'Goal', value: dailyCalorieGoal, icon: 'flag-outline' },
    { label: 'Food', value: consumedCalories, icon: 'restaurant-outline' },
    { label: 'Exercise', value: totalBurned, icon: 'barbell-outline' },
    { label: 'Steps', value: stepsCount, icon: 'walk', iconSet: 'MaterialCommunityIcons' }
  ];

  return (
    <SafeAreaView style={styles.container}>
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

        {/* MAIN RING + RIGHT CARD */}
        <View style={styles.ringAndRightCard}>
          {/* MAIN RING */}
          <View style={styles.ringContainer}>
            <View style={styles.ringGlow} />
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              <Defs>
                <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#FF00F5" />
                  <Stop offset="50%" stopColor="#9B00FF" />
                  <Stop offset="100%" stopColor="#00CFFF" />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.14)"
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
                strokeLinecap="round"
                transform={`rotate(-90, ${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.centerTextContainer}>
              <Text style={styles.remainingValue}>{remainingCalories}</Text>
              <Text style={styles.remainingLabel}>REMAINING</Text>
            </View>
          </View>

          {/* RIGHT VERTICAL CARD */}
          <View style={styles.rightCard}>
            {rightStats.map((item) => {
              const IconComponent =
                item.iconSet === 'MaterialCommunityIcons'
                  ? MaterialCommunityIcons
                  : Ionicons;
              return (
                <View key={item.label} style={styles.statRow}>
                  <IconComponent
                    name={item.icon}
                    size={20}
                    color="#FF00F5"
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    <Text style={styles.statValue}>{item.value}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

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

        {/* WEIGHT LOST CARD */}
        <View style={styles.card}>
          <View style={styles.burnContainer}>
            <Text style={styles.burnTitle}>Weight Lost</Text>
            <View style={styles.burnBarBackground}>
              <View style={[styles.burnBarFill, { width: '70%' }]} />
            </View>
            <Text style={styles.burnDetails}>{totalBurned} Calories burned</Text>
          </View>
        </View>

        {/* WEIGHT TREND CARD */}
        <View style={styles.card}>
          <WeightGraph data={weightHistory} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ────────────────────────────────────────────
 *  WEIGHT GRAPH COMPONENT
 *  Using d3-scale + d3-shape
 *  ────────────────────────────────────────────
 */
function WeightGraph({ data }: { data: { date: string; weight: number }[] }) {
  // Dimensions for the chart
  const GRAPH_WIDTH = 0.9 * width;
  const GRAPH_HEIGHT = 200;
  const MARGIN = 20;

  // X-values: just indices of data
  const xValues = data.map((_, i) => i);
  // Y-values: actual weight
  const yValues = data.map(d => d.weight);

  // Build scales
  const scaleX = d3Scale
    .scaleLinear()
    .domain([0, xValues.length - 1])
    .range([MARGIN, GRAPH_WIDTH - MARGIN]);

  const minWeight = Math.min(...yValues);
  const maxWeight = Math.max(...yValues);
  const scaleY = d3Scale
    .scaleLinear()
    .domain([minWeight - 1, maxWeight + 1]) // small buffer
    .range([GRAPH_HEIGHT - MARGIN, MARGIN]);

  // Generate path
  const lineGenerator = d3Shape
    .line<{ date: string; weight: number }>()
    .x((d, i) => scaleX(i))
    .y(d => scaleY(d.weight))
    .curve(d3Shape.curveMonotoneX);

  const pathData = lineGenerator(data);

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <Text style={styles.weightGraphTitle}>Weight Trend</Text>
      <ScrollView horizontal style={{ width: '100%' }}>
        <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} style={{ backgroundColor: 'transparent' }}>
          {/* line path */}
          <Path
            d={pathData || ''}
            fill="none"
            stroke="#9B00FF"
            strokeWidth={2}
          />
          {/* data points */}
          {data.map((d, i) => {
            const cx = scaleX(i);
            const cy = scaleY(d.weight);
            return (
              <Circle
                key={`circle-${i}`}
                cx={cx}
                cy={cy}
                r={4}
                fill="#FF00F5"
                stroke="#FFF"
                strokeWidth={1}
              />
            );
          })}
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
  let subText = "";
  let subTextColor = "";

  if (!isOther) {
    if (diff > 0) {
      subText = `${diff}g Left`;
      subTextColor = "#9E9E9E";
    } else if (diff < 0) {
      subText = `${Math.abs(diff)}g over`;
      subTextColor = "#FF8A80";
    } else {
      subText = `Goal met`;
      subTextColor = "#ccc";
    }
  } else {
    // For "OTHER", we just say "Nutrients"
    subTextColor = "#9E9E9E";
  }

  const radius = (MACRO_RING_SIZE - MACRO_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillStroke = (percent / 100) * circumference;

  // Wrap the ring in a Touchable if onPress provided
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.macroRingWrapper} onPress={onPress}>
      {/* Macro name above the ring */}
      <Text style={styles.macroRingLabelTop}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <Svg width={MACRO_RING_SIZE} height={MACRO_RING_SIZE}>
          <Defs>
            <SvgLinearGradient id={`macroGradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FF00F5" />
              <Stop offset="50%" stopColor="#9B00FF" />
              <Stop offset="100%" stopColor="#00CFFF" />
            </SvgLinearGradient>
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
            strokeLinecap="round"
            transform={`rotate(-90, ${MACRO_RING_SIZE / 2}, ${MACRO_RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.macroRingCenter}>
          {isOther ? (
            <MaskedView
              style={{ height: 40, width: 40 }} // <— Larger container
              maskElement={
                <View
                  style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'transparent'
                  }}
                >
                  <MaterialCommunityIcons
                    name="food-apple"
                    size={40} // <— Larger icon
                    color="black"
                  />
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
          ) : (
            <Text style={styles.macroRingText}>{percent}%</Text>
          )}
        </View>
      </View>
      {/* Sub-label */}
      <Text style={[styles.macroRingSubLabel, { color: subTextColor }]}>
        {isOther ? "Nutrients" : subText}
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
    paddingTop: 20
  },
  card: {
    width: '95%',
    backgroundColor: 'hsla(0, 0%, 100%, 0.11)',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
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
    textTransform: 'uppercase'
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
    position: 'relative'
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
    fontWeight: 'bold'
  },
  remainingLabel: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase'
  },
  rightCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    marginBottom: 4
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
    marginTop: 4
  },
  /* Weight Trend */
  weightGraphTitle: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
});
