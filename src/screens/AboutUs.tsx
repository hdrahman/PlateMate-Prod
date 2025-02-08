import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const AboutUs = () => (
    <SafeAreaView style={styles.container}>
        <Text>About Us Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default AboutUs;
