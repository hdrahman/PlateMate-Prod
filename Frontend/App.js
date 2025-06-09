import React, { useState, useEffect } from "react";
import { NavigationContainer, DefaultTheme, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View, Text, StatusBar, Dimensions, ActivityIndicator } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from 'react-native-svg';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { handleTakePhoto } from './src/screens/Camera';
import { getDatabase } from './src/utils/database';
import { startPeriodicSync, setupOnlineSync } from './src/utils/syncService';
import { StepProvider } from './src/context/StepContext';
import { ThemeProvider } from './src/ThemeContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import { FoodLogProvider } from './src/context/FoodLogContext';

// Import Firebase to ensure it's properly recognized
import { app, auth } from './src/utils/firebase/index';

import Home from "./src/screens/Home";
import FoodLog from "./src/screens/FoodLog";
import Explore from "./src/screens/Explore";
import Chatbot from "./src/screens/Chatbot";
import EditProfile from './src/screens/EditProfile';
import EditGoals from './src/screens/EditGoals';
import DeleteAccount from './src/screens/DeleteAccount';
import ChangePassword from './src/screens/ChangePassword';
import AboutUs from './src/screens/AboutUs';
import Settings from './src/screens/Settings';
import Notifications from './src/screens/Notifications';
import DataSharing from './src/screens/DataSharing';
import PrivacyPolicy from './src/screens/PrivacyPolicy';
import CameraScreen from './src/screens/Camera';
import ImageCaptureScreen from './src/screens/ImageCapture';
import Nutrients from './src/screens/Nutrients';
import BarcodeScannerScreen from './src/screens/BarcodeScanner';
import BarcodeResults from './src/screens/BarcodeResults';
import ScannedProduct from './src/screens/ScannedProduct';
import Manual from './src/screens/Manual';
import MealPlanner from "./src/screens/MealPlanner";
import MealPlannerCamera from "./src/screens/MealPlannerCamera";
import MealPlannerResults from "./src/screens/MealPlannerResults";
import RecipeDetails from "./src/screens/RecipeDetails";
import RecipeResults from "./src/screens/RecipeResults";
import SearchResults from "./src/screens/SearchResults";
import MealGallery from "./src/screens/MealGallery";
import FoodDetail from "./src/screens/FoodDetail";
import Auth from "./src/screens/Auth";
import Onboarding from "./src/screens/Onboarding";

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
        onPress={() => navigation.navigate('Camera')}
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
        name="MealPlanner"
        component={MealPlanner}
        options={{
          tabBarLabel: "Meal Planner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Chatbot"
        component={Chatbot}
        options={{
          headerShown: false,
          tabBarLabel: "Nutritionist",
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

function AppNavigator() {
  const { user, isLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();

  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#0074dd" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DefaultTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          // For slide animations from left/right
          cardStyleInterpolator: ({ current, layouts, next, inverted, routeName, ...rest }) => {
            const slideFrom = rest.route.params?.slideFrom;
            if (!slideFrom) return { cardStyle: { opacity: current.progress } };

            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [slideFrom === 'right' ? layouts.screen.width : -layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        {!user ? (
          // Authentication flow
          <Stack.Screen name="Auth" component={Auth} />
        ) : !onboardingComplete ? (
          // Onboarding flow
          <Stack.Screen name="Onboarding" component={Onboarding} />
        ) : (
          // Main app flow
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Camera" component={CameraScreen} />
            <Stack.Screen name="ImageCapture" component={ImageCaptureScreen} />
            <Stack.Screen name="Nutrients" component={Nutrients} />
            <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
            <Stack.Screen name="BarcodeResults" component={BarcodeResults} />
            <Stack.Screen name="ScannedProduct" component={ScannedProduct} />
            <Stack.Screen name="Manual" component={Manual} />
            <Stack.Screen name="MealPlannerCamera" component={MealPlannerCamera} />
            <Stack.Screen name="MealPlannerResults" component={MealPlannerResults} />
            <Stack.Screen name="RecipeDetails" component={RecipeDetails} />
            <Stack.Screen name="RecipeResults" component={RecipeResults} />
            <Stack.Screen name="SearchResults" component={SearchResults} />
            <Stack.Screen name="MealGallery" component={MealGallery} />
            <Stack.Screen name="FoodDetail" component={FoodDetail} />
            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="EditGoals" component={EditGoals} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccount} />
            <Stack.Screen name="ChangePassword" component={ChangePassword} />
            <Stack.Screen name="AboutUs" component={AboutUs} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="DataSharing" component={DataSharing} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  // Initialize app data
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Initialize the database
      await getDatabase();
      console.log("Database initialized successfully");

      // Start periodic sync
      startPeriodicSync();
      console.log("Periodic sync started");

      // Setup online sync
      setupOnlineSync();
      console.log("Online sync setup complete");

      // App is ready
      setIsReady(true);
    } catch (error) {
      console.error("Error initializing app:", error);
      // Still mark as ready to avoid getting stuck
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#0074dd" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaProvider>
        <AuthProvider>
          <OnboardingProvider>
            <ThemeProvider>
              <StepProvider>
                <FavoritesProvider>
                  <FoodLogProvider>
                    <AppNavigator />
                  </FoodLogProvider>
                </FavoritesProvider>
              </StepProvider>
            </ThemeProvider>
          </OnboardingProvider>
        </AuthProvider>
      </SafeAreaProvider>
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
