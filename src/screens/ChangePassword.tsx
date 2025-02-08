import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const ChangePassword = () => (
    <SafeAreaView style={styles.container}>
        <Text>Change Password Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default ChangePassword;
