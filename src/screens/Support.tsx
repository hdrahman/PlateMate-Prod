import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const Support = () => (
    <SafeAreaView style={styles.container}>
        <Text>Support Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default Support;
