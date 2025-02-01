import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Home from "./src/screens/Home";
import FoodLog from "./src/screens/FoodLog";
import Workout from "./src/screens/Workout";
import Chatbot from "./src/screens/Chatbot";
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();


export default function App() {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: "#000", // main background
          card: "#000"        // header/tab background
        }
      }}
    >
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          // Make the header always say "Plate Mate" 
          // instead of using the screen name.
          headerTitle: "Plate Mate",
          headerStyle: {
            backgroundColor: "#000"
          },
          headerTitleStyle: {
            color: "#FFF",
            fontSize: 20,
            letterSpacing: 1,
            textTransform: "uppercase"
          },

          // Customize the bottom tab bar
          tabBarStyle: {
            backgroundColor: "#000",
            borderTopColor: "transparent"
          },
          tabBarActiveTintColor: "#FF00F5",
          tabBarInactiveTintColor: "#666" // or #888, whichever you prefer
        }}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            // The label that appears under the tab icon
            tabBarLabel: "Home",
            // Ionicon example (you can pick any icon)
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            )
          }}
        />
        <Tab.Screen
          name="Food Log"
          component={FoodLog}
          options={{
            tabBarLabel: "Food Log",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" color={color} size={size} />
            )
          }}
        />
        <Tab.Screen
          name="Workouts"
          component={Workout}
          options={{
            tabBarLabel: "Workouts",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" color={color} size={size} />
            )
          }}
        />
        <Tab.Screen
          name="Chatbot"
          component={Chatbot}
          options={{
            tabBarLabel: "Chatbot",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
            )
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
