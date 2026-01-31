import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    StatusBar as RNStatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { ThemeContext } from '../ThemeContext';

export default function ChangePassword() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);

    const [isLoading, setIsLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChangePassword = async () => {
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert('Error', 'New password must be at least 8 characters');
            return;
        }

        // Validate password contains lowercase, uppercase, and number
        if (!/[a-z]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one lowercase letter');
            return;
        }

        if (!/[A-Z]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one uppercase letter');
            return;
        }

        if (!/[0-9]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one number');
            return;
        }

        setIsLoading(true);

        try {
            // Ensure the user is authenticated
            if (!user || !user.email) {
                throw new Error('User not authenticated');
            }

            // Re-authenticate the user with their current password using Supabase
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                throw signInError;
            }

            // Update the password using Supabase
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                throw updateError;
            }

            Alert.alert('Success', 'Password updated successfully');

            // Clear form and go back
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            navigation.goBack();
        } catch (error: any) {
            console.error('Change password error:', error);

            // Handle specific error cases
            if (error.message?.includes('Invalid login credentials')) {
                Alert.alert('Error', 'Current password is incorrect');
            } else if (error.message?.includes('too many requests')) {
                Alert.alert('Error', 'Too many unsuccessful attempts. Please try again later.');
            } else {
                Alert.alert('Error', 'Failed to change password. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            edges={['top']}
        >
            <RNStatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Change Password</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Current Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: theme.colors.text }]}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            secureTextEntry={!showCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor={theme.colors.textSecondary}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                            <Ionicons
                                name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>New Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: theme.colors.text }]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor={theme.colors.textSecondary}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowNewPassword(!showNewPassword)}
                        >
                            <Ionicons
                                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Password must be at least 8 characters</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Confirm New Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: theme.colors.text }]}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={theme.colors.textSecondary}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            <Ionicons
                                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.changeButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleChangePassword}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                    ) : (
                        <Text style={[styles.changeButtonText, { color: theme.colors.text }]}>Update Password</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    content: {
        padding: 20,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
    },
    passwordInput: {
        flex: 1,
        height: 50,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 10,
    },
    helperText: {
        fontSize: 12,
        marginTop: 4,
    },
    changeButton: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    changeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    }
});
