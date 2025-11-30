import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    TextInput,
    Alert,
    FlatList,
    ViewStyle,
    TextStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDateToString } from '../utils/dateUtils';
import { addExercise, getCurrentUserIdAsync, getUserProfile } from '../utils/database';
import { useSteps } from '../context/StepContext';
import UnifiedStepTracker from '../services/UnifiedStepTracker';
import { ThemeContext } from '../ThemeContext';

// Define the Exercise interface
interface Exercise {
    id?: number;
    exercise_name: string;
    calories_burned: number;
    duration: number;
    date?: string;
    notes?: string;
}

// Add MET activity interface
interface METActivity {
    name: string;
    met: number;
    category: 'light' | 'moderate' | 'vigorous';
}

interface ExerciseModalProps {
    visible: boolean;
    onClose: () => void;
    onExerciseAdded: () => void;
    currentDate: Date;
}

// Accent colors
const PURPLE_ACCENT = '#AA00FF';

// Fallback colors (used in StyleSheet, overridden inline with theme where possible)
const PRIMARY_BG = '#121212';
const CARD_BG = '#1E1E1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';

const ExerciseModal: React.FC<ExerciseModalProps> = ({
    visible,
    onClose,
    onExerciseAdded,
    currentDate
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    // State variables for exercise modal
    const [selectedActivity, setSelectedActivity] = useState<METActivity | null>(null);
    const [exerciseDuration, setExerciseDuration] = useState('30');
    const [exerciseIntensity, setExerciseIntensity] = useState('moderate');
    const [searchQuery, setSearchQuery] = useState('');
    const [userWeight, setUserWeight] = useState<number>(70);
    const [manualMET, setManualMET] = useState('5.0');
    const [manualActivityName, setManualActivityName] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [isStepsEntry, setIsStepsEntry] = useState(false);
    const [stepsCount, setStepsCount] = useState('');

    // Get step context for syncing with home screen
    const { todaySteps } = useSteps();

    // Fetch the current user's weight from their profile
    useEffect(() => {
        const loadUserWeight = async () => {
            try {
                const uid = await getCurrentUserIdAsync();
                const profile: any = await getUserProfile(uid);

                if (profile && typeof profile.weight === 'number' && profile.weight > 0) {
                    setUserWeight(profile.weight);
                } else {
                    console.warn('⚠️ User weight not found in profile, using default of 70kg');
                }
            } catch (error) {
                console.error('❌ Error loading user weight:', error);
            }
        };

        loadUserWeight();
    }, []);

    // Function to reset form
    const resetForm = () => {
        setSelectedActivity(null);
        setExerciseDuration('30');
        setExerciseIntensity('moderate');
        setSearchQuery('');
        setManualMET('5.0');
        setManualActivityName('');
        setIsManualEntry(false);
        setIsStepsEntry(false);
        setStepsCount('');
    };

    // Function to handle modal close
    const handleClose = () => {
        resetForm();
        onClose();
    };

    // MET activities data based on the provided charts
    const metActivities: METActivity[] = [
        // Popular/Common activities at the top
        { name: 'Weight lifting, moderate', met: 5.0, category: 'moderate' },
        { name: 'Weight lifting, vigorous', met: 6.0, category: 'vigorous' },
        { name: 'Walking, 3 mph', met: 3.3, category: 'moderate' },
        { name: 'Walking, 4 mph', met: 5.0, category: 'moderate' },
        { name: 'Running, 6 min/mile', met: 16.0, category: 'vigorous' },
        { name: 'Running, 10 min/mile', met: 10.0, category: 'vigorous' },
        { name: 'Bicycling, 12-13 mph', met: 8.0, category: 'vigorous' },
        { name: 'Swimming, moderate pace', met: 4.5, category: 'moderate' },
        { name: 'Basketball game', met: 8.0, category: 'vigorous' },
        { name: 'Soccer, casual', met: 7.0, category: 'vigorous' },

        // Light activities
        { name: 'Walking, slowly (stroll)', met: 2.0, category: 'light' },
        { name: 'Walking, 2 mph', met: 2.5, category: 'light' },
        { name: 'Stretching, yoga', met: 2.5, category: 'light' },
        { name: 'Fishing, standing', met: 2.5, category: 'light' },
        { name: 'Golf with a cart', met: 2.5, category: 'light' },
        { name: 'Housework, light', met: 2.5, category: 'light' },
        { name: 'Playing catch', met: 2.5, category: 'light' },
        { name: 'Playing piano', met: 2.5, category: 'light' },
        { name: 'Canoeing leisurely', met: 2.5, category: 'light' },
        { name: 'Croquet', met: 2.5, category: 'light' },
        { name: 'Dancing, ballroom, slow', met: 2.9, category: 'light' },
        { name: 'Sitting quietly', met: 1.0, category: 'light' },

        // Moderate activities
        { name: 'Aerobic dance, low impact', met: 5.0, category: 'moderate' },
        { name: 'Archery', met: 3.5, category: 'moderate' },
        { name: 'Badminton', met: 4.5, category: 'moderate' },
        { name: 'Baseball or softball', met: 5.0, category: 'moderate' },
        { name: 'Basketball, shooting baskets', met: 4.5, category: 'moderate' },
        { name: 'Bicycling, leisurely', met: 3.5, category: 'moderate' },
        { name: 'Bowling', met: 3.0, category: 'moderate' },
        { name: 'Calisthenics, light to moderate', met: 3.5, category: 'moderate' },
        { name: 'Canoeing, 3 mph', met: 3.0, category: 'moderate' },
        { name: 'Dancing, modern, fast', met: 4.8, category: 'moderate' },
        { name: 'Fishing, walking and standing', met: 3.5, category: 'moderate' },
        { name: 'Foot bag, hacky sack', met: 4.0, category: 'moderate' },
        { name: 'Gardening, active', met: 4.0, category: 'moderate' },
        { name: 'Golf, walking', met: 4.4, category: 'moderate' },
        { name: 'Gymnastics', met: 4.0, category: 'moderate' },
        { name: 'Horseback riding', met: 4.0, category: 'moderate' },
        { name: 'Ice skating', met: 5.5, category: 'moderate' },
        { name: 'Jumping on mini tramp', met: 4.5, category: 'moderate' },
        { name: 'Kayaking', met: 5.0, category: 'moderate' },
        { name: 'Raking the lawn', met: 4.0, category: 'moderate' },
        { name: 'Skateboarding', met: 5.0, category: 'moderate' },
        { name: 'Snowmobiling', met: 3.5, category: 'moderate' },
        { name: 'Swimming recreational', met: 6.0, category: 'moderate' },
        { name: 'Table tennis', met: 4.0, category: 'moderate' },
        { name: 'Tai chi', met: 4.0, category: 'moderate' },
        { name: 'Tennis, doubles', met: 5.0, category: 'moderate' },
        { name: 'Trampoline', met: 3.5, category: 'moderate' },
        { name: 'Volleyball, noncompetitive', met: 3.0, category: 'moderate' },
        { name: 'Mowing lawn, walking', met: 5.5, category: 'moderate' },

        // Vigorous activities
        { name: 'Aerobic dance', met: 6.5, category: 'vigorous' },
        { name: 'Aerobic dance, high impact', met: 7.0, category: 'vigorous' },
        { name: 'Aerobic stepping, 6-8 inches', met: 8.5, category: 'vigorous' },
        { name: 'Backpacking', met: 7.0, category: 'vigorous' },
        { name: 'Bicycling, 14-15 mph', met: 10.0, category: 'vigorous' },
        { name: 'Bicycling, 16-19 mph', met: 12.0, category: 'vigorous' },
        { name: 'Bicycling, 20+ mph', met: 16.0, category: 'vigorous' },
        { name: 'Calisthenics, heavy, vigorous', met: 8.0, category: 'vigorous' },
        { name: 'Canoeing, 5 mph or portaging', met: 7.0, category: 'vigorous' },
        { name: 'Chopping wood', met: 6.0, category: 'vigorous' },
        { name: 'Dancing, aerobic or ballet', met: 6.0, category: 'vigorous' },
        { name: 'Fencing', met: 6.0, category: 'vigorous' },
        { name: 'Fishing in stream with waders', met: 6.5, category: 'vigorous' },
        { name: 'Football, competitive', met: 9.0, category: 'vigorous' },
        { name: 'Football, touch/flag', met: 8.0, category: 'vigorous' },
        { name: 'Frisbee, ultimate', met: 8.0, category: 'vigorous' },
        { name: 'Hockey, field or ice', met: 8.0, category: 'vigorous' },
        { name: 'Ice skating, social', met: 7.0, category: 'vigorous' },
        { name: 'Jogging, 12 min/mile', met: 8.0, category: 'vigorous' },
        { name: 'Judo/karate/tae kwan do', met: 10.0, category: 'vigorous' },
        { name: 'Lacrosse', met: 8.0, category: 'vigorous' },
        { name: 'Logging/felling trees', met: 8.0, category: 'vigorous' },
        { name: 'Mountain climbing', met: 8.0, category: 'vigorous' },
        { name: 'Race walking, moderate pace', met: 6.5, category: 'vigorous' },
        { name: 'Racquetball', met: 10.0, category: 'vigorous' },
        { name: 'Racquetball, team', met: 8.0, category: 'vigorous' },
        { name: 'Roller skating', met: 7.0, category: 'vigorous' },
        { name: 'Rollerblading, fast', met: 12.0, category: 'vigorous' },
        { name: 'Jump Rope, slow', met: 8.0, category: 'vigorous' },
        { name: 'Jump Rope, fast', met: 12.0, category: 'vigorous' },
        { name: 'Running, 7 min/mile', met: 14.0, category: 'vigorous' },
        { name: 'Running, 8 min/mile', met: 12.5, category: 'vigorous' },
        { name: 'Running, 9 min/mile', met: 11.0, category: 'vigorous' },
        { name: 'Shoveling snow', met: 6.0, category: 'vigorous' },
        { name: 'Skiing downhill, moderate', met: 6.0, category: 'vigorous' },
        { name: 'Skiing downhill, vigorous', met: 8.0, category: 'vigorous' },
        { name: 'Skiing cross country, slow', met: 7.0, category: 'vigorous' },
        { name: 'Skiing cross country, moderate', met: 8.0, category: 'vigorous' },
        { name: 'Skiing cross country, vigorous', met: 9.0, category: 'vigorous' },
        { name: 'Skiing cross country, racing uphill', met: 16.5, category: 'vigorous' },
        { name: 'Skin diving', met: 12.5, category: 'vigorous' },
        { name: 'Snow shoeing', met: 8.0, category: 'vigorous' },
        { name: 'Soccer, competitive', met: 10.0, category: 'vigorous' },
        { name: 'Surfing', met: 6.0, category: 'vigorous' },
        { name: 'Swimming laps, moderate pace', met: 7.0, category: 'vigorous' },
        { name: 'Swimming laps, fast', met: 10.0, category: 'vigorous' },
        { name: 'Swimming laps, sidestroke', met: 8.0, category: 'vigorous' },
        { name: 'Tennis', met: 7.0, category: 'vigorous' },
        { name: 'Volleyball, competitive/beach', met: 8.0, category: 'vigorous' },
        { name: 'Walking, 11 min/mile', met: 11.0, category: 'vigorous' },
        { name: 'Walking up stairs', met: 8.0, category: 'vigorous' },
        { name: 'Water jogging', met: 8.0, category: 'vigorous' },
        { name: 'Water polo', met: 10.0, category: 'vigorous' },
        { name: 'Wrestling', met: 6.0, category: 'vigorous' },
        { name: 'Hiking up hills', met: 6.9, category: 'vigorous' },
        { name: 'Hiking hills, 12 lb pack', met: 7.5, category: 'vigorous' },
    ];

    // Function to calculate calories burned using MET formula
    const calculateCaloriesBurned = (activity: METActivity, duration: number, weight: number) => {
        // Apply intensity modifier
        let intensityMultiplier = 1.0; // default (moderate)

        if (exerciseIntensity === 'light') {
            intensityMultiplier = 0.8; // 20% reduction for light intensity
        } else if (exerciseIntensity === 'vigorous') {
            intensityMultiplier = 1.2; // 20% increase for vigorous intensity
        }

        // Adjusted MET value based on personal intensity
        const adjustedMET = activity.met * intensityMultiplier;

        // Formula: Exercise calories = (MET level of activity x 3.5 x Weight (kg) x minutes of activity) / 200
        return Math.round((adjustedMET * 3.5 * weight * duration) / 200);
    };

    // Filter activities based on search query
    const filteredActivities = searchQuery.trim() === ''
        ? metActivities
        : metActivities.filter(activity =>
            activity.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Group activities by category for display
    const groupedActivities = {
        popular: filteredActivities.slice(0, 10), // First 10 are popular activities
        light: filteredActivities.filter(a => a.category === 'light'),
        moderate: filteredActivities.filter(a => a.category === 'moderate'),
        vigorous: filteredActivities.filter(a => a.category === 'vigorous')
    };

    // Add a new exercise
    const addNewExercise = async () => {
        if (!selectedActivity && !isManualEntry && !isStepsEntry) {
            Alert.alert('Select Activity', 'Please select an activity from the list, use manual entry, or log steps');
            return;
        }

        if (isManualEntry && !manualActivityName.trim()) {
            Alert.alert('Activity Name Required', 'Please enter a name for your activity');
            return;
        }

        if (isStepsEntry && (!stepsCount.trim() || parseInt(stepsCount) <= 0)) {
            Alert.alert('Steps Required', 'Please enter a valid number of steps');
            return;
        }

        try {
            const formattedDate = formatDateToString(currentDate);

            // Calculate calories burned
            const duration = parseInt(exerciseDuration) || 30;

            let caloriesBurned = 0;
            let activityName = '';
            let metValue = 0;

            if (isStepsEntry) {
                // Handle steps entry
                const steps = parseInt(stepsCount);

                // Use UnifiedStepTracker to add steps - this will update database, internal state, and notify listeners
                await UnifiedStepTracker.addManualSteps(steps);

                console.log(`Added ${steps} steps to step tracker`);

            } else if (isManualEntry) {
                metValue = parseFloat(manualMET) || 5.0;
                activityName = manualActivityName.trim();

                // Apply intensity modifier for manual entry
                let intensityMultiplier = 1.0;
                if (exerciseIntensity === 'light') intensityMultiplier = 0.8;
                if (exerciseIntensity === 'vigorous') intensityMultiplier = 1.2;

                // Formula: Exercise calories = (MET level of activity x 3.5 x Weight (kg) x minutes of activity) / 200
                caloriesBurned = Math.round((metValue * intensityMultiplier * 3.5 * userWeight * duration) / 200);

                // Get intensity multiplier for notes
                let intensityMultiplierStr = "1.0";
                if (exerciseIntensity === 'light') intensityMultiplierStr = "0.8";
                if (exerciseIntensity === 'vigorous') intensityMultiplierStr = "1.2";

                const exerciseData = {
                    exercise_name: activityName,
                    calories_burned: caloriesBurned,
                    duration: duration,
                    date: formattedDate,
                    notes: `MET: ${metValue}, Intensity: ${exerciseIntensity} (${intensityMultiplierStr}x multiplier)`
                };

                await addExercise(exerciseData);
            } else {
                caloriesBurned = calculateCaloriesBurned(selectedActivity!, duration, userWeight);
                activityName = selectedActivity!.name;
                metValue = selectedActivity!.met;

                // Get intensity multiplier for notes
                let intensityMultiplierStr = "1.0";
                if (exerciseIntensity === 'light') intensityMultiplierStr = "0.8";
                if (exerciseIntensity === 'vigorous') intensityMultiplierStr = "1.2";

                const exerciseData = {
                    exercise_name: activityName,
                    calories_burned: caloriesBurned,
                    duration: duration,
                    date: formattedDate,
                    notes: `MET: ${metValue}, Intensity: ${exerciseIntensity} (${intensityMultiplierStr}x multiplier)`
                };

                await addExercise(exerciseData);
            }

            // Reset form fields
            resetForm();

            // Close modal
            onClose();

            // Notify parent component
            onExerciseAdded();
        } catch (error) {
            console.error('Error adding exercise:', error);
            Alert.alert('Error', 'Failed to add exercise. Please try again.');
        }
    };

    // Render activity item for the flat list
    const renderActivityItem = ({ item }: { item: METActivity }) => {
        const isSelected = selectedActivity?.name === item.name;
        return (
            <TouchableOpacity
                style={[
                    styles.activityItem,
                    isSelected && styles.selectedActivityItem
                ]}
                onPress={() => setSelectedActivity(item)}
            >
                <View style={styles.activityInfo}>
                    <Text style={[
                        styles.activityName,
                        isSelected && { color: PURPLE_ACCENT }
                    ]}>
                        {item.name}
                    </Text>
                    <Text style={styles.activityMet}>
                        MET: {item.met} ({item.category})
                    </Text>
                </View>
                {selectedActivity?.name === item.name && (
                    <View style={styles.checkmarkContainer}>
                        <Ionicons name="checkmark-circle" size={24} color={PURPLE_ACCENT} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                {/* Transparent background that captures outside taps */}
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                {/* Actual modal card */}
                <View style={styles.exerciseModalContent}>
                    <MaskedView
                        maskElement={
                            <Text style={styles.exerciseModalTitle}>Add Exercise</Text>
                        }
                    >
                        <LinearGradient
                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ height: 30, width: '100%' }}
                        />
                    </MaskedView>

                    {/* Back arrow in header */}
                    {(isManualEntry || selectedActivity || isStepsEntry) && (
                        <TouchableOpacity
                            style={styles.headerBackButton}
                            onPress={() => {
                                if (isManualEntry) {
                                    setIsManualEntry(false);
                                } else if (isStepsEntry) {
                                    setIsStepsEntry(false);
                                } else if (selectedActivity) {
                                    setSelectedActivity(null);
                                }
                            }}
                        >
                            <Ionicons name="arrow-back" size={28} color="#8A2BE2" />
                        </TouchableOpacity>
                    )}

                    {/* Close (X) button */}
                    <TouchableOpacity
                        style={styles.exitButton}
                        onPress={handleClose}
                    >
                        <Ionicons name="close" size={28} color="#8A2BE2" />
                    </TouchableOpacity>

                    <View style={{ height: 15 }} />

                    {/* Make the content scrollable */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.exerciseModalScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {!selectedActivity && !isManualEntry && !isStepsEntry ? (
                            <>
                                {/* Steps Entry Card */}
                                <TouchableOpacity
                                    style={[styles.popularActivitiesWrapper, { marginBottom: 8 }]}
                                    onPress={() => setIsStepsEntry(true)}
                                >
                                    <LinearGradient
                                        colors={["#66BB6A", "#4CAF50", "#388E3C"]}
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
                                    <View style={[styles.popularActivitiesContainer, { padding: 16 }]}>
                                        <View style={[styles.popularActivitiesHeader, { marginBottom: 0 }]}>
                                            <Ionicons name="walk" size={24} color="#4CAF50" />
                                            <Text style={[styles.popularActivitiesTitle, { color: '#4CAF50', fontWeight: 'bold' }]}>Add Steps</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {/* Manual Entry Card */}
                                <TouchableOpacity
                                    style={[styles.popularActivitiesWrapper, { marginBottom: 8 }]}
                                    onPress={() => setIsManualEntry(true)}
                                >
                                    <LinearGradient
                                        colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
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
                                    <View style={styles.popularActivitiesContainer}>
                                        <View style={styles.popularActivitiesHeader}>
                                            <Ionicons name="create-outline" size={20} color={PURPLE_ACCENT} />
                                            <Text style={styles.popularActivitiesTitle}>Manual Entry</Text>
                                        </View>
                                        <Text style={[styles.activityMet, { marginBottom: 5 }]}>
                                            Enter your own activity name and MET value
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.intensityButton, {
                                                backgroundColor: 'transparent',
                                                width: '100%',
                                                marginTop: 10,
                                                borderWidth: 1,
                                                borderColor: PURPLE_ACCENT
                                            }]}
                                            onPress={() => setIsManualEntry(true)}
                                        >
                                            <Text style={[styles.intensityButtonText, { color: PURPLE_ACCENT, fontWeight: 'bold' }]}>Enter Manually</Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>

                                {/* Or divider */}
                                <View style={[styles.orDivider, { marginVertical: 8 }]}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.orText}>OR</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                {/* Search Input */}
                                <View style={styles.searchInputContainer}>
                                    <Ionicons name="search" size={20} color="#999" />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search activities..."
                                        placeholderTextColor="#999"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>

                                {/* Activities List */}
                                <View style={styles.activitiesContainer}>
                                    {searchQuery === '' ? (
                                        <View style={styles.popularActivitiesWrapper}>
                                            <LinearGradient
                                                colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
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
                                            <View style={styles.popularActivitiesContainer}>
                                                <ScrollView
                                                    nestedScrollEnabled={true}
                                                    style={styles.popularActivitiesScroll}
                                                    contentContainerStyle={{
                                                        paddingBottom: 15
                                                    }}
                                                    showsVerticalScrollIndicator={false}
                                                >
                                                    <Text style={[styles.sectionHeader, {
                                                        marginTop: 0,
                                                        borderTopWidth: 0,
                                                        paddingTop: 0
                                                    }]}>Popular Activities</Text>
                                                    {groupedActivities.popular.map((activity, index) =>
                                                        <React.Fragment key={`popular-${activity.name}`}>
                                                            {renderActivityItem({ item: activity })}
                                                        </React.Fragment>
                                                    )}

                                                    <Text style={styles.sectionHeader}>Light Activities ({"<"} 3 METs)</Text>
                                                    {groupedActivities.light.map((activity, index) =>
                                                        <React.Fragment key={`light-${activity.name}`}>
                                                            {renderActivityItem({ item: activity })}
                                                        </React.Fragment>
                                                    )}

                                                    <Text style={styles.sectionHeader}>Moderate Activities (3-6 METs)</Text>
                                                    {groupedActivities.moderate.map((activity, index) =>
                                                        <React.Fragment key={`moderate-${activity.name}`}>
                                                            {renderActivityItem({ item: activity })}
                                                        </React.Fragment>
                                                    )}

                                                    <Text style={styles.sectionHeader}>Vigorous Activities ({">"} 6 METs)</Text>
                                                    {groupedActivities.vigorous.map((activity, index) =>
                                                        <React.Fragment key={`vigorous-${activity.name}`}>
                                                            {renderActivityItem({ item: activity })}
                                                        </React.Fragment>
                                                    )}
                                                </ScrollView>
                                            </View>
                                        </View>
                                    ) : (
                                        <FlatList
                                            data={filteredActivities}
                                            renderItem={renderActivityItem}
                                            keyExtractor={(item) => item.name}
                                            nestedScrollEnabled={true}
                                            showsVerticalScrollIndicator={false}
                                        />
                                    )}
                                </View>
                            </>
                        ) : isManualEntry ? (
                            /* Manual Entry Form */
                            <View>
                                {/* Header back button now handles navigation; removed old row */}

                                <Text style={styles.inputLabel}>Activity Name:</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={styles.input}
                                        value={manualActivityName}
                                        onChangeText={setManualActivityName}
                                        placeholder="e.g., Tennis with friends"
                                        placeholderTextColor="#777"
                                    />
                                </View>

                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>MET Value:</Text>
                                    <View style={styles.durationInputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="numeric"
                                            value={manualMET}
                                            onChangeText={setManualMET}
                                        />
                                    </View>
                                </View>

                                {/* Divider before Duration */}
                                <View style={styles.exerciseModalDivider} />

                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Duration (minutes):</Text>
                                    <View style={styles.durationInputContainer}>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="number-pad"
                                            value={exerciseDuration}
                                            onChangeText={setExerciseDuration}
                                        />
                                    </View>
                                </View>

                                {/* Divider before Intensity */}
                                <View style={styles.exerciseModalDivider} />

                                {/* Intensity Selection - For manual entry */}
                                <View style={styles.inputRow}>
                                    <Text style={[styles.inputLabel, { marginRight: 2, width: 60 }]}>Intensity:</Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.intensityButton,
                                            { marginRight: 3 }
                                        ]}
                                        onPress={() => setExerciseIntensity('light')}
                                    >
                                        <Text style={[
                                            styles.intensityButtonText,
                                            exerciseIntensity === 'light' && styles.intensityButtonTextSelected
                                        ]}>Light</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.intensityButton,
                                            { marginRight: 3 }
                                        ]}
                                        onPress={() => setExerciseIntensity('moderate')}
                                    >
                                        <Text style={[
                                            styles.intensityButtonText,
                                            exerciseIntensity === 'moderate' && styles.intensityButtonTextSelected
                                        ]}>Moderate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.intensityButton
                                        ]}
                                        onPress={() => setExerciseIntensity('vigorous')}
                                    >
                                        <Text style={[
                                            styles.intensityButtonText,
                                            exerciseIntensity === 'vigorous' && styles.intensityButtonTextSelected
                                        ]}>Vigorous</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Divider after Intensity */}
                                <View style={styles.exerciseModalDivider} />

                                {/* Calories Result */}
                                <View style={styles.caloriesResult}>
                                    <Text style={styles.caloriesFormula}>
                                        {exerciseIntensity === 'moderate' ? (
                                            `MET: ${manualMET} × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                        ) : exerciseIntensity === 'light' ? (
                                            `MET: ${manualMET} × 0.8 (light) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                        ) : (
                                            `MET: ${manualMET} × 1.2 (vigorous) × 3.5 × ${userWeight} kg × ${exerciseDuration} min ÷ 200`
                                        )}
                                    </Text>
                                    <Text style={styles.caloriesResultText}>
                                        = {Math.round((parseFloat(manualMET) || 5.0) *
                                            (exerciseIntensity === 'light' ? 0.8 : exerciseIntensity === 'vigorous' ? 1.2 : 1.0) *
                                            3.5 * userWeight * (parseInt(exerciseDuration) || 30) / 200)} calories
                                    </Text>
                                </View>
                            </View>
                        ) : isStepsEntry ? (
                            /* Steps Entry Form */
                            <View>
                                {/* Header already has back button */}

                                {/* Steps Header Card */}
                                <View style={styles.exerciseHeaderCard}>
                                    <View style={styles.exerciseIconContainer}>
                                        <Ionicons
                                            name="walk"
                                            size={32}
                                            color="#4CAF50"
                                        />
                                    </View>
                                    <View style={styles.exerciseHeaderInfo}>
                                        <Text style={styles.exerciseHeaderTitle}>Log Steps</Text>
                                        <View style={[styles.exerciseMetBadge, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                                            <Text style={[styles.exerciseMetText, { color: '#4CAF50' }]}>
                                                WALKING • MODERATE
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Current Steps Display */}
                                <View style={styles.configSection}>
                                    <Text style={styles.configSectionTitle}>Current Steps Today</Text>
                                    <View style={[styles.caloriesResult, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                                        <Text style={[styles.caloriesResultText, { color: '#4CAF50' }]}>
                                            {todaySteps} steps
                                        </Text>
                                    </View>
                                </View>

                                {/* Steps Input */}
                                <View style={styles.configSection}>
                                    <Text style={styles.configSectionTitle}>Steps to Add</Text>
                                    <View style={styles.durationCardWrapper}>
                                        <LinearGradient
                                            colors={["#66BB6A", "#4CAF50", "#388E3C"]}
                                            style={styles.durationCardGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        />
                                        <View style={styles.durationCard}>
                                            <View style={[styles.durationInputWrapper, { backgroundColor: theme.colors.inputBackground }]}>
                                                <TextInput
                                                    style={styles.durationInput}
                                                    keyboardType="number-pad"
                                                    value={stepsCount}
                                                    onChangeText={setStepsCount}
                                                    placeholderTextColor={SUBDUED}
                                                    placeholder="1000"
                                                />
                                                <Text style={styles.durationUnit}>steps</Text>
                                            </View>
                                            <View style={styles.durationPresets}>
                                                {[500, 1000, 2000, 5000].map((steps, index) => (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={[
                                                            styles.durationPreset,
                                                            { backgroundColor: theme.colors.inputBackground },
                                                            stepsCount === steps.toString() && styles.durationPresetSelected
                                                        ]}
                                                        onPress={() => setStepsCount(steps.toString())}
                                                    >
                                                        <Text style={[
                                                            styles.durationPresetText,
                                                            stepsCount === steps.toString() && styles.durationPresetTextSelected
                                                        ]}>
                                                            {steps}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Calories Calculation */}
                                <View style={styles.configSection}>
                                    <View style={styles.caloriesCalculationCard}>
                                        <View style={styles.caloriesHeader}>
                                            <Ionicons name="flame" size={20} color={PURPLE_ACCENT} />
                                            <Text style={styles.caloriesHeaderTitle}>Estimated Calories</Text>
                                        </View>
                                        <View style={styles.caloriesMainResult}>
                                            <Text style={styles.caloriesNumber}>
                                                {Math.round((parseInt(stepsCount) || 0) * 0.04 * (userWeight / 70))}
                                            </Text>
                                            <Text style={styles.caloriesUnit}>calories</Text>
                                        </View>
                                        <View style={styles.formulaContainer}>
                                            <Text style={styles.formulaLabel}>Formula:</Text>
                                            <Text style={styles.formulaText}>
                                                {stepsCount || 0} steps × 0.04 × ({userWeight}kg ÷ 70kg)
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* New Total Display */}
                                <View style={styles.configSection}>
                                    <Text style={styles.configSectionTitle}>New Total</Text>
                                    <View style={[styles.caloriesResult, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                                        <Text style={[styles.caloriesResultText, { color: '#4CAF50' }]}>
                                            {todaySteps + (parseInt(stepsCount) || 0)} steps
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : selectedActivity && (
                            <>
                                {/* Header with Back Button */}
                                {/* Header back button now handles navigation; removed old row */}

                                {/* Exercise Header Card */}
                                <View style={styles.exerciseHeaderCard}>
                                    <View style={styles.exerciseIconContainer}>
                                        <Ionicons
                                            name={selectedActivity.category === 'light' ? 'walk' :
                                                selectedActivity.category === 'moderate' ? 'fitness' : 'flash'}
                                            size={32}
                                            color={PURPLE_ACCENT}
                                        />
                                    </View>
                                    <View style={styles.exerciseHeaderInfo}>
                                        <Text style={styles.exerciseHeaderTitle}>{selectedActivity.name}</Text>
                                        <View style={styles.exerciseMetBadge}>
                                            <Text style={styles.exerciseMetText}>
                                                {selectedActivity.met} MET • {selectedActivity.category.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Duration Section */}
                                <View style={styles.configSection}>
                                    <Text style={styles.configSectionTitle}>Duration</Text>
                                    <View style={styles.durationCardWrapper}>
                                        <LinearGradient
                                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                                            style={styles.durationCardGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        />
                                        <View style={styles.durationCard}>
                                            <View style={[styles.durationInputWrapper, { backgroundColor: theme.colors.inputBackground }]}>
                                                <TextInput
                                                    style={styles.durationInput}
                                                    keyboardType="number-pad"
                                                    value={exerciseDuration}
                                                    onChangeText={setExerciseDuration}
                                                    placeholderTextColor={SUBDUED}
                                                    placeholder="30"
                                                />
                                                <Text style={styles.durationUnit}>minutes</Text>
                                            </View>
                                            <View style={styles.durationPresets}>
                                                {[15, 30, 45, 60].map((duration) => (
                                                    <TouchableOpacity
                                                        key={duration}
                                                        style={[
                                                            styles.durationPreset,
                                                            { backgroundColor: theme.colors.inputBackground },
                                                            exerciseDuration === duration.toString() && styles.durationPresetSelected
                                                        ]}
                                                        onPress={() => setExerciseDuration(duration.toString())}
                                                    >
                                                        <Text style={[
                                                            styles.durationPresetText,
                                                            exerciseDuration === duration.toString() && styles.durationPresetTextSelected
                                                        ]}>
                                                            {duration}m
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Intensity Section */}
                                <View style={styles.configSection}>
                                    <Text style={styles.configSectionTitle}>Intensity Level</Text>
                                    <View style={styles.intensityGrid}>
                                        <TouchableOpacity
                                            style={[
                                                styles.intensityCard,
                                                exerciseIntensity === 'light' && styles.intensityCardSelected
                                            ]}
                                            onPress={() => setExerciseIntensity('light')}
                                        >
                                            <Ionicons
                                                name="leaf-outline"
                                                size={24}
                                                color={exerciseIntensity === 'light' ? PURPLE_ACCENT : SUBDUED}
                                            />
                                            <Text style={[
                                                styles.intensityCardTitle,
                                                exerciseIntensity === 'light' && styles.intensityCardTitleSelected
                                            ]}>Light</Text>
                                            <Text style={styles.intensityCardSubtitle}>0.8x multiplier</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.intensityCard,
                                                exerciseIntensity === 'moderate' && styles.intensityCardSelected
                                            ]}
                                            onPress={() => setExerciseIntensity('moderate')}
                                        >
                                            <Ionicons
                                                name="fitness-outline"
                                                size={24}
                                                color={exerciseIntensity === 'moderate' ? PURPLE_ACCENT : SUBDUED}
                                            />
                                            <Text style={[
                                                styles.intensityCardTitle,
                                                exerciseIntensity === 'moderate' && styles.intensityCardTitleSelected
                                            ]}>Moderate</Text>
                                            <Text style={styles.intensityCardSubtitle}>1.0x multiplier</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.intensityCard,
                                                exerciseIntensity === 'vigorous' && styles.intensityCardSelected
                                            ]}
                                            onPress={() => setExerciseIntensity('vigorous')}
                                        >
                                            <Ionicons
                                                name="flash-outline"
                                                size={24}
                                                color={exerciseIntensity === 'vigorous' ? PURPLE_ACCENT : SUBDUED}
                                            />
                                            <Text style={[
                                                styles.intensityCardTitle,
                                                exerciseIntensity === 'vigorous' && styles.intensityCardTitleSelected
                                            ]}>Vigorous</Text>
                                            <Text style={styles.intensityCardSubtitle}>1.2x multiplier</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Calories Calculation Card */}
                                <View style={styles.caloriesCalculationCard}>
                                    <View style={styles.caloriesHeader}>
                                        <Ionicons name="calculator-outline" size={24} color={PURPLE_ACCENT} />
                                        <Text style={styles.caloriesHeaderTitle}>Estimated Calories Burned</Text>
                                    </View>

                                    <View style={styles.caloriesMainResult}>
                                        <Text style={styles.caloriesNumber}>
                                            {calculateCaloriesBurned(
                                                selectedActivity,
                                                parseInt(exerciseDuration) || 30,
                                                userWeight
                                            )}
                                        </Text>
                                        <Text style={styles.caloriesUnit}>calories</Text>
                                    </View>

                                    <View style={styles.formulaContainer}>
                                        <Text style={styles.formulaLabel}>Calculation:</Text>
                                        <Text style={styles.formulaText}>
                                            {exerciseIntensity === 'moderate' ? (
                                                `${selectedActivity.met} MET × 3.5 × ${userWeight}kg × ${exerciseDuration}min ÷ 200`
                                            ) : exerciseIntensity === 'light' ? (
                                                `${selectedActivity.met} MET × 0.8 × 3.5 × ${userWeight}kg × ${exerciseDuration}min ÷ 200`
                                            ) : (
                                                `${selectedActivity.met} MET × 1.2 × 3.5 × ${userWeight}kg × ${exerciseDuration}min ÷ 200`
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Add margin at bottom to ensure space for buttons */}
                        <View style={{ marginBottom: 20 }} />
                    </ScrollView>

                    {/* Buttons - fixed at bottom */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[
                                styles.modalAddButton,
                                {
                                    flex: 1,
                                    backgroundColor: 'transparent',
                                    width: '100%',
                                    borderWidth: 1,
                                    borderColor: PURPLE_ACCENT,
                                    shadowColor: 'transparent',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0,
                                    shadowRadius: 0,
                                    elevation: 0
                                },
                                (!selectedActivity && !isManualEntry && !isStepsEntry) && { opacity: 0.5 },
                                (isManualEntry && !manualActivityName.trim()) && { opacity: 0.5 },
                                (isStepsEntry && (!stepsCount.trim() || parseInt(stepsCount) <= 0)) && { opacity: 0.5 }
                            ]}
                            onPress={addNewExercise}
                            disabled={(!selectedActivity && !isManualEntry && !isStepsEntry) ||
                                (isManualEntry && !manualActivityName.trim()) ||
                                (isStepsEntry && (!stepsCount.trim() || parseInt(stepsCount) <= 0))}
                        >
                            <Text style={[styles.modalButtonText, { color: PURPLE_ACCENT, fontWeight: 'bold' }]}>
                                {isStepsEntry ? 'ADD STEPS' : 'ADD EXERCISE'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    exerciseModalContent: {
        width: '95%',
        maxHeight: '90%',
        backgroundColor: CARD_BG,
        borderRadius: 10,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        flexDirection: 'column' as const,
        justifyContent: 'space-between' as const,
        flex: 1,
    },
    exerciseModalScrollContent: {
        flexGrow: 1,
        paddingTop: 10,
    },
    exerciseModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff', // Default color for when the gradient isn't loaded
        marginBottom: 0,
        textAlign: 'center',
        paddingHorizontal: 10,
        width: '100%'
    },
    exitButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 5,
        zIndex: 10
    },
    headerBackButton: {
        position: 'absolute',
        top: 10,
        left: 10,
        padding: 5,
        zIndex: 10
    },
    popularActivitiesWrapper: {
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 15,
        width: '100%',
    },
    popularActivitiesContainer: {
        margin: 1,
        borderRadius: 9,
        backgroundColor: PRIMARY_BG,
        padding: 12,
    },
    popularActivitiesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    popularActivitiesTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginLeft: 8,
    },
    popularActivitiesScroll: {
        maxHeight: 400,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: PURPLE_ACCENT,
        marginTop: 10,
        marginBottom: 5,
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    orText: {
        marginHorizontal: 10,
        color: SUBDUED,
        fontSize: 14,
    },
    searchInputContainer: {
        marginBottom: 15,
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row' as const,
        alignItems: 'center' as const
    },
    searchInput: {
        flex: 1,
        color: WHITE,
        marginLeft: 8,
        fontSize: 16
    },
    activitiesContainer: {
        flex: 1,
        marginBottom: 10
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedActivityItem: {
        backgroundColor: 'rgba(170, 0, 255, 0.1)',
        borderRadius: 6,
    },
    activityInfo: {
        flex: 1,
    },
    activityName: {
        fontSize: 16,
        fontWeight: '500',
        color: WHITE,
        marginBottom: 2,
    },
    activityMet: {
        fontSize: 14,
        color: SUBDUED,
    },
    checkmarkContainer: {
        paddingHorizontal: 10,
    },
    inputLabel: {
        fontSize: 16,
        color: WHITE,
        marginBottom: 8,
    },
    inputContainer: {
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 15,
    },
    input: {
        color: WHITE,
        fontSize: 16,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    durationInputContainer: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    exerciseModalDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 15,
    },
    intensityButton: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 6,
        paddingVertical: 8,
        alignItems: 'center',
    },
    intensityButtonText: {
        color: SUBDUED,
        fontWeight: '500',
    },
    intensityButtonTextSelected: {
        color: PURPLE_ACCENT,
    },
    caloriesResult: {
        backgroundColor: 'rgba(170, 0, 255, 0.1)',
        padding: 15,
        borderRadius: 8,
        marginTop: 5,
    },
    caloriesFormula: {
        color: SUBDUED,
        marginBottom: 10,
        fontSize: 14,
    },
    caloriesResultText: {
        color: WHITE,
        fontWeight: 'bold',
        fontSize: 18,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
    },
    modalAddButton: {
        backgroundColor: PURPLE_ACCENT,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalButtonText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '500',
    },
    // New styles for the redesigned selected exercise screen
    backButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 8,
    },
    backButtonText: {
        color: PURPLE_ACCENT,
        fontSize: 16,
        marginLeft: 8,
        fontWeight: '500',
    },
    exerciseHeaderCard: {
        backgroundColor: 'rgba(170, 0, 255, 0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(170, 0, 255, 0.2)',
    },
    exerciseIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(170, 0, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    exerciseHeaderInfo: {
        flex: 1,
    },
    exerciseHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    exerciseMetBadge: {
        backgroundColor: 'rgba(170, 0, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    exerciseMetText: {
        color: PURPLE_ACCENT,
        fontSize: 12,
        fontWeight: '600',
    },
    configSection: {
        marginBottom: 24,
    },
    configSectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 16,
    },
    durationCardWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    durationCardGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 12,
    },
    durationCard: {
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 16,
        margin: 1,
    },
    durationInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor set dynamically via theme.colors.inputBackground
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
    },
    durationInput: {
        color: WHITE,
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    durationUnit: {
        color: SUBDUED,
        fontSize: 16,
        marginLeft: 8,
    },
    durationPresets: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    durationPreset: {
        flex: 1,
        // backgroundColor set dynamically via theme.colors.inputBackground
        borderRadius: 8,
        paddingVertical: 12,
        marginHorizontal: 2,
        alignItems: 'center',
    },
    durationPresetSelected: {
        backgroundColor: PURPLE_ACCENT,
    },
    durationPresetText: {
        color: SUBDUED,
        fontSize: 14,
        fontWeight: '500',
    },
    durationPresetTextSelected: {
        color: WHITE,
        fontWeight: '600',
    },
    intensityGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    intensityCard: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    intensityCardSelected: {
        backgroundColor: 'rgba(170, 0, 255, 0.1)',
        borderColor: PURPLE_ACCENT,
    },
    intensityCardTitle: {
        color: WHITE,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 4,
    },
    intensityCardTitleSelected: {
        color: PURPLE_ACCENT,
    },
    intensityCardSubtitle: {
        color: SUBDUED,
        fontSize: 12,
    },
    caloriesCalculationCard: {
        backgroundColor: 'rgba(170, 0, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(170, 0, 255, 0.2)',
    },
    caloriesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    caloriesHeaderTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginLeft: 8,
    },
    caloriesMainResult: {
        alignItems: 'center',
        marginBottom: 16,
    },
    caloriesNumber: {
        fontSize: 36,
        fontWeight: 'bold',
        color: PURPLE_ACCENT,
    },
    caloriesUnit: {
        fontSize: 16,
        color: SUBDUED,
        marginTop: 4,
    },
    formulaContainer: {
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(170, 0, 255, 0.3)',
    },
    formulaLabel: {
        fontSize: 12,
        color: SUBDUED,
        marginBottom: 4,
    },
    formulaText: {
        fontSize: 14,
        color: WHITE,
        fontFamily: 'monospace',
    },
});

export default ExerciseModal; 