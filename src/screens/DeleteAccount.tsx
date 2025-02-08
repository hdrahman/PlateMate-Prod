import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const DeleteAccount = () => (
    <SafeAreaView style={styles.container}>
        <Text>Delete Account Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default DeleteAccount;
