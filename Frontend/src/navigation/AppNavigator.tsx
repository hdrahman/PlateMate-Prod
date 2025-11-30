import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';

// Import screens
import ProfileScreen from '../screens/ProfileScreen';
import GoalsScreen from '../screens/GoalsScreen';
import EditProfile from '../screens/EditProfile';
import EditGoals from '../screens/EditGoals';
import PremiumSubscription from '../screens/PremiumSubscription';
import ChangePassword from '../screens/ChangePassword';
import Settings from '../screens/Settings';
import NotificationsScreen from '../screens/Notifications';
import DataSharing from '../screens/DataSharing';
import ForgotPassword from '../screens/ForgotPassword';
import ResetPassword from '../screens/ResetPassword';
import PrivacyPolicy from '../screens/PrivacyPolicy';
import LegalTerms from '../screens/LegalTerms';
import AboutCalculations from '../screens/AboutCalculations';
import FoodLog from '../screens/FoodLog';
import FoodDetail from '../screens/FoodDetail';
import Chatbot from '../screens/Chatbot';
import ImageCapture from '../screens/ImageCapture';
import Scanner from '../screens/Scanner';
import Manual from '../screens/Manual';
import MealGallery from '../screens/MealGallery';
import Home from '../screens/Home';
import FutureSelfRecordingSimple from '../screens/FutureSelfRecordingSimple';
import FeatureRequestsScreen from '../screens/FeatureRequests';
import CreateFeatureRequestScreen from '../screens/CreateFeatureRequest';
// Import other screens as needed - these would be your existing screens
// import ExerciseScreen from '../screens/ExerciseScreen';

// Define types for the navigation
type RootStackParamList = {
    Main: undefined;
    Profile: undefined;
    Goals: undefined;
    EditProfile: undefined;
    EditGoals: undefined;
    PremiumSubscription: undefined;
    ChangePassword: undefined;
    ForgotPassword: undefined;
    ResetPassword: undefined;
    Settings: undefined;
    Notifications: undefined;
    DataSharing: undefined;
    PrivacyPolicy: undefined;
    LegalTerms: undefined;
    AboutCalculations: undefined;
    FoodDetail: {
        foodId?: number;
        nutritionData?: any[];
        mealId?: string;
        mealType?: string;
        brandName?: string;
        quantity?: string;
        notes?: string;
        foodName?: string;
        localImagePaths?: string[];
    };
    Chatbot: undefined;
    ImageCapture: { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
    Scanner: { mode?: 'camera' | 'barcode' };
    Manual: { mealType: string; sourcePage?: string };
    MealGallery: undefined;
    FutureSelfRecordingSimple: undefined;
    FeatureRequests: undefined;
    CreateFeatureRequest: undefined;
    // Add other screens as needed
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Bottom tab navigator
const MainTabNavigator = () => {
    const { theme } = useContext(ThemeContext);

    return (
        <Tab.Navigator
            id={undefined}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = 'help-outline';

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'FoodLog') {
                        iconName = focused ? 'restaurant' : 'restaurant-outline';
                    } else if (route.name === 'Exercise') {
                        iconName = focused ? 'fitness' : 'fitness-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    // You can return any component here
                    return <Ionicons name={iconName as any} size={size} color={color} />;
                },
                tabBarActiveTintColor: theme.colors.tabBarActive,
                tabBarInactiveTintColor: theme.colors.tabBarInactive,
                tabBarStyle: {
                    backgroundColor: theme.colors.tabBarBackground,
                    borderTopColor: theme.colors.border,
                },
                tabBarHideOnKeyboard: true,
                headerShown: false,
            })}
        >
            <Tab.Screen name="Home" component={Home} />
            <Tab.Screen name="FoodLog" component={FoodLog} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
};

// Main stack navigator
const AppNavigator = () => {
    const { theme } = useContext(ThemeContext);

    return (
        <NavigationContainer>
            <Stack.Navigator
                id={undefined}
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: theme.colors.background },
                }}
            >
                <Stack.Screen name="Main" component={MainTabNavigator} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Goals" component={GoalsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfile} />
                <Stack.Screen name="EditGoals" component={EditGoals} />
                <Stack.Screen name="PremiumSubscription" component={PremiumSubscription} />
                <Stack.Screen name="ChangePassword" component={ChangePassword} />
                <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                <Stack.Screen name="ResetPassword" component={ResetPassword} />
                <Stack.Screen name="Settings" component={Settings} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="DataSharing" component={DataSharing} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
                <Stack.Screen name="LegalTerms" component={LegalTerms} />
                <Stack.Screen name="AboutCalculations" component={AboutCalculations} />
                <Stack.Screen name="FoodDetail" component={FoodDetail} />
                <Stack.Screen name="Chatbot" component={Chatbot} />
                <Stack.Screen name="ImageCapture" component={ImageCapture} />
                <Stack.Screen name="Scanner" component={Scanner} />
                <Stack.Screen name="Manual" component={Manual} />
                <Stack.Screen name="MealGallery" component={MealGallery} />
                <Stack.Screen name="FutureSelfRecordingSimple" component={FutureSelfRecordingSimple} />
                <Stack.Screen name="FeatureRequests" component={FeatureRequestsScreen} />
                <Stack.Screen name="CreateFeatureRequest" component={CreateFeatureRequestScreen} />
                {/* Add your other screens here */}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;