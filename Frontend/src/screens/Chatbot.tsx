import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
  Animated,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { ThemeContext } from "../ThemeContext";
import axios from "axios";
import { BACKEND_URL } from '../utils/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import RichTextRenderer from "../components/RichTextRenderer";
import tokenManager, { ServiceTokenType } from '../utils/tokenManager';
import { addFoodLog } from '../utils/database';
import {
  getUserProfileBySupabaseUid,
  getRecentFoodLogs,
  getFoodLogsByDate,
  getTodayCalories,
  getTodayProtein,
  getTodayCarbs,
  getTodayFats,
  getTodayExerciseCalories,
  getUserStreak,
  getCurrentUserId
} from '../utils/database';

// Get IP and port from the BACKEND_URL
const BACKEND_BASE_URL = BACKEND_URL.split('/').slice(0, 3).join('/');

const { width } = Dimensions.get("window");

// Types for the chat messages
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isTyping?: boolean;
}

// Define navigation types
type RootStackParamList = {
  FoodDetail: { foodId: number };
  FoodLog: { refresh?: number };
  // Add other screens as needed
};

type ChatbotNavigationProp = StackNavigationProp<RootStackParamList>;

// User context interface
interface UserContext {
  profile: any;
  recentNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    exerciseCalories: number;
  };
  recentFoodLogs: any[];
  streak: number;
  summary: string;
}

