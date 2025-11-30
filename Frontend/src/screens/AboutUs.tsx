import React, { useContext } from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { ThemeContext } from '../ThemeContext';

const AboutUs = () => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={{ color: theme.colors.text }}>About Us Screen</Text>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default AboutUs;
