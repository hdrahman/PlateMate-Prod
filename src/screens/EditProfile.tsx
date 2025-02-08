import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

const EditProfile = () => (
    <SafeAreaView style={styles.container}>
        <Text>Edit Profile Screen</Text>
    </SafeAreaView>
);

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
export default EditProfile;
