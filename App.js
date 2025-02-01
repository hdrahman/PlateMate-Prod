import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Home from "./src/screens/Home";
import FoodLog from "./src/screens/FoodLog";
import Workout from "./src/screens/Workout";
import Chatbot from "./src/screens/Chatbot";
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

//working version
export default function App() {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: "#000",
          card: "#000"
        }
      }}
    >
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          // Make the header always say "Plate Mate" 
          // instead of using the screen name.
          headerTitle: "PlateMate",
          headerStyle: {
            backgroundColor: "#000"
          },
          headerTitleStyle: { //We are going to want to change this from white. Most likely match it to the gemini theme
            color: "#FFF",
            fontSize: 20,
            letterSpacing: 1,
            textTransform: "uppercase"
          },

          // Customize the bottom tab bar
          tabBarStyle: {
            backgroundColor: "#000",
            borderTopColor: "transparent" //investigate this
          },
          tabBarActiveTintColor: "#FF00F5",
          tabBarInactiveTintColor: "#888"
        }}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            tabBarLabel: "Home",
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
            tabBarLabel: "Advisor",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
            )
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

