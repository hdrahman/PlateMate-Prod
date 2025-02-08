import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';

const SettingsScreen = () => {
    const { isDarkTheme, toggleTheme } = useContext(ThemeContext);
    const navigation = useNavigation();

    return (
        <SafeAreaView style={[styles.container, isDarkTheme ? styles.dark : styles.light]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isDarkTheme ? styles.darkText : styles.lightText]}>
                        Appearance
                    </Text>
                    <View style={styles.itemRow}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Dark Mode
                        </Text>
                        <Switch value={isDarkTheme} onValueChange={toggleTheme} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isDarkTheme ? styles.darkText : styles.lightText]}>
                        Account
                    </Text>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('EditProfileScreen')}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Edit Profile
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('EditGoalsScreen')}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Edit Goals
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('PremiumSubscriptionScreen')}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Premium Subscription
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('DeleteAccountScreen')}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Delete Account
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('ChangePasswordScreen')}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Change Password
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.item} onPress={() => { /* handle log out action */ }}>
                        <Text style={[styles.itemText, isDarkTheme ? styles.darkText : styles.lightText]}>
                            Log Out
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* ...additional sections can be added here... */}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // ...existing code...
    },
    light: {
        backgroundColor: '#f0f0f0',
    },
    dark: {
        backgroundColor: '#333',
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
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        // ...existing code...
    },
    item: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        // ...existing code...
    },
    itemText: {
        fontSize: 16,
        // ...existing code...
    },
    darkText: {
        color: '#fff',
    },
    lightText: {
        color: '#000',
    }
});

export default SettingsScreen;
