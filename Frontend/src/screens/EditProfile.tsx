import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    ActivityIndicator,
    Image,
    Dimensions,
    Animated,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Auth, auth } from '../utils/firebase/index';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    getUserProfileByFirebaseUid,
    getUserGoals,
    getUserStreak,
    initDatabase,
    isDatabaseReady,
    updateUserProfile,
    ensureLocationColumnExists
} from '../utils/database';
import {
    cmToFeetInches,
    feetInchesToCm,
    kgToLbs,
    lbsToKg,
    formatHeight,
    formatWeight
} from '../utils/unitConversion';
import _ from 'lodash'; // Import lodash for deep cloning
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extend the User type to include our custom fields
interface ExtendedUser extends Auth.User {
    age?: number;
    height?: number;
    weight?: number;
}

// Colors from ManualFoodEntry.tsx
const PRIMARY_BG = '#000000';
const CARD_BG = '#121212';
const WHITE = '#FFFFFF';
const GRAY = '#AAAAAA';
const LIGHT_GRAY = '#333333';
const BLUE_ACCENT = '#0074dd';
const GRADIENT_START = '#0074dd';
const GRADIENT_END = '#dd0095';
const GRADIENT_MIDDLE = '#5c00dd';
const GREEN = '#4CAF50';
const ORANGE = '#FF9800';
const PURPLE = '#9C27B0';
const PINK = '#FF00F5';

const { width, height } = Dimensions.get('window');

// Create a GradientBorder component for form sections
const GradientBorderBox = ({ children, style }: { children: React.ReactNode, style?: any }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
            />
            <View style={[styles.gradientBorderInner, style]}>
                {children}
            </View>
        </View>
    );
};

