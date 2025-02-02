import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

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
  Stop
} from 'react-native-svg';

// If you're using Expo:
import { LinearGradient } from 'expo-linear-gradient';
// If not Expo, you'd likely do: import LinearGradient from 'react-native-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Make the main ring slightly smaller (55% of screen width)
const CIRCLE_SIZE = width * 0.55;
const STROKE_WIDTH = 20;

const MACRO_RING_SIZE = 60;
const MACRO_STROKE_WIDTH = 6;

// Dummy data
const dailyCalorieGoal = 2500;
const consumedCalories = 1022;
const remainingCalories = dailyCalorieGoal - consumedCalories; // 1478
const percentConsumed = (consumedCalories / dailyCalorieGoal) * 100;

const fatPercent = 20;
const carbsPercent = 70;
const proteinPercent = 40;
const morePercent = 55;
const totalBurned = 500;
const stepsCount = 4500;

// Cheat day data
const cheatDaysTotal = 7;
const cheatDaysCompleted = 3;
const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100;

export default function Home() {
  // Big ring math
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedStroke = (percentConsumed / 100) * circumference;

  // Right card items (no circles)
  const rightStats = [
    { label: 'Goal', value: dailyCalorieGoal, icon: 'flag-outline' },
    { label: 'Food', value: consumedCalories, icon: 'restaurant-outline' },
    { label: 'Exercise', value: totalBurned, icon: 'barbell-outline' },
    // For Steps, we use MaterialCommunityIcons with 'foot-print'
    { label: 'Steps', value: stepsCount, icon: 'walk', iconSet: 'MaterialCommunityIcons' }
  ];//shoe-print, walk

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* CHEAT DAY BAR */}
        <View style={styles.cheatDayContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cheatDayLabel}>Days until cheat day</Text>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => { }}>
              <Ionicons name="settings-outline" size={20} color="#FFF" />
            </TouchableOpacity>
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

        {/* RING + VERTICAL CARD */}
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

              {/* Background circle */}
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={radius}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Foreground arc */}
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

            {/* Center text */}
            <View style={styles.centerTextContainer}>
              <Text style={styles.remainingValue}>{remainingCalories}</Text>
              <Text style={styles.remainingLabel}>REMAINING</Text>
            </View>

            {/* SHIFTED to top-left for % consumed */}
            <View style={styles.consumedContainer}>
              <Text style={styles.consumedValue}>
                {Math.round(percentConsumed)}%
              </Text>
              <Text style={styles.consumedLabel}>CONSUMED</Text>
            </View>
          </View>

          {/* VERTICAL CARD */}
          <View style={styles.rightCard}>
            {rightStats.map((item) => {
              // Conditionally choose which icon library
              const IconComponent =
                item.iconSet === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;

              return (
                <View key={item.label} style={styles.statRow}>
                  <IconComponent
                    name={item.icon}
                    size={20}
                    color="#FF00F5" // neon icon color?
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

        {/* MACROS ROW: 4 SMALL RINGS */}
        <View style={styles.macrosRow}>
          <MacroRing label="PROTEIN" percent={proteinPercent} />
          <MacroRing label="CARBS" percent={carbsPercent} />
          <MacroRing label="FATS" percent={fatPercent} />
          <MacroRing label="MORE" percent={morePercent} />
        </View>

        {/* WEIGHT LOST SLIDER */}
        <View style={styles.burnContainer}>
          <Text style={styles.burnTitle}>Weight Lost</Text>
          <View style={styles.burnBarBackground}>
            <View style={[styles.burnBarFill, { width: '70%' }]} />
          </View>
          <Text style={styles.burnDetails}>{totalBurned} Calories burned</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** SMALL MACRO RING COMPONENT */
function MacroRing({ label, percent }: { label: string; percent: number }) {
  const radius = (MACRO_RING_SIZE - MACRO_STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillStroke = (percent / 100) * circumference;

  return (
    <View style={styles.macroRingContainer}>
      <Svg width={MACRO_RING_SIZE} height={MACRO_RING_SIZE}>
        <Defs>
          <SvgLinearGradient id={`macroGradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FF00F5" />
            <Stop offset="50%" stopColor="#9B00FF" />
            <Stop offset="100%" stopColor="#00CFFF" />
          </SvgLinearGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={MACRO_RING_SIZE / 2}
          cy={MACRO_RING_SIZE / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={MACRO_RING_SIZE / 10}
          fill="none"
        />
        {/* Foreground arc */}
        <Circle
          cx={MACRO_RING_SIZE / 2}
          cy={MACRO_RING_SIZE / 2}
          r={radius}
          stroke={`url(#macroGradient-${label})`}
          strokeWidth={MACRO_RING_SIZE / 10}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - fillStroke}
          strokeLinecap="round"
          transform={`rotate(-90, ${MACRO_RING_SIZE / 2}, ${MACRO_RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.macroRingCenter}>
        <Text style={styles.macroRingText}>{percent}%</Text>
      </View>
      <Text style={styles.macroRingLabel}>{label}</Text>
    </View>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 40
  },

  /* Cheat Day */
  cheatDayContainer: {
    width: '85%',
    marginTop: 20,
    marginBottom: 20
  },
  cheatDayLabel: {
    color: '#FFF',
    fontSize: 14,
    textTransform: 'uppercase'
  },
  settingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4
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
  consumedContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    alignItems: 'center'
  },
  consumedValue: {
    color: '#FF00F5',
    fontSize: 16,
    fontWeight: '700'
  },
  consumedLabel: {
    color: '#FFF',
    fontSize: 10,
    textTransform: 'uppercase'
  },
  rightCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: '38%' // slightly larger to fit text
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

  /* Macros (4 small rings) */
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginBottom: 20,
    marginTop: 10
  },
  macroRingContainer: {
    alignItems: 'center'
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
  macroRingLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 4
  },

  /* Weight Lost Slider */
  burnContainer: {
    width: '85%',
    marginBottom: 20
  },
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
  }
});
