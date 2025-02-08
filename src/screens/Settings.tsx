import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const SettingsScreen = () => {
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const navigation = useNavigation<any>();

    const toggleTheme = () => setIsDarkTheme(previousState => !previousState);

    return (
        <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('EditProfile')}>
                        <Text style={styles.itemText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('EditGoals')}>
                        <Text style={styles.itemText}>Edit Goals</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('PremiumSubscription')}>
                        <Text style={styles.itemText}>Premium Subscription</Text>
                    </TouchableOpacity>
                </View>

                {/* Settings Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <View style={styles.itemRow}>
                        <Text style={styles.itemText}>Theme</Text>
                        <Switch value={isDarkTheme} onValueChange={toggleTheme} />
                    </View>
                </View>

                {/* Help Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Help</Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('AboutUs')}>
                        <Text style={styles.itemText}>About Us</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('Support')}>
                        <Text style={styles.itemText}>Support</Text>
                    </TouchableOpacity>
                </View>

                {/* Actions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Actions</Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('ChangePassword')}>
                        <Text style={[styles.itemText, styles.danger]}>Change Password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('DeleteAccount')}>
                        <Text style={[styles.itemText, styles.danger]}>Delete Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.push('Logout')}>
                        <Text style={[styles.itemText, styles.danger]}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // ...existing code...
    },
    content: {
        padding: 20,
        // ...existing code...
    },
    section: {
        marginBottom: 30,
        // ...existing code...
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 10,
        // ...existing code...
    },
    item: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        // ...existing code...
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        // ...existing code...
    },
    itemText: {
        fontSize: 16,
        // ...existing code...
    },
    danger: {
        color: 'red',
        // ...existing code...
    },
    light: {
        backgroundColor: '#fff',
        // ...existing code...
    },
    dark: {
        backgroundColor: '#333',
        // ...existing code...
    }
});

export default SettingsScreen;
