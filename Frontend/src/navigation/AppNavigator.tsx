import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

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
import PrivacyPolicy from '../screens/PrivacyPolicy';
import DebugOnboarding from '../components/DebugOnboarding';
import FoodLog from '../screens/FoodLog';
import FoodDetail from '../screens/FoodDetail';
import Chatbot from '../screens/Chatbot';
import ImageCapture from '../screens/ImageCapture';
import Camera from '../screens/Camera';
import BarcodeScanner from '../screens/BarcodeScanner';
import Manual from '../screens/Manual';
import MealGallery from '../screens/MealGallery';
// Import other screens as needed - these would be your existing screens
// import HomeScreen from '../screens/HomeScreen';
// import MealLogScreen from '../screens/MealLogScreen';
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
    Settings: undefined;
    Notifications: undefined;
    DataSharing: undefined;
    PrivacyPolicy: undefined;
    DebugOnboarding: undefined;
    FoodLog: { refresh?: number; mealIdFilter?: number };
    FoodDetail: { foodId: number };
    Chatbot: undefined;
    ImageCapture: { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
    Camera: undefined;
    BarcodeScanner: undefined;
    Manual: { mealType: string; sourcePage?: string };
    MealGallery: undefined;
    // Add other screens as needed
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Bottom tab navigator
const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            id={undefined}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = 'help-outline';

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'MealLog') {
                        iconName = focused ? 'restaurant' : 'restaurant-outline';
                    } else if (route.name === 'Exercise') {
                        iconName = focused ? 'fitness' : 'fitness-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    // You can return any component here
                    return <Ionicons name={iconName as any} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#2196F3',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: {
                    backgroundColor: '#1C1C1E',
                    borderTopColor: '#333',
                },
                headerShown: false,
            })}
        >
            {/* 
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="MealLog" component={MealLogScreen} />
      <Tab.Screen name="Exercise" component={ExerciseScreen} /> 
      */}
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
};

// Main stack navigator
const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                id={undefined}
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: '#000' },
                }}
            >
                <Stack.Screen name="Main" component={MainTabNavigator} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Goals" component={GoalsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfile} />
                <Stack.Screen name="EditGoals" component={EditGoals} />
                <Stack.Screen name="PremiumSubscription" component={PremiumSubscription} />
                <Stack.Screen name="ChangePassword" component={ChangePassword} />
                <Stack.Screen name="Settings" component={Settings} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="DataSharing" component={DataSharing} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
                <Stack.Screen name="DebugOnboarding" component={DebugOnboarding} />
                <Stack.Screen name="FoodLog" component={FoodLog} />
                <Stack.Screen name="FoodDetail" component={FoodDetail} />
                <Stack.Screen name="Chatbot" component={Chatbot} />
                <Stack.Screen name="ImageCapture" component={ImageCapture} />
                <Stack.Screen name="Camera" component={Camera} />
                <Stack.Screen name="BarcodeScanner" component={BarcodeScanner} />
                <Stack.Screen name="Manual" component={Manual} />
                <Stack.Screen name="MealGallery" component={MealGallery} />
                {/* Add your other screens here */}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator; 