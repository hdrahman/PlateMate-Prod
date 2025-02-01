import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TouchableOpacity, View, Text } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import Home from "./src/screens/Home";
import FoodLog from "./src/screens/FoodLog";
import Workout from "./src/screens/Workout";
import Chatbot from "./src/screens/Chatbot";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: "#000",
          card: "#000",
        },
      }}
    >
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={() => ({
          // Keep the header black
          headerStyle: { backgroundColor: "#000" },
          headerTitleAlign: "center",

          /**
           * 1) Header Title (Gradient + Glow)
           */
          headerTitle: () => (
            <View
              style={{
                // iOS shadow props for glow:
                shadowColor: "#FF00F5",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
                // Android fallback:
                elevation: 6,
              }}
            >
              <MaskedView
                style={{ alignItems: "center", justifyContent: "center" }}
                maskElement={
                  <Text
                    style={{
                      fontSize: 23,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    PlateMate
                  </Text>
                }
              >
                <LinearGradient
                  colors={["#5A60EA", "#FF00F5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    // Must be at least as big as the text
                    width: 160,
                    height: 35,
                  }}
                />
              </MaskedView>
            </View>
          ),

          /**
           * 2) Header Icons (Gradient + Glow)
           */
          headerLeft: () => (
            <TouchableOpacity style={{ marginLeft: 15 }}>
              <GlowIcon
                name="person-circle-outline"
                size={35}
                gradientColors={["#5A60EA", "#FF00F5"]}
              />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity style={{ marginRight: 15 }}>
              <GlowIcon
                name="notifications-outline"
                size={25}
                gradientColors={["#5A60EA", "#FF00F5"]}
              />
            </TouchableOpacity>
          ),

          /**
           * 3) Tab bar styling
           */
          tabBarStyle: {
            backgroundColor: "#000",
            borderTopColor: "transparent",
          },
          tabBarActiveTintColor: "#FF00F5",
          tabBarInactiveTintColor: "#888",
        })}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Food Log"
          component={FoodLog}
          options={{
            tabBarLabel: "Food Log",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Workouts"
          component={Workout}
          options={{
            tabBarLabel: "Workouts",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Chatbot"
          component={Chatbot}
          options={{
            tabBarLabel: "Advisor",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="chatbubble-ellipses-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

/**
 * A reusable component that masks an Ionicon with a linear gradient,
 * and also adds a surrounding glow.
 */
function GlowIcon({ name, size, gradientColors }) {
  return (
    <View
      style={{
        // Glow effect on iOS
        shadowColor: "#FF00F5",
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 10,
        shadowOpacity: 0.6,
        // Minimal fallback for Android
        elevation: 6,
      }}
    >
      <MaskedView
        maskElement={
          <Ionicons
            name={name}
            size={size}
            color="white" // fully opaque for the mask
            style={{ backgroundColor: "transparent" }}
          />
        }
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: size, height: size }}
        />
      </MaskedView>
    </View>
  );
}
