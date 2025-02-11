import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const Logout = () => (
    <SafeAreaView style={styles.container}>
        <Text>Logout Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default Logout;
