import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ExpoGoNotice = ({ feature }) => {
    // Check if we're running in Expo Go using the global variable set in index.js
    const isExpoGo = global.isExpoGo === true;

    if (!isExpoGo) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Running in Expo Go</Text>
            <Text style={styles.message}>
                {feature
                    ? `The ${feature} feature is not available in Expo Go.`
                    : 'Some features are not available in Expo Go.'}
            </Text>
            <Text style={styles.instruction}>
                To access all features, create a development build with:
            </Text>
            <Text style={styles.code}>npm run build-dev</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
        marginVertical: 10,
        backgroundColor: '#FFF3CD',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#FFEEBA',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#856404',
    },
    message: {
        marginBottom: 5,
        color: '#856404',
    },
    instruction: {
        color: '#856404',
    },
    code: {
        fontFamily: 'monospace',
        backgroundColor: '#FFF9E6',
        padding: 5,
        marginTop: 5,
        color: '#856404',
    },
});

export default ExpoGoNotice; 