const EditProfile = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Animation values
    const slideAnim = React.useRef(new Animated.Value(0)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    // Displayed values (these will be shown in the profile card at the top)
    const [username, setUsername] = useState('');
    const [height, setHeight] = useState('');
    const [heightFeet, setHeightFeet] = useState('');
    const [heightInches, setHeightInches] = useState('');
    const [age, setAge] = useState(0);
    const [weight, setWeight] = useState('');
    const [sex, setSex] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [location, setLocation] = useState('');
    const [timeZone, setTimeZone] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [units, setUnits] = useState('');
    const [isImperialUnits, setIsImperialUnits] = useState(false);
    const [email, setEmail] = useState('');

    // Add editable values (these will be used in the form fields)
    const [editedUsername, setEditedUsername] = useState('');
    const [editedHeightFeet, setEditedHeightFeet] = useState('');
    const [editedHeightInches, setEditedHeightInches] = useState('');
    const [editedWeight, setEditedWeight] = useState('');
    const [editedSex, setEditedSex] = useState('');
    const [editedLocation, setEditedLocation] = useState('');
    const [editedTimeZone, setEditedTimeZone] = useState('');
    const [editedIsImperialUnits, setEditedIsImperialUnits] = useState(false);

    // Add back the UI state variables
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [showTimeZonePicker, setShowTimeZonePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Location options (all countries in the world)
    const locationOptions = [
        'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
        'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain',
        'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
        'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
        'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada',
        'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
        'Congo (Congo-Brazzaville)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
        'Czech Republic (Czechia)', 'Democratic Republic of the Congo', 'Denmark',
        'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
        'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
        'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
        'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Holy See',
        'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
        'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait',
        'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
        'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
        'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
        'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
        'Myanmar (Burma)', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
        'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
        'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
        'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
        'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
        'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
        'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
        'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
        'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
        'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
        'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
        'United Arab Emirates', 'United Kingdom', 'United States of America', 'Uruguay',
        'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
    ].sort();

    // Now set filteredLocations after locationOptions is defined
    const [filteredLocations, setFilteredLocations] = useState([...locationOptions]);

    // Timezone options (comprehensive list)
    const timeZoneOptions = [
        'GMT-12:00 (Baker Island)', 'GMT-11:00 (American Samoa)', 'GMT-10:00 (Hawaii)',
        'GMT-09:30 (Marquesas Islands)', 'GMT-09:00 (Alaska)', 'GMT-08:00 (Los Angeles, Vancouver)',
        'GMT-07:00 (Denver, Edmonton)', 'GMT-06:00 (Mexico City, Chicago)', 'GMT-05:00 (New York, Toronto)',
        'GMT-04:00 (Santiago, Halifax)', 'GMT-03:30 (St. John\'s)', 'GMT-03:00 (Buenos Aires, São Paulo)',
        'GMT-02:00 (South Georgia)', 'GMT-01:00 (Cape Verde)', 'GMT+00:00 (London, Dublin)',
        'GMT+01:00 (Paris, Berlin, Rome)', 'GMT+02:00 (Cairo, Johannesburg)', 'GMT+03:00 (Moscow, Riyadh)',
        'GMT+03:30 (Tehran)', 'GMT+04:00 (Dubai, Baku)', 'GMT+04:30 (Kabul)', 'GMT+05:00 (Karachi, Tashkent)',
        'GMT+05:30 (New Delhi, Mumbai)', 'GMT+05:45 (Kathmandu)', 'GMT+06:00 (Dhaka, Almaty)',
        'GMT+06:30 (Yangon)', 'GMT+07:00 (Bangkok, Jakarta)', 'GMT+08:00 (Beijing, Singapore)',
        'GMT+08:45 (Eucla)', 'GMT+09:00 (Tokyo, Seoul)', 'GMT+09:30 (Adelaide)', 'GMT+10:00 (Sydney, Melbourne)',
        'GMT+10:30 (Lord Howe Island)', 'GMT+11:00 (Noumea)', 'GMT+12:00 (Auckland)',
        'GMT+12:45 (Chatham Islands)', 'GMT+13:00 (Samoa, Tonga)', 'GMT+14:00 (Kiritimati)'
    ];

    // Gamification data
    const [level, setLevel] = useState(12);
    const [xp, setXp] = useState(340);
    const [xpToNextLevel, setXpToNextLevel] = useState(500);
    const [rank, setRank] = useState('Silver Athlete');
    const [streakDays, setStreakDays] = useState(8);
    const [achievements, setAchievements] = useState([
        { name: 'Early Bird', description: 'Complete 5 morning workouts', completed: false, icon: 'sunny' },
        { name: 'Consistency King', description: 'Maintain a 7-day streak', completed: false, icon: 'trending-up' },
        { name: 'Weight Warrior', description: 'Lose 5kg', completed: false, icon: 'barbell' },
        { name: 'Marathon Master', description: 'Run 42km total', completed: false, icon: 'walk' },
        { name: 'Nutrition Ninja', description: 'Log meals for 30 days', completed: false, icon: 'nutrition' },
    ]);

    // Add a state to track unsaved changes
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Add age calculation function (same logic as BasicInfoStep.tsx)
    const calculateAge = (dob: string): number | null => {
        if (!dob || !/^\d{2}-\d{2}-\d{4}$/.test(dob)) return null;

        const [day, month, year] = dob.split('-').map(Number);
        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };

    // Helper function to check if user has made changes to their profile
    const checkForChanges = (key: string, value: any) => {
        setHasUnsavedChanges(true);
    };

    // Move loadProfileData outside useEffect
    const loadProfileData = async () => {
        try {
            setIsLoading(true);

            // Ensure database is initialized
            if (!isDatabaseReady()) {
                await initDatabase();
            }

            if (user && user.uid) {
                // Get user profile from SQLite
                const profile = await getUserProfileByFirebaseUid(user.uid);

                // Get user goals from SQLite
                const goals = await getUserGoals(user.uid);

                // Get user streak
                const streak = await getUserStreak(user.uid);

                // Try to get location from AsyncStorage as fallback
                let savedLocation = '---';
                try {
                    const asyncStorageLocation = await AsyncStorage.getItem(`user_location_${user.uid}`);
                    if (asyncStorageLocation) {
                        savedLocation = asyncStorageLocation;
                    }
                } catch (asyncError) {
                    console.log('Could not load location from AsyncStorage:', asyncError);
                }

                if (profile) {
                    // Set basic profile info (for display in profile card)
                    const firstName = profile.first_name || '---';
                    const lastName = profile.last_name || '';
                    const displayUsername = `${firstName}${lastName ? '_' + lastName : ''}`;

                    setUsername(displayUsername);
                    setEmail(profile.email || '---');

                    // Try to get location from database, fall back to AsyncStorage if not available
                    setLocation(profile.location || savedLocation);

                    // Check if profile has unit_preference and map it to isImperialUnits
                    const isImperial = profile.unit_preference === 'imperial';
                    setIsImperialUnits(isImperial);

                    // Set height (convert from cm if needed)
                    if (profile.height) {
                        if (isImperial) {
                            const { feet, inches } = cmToFeetInches(profile.height);
                            setHeightFeet(feet.toString());
                            setHeightInches(inches.toString());
                            setHeight(`${feet}' ${inches}"`);
                        } else {
                            setHeight(`${profile.height} cm`);
                        }
                    } else {
                        setHeight('---');
                    }

                    // Set weight (convert from kg if needed)
                    if (profile.weight) {
                        if (isImperial) {
                            const lbs = kgToLbs(profile.weight);
                            setWeight(`${Math.round(lbs)} lbs`);
                        } else {
                            setWeight(`${profile.weight} kg`);
                        }
                    } else {
                        setWeight('---');
                    }

                    // Set other profile fields
                    setSex(profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '---');
                    setDateOfBirth(profile.date_of_birth || '---');

                    // Calculate and set age from date_of_birth or use stored age
                    if (profile.date_of_birth) {
                        const calculatedAge = calculateAge(profile.date_of_birth);
                        setAge(calculatedAge || profile.age || 0);
                    } else if (profile.age) {
                        setAge(profile.age);
                    } else {
                        setAge(0);
                    }

                    // Set timezone
                    setTimeZone(profile.timezone || 'UTC');

                    // Set editable values (for form fields)
                    setEditedUsername(displayUsername);
                    setEditedLocation(profile.location || savedLocation); // Use fallback if needed
                    setEditedSex(profile.gender || '');
                    setEditedIsImperialUnits(isImperial);
                    setEditedTimeZone(profile.timezone || 'UTC');

                    if (profile.height) {
                        if (isImperial) {
                            const { feet, inches } = cmToFeetInches(profile.height);
                            setEditedHeightFeet(feet.toString());
                            setEditedHeightInches(inches.toString());
                        }
                    }

                    if (profile.weight) {
                        if (isImperial) {
                            const lbs = kgToLbs(profile.weight);
                            setEditedWeight(Math.round(lbs).toString());
                        } else {
                            setEditedWeight(profile.weight.toString());
                        }
                    }
                }

                if (goals) {
                    // Set nutrition & fitness goals
                    // These values are likely stored in the user_profiles table in our SQLite implementation
                    // rather than separate tables as in the backend
                }

                // Set gamification data
                // Currently we don't have this in the SQLite database directly, so use default/placeholder values
                setLevel(1);
                setXp(0);
                setXpToNextLevel(100);
                setRank('Beginner');
                setStreakDays(streak || 0);

                // Set achievements (placeholder data for now)
                // In a real implementation, we would fetch this from a user_achievements table
                setAchievements([
                    { name: 'Early Bird', description: 'Complete 5 morning workouts', completed: false, icon: 'sunny' },
                    { name: 'Consistency King', description: 'Maintain a 7-day streak', completed: streak >= 7, icon: 'trending-up' },
                    { name: 'Weight Warrior', description: 'Lose 5kg', completed: false, icon: 'barbell' },
                    { name: 'Marathon Master', description: 'Run 42km total', completed: false, icon: 'walk' },
                    { name: 'Nutrition Ninja', description: 'Log meals for 30 days', completed: false, icon: 'nutrition' },
                ]);
            }
        } catch (error) {
            console.error('Error loading profile data from SQLite:', error);
            // Set default values if there's an error
            setUsername('---');
            setHeight('---');
            setWeight('---');
            setSex('---');
            setDateOfBirth('---');
            setLocation('---');
            setEmail(user?.email || '---');
        } finally {
            setIsLoading(false);
        }
    };

    // Keep only one useEffect with the combined functionality
    useEffect(() => {
        // Animation on component mount
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        ]).start();

        // Ensure location column exists using our database utility function
        ensureLocationColumnExists().then(() => {
            // Fetch user data from SQLite database
            loadProfileData();
        }).catch(error => {
            console.error('Error ensuring location column exists:', error);
            // Still try to load profile data even if column creation failed
            loadProfileData();
        });
    }, [user]);

    // Modify input handlers to track changes
    const handleUsernameChange = (text: string) => {
        setEditedUsername(text);
        checkForChanges('username', text);
    };

    const handleSexChange = (value: string) => {
        setEditedSex(value);
        checkForChanges('sex', value);
    };

    const handleHeightFeetChange = (text: string) => {
        setEditedHeightFeet(text);
        checkForChanges('heightFeet', text);
    };

    const handleHeightInchesChange = (text: string) => {
        setEditedHeightInches(text);
        checkForChanges('heightInches', text);
    };

    const handleHeightCmChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value)) {
            setHeight(`${value} cm`);
            checkForChanges('height', value);
        }
    };

    const handleWeightChange = (text: string) => {
        setEditedWeight(text);
        checkForChanges('weight', text);
    };

    const handleLocationChange = (location: string) => {
        setEditedLocation(location);
        checkForChanges('location', location);
    };

    const handleTimeZoneChange = (timezone: string) => {
        setEditedTimeZone(timezone);
        checkForChanges('timezone', timezone);
    };

    const handleUnitSystemChange = (imperial: boolean) => {
        setEditedIsImperialUnits(imperial);
        setShowUnitPicker(false);
        checkForChanges('units', imperial);
    };

    // Update saveProfile to save changes to the database
    const saveProfile = async () => {
        try {
            setIsSaving(true);

            // Convert height from imperial to metric (cm) for storage
            let heightInCm;
            if (editedHeightFeet && editedHeightInches) {
                heightInCm = feetInchesToCm(
                    parseFloat(editedHeightFeet),
                    parseFloat(editedHeightInches)
                );
            } else if (height.includes('cm')) {
                // If height is already in cm, extract the value
                heightInCm = parseFloat(height.replace(/cm/g, '').trim());
            } else {
                heightInCm = 0;
            }

            // Convert weight to metric (kg) for storage
            let weightInKg;
            if (editedWeight) {
                if (editedIsImperialUnits) {
                    // Convert from lbs to kg
                    weightInKg = lbsToKg(parseFloat(editedWeight));
                } else {
                    // Already in kg
                    weightInKg = parseFloat(editedWeight);
                }
            } else {
                weightInKg = 0;
            }

            // Extract first and last name from username
            const nameParts = editedUsername.split('_');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts[1] : '';

            // Create profile data object based strictly on the fields that exist in user_profiles table
            // Exclude location first in case it's not supported
            const baseProfileData = {
                first_name: firstName,
                last_name: lastName,
                height: heightInCm,
                weight: weightInKg,
                gender: editedSex.toLowerCase(),
                unit_preference: editedIsImperialUnits ? 'imperial' : 'metric',
                timezone: editedTimeZone || 'UTC',
                email: email
            };

            // Save the location value regardless of whether we could save it to the database
            // We'll use it for the UI display
            const locationToDisplay = editedLocation || '';

            // Attempt to save with location first
            if (user) {
                try {
                    // Try saving with location included
                    const profileDataWithLocation = {
                        ...baseProfileData,
                        location: locationToDisplay
                    };

                    console.log('Saving profile with location:', profileDataWithLocation);
                    await updateUserProfile(user.uid, profileDataWithLocation);

                    // If successful, save location value to AsyncStorage as backup
                    await AsyncStorage.setItem(`user_location_${user.uid}`, locationToDisplay);
                } catch (locationError) {
                    console.error("Failed to save with location column:", locationError);

                    // Fallback: Try saving without location field
                    console.log('Falling back to saving without location field');
                    await updateUserProfile(user.uid, baseProfileData);

                    // Save location to AsyncStorage as a fallback storage mechanism
                    await AsyncStorage.setItem(`user_location_${user.uid}`, locationToDisplay);
                }

                // Now update the displayed values to match the edited values
                setUsername(editedUsername);
                setLocation(locationToDisplay); // Always update UI with the location value
                setSex(editedSex.charAt(0).toUpperCase() + editedSex.slice(1));
                setIsImperialUnits(editedIsImperialUnits);

                // Update height based on units
                if (editedIsImperialUnits) {
                    setHeightFeet(editedHeightFeet);
                    setHeightInches(editedHeightInches);
                    setHeight(`${editedHeightFeet}' ${editedHeightInches}"`);
                } else {
                    setHeight(`${heightInCm} cm`);
                }

                // Update weight based on units
                if (editedIsImperialUnits) {
                    const lbs = parseFloat(editedWeight);
                    setWeight(`${lbs} lbs`);
                } else {
                    setWeight(`${weightInKg} kg`);
                }

                setTimeZone(editedTimeZone);

                // Reset unsaved changes flag after successful save
                setHasUnsavedChanges(false);

                Alert.alert('Success', 'Profile updated successfully.');
            } else {
                Alert.alert('Error', 'User not found. Please log in again.');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', `Failed to update profile: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Update renderProfileTab to include editable fields
    const renderProfileTab = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={BLUE_ACCENT} />
                    <Text style={styles.loadingText}>Loading profile data...</Text>
                </View>
            );
        }

        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Profile Card - This will remain unchanged until save is clicked */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.profileCard}
                >
                    <View style={styles.profileCardContent}>
                        <Image
                            source={require('../../assets/default-avatar.png')}
                            style={styles.profileImage}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{username || '---'}</Text>
                            <Text style={styles.profileLocation}>{location || '---'}</Text>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{weight || '---'}</Text>
                                    <Text style={styles.statLabel}>Weight</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{height || '---'}</Text>
                                    <Text style={styles.statLabel}>Height</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{age || '---'}</Text>
                                    <Text style={styles.statLabel}>Age</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    {/* Only show save changes badge if there are unsaved changes */}
                    {hasUnsavedChanges && (
                        <View style={styles.readOnlyBadge}>
                            <Ionicons name="information-circle" size={16} color={WHITE} />
                            <Text style={styles.readOnlyBadgeText}>Save changes to update profile</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Form Fields - These will be editable */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={editedUsername}
                            onChangeText={handleUsernameChange}
                            placeholder="Your username"
                            placeholderTextColor={GRAY}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <Text style={[styles.displayValue, styles.disabledInput]}>{email || '---'}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Sex</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[styles.segmentOption, editedSex.toLowerCase() === 'male' && styles.segmentActive]}
                                onPress={() => handleSexChange('male')}
                            >
                                <Text style={[styles.segmentText, editedSex.toLowerCase() === 'male' && styles.segmentTextActive]}>Male</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, editedSex.toLowerCase() === 'female' && styles.segmentActive]}
                                onPress={() => handleSexChange('female')}
                            >
                                <Text style={[styles.segmentText, editedSex.toLowerCase() === 'female' && styles.segmentTextActive]}>Female</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentOption, editedSex.toLowerCase() === 'other' && styles.segmentActive]}
                                onPress={() => handleSexChange('other')}
                            >
                                <Text style={[styles.segmentText, editedSex.toLowerCase() === 'other' && styles.segmentTextActive]}>Other</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputRow}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.inputLabel}>Height</Text>
                            {editedIsImperialUnits ? (
                                <View style={styles.heightInputContainer}>
                                    <View style={styles.heightInputGroup}>
                                        <TextInput
                                            style={styles.heightInput}
                                            value={editedHeightFeet}
                                            onChangeText={handleHeightFeetChange}
                                            keyboardType="numeric"
                                            placeholderTextColor={GRAY}
                                            placeholder="5"
                                        />
                                        <Text style={styles.heightUnitText}>ft</Text>
                                    </View>
                                    <View style={styles.heightInputGroup}>
                                        <TextInput
                                            style={styles.heightInput}
                                            value={editedHeightInches}
                                            onChangeText={handleHeightInchesChange}
                                            keyboardType="numeric"
                                            placeholderTextColor={GRAY}
                                            placeholder="11"
                                        />
                                        <Text style={styles.heightUnitText}>in</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.heightInputContainer}>
                                    <View style={[styles.heightInputGroup, { flex: 1 }]}>
                                        <TextInput
                                            style={styles.heightInput}
                                            value={height.includes('cm') ? height.replace(/cm/g, '').trim() : ''}
                                            onChangeText={handleHeightCmChange}
                                            keyboardType="numeric"
                                            placeholderTextColor={GRAY}
                                            placeholder="180"
                                        />
                                        <Text style={styles.heightUnitText}>cm</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.inputLabel}>Weight</Text>
                            <View style={styles.heightInputContainer}>
                                <View style={[styles.heightInputGroup, { flex: 1 }]}>
                                    <TextInput
                                        style={styles.heightInput}
                                        value={editedWeight}
                                        onChangeText={handleWeightChange}
                                        keyboardType="numeric"
                                        placeholderTextColor={GRAY}
                                        placeholder="75"
                                    />
                                    <Text style={styles.heightUnitText}>{editedIsImperialUnits ? "lbs" : "kg"}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </GradientBorderBox>

                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Location & Preferences</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Location</Text>
                        <TouchableOpacity
                            style={styles.dropdownField}
                            onPress={() => setShowLocationPicker(true)}
                        >
                            <Text style={styles.dropdownText} numberOfLines={1} ellipsizeMode="tail">
                                {editedLocation || 'Select location'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Time Zone</Text>
                        <TouchableOpacity
                            style={styles.dropdownField}
                            onPress={() => setShowTimeZonePicker(true)}
                        >
                            <Text style={styles.dropdownText} numberOfLines={1} ellipsizeMode="tail">
                                {editedTimeZone || timeZone || 'Select time zone'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Measurement Units</Text>
                        <TouchableOpacity
                            style={styles.dropdownField}
                            onPress={() => setShowUnitPicker(true)}
                        >
                            <Text style={styles.dropdownText} numberOfLines={1} ellipsizeMode="tail">
                                {editedIsImperialUnits ? 'Imperial (lbs, feet/inches)' : 'Metric (kg, cm)'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={GRADIENT_MIDDLE} />
                        </TouchableOpacity>
                    </View>
                </GradientBorderBox>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveProfile}
                    disabled={isSaving}
                >
                    <LinearGradient
                        colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        {isSaving ? (
                            <ActivityIndicator color={WHITE} size="small" />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderAchievementsTab = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={BLUE_ACCENT} />
                    <Text style={styles.loadingText}>Loading achievements data...</Text>
                </View>
            );
        }

        return (
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                            })
                        }]
                    }
                ]}
            >
                {/* Level Card */}
                <LinearGradient
                    colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.levelCard}
                >
                    <View style={styles.levelHeader}>
                        <View>
                            <Text style={styles.levelTitle}>Level {level || '1'}</Text>
                            <Text style={styles.levelRank}>{rank || 'Beginner'}</Text>
                        </View>
                        <View style={styles.streakContainer}>
                            <Ionicons name="flame" size={24} color={ORANGE} />
                            <Text style={styles.streakText}>{streakDays || '0'} day streak</Text>
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${((xp || 0) / (xpToNextLevel || 100)) * 100}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>{xp || 0} / {xpToNextLevel || 100} XP</Text>
                    </View>
                </LinearGradient>

                {/* Achievements */}
                <GradientBorderBox>
                    <Text style={styles.sectionTitle}>Achievements</Text>

                    {achievements.length > 0 ? (
                        achievements.map((achievement, index) => (
                            <View key={index} style={styles.achievementItem}>
                                <LinearGradient
                                    colors={achievement.completed ?
                                        [GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END] :
                                        ['#333', '#444', '#555']}
                                    style={styles.achievementIcon}
                                >
                                    <Ionicons
                                        name={achievement.icon as any}
                                        size={24}
                                        color={achievement.completed ? WHITE : GRAY}
                                    />
                                </LinearGradient>
                                <View style={styles.achievementInfo}>
                                    <Text style={styles.achievementName}>{achievement.name}</Text>
                                    <Text style={styles.achievementDesc}>{achievement.description}</Text>
                                </View>
                                {achievement.completed ? (
                                    <Ionicons name="checkmark-circle" size={24} color={GREEN} />
                                ) : (
                                    <Ionicons name="lock-closed" size={24} color={PINK} />
                                )}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noDataText}>No achievements available</Text>
                    )}
                </GradientBorderBox>

                <TouchableOpacity
                    style={styles.goalsButton}
                    onPress={() => navigation.goBack()}
                >
                    <LinearGradient
                        colors={[GRADIENT_START, GRADIENT_MIDDLE, GRADIENT_END]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.goalsButtonGradient}
                    >
                        <Text style={styles.goalsButtonText}>Return to Profile</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['rgba(92, 0, 221, 0.3)', 'transparent']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 28 }}></View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
                    onPress={() => setActiveTab('profile')}
                >
                    <Ionicons
                        name="person"
                        size={24}
                        color={activeTab === 'profile' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'profile' && styles.activeTabText
                        ]}
                    >
                        Profile
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
                    onPress={() => setActiveTab('achievements')}
                >
                    <Ionicons
                        name="trophy"
                        size={24}
                        color={activeTab === 'achievements' ? GRADIENT_MIDDLE : GRAY}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'achievements' && styles.activeTabText
                        ]}
                    >
                        Achievements
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {activeTab === 'profile' ? renderProfileTab() : renderAchievementsTab()}
            </ScrollView>

            {/* Units Selection Modal */}
            <Modal
                visible={showUnitPicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowUnitPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalContainer}
                    activeOpacity={1}
                    onPress={() => setShowUnitPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Measurement Units</Text>

                        <TouchableOpacity
                            style={[styles.modalOption, editedIsImperialUnits && styles.modalOptionSelected]}
                            onPress={() => handleUnitSystemChange(true)}
                        >
                            <Text style={[styles.modalOptionText, editedIsImperialUnits && styles.modalOptionTextSelected]}>
                                Imperial (lbs, feet/inches)
                            </Text>
                            {editedIsImperialUnits && <Ionicons name="checkmark" size={20} color={WHITE} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalOption, !editedIsImperialUnits && styles.modalOptionSelected]}
                            onPress={() => handleUnitSystemChange(false)}
                        >
                            <Text style={[styles.modalOptionText, !editedIsImperialUnits && styles.modalOptionTextSelected]}>
                                Metric (kg, cm)
                            </Text>
                            {!editedIsImperialUnits && <Ionicons name="checkmark" size={20} color={WHITE} />}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Location Picker Modal */}
            <Modal
                visible={showLocationPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowLocationPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.pickerModalContent]}>
                        <LinearGradient
                            colors={['rgba(92, 0, 221, 0.8)', 'rgba(0, 116, 221, 0.6)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.pickerHeader}
                        >
                            <Text style={styles.pickerTitle}>Select Country</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowLocationPicker(false);
                                    setSearchQuery('');
                                    setFilteredLocations([...locationOptions]);
                                }}
                                style={styles.pickerCloseIcon}
                            >
                                <Ionicons name="close" size={24} color={WHITE} />
                            </TouchableOpacity>
                        </LinearGradient>

                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={GRAY} style={styles.searchIcon} />
                            <TextInput
                                style={[styles.searchInput, { color: WHITE }]}
                                placeholder="Search countries..."
                                placeholderTextColor={GRAY}
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    if (text.trim() === '') {
                                        setFilteredLocations([...locationOptions]);
                                    } else {
                                        const filtered = locationOptions.filter(
                                            country => country.toLowerCase().includes(text.toLowerCase())
                                        );
                                        setFilteredLocations(filtered);
                                    }
                                }}
                                returnKeyType="search"
                                autoCapitalize="none"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        setFilteredLocations([...locationOptions]);
                                    }}
                                    style={styles.clearSearchButton}
                                >
                                    <Ionicons name="close-circle" size={20} color={GRAY} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {filteredLocations.length > 0 ? (
                            <ScrollView style={styles.pickerScrollView}>
                                {filteredLocations.map((loc, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.pickerOption, editedLocation === loc && styles.pickerOptionSelected]}
                                        onPress={() => {
                                            handleLocationChange(loc);
                                            setShowLocationPicker(false);
                                            setSearchQuery('');
                                            setFilteredLocations([...locationOptions]);
                                        }}
                                    >
                                        <Text style={[styles.pickerOptionText, editedLocation === loc && styles.pickerOptionTextSelected]}>
                                            {loc}
                                        </Text>
                                        {editedLocation === loc && <Ionicons name="checkmark-circle" size={20} color={GRADIENT_MIDDLE} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={styles.noResultsContainer}>
                                <Ionicons name="search-outline" size={50} color={GRAY} />
                                <Text style={styles.noResultsText}>No countries found</Text>
                                <Text style={styles.noResultsSubText}>Try a different search term</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Time Zone Picker Modal */}
            <Modal
                visible={showTimeZonePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTimeZonePicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.pickerModalContent]}>
                        <LinearGradient
                            colors={['rgba(92, 0, 221, 0.8)', 'rgba(0, 116, 221, 0.6)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.pickerHeader}
                        >
                            <Text style={styles.pickerTitle}>Select Time Zone</Text>
                            <TouchableOpacity
                                onPress={() => setShowTimeZonePicker(false)}
                                style={styles.pickerCloseIcon}
                            >
                                <Ionicons name="close" size={24} color={WHITE} />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={styles.pickerScrollView}>
                            {timeZoneOptions.map((tz, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.pickerOption, editedTimeZone === tz && styles.pickerOptionSelected]}
                                    onPress={() => {
                                        handleTimeZoneChange(tz);
                                        setShowTimeZonePicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerOptionText, editedTimeZone === tz && styles.pickerOptionTextSelected]}>
                                        {tz}
                                    </Text>
                                    {editedTimeZone === tz && <Ionicons name="checkmark-circle" size={20} color={GRADIENT_MIDDLE} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 20,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 8,
    },
    saveText: {
        color: GRADIENT_MIDDLE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: LIGHT_GRAY,
        justifyContent: 'center',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginHorizontal: 8,
        minWidth: 130,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: GRADIENT_MIDDLE,
    },
    tabText: {
        color: GRAY,
        fontSize: 16,
        marginLeft: 8,
        fontWeight: '500',
    },
    activeTabText: {
        color: GRADIENT_MIDDLE,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    tabContent: {
        padding: 16,
    },
    profileCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    profileCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: WHITE,
    },
    profileInfo: {
        marginLeft: 20,
        flex: 1,
    },
    profileName: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    profileLocation: {
        color: WHITE,
        fontSize: 16,
        opacity: 0.8,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    statLabel: {
        color: WHITE,
        fontSize: 12,
        opacity: 0.8,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        paddingVertical: 8,
    },
    editButtonText: {
        color: WHITE,
        marginLeft: 8,
        fontWeight: '600',
    },
    gradientBorderContainer: {
        marginBottom: 20,
        borderRadius: 16,
        position: 'relative',
        padding: 2,
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    gradientBorderInner: {
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 16,
    },
    formSection: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        color: GRAY,
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    inputDisabled: {
        opacity: 0.7,
    },
    inputHint: {
        color: GRAY,
        fontSize: 12,
        marginTop: 4,
    },
    inputRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        overflow: 'hidden',
    },
    segmentOption: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    segmentText: {
        color: GRAY,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: WHITE,
    },
    heightInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    heightInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        flex: 1,
    },
    heightInput: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
        flex: 1,
        minWidth: 50,
    },
    heightUnitText: {
        color: WHITE,
        fontSize: 16,
        marginLeft: 8,
    },
    dropdownField: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: WHITE,
        fontSize: 16,
        flex: 1,
    },
    saveButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginVertical: 20,
    },
    saveButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    levelCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    levelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    levelTitle: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
    },
    levelRank: {
        color: GRAY,
        fontSize: 16,
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streakText: {
        color: WHITE,
        fontSize: 16,
        marginLeft: 8,
    },
    progressContainer: {
        marginTop: 10,
    },
    progressBar: {
        height: 10,
        backgroundColor: LIGHT_GRAY,
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 5,
    },
    progressFill: {
        height: '100%',
        backgroundColor: GRADIENT_MIDDLE,
    },
    progressText: {
        color: WHITE,
        fontSize: 14,
        textAlign: 'center',
    },
    achievementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(28, 28, 30, 0.6)',
        borderRadius: 12,
        padding: 12,
    },
    achievementIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    achievementCompleted: {
        backgroundColor: GRADIENT_MIDDLE,
    },
    achievementIncomplete: {
        backgroundColor: LIGHT_GRAY,
    },
    achievementInfo: {
        flex: 1,
    },
    achievementName: {
        color: WHITE,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    achievementDesc: {
        color: GRAY,
        fontSize: 14,
    },
    achievementStatus: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    goalsButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginVertical: 20,
    },
    goalsButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    goalsButtonText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    modalContent: {
        width: width * 0.85,
        backgroundColor: CARD_BG,
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: LIGHT_GRAY,
    },
    modalOptionSelected: {
        borderColor: GRADIENT_MIDDLE,
        backgroundColor: 'rgba(92, 0, 221, 0.1)',
    },
    modalOptionText: {
        color: GRAY,
        fontSize: 16,
    },
    modalOptionTextSelected: {
        color: WHITE,
        fontWeight: '500',
    },
    pickerModalContent: {
        width: width * 0.95,
        maxHeight: height * 0.8,
        backgroundColor: CARD_BG,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    pickerTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
    },
    pickerCloseIcon: {
        padding: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: LIGHT_GRAY,
        margin: 10,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 45,
        fontSize: 16,
    },
    pickerScrollView: {
        maxHeight: height * 0.6,
    },
    pickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    pickerOptionSelected: {
        backgroundColor: 'rgba(92, 0, 221, 0.15)',
    },
    pickerOptionText: {
        color: WHITE,
        fontSize: 16,
    },
    pickerOptionTextSelected: {
        color: GRADIENT_MIDDLE,
        fontWeight: '600',
    },
    clearSearchButton: {
        padding: 5,
    },
    noResultsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    noResultsText: {
        color: WHITE,
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15,
    },
    noResultsSubText: {
        color: GRAY,
        fontSize: 14,
        marginTop: 5,
    },
    readOnlyText: {
        fontSize: 16,
        color: WHITE,
        flex: 1,
        textAlign: 'right',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        fontSize: 16,
        color: WHITE,
        marginTop: 10,
    },
    noDataText: {
        fontSize: 16,
        color: GRAY,
        textAlign: 'center',
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        color: GRAY,
        fontSize: 14,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    achievementsList: {
        marginBottom: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    displayValue: {
        backgroundColor: LIGHT_GRAY,
        borderRadius: 8,
        padding: 12,
        color: WHITE,
        fontSize: 16,
    },
    readOnlyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginTop: 12,
    },
    readOnlyBadgeText: {
        color: WHITE,
        marginLeft: 6,
        fontWeight: '600',
    },
    disabledInput: {
        opacity: 0.7,
        backgroundColor: 'rgba(30, 30, 30, 0.8)', // Darker background for disabled input
    },
});

export default EditProfile;
