import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const DeleteAccountScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Delete Account</Text>
                <Text style={styles.warning}>Are you sure you want to delete your account? This action cannot be undone.</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
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
        color: 'red',
        fontSize: 18,
        textAlign: 'center',
    }
});

export default DeleteAccountScreen;
