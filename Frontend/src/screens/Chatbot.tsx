import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Chatbot() {
  return (
    <View style={styles.container}>
      <Text>Chatbot Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
