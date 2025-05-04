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
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { ThemeContext } from "../ThemeContext";
import axios from "axios";
import { BACKEND_URL } from '../utils/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Get IP and port from the BACKEND_URL
const BACKEND_BASE_URL = BACKEND_URL.split('/').slice(0, 3).join('/');

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

export default function Chatbot() {
  const { isDarkTheme } = useContext(ThemeContext);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm Dr. Rodriguez, your nutrition specialist. How can I help you today?",
      sender: "bot",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
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

  const chatWithArliAI = async (userMessage: string) => {
    try {
      // Format messages for Arli AI API
      const messageHistory = messages
        .filter(msg => !msg.isTyping)
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Add the new user message
      messageHistory.push({
        role: 'user',
        content: userMessage
      });

      const payload = {
        messages: messageHistory,
        conversation_id: conversationId
      };

      // Call the backend API
      const response = await axios.post(
        `${BACKEND_BASE_URL}/arli/chat`,
        payload
      );

      // Save the conversation ID for future messages
      if (response.data.conversation_id) {
        setConversationId(response.data.conversation_id);
      }

      return response.data.response;
    } catch (error) {
      console.error("Error calling Arli AI:", error);
      throw new Error("Failed to get response from Dr. Rodriguez. Please try again.");
    }
  };

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
      const response = await chatWithArliAI(userMessage.text);

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
        text: "Sorry, I couldn't process your request. Please try again.",
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
            placeholder="Ask Dr. Rodriguez about your nutrition concerns..."
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
