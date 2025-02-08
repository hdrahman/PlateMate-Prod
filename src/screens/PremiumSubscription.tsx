import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const PremiumSubscription = () => (
    <SafeAreaView style={styles.container}>
        <Text>Premium Subscription Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default PremiumSubscription;
