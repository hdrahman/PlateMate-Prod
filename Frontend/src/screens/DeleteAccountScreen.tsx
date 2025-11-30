import React, { useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { ThemeContext } from '../ThemeContext';

const DeleteAccountScreen = () => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Delete Account</Text>
                <Text style={[styles.warning, { color: theme.colors.error }]}>Are you sure you want to delete your account? This action cannot be undone.</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    warning: {
        fontSize: 18,
        textAlign: 'center',
    }
});

export default DeleteAccountScreen;
