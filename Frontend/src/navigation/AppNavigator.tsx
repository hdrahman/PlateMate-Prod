import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import ProfileScreen from '../screens/ProfileScreen';
import GoalsScreen from '../screens/GoalsScreen';
import EditProfile from '../screens/EditProfile';
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
                {/* Add your other screens here */}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator; 