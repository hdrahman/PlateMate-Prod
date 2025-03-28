import React, { useState, useEffect } from "react";
import { NavigationContainer, DefaultTheme, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View, Text, StatusBar, Dimensions, ActivityIndicator } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from 'react-native-svg';
import { handleTakePhoto } from './src/screens/Camera';
import { initDatabase } from './src/utils/database';
import { startPeriodicSync, setupOnlineSync } from './src/utils/syncService';

import Home from "./src/screens/Home";
import FoodLog from "./src/screens/FoodLog";
import Workout from "./src/screens/Workout";
import Chatbot from "./src/screens/Chatbot";
import EditProfile from './src/screens/EditProfile';
import EditGoals from './src/screens/EditGoals';
import DeleteAccount from './src/screens/DeleteAccount';
import ChangePassword from './src/screens/ChangePassword';
import AboutUs from './src/screens/AboutUs';
import Settings from './src/screens/Settings';
import CameraScreen from './src/screens/Camera';
import ImageCaptureScreen from './src/screens/ImageCapture';
import Nutrients from './src/screens/Nutrients';

const { width } = Dimensions.get("window");
const BASE_BUTTON_SIZE = 55;
const BUTTON_SIZE = Math.min(BASE_BUTTON_SIZE, width * 0.15);
const BUTTON_RADIUS = BUTTON_SIZE / 2;
const OFFSET = BUTTON_RADIUS; // to center the button

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
function CustomTabBarButton({ children }) {
  const navigation = useNavigation();

  return (
    <View
      style={{
        position: 'absolute',
        left: '50%',
        top: -20,
        marginLeft: -OFFSET, // Center the container
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_RADIUS,
          backgroundColor: "#000",
          shadowColor: "#FF00F5",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 10,
          elevation: 4,
          borderWidth: 0.7,          // reduced from 1 to 0.5
          borderColor: '#FF00F520', // semi-transparent pink border
        }}
        onPress={() => navigation.navigate('ImageCapture', { mealType: 'Snacks' })}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ navigation }) => ({
        // Keep the header slightly lighter and add a downward curve
        headerStyle: {
          backgroundColor: "#000", // Back to black background
          borderBottomLeftRadius: 20, // Curved bottom
          borderBottomRightRadius: 20, // Curved bottom
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
          overflow: 'hidden',
        },
        headerBackground: () => (
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Svg
              height="100%"
              width="100%"
              viewBox="0 0 1440 320"
              style={{ position: 'absolute', bottom: 0 }}
            >
              <Path
                fill="#000"
                d="M0,224L48,213.3C96,203,192,181,288,160C384,139,480,117,576,128C672,139,768,181,864,186.7C960,192,1056,160,1152,138.7C1248,117,1344,107,1392,101.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              />
            </Svg>
          </View>
        ),
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
                  }}>
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
          <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => navigation.navigate('EditProfile', { slideFrom: 'left' })}>
            <GlowIcon
              name="person-circle-outline"
              size={35}
              gradientColors={["#5A60EA", "#FF00F5"]}
            />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            style={{ marginRight: 15 }}
            onPress={() => navigation.navigate('Settings', { slideFrom: 'right' })}
          >
            <GlowIcon
              name="settings-outline"
              size={25}
              gradientColors={["#5A60EA", "#FF00F5"]}
            />
          </TouchableOpacity>
        ),

        /**
         * 3) Tab bar styling
         */
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          fontStyle: 'italic' // add creative font styling to tab labels
        },
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "transparent",
          borderTopWidth: 0, // Remove the white line above the bottom navigation bar
        },
        tabBarActiveTintColor: "#FF00F5",
        tabBarInactiveTintColor: "#7B1FA2",
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
        name="Camera"
        component={CameraScreen}
        options={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide the tab bar
          tabBarButton: (props) => (
            <CustomTabBarButton {...props}>
              <GlowIcon
                name="camera-outline"
                size={30}
                gradientColors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                // Diagonal gradient for camera: from top left to bottom right.
                gradientStart={{ x: 0, y: 0 }}
                gradientEnd={{ x: 1, y: 1 }}
              />
            </CustomTabBarButton>
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
  );
}

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize database and sync service
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🔄 Starting app initialization...');

        // Initialize the SQLite database
        const db = await initDatabase();
        console.log('✅ Database initialized successfully', db ? 'Database connected' : 'Database not properly connected');

        // Start periodic sync
        await startPeriodicSync();
        console.log('✅ Periodic sync started');

        // Set up online sync
        setupOnlineSync();
        console.log('✅ Online sync set up');
      } catch (error) {
        console.error('❌ Error initializing app:', error);
      } finally {
        // Short delay to ensure database is fully initialized
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };

    initApp();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <NavigationContainer
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: "#000",
              card: "#000",
              primary: "#8A2BE2",
              text: "#fff",
              border: "#333",
              notification: "#8A2BE2",
              cardOverlay: 'rgba(0,0,0,1)', // Fully opaque black
            },
          }}
        >
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              animationDuration: 200,
              cardStyle: { backgroundColor: "#000" },
              contentStyle: { backgroundColor: "#000" },
              presentation: 'card',
              detachPreviousScreen: false,
              animationTypeForReplace: 'push',
              cardStyleInterpolator: ({ current, next, layouts }) => {
                return {
                  cardStyle: {
                    backgroundColor: '#000',
                    transform: [
                      {
                        translateX: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [layouts.screen.width, 0],
                        }),
                      },
                    ],
                  },
                  overlayStyle: {
                    backgroundColor: '#000',
                    opacity: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.5],
                    }),
                  },
                };
              },
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="EditProfile"
              component={EditProfile}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="EditGoals"
              component={EditGoals}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="DeleteAccount"
              component={DeleteAccount}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="ChangePassword"
              component={ChangePassword}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="AboutUs"
              component={AboutUs}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
              options={({ route }) => ({
                animation: route.params?.slideFrom === "left" ? "slide_from_left" : "slide_from_right",
                animationDuration: 200,
              })}
            />
            <Stack.Screen
              name="ImageCapture"
              component={ImageCaptureScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Nutrients"
              component={Nutrients}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </>
  );
}

/**
 * A reusable component that masks an Ionicon with a linear gradient,
 * and also adds a surrounding glow.
 */
function GlowIcon({ name, size, gradientColors, gradientStart, gradientEnd }) {
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
          start={gradientStart || { x: 0, y: 0 }}
          end={gradientEnd || { x: 1, y: 0 }}
          style={{ width: size, height: size }}
        />
      </MaskedView>
    </View>
  );
}
