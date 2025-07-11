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
import LoadingScreen from './src/components/LoadingScreen';
import { handleTakePhoto } from './src/screens/Camera';
import { getDatabase } from './src/utils/database';
import { startPeriodicSync, setupOnlineSync } from './src/utils/syncService';
import { StepProvider } from './src/context/StepContext';
import { ThemeProvider } from './src/ThemeContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import { FoodLogProvider } from './src/context/FoodLogContext';

// Import Supabase token manager for optimized authentication
import tokenManager from './src/utils/tokenManager';
// Import Enhanced Services
import PermanentNotificationService from './src/services/PermanentNotificationService';
import EnhancedPermanentNotificationService from './src/services/EnhancedPermanentNotificationService';
import BackgroundStepTrackerInstance, { BackgroundStepTracker } from './src/services/BackgroundStepTracker';
import SettingsService from './src/services/SettingsService';

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
import Analytics from "./src/screens/Analytics";
import PremiumSubscription from './src/screens/PremiumSubscription';
import FeatureRequests from './src/screens/FeatureRequests';
import CreateFeatureRequest from './src/screens/CreateFeatureRequest';
import { navigationRef } from './src/navigation/RootNavigation';
import FutureSelfRecordingSimple from './src/screens/FutureSelfRecordingSimple';

const { width } = Dimensions.get("window");

// Calculate responsive dimensions
const getResponsiveDimensions = () => {
  const buttonSize = Math.min(55, width * 0.14); // Cap at 55px, scale down on small devices
  const buttonRadius = buttonSize / 2;
  const offset = buttonRadius;
  const headerFontSize = Math.min(23, width * 0.055);
  const headerWidth = Math.min(160, width * 0.4);
  const iconSize = Math.min(35, width * 0.085);

  return {
    buttonSize,
    buttonRadius,
    offset,
    headerFontSize,
    headerWidth,
    iconSize
  };
};

const { buttonSize, buttonRadius, offset, headerFontSize, headerWidth, iconSize } = getResponsiveDimensions();

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
        marginLeft: -offset, // Center the container
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonRadius,
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
                    fontSize: headerFontSize,
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
                  width: headerWidth,
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
              size={iconSize}
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
          tabBarLabel: "Coach",
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

// Component to conditionally wrap authenticated app content with context providers
function AuthenticatedApp({ children }) {
  return (
    <ThemeProvider>
      <StepProvider>
        <FavoritesProvider>
          <FoodLogProvider>
            {children}
          </FoodLogProvider>
        </FavoritesProvider>
      </StepProvider>
    </ThemeProvider>
  );
}

// Component for authenticated user content
function AuthenticatedContent() {
  const { onboardingComplete, isLoading: onboardingLoading } = useOnboarding();
  const { isPreloading } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = React.useState(false);

  // Track when onboarding is completed to prevent flashing
  React.useEffect(() => {
    if (onboardingComplete) {
      setHasCompletedOnboarding(true);
    }
  }, [onboardingComplete]);

  // Show loading screen while either auth is preloading OR onboarding context is still loading
  // But once onboarding is completed, don't show loading screen again to prevent flashing
  if ((isPreloading || onboardingLoading) && !hasCompletedOnboarding) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  if (!onboardingComplete) {
    // Continue onboarding flow after login
    return <Onboarding />;
  }

  // Main app navigation for authenticated users
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen name="PremiumSubscription" component={PremiumSubscription} />
      <Stack.Screen name="Analytics" component={Analytics} />
      <Stack.Screen name="FeatureRequests" component={FeatureRequests} />
      <Stack.Screen name="CreateFeatureRequest" component={CreateFeatureRequest} />
      <Stack.Screen name="FutureSelfRecordingSimple" component={FutureSelfRecordingSimple} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, isLoading } = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  return (
    <NavigationContainer theme={DefaultTheme} ref={navigationRef}>
      <OnboardingProvider>
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
            // Show intro screens for unauthenticated users
            <>
              <Stack.Screen name="Onboarding" component={Onboarding} />
              <Stack.Screen name="Auth" component={Auth} />
            </>
          ) : (
            // Authenticated user content wrapped with remaining context providers
            <Stack.Screen name="AuthenticatedApp" options={{ headerShown: false }}>
              {() => (
                <AuthenticatedApp>
                  <AuthenticatedContent />
                </AuthenticatedApp>
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </OnboardingProvider>
    </NavigationContainer>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    // Initialize basic app components
    const initApp = async () => {
      try {
        // Always initialize database (needed for basic functionality)
        await getDatabase();

        // Check if we're running in Expo Go
        const isExpoGo = global.isExpoGo === true;

        if (isExpoGo) {
          console.log('Running in Expo Go - Some features like permanent notifications will be disabled');
        }

        // Initialize enhanced services
        try {
          // Initialize background step tracker
          console.log('Initializing background step tracker...');
          const stepAvailability = await BackgroundStepTrackerInstance.isAvailable();
          if (stepAvailability.supported) {
            await BackgroundStepTrackerInstance.startTracking();
            console.log('Background step tracking started successfully');
          } else {
            console.log('Step tracking not supported on this device');
          }

          // Initialize enhanced permanent notification service
          console.log('Initializing enhanced permanent notifications...');
          await EnhancedPermanentNotificationService.initialize();

          if (EnhancedPermanentNotificationService.isNotificationAvailable()) {
            await EnhancedPermanentNotificationService.startPermanentNotification();
            console.log('Enhanced permanent notifications started successfully');
          } else {
            if (isExpoGo) {
              console.log('Enhanced notifications available in limited mode in Expo Go (iOS scheduled notifications only)');
            } else {
              console.log('Enhanced notifications not available on this platform/configuration');
            }
          }

          // Keep legacy notification service as fallback
          await PermanentNotificationService.initialize();
          const settings = await SettingsService.getNotificationSettings();
          if (settings.permanentNotification?.enabled && !EnhancedPermanentNotificationService.isNotificationRunning()) {
            if (PermanentNotificationService.isNotificationAvailable()) {
              await PermanentNotificationService.startPermanentNotification();
              console.log('Legacy permanent notification started as fallback');
            }
          }
        } catch (error) {
          console.error('Failed to initialize enhanced services:', error);
          // Continue app initialization even if services fail
        }

        // App is ready
        setAppIsReady(true);
      } catch (e) {
        console.error("Initialization error:", e);
        setAppIsReady(true); // Set ready anyway to avoid blocking UI
      }
    };

    initApp();
  }, []);

  if (!appIsReady) {
    return <LoadingScreen message="Initializing PlateMate..." />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
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
