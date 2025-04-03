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
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { ThemeContext } from "../ThemeContext";

const { width } = Dimensions.get("window");

// Types for the chat messages
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Mock function for AI calls - replace with actual API call when backend is ready
const callAdvisorAI = async (message: string): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Sample personalized responses based on common nutrition questions
  if (message.toLowerCase().includes('protein')) {
    return "Based on your recent logs, you're averaging 85g of protein daily which is below your target of 140g for your body weight and goals. I noticed you tend to skip protein at breakfast.\n\nRecommendations for you specifically:\n• Add 2 scoops of protein to your morning smoothie (+40g protein)\n• Replace the turkey wraps (12g protein) you had Tuesday/Thursday with grilled chicken breast (28g protein)\n• Consider Greek yogurt as your evening snack instead of the crackers you've been logging";
  } else if (message.toLowerCase().includes('carb') || message.toLowerCase().includes('carbohydrate')) {
    return "Looking at your meal logs, you're consuming about 220g of carbs daily, which aligns with your needs. However, I notice your energy crashes around 3pm according to your activity data.\n\nTry these adjustments:\n• Shift some carbs from dinner to your pre-workout meal\n• Your breakfast bagel is causing glucose spikes - switch to steel-cut oats\n• Your training days (Mon/Wed/Fri) should have 60g more carbs than rest days, but your logs show the opposite pattern";
  } else if (message.toLowerCase().includes('meal plan') || message.toLowerCase().includes('diet plan')) {
    return "Based on your logged meals, workout schedule, and 'moderate weight gain' goal, here's a customized plan:\n\nBreakfast: Upgrade your current toast to 3 eggs, 1 slice whole grain toast, and 1/2 avocado (+250 calories from your usual)\n\nLunch: Keep your chicken salad but double the protein to 8oz and add 1/4 cup walnuts\n\nPre-workout: Your banana is good, but add 1 scoop protein\n\nDinner: Your current salmon dinner is perfect! Keep that in rotation\n\nEvening: Add a casein protein shake before bed (you're in a fasting state too long based on your recovery metrics)";
  } else if (message.toLowerCase().includes('weight loss')) {
    return "Looking at your logs, you're actually in maintenance right now at 2300 calories despite your weight loss goal. Your high-calorie weekends (avg. 2800 cal) are offsetting your disciplined weekdays (avg. 1950 cal).\n\nPersonalized suggestions based on your metabolism and food preferences:\n• Keep your weekend social meals but substitute the beer (your logs show 3-4 per weekend) with vodka soda to save 450 calories\n• Your lunch salads are good but the dressing adds 220 calories - try the oil and vinegar option\n• Based on your sleep data, your late night snacking is affecting recovery - try going to bed 30 minutes earlier";
  } else if (message.toLowerCase().includes('supplement')) {
    return "Based on your logs and fitness profile, here are the supplements that would benefit you specifically:\n\n1. Creatine: Since you're not currently taking it and you do high-intensity training 4x weekly, start with 5g daily\n\n2. Vitamin D: Your blood work shows you're at 22ng/mL which is low. Supplement with 4000IU daily\n\n3. Magnesium: Your logged muscle cramps and evening restlessness suggest a deficiency. Try 300mg before bed\n\nYou don't need a pre-workout based on your heart rate variability data, and your protein timing is more important than adding BCAAs to your regimen.";
  } else {
    return "I've analyzed your recent meal logs, workout data, and progress metrics. You're making good progress, but a few tweaks could help you reach your goals faster. Your protein intake is about 75% of what's optimal for your body composition, and your pre/post workout nutrition timing could be improved. What specific aspect of your nutrition would you like me to analyze more deeply?";
  }
};

export default function Chatbot() {
  const { isDarkTheme } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hi Alex! I'm your PlateMate Nutrition Advisor. Based on your recent food logs, I see you're making progress toward your muscle-building goals. How can I help today?",
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
      text: "Looking at your logged meals from the past week, I noticed you're currently getting about 85g of protein daily, which is only about 60% of your target based on your weight (76kg).\n\nRecommendations specifically for you:\n\n1. Increase protein: Your breakfast (usually just coffee) is a missed opportunity. Try adding Greek yogurt with 20g protein or 3 eggs (~18g protein).\n\n2. I see you're eating a lot of white rice. Switch to quinoa - your body responds better to complex carbs based on your glucose readings.\n\n3. Add healthy fats: Your logged meals show very little healthy fat. Add avocado to your lunch salads or a handful of almonds as a snack.\n\n4. Post-workout: Your Monday and Thursday workout logs show great intensity, but you're waiting 2+ hours to eat after. Have your chicken and sweet potato meal within 45 minutes for better muscle recovery.\n\nYour recent salmon dinner was perfect! More meals like that would be ideal for your goals.",
      sender: "bot",
      timestamp: new Date(Date.now() - 30000)
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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

    try {
      // Get AI response
      const response = await callAdvisorAI(userMessage.text);

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      // Handle error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I couldn't process your request. Please try again.",
        sender: "bot",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
              <Text style={styles.headerTitle}>Nutrition Advisor</Text>
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
              {message.sender === "bot" ? (
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
              <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
            </View>
          ))}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF00F5" />
              <LinearGradient
                colors={["#5A60EA", "#FF00F5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loadingGradient}
              >
                <Text style={styles.loadingText}>Thinking...</Text>
              </LinearGradient>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about nutrition, meal plans, etc..."
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
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 40, // To compensate for the back button and center the title
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
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
});
