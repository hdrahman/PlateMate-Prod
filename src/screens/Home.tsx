import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TouchableOpacity
} from 'react-native';//test

// For small macro rings
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
// Changed import for Expo projects
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Or 'react-native-vector-icons/Ionicons' if not using Expo

const { width } = Dimensions.get('window');

// Main ring sizes
const CIRCLE_SIZE = width * 0.6;
const STROKE_WIDTH = 20;

// Small macro ring sizes
const MACRO_RING_SIZE = 60;
const MACRO_STROKE_WIDTH = 6;

// Dummy data
const dailyCalorieGoal = 2500;
const consumedCalories = 1022; // Example
const remainingCalories = dailyCalorieGoal - consumedCalories; // 1478
const percentConsumed = (consumedCalories / dailyCalorieGoal) * 100;

const fatPercent = 20;
const carbsPercent = 70;
const proteinPercent = 40;
const morePercent = 55; // or "OTHER" macro

const totalBurned = 500;

const fats = 13;
const carbs = 59;
const protein = 50;

export default function Home() {
  // Big ring math
  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const consumedStroke = (percentConsumed / 100) * circumference;

  // Cheat day progress (example: 2 days out of 7)
  const cheatDaysTotal = 7;
  const cheatDaysCompleted = 3;
  const cheatProgress = (cheatDaysCompleted / cheatDaysTotal) * 100; // e.g. ~42%

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>STREAK TO GOAL</Text>
        </View>

        {/* Circular ring container */}
        <View style={styles.ringContainer}>
          {/* Glow behind the ring (optional) */}
          <View style={styles.ringGlow} />

          {/* The ring itself (SVG) */}
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

          {/* Centered text: "1478 REMAINING" */}
          <View style={styles.centerTextContainer}>
            <Text style={styles.remainingValue}>{remainingCalories}</Text>
            <Text style={styles.remainingLabel}>REMAINING</Text>
          </View>

          {/* Right-side text: "41% CONSUMED" */}
          <View style={styles.consumedContainer}>
            <Text style={styles.consumedValue}>
              {Math.round(percentConsumed)}%
            </Text>
            <Text style={styles.consumedLabel}>CONSUMED</Text>
          </View>
        </View>

        {/* Macros row - 4 small rings: Protein, Carbs, Fats, More */}
        <View style={styles.macrosRow}>
          <MacroRing label="PROTEIN" percent={proteinPercent} />
          <MacroRing label="CARBS" percent={carbsPercent} />
          <MacroRing label="FATS" percent={fatPercent} />
          <MacroRing label="MORE" percent={morePercent} />
        </View>

        {/* Burn slider row */}
        <View style={styles.burnContainer}>
          <Text style={styles.burnTitle}>Burn</Text>
          <View style={styles.burnBarBackground}>
            <View style={[styles.burnBarFill, { width: '70%' }]} />
          </View>
          <Text style={styles.burnDetails}>
            {totalBurned} Calories burned
          </Text>
        </View>

        {/* Days until cheat day progress + settings button */}
        <View style={styles.cheatDayContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.cheatDayLabel}>Days until cheat day</Text>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => { }}>
              <Ionicons name="settings-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Straight progress bar */}
          <View style={styles.cheatDayBarBackground}>
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              colors={['#FF00F5', '#9B00FF', '#00CFFF']}
              style={[
                styles.cheatDayBarFill,
                { width: `${cheatProgress}%` }
              ]}
            />
          </View>
          <Text style={styles.cheatDayStatus}>
            {cheatDaysCompleted} / {cheatDaysTotal} days
          </Text>
        </View>

        {/* Bottom stats circles */}
        <View style={styles.statsRow}>
          <View style={styles.statCircle}>
            <Text style={styles.statValue}>{dailyCalorieGoal}</Text>
            <Text style={styles.statLabel}>Goal</Text>
          </View>
          <View style={styles.statCircle}>
            <Text style={styles.statValue}>{fats}</Text>
            <Text style={styles.statLabel}>Fats (g)</Text>
          </View>
          <View style={styles.statCircle}>
            <Text style={styles.statValue}>{carbs}</Text>
            <Text style={styles.statLabel}>Carbs (g)</Text>
          </View>
          <View style={styles.statCircle}>
            <Text style={styles.statValue}>{protein}</Text>
            <Text style={styles.statLabel}>Protein (g)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Small ring component for macros.
 * Renders a smaller ring with a certain fill percentage,
 * plus a label beneath.
 */
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
          strokeWidth={MACRO_STROKE_WIDTH}
          fill="none"
        />

        {/* Foreground arc */}
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
      {/* Center text (optionally show % or something else). For now let's do an integer. */}
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
    backgroundColor: '#000' // Dark background
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 40
  },
  headerRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20
  },
  headerText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  ringContainer: {
    position: 'relative',
    marginTop: 20,
    marginBottom: 20
  },
  ringGlow: {
    position: 'absolute',
    width: CIRCLE_SIZE * 1.3,
    height: CIRCLE_SIZE * 1.3,
    borderRadius: (CIRCLE_SIZE * 1.3) / 2,
    backgroundColor: '#9B00FF',
    opacity: 0.2,
    top: -(CIRCLE_SIZE * 0.15),
    left: -(CIRCLE_SIZE * 0.15)
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
    fontSize: 32,
    fontWeight: 'bold'
  },
  remainingLabel: {
    color: '#FFF',
    fontSize: 14,
    textTransform: 'uppercase',
    marginTop: 4
  },
  consumedContainer: {
    position: 'absolute',
    right: -60,
    alignItems: 'center',
    top: CIRCLE_SIZE * 0.3
  },
  consumedValue: {
    color: '#FF00F5',
    fontSize: 18,
    fontWeight: '700'
  },
  consumedLabel: {
    color: '#FFF',
    fontSize: 10,
    textTransform: 'uppercase'
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginBottom: 20
  },
  // Each macro ring wrapper
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
  },
  cheatDayContainer: {
    width: '85%',
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
  statsRow: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statCircle: {
    width: 75,
    height: 75,
    borderRadius: 75 / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700'
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase'
  }
});