export default function Chatbot() {
  const { isDarkTheme } = useContext(ThemeContext);
  const { user } = useAuth();
  const navigation = useNavigation<ChatbotNavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hey there! I'm Coach Max, your AI Health Coach! Let's maximize your potential today - how can I help you crush your health goals?",
      sender: "bot",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contextActive, setContextActive] = useState(false);
  const [contextData, setContextData] = useState<UserContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isNutritionistMode, setIsNutritionistMode] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const dot1Opacity = useRef(new Animated.Value(0.4)).current;
  const dot2Opacity = useRef(new Animated.Value(0.4)).current;
  const dot3Opacity = useRef(new Animated.Value(0.4)).current;

  // Helper function to get Firebase authentication token using TokenManager
  const getFirebaseToken = async (): Promise<string> => {
    try {
      // Use the cached token system for better performance
      const token = await tokenManager.getToken(ServiceTokenType.SUPABASE_AUTH);
      return token;
    } catch (error) {
      console.error('Error getting Firebase token:', error);
      throw new Error('Authentication failed. Please sign in again.');
    }
  };

  // Prefetch token when component mounts
  useEffect(() => {
    // Prefetch authentication tokens to speed up first message
    const prefetchTokens = async () => {
      try {
        // Prefetch Supabase auth token
        await tokenManager.getToken(ServiceTokenType.SUPABASE_AUTH);

        // Try to prefetch DeepSeek token since this chatbot exclusively uses DeepSeek
        try {
          await tokenManager.getToken('deepseek');
          console.log('New deepseek token acquired, valid until: ' + new Date(Date.now() + 3600000).toLocaleTimeString());
        } catch (error) {
          console.log('DeepSeek token not cached yet');
        }

        console.log('Auth tokens prefetched for Coach Max chat');
      } catch (error) {
        console.error('Failed to prefetch auth tokens:', error);
      }
    };

    prefetchTokens();
  }, []);

  // Helper function to format date for database queries
  const formatDateForDatabase = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Load user context from local SQLite database
  const loadUserContext = async () => {
    try {
      setIsLoadingContext(true);
      console.log('🔄 Loading user context from local database...');

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user profile
      const profile = await getUserProfileBySupabaseUid(user.id);

      // Get recent nutrition data (today)
      const todayCalories = await getTodayCalories();
      const todayProtein = await getTodayProtein();
      const todayCarbs = await getTodayCarbs();
      const todayFats = await getTodayFats();
      const todayExerciseCalories = await getTodayExerciseCalories();

      // Get recent food logs (last 25 entries)
      const recentFoodLogs = await getRecentFoodLogs(15);

      // Get user streak
      const userStreak = await getUserStreak(user.id);

      // Create context summary
      const contextSummary = `Recent activity: ${todayCalories} calories consumed today, ${recentFoodLogs.length} recent meals logged, ${userStreak} day streak`;

      const userContext: UserContext = {
        profile,
        recentNutrition: {
          calories: todayCalories,
          protein: todayProtein,
          carbs: todayCarbs,
          fats: todayFats,
          exerciseCalories: todayExerciseCalories
        },
        recentFoodLogs: recentFoodLogs.slice(0, 10), // Limit to 10 most recent for context
        streak: userStreak,
        summary: contextSummary
      };

      console.log('✅ User context loaded successfully');
      console.log('📊 Context summary:', contextSummary);

      setContextData(userContext);
      setContextActive(true);

      // Context loaded successfully

    } catch (error: any) {
      console.error('❌ Error loading context:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      let errorText = "I couldn't load your activity data right now. This might be because you haven't logged any food or exercise data yet, or there's a connection issue. Let's chat without context for now!";

      if (error.message?.includes('Authentication failed') || error.message?.includes('User not authenticated')) {
        errorText = "You need to sign in again to access your personalized data. Let's continue with general coaching!";
      } else if (error.message?.includes('Database not initialized')) {
        errorText = "Your local data isn't ready yet. Please try again in a moment!";
      }

      // Add error message to chat instead of alert
      const errorMessage: Message = {
        id: "context-error-" + Date.now(),
        text: `⚠️ ${errorText}`,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingContext(false);
    }
  };

  // Clear context
  const clearContext = () => {
    setContextActive(false);
    setContextData(null);

    const clearMessage: Message = {
      id: "context-cleared-" + Date.now(),
      text: "🔄 I've cleared your activity data. I'm back to general coaching mode. You can re-enable context anytime!",
      sender: "bot",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, clearMessage]);
  };

  // Smart context suggestion based on user input
  const shouldSuggestContext = (userMessage: string): boolean => {
    if (contextActive) return false;

    const contextKeywords = [
      'my progress', 'my goal', 'my diet', 'my workout', 'my calories',
      'my nutrition', 'my exercise', 'my food', 'my weight', 'my intake',
      'how am i doing', 'am i meeting', 'track my', 'my recent', 'my habit',
      'plan my meals', 'my eating', 'my fitness', 'my activity'
    ];

    const message = userMessage.toLowerCase();
    return contextKeywords.some(keyword => message.includes(keyword));
  };

  // Suggest context loading
  const suggestContext = () => {
    const suggestionMessage: Message = {
      id: "context-suggestion-" + Date.now(),
      text: "💡 I could give you much more personalized advice if you enable the 'Get Personalized Advice' feature below! It lets me access your recent nutrition and exercise data so I can give you specific recommendations based on your actual patterns and progress.",
      sender: "bot",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, suggestionMessage]);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle nutrition data from FoodLog screen
  useEffect(() => {
    const params = route.params as any;
    if (params?.nutritionData && params?.autoStart) {
      // Set nutritionist mode if specified
      if (params?.isNutritionistMode) {
        setIsNutritionistMode(true);
        // Reset messages to start a clean nutritionist session
        setMessages([]);
      }

      // Turn on context mode
      setContextActive(true);

      // Call DeepSeek V3 for nutrition analysis via secure backend
      handleNutritionAnalysis(params.nutritionData, params.nutritionAnalysisPrompt);
    }
  }, [route.params]);

  const handleNutritionAnalysis = async (nutritionData: any, customPrompt?: string) => {
    try {
      setIsLoading(true);
      setIsTyping(true);

      // Add typing indicator
      const typingIndicator: Message = {
        id: 'typing-analysis-' + Date.now().toString(),
        text: "",
        sender: "bot",
        timestamp: new Date(),
        isTyping: true
      };
      setMessages([typingIndicator]);

      // Start token fetch early in the process
      const tokenPromise = getFirebaseToken();

      // Call secure backend endpoint for DeepSeek V3 analysis
      const token = await tokenPromise;
      const response = await axios.post(
        `${BACKEND_BASE_URL}/deepseek/nutrition-analysis`,
        {
          nutritionData,
          autoStart: true,
          customPrompt: customPrompt || ""
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 65000  // Set 65-second timeout to match backend's 60s timeout with a buffer
        }
      );

      // Remove typing indicator and add Coach Max's analysis
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      // Get AI response and add our own introduction rather than letting AI generate one each time
      let aiResponse = response.data.response;

      // Replace intro section with our hardcoded version if this is a nutrition report
      if (customPrompt && customPrompt.includes("nutritional consultation")) {
        // Define a custom introduction that doesn't waste tokens
        const customIntro = `Thanks for sharing your food log! Let's break this down together and see where we can optimize your nutrition to better support your goals. I'll walk through the key areas: calories, macros, strengths, and gaps, and give you some clear next steps.`;

        // Clean up the AI response to remove any introduction sections
        aiResponse = aiResponse
          // Remove comprehensive nutrition consultation intro
          .replace(/^(Comprehensive Nutrition Consultation|Nutrition Analysis|Nutritional Analysis)(.*?)(:\s*|\n+)/i, '')
          // Remove any greeting or intro paragraph
          .replace(/^(Hi|Hello|Hey|Greetings|Thank you|Thanks)(.*?)(for sharing|for logging|for recording|for tracking)(.*?)(\.|!)\s*/i, '')
          // Remove "Coach Max" and similar intros
          .replace(/^(Coach Max|As your nutritionist|As your health coach|As your personal nutritionist)(.*?)(\n+|\.|!)\s*/i, '')
          // Remove superfluous whitespace at the beginning
          .replace(/^\s+/, '')
          // Remove any quoted text at the beginning
          .replace(/^["'](.+?)["']\s*/i, '')
          // Remove introduction labels
          .replace(/^(Introduction|Intro):\s*/i, '');

        // Combine our intro with cleaned AI response
        aiResponse = customIntro + "\n\n" + aiResponse;
      }

      const analysisMessage: Message = {
        id: "nutrition-analysis-" + Date.now().toString(),
        text: aiResponse,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages([analysisMessage]);

      // Note: Token will be refreshed automatically on next request if needed

    } catch (error: any) {
      console.error('Error getting nutrition analysis:', error);

      // Remove typing indicator and add fallback message
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      let errorMessage = "Hey there! I'm ready to help you with your nutrition goals today. What would you like to discuss about your health journey?";

      // Handle specific error types
      if (error.message?.includes('Authentication failed') || error.message?.includes('User not authenticated')) {
        errorMessage = "Looks like you need to sign in again to get your personalized nutrition analysis. Please check your authentication and try again!";
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage = "I need you to be signed in to provide personalized nutrition coaching. Please check your login and try again!";
      } else if (error.response?.status === 504 || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // Handle timeout errors specifically
        errorMessage = "I'm sorry, but generating your nutrition analysis is taking longer than expected. This might happen with complex food logs. Please try again or simplify your request if this persists.";
      }

      const fallbackMessage: Message = {
        id: "fallback-" + Date.now().toString(),
        text: errorMessage,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages([fallbackMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const animateDots = () => {
      Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.4,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Opacity, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Opacity, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 400);
    };

    // Start animation loop
    if (isTyping) {
      const animationLoop = setInterval(animateDots, 1200);
      return () => clearInterval(animationLoop);
    }
  }, [isTyping, dot1Opacity, dot2Opacity, dot3Opacity]);

  const chatWithCoachMax = async (userMessage: string) => {
    try {
      // Format messages for API (exclude context system messages)
      const messageHistory = messages
        .filter(msg => !msg.isTyping && !msg.text.includes("🧠 I now have access") && !msg.text.includes("🔄 I've cleared"))
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text.trim()
        }))
        .filter(msg => msg.content.length > 0); // Remove empty messages

      // Add the new user message
      messageHistory.push({
        role: 'user',
        content: userMessage
      });

      // Start token fetch early and prepare the payload in parallel
      const tokenPromise = getFirebaseToken();
      let payload, endpoint;

      if (contextActive && contextData) {
        // Use context-aware endpoint with user context data from local database
        const contextString = `User Profile: ${contextData.profile?.first_name || 'User'} (${contextData.profile?.age || 'unknown age'}, ${contextData.profile?.gender || 'unknown gender'}, ${contextData.profile?.activity_level || 'unknown activity level'}). 
        Goals: ${contextData.profile?.fitness_goal || 'not specified'}, target weight: ${contextData.profile?.target_weight || 'not set'}, daily calorie target: ${contextData.profile?.daily_calorie_target || 'not set'}.
        Today's Nutrition: ${contextData.recentNutrition.calories} calories, ${contextData.recentNutrition.protein}g protein, ${contextData.recentNutrition.carbs}g carbs, ${contextData.recentNutrition.fats}g fats, ${contextData.recentNutrition.exerciseCalories} exercise calories burned.
        Recent Activity: ${contextData.recentFoodLogs.length} recent meals logged, current streak: ${contextData.streak} days.
        Recent Foods: ${contextData.recentFoodLogs.slice(0, 5).map(log => log.food_name).join(', ')}.`;

        payload = {
          messages: messageHistory,
          user_context: contextString,
          temperature: 0.7,
          max_tokens: 1000
        };
        endpoint = `${BACKEND_BASE_URL}/deepseek/chat-with-context`;

        console.log('🚀 Preparing context chat request:', {
          endpoint,
          messageCount: messageHistory.length,
          hasContext: true
        });
      } else {
        // Use regular endpoint
        const systemPrompt = {
          role: 'system',
          content: 'You are Coach Max, an expert AI Health Coach and nutritionist. You\'re energetic, motivational, and provide practical, actionable advice. Keep your responses friendly, supportive, and informative.'
        };

        payload = {
          messages: [systemPrompt, ...messageHistory],
          temperature: 0.7,
          max_tokens: 1000
        };
        endpoint = `${BACKEND_BASE_URL}/deepseek/chat`;

        console.log('🚀 Preparing regular chat request:', {
          endpoint,
          messageCount: payload.messages.length
        });
      }

      // Now get the token and make the request
      const token = await tokenPromise;

      // Note: Token will be refreshed automatically on next request if needed

      const response = await axios.post(
        endpoint,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 65000
        }
      );

      console.log('✅ Backend response received:', {
        status: response.status,
        data: response.data,
        response: response.data.response
      });

      if (!response.data.response) {
        console.error('❌ Empty response from backend:', response.data);
        throw new Error('Received empty response from Coach Max');
      }

      return response.data.response;
    } catch (error: any) {
      console.error("Error calling DeepSeek via backend:", error);

      // Log more detailed error information
      if (error.response) {
        console.error("Error response status:", error.response.status);
        console.error("Error response data:", error.response.data);
        console.error("Error response headers:", error.response.headers);
      }

      // Handle specific authentication errors
      if (error.message?.includes('Authentication failed') || error.message?.includes('User not authenticated')) {
        throw new Error("You need to sign in again to chat with Coach Max. Please check your authentication.");
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error("Authentication required to chat with Coach Max. Please sign in and try again.");
      } else if (error.response?.status === 422) {
        console.error("Validation error details:", error.response.data);
        throw new Error("There was an issue with the message format. Please try again.");
      }

      throw new Error("Failed to get response from Coach Max. Please try again.");
    }
  };

  const handleSend = async () => {
    if (input.trim() === "") return;

    const userInputText = input.trim();

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInputText,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Show typing indicator
    setIsTyping(true);
    const typingIndicator: Message = {
      id: 'typing-' + Date.now().toString(),
      text: "",
      sender: "bot",
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingIndicator]);

    try {
      // Get AI response
      console.log('🤖 Calling chatWithCoachMax with message:', userMessage.text);
      const response = await chatWithCoachMax(userMessage.text);
      console.log('🎯 Got response from chatWithCoachMax:', response);

      // Remove typing indicator and add bot response
      setMessages(prev => {
        const filtered = prev.filter(msg => !msg.isTyping);
        console.log('📝 Messages after removing typing indicator:', filtered.length);
        return filtered;
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "bot",
        timestamp: new Date()
      };

      console.log('💬 Adding bot message:', botMessage);
      setMessages(prev => {
        const newMessages = [...prev, botMessage];
        console.log('📨 Total messages after adding bot response:', newMessages.length);
        return newMessages;
      });

      // Check if we should suggest context (after a short delay)
      if (shouldSuggestContext(userInputText)) {
        setTimeout(() => {
          suggestContext();
        }, 2000);
      }
    } catch (error) {
      // Remove typing indicator and add error message
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      let botErrorText = "Hey, I'm having a little trouble connecting right now. Let's try again in a moment - I'm here to help you maximize your potential!";

      // Handle different error types with specific messaging
      if (error instanceof Error && (error.message.includes('Authentication') || error.message.includes('sign in'))) {
        botErrorText = "Looks like you need to sign in again to continue our conversation. Please check your authentication and come back - I'll be here to help!";
      } else if (error.response?.status === 504 || error.code === 'ECONNABORTED' || (error instanceof Error && error.message.includes('timeout'))) {
        // Handle timeout errors specifically
        botErrorText = "I'm sorry, but my response is taking longer than expected to generate. This can happen with complex questions. Please try again with a simpler query if this persists.";
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botErrorText,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);

      // Show alert with error
      Alert.alert("Error", error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkTheme ? "#000" : "#1E1E1E" }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <MaskedView
            style={{ alignItems: "center", justifyContent: "center" }}
            maskElement={
              <Text style={styles.headerTitle}>Coach</Text>
            }
          >
            <LinearGradient
              colors={["#5A60EA", "#FF00F5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: 200,
                height: 35,
              }}
            />
          </MaskedView>
          <View style={styles.onlineStatusContainer}>
            <Text style={styles.headerSubtitle}>AI Health Coach</Text>
            <Text style={styles.dot}>•</Text>
            <View style={styles.onlineIndicator} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={["#5A60EA", "#FF00F5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>CM</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Context Banner at Top */}
      {contextActive && (
        <View style={styles.topContextBanner}>
          <LinearGradient
            colors={["rgba(76, 175, 80, 0.1)", "rgba(69, 160, 73, 0.1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topContextBannerGradient}
          >
            <View style={styles.topContextBannerContent}>
              <View style={styles.topContextBannerLeft}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.topContextBannerText}>
                  Context Mode Active
                </Text>
              </View>
              <TouchableOpacity
                onPress={clearContext}
                style={styles.topContextClearButton}
              >
                <Text style={styles.topContextClearButtonText}>Disable</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Chat Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.sender === "user"
                  ? styles.userBubble
                  : styles.botBubble
              ]}
            >
              {message.sender === "bot" && message.isTyping ? (
                <View style={styles.botBubbleContent}>
                  <LinearGradient
                    colors={["#5A60EA", "#9B00FF", "#FF00F5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.botBubbleGradient}
                  >
                    <View style={styles.typingIndicator}>
                      <Animated.View style={[styles.typingDot, { opacity: dot1Opacity }]} />
                      <Animated.View style={[styles.typingDot, { opacity: dot2Opacity }]} />
                      <Animated.View style={[styles.typingDot, { opacity: dot3Opacity }]} />
                    </View>
                  </LinearGradient>
                </View>
              ) : message.sender === "bot" ? (
                <View style={styles.botBubbleContent}>
                  <LinearGradient
                    colors={["#5A60EA", "#9B00FF", "#FF00F5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.botBubbleGradient}
                  >
                    <Text style={styles.messageText}>{message.text}</Text>
                  </LinearGradient>
                </View>
              ) : (
                <Text style={styles.messageText}>{message.text}</Text>
              )}
              {!message.isTyping && (
                <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Context Banner for enabling context (only shown when context is not active) */}
        {!contextActive && (
          <View style={styles.contextBanner}>
            <LinearGradient
              colors={["rgba(90, 96, 234, 0.1)", "rgba(255, 0, 245, 0.1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.contextBannerGradient}
            >
              <View style={styles.contextBannerContent}>
                <View style={styles.contextBannerLeft}>
                  <Ionicons name="analytics" size={20} color="#5A60EA" />
                  <View style={styles.contextBannerText}>
                    <Text style={styles.contextBannerTitle}>Get Context-Aware Advice</Text>
                    <Text style={styles.contextBannerSubtitle}>
                      Let Coach Max access your activity data for specific recommendations
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={loadUserContext}
                  style={styles.contextBannerButton}
                  disabled={isLoadingContext}
                >
                  <LinearGradient
                    colors={["#5A60EA", "#FF00F5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.contextBannerButtonGradient}
                  >
                    {isLoadingContext ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.contextBannerButtonText}>Enable</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Coach Max about your health and fitness goals..."
            placeholderTextColor="#777"
            multiline
          />

          <TouchableOpacity
            onPress={handleSend}
            style={styles.sendButton}
            disabled={input.trim() === "" || isLoading}
          >
            <LinearGradient
              colors={["#5A60EA", "#FF00F5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.sendButtonGradient,
                (input.trim() === "" || isLoading) && styles.disabledButton
              ]}
            >
              <Ionicons name="send" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    alignSelf: "center",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#CCC",
    marginTop: 0,
    marginBottom: 0,
  },
  onlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  dot: {
    color: '#CCC',
    fontSize: 12,
    marginHorizontal: 4,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964', // iOS green color
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#CCC',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  avatarGradient: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
    paddingTop: 2,
  },
  messagesContent: {
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 20,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: "#333",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
    marginLeft: "20%",
  },
  botBubble: {
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    marginRight: "20%",
    backgroundColor: "transparent",
  },
  botBubbleContent: {
    overflow: "hidden",
    borderRadius: 20,
    borderTopLeftRadius: 4,
  },
  botBubbleGradient: {
    padding: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
  },
  messageText: {
    color: "white",
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    color: "#999",
    fontSize: 12,
    marginTop: 5,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 12,
    color: "white",
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#FF00F5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginVertical: 10,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.7)",
  },
  loadingGradient: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loadingText: {
    color: "white",
    fontSize: 14,
  },
  typingIndicator: {
    flexDirection: "row",
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
    margin: 2,
  },
  contextBanner: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  contextBannerGradient: {
    padding: 1,
  },
  contextBannerContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 11,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contextBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  contextBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  contextBannerTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  contextBannerSubtitle: {
    color: "#AAA",
    fontSize: 12,
    lineHeight: 16,
  },
  contextBannerButton: {
    borderRadius: 8,
    overflow: "hidden",
  },
  contextBannerButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  contextBannerButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  topContextBanner: {
    marginHorizontal: 0,
    marginBottom: 5,
    marginTop: 1,
    overflow: "hidden",
    borderWidth: 0,
  },
  topContextBannerGradient: {
    padding: 0,
  },
  topContextBannerContent: {
    backgroundColor: "rgba(26, 26, 26, 0.7)",
    padding: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(76, 175, 80, 0.3)",
  },
  topContextBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  topContextBannerText: {
    marginLeft: 8,
    color: "#4CAF50",
    fontSize: 13,
    fontWeight: "600",
  },
  topContextClearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  topContextClearButtonText: {
    color: "#F44336",
    fontSize: 12,
    fontWeight: "500",
  },
});
