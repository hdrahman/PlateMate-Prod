/**
 * Workout Type Mapping Utility
 * 
 * Maps Health Connect exercise types (numeric codes) and Apple HealthKit workout types
 * to human-readable exercise names for the PlateMate exercise log.
 */

// Health Connect Exercise Type Constants
// Based on: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
export const HealthConnectExerciseType: Record<number, string> = {
    1: 'Back extension',
    2: 'Badminton',
    3: 'Barbell shoulder press',
    4: 'Baseball',
    5: 'Basketball',
    6: 'Bench press',
    7: 'Bench sit-up',
    8: 'Biking',
    9: 'Biking (stationary)',
    10: 'Boot camp',
    11: 'Boxing',
    12: 'Burpee',
    13: 'Calisthenics',
    14: 'Cricket',
    15: 'Crunch',
    16: 'Dancing',
    17: 'Deadlift',
    18: 'Dumbbell curl (bicep)',
    19: 'Dumbbell triceps extension',
    20: 'Dumbbell row',
    21: 'Elliptical',
    22: 'Exercise class',
    23: 'Fencing',
    24: 'Football (American)',
    25: 'Football (Australian)',
    26: 'Forward twist',
    27: 'Frisbee',
    28: 'Golf',
    29: 'Gymnastics',
    30: 'Handball',
    31: 'High intensity interval training',
    32: 'Hiking',
    33: 'Ice hockey',
    34: 'Ice skating',
    35: 'Jumping jacks',
    36: 'Jump rope',
    37: 'Lat pull-down',
    38: 'Lunge',
    39: 'Martial arts',
    40: 'Meditation',
    41: 'Paddling',
    42: 'Paragliding',
    43: 'Pilates',
    44: 'Plank',
    45: 'Racquetball',
    46: 'Rock climbing',
    47: 'Roller hockey',
    48: 'Rowing',
    49: 'Rowing machine',
    50: 'Rugby',
    51: 'Running',
    52: 'Running (treadmill)',
    53: 'Sailing',
    54: 'Scuba diving',
    55: 'Skating',
    56: 'Skiing',
    57: 'Snowboarding',
    58: 'Snowshoeing',
    59: 'Soccer',
    60: 'Softball',
    61: 'Squash',
    62: 'Squat',
    63: 'Stair climbing',
    64: 'Stair climbing machine',
    65: 'Strength training',
    66: 'Stretching',
    67: 'Surfing',
    68: 'Swimming (open water)',
    69: 'Swimming (pool)',
    70: 'Table tennis',
    71: 'Tennis',
    72: 'Volleyball',
    73: 'Walking',
    74: 'Water polo',
    75: 'Weightlifting',
    76: 'Wheelchair',
    77: 'Yoga',
    78: 'Other',
    79: 'Running', // Alternative code
};

