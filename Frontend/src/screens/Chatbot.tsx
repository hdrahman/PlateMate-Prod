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
  Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { ThemeContext } from "../ThemeContext";

const { width } = Dimensions.get("window");

// Mock user profile for personalization
const userProfile = {
  name: "Alex",
  age: 28,
  weight: 76, // kg
  height: 180, // cm
  goals: "Muscle building",
  recentWorkouts: ["Upper body", "Cardio", "Legs"],
  dietaryPreferences: ["High protein", "Low sugar"],
  lastActive: "2 hours ago"
};

// Types for the chat messages
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isTyping?: boolean;
}

// Mock function for AI calls - replace with actual API call when backend is ready
const callAdvisorAI = async (message: string): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Sample personalized responses based on common nutrition questions
  if (message.toLowerCase().includes('protein')) {
    return `Based on your recent logs, you're averaging 85g of protein daily which is below your target of 140g for your weight (${userProfile.weight}kg) and ${userProfile.goals} goals. I noticed you tend to skip protein at breakfast.\n\nRecommendations for you specifically:\n• Add 2 scoops of protein to your morning smoothie (+40g protein)\n• Replace the turkey wraps (12g protein) you had Tuesday/Thursday with grilled chicken breast (28g protein)\n• Consider Greek yogurt as your evening snack instead of the crackers you've been logging`;
  } else if (message.toLowerCase().includes('carb') || message.toLowerCase().includes('carbohydrate')) {
    return `Looking at your meal logs, you're consuming about 220g of carbs daily, which aligns with your needs. However, I notice your energy crashes around 3pm according to your activity data.\n\nTry these adjustments:\n• Shift some carbs from dinner to your pre-workout meal\n• Your breakfast bagel is causing glucose spikes - switch to steel-cut oats\n• Your training days (${userProfile.recentWorkouts[0]} and ${userProfile.recentWorkouts[2]}) should have 60g more carbs than rest days, but your logs show the opposite pattern`;
  } else if (message.toLowerCase().includes('meal plan') || message.toLowerCase().includes('diet plan')) {
    return `Based on your logged meals, workout schedule, and '${userProfile.goals}' goal, here's a customized plan:\n\nBreakfast: Upgrade your current toast to 3 eggs, 1 slice whole grain toast, and 1/2 avocado (+250 calories from your usual)\n\nLunch: Keep your chicken salad but double the protein to 8oz and add 1/4 cup walnuts\n\nPre-workout: Your banana is good, but add 1 scoop protein\n\nDinner: Your current salmon dinner is perfect! Keep that in rotation\n\nEvening: Add a casein protein shake before bed (you're in a fasting state too long based on your recovery metrics)`;
  } else if (message.toLowerCase().includes('weight loss')) {
    return "Looking at your logs, you're actually in maintenance right now at 2300 calories despite your weight loss goal. Your high-calorie weekends (avg. 2800 cal) are offsetting your disciplined weekdays (avg. 1950 cal).\n\nPersonalized suggestions based on your metabolism and food preferences:\n• Keep your weekend social meals but substitute the beer (your logs show 3-4 per weekend) with vodka soda to save 450 calories\n• Your lunch salads are good but the dressing adds 220 calories - try the oil and vinegar option\n• Based on your sleep data, your late night snacking is affecting recovery - try going to bed 30 minutes earlier";
  } else if (message.toLowerCase().includes('supplement')) {
    return "Based on your logs and fitness profile, here are the supplements that would benefit you specifically:\n\n1. Creatine: Since you're not currently taking it and you do high-intensity training 4x weekly, start with 5g daily\n\n2. Vitamin D: Your blood work shows you're at 22ng/mL which is low. Supplement with 4000IU daily\n\n3. Magnesium: Your logged muscle cramps and evening restlessness suggest a deficiency. Try 300mg before bed\n\nYou don't need a pre-workout based on your heart rate variability data, and your protein timing is more important than adding BCAAs to your regimen.";
  } else {
    return `I've analyzed your recent meal logs, workout data (${userProfile.recentWorkouts.join(', ')}), and progress metrics. You're making good progress, but a few tweaks could help you reach your ${userProfile.goals} goals faster. Your protein intake is about 75% of what's optimal for your body composition, and your pre/post workout nutrition timing could be improved. What specific aspect of your nutrition would you like me to analyze more deeply?`;
  }
};

// Get time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function Chatbot() {
  const { isDarkTheme } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: `${getGreeting()}, ${userProfile.name}! I'm Emily, your nutrition advisor. I see you've been focused on ${userProfile.goals}. Your ${userProfile.recentWorkouts[0]} workout yesterday looked intense! How can I help with your nutrition today?`,
      sender: "bot",
      timestamp: new Date()
    },
    {
      id: "2",
      text: "I'm trying to build muscle, what foods should I eat?",
      sender: "user",
      timestamp: new Date(Date.now() - 60000)
    },
    {
      id: "3",
      text: `Looking at your logged meals from the past week, I noticed you're currently getting about 85g of protein daily, which is only about 60% of your target based on your weight (${userProfile.weight}kg).\n\nRecommendations specifically for you:\n\n1. Increase protein: Your breakfast (usually just coffee) is a missed opportunity. Try adding Greek yogurt with 20g protein or 3 eggs (~18g protein).\n\n2. I see you're eating a lot of white rice. Switch to quinoa - your body responds better to complex carbs based on your glucose readings.\n\n3. Add healthy fats: Your logged meals show very little healthy fat. Add avocado to your lunch salads or a handful of almonds as a snack.\n\n4. Post-workout: Your Monday and Thursday workout logs show great intensity, but you're waiting 2+ hours to eat after. Have your chicken and sweet potato meal within 45 minutes for better muscle recovery.\n\nYour recent salmon dinner was perfect! More meals like that would be ideal for your goals.`,
      sender: "bot",
      timestamp: new Date(Date.now() - 30000)
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const dot1Opacity = useRef(new Animated.Value(0.4)).current;
  const dot2Opacity = useRef(new Animated.Value(0.4)).current;
  const dot3Opacity = useRef(new Animated.Value(0.4)).current;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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

  const handleSend = async () => {
    if (input.trim() === "") return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
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
      const response = await callAdvisorAI(userMessage.text);

      // Remove typing indicator and add bot response
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      // Remove typing indicator and add error message
      setMessages(prev => prev.filter(msg => !msg.isTyping));

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Sorry ${userProfile.name}, I couldn't process your request. Please try again.`,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <MaskedView
            style={{ alignItems: "center", justifyContent: "center" }}
            maskElement={
              <Text style={styles.headerTitle}>Doctor Rodriguez</Text>
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
            <Text style={styles.headerSubtitle}>Nutrition Specialist</Text>
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
            <Text style={styles.avatarText}>DR</Text>
          </LinearGradient>
        </View>
      </View>

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

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Ask Dr. Rodriguez about ${userProfile.dietaryPreferences[0].toLowerCase()}, ${userProfile.goals.toLowerCase()}, etc...`}
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
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginLeft: -40, // Offset to compensate for the back button and avatar
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#CCC",
    marginTop: 2,
  },
  onlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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
  },
  messagesContent: {
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 20,
    marginVertical: 8,
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
});
