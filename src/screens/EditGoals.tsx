import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const EditGoals = () => (
    <SafeAreaView style={styles.container}>
        <Text>Edit Goals Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default EditGoals;