// Apple HealthKit Workout Type Mapping
// Based on: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
export const AppleHealthKitWorkoutType: Record<string, string> = {
    'AmericanFootball': 'Football (American)',
    'Archery': 'Archery',
    'AustralianFootball': 'Football (Australian)',
    'Badminton': 'Badminton',
    'Baseball': 'Baseball',
    'Basketball': 'Basketball',
    'Bowling': 'Bowling',
    'Boxing': 'Boxing',
    'Climbing': 'Rock climbing',
    'Cricket': 'Cricket',
    'CrossTraining': 'HIIT',
    'Curling': 'Curling',
    'Cycling': 'Biking',
    'Dance': 'Dancing',
    'DanceInspiredTraining': 'Dancing',
    'Elliptical': 'Elliptical',
    'EquestrianSports': 'Horseback riding',
    'Fencing': 'Fencing',
    'Fishing': 'Fishing',
    'FunctionalStrengthTraining': 'Strength training',
    'Golf': 'Golf',
    'Gymnastics': 'Gymnastics',
    'Handball': 'Handball',
    'Hiking': 'Hiking',
    'Hockey': 'Ice hockey',
    'Hunting': 'Hunting',
    'Lacrosse': 'Lacrosse',
    'MartialArts': 'Martial arts',
    'MindAndBody': 'Yoga',
    'MixedMetabolicCardioTraining': 'HIIT',
    'PaddleSports': 'Paddling',
    'Play': 'Recreation',
    'PreparationAndRecovery': 'Stretching',
    'Racquetball': 'Racquetball',
    'Rowing': 'Rowing',
    'Rugby': 'Rugby',
    'Running': 'Running',
    'Sailing': 'Sailing',
    'SkatingSports': 'Ice skating',
    'SnowSports': 'Skiing',
    'Soccer': 'Soccer',
    'Softball': 'Softball',
    'Squash': 'Squash',
    'StairClimbing': 'Stair climbing',
    'SurfingSports': 'Surfing',
    'Swimming': 'Swimming (pool)',
    'TableTennis': 'Table tennis',
    'Tennis': 'Tennis',
    'TrackAndField': 'Running',
    'TraditionalStrengthTraining': 'Strength training',
    'Volleyball': 'Volleyball',
    'Walking': 'Walking',
    'WaterFitness': 'Water aerobics',
    'WaterPolo': 'Water polo',
    'WaterSports': 'Water sports',
    'Wrestling': 'Wrestling',
    'Yoga': 'Yoga',
    'Barre': 'Barre',
    'CoreTraining': 'Core training',
    'CrossCountrySkiing': 'Cross-country skiing',
    'DownhillSkiing': 'Skiing',
    'Flexibility': 'Stretching',
    'HighIntensityIntervalTraining': 'HIIT',
    'JumpRope': 'Jump rope',
    'Kickboxing': 'Kickboxing',
    'Pilates': 'Pilates',
    'Snowboarding': 'Snowboarding',
    'Stairs': 'Stair climbing',
    'StepTraining': 'Step aerobics',
    'WheelchairWalkPace': 'Wheelchair',
    'WheelchairRunPace': 'Wheelchair',
    'TaiChi': 'Tai chi',
    'MixedCardio': 'Cardio',
    'HandCycling': 'Hand cycling',
    'Other': 'Other',
};

/**
 * Get a normalized workout type name from Health Connect exercise type code
 */
export function getWorkoutTypeFromHealthConnect(exerciseType: number | string): string {
    if (typeof exerciseType === 'string') {
        // If it's already a string, return it
        return exerciseType;
    }
    return HealthConnectExerciseType[exerciseType] || 'Other';
}

/**
 * Get a normalized workout type name from Apple HealthKit workout type
 */
export function getWorkoutTypeFromAppleHealth(activityType: string): string {
    // Remove "HKWorkoutActivityType" prefix if present
    const cleanType = activityType.replace(/^HKWorkoutActivityType/, '');
    return AppleHealthKitWorkoutType[cleanType] || activityType || 'Other';
}

/**
 * Calculate estimated calories from workout duration and type
 * Based on average MET values (Metabolic Equivalent of Task)
 */
const WorkoutMETValues: Record<string, number> = {
    'Walking': 3.5,
    'Running': 9.0,
    'Running (treadmill)': 9.0,
    'Biking': 7.5,
    'Biking (stationary)': 6.5,
    'Swimming (pool)': 8.0,
    'Swimming (open water)': 8.0,
    'Hiking': 6.0,
    'HIIT': 10.0,
    'High intensity interval training': 10.0,
    'Strength training': 5.0,
    'Weightlifting': 6.0,
    'Yoga': 2.5,
    'Pilates': 3.0,
    'Dancing': 5.0,
    'Elliptical': 6.0,
    'Rowing': 7.0,
    'Rowing machine': 7.0,
    'Jump rope': 11.0,
    'Boxing': 9.0,
    'Martial arts': 8.0,
    'Tennis': 7.0,
    'Basketball': 8.0,
    'Soccer': 8.0,
    'Other': 5.0,
};

/**
 * Estimate calories burned based on workout type and duration
 * Formula: Calories = MET * weight(kg) * time(hours)
 * Using average weight of 70kg for estimation
 */
export function estimateCalories(workoutType: string, durationMinutes: number, weightKg: number = 70): number {
    const met = WorkoutMETValues[workoutType] || WorkoutMETValues['Other'];
    const hours = durationMinutes / 60;
    return Math.round(met * weightKg * hours);
}
